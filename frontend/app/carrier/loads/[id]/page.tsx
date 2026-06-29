'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CarrierTopbar from '@/components/layout/CarrierTopbar';
import api from '@/lib/api';

interface Stop { id:string; sequence:number; type:string; city:string; state:string; address:string|null; appointmentDate:string|null; completedAt:string|null; contactName:string|null; contactPhone:string|null; }
interface AuditEntry { action:string; toValue:string|null; changedAt:string; }
interface Pod { id:string; filename:string; fileUrl:string; podType:string; notes:string|null; createdAt:string; }
interface Document { id:string; type:string; filename:string; signedAt:string|null; createdAt:string; }
interface Load {
  id:string; loadNumber:string; status:string;
  pickupCity:string; pickupState:string; deliveryCity:string; deliveryState:string;
  equipment:string; commodity:string|null; weight:number|null;
  pickupDate:string|null; deliveryDate:string|null; carrierRate:number|null;
  specialInstructions:string|null; driverName:string|null; driverPhone:string|null;
  trackingLat:number|null; trackingLng:number|null; trackingUpdatedAt:string|null;
  customer:{ name:string; phone:string|null; email:string|null }|null;
  stops:Stop[]; documents:Document[]; pods:Pod[];
  invoice:{ id:string; status:string; amount:number; dueDate:string|null; paidDate:string|null }|null;
  payment:{ id:string; status:string; amount:number; dueDate:string|null; paidDate:string|null; notes:string|null }|null;
  auditLog:AuditEntry[];
  createdAt:string;
}

const STATUS_STYLE: Record<string,{bg:string;color:string}> = {
  CREATED:{bg:'#f1f5f9',color:'#475569'}, BOOKED:{bg:'#dbeafe',color:'#1d4ed8'},
  DISPATCHED:{bg:'#e0e7ff',color:'#4338ca'}, DRIVER_ON_ROUTE:{bg:'#c7d2fe',color:'#3730a3'},
  LOADING:{bg:'#fef3c7',color:'#b45309'}, IN_TRANSIT:{bg:'#fde68a',color:'#92400e'},
  ON_ROUTE:{bg:'#fef9c3',color:'#a16207'}, UNLOADING:{bg:'#ffedd5',color:'#c2410c'},
  DELIVERED:{bg:'#dcfce7',color:'#15803d'}, INVOICED:{bg:'#ddd6fe',color:'#5b21b6'},
  PAYMENTS:{bg:'#cffafe',color:'#0e7490'}, RECEIVED:{bg:'#ccfbf1',color:'#0f766e'},
  COMPLETED:{bg:'#d1fae5',color:'#065f46'}, CANCELLED:{bg:'#fee2e2',color:'#b91c1c'},
};
const PAY_STYLE: Record<string,{bg:string;color:string}> = {
  PENDING:{bg:'#fef3c7',color:'#b45309'}, SCHEDULED:{bg:'#dbeafe',color:'#1d4ed8'},
  PAID:{bg:'#d1fae5',color:'#065f46'}, CANCELLED:{bg:'#fee2e2',color:'#b91c1c'},
};

const ALLOWED_TRANSITIONS: Record<string,string[]> = {
  DISPATCHED:['DRIVER_ON_ROUTE','LOADING'],
  DRIVER_ON_ROUTE:['LOADING','IN_TRANSIT'],
  LOADING:['IN_TRANSIT'],
  IN_TRANSIT:['UNLOADING','DELIVERED'],
  ON_ROUTE:['DELIVERED'],
  UNLOADING:['DELIVERED'],
};
const STATUS_LABELS: Record<string,string> = {
  DRIVER_ON_ROUTE:'Driver On Route', LOADING:'Loading', IN_TRANSIT:'In Transit',
  UNLOADING:'Unloading', DELIVERED:'Delivered',
};

function fmtDate(d:string|null) { return d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'; }
function fmtMoney(n:number) { return `$${n.toLocaleString('en-US',{minimumFractionDigits:0})}`; }
function fmtTs(d:string) { return new Date(d).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}); }

