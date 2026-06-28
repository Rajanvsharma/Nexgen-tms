'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { toast } from '@/store/toast.store';
import Topbar from '@/components/layout/Topbar';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Load {
  id: string; loadNumber: string; status: string;
  pickupCity: string; pickupState: string;
  deliveryCity: string; deliveryState: string;
  commodity: string | null; weight: number | null; equipment: string;
  pickupDate: string | null; deliveryDate: string | null;
  customerRate: number; carrierRate: number | null; margin: number | null;
  specialInstructions: string | null; driverName: string | null; driverPhone: string | null;
  customer: { id: string; name: string } | null;
  carrier:  { id: string; name: string; mcNumber: string } | null;
  createdAt: string;
}

interface POD {
  id: string; filename: string; fileUrl: string; fileSize: number | null;
  podType: string; notes: string | null; createdAt: string;
  uploadedBy: { firstName: string; lastName: string; email: string };
}

interface Accessorial {
  id: string; type: string; amount: number; billTo: string;
  description: string | null; approved: boolean; createdAt: string;
  createdBy: { firstName: string; lastName: string };
}

interface LoadStop {
  id: string; sequence: number; type: string; city: string; state: string;
  address: string | null; zipCode: string | null; contactName: string | null;
  contactPhone: string | null; appointmentDate: string | null;
  notes: string | null; completedAt: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate  = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const fmtMoney = (n: number | null) =>
  n != null ? `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—';
const fmtSize  = (bytes: number | null) =>
  bytes == null ? '' : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const ACCESSORIAL_TYPES = [
  'Fuel Surcharge','Detention','Layover','TONU','Lumper','Stop-off',
  'Overweight Permit','Oversize Permit','Team Driver','Hazmat','Other',
];

const inp: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #e2e8f0',
  fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff',
};
const sel = { ...inp };

// ─── Component ────────────────────────────────────────────────────────────────

export default function LoadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [load,        setLoad]        = useState<Load | null>(null);
  const [pods,        setPods]        = useState<POD[]>([]);
  const [accessorials,setAccessorials]= useState<Accessorial[]>([]);
  const [stops,       setStops]       = useState<LoadStop[]>([]);
  const [tab,         setTab]         = useState<'pods'|'accessorials'|'stops'|'bids'>('pods');
  const [bids,        setBids]        = useState<{id:string;carrierId:string;amount:number|null;notes:string|null;status:string;createdAt:string;carrier:{id:string;name:string;mcNumber:string;email:string|null;phone:string|null;status:string;}}[]>([]);
  const [bidsSaving,  setBidsSaving]  = useState<string|null>(null);
  const [loading,     setLoading]     = useState(true);

  // POD upload state
  const fileRef  = useRef<HTMLInputElement>(null);
  const [podType, setPodType] = useState('POD');
  const [podNote, setPodNote] = useState('');
  const [uploading, setUploading] = useState(false);

  // Accessorial form state
  const [accForm,   setAccForm]   = useState({ type: ACCESSORIAL_TYPES[0], amount: '', billTo: 'CUSTOMER', description: '' });
  const [accSaving, setAccSaving] = useState(false);

  // Stops state
  const [editingStops, setEditingStops] = useState<Omit<LoadStop,'id'|'completedAt'>[]>([]);
  const [stopsSaving,  setStopsSaving]  = useState(false);
  const [stopsMode,    setStopsMode]    = useState(false);

  // GPS link copy state
  const [linkCopied, setLinkCopied] = useState(false);

  const fetchLoad = useCallback(async () => {
    try {
      const res = await api.get(`/loads/${id}`);
      setLoad(res.data);
    } catch {
      toast.error('Failed to load details');
    }
  }, [id]);

  const fetchPods  = useCallback(() => api.get(`/loads/${id}/pods`).then(r => setPods(r.data)).catch(() => {}), [id]);
  const fetchAccs  = useCallback(() => api.get(`/loads/${id}/accessorials`).then(r => setAccessorials(r.data)).catch(() => {}), [id]);
  const fetchStops = useCallback(() => api.get(`/loads/${id}/stops`).then(r => setStops(r.data)).catch(() => {}), [id]);
  const fetchBids  = useCallback(() => api.get(`/loads/${id}/bids`).then(r => setBids(r.data)).catch(() => {}), [id]);

  useEffect(() => {
    Promise.all([fetchLoad(), fetchPods(), fetchAccs(), fetchStops(), fetchBids()]).finally(() => setLoading(false));
  }, [fetchLoad, fetchPods, fetchAccs, fetchStops, fetchBids]);

  // ── POD upload ──────────────────────────────────────────────────────────────
  async function handleUploadPOD() {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error('Select a file first');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('podType', podType);
      form.append('notes', podNote);
      const res = await api.postForm(`/loads/${id}/pods`, form);
      setPods(p => [res.data, ...p]);
      toast.success('POD uploaded successfully');
      setPodNote('');
      if (fileRef.current) fileRef.current.value = '';
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function deletePOD(podId: string) {
    await api.delete(`/loads/${id}/pods/${podId}`);
    setPods(p => p.filter(x => x.id !== podId));
    toast.success('POD deleted');
  }

  // ── Accessorial ─────────────────────────────────────────────────────────────
  async function addAccessorial() {
    if (!accForm.amount) return toast.error('Enter an amount');
    setAccSaving(true);
    try {
      const res = await api.post(`/loads/${id}/accessorials`, {
        type:        accForm.type,
        amount:      parseFloat(accForm.amount),
        billTo:      accForm.billTo,
        description: accForm.description || undefined,
      });
      setAccessorials(a => [res.data, ...a]);
      setAccForm({ type: ACCESSORIAL_TYPES[0], amount: '', billTo: 'CUSTOMER', description: '' });
      toast.success('Accessorial added');
    } catch {
      toast.error('Failed to add accessorial');
    } finally {
      setAccSaving(false);
    }
  }

  async function toggleApprove(acc: Accessorial) {
    const res = await api.patch(`/loads/${id}/accessorials/${acc.id}`, { approved: !acc.approved });
    setAccessorials(a => a.map(x => x.id === acc.id ? res.data : x));
  }

  async function deleteAccessorial(accId: string) {
    await api.delete(`/loads/${id}/accessorials/${accId}`);
    setAccessorials(a => a.filter(x => x.id !== accId));
    toast.success('Accessorial removed');
  }

  // ── Stops ────────────────────────────────────────────────────────────────────
  function enterStopsEdit() {
    setEditingStops(stops.map(s => ({
      sequence: s.sequence, type: s.type, city: s.city, state: s.state,
      address: s.address || '', zipCode: s.zipCode || '',
      contactName: s.contactName || '', contactPhone: s.contactPhone || '',
      appointmentDate: s.appointmentDate ? s.appointmentDate.slice(0,10) : '',
      notes: s.notes || '',
    })));
    setStopsMode(true);
  }

  function addStopRow() {
    setEditingStops(s => [...s, { sequence: s.length + 1, type: 'STOP', city: '', state: '', address: '', zipCode: '', contactName: '', contactPhone: '', appointmentDate: '', notes: '' }]);
  }

  function updateStopRow(i: number, field: string, value: string) {
    setEditingStops(s => s.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  function removeStopRow(i: number) {
    setEditingStops(s => s.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, sequence: idx + 1 })));
  }

  async function saveStops() {
    setStopsSaving(true);
    try {
      const res = await api.put(`/loads/${id}/stops`, { stops: editingStops });
      setStops(res.data);
      setStopsMode(false);
      toast.success('Stops saved');
    } catch {
      toast.error('Failed to save stops');
    } finally {
      setStopsSaving(false);
    }
  }

  async function markComplete(stopId: string) {
    const res = await api.patch(`/loads/${id}/stops/${stopId}/complete`, {});
    setStops(s => s.map(x => x.id === stopId ? res.data : x));
    toast.success('Stop marked complete');
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
      <Topbar title="Load Detail" />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Loading…</div>
    </div>
  );

  if (!load) return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
      <Topbar title="Load Not Found" />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button onClick={() => router.back()} style={{ padding: '8px 16px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Go Back</button>
      </div>
    </div>
  );

  const margin = load.margin;
  const marginColor = margin == null ? '#64748b' : margin >= 15 ? '#15803d' : margin >= 8 ? '#a16207' : '#dc2626';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', overflow: 'hidden' }}>
      <Topbar
        title={`${load.loadNumber}`}
        subtitle={`${load.pickupCity}, ${load.pickupState} → ${load.deliveryCity}, ${load.deliveryState}`}
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '24px', background: '#f8fafc' }}>

        {/* ── Back ── */}
        <button onClick={() => router.push('/loads')} style={{ marginBottom: 20, padding: '6px 14px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, cursor: 'pointer', color: '#475569', fontWeight: 600 }}>
          ← Back to Loads
        </button>

        {/* ── Summary Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Status',        value: load.status.replace(/_/g,' ') },
            { label: 'Equipment',     value: load.equipment },
            { label: 'Customer Rate', value: fmtMoney(load.customerRate) },
            { label: 'Carrier Rate',  value: fmtMoney(load.carrierRate) },
            { label: 'Margin',        value: margin != null ? `${margin.toFixed(1)}%` : '—', color: marginColor },
            { label: 'Customer',      value: load.customer?.name || '—' },
            { label: 'Carrier',       value: load.carrier?.name  || 'Unassigned' },
            { label: 'Pickup Date',   value: fmtDate(load.pickupDate) },
            { label: 'Delivery Date', value: fmtDate(load.deliveryDate) },
          ].map(card => (
            <div key={card.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{card.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: card.color || '#0f172a' }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* ── GPS Tracking ── */}
        {(() => {
          const trackingUrl = typeof window !== 'undefined'
            ? `${window.location.origin}/driver-track/${load.id}`
            : `/driver-track/${load.id}`;
          const copyLink = () => {
            navigator.clipboard.writeText(trackingUrl);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
          };
          return (
            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:'18px 22px', marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:14, color:'#0f172a', marginBottom:3 }}>📍 Live GPS Tracking</div>
                  <div style={{ fontSize:12, color:'#64748b' }}>Send this link to the driver — they open it on their phone and their location updates every 30 seconds.</div>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                  <code style={{ background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:6, padding:'6px 10px', fontSize:11, color:'#475569', maxWidth:300, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>
                    {trackingUrl}
                  </code>
                  <button onClick={copyLink} style={{ padding:'7px 16px', background: linkCopied ? '#22c55e' : '#0f172a', color:'#fff', border:'none', borderRadius:7, fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', transition:'background 0.2s' }}>
                    {linkCopied ? '✓ Copied!' : '📋 Copy Link'}
                  </button>
                  <a href={`https://wa.me/?text=${encodeURIComponent('Open this link to share your live location: ' + trackingUrl)}`} target="_blank" rel="noreferrer"
                    style={{ padding:'7px 14px', background:'#25D366', color:'#fff', border:'none', borderRadius:7, fontSize:12, fontWeight:700, cursor:'pointer', textDecoration:'none', whiteSpace:'nowrap' }}>
                    WhatsApp
                  </a>
                </div>
              </div>
              {load.driverName && (
                <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid #f1f5f9', fontSize:12, color:'#64748b' }}>
                  Driver: <strong style={{ color:'#0f172a' }}>{load.driverName}</strong>
                  {load.driverPhone && <>&nbsp;·&nbsp;<a href={`sms:${load.driverPhone}?&body=${encodeURIComponent('Open this link to share your live location: ' + trackingUrl)}`} style={{ color:'#3b82f6', textDecoration:'none' }}>Send via SMS</a></>}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Tabs ── */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            {(['pods','accessorials','stops','bids'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '12px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                border: 'none', background: 'transparent', outline: 'none',
                color: tab === t ? '#1d4ed8' : '#64748b',
                borderBottom: tab === t ? '2px solid #1d4ed8' : '2px solid transparent',
              }}>
                {t === 'pods' ? `PODs (${pods.length})` : t === 'accessorials' ? `Accessorials (${accessorials.length})` : t === 'stops' ? `Stops (${stops.length})` : `Carrier Bids${bids.length>0?` (${bids.length})`:''}`}
              </button>
            ))}
          </div>

