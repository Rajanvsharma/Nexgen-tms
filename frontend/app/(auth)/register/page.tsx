'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';
import { setAccessToken } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();

  const [form, setForm] = useState({
    companyName: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.companyName || !form.firstName || !form.lastName || !form.email || !form.password) {
      return setError('All fields are required');
    }
    if (form.password !== form.confirmPassword) return setError('Passwords do not match');
    if (form.password.length < 8) return setError('Password must be at least 8 characters');

    setLoading(true);
    try {
      const { data } = await axios.post(
        process.env.NEXT_PUBLIC_API_URL + '/api/auth/register',
        { companyName: form.companyName, firstName: form.firstName, lastName: form.lastName, email: form.email, password: form.password },
        { withCredentials: true }
      );
      setAccessToken(data.accessToken);
      setUser({ ...data.user, organizationId: data.organization.id }, data.accessToken);

      // Store org info for trial banner
      if (typeof window !== 'undefined') {
        localStorage.setItem('org', JSON.stringify(data.organization));
      }

      router.replace('/onboarding');
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.message : 'Registration failed';
      setError(msg || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0',
    borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#0d1b2a,#1e3a8a)', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', padding: '44px 40px', width: '100%', maxWidth: 480 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1e3a8a', marginBottom: 4 }}>NexGen TMS</div>
          <div style={{ fontSize: 14, color: '#64748b' }}>Start your 14-day free trial — no credit card required</div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Company */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }}>Company / Brokerage Name</label>
            <input style={inp} placeholder="Acme Freight LLC" value={form.companyName} onChange={e => set('companyName', e.target.value)} />
          </div>

          {/* Name row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }}>First Name</label>
              <input style={inp} placeholder="John" value={form.firstName} onChange={e => set('firstName', e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }}>Last Name</label>
              <input style={inp} placeholder="Smith" value={form.lastName} onChange={e => set('lastName', e.target.value)} />
            </div>
          </div>

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }}>Work Email</label>
            <input type="email" style={inp} placeholder="john@acmefreight.com" value={form.email} onChange={e => set('email', e.target.value)} autoComplete="email" />
          </div>

          {/* Password row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }}>Password</label>
              <input type="password" style={inp} placeholder="Min. 8 chars" value={form.password} onChange={e => set('password', e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }}>Confirm</label>
              <input type="password" style={inp} placeholder="Re-enter" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} />
            </div>
          </div>

          {error && (
            <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '13px', background: '#1e3a8a', color: '#fff',
            border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Creating your account…' : 'Start Free Trial →'}
          </button>
        </form>

        {/* Trial features */}
        <div style={{ marginTop: 24, padding: '16px', background: '#eff6ff', borderRadius: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 8 }}>What you get on your trial:</div>
          {['Full access to all features', 'Up to 5 users', '500 loads/month', 'Email + chat support'].map(f => (
            <div key={f} style={{ fontSize: 12, color: '#1d4ed8', marginBottom: 3 }}>✓ {f}</div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#94a3b8' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#1e3a8a', fontWeight: 600 }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
