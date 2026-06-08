'use client';

import { useState, useEffect } from 'react';
import { useAuthStore, type AuthUser } from '@/store/auth.store';
import { useBrandingStore, type BrandingConfig } from '@/store/branding.store';
import api from '@/lib/api';

type Tab = 'profile' | 'email' | 'notifications' | 'api' | 'system' | 'security';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'profile',       label: 'Profile',         icon: '◯' },
  { id: 'security',      label: 'Security / 2FA',  icon: '🔒' },
  { id: 'email',         label: 'Email (IMAP)',     icon: '✉' },
  { id: 'notifications', label: 'Notifications',    icon: '🔔' },
  { id: 'api',           label: 'API Keys',         icon: '🔑' },
  { id: 'system',        label: 'System',           icon: '⚙' },
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
  const [tab, setTab] = useState<Tab>('profile');
  const primary = branding.primaryColor;

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f1f5f9', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>
      {/* Left tab rail */}
      <div style={{ width: 210, background: '#fff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', padding: '20px 10px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 12, paddingLeft: 10 }}>Settings</div>
        {TABS.filter(t => t.id !== 'system' || user?.role === 'ADMIN').map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
            background: tab === t.id ? `${primary}18` : 'transparent',
            color: tab === t.id ? primary : '#475569',
            fontWeight: tab === t.id ? 600 : 400,
            fontSize: 13.5,
            borderLeft: tab === t.id ? `3px solid ${primary}` : '3px solid transparent',
            marginBottom: 2,
          }}>
            <span style={{ fontSize: 14 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
        {tab === 'profile'       && <ProfileTab user={user} setUser={setUser} primary={primary} />}
        {tab === 'security'      && <SecurityTab primary={primary} />}
        {tab === 'email'         && <EmailTab primary={primary} />}
        {tab === 'notifications' && <NotificationsTab primary={primary} />}
        {tab === 'api'           && <ApiTab primary={primary} />}
        {tab === 'system'        && <SystemTab primary={primary} branding={branding} />}
      </div>
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
          ['Version',     'NexGen TMS v2.0'],
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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 18 }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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

const inp: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0',
  borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box',
  background: '#fff',
};

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

  const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24, marginBottom: 20, maxWidth: 520 };
  const btn = (bg: string): React.CSSProperties => ({ background: bg, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 });

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
