'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Topbar from '@/components/layout/Topbar';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailLog {
  id: string;
  subject: string;
  fromEmail: string;
  fromName: string | null;
  receivedAt: string;
  bodyText: string;
  status: 'PENDING' | 'PARSED' | 'QUOTE_CREATED' | 'SKIPPED';
  parsedData: {
    pickupCity: string | null; pickupState: string | null;
    deliveryCity: string | null; deliveryState: string | null;
    equipment: string | null; weight: number | null; rate: number | null;
    pickupDate: string | null; commodity: string | null;
  } | null;
}

interface Carrier {
  id: string; name: string; mcNumber: string; dotNumber: string | null;
  email: string | null; phone: string | null; city: string | null; state: string | null;
  equipmentTypes: string[]; insuranceExpiry: string | null; authorityExpiry: string | null;
  w9OnFile: boolean; status: string; _count: { loads: number };
}

interface Customer { id: string; name: string; }

// ─── Constants ────────────────────────────────────────────────────────────────

const CARRIER_MODES: { key: string; label: string; desc: string; icon: string; equipment: string[] }[] = [
  { key: 'FTL', label: 'FTL', desc: 'Full Truckload', icon: '🚛', equipment: ['Dry Van', 'Reefer', 'Flatbed', 'Step Deck', 'RGN', 'Power Only'] },
  { key: 'LTL', label: 'LTL', desc: 'Less Than Truckload', icon: '📦', equipment: ['Box Truck', 'Sprinter'] },
  { key: 'Rail', label: 'Rail', desc: 'Intermodal / Rail', icon: '🚂', equipment: ['Rail', 'Intermodal'] },
  { key: 'Port', label: 'Port', desc: 'Drayage / Port Moves', icon: '🚢', equipment: ['Drayage', 'Container', 'Chassis'] },
];

const EQUIP_OPTIONS = ['Dry Van', 'Reefer', 'Flatbed', 'Step Deck', 'RGN', 'Power Only', 'Box Truck', 'Sprinter', 'Rail', 'Intermodal', 'Drayage', 'Container'];

