'use client';

import { useEffect, useState, useCallback } from 'react';
import Topbar from '@/components/layout/Topbar';
import SlideOver from '@/components/ui/SlideOver';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { toast } from '@/store/toast.store';
import { useBrandingStore } from '@/store/branding.store';
import api from '@/lib/api';

interface Carrier {
  id: string; name: string; mcNumber: string; dotNumber: string | null;
  email: string | null; phone: string | null; city: string | null; state: string | null;
  zipCode: string | null; equipmentTypes: string[]; contactPerson: string | null;
  insuranceExpiry: string | null; authorityExpiry: string | null;
  w9OnFile: boolean; status: string; notes: string | null;
  _count: { loads: number; lanes: number };
}

const EQUIPMENT_OPTIONS = ['Dry Van','Reefer','Flatbed','Step Deck','RGN','Power Only','Box Truck','Sprinter'];
const CARRIER_STATUSES = ['ACTIVE','INACTIVE','SUSPENDED','BLACKLISTED','DNC','IN_REVIEW'];
const ST_STYLE: Record<string,{bg:string;color:string}> = {
  ACTIVE:     { bg:'#dcfce7', color:'#15803d' },
  INACTIVE:   { bg:'#f1f5f9', color:'#64748b' },
  SUSPENDED:  { bg:'#fef9c3', color:'#a16207' },
  BLACKLISTED:{ bg:'#fee2e2', color:'#b91c1c' },
  DNC:        { bg:'#fce7f3', color:'#be185d' },
  IN_REVIEW:  { bg:'#dbeafe', color:'#1d4ed8' },
};

const EMPTY = { name:'', mcNumber:'', dotNumber:'', email:'', phone:'', contactPerson:'', city:'', state:'', zipCode:'', insuranceExpiry:'', authorityExpiry:'', w9OnFile:false, status:'ACTIVE', notes:'' };

