'use client';

import { useEffect, useState, useCallback } from 'react';
import Topbar from '@/components/layout/Topbar';
import SlideOver from '@/components/ui/SlideOver';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { toast } from '@/store/toast.store';
import { useBrandingStore } from '@/store/branding.store';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';

interface Quote {
  id: string; quoteNumber: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONVERTED';
  pickupCity: string; pickupState: string;
  deliveryCity: string; deliveryState: string;
  commodity: string | null; weight: number | null; equipment: string;
  pickupDate: string | null; deliveryDate: string | null;
  rate: number; specialInstructions: string | null; source: string | null;
  customer: { id: string; name: string };
  createdBy: { firstName: string; lastName: string };
  createdAt: string;
}
interface Customer { id: string; name: string; }

const STATUSES = ['PENDING','APPROVED','REJECTED','CONVERTED'];
const EQUIPMENT = ['Dry Van','Reefer','Flatbed','Step Deck','RGN','Power Only','Box Truck'];

const ST_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING:   { bg: '#fef9c3', color: '#a16207' },
  APPROVED:  { bg: '#dcfce7', color: '#15803d' },
  REJECTED:  { bg: '#fee2e2', color: '#b91c1c' },
  CONVERTED: { bg: '#dbeafe', color: '#1d4ed8' },
};

const EMPTY = {
  customerId:'', pickupCity:'', pickupState:'', deliveryCity:'', deliveryState:'',
  commodity:'', weight:'', equipment:'Dry Van', pickupDate:'', deliveryDate:'',
  rate:'', specialInstructions:'', source:'Manual',
};

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'; }

