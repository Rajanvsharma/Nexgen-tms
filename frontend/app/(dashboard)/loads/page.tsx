'use client';

import { useEffect, useState, useCallback } from 'react';
import Topbar from '@/components/layout/Topbar';
import SlideOver from '@/components/ui/SlideOver';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { VoiceNegotiateModal } from '@/components/ui/VoiceNegotiateModal';
import { toast } from '@/store/toast.store';
import { useBrandingStore } from '@/store/branding.store';
import api from '@/lib/api';

interface Load {
  id: string; loadNumber: string; status: string;
  pickupCity: string; pickupState: string;
  deliveryCity: string; deliveryState: string;
  commodity: string | null; weight: number | null; equipment: string;
  pickupDate: string | null; deliveryDate: string | null;
  customerRate: number; carrierRate: number | null; margin: number | null;
  specialInstructions: string | null; driverName: string | null; driverPhone: string | null;
  isDuplicate: boolean;
  customer: { id: string; name: string };
  carrier: { id: string; name: string; mcNumber: string } | null;
  createdAt: string;
}
interface Customer { id: string; name: string; }
interface Carrier  { id: string; name: string; mcNumber: string; }

const STATUSES = [
  'CREATED','BOOKED','DISPATCHED','DRIVER_ON_ROUTE','LOADING',
  'ON_ROUTE','IN_TRANSIT','UNLOADING','DELIVERED','DELAYED','ON_HOLD',
  'TONU','DISPUTED','CLAIMED','INVOICING','INVOICED','PAYMENTS',
  'COLLECTION','RECEIVED','COMPLETED','CANCELLED',
];
const STATUS_LABEL: Record<string,string> = {
  CREATED:'Open', DRAFT:'Open', BOOKED:'Booked', DISPATCHED:'Dispatched',
  DRIVER_ON_ROUTE:'Driver On Route', LOADING:'Loading', ON_ROUTE:'On Route',
  IN_TRANSIT:'In Transit', UNLOADING:'Un Loading', DELIVERED:'Delivered',
  DELAYED:'Delayed', ON_HOLD:'On Hold', TONU:'Tonu', DISPUTED:'Disputed',
  CLAIMED:'Claimed', INVOICING:'Invoicing', INVOICED:'Invoiced',
  PAYMENTS:'Payments', COLLECTION:'Collection', RECEIVED:'Received',
  COMPLETED:'Completed', CANCELLED:'Cancelled',
};
const EQUIPMENT = ['Dry Van','Reefer','Flatbed','Step Deck','RGN','Power Only','Box Truck'];

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  CREATED:         { bg: '#f1f5f9', color: '#475569' },
  DRAFT:           { bg: '#f1f5f9', color: '#475569' },
  BOOKED:          { bg: '#dbeafe', color: '#1d4ed8' },
  DISPATCHED:      { bg: '#e0e7ff', color: '#4338ca' },
  DRIVER_ON_ROUTE: { bg: '#c7d2fe', color: '#3730a3' },
  LOADING:         { bg: '#fef3c7', color: '#b45309' },
  ON_ROUTE:        { bg: '#fef9c3', color: '#a16207' },
  IN_TRANSIT:      { bg: '#fde68a', color: '#92400e' },
  UNLOADING:       { bg: '#ffedd5', color: '#c2410c' },
  DELIVERED:       { bg: '#dcfce7', color: '#15803d' },
  DELAYED:         { bg: '#fee2e2', color: '#b91c1c' },
  ON_HOLD:         { bg: '#e2e8f0', color: '#334155' },
  TONU:            { bg: '#f3e8ff', color: '#7e22ce' },
  DISPUTED:        { bg: '#ffe4e6', color: '#be123c' },
  CLAIMED:         { bg: '#ffedd5', color: '#9a3412' },
  INVOICING:       { bg: '#ede9fe', color: '#6d28d9' },
  INVOICED:        { bg: '#ddd6fe', color: '#5b21b6' },
  PAYMENTS:        { bg: '#cffafe', color: '#0e7490' },
  COLLECTION:      { bg: '#fef9c3', color: '#713f12' },
  RECEIVED:        { bg: '#ccfbf1', color: '#0f766e' },
  COMPLETED:       { bg: '#d1fae5', color: '#065f46' },
  CANCELLED:       { bg: '#fee2e2', color: '#b91c1c' },
};

const EMPTY_FORM = {
  customerId:'', pickupCity:'', pickupState:'', deliveryCity:'', deliveryState:'',
  commodity:'', weight:'', equipment:'Dry Van', pickupDate:'', deliveryDate:'',
  customerRate:'', carrierRate:'', specialInstructions:'', driverName:'', driverPhone:'', carrierId:'', status:'CREATED',
};

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'; }
function fmtMoney(n: number | null) { return n != null ? `$${n.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}` : '—'; }

