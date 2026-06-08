'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/auth.store';
import { setAccessToken } from '@/lib/api';
import api from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Email and password are required'); return; }
    if (requires2FA && !totpCode) { setError('Enter your 2FA code'); return; }

    setLoading(true);
    try {
      const { data } = await axios.post(
        process.env.NEXT_PUBLIC_API_URL + '/api/auth/login',
        { email, password, totpCode: requires2FA ? totpCode : undefined },
        { withCredentials: true }
      );

      if (data.requires2FA) {
        setRequires2FA(true);
        setLoading(false);
        return;
      }
      setAccessToken(data.accessToken);
      const { data: me } = await api.get('/auth/me');
      setUser(me, data.accessToken);
      if (me.role === 'CUSTOMER') { router.replace('/shipper'); return; }
      router.replace('/dashboard');
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.message : 'Login failed';
      setError(msg || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-dark to-brand">
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-brand">NexGen TMS</h1>
          <p className="text-gray-500 mt-1 text-sm">Transportation Management System</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@nexgentms.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {requires2FA && (
            <div className="space-y-1">
              <Label htmlFor="totp">Authenticator Code</Label>
              <Input
                id="totp"
                type="text"
                inputMode="numeric"
                placeholder="6-digit code"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
              <p className="text-xs text-gray-500">Enter the code from your authenticator app</p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : requires2FA ? 'Verify & Sign In' : 'Sign In'}
          </Button>

          <div className="text-center">
            <Link href="/forgot-password" className="text-sm text-gray-500 hover:text-blue-600">
              Forgot password?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