export default function CarrierLoadDetailPage() {
  const { id } = useParams<{id:string}>();
  const router  = useRouter();
  const [load,       setLoad]       = useState<Load|null>(null);
  const [loading,    setLoading]    = useState(true);
  const [statusMode, setStatusMode] = useState(false);
  const [newStatus,  setNewStatus]  = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [podMode,    setPodMode]    = useState(false);
  const [podFile,    setPodFile]    = useState<File|null>(null);
  const [podType,    setPodType]    = useState('POD');
  const [podNotes,   setPodNotes]   = useState('');
  const [podSaving,  setPodSaving]  = useState(false);
  const [toast,      setToast]      = useState<{msg:string;ok:boolean}|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function showToast(msg:string, ok=true) { setToast({msg,ok}); setTimeout(()=>setToast(null),3500); }

  useEffect(() => {
    api.get(`/carrier-portal/loads/${id}`).then(r=>setLoad(r.data)).finally(()=>setLoading(false));
  }, [id]);

  async function handleStatusUpdate() {
    if (!newStatus || !load) return;
    setStatusSaving(true);
    try {
      await api.put(`/carrier-portal/loads/${load.id}/status`, { status: newStatus, note: statusNote || undefined });
      showToast('Status updated successfully');
      setStatusMode(false); setNewStatus(''); setStatusNote('');
      const r = await api.get(`/carrier-portal/loads/${id}`);
      setLoad(r.data);
    } catch (e:any) {
      showToast(e.response?.data?.message || 'Failed to update status', false);
    } finally {
      setStatusSaving(false);
    }
  }

  async function handlePodUpload() {
    if (!podFile || !load) return;
    setPodSaving(true);
    try {
      const fd = new FormData();
      fd.append('file', podFile);
      fd.append('podType', podType);
      if (podNotes) fd.append('notes', podNotes);
      await api.post(`/carrier-portal/loads/${load.id}/pod`, fd, { headers:{'Content-Type':'multipart/form-data'} });
      showToast('Document uploaded successfully');
      setPodMode(false); setPodFile(null); setPodType('POD'); setPodNotes('');
      const r = await api.get(`/carrier-portal/loads/${id}`);
      setLoad(r.data);
    } catch (e:any) {
      showToast(e.response?.data?.message || 'Upload failed', false);
    } finally {
      setPodSaving(false);
    }
  }

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <CarrierTopbar title="Load Detail" />
      <div style={{ flex:1, display:'grid', placeItems:'center', color:'#94a3b8' }}>Loading…</div>
    </div>
  );

  if (!load) return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <CarrierTopbar title="Load Detail" />
      <div style={{ flex:1, display:'grid', placeItems:'center', color:'#94a3b8' }}>Load not found</div>
    </div>
  );

  const ss = STATUS_STYLE[load.status] ?? { bg:'#f1f5f9', color:'#475569' };
  const nextStatuses = ALLOWED_TRANSITIONS[load.status] || [];
  const canUpdate = nextStatuses.length > 0;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <CarrierTopbar title={`Load ${load.loadNumber}`} subtitle={`${load.pickupCity}, ${load.pickupState} → ${load.deliveryCity}, ${load.deliveryState}`} />

      {toast && (
        <div style={{ position:'fixed', top:16, right:16, zIndex:9999, padding:'12px 20px', borderRadius:10, background:toast.ok?'#d1fae5':'#fee2e2', color:toast.ok?'#065f46':'#b91c1c', fontWeight:700, fontSize:13, boxShadow:'0 4px 16px rgba(0,0,0,0.12)' }}>
          {toast.msg}
        </div>
      )}

      <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>
        {/* Back + header */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <button onClick={()=>router.push('/carrier/loads')} style={{ padding:'7px 14px', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', color:'#475569' }}>
            ← Back
          </button>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <h1 style={{ margin:0, fontSize:20, fontWeight:800, color:'#0f172a' }}>{load.loadNumber}</h1>
              <span style={{ padding:'3px 10px', borderRadius:9999, fontSize:11, fontWeight:700, background:ss.bg, color:ss.color }}>
                {load.status.replace(/_/g,' ')}
              </span>
            </div>
            <p style={{ margin:'3px 0 0', color:'#64748b', fontSize:13 }}>
              {load.equipment}{load.commodity ? ` · ${load.commodity}` : ''}{load.weight ? ` · ${load.weight.toLocaleString()} lbs` : ''}
            </p>
          </div>
          {canUpdate && (
            <button onClick={()=>setStatusMode(true)} style={{ padding:'9px 18px', background:'#f59e0b', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', color:'#fff' }}>
              🔄 Update Status
            </button>
          )}
          <button onClick={()=>setPodMode(true)} style={{ padding:'9px 18px', background:'#0f172a', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', color:'#fff' }}>
            📎 Upload Document
          </button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(380px,1fr))', gap:16 }}>

          {/* Load Details */}
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:'20px' }}>
            <div style={{ fontWeight:700, fontSize:14, color:'#0f172a', marginBottom:14 }}>Load Details</div>
            {[
              ['Route', `${load.pickupCity}, ${load.pickupState} → ${load.deliveryCity}, ${load.deliveryState}`],
              ['Pickup', fmtDate(load.pickupDate)],
              ['Delivery', fmtDate(load.deliveryDate)],
              ['Equipment', load.equipment],
              ['Commodity', load.commodity || '—'],
              ['Weight', load.weight ? `${load.weight.toLocaleString()} lbs` : '—'],
              ['Driver', load.driverName || '—'],
              ['Driver Phone', load.driverPhone || '—'],
              ['Rate', load.carrierRate ? fmtMoney(load.carrierRate) : '—'],
              ['Customer', load.customer?.name || '—'],
            ].map(([label, val]) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #f8fafc' }}>
                <span style={{ fontSize:12, color:'#64748b', fontWeight:600 }}>{label}</span>
                <span style={{ fontSize:12, color:'#0f172a', fontWeight:600, textAlign:'right', maxWidth:220 }}>{val}</span>
              </div>
            ))}
            {load.specialInstructions && (
              <div style={{ marginTop:12, padding:'10px 12px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, fontSize:12, color:'#78350f', lineHeight:1.6 }}>
                <strong>Special Instructions:</strong> {load.specialInstructions}
              </div>
            )}
          </div>

          {/* GPS Map */}
          {load.trackingLat && load.trackingLng && (
            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:'20px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ fontWeight:700, fontSize:14, color:'#0f172a' }}>📍 Live Location</div>
                {load.trackingUpdatedAt && <div style={{ fontSize:11, color:'#94a3b8' }}>Updated {fmtTs(load.trackingUpdatedAt)}</div>}
              </div>
              <iframe
                title="GPS"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${load.trackingLng-0.05},${load.trackingLat-0.05},${load.trackingLng+0.05},${load.trackingLat+0.05}&layer=mapnik&marker=${load.trackingLat},${load.trackingLng}`}
                style={{ width:'100%', height:200, border:'none', borderRadius:8 }}
              />
            </div>
          )}

          {/* Stops Timeline */}
          {load.stops.length > 0 && (
            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:'20px' }}>
              <div style={{ fontWeight:700, fontSize:14, color:'#0f172a', marginBottom:14 }}>Stops</div>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {load.stops.map((s, i) => (
                  <div key={s.id} style={{ display:'flex', gap:12 }}>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                      <div style={{ width:28, height:28, borderRadius:'50%', background: s.completedAt ? '#d1fae5' : '#f1f5f9', border:`2px solid ${s.completedAt?'#22c55e':'#e2e8f0'}`, display:'grid', placeItems:'center', fontSize:11, fontWeight:700, color:s.completedAt?'#15803d':'#64748b', flexShrink:0 }}>
                        {s.completedAt ? '✓' : i+1}
                      </div>
                      {i < load.stops.length-1 && <div style={{ width:2, height:20, background:'#e2e8f0' }} />}
                    </div>
                    <div style={{ paddingBottom:6 }}>
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        <span style={{ fontSize:10, padding:'2px 6px', borderRadius:4, background:'#dbeafe', color:'#1d4ed8', fontWeight:700 }}>{s.type}</span>
                        <span style={{ fontSize:13, fontWeight:600, color:'#0f172a' }}>{s.city}, {s.state}</span>
                      </div>
                      {s.address && <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{s.address}</div>}
                      {s.appointmentDate && <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>Appt: {fmtDate(s.appointmentDate)}</div>}
                      {s.contactName && <div style={{ fontSize:11, color:'#64748b' }}>Contact: {s.contactName}{s.contactPhone ? ` · ${s.contactPhone}` : ''}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Status */}
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:'20px' }}>
            <div style={{ fontWeight:700, fontSize:14, color:'#0f172a', marginBottom:14 }}>💰 Payment</div>
            {load.payment ? (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                  <div style={{ fontSize:26, fontWeight:800, color:'#0f172a' }}>{fmtMoney(load.payment.amount)}</div>
                  <span style={{ padding:'3px 10px', borderRadius:9999, fontSize:11, fontWeight:700, background:PAY_STYLE[load.payment.status]?.bg||'#f1f5f9', color:PAY_STYLE[load.payment.status]?.color||'#475569' }}>
                    {load.payment.status}
                  </span>
                </div>
                {load.payment.dueDate && <div style={{ fontSize:12, color:'#64748b' }}>Due: {fmtDate(load.payment.dueDate)}</div>}
                {load.payment.paidDate && <div style={{ fontSize:12, color:'#15803d', fontWeight:600 }}>Paid: {fmtDate(load.payment.paidDate)}</div>}
                {load.payment.notes && <div style={{ fontSize:12, color:'#64748b', marginTop:8 }}>{load.payment.notes}</div>}
              </>
            ) : (
              <div style={{ color:'#94a3b8', fontSize:13 }}>No payment record yet. Payment will be created after delivery.</div>
            )}
          </div>

          {/* PODs & Documents */}
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:'20px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={{ fontWeight:700, fontSize:14, color:'#0f172a' }}>Documents</div>
              <button onClick={()=>setPodMode(true)} style={{ padding:'5px 12px', background:'#f59e0b', border:'none', borderRadius:7, fontSize:11, fontWeight:700, cursor:'pointer', color:'#fff' }}>
                + Upload
              </button>
            </div>

            {load.pods.length === 0 && load.documents.length === 0 ? (
              <div style={{ color:'#94a3b8', fontSize:13 }}>No documents uploaded yet.</div>
            ) : (
              <>
                {load.pods.map(p => (
                  <a key={p.id} href={p.fileUrl} target="_blank" rel="noopener noreferrer" style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid #f8fafc', textDecoration:'none' }}>
                    <span style={{ fontSize:18 }}>📄</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'#0f172a' }}>{p.filename}</div>
                      <div style={{ fontSize:11, color:'#94a3b8' }}>{p.podType} · {fmtDate(p.createdAt)}</div>
                    </div>
                    <span style={{ fontSize:11, color:'#3b82f6', fontWeight:600 }}>Download</span>
                  </a>
                ))}
                {load.documents.map(d => (
                  <div key={d.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid #f8fafc' }}>
                    <span style={{ fontSize:18 }}>📋</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'#0f172a' }}>{d.filename}</div>
                      <div style={{ fontSize:11, color:'#94a3b8' }}>{d.type} · {fmtDate(d.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Status History */}
          {load.auditLog.length > 0 && (
            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:'20px' }}>
              <div style={{ fontWeight:700, fontSize:14, color:'#0f172a', marginBottom:14 }}>Status History</div>
              {load.auditLog.map((a, i) => {
                const st = STATUS_STYLE[a.toValue||''] ?? { bg:'#f1f5f9', color:'#475569' };
                return (
                  <div key={i} style={{ display:'flex', gap:12, marginBottom:10 }}>
                    <div style={{ width:2, background:'#e2e8f0', flexShrink:0, marginTop:6, alignSelf:'stretch', borderRadius:1 }} />
                    <div>
                      <span style={{ padding:'2px 8px', borderRadius:9999, fontSize:11, fontWeight:700, background:st.bg, color:st.color }}>
                        {a.toValue?.replace(/_/g,' ')}
                      </span>
                      <div style={{ fontSize:11, color:'#94a3b8', marginTop:3 }}>{fmtTs(a.changedAt)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Status Update Modal */}
      {statusMode && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'grid', placeItems:'center' }} onClick={()=>setStatusMode(false)}>
          <div style={{ background:'#fff', borderRadius:16, padding:'28px', width:420, maxWidth:'90vw' }} onClick={e=>e.stopPropagation()}>
            <h3 style={{ margin:'0 0 18px', fontSize:18, fontWeight:800, color:'#0f172a' }}>Update Shipment Status</h3>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:5 }}>New Status</label>
              <select value={newStatus} onChange={e=>setNewStatus(e.target.value)}
                style={{ width:'100%', padding:'10px 12px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:14, outline:'none', background:'#fff', boxSizing:'border-box' }}>
                <option value="">Select status…</option>
                {nextStatuses.map(s => (
                  <option key={s} value={s}>{STATUS_LABELS[s] || s.replace(/_/g,' ')}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:5 }}>Note (optional)</label>
              <textarea value={statusNote} onChange={e=>setStatusNote(e.target.value)} placeholder="Add a note about this status update…" rows={3}
                style={{ width:'100%', padding:'10px 12px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, outline:'none', resize:'vertical', fontFamily:'inherit', boxSizing:'border-box' }} />
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={()=>setStatusMode(false)} style={{ padding:'9px 18px', background:'#f1f5f9', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', color:'#475569' }}>Cancel</button>
              <button onClick={handleStatusUpdate} disabled={!newStatus||statusSaving}
                style={{ padding:'9px 22px', background:'#f59e0b', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', color:'#fff', opacity:(!newStatus||statusSaving)?0.6:1 }}>
                {statusSaving ? 'Updating…' : 'Update Status'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POD Upload Modal */}
      {podMode && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'grid', placeItems:'center' }} onClick={()=>setPodMode(false)}>
          <div style={{ background:'#fff', borderRadius:16, padding:'28px', width:440, maxWidth:'90vw' }} onClick={e=>e.stopPropagation()}>
            <h3 style={{ margin:'0 0 18px', fontSize:18, fontWeight:800, color:'#0f172a' }}>Upload Document</h3>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:5 }}>Document Type</label>
              <select value={podType} onChange={e=>setPodType(e.target.value)}
                style={{ width:'100%', padding:'10px 12px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:14, outline:'none', background:'#fff', boxSizing:'border-box' }}>
                <option value="POD">Proof of Delivery (POD)</option>
                <option value="BOL">Bill of Lading (BOL)</option>
                <option value="RATE_CON">Rate Confirmation</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:5 }}>File</label>
              <div
                onClick={()=>fileRef.current?.click()}
                style={{ border:`2px dashed ${podFile?'#22c55e':'#e2e8f0'}`, borderRadius:10, padding:'24px', textAlign:'center', cursor:'pointer', background:podFile?'#f0fdf4':'#fafafa' }}>
                {podFile ? (
                  <div>
                    <div style={{ fontSize:22, marginBottom:4 }}>✅</div>
                    <div style={{ fontSize:13, fontWeight:600, color:'#15803d' }}>{podFile.name}</div>
                    <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{(podFile.size/1024).toFixed(0)} KB</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize:28, marginBottom:6 }}>📎</div>
                    <div style={{ fontSize:13, fontWeight:600, color:'#334155' }}>Click to select file</div>
                    <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>PDF, JPG, PNG up to 20 MB</div>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic" style={{ display:'none' }} onChange={e=>setPodFile(e.target.files?.[0]||null)} />
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:5 }}>Notes (optional)</label>
              <input value={podNotes} onChange={e=>setPodNotes(e.target.value)} placeholder="e.g. Signed by John at warehouse"
                style={{ width:'100%', padding:'10px 12px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box' }} />
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={()=>setPodMode(false)} style={{ padding:'9px 18px', background:'#f1f5f9', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', color:'#475569' }}>Cancel</button>
              <button onClick={handlePodUpload} disabled={!podFile||podSaving}
                style={{ padding:'9px 22px', background:'#0f172a', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', color:'#fff', opacity:(!podFile||podSaving)?0.6:1 }}>
                {podSaving ? 'Uploading…' : '📤 Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
