'use client';

import { useEffect, useState, useCallback } from 'react';
import Topbar from '@/components/layout/Topbar';
import SlideOver from '@/components/ui/SlideOver';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { toast } from '@/store/toast.store';
import { useBrandingStore } from '@/store/branding.store';
import api from '@/lib/api';

interface Customer {
  id: string; name: string; email: string | null; phone: string | null;
  address: string | null; city: string | null; state: string | null; zipCode: string | null;
  creditTerms: number; creditLimit: number | null; usedCredit: number; availableCredit: number | null;
  notes: string | null; isActive: boolean; createdAt: string;
  _count: { loads: number; quotes: number };
}

const EMPTY = { name:'', email:'', phone:'', address:'', city:'', state:'', zipCode:'', creditTerms:'30', creditLimit:'', notes:'' };

export default function CustomersPage() {
  const { branding } = useBrandingStore();
  const primary = branding.primaryColor;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const [inviteTarget, setInviteTarget] = useState<Customer | null>(null);
  const [inviteForm, setInviteForm] = useState({ firstName: '', lastName: '', email: '' });
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ emailSent: boolean; inviteUrl: string | null } | null>(null);
  const [inviteError, setInviteError] = useState('');

  // Quick invite (top-level — creates customer + sends invite in one step)
  const EMPTY_QUICK = { companyName:'', companyEmail:'', companyPhone:'', companyAddress:'', companyCity:'', companyState:'', companyZip:'', contactFirstName:'', contactLastName:'', contactEmail:'' };
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickForm, setQuickForm] = useState({ ...EMPTY_QUICK });
  const [quickInviting, setQuickInviting] = useState(false);
  const [quickResult, setQuickResult] = useState<{ emailSent: boolean; inviteUrl: string | null; customerName: string } | null>(null);
  const [quickError, setQuickError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const { data } = await api.get('/customers');
      setCustomers(data);
    } catch { toast.error('Failed to load customers'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function openCreate() { setEditing(null); setForm({ ...EMPTY }); setSlideOpen(true); }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({ name: c.name, email: c.email||'', phone: c.phone||'', address: c.address||'', city: c.city||'', state: c.state||'', zipCode: c.zipCode||'', creditTerms: String(c.creditTerms), creditLimit: c.creditLimit != null ? String(c.creditLimit) : '', notes: c.notes||'' });
    setSlideOpen(true);
  }

  async function save() {
    if (!form.name.trim()) { toast.error('Company name is required'); return; }
    setSaving(true);
    try {
      const payload = { ...form, creditTerms: parseInt(form.creditTerms) || 30 };
      if (editing) {
        await api.put(`/customers/${editing.id}`, payload);
        toast.success('Customer updated', form.name);
      } else {
        await api.post('/customers', payload);
        toast.success('Customer added', form.name);
      }
      setSlideOpen(false);
      loadData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error('Save failed', msg);
    } finally { setSaving(false); }
  }

  async function toggleActive(c: Customer) {
    try {
      await api.put(`/customers/${c.id}`, { isActive: !c.isActive });
      setCustomers(cs => cs.map(x => x.id === c.id ? { ...x, isActive: !c.isActive } : x));
      toast.success(c.isActive ? 'Customer deactivated' : 'Customer reactivated', c.name);
    } catch { toast.error('Failed to update status'); }
  }

  async function handleQuickInvite() {
    setQuickError('');
    if (!quickForm.companyName.trim()) { setQuickError('Company name is required'); return; }
    if (!quickForm.contactFirstName.trim() || !quickForm.contactEmail.trim()) { setQuickError('Contact first name and email are required'); return; }
    setQuickInviting(true);
    try {
      const { data } = await api.post('/customers/invite-new', {
        companyName: quickForm.companyName.trim(),
        companyEmail: quickForm.companyEmail.trim() || undefined,
        companyPhone: quickForm.companyPhone.trim() || undefined,
        companyAddress: quickForm.companyAddress.trim() || undefined,
        companyCity: quickForm.companyCity.trim() || undefined,
        companyState: quickForm.companyState.trim() || undefined,
        companyZip: quickForm.companyZip.trim() || undefined,
        contactFirstName: quickForm.contactFirstName.trim(),
        contactLastName: quickForm.contactLastName.trim() || undefined,
        contactEmail: quickForm.contactEmail.trim(),
      });
      setQuickResult(data);
      loadData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setQuickError(msg || 'Failed to send invite');
    } finally { setQuickInviting(false); }
  }

  async function handleShipperInvite() {
    if (!inviteTarget) return;
    setInviteError('');
    if (!inviteForm.email || !inviteForm.firstName) { setInviteError('First name and email are required'); return; }
    setInviting(true);
    try {
      const { data } = await api.post(`/customers/${inviteTarget.id}/invite`, inviteForm);
      setInviteResult(data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setInviteError(msg || 'Failed to send invite');
    } finally { setInviting(false); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/customers/${deleteTarget.id}`);
      toast.success('Customer deleted', deleteTarget.name);
      setDeleteTarget(null);
      loadData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error('Cannot delete', msg);
      setDeleteTarget(null);
    }
  }

  const filtered = customers.filter(c => {
    if (!showInactive && !c.isActive) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return c.name.toLowerCase().includes(s) || (c.email||'').toLowerCase().includes(s) || (c.city||'').toLowerCase().includes(s);
  });

  const active = customers.filter(c => c.isActive).length;
  const totalRevenue = customers.reduce((a, c) => a + c._count.loads, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc' }}>
      <Topbar title="Customers" />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Customers / Shippers</h1>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>{active} active · {customers.length} total · {totalRevenue} loads</p>
          </div>
          <div style={{ flex: 1 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b', cursor: 'pointer' }}>
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
            Show inactive
          </label>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers…"
            style={{ padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, width: 220, outline: 'none' }} />
          <button onClick={() => { setQuickOpen(true); setQuickForm({ ...EMPTY_QUICK }); setQuickResult(null); setQuickError(''); }}
            style={{ padding: '9px 18px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            ✉ Invite Shipper
          </button>
          <button onClick={openCreate} style={{ padding: '9px 18px', background: primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            + Add Customer
          </button>
        </div>

        {/* Stats */}
        <div style={{ padding: '12px 24px', background: '#fff', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 20, flexShrink: 0 }}>
          {[
            { label: 'Total Customers', value: customers.length, color: primary },
            { label: 'Active', value: active, color: '#15803d' },
            { label: 'Total Loads', value: totalRevenue, color: '#7c3aed' },
            { label: 'Total Quotes', value: customers.reduce((a,c)=>a+c._count.quotes,0), color: '#a16207' },
          ].map(s => (
            <div key={s.label} style={{ padding: '8px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 64, color: '#94a3b8' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No customers found</div>
              <button onClick={openCreate} style={{ padding: '10px 20px', background: primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Add Customer</button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Company','Contact','Location','Credit Terms','Credit Limit / Available','Loads','Quotes','Status','Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: c.isActive ? 1 : 0.55 }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{c.name}</div>
                      {c.email && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{c.email}</div>}
                    </td>
                    <td style={{ padding: '12px', color: '#64748b' }}>{c.phone || '—'}</td>
                    <td style={{ padding: '12px', color: '#64748b' }}>
                      {c.city && c.state ? `${c.city}, ${c.state}` : c.city || c.state || '—'}
                    </td>
                    <td style={{ padding: '12px', color: '#64748b' }}>{c.creditTerms} days</td>
                    <td style={{ padding: '12px', minWidth: 160 }}>
                      {c.creditLimit != null ? (() => {
                        const pct = c.availableCredit != null ? (c.availableCredit / c.creditLimit) * 100 : 100;
                        const avail = c.availableCredit ?? 0;
                        const blocked = avail <= 0;
                        const color = blocked ? '#dc2626' : pct < 20 ? '#d97706' : '#15803d';
                        return (
                          <div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>Limit: <strong style={{ color: '#0f172a' }}>${c.creditLimit.toLocaleString()}</strong></div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                              <div style={{ flex: 1, height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.3s' }} />
                              </div>
                            </div>
                            {blocked
                              ? <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginTop: 2 }}>CREDIT BLOCKED</div>
                              : <div style={{ fontSize: 11, fontWeight: 700, color, marginTop: 2 }}>${avail.toLocaleString()} available</div>
                            }
                          </div>
                        );
                      })() : <span style={{ color: '#cbd5e1', fontSize: 12 }}>No limit set</span>}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ fontWeight: 700, color: c._count.loads > 0 ? primary : '#94a3b8' }}>{c._count.loads}</span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ fontWeight: 700, color: c._count.quotes > 0 ? '#a16207' : '#94a3b8' }}>{c._count.quotes}</span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: c.isActive ? '#dcfce7' : '#f1f5f9', color: c.isActive ? '#15803d' : '#94a3b8' }}>
                        {c.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button onClick={() => openEdit(c)} style={{ padding: '5px 10px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#475569', fontWeight: 600 }}>✏ Edit</button>
                        <button onClick={() => { setInviteTarget(c); setInviteForm({ firstName: '', lastName: '', email: c.email || '' }); setInviteResult(null); setInviteError(''); }} style={{ padding: '5px 10px', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#1d4ed8', fontWeight: 600 }}>✉ Invite</button>
                        <button onClick={() => toggleActive(c)} style={{ padding: '5px 10px', background: c.isActive ? '#fef9c3' : '#dcfce7', border: `1px solid ${c.isActive ? '#fde047' : '#86efac'}`, borderRadius: 6, fontSize: 12, cursor: 'pointer', color: c.isActive ? '#a16207' : '#15803d', fontWeight: 600 }}>
                          {c.isActive ? '⏸ Deactivate' : '▶ Activate'}
                        </button>
                        {c._count.loads === 0 && c._count.quotes === 0 && (
                          <button onClick={() => setDeleteTarget(c)} style={{ padding: '5px 8px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#dc2626', fontWeight: 700 }}>✕</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* SlideOver */}
      <SlideOver
        open={slideOpen}
        title={editing ? `Edit — ${editing.name}` : 'Add Customer'}
        subtitle={editing ? `${editing._count.loads} loads · ${editing._count.quotes} quotes` : 'New customer account'}
        onClose={() => setSlideOpen(false)}
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setSlideOpen(false)} style={{ padding: '9px 20px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#475569' }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ padding: '9px 22px', background: primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : editing ? 'Update' : 'Add Customer'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {editing && editing.creditLimit != null && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: editing.availableCredit != null && editing.availableCredit <= 0 ? '#fee2e2' : editing.availableCredit != null && (editing.availableCredit / editing.creditLimit) < 0.2 ? '#fef3c7' : '#f0fdf4', border: `1px solid ${editing.availableCredit != null && editing.availableCredit <= 0 ? '#fca5a5' : editing.availableCredit != null && (editing.availableCredit / editing.creditLimit) < 0.2 ? '#fde68a' : '#bbf7d0'}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Credit Summary</div>
              <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
                <span>Limit: <strong>${editing.creditLimit.toLocaleString()}</strong></span>
                <span>Used: <strong style={{ color: '#dc2626' }}>${editing.usedCredit.toLocaleString()}</strong></span>
                <span>Available: <strong style={{ color: editing.availableCredit != null && editing.availableCredit <= 0 ? '#dc2626' : '#15803d' }}>${(editing.availableCredit ?? 0).toLocaleString()}</strong></span>
              </div>
            </div>
          )}
          <SF label="Company Name *"><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={CI} placeholder="Acme Corporation" /></SF>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <SF label="Email"><input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} style={CI} /></SF>
            <SF label="Phone"><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} style={CI} /></SF>
          </div>
          <SF label="Street Address"><input value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} style={CI} /></SF>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
            <SF label="City"><input value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))} style={CI} /></SF>
            <SF label="State"><input value={form.state} onChange={e=>setForm(f=>({...f,state:e.target.value}))} style={CI} maxLength={2} /></SF>
            <SF label="ZIP"><input value={form.zipCode} onChange={e=>setForm(f=>({...f,zipCode:e.target.value}))} style={CI} /></SF>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <SF label="Credit Terms (days)">
              <select value={form.creditTerms} onChange={e=>setForm(f=>({...f,creditTerms:e.target.value}))} style={CI}>
                {['15','21','30','45','60','90'].map(d=><option key={d} value={d}>{d} days</option>)}
              </select>
            </SF>
            <SF label="Credit Limit ($)">
              <input type="number" min="0" step="1000" value={form.creditLimit} onChange={e=>setForm(f=>({...f,creditLimit:e.target.value}))} style={CI} placeholder="e.g. 50000" />
            </SF>
          </div>
          <SF label="Notes"><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={{...CI,height:80,resize:'vertical'}} /></SF>
        </div>
      </SlideOver>

      {deleteTarget && (
        <ConfirmModal
          title={`Delete ${deleteTarget.name}?`}
          message={`Permanently delete this customer? This cannot be undone.`}
          confirmLabel="Delete Customer" danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* ── Quick Invite Shipper Modal (top-level: creates customer + sends invite) ── */}
      {quickOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '22px 28px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>✉ Invite a Shipper</h2>
                <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>Creates a customer account and sends a portal invite in one step</p>
              </div>
              <button onClick={() => setQuickOpen(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8', padding: 4 }}>✕</button>
            </div>

            {quickResult ? (
              <div style={{ padding: 28 }}>
                <div style={{ padding: '16px 20px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, marginBottom: 20 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#15803d' }}>✓ {quickResult.customerName} has been added</p>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#16a34a' }}>
                    {quickResult.emailSent ? 'Invite email sent successfully.' : 'Account created — share the invite link below (no SMTP configured):'}
                  </p>
                </div>
                {quickResult.inviteUrl && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase' }}>Invite Link</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input readOnly value={quickResult.inviteUrl} style={{ flex: 1, padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 11, fontFamily: 'monospace', background: '#f8fafc', color: '#334155' }} />
                      <button onClick={() => navigator.clipboard.writeText(quickResult!.inviteUrl!)} style={{ padding: '9px 14px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Copy</button>
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={() => { setQuickResult(null); setQuickForm({ ...EMPTY_QUICK }); }} style={{ padding: '10px 20px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#475569' }}>Invite Another</button>
                  <button onClick={() => { setQuickOpen(false); setQuickResult(null); }} style={{ padding: '10px 22px', background: primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Done</button>
                </div>
              </div>
            ) : (
              <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Company section */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12 }}>Company Details</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <SF label="Company Name *">
                        <input value={quickForm.companyName} onChange={e => setQuickForm(f => ({ ...f, companyName: e.target.value }))} style={CI} placeholder="ABC Freight Co." />
                      </SF>
                    </div>
                    <SF label="Company Email">
                      <input type="email" value={quickForm.companyEmail} onChange={e => setQuickForm(f => ({ ...f, companyEmail: e.target.value }))} style={CI} placeholder="info@abcfreight.com" />
                    </SF>
                    <SF label="Phone">
                      <input value={quickForm.companyPhone} onChange={e => setQuickForm(f => ({ ...f, companyPhone: e.target.value }))} style={CI} placeholder="(555) 000-0000" />
                    </SF>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <SF label="Address">
                        <input value={quickForm.companyAddress} onChange={e => setQuickForm(f => ({ ...f, companyAddress: e.target.value }))} style={CI} placeholder="123 Main St" />
                      </SF>
                    </div>
                    <SF label="City">
                      <input value={quickForm.companyCity} onChange={e => setQuickForm(f => ({ ...f, companyCity: e.target.value }))} style={CI} placeholder="Chicago" />
                    </SF>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <SF label="State">
                        <input value={quickForm.companyState} onChange={e => setQuickForm(f => ({ ...f, companyState: e.target.value }))} style={CI} placeholder="IL" maxLength={2} />
                      </SF>
                      <SF label="Zip Code">
                        <input value={quickForm.companyZip} onChange={e => setQuickForm(f => ({ ...f, companyZip: e.target.value }))} style={CI} placeholder="60601" />
                      </SF>
                    </div>
                  </div>
                </div>

                {/* Contact section */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12 }}>Portal Contact (who receives the invite)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <SF label="First Name *">
                      <input value={quickForm.contactFirstName} onChange={e => setQuickForm(f => ({ ...f, contactFirstName: e.target.value }))} style={CI} placeholder="Jane" />
                    </SF>
                    <SF label="Last Name">
                      <input value={quickForm.contactLastName} onChange={e => setQuickForm(f => ({ ...f, contactLastName: e.target.value }))} style={CI} placeholder="Smith" />
                    </SF>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <SF label="Login Email *">
                        <input type="email" value={quickForm.contactEmail} onChange={e => setQuickForm(f => ({ ...f, contactEmail: e.target.value }))} style={CI} placeholder="jane@abcfreight.com" />
                      </SF>
                      <p style={{ margin: '5px 0 0', fontSize: 11, color: '#94a3b8' }}>They'll receive a link to set their password and access the shipper portal.</p>
                    </div>
                  </div>
                </div>

                {quickError && <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#dc2626' }}>{quickError}</div>}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
                  <button onClick={() => setQuickOpen(false)} style={{ padding: '10px 20px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#475569' }}>Cancel</button>
                  <button onClick={handleQuickInvite} disabled={quickInviting} style={{ padding: '10px 24px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: quickInviting ? 'not-allowed' : 'pointer', opacity: quickInviting ? 0.7 : 1 }}>
                    {quickInviting ? 'Creating & Sending…' : '✉ Create & Send Invite'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shipper Invite Modal */}
      {inviteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Invite Shipper Portal Access</h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b' }}>Invite someone from <strong>{inviteTarget.name}</strong> to track their shipments online.</p>

            {inviteResult ? (
              <>
                <div style={{ padding: '14px 16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                  {inviteResult.emailSent ? `✓ Invitation email sent successfully.` : '✓ Account created. Share the link below (no SMTP configured):'}
                </div>
                {inviteResult.inviteUrl && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4, textTransform: 'uppercase' }}>Invite Link</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input readOnly value={inviteResult.inviteUrl} style={{ flex: 1, padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', color: '#334155', background: '#f8fafc' }} />
                      <button onClick={() => navigator.clipboard.writeText(inviteResult.inviteUrl!)} style={{ padding: '8px 14px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Copy</button>
                    </div>
                  </div>
                )}
                <button onClick={() => { setInviteTarget(null); setInviteResult(null); }} style={{ width: '100%', padding: '10px', background: primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Done</button>
              </>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <SF label="First Name *"><input value={inviteForm.firstName} onChange={e => setInviteForm(f => ({ ...f, firstName: e.target.value }))} style={CI} placeholder="Jane" /></SF>
                  <SF label="Last Name"><input value={inviteForm.lastName} onChange={e => setInviteForm(f => ({ ...f, lastName: e.target.value }))} style={CI} placeholder="Smith" /></SF>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <SF label="Email Address *"><input type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} style={CI} placeholder="jane@company.com" /></SF>
                </div>
                <p style={{ margin: '0 0 16px', fontSize: 12, color: '#94a3b8' }}>They'll receive a link to set their password and access the shipper portal for {inviteTarget.name}.</p>
                {inviteError && <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, marginBottom: 14, fontSize: 13, color: '#dc2626' }}>{inviteError}</div>}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={() => { setInviteTarget(null); setInviteError(''); }} style={{ padding: '9px 20px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#475569' }}>Cancel</button>
                  <button onClick={handleShipperInvite} disabled={inviting} style={{ padding: '9px 22px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: inviting ? 'not-allowed' : 'pointer', opacity: inviting ? 0.7 : 1 }}>
                    {inviting ? 'Sending…' : '✉ Send Invite'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SF({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={{ display:'block',fontSize:11,fontWeight:700,color:'#475569',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.4px' }}>{label}</label>{children}</div>;
}
const CI: React.CSSProperties = { width:'100%',padding:'8px 10px',border:'1px solid #e2e8f0',borderRadius:7,fontSize:13,outline:'none',boxSizing:'border-box',background:'#fff' };
