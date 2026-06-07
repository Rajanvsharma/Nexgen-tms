'use client';

import { useEffect, useState, useRef } from 'react';
import api from '@/lib/api';
import { useBrandingStore } from '@/store/branding.store';

interface TenantConfig {
  id: string;
  companyName: string;
  tagline: string;
  logoData: string | null;
  primaryColor: string;
  darkColor: string;
  sidebarBg: string;
  accentColor: string;
  domain: string | null;
  plan: string;
  planExpiresAt: string | null;
  contactName: string | null;
  contactEmail: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

interface FormState {
  companyName: string;
  tagline: string;
  logoData: string | null;
  primaryColor: string;
  darkColor: string;
  sidebarBg: string;
  accentColor: string;
  domain: string;
  plan: string;
  planExpiresAt: string;
  contactName: string;
  contactEmail: string;
  isDefault: boolean;
  isActive: boolean;
}

const EMPTY: FormState = {
  companyName: '',
  tagline: 'Transportation Management System',
  logoData: null,
  primaryColor: '#3b82f6',
  darkColor: '#1d4ed8',
  sidebarBg: '#0d1b2a',
  accentColor: '#22c55e',
  domain: '',
  plan: 'professional',
  planExpiresAt: '',
  contactName: '',
  contactEmail: '',
  isDefault: false,
  isActive: true,
};

const PLANS = ['starter', 'professional', 'enterprise'];

export default function BrandingPage() {
  const [tenants, setTenants] = useState<TenantConfig[]>([]);
  const [selected, setSelected] = useState<TenantConfig | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY });
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { set: setBranding } = useBrandingStore();

  async function load() {
    try {
      const { data } = await api.get('/branding/all');
      setTenants(data);
    } catch {}
  }

  useEffect(() => { load(); }, []);

  function selectTenant(t: TenantConfig) {
    setSelected(t);
    setCreating(false);
    setForm({
      companyName: t.companyName,
      tagline: t.tagline,
      logoData: t.logoData,
      primaryColor: t.primaryColor,
      darkColor: t.darkColor,
      sidebarBg: t.sidebarBg,
      accentColor: t.accentColor,
      domain: t.domain || '',
      plan: t.plan,
      planExpiresAt: t.planExpiresAt ? t.planExpiresAt.slice(0, 10) : '',
      contactName: t.contactName || '',
      contactEmail: t.contactEmail || '',
      isDefault: t.isDefault,
      isActive: t.isActive,
    });
    setMsg('');
  }

  function startNew() {
    setSelected(null);
    setCreating(true);
    setForm({ ...EMPTY });
    setMsg('');
  }

  function patch(key: keyof FormState, value: FormState[keyof FormState]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      patch('logoData', dataUrl);
    };
    reader.readAsDataURL(file);
  }

  async function save() {
    setSaving(true);
    setMsg('');
    try {
      const payload = {
        ...form,
        domain: form.domain || null,
        planExpiresAt: form.planExpiresAt || null,
        contactName: form.contactName || null,
        contactEmail: form.contactEmail || null,
      };
      let saved: TenantConfig;
      if (creating) {
        const { data } = await api.post('/branding', payload);
        saved = data;
        setCreating(false);
        setSelected(saved);
      } else if (selected) {
        const { data } = await api.put(`/branding/${selected.id}`, payload);
        saved = data;
        setSelected(saved);
      } else return;
      await load();
      setMsg('Saved successfully');
      // If this is the default, apply to the current session
      if (saved.isDefault) {
        setBranding({
          id: saved.id,
          companyName: saved.companyName,
          tagline: saved.tagline,
          logoData: saved.logoData,
          primaryColor: saved.primaryColor,
          darkColor: saved.darkColor,
          sidebarBg: saved.sidebarBg,
          accentColor: saved.accentColor,
        });
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setMsg(e?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function deleteTenant(id: string) {
    if (!confirm('Delete this tenant config?')) return;
    try {
      await api.delete(`/branding/${id}`);
      setSelected(null);
      setCreating(false);
      load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e?.response?.data?.message || 'Delete failed');
    }
  }

  const hasForm = creating || selected !== null;
  const p = form.primaryColor;

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f1f5f9', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Left: Tenant List ── */}
      <div style={{ width: 260, background: '#fff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>White Label Tenants</div>
          <button onClick={startNew} style={{ width: '100%', padding: '8px 0', background: p, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + New Tenant
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {tenants.map(t => (
            <div
              key={t.id}
              onClick={() => selectTenant(t)}
              style={{
                padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                background: selected?.id === t.id ? `${p}15` : 'transparent',
                borderLeft: selected?.id === t.id ? `3px solid ${p}` : '3px solid transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {t.logoData ? (
                  <img src={t.logoData} alt="" style={{ height: 22, maxWidth: 60, objectFit: 'contain' }} />
                ) : (
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: t.primaryColor, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    {t.companyName.charAt(0)}
                  </div>
                )}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.companyName}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>
                    {t.domain || 'no domain'} · {t.plan}
                    {t.isDefault && <span style={{ marginLeft: 4, color: t.primaryColor, fontWeight: 700 }}>DEFAULT</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {tenants.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>No tenants yet</div>
          )}
        </div>
      </div>

      {/* ── Right: Editor + Preview ── */}
      {hasForm ? (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Editor */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
                {creating ? 'New Tenant' : `Edit — ${selected?.companyName}`}
              </h1>
              <div style={{ display: 'flex', gap: 8 }}>
                {selected && !selected.isDefault && (
                  <button onClick={() => deleteTenant(selected.id)} style={{ padding: '8px 16px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Delete
                  </button>
                )}
                <button onClick={save} disabled={saving} style={{ padding: '8px 20px', background: p, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
            {msg && (
              <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: msg.includes('success') ? '#dcfce7' : '#fee2e2', color: msg.includes('success') ? '#15803d' : '#dc2626', fontSize: 13 }}>
                {msg}
              </div>
            )}

            <Section title="Company Identity">
              <Row label="Company Name">
                <input value={form.companyName} onChange={e => patch('companyName', e.target.value)} placeholder="Acme Logistics LLC" style={inputStyle} />
              </Row>
              <Row label="Tagline">
                <input value={form.tagline} onChange={e => patch('tagline', e.target.value)} style={inputStyle} />
              </Row>
              <Row label="Logo">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {form.logoData ? (
                    <img src={form.logoData} alt="logo" style={{ height: 40, maxWidth: 120, objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: 6, padding: 4 }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 6, background: form.primaryColor, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 700 }}>
                      {form.companyName.charAt(0) || '?'}
                    </div>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoFile} style={{ display: 'none' }} />
                  <button onClick={() => fileRef.current?.click()} style={{ padding: '7px 14px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
                    Upload Logo
                  </button>
                  {form.logoData && (
                    <button onClick={() => patch('logoData', null)} style={{ padding: '7px 14px', background: '#fee2e2', border: 'none', borderRadius: 8, fontSize: 12, color: '#dc2626', cursor: 'pointer' }}>
                      Remove
                    </button>
                  )}
                </div>
              </Row>
            </Section>

            <Section title="Brand Colors">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <ColorRow label="Primary Color" value={form.primaryColor} onChange={v => patch('primaryColor', v)} hint="Buttons, active nav, tags" />
                <ColorRow label="Dark Color" value={form.darkColor} onChange={v => patch('darkColor', v)} hint="Hover state, gradients" />
                <ColorRow label="Sidebar Background" value={form.sidebarBg} onChange={v => patch('sidebarBg', v)} hint="Left sidebar bg" />
                <ColorRow label="Accent Color" value={form.accentColor} onChange={v => patch('accentColor', v)} hint="Status badges, highlights" />
              </div>
            </Section>

            <Section title="Subscription & Domain">
              <Row label="Custom Domain">
                <input value={form.domain} onChange={e => patch('domain', e.target.value)} placeholder="app.acmelogistics.com" style={inputStyle} />
              </Row>
              <Row label="Plan">
                <select value={form.plan} onChange={e => patch('plan', e.target.value)} style={inputStyle}>
                  {PLANS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </Row>
              <Row label="Plan Expires">
                <input type="date" value={form.planExpiresAt} onChange={e => patch('planExpiresAt', e.target.value)} style={inputStyle} />
              </Row>
              <Row label="Contact Name">
                <input value={form.contactName} onChange={e => patch('contactName', e.target.value)} style={inputStyle} />
              </Row>
              <Row label="Contact Email">
                <input type="email" value={form.contactEmail} onChange={e => patch('contactEmail', e.target.value)} style={inputStyle} />
              </Row>
            </Section>

            <Section title="Settings">
              <div style={{ display: 'flex', gap: 24 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.isDefault} onChange={e => patch('isDefault', e.target.checked)} />
                  Set as Default Branding
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.isActive} onChange={e => patch('isActive', e.target.checked)} />
                  Active
                </label>
              </div>
            </Section>
          </div>

          {/* Preview Panel */}
          <div style={{ width: 220, background: form.sidebarBg, display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
            {/* Preview header */}
            <div style={{ padding: '10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600 }}>Preview</div>
            </div>

            {/* Logo area */}
            <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {form.logoData ? (
                <>
                  <img src={form.logoData} alt="" style={{ height: 30, maxWidth: 130, objectFit: 'contain', display: 'block' }} />
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 6, letterSpacing: '0.8px', textTransform: 'uppercase' }}>{form.tagline}</div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: `linear-gradient(135deg,${form.primaryColor},${form.darkColor})`, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                    {form.companyName.charAt(0) || 'N'}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{form.companyName || 'Company'}</div>
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginTop: 2, letterSpacing: '0.8px', textTransform: 'uppercase' }}>{form.tagline}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Nav items preview */}
            <div style={{ padding: '8px 8px', flex: 1 }}>
              {['Dashboard', 'Loads', 'CarrierQ™', 'CRM', 'Reports'].map((label, i) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', borderRadius: 6, marginBottom: 2,
                  background: i === 0 ? `${form.primaryColor}cc` : 'transparent',
                  color: i === 0 ? '#fff' : 'rgba(255,255,255,0.5)',
                  fontSize: 11,
                }}>
                  <span style={{ fontSize: 10, opacity: 0.7 }}>◎</span>
                  {label}
                </div>
              ))}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '8px 2px' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
                <span style={{ fontSize: 9, background: `${form.primaryColor}33`, color: form.primaryColor, border: `1px solid ${form.primaryColor}55`, borderRadius: 3, padding: '1px 4px', fontWeight: 700 }}>AI</span>
                AI Hub
              </div>
            </div>

            {/* Accent sample */}
            <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: form.primaryColor }} />
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: form.darkColor }} />
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: form.accentColor }} />
              </div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.6px' }}>primary · dark · accent</div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: '#94a3b8', fontSize: 14 }}>
          Select a tenant or create a new one
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
      <div style={{ width: 130, fontSize: 13, color: '#475569', flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function ColorRow({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint: string }) {
  return (
    <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          style={{ width: 36, height: 36, border: 'none', padding: 2, borderRadius: 6, cursor: 'pointer', background: 'transparent' }} />
        <input value={value} onChange={e => onChange(e.target.value)}
          style={{ flex: 1, padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, fontFamily: 'monospace' }} />
      </div>
      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 6 }}>{hint}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};