function expColor(dateStr: string | null): string {
  if (!dateStr) return '#94a3b8';
  const days = Math.floor((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (days < 0) return '#dc2626';
  if (days < 30) return '#f59e0b';
  return '#16a34a';
}

function daysLabel(dateStr: string | null): string {
  if (!dateStr) return '—';
  const days = Math.floor((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (days < 0) return `Expired ${-days}d ago`;
  if (days === 0) return 'Expires today';
  if (days < 30) return `${days}d left`;
  return new Date(dateStr).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}

export default function CarriersPage() {
  const { branding } = useBrandingStore();
  const primary = branding.primaryColor;

  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [eqFilter, setEqFilter] = useState('ALL');

  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState<Carrier | null>(null);
  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY });
  const [equipment, setEquipment] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Carrier | null>(null);
  const [safetyTarget, setSafetyTarget] = useState<Carrier | null>(null);
  const [safetyData, setSafetyData] = useState<Record<string, unknown> | null>(null);
  const [safetyLoading, setSafetyLoading] = useState(false);

  async function runSafetyCheck(carrier: Carrier) {
    setSafetyTarget(carrier); setSafetyData(null); setSafetyLoading(true);
    try {
      const { data } = await api.get(`/carriers/${carrier.id}/safety-check`);
      setSafetyData(data);
    } catch { setSafetyData({ error: 'Safety check failed' }); }
    finally { setSafetyLoading(false); }
  }

  const loadData = useCallback(async () => {
    try {
      const { data } = await api.get('/carriers');
      setCarriers(data);
    } catch { toast.error('Failed to load carriers'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function openCreate() { setEditing(null); setForm({ ...EMPTY }); setEquipment([]); setSlideOpen(true); }

  function openEdit(c: Carrier) {
    setEditing(c);
    setEquipment(c.equipmentTypes || []);
    setForm({
      name: c.name, mcNumber: c.mcNumber, dotNumber: c.dotNumber||'',
      email: c.email||'', phone: c.phone||'', contactPerson: c.contactPerson||'',
      city: c.city||'', state: c.state||'', zipCode: c.zipCode||'',
      insuranceExpiry: c.insuranceExpiry ? c.insuranceExpiry.slice(0,10) : '',
      authorityExpiry: c.authorityExpiry ? c.authorityExpiry.slice(0,10) : '',
      w9OnFile: c.w9OnFile, status: c.status, notes: c.notes||'',
    });
    setSlideOpen(true);
  }

  async function save() {
    if (!form.name.trim() || !form.mcNumber.trim()) { toast.error('Name and MC# are required'); return; }
    setSaving(true);
    try {
      const payload = { ...form, equipmentTypes: equipment };
      if (editing) {
        await api.put(`/carriers/${editing.id}`, payload);
        toast.success('Carrier updated', form.name);
      } else {
        await api.post('/carriers', payload);
        toast.success('Carrier added', form.name);
      }
      setSlideOpen(false);
      loadData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error('Save failed', msg);
    } finally { setSaving(false); }
  }

  async function quickStatus(id: string, status: string) {
    try {
      await api.put(`/carriers/${id}`, { status });
      setCarriers(cs => cs.map(c => c.id === id ? { ...c, status } : c));
      toast.success('Status updated', status);
    } catch { toast.error('Failed to update status'); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/carriers/${deleteTarget.id}`);
      toast.success('Carrier deleted', deleteTarget.name);
      setDeleteTarget(null);
      loadData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error('Cannot delete', msg);
      setDeleteTarget(null);
    }
  }

  function toggleEquipment(eq: string) {
    setEquipment(prev => prev.includes(eq) ? prev.filter(e => e !== eq) : [...prev, eq]);
  }

  const filtered = carriers.filter(c => {
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (eqFilter !== 'ALL' && !c.equipmentTypes.includes(eqFilter)) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return c.name.toLowerCase().includes(s) || c.mcNumber.includes(s) || (c.email||'').toLowerCase().includes(s) || (c.city||'').toLowerCase().includes(s);
  });

  const counts = CARRIER_STATUSES.reduce((a, s) => ({ ...a, [s]: carriers.filter(c => c.status === s).length }), {} as Record<string,number>);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc' }}>
      <Topbar title="Carrier Network" />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Carrier Network</h1>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>{carriers.filter(c=>c.status==='ACTIVE').length} active · {carriers.length} total carriers</p>
          </div>
          <div style={{ flex: 1 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search carriers, MC#, email…"
            style={{ padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, width: 240, outline: 'none' }} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, background: '#fff' }}>
            <option value="ALL">All Statuses</option>
            {CARRIER_STATUSES.map(s => <option key={s} value={s}>{s} ({counts[s]||0})</option>)}
          </select>
          <select value={eqFilter} onChange={e => setEqFilter(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, background: '#fff' }}>
            <option value="ALL">All Equipment</option>
            {EQUIPMENT_OPTIONS.map(e => <option key={e}>{e}</option>)}
          </select>
          <button onClick={openCreate} style={{ padding: '9px 18px', background: primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            + Add Carrier
          </button>
        </div>

        {/* Status pills */}
        <div style={{ padding: '10px 24px', background: '#fff', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0 }}>
          {['ALL', ...CARRIER_STATUSES].map(s => {
            const st = ST_STYLE[s] || { bg: '#f1f5f9', color: '#475569' };
            const count = s === 'ALL' ? carriers.length : counts[s] || 0;
            const active = statusFilter === s;
            return (
              <button key={s} onClick={() => setStatusFilter(s)} style={{
                padding: '5px 12px', borderRadius: 20, border: `1px solid ${active ? primary : '#e2e8f0'}`,
                background: active ? primary : (s === 'ALL' ? '#fff' : st.bg),
                color: active ? '#fff' : (s === 'ALL' ? '#475569' : st.color),
                fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
                {s === 'ALL' ? 'All' : s} <span style={{ opacity: 0.75 }}>({count})</span>
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 64, color: '#94a3b8' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🚚</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No carriers found</div>
              <button onClick={openCreate} style={{ padding: '10px 20px', background: primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Add Carrier</button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Carrier','MC# / DOT','Contact','Equipment','Insurance','Authority','W-9','Loads','Status','Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const st = ST_STYLE[c.status] || ST_STYLE.INACTIVE;
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{c.name}</div>
                        {c.contactPerson && <div style={{ fontSize: 11, color: '#64748b' }}>{c.contactPerson}</div>}
                        {c.city && <div style={{ fontSize: 11, color: '#94a3b8' }}>{c.city}, {c.state}</div>}
                      </td>
                      <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: 12 }}>
                        <div style={{ color: primary, fontWeight: 700 }}>MC#{c.mcNumber}</div>
                        {c.dotNumber && <div style={{ color: '#94a3b8' }}>DOT#{c.dotNumber}</div>}
                      </td>
                      <td style={{ padding: '12px', color: '#64748b' }}>
                        {c.email && <div style={{ fontSize: 11 }}>{c.email}</div>}
                        {c.phone && <div style={{ fontSize: 11 }}>{c.phone}</div>}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {(c.equipmentTypes || []).slice(0,3).map(eq => (
                            <span key={eq} style={{ fontSize: 10, background: '#f1f5f9', color: '#64748b', borderRadius: 4, padding: '1px 5px' }}>{eq}</span>
                          ))}
                          {c.equipmentTypes.length > 3 && <span style={{ fontSize: 10, color: '#94a3b8' }}>+{c.equipmentTypes.length-3}</span>}
                        </div>
                      </td>
                      <td style={{ padding: '12px', fontSize: 11, color: expColor(c.insuranceExpiry), fontWeight: 600 }}>{daysLabel(c.insuranceExpiry)}</td>
                      <td style={{ padding: '12px', fontSize: 11, color: expColor(c.authorityExpiry), fontWeight: 600 }}>{daysLabel(c.authorityExpiry)}</td>
                      <td style={{ padding: '12px', textAlign: 'center', fontSize: 16 }}>{c.w9OnFile ? '✅' : '❌'}</td>
                      <td style={{ padding: '12px', fontWeight: 700, color: primary }}>{c._count.loads}</td>
                      <td style={{ padding: '12px' }}>
                        <select value={c.status} onChange={e => quickStatus(c.id, e.target.value)}
                          style={{ padding: '3px 8px', borderRadius: 20, border: 'none', background: st.bg, color: st.color, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          {CARRIER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => openEdit(c)} style={{ padding: '5px 10px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#475569', fontWeight: 600 }}>✏ Edit</button>
                          <button onClick={() => runSafetyCheck(c)} style={{ padding: '5px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#1d4ed8', fontWeight: 600 }}>🛡 FMCSA</button>
                          {c._count.loads === 0 && (
                            <button onClick={() => setDeleteTarget(c)} style={{ padding: '5px 8px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#dc2626', fontWeight: 700 }}>✕</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* SlideOver */}
      <SlideOver
        open={slideOpen}
        title={editing ? `Edit — ${editing.name}` : 'Add Carrier'}
        subtitle={editing ? `MC#${editing.mcNumber} · ${editing._count.loads} loads` : 'New carrier account'}
        onClose={() => setSlideOpen(false)}
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setSlideOpen(false)} style={{ padding: '9px 20px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#475569' }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ padding: '9px 22px', background: primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : editing ? 'Update Carrier' : 'Add Carrier'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <CF label="Company Name *"><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={CI} placeholder="ABC Trucking LLC" /></CF>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <CF label="MC Number *"><input value={form.mcNumber} onChange={e=>setForm(f=>({...f,mcNumber:e.target.value}))} style={CI} placeholder="123456" /></CF>
            <CF label="DOT Number"><input value={form.dotNumber} onChange={e=>setForm(f=>({...f,dotNumber:e.target.value}))} style={CI} /></CF>
          </div>
          <CF label="Contact Person"><input value={form.contactPerson} onChange={e=>setForm(f=>({...f,contactPerson:e.target.value}))} style={CI} /></CF>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <CF label="Email"><input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} style={CI} /></CF>
            <CF label="Phone"><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} style={CI} /></CF>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
            <CF label="City"><input value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))} style={CI} /></CF>
            <CF label="State"><input value={form.state} onChange={e=>setForm(f=>({...f,state:e.target.value}))} style={CI} maxLength={2} /></CF>
            <CF label="ZIP"><input value={form.zipCode} onChange={e=>setForm(f=>({...f,zipCode:e.target.value}))} style={CI} /></CF>
          </div>
          <CF label="Equipment Types">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {EQUIPMENT_OPTIONS.map(eq => (
                <button key={eq} type="button" onClick={() => toggleEquipment(eq)} style={{
                  padding: '5px 10px', borderRadius: 6, border: `1px solid ${equipment.includes(eq) ? primary : '#e2e8f0'}`,
                  background: equipment.includes(eq) ? `${primary}18` : '#f8fafc',
                  color: equipment.includes(eq) ? primary : '#64748b', fontSize: 12, cursor: 'pointer', fontWeight: 600,
                }}>
                  {eq}
                </button>
              ))}
            </div>
          </CF>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <CF label="Insurance Expiry"><input type="date" value={form.insuranceExpiry} onChange={e=>setForm(f=>({...f,insuranceExpiry:e.target.value}))} style={CI} /></CF>
            <CF label="Authority Expiry"><input type="date" value={form.authorityExpiry} onChange={e=>setForm(f=>({...f,authorityExpiry:e.target.value}))} style={CI} /></CF>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <CF label="Status">
              <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={CI}>
                {CARRIER_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </CF>
            <CF label="W-9 on File">
              <div style={{ paddingTop: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={form.w9OnFile} onChange={e=>setForm(f=>({...f,w9OnFile:e.target.checked}))} />
                  W-9 received
                </label>
              </div>
            </CF>
          </div>
          <CF label="Notes"><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={{...CI,height:72,resize:'vertical'}} /></CF>
        </div>
      </SlideOver>

      {deleteTarget && (
        <ConfirmModal
          title={`Delete ${deleteTarget.name}?`}
          message={`Permanently delete MC#${deleteTarget.mcNumber}? This cannot be undone. Consider using BLACKLISTED or INACTIVE status instead.`}
          confirmLabel="Delete Carrier" danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* FMCSA Safety Check Modal */}
      {safetyTarget && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center' }} onClick={() => setSafetyTarget(null)}>
          <div style={{ background:'#fff',borderRadius:14,padding:28,width:520,maxHeight:'80vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
              <h3 style={{ fontWeight:700,fontSize:16,color:'#0f172a' }}>🛡 FMCSA Safety Check — {safetyTarget.name}</h3>
              <button onClick={() => setSafetyTarget(null)} style={{ background:'none',border:'none',fontSize:18,cursor:'pointer',color:'#94a3b8' }}>✕</button>
            </div>

            {safetyLoading && <p style={{ color:'#94a3b8',fontSize:13,textAlign:'center',padding:24 }}>Checking FMCSA records…</p>}

            {!safetyLoading && safetyData && (
              (safetyData as { error?: string }).error ? (
                <p style={{ color:'#dc2626',fontSize:13 }}>{(safetyData as { error: string }).error}</p>
              ) : (safetyData as { simulated?: boolean }).simulated ? (
                <div>
                  <p style={{ color:'#92400e',background:'#fef3c7',padding:'10px 14px',borderRadius:8,fontSize:13,marginBottom:12 }}>
                    {(safetyData as { message?: string }).message}
                  </p>
                  {(safetyData as { manualCheckUrl?: string }).manualCheckUrl && (
                    <a href={(safetyData as { manualCheckUrl: string }).manualCheckUrl} target="_blank" rel="noopener noreferrer"
                      style={{ color:'#1d4ed8',fontSize:13,textDecoration:'underline' }}>
                      Check on FMCSA SAFER Web →
                    </a>
                  )}
                </div>
              ) : (
                <div style={{ fontSize:13 }}>
                  {/* Risk Banner */}
                  {(safetyData as { riskLevel?: string }).riskLevel && (
                    <div style={{
                      padding:'10px 14px',borderRadius:8,marginBottom:16,fontWeight:700,fontSize:14,
                      background: (safetyData as { riskLevel: string }).riskLevel === 'LOW' ? '#dcfce7' : (safetyData as { riskLevel: string }).riskLevel === 'MEDIUM' ? '#fef9c3' : '#fee2e2',
                      color: (safetyData as { riskLevel: string }).riskLevel === 'LOW' ? '#15803d' : (safetyData as { riskLevel: string }).riskLevel === 'MEDIUM' ? '#92400e' : '#b91c1c',
                    }}>
                      Risk Level: {(safetyData as { riskLevel: string }).riskLevel}
                      {(safetyData as { autoFlagged?: boolean }).autoFlagged && ' — Carrier auto-flagged for review'}
                    </div>
                  )}

                  {/* Flags */}
                  {Array.isArray((safetyData as { flags?: string[] }).flags) && (safetyData as { flags: string[] }).flags.length > 0 && (
                    <div style={{ marginBottom:16 }}>
                      <p style={{ fontWeight:600,marginBottom:6,color:'#dc2626' }}>⚠ Flags:</p>
                      {(safetyData as { flags: string[] }).flags.map((f: string, i: number) => (
                        <div key={i} style={{ background:'#fee2e2',color:'#b91c1c',padding:'4px 10px',borderRadius:6,fontSize:12,marginBottom:4 }}>{f}</div>
                      ))}
                    </div>
                  )}

                  {/* Details Grid */}
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
                    {[
                      ['Legal Name', (safetyData as Record<string,unknown>).legalName],
                      ['Safety Rating', (safetyData as Record<string,unknown>).safetyRating],
                      ['Operating Status', (safetyData as Record<string,unknown>).operatingStatus],
                      ['Insurance', (safetyData as Record<string,unknown>).insuranceStatus],
                      ['Total Drivers', (safetyData as Record<string,unknown>).totalDrivers],
                      ['Power Units', (safetyData as Record<string,unknown>).totalPowerUnits],
                      ['Total Crashes', (safetyData as Record<string,unknown>).crashTotal],
                      ['Fatal Crashes', (safetyData as Record<string,unknown>).fatalCrash],
                      ['OOS Driver Insp', (safetyData as Record<string,unknown>).driverOosInsp],
                      ['OOS Vehicle Insp', (safetyData as Record<string,unknown>).vehicleOosInsp],
                    ].map(([label, val]) => val != null && (
                      <div key={String(label)} style={{ background:'#f8fafc',borderRadius:6,padding:'8px 10px' }}>
                        <p style={{ fontSize:10,color:'#94a3b8',fontWeight:600,textTransform:'uppercase',marginBottom:2 }}>{String(label)}</p>
                        <p style={{ fontSize:13,fontWeight:600,color:'#0f172a' }}>{String(val)}</p>
                      </div>
                    ))}
                  </div>

                  <p style={{ fontSize:11,color:'#94a3b8',marginTop:12 }}>Checked: {new Date((safetyData as { checkedAt?: string }).checkedAt || '').toLocaleString()}</p>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CF({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={{ display:'block',fontSize:11,fontWeight:700,color:'#475569',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.4px' }}>{label}</label>{children}</div>;
}
const CI: React.CSSProperties = { width:'100%',padding:'8px 10px',border:'1px solid #e2e8f0',borderRadius:7,fontSize:13,outline:'none',boxSizing:'border-box',background:'#fff' };
