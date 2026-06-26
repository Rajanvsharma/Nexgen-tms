'use client';

import { useState, useEffect, type ReactNode, type CSSProperties } from 'react';
import { useAuthStore, type AuthUser } from '@/store/auth.store';
import { useBrandingStore, type BrandingConfig } from '@/store/branding.store';
import { ALL_CLOCKS, loadClockPrefs, saveClockPrefs } from '@/lib/world-clocks';
import api from '@/lib/api';

type Tab = 'general' | 'brokerage' | 'profile' | 'ai-agent' | 'notifications' | 'integrations' | 'telephony' | 'security' | 'billing' | 'email' | 'api' | 'system';

// Tiny SVG icon helper
function SI({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'general',       label: 'General',       icon: <SI d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /> },
  { id: 'brokerage',     label: 'Brokerage',     icon: <SI d="M18 20V10M12 20V4M6 20v-6" /> },
  { id: 'profile',       label: 'Profile',       icon: <SI d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" /> },
  { id: 'ai-agent',      label: 'AI Agent',      icon: <SI d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /> },
  { id: 'notifications', label: 'Notifications', icon: <SI d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" /> },
  { id: 'integrations',  label: 'Integrations',  icon: <SI d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" /> },
  { id: 'telephony',     label: 'Telephony',     icon: <SI d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.63A2 2 0 012.18 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.09a16 16 0 006 6l1.06-1.06a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.26v2.66z" /> },
  { id: 'security',      label: 'Security',      icon: <SI d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /> },
  { id: 'billing',       label: 'Billing',       icon: <SI d="M2 6h20v12H2zM2 10h20" /> },
  { id: 'email',         label: 'Email (IMAP)',   icon: <SI d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6" /> },
  { id: 'api',           label: 'API Keys',       icon: <SI d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /> },
  { id: 'system',        label: 'System',         icon: <SI d="M12 15a3 3 0 100-6 3 3 0 000 6zm6.93-3a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /> },
];

// ── default notification prefs ────────────────────────────────────────────────
const DEFAULT_NOTIF = {
  loadDispatched: true,
  loadDelivered: true,
  invoiceDue: true,
  newQuote: true,
  carrierAlert: true,
  systemAnnouncements: true,
  emailParsed: false,
  aiInsights: false,
};

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const { branding } = useBrandingStore();
  const [tab, setTab] = useState<Tab>('general');
  const primary = branding.primaryColor;

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f1f5f9', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>
      {/* Left tab rail */}
      <div style={{ width: 220, background: '#fff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', padding: '20px 10px', overflowY: 'auto' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.5px', marginBottom: 6, paddingLeft: 10 }}>Configure account and preferences</div>
        <div style={{ height: 1, background: '#f1f5f9', margin: '8px 4px 10px' }} />
        {TABS.filter(t => t.id !== 'system' || user?.role === 'ADMIN').map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
            background: tab === t.id ? '#e6f7f2' : 'transparent',
            color: tab === t.id ? '#0d9488' : '#475569',
            fontWeight: tab === t.id ? 600 : 400,
            fontSize: 13.5,
            marginBottom: 2,
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => { if (tab !== t.id) (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }}
          onMouseLeave={e => { if (tab !== t.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <span style={{ color: tab === t.id ? '#0d9488' : '#94a3b8', display: 'flex', flexShrink: 0 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
        {tab === 'general'       && <GeneralTab primary={primary} />}
        {tab === 'brokerage'     && <BrokerageTab primary={primary} />}
        {tab === 'profile'       && <ProfileTab user={user} setUser={setUser} primary={primary} />}
        {tab === 'ai-agent'      && <AiAgentTab primary={primary} />}
        {tab === 'notifications' && <NotificationsTab primary={primary} />}
        {tab === 'integrations'  && <ApiTab primary={primary} />}
        {tab === 'telephony'     && <TelephonyTab primary={primary} />}
        {tab === 'security'      && <SecurityTab primary={primary} />}
        {tab === 'billing'       && <BillingTab primary={primary} />}
        {tab === 'email'         && <EmailTab primary={primary} />}
        {tab === 'api'           && <ApiTab primary={primary} />}
        {tab === 'system'        && <SystemTab primary={primary} branding={branding} />}
      </div>
    </div>
  );
}

// ─── General Tab ─────────────────────────────────────────────────────────────
function GeneralTab({ primary }: { primary: string }) {
  const [form, setForm] = useState({
    companyName: '', phone: '',
    startTime: '08:00', endTime: '18:00', timezone: 'America/Chicago', workingDays: 'Mon-Fri',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [enabledClocks, setEnabledClocks] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('general_settings');
    if (stored) try { setForm(JSON.parse(stored)); } catch {}
    setEnabledClocks(loadClockPrefs());
  }, []);

  function save() {
    setSaving(true);
    setTimeout(() => {
      localStorage.setItem('general_settings', JSON.stringify(form));
      saveClockPrefs(enabledClocks);
      setMsg({ type: 'ok', text: 'Settings saved.' });
      setSaving(false);
      setTimeout(() => setMsg(null), 2500);
    }, 400);
  }

  function toggleClock(tz: string) {
    setEnabledClocks(prev => {
      if (prev.includes(tz)) return prev.filter(t => t !== tz);
      if (prev.length >= 5) return prev; // max 5
      return [...prev, tz];
    });
  }

  const TIMEZONES = ['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Phoenix','UTC'];
  const WORKING_DAYS = ['Mon-Fri','Mon-Sat','Mon-Sun','Tue-Sat'];

  return (
    <div style={{ maxWidth: 720 }}>
      {msg && <Alert type={msg.type} text={msg.text} />}

      <SectionCard
        icon={<SI d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />}
        iconColor="#f59e0b"
        title="Company"
        subtitle="Your organization details"
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="COMPANY NAME">
            <input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} style={inp} placeholder="NexGen TMS Inc." />
          </Field>
          <Field label="PHONE">
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={inp} placeholder="+1 (555) 000-0000" />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        icon={<SI d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />}
        iconColor="#3b82f6"
        title="Business hours"
        subtitle="When Alex can make calls"
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <Field label="START TIME">
            <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} style={inp} />
          </Field>
          <Field label="END TIME">
            <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} style={inp} />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="TIMEZONE">
            <select value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </Field>
          <Field label="WORKING DAYS">
            <select value={form.workingDays} onChange={e => setForm(f => ({ ...f, workingDays: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}>
              {WORKING_DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
        </div>
      </SectionCard>

      {/* ── World Clocks ── */}
      <SectionCard
        icon={<SI d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2" />}
        iconColor="#8b5cf6"
        title="World Clocks on Dashboard"
        subtitle={`Select up to 5 clocks to show on your dashboard — ${enabledClocks.length}/5 selected`}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {ALL_CLOCKS.map(c => {
            const on = enabledClocks.includes(c.tz);
            const atMax = enabledClocks.length >= 5 && !on;
            return (
              <button
                key={c.tz}
                onClick={() => toggleClock(c.tz)}
                disabled={atMax}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', borderRadius: 10, cursor: atMax ? 'not-allowed' : 'pointer',
                  border: `1.5px solid ${on ? '#8b5cf6' : '#e2e8f0'}`,
                  background: on ? '#f5f3ff' : '#fff',
                  opacity: atMax ? 0.45 : 1,
                  textAlign: 'left', transition: 'all 0.12s',
                }}
              >
                <span style={{ fontSize: 20, flexShrink: 0 }}>{c.flag}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: on ? '#7c3aed' : '#334155' }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{c.sub}</div>
                </div>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${on ? '#8b5cf6' : '#cbd5e1'}`,
                  background: on ? '#8b5cf6' : '#fff',
                  display: 'grid', placeItems: 'center',
                }}>
                  {on && <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
              </button>
            );
          })}
        </div>
        {enabledClocks.length >= 5 && (
          <div style={{ marginTop: 12, fontSize: 12, color: '#f59e0b', fontWeight: 500 }}>
            ⚠ Maximum 5 clocks selected. Deselect one to add another.
          </div>
        )}
      </SectionCard>

      <SaveBtn onClick={save} loading={saving} primary={primary} label="Save Changes" />
    </div>
  );
}

// ─── Brokerage Tab ────────────────────────────────────────────────────────────
function BrokerageTab({ primary }: { primary: string }) {
  const [form, setForm] = useState({
    legalName: '', contactEmail: '', brokerMC: '', dot: '',
    streetAddress: '', city: '', state: '', zip: '',
    website: '', linkedin: '', facebook: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('brokerage_settings');
    if (stored) try { setForm(JSON.parse(stored)); } catch {}
  }, []);

  function save() {
    setSaving(true);
    setTimeout(() => {
      localStorage.setItem('brokerage_settings', JSON.stringify(form));
      setMsg({ type: 'ok', text: 'Brokerage info saved.' });
      setSaving(false);
      setTimeout(() => setMsg(null), 2500);
    }, 400);
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div style={{ maxWidth: 720 }}>
      {msg && <Alert type={msg.type} text={msg.text} />}

      <SectionCard
        icon={<SI d="M18 20V10M12 20V4M6 20v-6" />}
        iconColor="#0d9488"
        title="Brokerage Identity"
        subtitle="Shown on Rate Confirmations and customer documents"
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <Field label="LEGAL NAME">
            <input value={form.legalName} onChange={f('legalName')} style={inp} placeholder="ABC Brokerage LLC" />
          </Field>
          <Field label="CONTACT EMAIL">
            <input type="email" value={form.contactEmail} onChange={f('contactEmail')} style={inp} placeholder="ops@company.com" />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="BROKER MC #">
            <input value={form.brokerMC} onChange={f('brokerMC')} style={inp} placeholder="MC-123456" />
          </Field>
          <Field label="DOT #">
            <input value={form.dot} onChange={f('dot')} style={inp} placeholder="1234567" />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        icon={<SI d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />}
        iconColor="#6366f1"
        title="Billing Address"
        subtitle="Used on invoices and rate confirmations"
      >
        <Field label="STREET ADDRESS">
          <input value={form.streetAddress} onChange={f('streetAddress')} style={inp} placeholder="123 Main St, Suite 100" />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16, marginTop: 16 }}>
          <Field label="CITY">
            <input value={form.city} onChange={f('city')} style={inp} placeholder="Chicago" />
          </Field>
          <Field label="STATE">
            <input value={form.state} onChange={f('state')} style={inp} placeholder="IL" maxLength={2} />
          </Field>
          <Field label="ZIP">
            <input value={form.zip} onChange={f('zip')} style={inp} placeholder="60601" />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        icon={<SI d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />}
        iconColor="#8b5cf6"
        title="Web Presence"
        subtitle="Optional public links"
      >
        <Field label="WEBSITE">
          <input value={form.website} onChange={f('website')} style={inp} placeholder="https://www.yourcompany.com" />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          <Field label="LINKEDIN">
            <input value={form.linkedin} onChange={f('linkedin')} style={inp} placeholder="https://linkedin.com/company/..." />
          </Field>
          <Field label="FACEBOOK">
            <input value={form.facebook} onChange={f('facebook')} style={inp} placeholder="https://facebook.com/..." />
          </Field>
        </div>
      </SectionCard>

      <SaveBtn onClick={save} loading={saving} primary={primary} label="Save Brokerage Info" />
    </div>
  );
}

// ─── AI Agent Tab ─────────────────────────────────────────────────────────────
const ANTHROPIC_MODELS = [
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Fastest · Cheapest)' },
  { value: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6 (Balanced)' },
  { value: 'claude-opus-4-8',           label: 'Claude Opus 4.8 (Most Capable)' },
];
const OPENAI_MODELS = [
  { value: 'gpt-4o-mini',  label: 'GPT-4o Mini (Fastest · Cheapest)' },
  { value: 'gpt-4o',       label: 'GPT-4o (Balanced)' },
  { value: 'gpt-4-turbo',  label: 'GPT-4 Turbo (Most Capable)' },
];

function AiAgentTab({ primary }: { primary: string }) {
  const [provider, setProvider] = useState<'anthropic' | 'openai'>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('claude-haiku-4-5-20251001');
  const [showKey, setShowKey] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [agentForm, setAgentForm] = useState({ agentName: 'Alex', autoNegotiate: true, autoParseEmail: true, copilotEnabled: true });

  useEffect(() => {
    api.get('/organization/ai-config').then(r => {
      setProvider(r.data.aiProvider || 'anthropic');
      setModel(r.data.aiModel || (r.data.aiProvider === 'openai' ? 'gpt-4o-mini' : 'claude-haiku-4-5-20251001'));
      setHasKey(!!r.data.hasApiKey);
    }).catch(() => {});
    const stored = localStorage.getItem('ai_agent_settings');
    if (stored) try { setAgentForm(JSON.parse(stored)); } catch {}
  }, []);

  function onProviderChange(p: 'anthropic' | 'openai') {
    setProvider(p);
    setModel(p === 'openai' ? 'gpt-4o-mini' : 'claude-haiku-4-5-20251001');
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await api.post('/organization/ai-config', { aiProvider: provider, aiApiKey: apiKey || undefined, aiModel: model });
      localStorage.setItem('ai_agent_settings', JSON.stringify(agentForm));
      setMsg({ type: 'ok', text: 'AI settings saved successfully.' });
      if (apiKey) { setHasKey(true); setApiKey(''); }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setMsg({ type: 'err', text: err.response?.data?.message || 'Failed to save.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  async function testConnection() {
    setTesting(true);
    setMsg(null);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const { getAccessToken } = await import('@/lib/api');
      const res = await fetch(`${apiBase}/api/copilot/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAccessToken() || ''}` },
        credentials: 'include',
        body: JSON.stringify({ messages: [{ role: 'user', content: 'Say "Connection OK" and nothing else.' }] }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.message); }
      setMsg({ type: 'ok', text: 'Connection successful — AI Copilot is working.' });
    } catch (e: unknown) {
      const err = e as Error;
      setMsg({ type: 'err', text: err.message || 'Connection failed.' });
    } finally {
      setTesting(false);
      setTimeout(() => setMsg(null), 5000);
    }
  }

  const models = provider === 'openai' ? OPENAI_MODELS : ANTHROPIC_MODELS;

  return (
    <div style={{ maxWidth: 640 }}>
      <PageHeader title="AI Agent" subtitle="Configure the AI powering your Copilot" />
      {msg && <Alert type={msg.type} text={msg.text} />}

      {/* ── Provider ── */}
      <SectionCard icon={<SI d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />} iconColor="#6366f1" title="AI Provider" subtitle="Choose which AI model powers your Copilot">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {([
            { id: 'anthropic', name: 'Anthropic', desc: 'Claude models — best reasoning', emoji: '🤖', accent: '#7c3aed' },
            { id: 'openai',    name: 'OpenAI',    desc: 'GPT models — widely used',       emoji: '⚡', accent: '#059669' },
          ] as const).map(p => (
            <button
              key={p.id}
              onClick={() => onProviderChange(p.id)}
              style={{
                padding: '14px 16px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                border: `2px solid ${provider === p.id ? p.accent : '#e2e8f0'}`,
                background: provider === p.id ? `${p.accent}0d` : '#fff',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 4 }}>{p.emoji}</div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{p.name}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{p.desc}</div>
            </button>
          ))}
        </div>

        <Field label="MODEL">
          <select value={model} onChange={e => setModel(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
            {models.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </Field>
      </SectionCard>

      {/* ── API Key ── */}
      <SectionCard icon={<SI d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />} iconColor="#f59e0b" title="API Key" subtitle={hasKey ? 'A key is saved — enter a new one to replace it' : 'Paste your API key to enable the Copilot'}>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#475569' }}>
          {provider === 'anthropic'
            ? <>Get your key at <strong>console.anthropic.com</strong> → API Keys</>
            : <>Get your key at <strong>platform.openai.com</strong> → API Keys</>
          }
        </div>
        <Field label={`${provider === 'anthropic' ? 'ANTHROPIC' : 'OPENAI'} API KEY`}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={hasKey ? '••••••••  (leave blank to keep current)' : `sk-${provider === 'openai' ? '' : 'ant-'}...`}
              style={{ ...inp, flex: 1, fontFamily: 'monospace', fontSize: 12 }}
            />
            <button
              onClick={() => setShowKey(s => !s)}
              style={{ padding: '0 12px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', cursor: 'pointer', fontSize: 13, color: '#64748b', flexShrink: 0 }}
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </Field>
        {hasKey && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: '#059669' }}>
            <span>✓</span> API key is configured
          </div>
        )}
      </SectionCard>

      {/* ── Capabilities ── */}
      <SectionCard icon={<SI d="M12 15a3 3 0 100-6 3 3 0 000 6z" />} iconColor="#3b82f6" title="Capabilities" subtitle="Toggle AI features on or off">
        {([
          ['autoNegotiate',  'Voice / Rate Negotiation',  'AI negotiates carrier rates automatically'],
          ['autoParseEmail', 'Email Auto-Parsing',         'Parse incoming shipper emails into loads'],
          ['copilotEnabled', 'Copilot Sidebar',            'Show AI chat panel across all pages'],
        ] as [keyof typeof agentForm, string, string][]).map(([key, label, desc]) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: '#0f172a' }}>{label}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{desc}</div>
            </div>
            <Toggle on={!!agentForm[key]} onChange={() => setAgentForm(f => ({ ...f, [key]: !f[key] }))} primary={primary} />
          </div>
        ))}
      </SectionCard>

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <SaveBtn onClick={save} loading={saving} primary={primary} label="Save AI Settings" />
        <button
          onClick={testConnection}
          disabled={testing || !hasKey}
          style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: hasKey ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 500, color: hasKey ? '#475569' : '#cbd5e1', opacity: hasKey ? 1 : 0.6 }}
        >
          {testing ? 'Testing…' : 'Test Connection'}
        </button>
      </div>
    </div>
  );
}

// ─── Telephony Tab ────────────────────────────────────────────────────────────
function TelephonyTab({ primary }: { primary: string }) {
  const [form, setForm] = useState({ twilioSid: '', twilioToken: '', twilioPhone: '', callRecording: true, voicemail: true });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('telephony_settings');
    if (stored) try { setForm(JSON.parse(stored)); } catch {}
  }, []);

  function save() {
    setSaving(true);
    setTimeout(() => {
      localStorage.setItem('telephony_settings', JSON.stringify(form));
      setMsg({ type: 'ok', text: 'Telephony settings saved.' });
      setSaving(false);
      setTimeout(() => setMsg(null), 2500);
    }, 400);
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <PageHeader title="Telephony" subtitle="Configure calling and voicemail via Twilio" />
      {msg && <Alert type={msg.type} text={msg.text} />}

      <SectionCard icon={<SI d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.63A2 2 0 012.18 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.09a16 16 0 006 6l1.06-1.06a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.26v2.66z" />} iconColor="#0d9488" title="Twilio Credentials" subtitle="Required for AI voice calls and SMS">
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#1e40af' }}>
          💡 Get credentials at console.twilio.com — add a verified phone number to make/receive calls.
        </div>
        <Field label="ACCOUNT SID">
          <input value={form.twilioSid} onChange={e => setForm(f => ({ ...f, twilioSid: e.target.value }))} style={inp} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
        </Field>
        <Field label="AUTH TOKEN">
          <input type="password" value={form.twilioToken} onChange={e => setForm(f => ({ ...f, twilioToken: e.target.value }))} style={inp} placeholder="••••••••••••••••••••••••••••••••" />
        </Field>
        <Field label="TWILIO PHONE NUMBER">
          <input value={form.twilioPhone} onChange={e => setForm(f => ({ ...f, twilioPhone: e.target.value }))} style={inp} placeholder="+15550001234" />
        </Field>
      </SectionCard>

      <SectionCard icon={<SI d="M12 15a3 3 0 100-6 3 3 0 000 6z" />} iconColor="#6366f1" title="Call Settings" subtitle="Behavior for inbound and outbound calls">
        {([
          ['callRecording', 'Call Recording',  'Record all calls for compliance and review'],
          ['voicemail',     'Voicemail',        'Enable AI-powered voicemail transcription'],
        ] as [keyof typeof form, string, string][]).map(([key, label, desc]) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: '#0f172a' }}>{label}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{desc}</div>
            </div>
            <Toggle on={!!form[key]} onChange={() => setForm(f => ({ ...f, [key]: !f[key] }))} primary={primary} />
          </div>
        ))}
      </SectionCard>

      <SaveBtn onClick={save} loading={saving} primary={primary} label="Save Telephony" />
    </div>
  );
}

// ─── Section Card (used by new tabs) ─────────────────────────────────────────
function SectionCard({ icon, iconColor, title, subtitle, children }: {
  icon: ReactNode; iconColor: string; title: string; subtitle: string; children: ReactNode;
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 28, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 22 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${iconColor}18`, display: 'grid', placeItems: 'center', color: iconColor, flexShrink: 0 }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{title}</div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>{subtitle}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────
function ProfileTab({ user, setUser, primary }: { user: AuthUser | null; setUser: (u: AuthUser | null, token?: string) => void; primary: string }) {
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName,  setLastName]  = useState(user?.lastName  || '');
  const [curPwd,    setCurPwd]    = useState('');
  const [newPwd,    setNewPwd]    = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function saveProfile() {
    setSaving(true); setMsg(null);
    try {
      const { data } = await api.patch('/auth/me', { firstName, lastName });
      setUser({ ...user!, firstName: data.firstName, lastName: data.lastName });
      setMsg({ type: 'ok', text: 'Profile updated.' });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setMsg({ type: 'err', text: err?.response?.data?.message || 'Save failed' });
    } finally { setSaving(false); }
  }

  async function changePassword() {
    if (newPwd !== confirmPwd) { setMsg({ type: 'err', text: 'Passwords do not match' }); return; }
    if (newPwd.length < 8)    { setMsg({ type: 'err', text: 'Password must be at least 8 characters' }); return; }
    setSaving(true); setMsg(null);
    try {
      await api.patch('/auth/me', { currentPassword: curPwd, newPassword: newPwd });
      setCurPwd(''); setNewPwd(''); setConfirmPwd('');
      setMsg({ type: 'ok', text: 'Password changed successfully.' });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setMsg({ type: 'err', text: err?.response?.data?.message || 'Failed to change password' });
    } finally { setSaving(false); }
  }

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}` : 'U';

  return (
    <div style={{ maxWidth: 560 }}>
      <PageHeader title="Profile" subtitle="Update your name and password" />
      {msg && <Alert type={msg.type} text={msg.text} />}

      <Card title="Personal Information">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: `linear-gradient(135deg,${primary},#1e3a8a)`, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 20, fontWeight: 700 }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{user?.firstName} {user?.lastName}</div>
            <div style={{ fontSize: 13, color: '#64748b' }}>{user?.email}</div>
            <span style={{ fontSize: 10, fontWeight: 700, background: `${primary}18`, color: primary, border: `1px solid ${primary}33`, borderRadius: 20, padding: '2px 8px' }}>{user?.role}</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          <Field label="First Name">
            <input value={firstName} onChange={e => setFirstName(e.target.value)} style={inp} />
          </Field>
          <Field label="Last Name">
            <input value={lastName} onChange={e => setLastName(e.target.value)} style={inp} />
          </Field>
        </div>
        <Field label="Email Address">
          <input value={user?.email || ''} disabled style={{ ...inp, background: '#f8fafc', color: '#94a3b8' }} />
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Contact your admin to change your email.</div>
        </Field>
        <SaveBtn onClick={saveProfile} loading={saving} primary={primary} label="Save Profile" />
      </Card>

      <Card title="Change Password">
        <Field label="Current Password">
          <input type="password" value={curPwd} onChange={e => setCurPwd(e.target.value)} style={inp} placeholder="••••••••" />
        </Field>
        <Field label="New Password">
          <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} style={inp} placeholder="Min. 8 characters" />
        </Field>
        <Field label="Confirm New Password">
          <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} style={inp} placeholder="Re-enter new password" />
        </Field>
        <SaveBtn onClick={changePassword} loading={saving} primary={primary} label="Change Password" />
      </Card>
    </div>
  );
}

// ─── Email Tab ────────────────────────────────────────────────────────────────
function EmailTab({ primary }: { primary: string }) {
  const [cfg, setCfg] = useState({ host: '', port: '993', username: '', password: '', folder: 'INBOX', isActive: true });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    api.get('/email/config').then(({ data }) => {
      if (data) setCfg({ host: data.host, port: String(data.port), username: data.username, password: data.password, folder: data.folder, isActive: data.isActive });
    }).catch(() => {});
  }, []);

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const { data } = await api.post('/email/config', { ...cfg, port: parseInt(cfg.port) });
      setCfg(c => ({ ...c, password: data.password }));
      setMsg({ type: 'ok', text: 'Email config saved.' });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setMsg({ type: 'err', text: err?.response?.data?.message || 'Save failed' });
    } finally { setSaving(false); }
  }

  async function testPoll() {
    setTesting(true); setMsg(null);
    try {
      const { data } = await api.post('/email/poll');
      setMsg({ type: 'ok', text: data.message });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setMsg({ type: 'err', text: err?.response?.data?.message || 'Connection failed' });
    } finally { setTesting(false); }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <PageHeader title="Email Integration" subtitle="Connect your inbox to auto-parse quote requests" />
      {msg && <Alert type={msg.type} text={msg.text} />}
      <Card title="IMAP Configuration">
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12, color: '#1e40af' }}>
          💡 Use IMAP credentials from Gmail, Outlook, or any provider. Enable &quot;App Passwords&quot; if using 2FA.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, marginBottom: 14 }}>
          <Field label="IMAP Host">
            <input value={cfg.host} onChange={e => setCfg(c => ({ ...c, host: e.target.value }))} style={inp} placeholder="imap.gmail.com" />
          </Field>
          <Field label="Port">
            <input value={cfg.port} onChange={e => setCfg(c => ({ ...c, port: e.target.value }))} style={{ ...inp, width: 80 }} />
          </Field>
        </div>
        <Field label="Username / Email">
          <input value={cfg.username} onChange={e => setCfg(c => ({ ...c, username: e.target.value }))} style={inp} placeholder="you@company.com" />
        </Field>
        <Field label="App Password">
          <input type="password" value={cfg.password} onChange={e => setCfg(c => ({ ...c, password: e.target.value }))} style={inp} placeholder="••••••••" />
        </Field>
        <Field label="Folder">
          <input value={cfg.folder} onChange={e => setCfg(c => ({ ...c, folder: e.target.value }))} style={inp} />
        </Field>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <SaveBtn onClick={save} loading={saving} primary={primary} label="Save Config" />
          <button onClick={testPoll} disabled={testing} style={{ padding: '9px 18px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#475569' }}>
            {testing ? 'Testing…' : '⚡ Test & Poll Inbox'}
          </button>
        </div>
      </Card>
    </div>
  );
}

// ─── Notifications Tab ────────────────────────────────────────────────────────
const NOTIF_LABELS: Record<keyof typeof DEFAULT_NOTIF, string> = {
  loadDispatched:      'Load dispatched',
  loadDelivered:       'Load delivered',
  invoiceDue:          'Invoice overdue alert',
  newQuote:            'New quote received',
  carrierAlert:        'Carrier compliance alert',
  systemAnnouncements: 'System announcements',
  emailParsed:         'Email parsed to quote',
  aiInsights:          'AI insights & tips',
};

function NotificationsTab({ primary }: { primary: string }) {
  const [prefs, setPrefs] = useState<typeof DEFAULT_NOTIF>({ ...DEFAULT_NOTIF });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('notif_prefs');
      if (stored) setPrefs(JSON.parse(stored));
    } catch {}
  }, []);

  function toggle(key: keyof typeof DEFAULT_NOTIF) {
    setPrefs(p => ({ ...p, [key]: !p[key] }));
    setSaved(false);
  }

  function save() {
    localStorage.setItem('notif_prefs', JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <PageHeader title="Notifications" subtitle="Choose which events trigger alerts" />
      <Card title="Alert Preferences">
        {(Object.keys(prefs) as (keyof typeof DEFAULT_NOTIF)[]).map(key => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: 13.5, color: '#334155' }}>{NOTIF_LABELS[key]}</span>
            <Toggle on={prefs[key]} onChange={() => toggle(key)} primary={primary} />
          </div>
        ))}
        <div style={{ marginTop: 20 }}>
          <SaveBtn onClick={save} loading={false} primary={primary} label={saved ? '✓ Saved' : 'Save Preferences'} />
        </div>
      </Card>
    </div>
  );
}

