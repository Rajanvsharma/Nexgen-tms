'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import api, { setAccessToken } from '@/lib/api';

export default function ShipperLayout({ children }: { children: React.ReactNode }) {
  const { user, setUser, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      if (user.role !== 'CUSTOMER') { router.replace('/dashboard'); return; }
      return;
    }
    // Try refresh
    api.post('/auth/refresh').then(({ data }) => {
      setAccessToken(data.accessToken);
      api.get('/auth/me').then(({ data: me }) => {
        setUser(me, data.accessToken);
        if (me.role !== 'CUSTOMER') router.replace('/dashboard');
      });
    }).catch(() => { router.replace('/shipper-login'); });
  }, []);

  if (isLoading || !user) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      {/* Top nav */}
      <header style={{ background: '#0f172a', padding: '0 28px', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', borderRadius: 8, display: 'grid', placeItems: 'center', fontWeight: 800, color: '#fff', fontSize: 15 }}>N</div>
          <div>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>NexGen TMS</span>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginLeft: 8 }}>Shipper Portal</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <nav style={{ display: 'flex', gap: 4 }}>
            {[{ label: 'Dashboard', href: '/shipper' }, { label: 'New Quote', href: '/shipper/new-quote' }].map(({ label, href }) => (
              <a key={href} href={href} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, padding: '6px 12px', borderRadius: 6, textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >{label}</a>
            ))}
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 16 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(59,130,246,0.3)', display: 'grid', placeItems: 'center', color: '#93c5fd', fontSize: 12, fontWeight: 700 }}>
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <div>
              <div style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{user.firstName} {user.lastName}</div>
            </div>
            <button
              onClick={async () => {
                await api.post('/auth/logout').catch(() => {});
                setUser(null);
                router.replace('/shipper-login');
              }}
              style={{ color: 'rgba(255,255,255,0.4)', background: 'transparent', border: 0, cursor: 'pointer', fontSize: 12, marginLeft: 4 }}
            >Logout</button>
          </div>
        </div>
      </header>
      <main style={{ flex: 1, padding: '28px 32px', maxWidth: 1100, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {children}
      </main>
    </div>
  );
}