export default function LoadsPage() {
  const { branding } = useBrandingStore();
  const primary = branding.primaryColor;

  const [loads, setLoads] = useState<Load[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState<Load | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Load | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [voiceLoad, setVoiceLoad] = useState<Load | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [lRes, cRes, carRes] = await Promise.all([
        api.get('/loads'), api.get('/customers'), api.get('/carriers'),
      ]);
      setLoads(lRes.data); setCustomers(cRes.data); setCarriers(carRes.data);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setSlideOpen(true);
  }

  function openEdit(load: Load) {
    setEditing(load);
    setForm({
      customerId: load.customer?.id || '',
      pickupCity: load.pickupCity, pickupState: load.pickupState,
      deliveryCity: load.deliveryCity, deliveryState: load.deliveryState,
      commodity: load.commodity || '', weight: load.weight ? String(load.weight) : '',
      equipment: load.equipment,
      pickupDate: load.pickupDate ? load.pickupDate.slice(0,10) : '',
      deliveryDate: load.deliveryDate ? load.deliveryDate.slice(0,10) : '',
      customerRate: String(load.customerRate),
      carrierRate: load.carrierRate ? String(load.carrierRate) : '',
      specialInstructions: load.specialInstructions || '',
      driverName: load.driverName || '', driverPhone: load.driverPhone || '',
      carrierId: load.carrier?.id || '', status: load.status,
    });
    setSlideOpen(true);
  }

  async function save() {
    if (!form.customerId || !form.pickupCity || !form.pickupState || !form.deliveryCity || !form.deliveryState || !form.equipment || !form.customerRate) {
      toast.error('Missing required fields', 'Fill customer, route, equipment and customer rate.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/loads/${editing.id}`, form);
        toast.success('Load updated');
      } else {
        await api.post('/loads', form);
        toast.success('Load created');
      }
      setSlideOpen(false);
      loadData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error('Save failed', msg);
    } finally { setSaving(false); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/loads/${deleteTarget.id}`);
      toast.success('Load deleted', deleteTarget.loadNumber);
      setDeleteTarget(null);
      loadData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error('Delete failed', msg);
    } finally { setDeleting(false); }
  }

  async function updateStatus(id: string, status: string) {
    try {
      await api.put(`/loads/${id}`, { status });
      setLoads(ls => ls.map(l => l.id === id ? { ...l, status } : l));
      toast.success('Status updated', status);
    } catch { toast.error('Failed to update status'); }
  }

  const filtered = loads.filter(l => {
    if (statusFilter !== 'ALL' && l.status !== statusFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return l.loadNumber.toLowerCase().includes(s) || l.customer?.name.toLowerCase().includes(s) ||
      l.pickupCity.toLowerCase().includes(s) || l.deliveryCity.toLowerCase().includes(s) ||
      (l.carrier?.name || '').toLowerCase().includes(s);
  });

  const counts = STATUSES.reduce((acc, s) => ({ ...acc, [s]: loads.filter(l => l.status === s).length }), {} as Record<string,number>);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc' }}>
      <Topbar title="Loads" />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* ── Header bar ── */}
        <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Load Management</h1>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>{loads.length} total loads</p>
          </div>
          <div style={{ flex: 1 }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search loads, customers, carriers…"
            style={{ padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, width: 260, outline: 'none' }}
          />
          {statusFilter !== 'ALL' && (
            <button onClick={() => setStatusFilter('ALL')} style={{ padding: '7px 12px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, color: '#475569', cursor: 'pointer', fontWeight: 600 }}>
              ✕ Clear Filter
            </button>
          )}
          <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            + New Load
          </button>
        </div>

        {/* ── Status pills ── */}
        <div style={{ background: '#fff', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', padding: '8px 24px', scrollbarWidth: 'none' }}>
            {['ALL', ...STATUSES].map(s => {
              const st = STATUS_STYLE[s] || { bg: '#f1f5f9', color: '#475569' };
              const count = s === 'ALL' ? loads.length : counts[s] || 0;
              const active = statusFilter === s;
              return (
                <button key={s} onClick={() => setStatusFilter(s)} style={{
                  padding: '5px 13px', borderRadius: 6, border: `1.5px solid ${active ? primary : '#e2e8f0'}`,
                  background: active ? primary : '#fff',
                  color: active ? '#fff' : st.color,
                  fontSize: 12, fontWeight: active ? 700 : 600, cursor: 'pointer', whiteSpace: 'nowrap',
                  flexShrink: 0, transition: 'all 0.15s',
                }}>
                  {s === 'ALL' ? 'All' : STATUS_LABEL[s] || s}
                  {count > 0 && <span style={{ marginLeft: 5, opacity: active ? 0.85 : 0.6, fontSize: 11 }}>({count})</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Table ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48, color: '#94a3b8' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 64, color: '#94a3b8' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🚛</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No loads found</div>
              <div style={{ fontSize: 13, marginBottom: 20 }}>Create your first load to get started</div>
              <button onClick={openCreate} style={{ padding: '10px 20px', background: primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ New Load</button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Load #','Customer','Route','Equipment','Customer Rate','Carrier Rate','Margin','Pickup','Status','Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => {
                  const st = STATUS_STYLE[l.status] || STATUS_STYLE.CREATED;
                  return (
                    <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                      <td style={{ padding: '12px', fontWeight: 700, color: primary }}>
                        {l.loadNumber}
                        {l.isDuplicate && <span style={{ marginLeft: 6, fontSize: 10, background: '#fef9c3', color: '#a16207', border: '1px solid #fde047', borderRadius: 4, padding: '1px 5px' }}>DUP</span>}
                      </td>
                      <td style={{ padding: '12px', color: '#334155', fontWeight: 500 }}>{l.customer?.name}</td>
                      <td style={{ padding: '12px', color: '#64748b' }}>
                        <span style={{ fontWeight: 500 }}>{l.pickupCity}, {l.pickupState}</span>
                        <span style={{ color: '#cbd5e1', margin: '0 6px' }}>→</span>
                        <span style={{ fontWeight: 500 }}>{l.deliveryCity}, {l.deliveryState}</span>
                      </td>
                      <td style={{ padding: '12px', color: '#64748b' }}>{l.equipment}</td>
                      <td style={{ padding: '12px', fontWeight: 600, color: '#0f172a' }}>{fmtMoney(l.customerRate)}</td>
                      <td style={{ padding: '12px', color: '#64748b' }}>{fmtMoney(l.carrierRate)}</td>
                      <td style={{ padding: '12px' }}>
                        {l.margin != null ? (
                          <span style={{ fontWeight: 700, color: l.margin >= 15 ? '#15803d' : l.margin >= 8 ? '#a16207' : '#dc2626' }}>
                            {l.margin.toFixed(1)}%
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(l.pickupDate)}</td>
                      <td style={{ padding: '12px' }}>
                        <select
                          value={l.status}
                          onChange={e => updateStatus(l.id, e.target.value)}
                          style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${st.color}40`, background: st.bg, color: st.color, fontSize: 11, fontWeight: 700, cursor: 'pointer', outline: 'none', maxWidth: 140 }}
                        >
                          {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s] || s}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => openEdit(l)} title="Edit" style={{ padding: '5px 10px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#475569', fontWeight: 600 }}>✏ Edit</button>
                          <button onClick={() => setVoiceLoad(l)} title="AI Negotiate" style={{ padding: '5px 10px', background: '#ede9fe', border: '1px solid #ddd6fe', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#7c3aed', fontWeight: 600 }}>🤖 AI</button>
                          <button onClick={() => setDeleteTarget(l)} title="Delete" style={{ padding: '5px 8px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#dc2626', fontWeight: 700 }}>✕</button>
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

      {/* ── Create / Edit SlideOver ── */}
      <SlideOver
        open={slideOpen}
        title={editing ? `Edit ${editing.loadNumber}` : 'New Load'}
        subtitle={editing ? `${editing.customer?.name} · ${editing.pickupCity} → ${editing.deliveryCity}` : 'Fill in load details'}
        onClose={() => setSlideOpen(false)}
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setSlideOpen(false)} style={{ padding: '9px 20px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#475569' }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ padding: '9px 22px', background: primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : editing ? 'Update Load' : 'Create Load'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <FormSection title="Customer & Status">
            <Row2>
              <Field label="Customer *">
                <select value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))} style={sel}>
                  <option value="">Select customer…</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={sel}>
                  {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s] || s}</option>)}
                </select>
              </Field>
            </Row2>
          </FormSection>

          <FormSection title="Route">
            <Row2>
              <Field label="Pickup City *"><input value={form.pickupCity} onChange={e => setForm(f=>({...f,pickupCity:e.target.value}))} style={inp} placeholder="Chicago" /></Field>
              <Field label="Pickup State *"><input value={form.pickupState} onChange={e => setForm(f=>({...f,pickupState:e.target.value}))} style={inp} placeholder="IL" maxLength={2} /></Field>
            </Row2>
            <Row2>
              <Field label="Delivery City *"><input value={form.deliveryCity} onChange={e => setForm(f=>({...f,deliveryCity:e.target.value}))} style={inp} placeholder="Dallas" /></Field>
              <Field label="Delivery State *"><input value={form.deliveryState} onChange={e => setForm(f=>({...f,deliveryState:e.target.value}))} style={inp} placeholder="TX" maxLength={2} /></Field>
            </Row2>
          </FormSection>

          <FormSection title="Freight">
            <Row2>
              <Field label="Equipment *">
                <select value={form.equipment} onChange={e => setForm(f=>({...f,equipment:e.target.value}))} style={sel}>
                  {EQUIPMENT.map(e => <option key={e}>{e}</option>)}
                </select>
              </Field>
              <Field label="Commodity"><input value={form.commodity} onChange={e => setForm(f=>({...f,commodity:e.target.value}))} style={inp} placeholder="General freight" /></Field>
            </Row2>
            <Field label="Weight (lbs)"><input type="number" value={form.weight} onChange={e => setForm(f=>({...f,weight:e.target.value}))} style={inp} placeholder="42000" /></Field>
          </FormSection>

          <FormSection title="Rates">
            <Row2>
              <Field label="Customer Rate ($) *"><input type="number" value={form.customerRate} onChange={e => setForm(f=>({...f,customerRate:e.target.value}))} style={inp} placeholder="3500" /></Field>
              <Field label="Carrier Rate ($)"><input type="number" value={form.carrierRate} onChange={e => setForm(f=>({...f,carrierRate:e.target.value}))} style={inp} placeholder="2800" /></Field>
            </Row2>
            {form.customerRate && form.carrierRate && (
              <div style={{ padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, fontSize: 12, color: '#15803d', fontWeight: 600 }}>
                Margin: {((Number(form.customerRate) - Number(form.carrierRate)) / Number(form.customerRate) * 100).toFixed(1)}% = ${(Number(form.customerRate) - Number(form.carrierRate)).toLocaleString()}
              </div>
            )}
          </FormSection>

          <FormSection title="Dates">
            <Row2>
              <Field label="Pickup Date"><input type="date" value={form.pickupDate} onChange={e => setForm(f=>({...f,pickupDate:e.target.value}))} style={inp} /></Field>
              <Field label="Delivery Date"><input type="date" value={form.deliveryDate} onChange={e => setForm(f=>({...f,deliveryDate:e.target.value}))} style={inp} /></Field>
            </Row2>
          </FormSection>

          <FormSection title="Carrier & Driver">
            <Field label="Carrier">
              <select value={form.carrierId} onChange={e => setForm(f=>({...f,carrierId:e.target.value}))} style={sel}>
                <option value="">Not assigned</option>
                {carriers.map(c => <option key={c.id} value={c.id}>{c.name} — MC#{c.mcNumber}</option>)}
              </select>
            </Field>
            <Row2>
              <Field label="Driver Name"><input value={form.driverName} onChange={e => setForm(f=>({...f,driverName:e.target.value}))} style={inp} /></Field>
              <Field label="Driver Phone"><input value={form.driverPhone} onChange={e => setForm(f=>({...f,driverPhone:e.target.value}))} style={inp} /></Field>
            </Row2>
          </FormSection>

          <FormSection title="Instructions">
            <Field label="Special Instructions">
              <textarea value={form.specialInstructions} onChange={e => setForm(f=>({...f,specialInstructions:e.target.value}))} style={{ ...inp, height: 72, resize: 'vertical' }} />
            </Field>
          </FormSection>
        </div>
      </SlideOver>

      {/* ── Delete confirm ── */}
      {deleteTarget && (
        <ConfirmModal
          title={`Delete ${deleteTarget.loadNumber}?`}
          message={`This will permanently delete load ${deleteTarget.loadNumber} (${deleteTarget.customer?.name}). This cannot be undone.`}
          confirmLabel={deleting ? 'Deleting…' : 'Delete Load'}
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* ── AI Voice modal ── */}
      {voiceLoad && (
        <VoiceNegotiateModal
          load={voiceLoad}
          onClose={() => setVoiceLoad(null)}
          onDeal={async (rate) => {
            await api.put(`/loads/${voiceLoad.id}`, { carrierRate: rate });
            toast.success('Deal accepted!', `Carrier rate set to $${rate.toLocaleString()}`);
            loadData();
          }}
        />
      )}
    </div>
  );
}

// ── Shared form sub-components ────────────────────────────────────────────────
function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #f1f5f9' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}
function Row2({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</label>
      {children}
    </div>
  );
}
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const sel: React.CSSProperties = { ...inp, cursor: 'pointer', background: '#fff' };