// ─── API Keys Tab ─────────────────────────────────────────────────────────────
function ApiTab({ primary }: { primary: string }) {
  const [status, setStatus] = useState<'checking' | 'live' | 'demo'>('checking');

  useEffect(() => {
    api.post('/ai/negotiate', {
      messages: [{ role: 'user', content: 'ping' }],
      load: { id: 'test', loadNumber: 'T-001', pickupCity: 'X', pickupState: 'X', deliveryCity: 'Y', deliveryState: 'Y', equipment: 'V', customerRate: 1000 },
    }).then(() => setStatus('live')).catch(err => {
      const body = err?.response?.data;
      setStatus(body?.demo ? 'demo' : 'live');
    });
  }, []);

  return (
    <div style={{ maxWidth: 560 }}>
      <PageHeader title="API Keys" subtitle="Manage third-party integrations" />
      <Card title="Anthropic Claude AI">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fef3c7', display: 'grid', placeItems: 'center', fontSize: 20 }}>🤖</div>
          <div>
            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 14 }}>Claude AI (Haiku)</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Powers AI Intake, Voice Negotiation, Email Parsing, Copilot</div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            {status === 'checking' && <StatusBadge color="#94a3b8" label="Checking…" />}
            {status === 'live'     && <StatusBadge color="#22c55e" label="● Connected" />}
            {status === 'demo'     && <StatusBadge color="#f59e0b" label="⚠ Demo Mode" />}
          </div>
        </div>
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 14px', fontFamily: 'monospace', fontSize: 12, color: '#475569', border: '1px solid #e2e8f0' }}>
          <div style={{ marginBottom: 6, fontWeight: 700, color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>backend/.env</div>
          ANTHROPIC_API_KEY=sk-ant-api03-...
        </div>
        {status === 'demo' && (
          <div style={{ marginTop: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e' }}>
            Running in demo mode. Add your Anthropic API key to the backend .env file and restart the server to enable live AI features.
          </div>
        )}
      </Card>

      <Card title="Load Board Integrations">
        {[
          { name: 'DAT Load Board',     icon: '🚛', status: 'Not configured' },
          { name: 'Truckstop.com',       icon: '⛽', status: 'Not configured' },
          { name: 'ITS Dispatch',        icon: '📡', status: 'Not configured' },
        ].map(item => (
          <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{item.name}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>{item.status}</div>
            </div>
            <button style={{ padding: '5px 12px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#475569' }}>
              Configure
            </button>
          </div>
        ))}
        <div style={{ marginTop: 12, fontSize: 12, color: '#94a3b8' }}>Load board API keys are set in backend/.env. Contact support for setup assistance.</div>
      </Card>
    </div>
  );
}

// ─── System Tab (ADMIN only) ──────────────────────────────────────────────────
function SystemTab({ primary, branding }: { primary: string; branding: BrandingConfig }) {
  return (
    <div style={{ maxWidth: 560 }}>
      <PageHeader title="System" subtitle="Platform info and advanced settings" />

      <Card title="Current Branding">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          {branding.logoData ? (
            <img src={branding.logoData} alt="" style={{ height: 36, maxWidth: 100, objectFit: 'contain' }} />
          ) : (
            <div style={{ width: 36, height: 36, borderRadius: 8, background: primary, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700 }}>
              {branding.companyName.charAt(0)}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 700, color: '#0f172a' }}>{branding.companyName}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{branding.tagline}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {[branding.primaryColor, branding.darkColor, branding.sidebarBg, branding.accentColor].map((c, i) => (
            <div key={i} style={{ flex: 1, height: 24, borderRadius: 6, background: c, border: '1px solid rgba(0,0,0,0.08)' }} title={c} />
          ))}
        </div>
        <a href="/branding" style={{ display: 'inline-block', marginTop: 8, padding: '8px 16px', background: primary, color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
          Manage White Label →
        </a>
      </Card>

      <Card title="Platform Info">
        {[
          ['Version',     'Transa v2.0'],
          ['Environment', process.env.NODE_ENV || 'development'],
          ['API Base',    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'],
          ['Plan',        branding.plan],
        ].map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
            <span style={{ color: '#64748b' }}>{label}</span>
            <span style={{ fontWeight: 600, color: '#0f172a', fontFamily: 'monospace' }}>{value}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────────────

function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{title}</h1>
      <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>{subtitle}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 18 }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

function SaveBtn({ onClick, loading, primary, label }: { onClick: () => void; loading: boolean; primary: string; label: string }) {
  return (
    <button onClick={onClick} disabled={loading} style={{ padding: '9px 22px', background: primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
      {loading ? 'Saving…' : label}
    </button>
  );
}

function Alert({ type, text }: { type: 'ok' | 'err'; text: string }) {
  return (
    <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: type === 'ok' ? '#dcfce7' : '#fee2e2', color: type === 'ok' ? '#15803d' : '#dc2626', fontSize: 13 }}>
      {text}
    </div>
  );
}

function StatusBadge({ color, label }: { color: string; label: string }) {
  return <span style={{ fontSize: 12, fontWeight: 600, color, padding: '4px 10px', background: `${color}18`, borderRadius: 20, border: `1px solid ${color}40` }}>{label}</span>;
}

function Toggle({ on, onChange, primary }: { on: boolean; onChange: () => void; primary: string }) {
  return (
    <button onClick={onChange} style={{
      width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
      background: on ? primary : '#cbd5e1', position: 'relative', transition: 'background 0.2s',
    }}>
      <span style={{
        position: 'absolute', top: 3, left: on ? 20 : 3, width: 18, height: 18,
        borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transition: 'left 0.2s',
      }} />
    </button>
  );
}

const inp: CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0',
  borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box',
  background: '#fff',
};

// ─── Billing Tab ─────────────────────────────────────────────────────────────
function BillingTab({ primary }: { primary: string }) {
  const [org, setOrg] = useState<{
    name: string; plan: string; subscriptionStatus: string; trialEndsAt: string | null;
    maxUsers: number; maxLoadsPerMonth: number; usage: { users: number; loadsThisMonth: number };
  } | null>(null);
  const [plans, setPlans] = useState<{ id: string; name: string; price: number; features: string[]; recommended?: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/organization'), api.get('/stripe/plans')])
      .then(([orgRes, plansRes]) => { setOrg(orgRes.data); setPlans(plansRes.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const daysLeft = org?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(org.trialEndsAt).getTime() - Date.now()) / 86400000))
    : null;

  async function checkout(planId: string) {
    setUpgrading(planId);
    try {
      const { data } = await api.post('/stripe/checkout', { planId });
      if (data.url) window.location.href = data.url;
      else alert('Stripe not configured. Add STRIPE_SECRET_KEY to backend .env');
    } catch { alert('Billing unavailable. Contact support.'); }
    finally { setUpgrading(''); }
  }

  async function openPortal() {
    setPortalLoading(true);
    try {
      const { data } = await api.post('/stripe/portal');
      if (data.url) window.open(data.url, '_blank');
    } catch { alert('No active subscription found.'); }
    finally { setPortalLoading(false); }
  }

  const statusColor = org?.subscriptionStatus === 'active' ? '#15803d' : org?.subscriptionStatus === 'trialing' ? '#1e40af' : '#dc2626';
  const statusBg = org?.subscriptionStatus === 'active' ? '#dcfce7' : org?.subscriptionStatus === 'trialing' ? '#eff6ff' : '#fee2e2';

  return (
    <div style={{ maxWidth: 620 }}>
      <PageHeader title="Billing & Plan" subtitle="Manage your subscription and usage" />

      {loading ? <p style={{ color: '#94a3b8', fontSize: 13 }}>Loading…</p> : org && (
        <>
          {/* Current plan card */}
          <Card title="Current Plan">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', textTransform: 'capitalize' }}>{org.plan} Plan</div>
                <span style={{ fontSize: 12, fontWeight: 700, background: statusBg, color: statusColor, padding: '3px 10px', borderRadius: 20, marginTop: 4, display: 'inline-block' }}>
                  {org.subscriptionStatus === 'trialing' ? `Trial — ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left` : org.subscriptionStatus}
                </span>
              </div>
              {org.subscriptionStatus === 'active' && (
                <button onClick={openPortal} disabled={portalLoading} style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#475569' }}>
                  {portalLoading ? 'Loading…' : 'Manage Billing →'}
                </button>
              )}
            </div>

            {/* Usage */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Users', used: org.usage.users, max: org.maxUsers },
                { label: 'Loads this month', used: org.usage.loadsThisMonth, max: org.maxLoadsPerMonth },
              ].map(({ label, used, max }) => {
                const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
                const warn = pct >= 80;
                return (
                  <div key={label} style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: warn ? '#dc2626' : '#0f172a' }}>{used} / {max === 9999 || max === 999999 ? '∞' : max}</span>
                    </div>
                    <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3 }}>
                      <div style={{ height: 6, width: `${pct}%`, background: warn ? '#dc2626' : primary, borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Plan cards */}
          {org.subscriptionStatus !== 'active' && (
            <Card title="Upgrade Your Plan">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                {plans.map(plan => (
                  <div key={plan.id} style={{
                    borderRadius: 12, border: plan.recommended ? `2px solid ${primary}` : '1px solid #e2e8f0',
                    padding: '20px 16px', position: 'relative', background: plan.recommended ? '#eff6ff' : '#fff',
                  }}>
                    {plan.recommended && (
                      <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: primary, color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
                        POPULAR
                      </div>
                    )}
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{plan.name}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: primary, marginBottom: 12 }}>${plan.price}<span style={{ fontSize: 13, fontWeight: 400, color: '#64748b' }}>/mo</span></div>
                    {plan.features.map(f => (
                      <div key={f} style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>✓ {f}</div>
                    ))}
                    <button
                      onClick={() => checkout(plan.id)}
                      disabled={upgrading === plan.id}
                      style={{
                        marginTop: 16, width: '100%', padding: '9px', background: plan.recommended ? primary : '#f1f5f9',
                        color: plan.recommended ? '#fff' : '#0f172a', border: 'none', borderRadius: 8,
                        fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: upgrading === plan.id ? 0.7 : 1,
                      }}
                    >
                      {upgrading === plan.id ? 'Loading…' : 'Choose Plan'}
                    </button>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 12, textAlign: 'center' }}>
                All plans include a 14-day trial. Cancel anytime. Prices in USD.
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── Security / 2FA Tab ───────────────────────────────────────────────────────
function SecurityTab({ primary }: { primary: string }) {
  const [status, setStatus] = useState<'loading' | 'enabled' | 'disabled'>('loading');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [step, setStep] = useState<'idle' | 'setup' | 'disabling'>('idle');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/auth/2fa/status').then(r => setStatus(r.data.enabled ? 'enabled' : 'disabled')).catch(() => setStatus('disabled'));
  }, []);

  async function startSetup() {
    setLoading(true); setMsg(null);
    try {
      const { data } = await api.post('/auth/2fa/setup');
      setQrCode(data.qrCode); setSecret(data.secret); setStep('setup');
    } catch (e: unknown) {
      setMsg({ type: 'err', text: (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to start 2FA setup' });
    } finally { setLoading(false); }
  }

  async function verifyCode() {
    if (!code.trim()) { setMsg({ type: 'err', text: 'Enter the 6-digit code from your app' }); return; }
    setLoading(true); setMsg(null);
    try {
      await api.post('/auth/2fa/verify', { code });
      setStatus('enabled'); setStep('idle'); setQrCode(''); setSecret(''); setCode('');
      setMsg({ type: 'ok', text: '2FA enabled! You will need your authenticator app on every login.' });
    } catch (e: unknown) {
      setMsg({ type: 'err', text: (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Invalid code' });
    } finally { setLoading(false); }
  }

  async function disable2FA() {
    if (!code.trim()) { setMsg({ type: 'err', text: 'Enter your current 2FA code to disable' }); return; }
    setLoading(true); setMsg(null);
    try {
      await api.post('/auth/2fa/disable', { code });
      setStatus('disabled'); setStep('idle'); setCode('');
      setMsg({ type: 'ok', text: '2FA disabled.' });
    } catch (e: unknown) {
      setMsg({ type: 'err', text: (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Invalid code' });
    } finally { setLoading(false); }
  }

  const card: CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24, marginBottom: 20, maxWidth: 520 };
  const btn = (bg: string): CSSProperties => ({ background: bg, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 });

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Security & 2FA</h2>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>Protect your account with two-factor authentication.</p>

      {msg && (
        <div style={{ background: msg.type === 'ok' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${msg.type === 'ok' ? '#bbf7d0' : '#fecaca'}`, borderRadius: 8, padding: '10px 14px', color: msg.type === 'ok' ? '#166534' : '#991b1b', fontSize: 13, marginBottom: 16 }}>
          {msg.text}
        </div>
      )}

      {status === 'loading' && <p style={{ color: '#94a3b8', fontSize: 13 }}>Loading…</p>}

      {status === 'enabled' && step === 'idle' && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>✅</span>
            <span style={{ fontWeight: 600, color: '#166534' }}>Two-Factor Authentication is ON</span>
          </div>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>Your account is protected. You need your authenticator app at every login.</p>
          <button style={btn('#dc2626')} onClick={() => { setStep('disabling'); setCode(''); setMsg(null); }}>Disable 2FA</button>
        </div>
      )}

      {status === 'enabled' && step === 'disabling' && (
        <div style={card}>
          <p style={{ fontWeight: 600, marginBottom: 12 }}>Enter your current 2FA code to disable:</p>
          <input style={{ ...inp, marginBottom: 12 }} placeholder="6-digit code" value={code} maxLength={6} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn('#dc2626')} disabled={loading} onClick={disable2FA}>{loading ? 'Disabling…' : 'Confirm Disable'}</button>
            <button style={{ ...btn('#64748b') }} onClick={() => { setStep('idle'); setMsg(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {status === 'disabled' && step === 'idle' && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <span style={{ fontWeight: 600, color: '#92400e' }}>Two-Factor Authentication is OFF</span>
          </div>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>Enable 2FA to add an extra layer of security. You&apos;ll need Google Authenticator or Authy.</p>
          <button style={btn(primary)} disabled={loading} onClick={startSetup}>{loading ? 'Setting up…' : 'Enable 2FA'}</button>
        </div>
      )}

      {status === 'disabled' && step === 'setup' && (
        <div style={card}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Step 1 — Scan this QR code with your authenticator app</p>
          {qrCode && <img src={qrCode} alt="2FA QR Code" style={{ width: 180, height: 180, display: 'block', margin: '12px 0' }} />}
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Or enter this key manually:</p>
          <code style={{ fontSize: 12, background: '#f1f5f9', padding: '4px 8px', borderRadius: 4, display: 'block', wordBreak: 'break-all', marginBottom: 16 }}>{secret}</code>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Step 2 — Enter the 6-digit code to confirm</p>
          <input style={{ ...inp, marginBottom: 12 }} placeholder="6-digit code from app" value={code} maxLength={6} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn(primary)} disabled={loading} onClick={verifyCode}>{loading ? 'Verifying…' : 'Verify & Enable'}</button>
            <button style={{ ...btn('#64748b') }} onClick={() => { setStep('idle'); setQrCode(''); setSecret(''); setMsg(null); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