          {/* ── PODs Tab ── */}
          {tab === 'pods' && (
            <div style={{ padding: 24 }}>
              {/* Upload form */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 18, marginBottom: 24 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 12 }}>Upload Proof of Delivery</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: 10, alignItems: 'end' }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4 }}>File</label>
                    <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.tiff,.webp" style={{ ...inp, padding: '6px 8px', fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4 }}>Type</label>
                    <select value={podType} onChange={e => setPodType(e.target.value)} style={sel}>
                      {['POD','BOL','LUMPER RECEIPT','SCALE TICKET','OTHER'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4 }}>Notes</label>
                    <input value={podNote} onChange={e => setPodNote(e.target.value)} placeholder="Optional notes…" style={inp} />
                  </div>
                  <button onClick={handleUploadPOD} disabled={uploading} style={{ padding: '9px 18px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: uploading ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                    {uploading ? 'Uploading…' : 'Upload'}
                  </button>
                </div>
              </div>

              {/* POD list */}
              {pods.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0', fontSize: 14 }}>No documents uploaded yet</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {pods.map(pod => (
                    <div key={pod.id} style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 9, padding: '12px 16px' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                        {pod.filename.endsWith('.pdf') ? '📄' : '🖼'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pod.filename}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                          {pod.podType} · {fmtSize(pod.fileSize)} · Uploaded {fmtDate(pod.createdAt)} by {pod.uploadedBy.firstName} {pod.uploadedBy.lastName}
                          {pod.notes && ` · ${pod.notes}`}
                        </div>
                      </div>
                      <a href={pod.fileUrl} target="_blank" rel="noreferrer" style={{ padding: '5px 12px', background: '#dbeafe', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#1d4ed8', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                        View
                      </a>
                      <button onClick={() => deletePOD(pod.id)} style={{ padding: '5px 10px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 12, color: '#dc2626', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Accessorials Tab ── */}
          {tab === 'accessorials' && (
            <div style={{ padding: 24 }}>
              {/* Add form */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 18, marginBottom: 24 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 12 }}>Add Accessorial Charge</div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr auto', gap: 10, alignItems: 'end' }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4 }}>Type</label>
                    <select value={accForm.type} onChange={e => setAccForm(f => ({ ...f, type: e.target.value }))} style={sel}>
                      {ACCESSORIAL_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4 }}>Amount ($)</label>
                    <input type="number" min="0" step="0.01" value={accForm.amount} onChange={e => setAccForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" style={inp} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4 }}>Bill To</label>
                    <select value={accForm.billTo} onChange={e => setAccForm(f => ({ ...f, billTo: e.target.value }))} style={sel}>
                      <option value="CUSTOMER">Customer</option>
                      <option value="CARRIER">Carrier</option>
                      <option value="INTERNAL">Internal</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4 }}>Description</label>
                    <input value={accForm.description} onChange={e => setAccForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional…" style={inp} />
                  </div>
                  <button onClick={addAccessorial} disabled={accSaving} style={{ padding: '9px 18px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: accSaving ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                    {accSaving ? 'Adding…' : 'Add'}
                  </button>
                </div>
              </div>

              {/* Accessorial list */}
              {accessorials.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0', fontSize: 14 }}>No accessorials yet</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Type','Amount','Bill To','Description','By','Approved','Actions'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: '#475569', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {accessorials.map((acc, i) => (
                      <tr key={acc.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{acc.type}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#15803d' }}>{fmtMoney(acc.amount)}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 5, background: acc.billTo === 'CUSTOMER' ? '#dbeafe' : acc.billTo === 'CARRIER' ? '#fef3c7' : '#f1f5f9', color: acc.billTo === 'CUSTOMER' ? '#1d4ed8' : acc.billTo === 'CARRIER' ? '#b45309' : '#475569', fontSize: 11, fontWeight: 700 }}>
                            {acc.billTo}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#64748b' }}>{acc.description || '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#64748b' }}>{acc.createdBy.firstName} {acc.createdBy.lastName}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <button onClick={() => toggleApprove(acc)} style={{ padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: acc.approved ? '#dcfce7' : '#f1f5f9', color: acc.approved ? '#15803d' : '#64748b' }}>
                            {acc.approved ? 'Approved' : 'Pending'}
                          </button>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <button onClick={() => deleteAccessorial(acc.id)} style={{ padding: '4px 10px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 12, color: '#dc2626', fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Total */}
              {accessorials.length > 0 && (
                <div style={{ marginTop: 16, textAlign: 'right', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                  Total: {fmtMoney(accessorials.reduce((s, a) => s + a.amount, 0))}
                </div>
              )}
            </div>
          )}

          {/* ── Stops Tab ── */}
          {tab === 'stops' && (
            <div style={{ padding: 24 }}>
              {!stopsMode ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                    <button onClick={enterStopsEdit} style={{ padding: '8px 18px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      {stops.length === 0 ? 'Add Stops' : 'Edit Stops'}
                    </button>
                  </div>

                  {stops.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0', fontSize: 14 }}>No intermediate stops configured</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {stops.map(stop => (
                        <div key={stop.id} style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 9, padding: '12px 16px' }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: stop.completedAt ? '#dcfce7' : '#dbeafe', border: `2px solid ${stop.completedAt ? '#15803d' : '#1d4ed8'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: stop.completedAt ? '#15803d' : '#1d4ed8', flexShrink: 0 }}>
                            {stop.sequence}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>
                              {stop.type} — {stop.city}, {stop.state}
                              {stop.address && ` · ${stop.address}`}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                              {stop.contactName && `${stop.contactName} `}
                              {stop.contactPhone && `${stop.contactPhone} `}
                              {stop.appointmentDate && `· Appt: ${fmtDate(stop.appointmentDate)}`}
                              {stop.notes && ` · ${stop.notes}`}
                            </div>
                          </div>
                          {stop.completedAt ? (
                            <span style={{ padding: '4px 10px', background: '#dcfce7', color: '#15803d', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>Completed {fmtDate(stop.completedAt)}</span>
                          ) : (
                            <button onClick={() => markComplete(stop.id)} style={{ padding: '5px 12px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 6, fontSize: 12, color: '#15803d', fontWeight: 700, cursor: 'pointer' }}>
                              Mark Done
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Edit Stops</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={addStopRow} style={{ padding: '7px 16px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#475569' }}>+ Add Stop</button>
                      <button onClick={() => setStopsMode(false)} style={{ padding: '7px 16px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#475569' }}>Cancel</button>
                      <button onClick={saveStops} disabled={stopsSaving} style={{ padding: '7px 18px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: stopsSaving ? 0.6 : 1 }}>
                        {stopsSaving ? 'Saving…' : 'Save Stops'}
                      </button>
                    </div>
                  </div>

                  {editingStops.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px 0', fontSize: 13 }}>No stops yet — click "+ Add Stop"</div>
                  )}

                  {editingStops.map((stop, i) => (
                    <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#1d4ed8' }}>Stop #{i + 1}</span>
                        <button onClick={() => removeStopRow(i)} style={{ padding: '3px 10px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 5, fontSize: 11, color: '#dc2626', fontWeight: 700, cursor: 'pointer' }}>Remove</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                        <div>
                          <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 3 }}>Type</label>
                          <select value={stop.type} onChange={e => updateStopRow(i, 'type', e.target.value)} style={{ ...sel, fontSize: 12 }}>
                            {['PICKUP','DELIVERY','STOP','CROSS DOCK','FUEL STOP'].map(t => <option key={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 3 }}>City *</label>
                          <input value={stop.city} onChange={e => updateStopRow(i, 'city', e.target.value)} placeholder="City" style={{ ...inp, fontSize: 12 }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 3 }}>State *</label>
                          <input value={stop.state} onChange={e => updateStopRow(i, 'state', e.target.value)} placeholder="TX" maxLength={2} style={{ ...inp, fontSize: 12 }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 3 }}>Zip Code</label>
                          <input value={stop.zipCode || ''} onChange={e => updateStopRow(i, 'zipCode', e.target.value)} placeholder="75201" style={{ ...inp, fontSize: 12 }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 3 }}>Address</label>
                          <input value={stop.address || ''} onChange={e => updateStopRow(i, 'address', e.target.value)} placeholder="123 Main St" style={{ ...inp, fontSize: 12 }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 3 }}>Contact Name</label>
                          <input value={stop.contactName || ''} onChange={e => updateStopRow(i, 'contactName', e.target.value)} placeholder="John Doe" style={{ ...inp, fontSize: 12 }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 3 }}>Contact Phone</label>
                          <input value={stop.contactPhone || ''} onChange={e => updateStopRow(i, 'contactPhone', e.target.value)} placeholder="555-1234" style={{ ...inp, fontSize: 12 }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 3 }}>Appointment Date</label>
                          <input type="date" value={stop.appointmentDate || ''} onChange={e => updateStopRow(i, 'appointmentDate', e.target.value)} style={{ ...inp, fontSize: 12 }} />
                        </div>
                        <div style={{ gridColumn: 'span 4' }}>
                          <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 3 }}>Notes</label>
                          <input value={stop.notes || ''} onChange={e => updateStopRow(i, 'notes', e.target.value)} placeholder="Optional notes…" style={{ ...inp, fontSize: 12 }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* ── Carrier Bids Tab ── */}
          {tab === 'bids' && (
            <div style={{ padding: '20px 24px' }}>
              {bids.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 24px', color: '#94a3b8' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🚛</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 6 }}>No carrier bids yet</div>
                  <div style={{ fontSize: 13 }}>Carrier bids submitted via the carrier portal will appear here.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {bids.map(b => {
                    const BID_STYLE: Record<string,{bg:string;color:string}> = {
                      PENDING:   { bg:'#fef3c7', color:'#b45309' },
                      ACCEPTED:  { bg:'#d1fae5', color:'#065f46' },
                      REJECTED:  { bg:'#fee2e2', color:'#b91c1c' },
                      WITHDRAWN: { bg:'#f1f5f9', color:'#475569' },
                    };
                    const ss = BID_STYLE[b.status] ?? { bg:'#f1f5f9', color:'#475569' };
                    return (
                      <div key={b.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 18px', background: '#fafafa', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{b.carrier.name}</span>
                            <span style={{ fontSize: 11, color: '#64748b' }}>MC#{b.carrier.mcNumber}</span>
                            <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 700, background: ss.bg, color: ss.color }}>{b.status}</span>
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            {b.carrier.email && <span>{b.carrier.email}</span>}
                            {b.carrier.phone && <span> · {b.carrier.phone}</span>}
                          </div>
                          {b.notes && <div style={{ fontSize: 12, color: '#334155', marginTop: 6, fontStyle: 'italic' }}>"{b.notes}"</div>}
                        </div>
                        <div style={{ textAlign: 'right', minWidth: 100 }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
                            {b.amount ? `$${b.amount.toLocaleString('en-US',{minimumFractionDigits:0})}` : '—'}
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>Bid Rate</div>
                        </div>
                        {b.status === 'PENDING' && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              disabled={bidsSaving === b.id}
                              onClick={async () => {
                                setBidsSaving(b.id);
                                try {
                                  await api.post(`/loads/${id}/bids/${b.id}/accept`);
                                  toast.success('Bid accepted — carrier assigned to load');
                                  fetchLoad(); fetchBids();
                                } catch (e: any) {
                                  toast.error(e.response?.data?.message || 'Failed to accept bid');
                                } finally { setBidsSaving(null); }
                              }}
                              style={{ padding: '8px 16px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: bidsSaving===b.id?0.6:1 }}>
                              ✓ Accept
                            </button>
                            <button
                              disabled={bidsSaving === b.id}
                              onClick={async () => {
                                setBidsSaving(b.id);
                                try {
                                  await api.post(`/loads/${id}/bids/${b.id}/reject`);
                                  toast.success('Bid rejected');
                                  fetchBids();
                                } catch { toast.error('Failed to reject bid'); } finally { setBidsSaving(null); }
                              }}
                              style={{ padding: '8px 14px', background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: bidsSaving===b.id?0.6:1 }}>
                              ✕ Reject
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
