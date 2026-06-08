'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

const STEPS = ['Company Setup', 'Invite Team', 'You\'re Ready'];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [orgName, setOrgName] = useState('');
  const [inviteEmails, setInviteEmails] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function saveCompany() {
    if (!orgName.trim()) { setMsg('Enter your company name'); return; }
    setSaving(true);
    try {
      await api.patch('/organization', { name: orgName.trim() });
      setStep(1);
      setMsg('');
    } catch {
      setMsg('Failed to save. Try again.');
    } finally { setSaving(false); }
  }

  async function sendInvites() {
    const emails = inviteEmails.split(/[\n,]+/).map(e => e.trim()).filter(Boolean);
    if (emails.length === 0) { setStep(2); return; }
    setSaving(true);
    try {
      // Best-effort: create users with temp passwords (they can reset)
      await Promise.allSettled(emails.map(email =>
        api.post('/users', {
          email, password: 'Invite2026!', firstName: 'Invited', lastName: 'User', role: 'DISPATCHER',
        })
      ));
      setStep(2);
    } finally { setSaving(false); }
  }

  const c: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#0d1b2a,#1e3a8a)', fontFamily: 'Inter, sans-serif' };
  const box: React.CSSProperties = { background: '#fff', borderRadius: 20, padding: '44px 40px', width: '100%', maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' };
  const inp: React.CSSProperties = { width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' };
  const primary = '#1e3a8a';

  return (
    <div style={c}>
      <div style={box}>
        {/* Steps indicator */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 36 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: i <= step ? primary : '#e2e8f0',
                color: i <= step ? '#fff' : '#94a3b8',
                fontSize: 13, fontWeight: 700, flexShrink: 0,
              }}>
                {i < step ? '✓' : i + 1}
              </div>
              <div style={{ marginLeft: 8, fontSize: 12, fontWeight: i === step ? 700 : 400, color: i === step ? primary : '#94a3b8', whiteSpace: 'nowrap', marginRight: 8 }}>
                {s}
              </div>
              {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: i < step ? primary : '#e2e8f0', marginRight: 8 }} />}
            </div>
          ))}
        </div>

        {/* Step 0: Company Setup */}
        {step === 0 && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Set up your company</h2>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>Confirm your company name as it will appear on invoices and documents.</p>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }}>Company Name</label>
              <input style={inp} placeholder="Acme Freight LLC" value={orgName} onChange={e => setOrgName(e.target.value)} autoFocus />
            </div>
            {msg && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{msg}</div>}
            <button onClick={saveCompany} disabled={saving} style={{ width: '100%', padding: 13, background: primary, color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving…' : 'Continue →'}
            </button>
            <button onClick={() => setStep(1)} style={{ width: '100%', marginTop: 10, padding: '10px', background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>
              Skip for now
            </button>
          </div>
        )}

        {/* Step 1: Invite Team */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Invite your team</h2>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>Add dispatchers, accounting staff, or compliance managers. They&apos;ll get login details at the default password <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>Invite2026!</code> — remind them to change it.</p>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }}>Email Addresses (one per line or comma-separated)</label>
              <textarea
                style={{ ...inp, height: 120, resize: 'vertical', fontFamily: 'inherit' }}
                placeholder="dispatcher@company.com&#10;accounting@company.com"
                value={inviteEmails}
                onChange={e => setInviteEmails(e.target.value)}
              />
            </div>
            <button onClick={sendInvites} disabled={saving} style={{ width: '100%', padding: 13, background: primary, color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Sending…' : inviteEmails.trim() ? 'Send Invites →' : 'Skip →'}
            </button>
          </div>
        )}

        {/* Step 2: Done */}
        {step === 2 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>You&apos;re all set!</h2>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 32 }}>
              Your NexGen TMS is ready. You have <strong>14 days</strong> to explore everything free.
              No credit card needed until your trial ends.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
              {[
                { icon: '📦', label: 'Create your first load', href: '/loads' },
                { icon: '🚛', label: 'Add carriers', href: '/carriers' },
                { icon: '👥', label: 'Add customers', href: '/customers' },
                { icon: '📊', label: 'View dashboard', href: '/dashboard' },
              ].map(item => (
                <a key={item.href} href={item.href} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '14px', borderRadius: 12,
                  background: '#eff6ff', border: '1px solid #bfdbfe', textDecoration: 'none',
                  color: '#1e40af', fontSize: 13, fontWeight: 600,
                }}>
                  <span style={{ fontSize: 20 }}>{item.icon}</span>
                  {item.label}
                </a>
              ))}
            </div>

            <button onClick={() => router.replace('/dashboard')} style={{ width: '100%', padding: 13, background: primary, color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              Go to Dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
