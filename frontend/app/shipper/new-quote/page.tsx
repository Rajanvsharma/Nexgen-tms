'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

type Method = 'manual' | 'email' | 'excel';

const EQUIPMENT = ['Dry Van', 'Reefer', 'Flatbed', 'Step Deck', 'RGN', 'Power Only', 'Box Truck'];
const EMPTY = { pickupCity: '', pickupState: '', deliveryCity: '', deliveryState: '', equipment: 'Dry Van', commodity: '', weight: '', pickupDate: '', deliveryDate: '', specialInstructions: '', rate: '' };

interface QuoteForm {
  pickupCity: string; pickupState: string; deliveryCity: string; deliveryState: string;
  equipment: string; commodity: string; weight: string; pickupDate: string;
  deliveryDate: string; specialInstructions: string; rate: string;
}

export default function NewQuotePage() {
  const [method, setMethod] = useState<Method>('manual');
  const [form, setForm] = useState<QuoteForm>(EMPTY);
  const [emailText, setEmailText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [confidence, setConfidence] = useState<string>('');
  const [csvRows, setCsvRows] = useState<QuoteForm[]>([]);
  const [csvParsing, setCsvParsing] = useState(false);
  const [csvReady, setCsvReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [bulkSaved, setBulkSaved] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function setField(k: keyof QuoteForm, v: string) { setForm(prev => ({ ...prev, [k]: v })); }

  // ── Email extraction ──────────────────────────────────────────────────────────
  async function extractFromEmail() {
    if (!emailText.trim()) { setError('Paste email content first'); return; }
    setExtracting(true); setError('');
    try {
      const { data } = await api.post('/portal/quotes/parse-email', { emailText });
      setForm({
        pickupCity: data.pickupCity || '',
        pickupState: data.pickupState || '',
        deliveryCity: data.deliveryCity || '',
        deliveryState: data.deliveryState || '',
        equipment: data.equipment || 'Dry Van',
        commodity: data.commodity || '',
        weight: data.weight ? String(data.weight) : '',
        pickupDate: data.pickupDate || '',
        deliveryDate: data.deliveryDate || '',
        specialInstructions: data.specialInstructions || '',
        rate: '',
      });
      setConfidence(data.confidence || '');
      setExtracted(true);
      setMethod('manual');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Extraction failed');
    } finally { setExtracting(false); }
  }

  // ── Excel/CSV parsing ─────────────────────────────────────────────────────────
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvParsing(true); setCsvRows([]); setCsvReady(false); setError('');

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) { setError('File has no data rows'); setCsvParsing(false); return; }

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const rows = lines.slice(1).map(line => {
          const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
          return obj;
        });

        const { data } = await api.post('/portal/quotes/parse-excel', { rows });
        const mapped: QuoteForm[] = data.quotes.map((q: Record<string, unknown>) => ({
          pickupCity: String(q.pickupCity || ''),
          pickupState: String(q.pickupState || ''),
          deliveryCity: String(q.deliveryCity || ''),
          deliveryState: String(q.deliveryState || ''),
          equipment: String(q.equipment || 'Dry Van'),
          commodity: String(q.commodity || ''),
          weight: q.weight ? String(q.weight) : '',
          pickupDate: String(q.pickupDate || ''),
          deliveryDate: String(q.deliveryDate || ''),
          specialInstructions: String(q.specialInstructions || ''),
          rate: q.rate ? String(q.rate) : '',
        }));
        setCsvRows(mapped);
        setCsvReady(true);
      } catch (err: unknown) {
        setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to parse file');
      } finally { setCsvParsing(false); }
    };
    reader.readAsText(file);
  }

  // ── Submit single quote ───────────────────────────────────────────────────────
  async function submitQuote(f: QuoteForm, src: string) {
    if (!f.pickupCity || !f.deliveryCity || !f.equipment) {
      setError('Pickup city, delivery city, and equipment are required'); return false;
    }
    await api.post('/portal/quotes', { ...f, weight: f.weight || undefined, rate: f.rate || undefined, source: src });
    return true;
  }

  async function handleSubmitManual() {
    setSaving(true); setError('');
    try {
      const src = extracted ? 'Email Extract' : 'Portal Manual';
      const ok = await submitQuote(form, src);
      if (ok) setSaved(true);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to submit');
    } finally { setSaving(false); }
  }

  async function handleBulkSubmit() {
    setSaving(true); setError('');
    try {
      await Promise.all(csvRows.map(r => submitQuote(r, 'Excel Upload')));
      setBulkSaved(true);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Some quotes failed to submit');
    } finally { setSaving(false); }
  }

  if (saved || bulkSaved) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px' }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
          {bulkSaved ? `${csvRows.length} Quotes Submitted!` : 'Quote Submitted!'}
        </h2>
        <p style={{ color: '#64748b', fontSize: 14 }}>Our team will review and respond within 2 business hours.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
          <button onClick={() => router.push('/shipper')} style={{ padding: '10px 24px', background: '#3b82f6', color: '#fff', border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            View My Quotes
          </button>
          <button onClick={() => { setSaved(false); setBulkSaved(false); setForm(EMPTY); setEmailText(''); setCsvRows([]); setCsvReady(false); setExtracted(false); setMethod('manual'); }} style={{ padding: '10px 24px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
            Submit Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 780 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>Request a Quote</h1>
        <p style={{ color: '#64748b', fontSize: 13 }}>Choose how you'd like to submit your shipment details</p>
      </div>

      {/* Method selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 28 }}>
        {([
          { key: 'manual', icon: '✏️', title: 'Manual Entry', desc: 'Fill in shipment details' },
          { key: 'email', icon: '📧', title: 'From Email', desc: 'Paste email, AI extracts details' },
          { key: 'excel', icon: '📊', title: 'Upload File', desc: 'CSV or Excel bulk upload' },
        ] as const).map(({ key, icon, title, desc }) => (
          <button key={key} onClick={() => { setMethod(key); setError(''); setExtracted(false); }} style={{
            padding: '16px 14px', textAlign: 'left', background: method === key ? '#eff6ff' : '#fff',
            border: `2px solid ${method === key ? '#3b82f6' : '#e2e8f0'}`, borderRadius: 12, cursor: 'pointer',
          }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
            <div style={{ fontWeight: 700, fontSize: 13, color: method === key ? '#1d4ed8' : '#0f172a' }}>{title}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{desc}</div>
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 28 }}>

        {/* ── Email method ── */}
        {method === 'email' && !extracted && (
          <div>
            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15, marginBottom: 4 }}>📧 Paste Email Content</div>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 14 }}>
              Paste a customer email or quote request — AI will extract pickup, delivery, equipment, weight and dates automatically.
            </p>
            <textarea
              value={emailText}
              onChange={e => setEmailText(e.target.value)}
              placeholder={`From: orders@yourcompany.com\nSubject: Need a truck - Chicago to Dallas\n\nHi, we have a reefer load ready Thursday.\nPickup: Chicago, IL 60607 on 06/15\nDeliver: Dallas, TX 75201\nCommodity: frozen vegetables, approx 42,000 lbs\nTemp: -10F. Standard net 30.\nThanks, Dana`}
              style={{ width: '100%', height: 200, padding: 14, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'monospace' }}
            />
            {error && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{error}</div>}
            <button onClick={extractFromEmail} disabled={extracting} style={{
              marginTop: 14, height: 42, padding: '0 24px', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
              color: '#fff', border: 0, borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}>
              {extracting ? '⏳ Extracting with AI…' : '✦ Extract with AI'}
            </button>
          </div>
        )}

        {/* ── Excel method ── */}
        {method === 'excel' && !csvReady && (
          <div>
            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15, marginBottom: 4 }}>📊 Upload CSV File</div>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 14 }}>
              Upload a CSV file with your shipments. Column names are flexible — we'll auto-map them.
            </p>
            <div style={{
              border: '2px dashed #cbd5e1', borderRadius: 10, padding: '32px 24px', textAlign: 'center',
              background: '#f8fafc', cursor: 'pointer',
            }} onClick={() => fileRef.current?.click()}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
              <div style={{ fontWeight: 600, color: '#374151', fontSize: 14 }}>Click to select file</div>
              <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>Supports .csv files · Export your Excel as CSV</div>
            </div>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileUpload} />

            <div style={{ marginTop: 16, padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, color: '#64748b' }}>
              <strong>Expected columns (flexible naming):</strong><br />
              Pickup City · Pickup State · Delivery City · Delivery State · Equipment · Commodity · Weight · Pickup Date · Rate · Notes
            </div>

            {csvParsing && <div style={{ color: '#3b82f6', fontSize: 13, marginTop: 12 }}>⏳ Parsing file…</div>}
            {error && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{error}</div>}
          </div>
        )}

        {/* ── CSV preview ── */}
        {method === 'excel' && csvReady && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15 }}>✅ {csvRows.length} shipments ready</div>
                <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>Review before submitting</div>
              </div>
              <button onClick={() => { setCsvRows([]); setCsvReady(false); if (fileRef.current) fileRef.current.value = ''; }} style={{ fontSize: 12, color: '#64748b', background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}>
                Re-upload
              </button>
            </div>
            <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                  <tr>
                    {['#', 'Pickup', 'Delivery', 'Equipment', 'Commodity', 'Weight', 'Date'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvRows.map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{i + 1}</td>
                      <td style={{ padding: '8px 12px', color: '#334155' }}>{r.pickupCity}{r.pickupState ? `, ${r.pickupState}` : ''}</td>
                      <td style={{ padding: '8px 12px', color: '#334155' }}>{r.deliveryCity}{r.deliveryState ? `, ${r.deliveryState}` : ''}</td>
                      <td style={{ padding: '8px 12px', color: '#475569' }}>{r.equipment}</td>
                      <td style={{ padding: '8px 12px', color: '#475569' }}>{r.commodity || '—'}</td>
                      <td style={{ padding: '8px 12px', color: '#475569' }}>{r.weight ? `${Number(r.weight).toLocaleString()} lbs` : '—'}</td>
                      <td style={{ padding: '8px 12px', color: '#475569' }}>{r.pickupDate || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {error && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{error}</div>}
            <button onClick={handleBulkSubmit} disabled={saving} style={{
              marginTop: 16, height: 44, padding: '0 28px',
              background: saving ? '#94a3b8' : 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
              color: '#fff', border: 0, borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}>
              {saving ? 'Submitting…' : `Submit ${csvRows.length} Quote${csvRows.length > 1 ? 's' : ''}`}
            </button>
          </div>
        )}

        {/* ── Manual form (also shown after email extraction) ── */}
        {(method === 'manual' || extracted) && (
          <div>
            {extracted && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 18, display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 18 }}>✦</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#15803d' }}>AI extracted your shipment details</div>
                  <div style={{ fontSize: 11, color: '#16a34a' }}>Confidence: {confidence} · Review and edit before submitting</div>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr 80px', gap: '12px 10px', marginBottom: 14 }}>
              <div>
                <label style={lbl}>Pickup City *</label>
                <input value={form.pickupCity} onChange={e => setField('pickupCity', e.target.value)} style={inp} placeholder="Chicago" />
              </div>
              <div>
                <label style={lbl}>State</label>
                <input value={form.pickupState} onChange={e => setField('pickupState', e.target.value)} style={inp} placeholder="IL" maxLength={2} />
              </div>
              <div>
                <label style={lbl}>Delivery City *</label>
                <input value={form.deliveryCity} onChange={e => setField('deliveryCity', e.target.value)} style={inp} placeholder="Dallas" />
              </div>
              <div>
                <label style={lbl}>State</label>
                <input value={form.deliveryState} onChange={e => setField('deliveryState', e.target.value)} style={inp} placeholder="TX" maxLength={2} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px 10px', marginBottom: 14 }}>
              <div>
                <label style={lbl}>Equipment *</label>
                <select value={form.equipment} onChange={e => setField('equipment', e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                  {EQUIPMENT.map(eq => <option key={eq}>{eq}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Commodity</label>
                <input value={form.commodity} onChange={e => setField('commodity', e.target.value)} style={inp} placeholder="Frozen vegetables" />
              </div>
              <div>
                <label style={lbl}>Weight (lbs)</label>
                <input type="number" value={form.weight} onChange={e => setField('weight', e.target.value)} style={inp} placeholder="42000" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px 10px', marginBottom: 14 }}>
              <div>
                <label style={lbl}>Pickup Date</label>
                <input type="date" value={form.pickupDate} onChange={e => setField('pickupDate', e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Delivery Date</label>
                <input type="date" value={form.deliveryDate} onChange={e => setField('deliveryDate', e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Target Rate ($)</label>
                <input type="number" value={form.rate} onChange={e => setField('rate', e.target.value)} style={inp} placeholder="Optional" />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Special Instructions</label>
              <textarea value={form.specialInstructions} onChange={e => setField('specialInstructions', e.target.value)} style={{ ...inp, height: 72, resize: 'vertical', paddingTop: 10 }} placeholder="Temp requirements, liftgate, appointment, hazmat, etc." />
            </div>

            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '9px 13px', color: '#dc2626', fontSize: 13, marginBottom: 14 }}>{error}</div>}

            <button onClick={handleSubmitManual} disabled={saving} style={{
              height: 44, padding: '0 28px',
              background: saving ? '#94a3b8' : 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
              color: '#fff', border: 0, borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer',
            }}>
              {saving ? 'Submitting…' : 'Submit Quote Request'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.3px' };
const inp: React.CSSProperties = { width: '100%', height: 38, padding: '0 12px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, color: '#0f172a', background: '#fafafa', boxSizing: 'border-box', outline: 'none' };