export default function QuotesPage() {
  const { branding } = useBrandingStore();
  const { user } = useAuthStore();
  const primary = branding.primaryColor;

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Quote | null>(null);
  const [converting, setConverting] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [qRes, cRes] = await Promise.all([api.get('/quotes'), api.get('/customers')]);
      setQuotes(qRes.data); setCustomers(cRes.data);
    } catch { toast.error('Failed to load quotes'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function openCreate() { setEditing(null); setForm({ ...EMPTY }); setSlideOpen(true); }

  function openEdit(q: Quote) {
    setEditing(q);
    setForm({
      customerId: q.customer?.id || '',
      pickupCity: q.pickupCity, pickupState: q.pickupState,
      deliveryCity: q.deliveryCity, deliveryState: q.deliveryState,
      commodity: q.commodity || '', weight: q.weight ? String(q.weight) : '',
      equipment: q.equipment,
      pickupDate: q.pickupDate ? q.pickupDate.slice(0,10) : '',
      deliveryDate: q.deliveryDate ? q.deliveryDate.slice(0,10) : '',
      rate: String(q.rate),
      specialInstructions: q.specialInstructions || '',
      source: q.source || 'Manual',
    });
    setSlideOpen(true);
  }

  async function save() {
    if (!form.customerId || !form.pickupCity || !form.pickupState || !form.deliveryCity || !form.deliveryState || !form.equipment || !form.rate) {
      toast.error('Missing required fields'); return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/quotes/${editing.id}`, form);
        toast.success('Quote updated');
      } else {
        await api.post('/quotes', form);
        toast.success('Quote created');
      }
      setSlideOpen(false);
      loadData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error('Save failed', msg);
    } finally { setSaving(false); }
  }

  async function updateStatus(id: string, status: string) {
    try {
      await api.patch(`/quotes/${id}/status`, { status });
      setQuotes(qs => qs.map(q => q.id === id ? { ...q, status: status as Quote['status'] } : q));
      toast.success('Status updated');
    } catch { toast.error('Failed to update status'); }
  }

  async function convertToLoad(q: Quote) {
    setConverting(q.id);
    try {
      await api.post(`/quotes/${q.id}/convert`);
      toast.success('Converted to load!', q.quoteNumber);
      loadData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error('Conversion failed', msg);
    } finally { setConverting(null); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/quotes/${deleteTarget.id}`);
      toast.success('Quote deleted', deleteTarget.quoteNumber);
      setDeleteTarget(null);
      loadData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error('Delete failed', msg);
    }
  }

  const counts = STATUSES.reduce((a, s) => ({ ...a, [s]: quotes.filter(q => q.status === s).length }), {} as Record<string,number>);
  const filtered = quotes.filter(q => {
    if (statusFilter !== 'ALL' && q.status !== statusFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return q.quoteNumber.toLowerCase().includes(s) || q.customer?.name.toLowerCase().includes(s) ||
      q.pickupCity.toLowerCase().includes(s) || q.deliveryCity.toLowerCase().includes(s);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc' }}>
      <Topbar title="CRM / Quotes" />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Quotation Management</h1>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>{quotes.length} total quotes</p>
          </div>
          <div style={{ flex: 1 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search quotes, customers…"
            style={{ padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, width: 240, outline: 'none' }} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, background: '#fff' }}>
            <option value="ALL">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s} ({counts[s]||0})</option>)}
          </select>
          <button onClick={openCreate} style={{ padding: '9px 18px', background: primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            + New Quote
          </button>
        </div>

        {/* Status pills */}
        <div style={{ padding: '10px 24px', background: '#fff', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0 }}>
          {['ALL', ...STATUSES].map(s => {
            const st = ST_STYLE[s] || { bg: '#f1f5f9', color: '#475569' };
            const count = s === 'ALL' ? quotes.length : counts[s] || 0;
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
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No quotes found</div>
              <button onClick={openCreate} style={{ padding: '10px 20px', background: primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ New Quote</button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Quote #','Customer','Route','Equipment','Rate','Pickup','Source','Status','Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(q => {
                  const st = ST_STYLE[q.status];
                  return (
                    <tr key={q.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                      <td style={{ padding: '12px', fontWeight: 700, color: primary }}>{q.quoteNumber}</td>
                      <td style={{ padding: '12px', fontWeight: 500, color: '#334155' }}>{q.customer?.name}</td>
                      <td style={{ padding: '12px', color: '#64748b' }}>
                        <span style={{ fontWeight: 500 }}>{q.pickupCity}, {q.pickupState}</span>
                        <span style={{ color: '#cbd5e1', margin: '0 5px' }}>→</span>
                        <span style={{ fontWeight: 500 }}>{q.deliveryCity}, {q.deliveryState}</span>
                      </td>
                      <td style={{ padding: '12px', color: '#64748b' }}>{q.equipment}</td>
                      <td style={{ padding: '12px', fontWeight: 700, color: '#0f172a' }}>${q.rate.toLocaleString()}</td>
                      <td style={{ padding: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(q.pickupDate)}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ fontSize: 11, background: '#f1f5f9', color: '#64748b', borderRadius: 4, padding: '2px 8px' }}>{q.source || 'Manual'}</span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        {q.status === 'CONVERTED' ? (
                          <span style={{ fontSize: 11, fontWeight: 700, background: st.bg, color: st.color, borderRadius: 20, padding: '3px 10px' }}>CONVERTED</span>
                        ) : (
                          <select value={q.status} onChange={e => updateStatus(q.id, e.target.value)}
                            style={{ padding: '3px 8px', borderRadius: 20, border: 'none', background: st.bg, color: st.color, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                            {['PENDING','APPROVED','REJECTED'].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        )}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {(user?.role === 'ADMIN' || user?.role === 'DISPATCHER') && q.status !== 'CONVERTED' && (
                            <button onClick={() => openEdit(q)} style={{ padding: '5px 10px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#475569', fontWeight: 600 }}>✏ Edit</button>
                          )}
                          {q.status === 'APPROVED' && (
                            <button onClick={() => convertToLoad(q)} disabled={converting === q.id}
                              style={{ padding: '5px 10px', background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#1d4ed8', fontWeight: 600, opacity: converting === q.id ? 0.6 : 1 }}>
                              {converting === q.id ? '…' : '→ Load'}
                            </button>
                          )}
                          {q.status !== 'CONVERTED' && (
                            <button onClick={() => setDeleteTarget(q)} style={{ padding: '5px 8px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#dc2626', fontWeight: 700 }}>✕</button>
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

      {/* Edit/Create SlideOver */}
      <SlideOver
        open={slideOpen}
        title={editing ? `Edit ${editing.quoteNumber}` : 'New Quote'}
        subtitle={editing ? `${editing.customer?.name}` : 'Create a new quotation'}
        onClose={() => setSlideOpen(false)}
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setSlideOpen(false)} style={{ padding: '9px 20px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#475569' }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ padding: '9px 22px', background: primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : editing ? 'Update Quote' : 'Create Quote'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Sec title="Customer">
            <FField label="Customer *">
              <select value={form.customerId} onChange={e => setForm(f=>({...f,customerId:e.target.value}))} style={sl}>
                <option value="">Select customer…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FField>
          </Sec>
          <Sec title="Route">
            <G2><FField label="Pickup City *"><input value={form.pickupCity} onChange={e=>setForm(f=>({...f,pickupCity:e.target.value}))} style={ip} placeholder="Chicago" /></FField>
            <FField label="State *"><input value={form.pickupState} onChange={e=>setForm(f=>({...f,pickupState:e.target.value}))} style={ip} placeholder="IL" maxLength={2} /></FField></G2>
            <G2><FField label="Delivery City *"><input value={form.deliveryCity} onChange={e=>setForm(f=>({...f,deliveryCity:e.target.value}))} style={ip} placeholder="Dallas" /></FField>
            <FField label="State *"><input value={form.deliveryState} onChange={e=>setForm(f=>({...f,deliveryState:e.target.value}))} style={ip} placeholder="TX" maxLength={2} /></FField></G2>
          </Sec>
          <Sec title="Freight">
            <G2>
              <FField label="Equipment *"><select value={form.equipment} onChange={e=>setForm(f=>({...f,equipment:e.target.value}))} style={sl}>{EQUIPMENT.map(e=><option key={e}>{e}</option>)}</select></FField>
              <FField label="Commodity"><input value={form.commodity} onChange={e=>setForm(f=>({...f,commodity:e.target.value}))} style={ip} /></FField>
            </G2>
            <G2>
              <FField label="Weight (lbs)"><input type="number" value={form.weight} onChange={e=>setForm(f=>({...f,weight:e.target.value}))} style={ip} /></FField>
              <FField label="Rate ($) *"><input type="number" value={form.rate} onChange={e=>setForm(f=>({...f,rate:e.target.value}))} style={ip} /></FField>
            </G2>
          </Sec>
          <Sec title="Dates">
            <G2>
              <FField label="Pickup Date"><input type="date" value={form.pickupDate} onChange={e=>setForm(f=>({...f,pickupDate:e.target.value}))} style={ip} /></FField>
              <FField label="Delivery Date"><input type="date" value={form.deliveryDate} onChange={e=>setForm(f=>({...f,deliveryDate:e.target.value}))} style={ip} /></FField>
            </G2>
          </Sec>
          <Sec title="Details">
            <FField label="Source"><select value={form.source} onChange={e=>setForm(f=>({...f,source:e.target.value}))} style={sl}>
              {['Manual','Email','Phone','Web','Portal'].map(s=><option key={s}>{s}</option>)}
            </select></FField>
            <FField label="Special Instructions"><textarea value={form.specialInstructions} onChange={e=>setForm(f=>({...f,specialInstructions:e.target.value}))} style={{...ip,height:64,resize:'vertical'}} /></FField>
          </Sec>
        </div>
      </SlideOver>

      {deleteTarget && (
        <ConfirmModal
          title={`Delete ${deleteTarget.quoteNumber}?`}
          message={`Permanently delete this quote from ${deleteTarget.customer?.name}? This cannot be undone.`}
          confirmLabel="Delete Quote" danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #f1f5f9' }}>{title}</div><div style={{ display:'flex',flexDirection:'column',gap:10 }}>{children}</div></div>;
}
function G2({ children }: { children: React.ReactNode }) { return <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>{children}</div>; }
function FField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={{ display:'block',fontSize:11,fontWeight:700,color:'#475569',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.4px' }}>{label}</label>{children}</div>;
}
const ip: React.CSSProperties = { width:'100%',padding:'8px 10px',border:'1px solid #e2e8f0',borderRadius:7,fontSize:13,outline:'none',boxSizing:'border-box' };
const sl: React.CSSProperties = { ...ip,cursor:'pointer',background:'#fff' };