function daysUntil(d: string | null) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CapacityPage() {
  const router = useRouter();

  // Inbox Intellect state
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [emailsLoading, setEmailsLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null);
  const [polling, setPolling] = useState(false);

  // CarrierQ state
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [mode, setMode] = useState('FTL');
  const [carrierSearch, setCarrierSearch] = useState('');
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | null>(null);

  // Quick Load Create state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({
    customerId: '', pickupCity: '', pickupState: '', deliveryCity: '', deliveryState: '',
    equipment: 'Dry Van', commodity: '', weight: '', customerRate: '', carrierRate: '', pickupDate: '',
  });
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState('');
  const [formError, setFormError] = useState('');

  // Toast
  const [toast, setToast] = useState('');

  const loadRef = useRef<HTMLDivElement>(null);

  // ─── Data loading ──────────────────────────────────────────────────────────

  async function loadData() {
    try {
      const [emailRes, carrierRes, custRes] = await Promise.all([
        api.get('/email/logs').catch(() => ({ data: [] })),
        api.get('/carriers'),
        api.get('/customers'),
      ]);
      setEmails(emailRes.data.filter((e: EmailLog) => e.status === 'PARSED' || e.status === 'PENDING'));
      setCarriers(carrierRes.data.filter((c: Carrier) => c.status === 'ACTIVE'));
      setCustomers(custRes.data.filter((c: Customer & { isActive: boolean }) => c.isActive));
    } finally {
      setEmailsLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  // ─── Inbox Intellect: Poll mailbox ─────────────────────────────────────────

  async function pollInbox() {
    setPolling(true);
    try {
      const { data } = await api.post('/email/poll');
      showToast(data.message);
      await loadData();
    } catch { showToast('No mailbox configured — add one in Email Inbox settings.'); }
    finally { setPolling(false); }
  }

  // ─── Inbox Intellect: Convert email → prefill form ─────────────────────────

  function convertEmailToLoad(email: EmailLog) {
    setSelectedEmail(email);
    const p = email.parsedData;
    setForm(prev => ({
      ...prev,
      pickupCity: p?.pickupCity || '',
      pickupState: p?.pickupState || '',
      deliveryCity: p?.deliveryCity || '',
      deliveryState: p?.deliveryState || '',
      equipment: p?.equipment || 'Dry Van',
      commodity: p?.commodity || '',
      weight: p?.weight ? String(p.weight) : '',
      customerRate: p?.rate ? String(p.rate) : '',
      pickupDate: p?.pickupDate ? new Date(p.pickupDate).toISOString().slice(0, 10) : '',
    }));
    setFormError('');
    setCreated('');
    loadRef.current?.scrollIntoView({ behavior: 'smooth' });
    showToast(`Inbox Intellect™ pre-filled load from "${email.subject}"`);
  }

  // ─── CarrierQ: Select carrier → prefill form ──────────────────────────────

  function selectCarrier(c: Carrier) {
    setSelectedCarrier(c);
    // Auto-set equipment from carrier's types
    const firstEquip = c.equipmentTypes[0];
    if (firstEquip) setForm(prev => ({ ...prev, equipment: firstEquip }));
    showToast(`CarrierQ™ selected ${c.name}`);
  }

  // ─── Quick Create: Submit ──────────────────────────────────────────────────

  async function handleCreate() {
    if (!form.customerId || !form.pickupCity || !form.deliveryCity || !form.customerRate) {
      setFormError('Customer, pickup city, delivery city, and customer rate are required.');
      return;
    }
    setCreating(true); setFormError(''); setCreated('');
    try {
      const payload: Record<string, unknown> = {
        customerId: form.customerId,
        pickupCity: form.pickupCity, pickupState: form.pickupState,
        deliveryCity: form.deliveryCity, deliveryState: form.deliveryState,
        equipment: form.equipment, commodity: form.commodity,
        weight: form.weight ? parseFloat(form.weight) : undefined,
        customerRate: parseFloat(form.customerRate),
        carrierRate: form.carrierRate ? parseFloat(form.carrierRate) : undefined,
        pickupDate: form.pickupDate || undefined,
      };

      const { data: load } = await api.post('/loads', payload);

      // If carrier selected via CarrierQ, dispatch immediately
      if (selectedCarrier && form.carrierRate) {
        await api.post(`/loads/${load.id}/dispatch`, {
          carrierId: selectedCarrier.id,
          carrierRate: parseFloat(form.carrierRate),
        });
      }

      // Mark email as processed if came from Inbox Intellect
      if (selectedEmail) {
        await api.patch(`/email/logs/${selectedEmail.id}/skip`).catch(() => {});
      }

      setCreated(load.loadNumber);
      setSelectedEmail(null);
      setSelectedCarrier(null);
      setForm({ customerId: '', pickupCity: '', pickupState: '', deliveryCity: '', deliveryState: '', equipment: 'Dry Van', commodity: '', weight: '', customerRate: '', carrierRate: '', pickupDate: '' });
      await loadData();
      showToast(`✓ Load ${load.loadNumber} created${selectedCarrier ? ` & dispatched to ${selectedCarrier.name}` : ''}`);
    } catch (err: unknown) {
      setFormError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create load');
    } finally {
      setCreating(false);
    }
  }

  // ─── CarrierQ: Filter by mode + search ────────────────────────────────────

  const modeConfig = CARRIER_MODES.find(m => m.key === mode)!;
  const filteredCarriers = carriers.filter(c => {
    const modeMatch = c.equipmentTypes.some(eq => modeConfig.equipment.includes(eq));
    const searchMatch = !carrierSearch || c.name.toLowerCase().includes(carrierSearch.toLowerCase()) || c.mcNumber.includes(carrierSearch);
    return modeMatch && searchMatch;
  });

  const insColor = (c: Carrier) => { const d = daysUntil(c.insuranceExpiry); return d === null ? '#94a3b8' : d < 0 ? '#b91c1c' : d < 30 ? '#b45309' : '#15803d'; };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <Topbar title="Capacity Hub" />
      <main style={{ flex: 1, overflowY: 'auto', background: '#f8fafc' }}>

        {/* ── Hero Banner ── */}
        <div style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 50%, #1e3a8a 100%)', padding: '28px 26px 24px', color: '#fff' }}>
          <div style={{ maxWidth: 900 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, padding: '3px 10px', letterSpacing: '0.5px' }}>NEXGEN CAPACITY</span>
            </div>
            <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
              Create loads instantly.<br />Access broader capacity. Cover more freight.
            </h1>
            <p style={{ margin: '0 0 18px', fontSize: 14, opacity: 0.85, lineHeight: 1.5, maxWidth: 620 }}>
              Create loads in seconds and reach a wider, smarter pool of FTL, LTL, rail-wise, and port-wise carriers — all from one screen, without switching between tools.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { icon: '✉', name: 'Inbox Intellect™', desc: 'Email → Load in 1 click' },
                { icon: '⚡', name: 'CarrierQ™', desc: 'FTL · LTL · Rail · Port' },
                { icon: '🔗', name: 'One Workflow', desc: 'Create, match & book' },
              ].map(f => (
                <div key={f.name} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{f.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{f.name}</div>
                    <div style={{ fontSize: 11, opacity: 0.8 }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 0, minHeight: 'calc(100vh - 200px)' }}>

          {/* ══════════════════════════════════════════════════════════
              LEFT PANEL — Inbox Intellect™ + Quick Create
              ══════════════════════════════════════════════════════════ */}
          <div style={{ borderRight: '1px solid #e2e8f0', background: '#fff', display: 'flex', flexDirection: 'column' }}>

            {/* ── Inbox Intellect™ ── */}
            <div style={{ borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    ✉ Inbox Intellect™
                    {emails.length > 0 && (
                      <span style={{ background: '#1d4ed8', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '1px 6px' }}>{emails.length}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Shipper emails → draft loads instantly</div>
                </div>
                <button onClick={pollInbox} disabled={polling} style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: polling ? 'not-allowed' : 'pointer', color: '#475569', opacity: polling ? 0.7 : 1 }}>
                  {polling ? '⟳ Checking…' : '⟳ Check'}
                </button>
              </div>

              <div style={{ maxHeight: 260, overflowY: 'auto', padding: '0 8px 8px' }}>
                {emailsLoading && <div style={{ padding: '16px', color: '#94a3b8', fontSize: 12, textAlign: 'center' }}>Loading…</div>}
                {!emailsLoading && emails.length === 0 && (
                  <div style={{ padding: '20px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>✉</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>No pending emails. Configure IMAP in Email Inbox to start auto-converting shipper emails.</div>
                    <button onClick={() => router.push('/email')} style={{ marginTop: 10, border: '1px solid #dbe5ff', background: '#eff6ff', color: '#1d4ed8', borderRadius: 7, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      Configure Email Inbox →
                    </button>
                  </div>
                )}
                {emails.map(email => {
                  const p = email.parsedData;
                  const isSelected = selectedEmail?.id === email.id;
                  return (
                    <div key={email.id} onClick={() => convertEmailToLoad(email)} style={{
                      border: `1px solid ${isSelected ? '#1d4ed8' : '#e2e8f0'}`,
                      borderRadius: 8, padding: '10px 12px', marginBottom: 6, cursor: 'pointer',
                      background: isSelected ? '#eff6ff' : '#fff',
                      transition: 'all 0.1s',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? '#1e40af' : '#15202b', lineClamp: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                          {email.subject}
                        </div>
                        <span style={{ fontSize: 10, background: '#ecfdf3', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 4, padding: '1px 5px', fontWeight: 700, flexShrink: 0, marginLeft: 6 }}>PARSED</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{email.fromName || email.fromEmail}</div>
                      {p?.pickupCity && p?.deliveryCity && (
                        <div style={{ fontSize: 11, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontWeight: 600 }}>{p.pickupCity}, {p.pickupState}</span>
                          <span style={{ color: '#94a3b8' }}>→</span>
                          <span style={{ fontWeight: 600 }}>{p.deliveryCity}, {p.deliveryState}</span>
                          {p.equipment && <span style={{ background: '#f1f5f9', color: '#475569', borderRadius: 4, padding: '1px 5px', marginLeft: 4 }}>{p.equipment}</span>}
                          {p.rate && <span style={{ color: '#15803d', fontWeight: 700, marginLeft: 4 }}>${p.rate.toLocaleString()}</span>}
                        </div>
                      )}
                      {isSelected && (
                        <div style={{ marginTop: 6, fontSize: 10, color: '#1d4ed8', fontWeight: 700 }}>✓ Pre-filling load form →</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Quick Load Create ── */}
            <div ref={loadRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                ⚡ Quick Create
                {selectedEmail && <span style={{ fontSize: 10, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #dbe5ff', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>FROM EMAIL</span>}
                {selectedCarrier && <span style={{ fontSize: 10, background: '#ecfdf3', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>CARRIER READY</span>}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>
                {selectedEmail ? `Pre-filled from "${selectedEmail.subject}"` : 'Create a load and assign capacity in one step'}
              </div>

              {created && (
                <div style={{ background: '#ecfdf3', border: '1px solid #15803d', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13 }}>
                  <div style={{ fontWeight: 700, color: '#15803d' }}>✓ Load {created} created!</div>
                  <button onClick={() => router.push('/loads')} style={{ marginTop: 4, border: 0, background: 'none', color: '#1d4ed8', fontSize: 12, cursor: 'pointer', padding: 0, fontWeight: 600 }}>View in Loads →</button>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Customer */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Customer *</label>
                  <select value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 10px', fontSize: 13, outline: 'none', background: '#fff' }}>
                    <option value="">Select customer…</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {/* Route */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 52px', gap: 6 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Pickup City *</label>
                    <input value={form.pickupCity} onChange={e => setForm({ ...form, pickupCity: e.target.value })} placeholder="Chicago" style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>State</label>
                    <input value={form.pickupState} onChange={e => setForm({ ...form, pickupState: e.target.value })} placeholder="IL" maxLength={2} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 52px', gap: 6 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Delivery City *</label>
                    <input value={form.deliveryCity} onChange={e => setForm({ ...form, deliveryCity: e.target.value })} placeholder="Dallas" style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>State</label>
                    <input value={form.deliveryState} onChange={e => setForm({ ...form, deliveryState: e.target.value })} placeholder="TX" maxLength={2} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
                  </div>
                </div>

                {/* Equipment + Date */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Equipment</label>
                    <select value={form.equipment} onChange={e => setForm({ ...form, equipment: e.target.value })} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 10px', fontSize: 13, outline: 'none', background: '#fff' }}>
                      {EQUIP_OPTIONS.map(e => <option key={e}>{e}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Pickup Date</label>
                    <input type="date" value={form.pickupDate} onChange={e => setForm({ ...form, pickupDate: e.target.value })} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
                  </div>
                </div>

                {/* Commodity + Weight */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Commodity</label>
                    <input value={form.commodity} onChange={e => setForm({ ...form, commodity: e.target.value })} placeholder="Frozen foods" style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Weight (lbs)</label>
                    <input type="number" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} placeholder="42000" style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
                  </div>
                </div>

                {/* Rates */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Customer Rate ($) *</label>
                    <input type="number" value={form.customerRate} onChange={e => setForm({ ...form, customerRate: e.target.value })} placeholder="2950" style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Carrier Rate ($)</label>
                    <input type="number" value={form.carrierRate} onChange={e => setForm({ ...form, carrierRate: e.target.value })} placeholder="2600" style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
                  </div>
                </div>

                {/* Margin preview */}
                {form.customerRate && form.carrierRate && (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>Margin</span>
                      <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, color: (parseFloat(form.customerRate) - parseFloat(form.carrierRate)) / parseFloat(form.customerRate) < 0.10 ? '#b91c1c' : '#15803d' }}>
                        ${(parseFloat(form.customerRate) - parseFloat(form.carrierRate)).toLocaleString()} ({Math.round((parseFloat(form.customerRate) - parseFloat(form.carrierRate)) / parseFloat(form.customerRate) * 100)}%)
                      </span>
                    </div>
                    {selectedCarrier && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                        <span style={{ color: '#94a3b8' }}>Carrier</span>
                        <span style={{ fontWeight: 600, color: '#15803d' }}>{selectedCarrier.name}</span>
                      </div>
                    )}
                  </div>
                )}

                {formError && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: '#b91c1c' }}>{formError}</div>}

                <button onClick={handleCreate} disabled={creating} style={{
                  width: '100%', background: '#1d4ed8', border: '1px solid #1d4ed8', color: '#fff',
                  borderRadius: 8, padding: '11px', fontWeight: 700, fontSize: 14, cursor: creating ? 'not-allowed' : 'pointer',
                  opacity: creating ? 0.8 : 1, marginTop: 4,
                }}>
                  {creating ? '⟳ Creating…' : selectedCarrier ? `⚡ Create & Dispatch to ${selectedCarrier.name}` : '⚡ Create Load'}
                </button>

                {selectedEmail && (
                  <button onClick={() => { setSelectedEmail(null); }} style={{ width: '100%', background: 'transparent', border: '1px solid #e2e8f0', color: '#94a3b8', borderRadius: 8, padding: '8px', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                    Clear email pre-fill
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════
              RIGHT PANEL — CarrierQ™
              ══════════════════════════════════════════════════════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>

            {/* CarrierQ header */}
            <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '14px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    ⚡ CarrierQ™
                    <span style={{ fontSize: 10, fontWeight: 700, background: '#1d4ed8', color: '#fff', borderRadius: 4, padding: '2px 7px' }}>LIVE</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Instant access to FTL, LTL, rail-wise & port-wise capacity</div>
                </div>
                <div style={{ fontSize: 13, color: '#475569' }}>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, color: '#1d4ed8' }}>{filteredCarriers.length}</span> available
                </div>
              </div>

              {/* Mode tabs */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {CARRIER_MODES.map(m => (
                  <button key={m.key} onClick={() => { setMode(m.key); setSelectedCarrier(null); setCarrierSearch(''); }} style={{
                    display: 'flex', alignItems: 'center', gap: 6, border: '1px solid', padding: '7px 14px', borderRadius: 8,
                    borderColor: mode === m.key ? '#1d4ed8' : '#e2e8f0',
                    background: mode === m.key ? '#1d4ed8' : '#fff',
                    color: mode === m.key ? '#fff' : '#475569',
                    fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.1s',
                  }}>
                    <span>{m.icon}</span>
                    <span>{m.label}</span>
                    <span style={{ fontSize: 10, opacity: 0.75 }}>{m.desc}</span>
                  </button>
                ))}
              </div>

              {/* Search */}
              <input
                value={carrierSearch}
                onChange={e => setCarrierSearch(e.target.value)}
                placeholder={`Search ${modeConfig.label} carriers by name or MC#…`}
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', background: '#f8fafc' }}
              />
            </div>

            {/* Carrier grid */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {filteredCarriers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>{modeConfig.icon}</div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>No {modeConfig.label} carriers found</div>
                  <div style={{ fontSize: 12 }}>Add carriers with {modeConfig.equipment.slice(0, 2).join(' or ')} equipment to see them here.</div>
                  <button onClick={() => router.push('/carriers')} style={{ marginTop: 12, border: '1px solid #dbe5ff', background: '#eff6ff', color: '#1d4ed8', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    + Add {modeConfig.label} Carrier
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                  {filteredCarriers.map(c => {
                    const isSelected = selectedCarrier?.id === c.id;
                    const ins = daysUntil(c.insuranceExpiry);
                    const insLabel = ins === null ? '—' : ins < 0 ? 'Expired' : ins < 30 ? `${ins}d left` : 'Valid';
                    const loads = c._count.loads;

                    return (
                      <div key={c.id} onClick={() => selectCarrier(c)} style={{
                        background: '#fff', border: `2px solid ${isSelected ? '#1d4ed8' : '#e2e8f0'}`,
                        borderRadius: 10, padding: '14px', cursor: 'pointer',
                        boxShadow: isSelected ? '0 0 0 3px rgba(29,78,216,0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
                        transition: 'all 0.12s',
                        position: 'relative',
                      }}>
                        {isSelected && (
                          <div style={{ position: 'absolute', top: 10, right: 10, background: '#1d4ed8', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '2px 7px' }}>SELECTED</div>
                        )}

                        <div style={{ fontWeight: 700, fontSize: 13, color: '#15202b', marginBottom: 2, paddingRight: isSelected ? 70 : 0 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>MC: {c.mcNumber}{c.dotNumber ? ` · DOT: ${c.dotNumber}` : ''}</div>

                        {/* Equipment tags */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                          {c.equipmentTypes.filter(eq => modeConfig.equipment.includes(eq)).map(eq => (
                            <span key={eq} style={{ fontSize: 10, fontWeight: 600, background: '#eff6ff', color: '#1e40af', border: '1px solid #dbe5ff', borderRadius: 4, padding: '2px 7px' }}>{eq}</span>
                          ))}
                          {c.equipmentTypes.filter(eq => !modeConfig.equipment.includes(eq)).slice(0, 2).map(eq => (
                            <span key={eq} style={{ fontSize: 10, color: '#94a3b8', background: '#f1f5f9', borderRadius: 4, padding: '2px 7px' }}>{eq}</span>
                          ))}
                        </div>

                        {/* Stats */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                          {[
                            { label: 'Insurance', value: insLabel, color: insColor(c) },
                            { label: 'Loads Done', value: loads, color: '#475569' },
                            { label: 'W9', value: c.w9OnFile ? 'On File' : 'Missing', color: c.w9OnFile ? '#15803d' : '#b91c1c' },
                          ].map(stat => (
                            <div key={stat.label} style={{ background: '#f8fafc', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
                              <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>{stat.label}</div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                            </div>
                          ))}
                        </div>

                        {c.city && c.state && (
                          <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8' }}>📍 {c.city}, {c.state}</div>
                        )}

                        {isSelected && (
                          <div style={{ marginTop: 10, background: '#eff6ff', borderRadius: 7, padding: '7px 10px', fontSize: 11, color: '#1e40af', fontWeight: 600 }}>
                            ✓ Selected — set carrier rate in Quick Create to book instantly
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: '#15202b', color: '#fff', borderRadius: 8, padding: '10px 20px',
          fontSize: 13, fontWeight: 500, zIndex: 9999, whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}>
          {toast}
        </div>
      )}
    </>
  );
}
