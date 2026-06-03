'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Topbar from '@/components/layout/Topbar';
import api from '@/lib/api';

const SAMPLE_EMAIL = `From: orders@midwestfoods.com
Subject: Need a truck - frozen load Chicago to Dallas

Hi team, we have a reefer load ready Thursday.
Pickup: Chicago, IL 60607 on 06/05
Deliver: Dallas, TX 75201
Commodity: frozen vegetables, approx 42,000 lbs
Temp: -10F. Need rate ASAP. Standard net 30.
Thanks, Dana`;

interface Extracted {
  customer: string;
  contact: string;
  origin: string;
  dest: string;
  commodity: string;
  weight: string;
  equip: string;
  pickup: string;
  terms: string;
  source: string;
}

interface Confidence {
  [key: string]: number;
}

interface Field {
  key: string;
  label: string;
  value: string;
  conf: number;
}

interface Customer { id: string; name: string; }

const CONF_LEVEL = (c: number) => c >= 0.9 ? '' : c >= 0.75 ? 'mid' : 'low';
const CONF_COLOR = (c: number) => c >= 0.9 ? '#15803d' : c >= 0.75 ? '#b45309' : '#b91c1c';

export default function IntakePage() {
  const router = useRouter();
  const [mode, setMode] = useState<'email' | 'shot'>('email');
  const [emailText, setEmailText] = useState(SAMPLE_EMAIL);
  const [shotFile, setShotFile] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [confidence, setConfidence] = useState<Confidence>({});
  const [fields, setFields] = useState<Field[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function runExtract() {
    setExtracting(true);
    setExtracted(null);

    // Simulate AI extraction with confidence scores
    await new Promise(r => setTimeout(r, 1300));

    let data: Extracted;
    let conf: Confidence;

    if (mode === 'email') {
      data = { customer: 'Midwest Foods Inc', contact: 'orders@midwestfoods.com', origin: 'Chicago, IL 60607', dest: 'Dallas, TX 75201', commodity: 'Frozen Vegetables', weight: '42,000 lb', equip: 'Reefer (-10°F)', pickup: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), terms: 'Net 30', source: 'Email' };
      conf = { customer: 0.96, origin: 0.99, dest: 0.99, commodity: 0.92, weight: 0.88, equip: 0.84, pickup: 0.95, contact: 0.97, terms: 0.82 };
    } else {
      data = { customer: 'Lone Star Beverages', contact: 'logistics@lonestarbev.com', origin: 'Dallas, TX', dest: 'Houston, TX', commodity: 'Bottled Water', weight: '38,500 lb', equip: 'Dry Van', pickup: new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10), terms: 'Net 45', source: 'Screenshot (OCR)' };
      conf = { customer: 0.88, origin: 0.94, dest: 0.93, commodity: 0.78, weight: 0.71, equip: 0.92, pickup: 0.65, contact: 0.85, terms: 0.70 };
    }

    const fieldList: Field[] = [
      { key: 'customer', label: 'Customer', value: data.customer, conf: conf.customer },
      { key: 'contact', label: 'Contact Email', value: data.contact, conf: conf.contact },
      { key: 'origin', label: 'Origin', value: data.origin, conf: conf.origin },
      { key: 'dest', label: 'Destination', value: data.dest, conf: conf.dest },
      { key: 'commodity', label: 'Commodity', value: data.commodity, conf: conf.commodity },
      { key: 'weight', label: 'Weight', value: data.weight, conf: conf.weight },
      { key: 'equip', label: 'Equipment', value: data.equip, conf: conf.equip },
      { key: 'pickup', label: 'Pickup Date', value: data.pickup, conf: conf.pickup },
      { key: 'terms', label: 'Payment Terms', value: data.terms, conf: conf.terms },
    ];

    try {
      const { data: custs } = await api.get('/customers');
      setCustomers(custs.filter((c: Customer & { isActive: boolean }) => c.isActive));
    } catch { /* ignore */ }

    setExtracted(data);
    setConfidence(conf);
    setFields(fieldList);
    setExtracting(false);
  }

  function updateField(key: string, value: string) {
    setFields(prev => prev.map(f => f.key === key ? { ...f, value } : f));
  }

  async function createQuote() {
    const get = (k: string) => fields.find(f => f.key === k)?.value || '';
    const origin = get('origin').replace(/\s\d{5}.*/, '');
    const dest = get('dest').replace(/\s\d{5}.*/, '');

    // Find or create customer
    const customerName = get('customer');
    let customerId = customers.find(c => c.name.toLowerCase().includes(customerName.toLowerCase()))?.id;

    setCreating(true);
    try {
      if (!customerId) {
        const { data: newCust } = await api.post('/customers', { name: customerName, email: get('contact'), creditTerms: parseInt(get('terms').replace(/\D/g, '')) || 30 });
        customerId = newCust.id;
      }

      const rate = 2950; // AI suggested rate
      await api.post('/quotes', {
        customerId,
        pickupCity: origin.split(',')[0].trim(),
        pickupState: origin.split(',')[1]?.trim().split(' ')[0] || 'IL',
        deliveryCity: dest.split(',')[0].trim(),
        deliveryState: dest.split(',')[1]?.trim().split(' ')[0] || 'TX',
        commodity: get('commodity'),
        weight: parseFloat(get('weight').replace(/[^0-9.]/g, '')) || undefined,
        equipment: get('equip').replace(/\s*\(.*\)/, ''),
        pickupDate: get('pickup'),
        rate,
        source: extracted?.source || 'AI Intake',
        specialInstructions: get('equip').includes('°') ? get('equip').match(/\(.*\)/)?.[0]?.replace(/[()]/g, '') : undefined,
      });
      router.push('/quotes');
    } catch (err: unknown) {
      alert((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create quote');
    } finally {
      setCreating(false);
    }
  }

  function fakePick() {
    setShotFile('whatsapp_rate_request.jpg');
  }

  return (
    <>
      <Topbar title="AI Intake" />
      <main style={{ flex: 1, overflowY: 'auto', padding: '22px 26px 60px' }}>
        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 21, letterSpacing: '-0.4px', display: 'flex', alignItems: 'center', gap: 10 }}>
              AI Intake
              <span className="ai-chip">✦ Email · OCR · Auto-quote</span>
            </h1>
            <div style={{ color: '#475569', fontSize: 13, marginTop: 3 }}>
              Paste a customer email or upload a screenshot/PDF — AI extracts load details and drafts a quotation for review.
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* LEFT: Source */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 15 }}>① Source</h2>
            </div>

            {/* Mode toggle */}
            <div style={{ display: 'inline-flex', border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
              {(['email', 'shot'] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} style={{ border: 0, background: mode === m ? '#eff6ff' : '#fff', color: mode === m ? '#1e40af' : '#475569', padding: '7px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer', borderRight: m === 'email' ? '1px solid #cbd5e1' : 0 }}>
                  {m === 'email' ? '📧 Email' : '🖼 Screenshot / PDF'}
                </button>
              ))}
            </div>

            {mode === 'email' ? (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }}>Paste email content</label>
                <textarea
                  value={emailText}
                  onChange={(e) => setEmailText(e.target.value)}
                  rows={11}
                  style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 7, padding: '9px 11px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, resize: 'vertical', outline: 'none', color: '#15202b' }}
                />
              </div>
            ) : (
              <div>
                <div
                  onClick={() => shotFile ? undefined : (fileRef.current?.click(), fakePick())}
                  style={{ border: '2px dashed #cbd5e1', borderRadius: 10, padding: 32, textAlign: 'center', color: '#94a3b8', background: '#f8fafc', cursor: 'pointer' }}
                >
                  {shotFile ? (
                    <>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>🖼</div>
                      <div style={{ fontWeight: 600, color: '#15202b' }}>{shotFile}</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>Ready to extract</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 30, marginBottom: 8 }}>📤</div>
                      <div>Drop screenshot, WhatsApp image, or PDF here</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>or click to select a sample file</div>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" style={{ display: 'none' }} accept=".jpg,.jpeg,.png,.pdf,.txt,.webp" />
                <div style={{ marginTop: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }}>Or paste extracted text</label>
                  <textarea value={extractedText} onChange={(e) => setExtractedText(e.target.value)} rows={4}
                    placeholder="Paste WhatsApp message, screenshot text, or any load details here..."
                    style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 7, padding: '9px 11px', fontSize: 13, resize: 'none', outline: 'none' }} />
                </div>
              </div>
            )}

            <button
              onClick={runExtract}
              disabled={extracting}
              style={{ marginTop: 14, width: '100%', background: '#1d4ed8', border: '1px solid #1d4ed8', color: '#fff', borderRadius: 8, padding: '10px 14px', fontWeight: 600, fontSize: 13, cursor: extracting ? 'not-allowed' : 'pointer', opacity: extracting ? 0.8 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              {extracting ? (
                <>
                  <span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  AI reading…
                </>
              ) : '✦ Extract with AI'}
            </button>
          </div>

          {/* RIGHT: Extracted details */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 15 }}>② Extracted Details</h2>
              {extracted && <span className="pill np" style={{ background: '#ecfdf3', color: '#15803d' }}>extracted</span>}
              {extracting && <span style={{ color: '#94a3b8', fontSize: 12 }}>processing…</span>}
              {!extracted && !extracting && <span style={{ color: '#94a3b8', fontSize: 12 }}>awaiting input</span>}
            </div>

            {extracting && (
              <div>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="sk" style={{ height: 42, marginBottom: 8 }} />
                ))}
              </div>
            )}

            {!extracted && !extracting && (
              <div style={{ textAlign: 'center', padding: '46px 20px', color: '#94a3b8' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>✦</div>
                Run extraction to see AI-detected fields with confidence scores.
              </div>
            )}

            {extracted && !extracting && (
              <div>
                <div className="callout ok" style={{ marginBottom: 14 }}>
                  <span>✦</span>
                  <div>
                    Detected a <strong>{extracted.equip}</strong> load from <strong>{extracted.source}</strong>.
                    Review the fields below — edit any AI-extracted value before saving.
                  </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    {fields.map((field) => (
                      <tr key={field.key}>
                        <td style={{ padding: '6px 0', width: 120, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#94a3b8', fontWeight: 700, verticalAlign: 'middle' }}>
                          {field.label}
                        </td>
                        <td style={{ padding: '6px 8px', verticalAlign: 'middle' }}>
                          <input
                            value={field.value}
                            onChange={(e) => updateField(field.key, e.target.value)}
                            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 8px', fontSize: 13, outline: 'none', color: '#15202b' }}
                          />
                        </td>
                        <td style={{ padding: '6px 0', width: 90, verticalAlign: 'middle' }}>
                          {field.conf > 0 && (
                            <div>
                              <div className={`confbar ${CONF_LEVEL(field.conf)}`} style={{ width: 70 }}>
                                <i style={{ width: `${Math.round(field.conf * 100)}%`, background: CONF_COLOR(field.conf) }} />
                              </div>
                              <span style={{ fontSize: 10, color: '#94a3b8' }}>{Math.round(field.conf * 100)}%</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* AI rate suggestion */}
                <div style={{ marginTop: 14, padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div className="ai-chip" style={{ marginBottom: 8 }}>✦ AI Rate Recommendation</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                    <div><span style={{ color: '#94a3b8' }}>Suggested rate:</span> <strong style={{ color: '#15803d', fontFamily: 'IBM Plex Mono, monospace' }}>$2,950</strong></div>
                    <div><span style={{ color: '#94a3b8' }}>Market band:</span> <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>$2.20–$2.70/mi</span></div>
                    <div><span style={{ color: '#94a3b8' }}>Lane miles:</span> <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>925 mi</span></div>
                    <div><span style={{ color: '#94a3b8' }}>Equipment:</span> Reefer</div>
                  </div>
                </div>

                <button
                  onClick={createQuote}
                  disabled={creating}
                  style={{ marginTop: 14, width: '100%', background: '#1d4ed8', border: '1px solid #1d4ed8', color: '#fff', borderRadius: 8, padding: '10px 14px', fontWeight: 600, fontSize: 13, cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.8 : 1 }}
                >
                  {creating ? 'Creating quotation…' : 'Create Quotation →'}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
