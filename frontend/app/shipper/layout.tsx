'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import api, { setAccessToken } from '@/lib/api';

const NAV = [
  { href: '/shipper',           icon: '📦', label: 'Dashboard' },
  { href: '/shipper/shipments', icon: '🚚', label: 'My Shipments' },
  { href: '/shipper/new-quote', icon: '💬', label: 'Request a Quote' },
  { href: '/shipper/documents', icon: '📄', label: 'Documents' },
  { href: '/shipper/invoices',  icon: '💰', label: 'Invoices' },
];

export default function ShipperLayout({ children }: { children: React.ReactNode }) {
  const { user, setUser, isLoading } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (user) {
      if (user.role !== 'CUSTOMER') { router.replace('/dashboard'); return; }
      return;
    }
    api.post('/auth/refresh').then(({ data }) => {
      setAccessToken(data.accessToken);
      api.get('/auth/me').then(({ data: me }) => {
        setUser(me, data.accessToken);
        if (me.role !== 'CUSTOMER') router.replace('/dashboard');
      });
    }).catch(() => { router.replace('/shipper-login'); });
  }, []);

  if (isLoading || !user || user.role !== 'CUSTOMER') {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f1f5f9' }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: 220, flexShrink: 0, background: '#0f172a',
        display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}>
        {/* Brand */}
        <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', borderRadius: 9, display: 'grid', placeItems: 'center', fontWeight: 900, color: '#fff', fontSize: 16, flexShrink: 0 }}>N</div>
            <div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 14, lineHeight: 1.2 }}>NexGen TMS</div>
              <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 10, marginTop: 1 }}>Shipper Portal</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {NAV.map(({ href, icon, label }) => {
            const active = href === '/shipper' ? pathname === '/shipper' : pathname.startsWith(href);
            return (
              <a key={href} href={href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8, marginBottom: 2,
                textDecoration: 'none', fontSize: 13, fontWeight: active ? 700 : 400,
                color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                background: active ? 'rgba(59,130,246,0.18)' : 'transparent',
                borderLeft: active ? '3px solid #3b82f6' : '3px solid transparent',
                transition: 'all 0.15s',
              }}>
                <span style={{ fontSize: 15 }}>{icon}</span>
                {label}
              </a>
            );
          })}

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '10px 0' }} />

          <a href="/shipper/settings" style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px', borderRadius: 8,
            textDecoration: 'none', fontSize: 13, fontWeight: pathname.startsWith('/shipper/settings') ? 700 : 400,
            color: pathname.startsWith('/shipper/settings') ? '#fff' : 'rgba(255,255,255,0.55)',
            background: pathname.startsWith('/shipper/settings') ? 'rgba(59,130,246,0.18)' : 'transparent',
            borderLeft: pathname.startsWith('/shipper/settings') ? '3px solid #3b82f6' : '3px solid transparent',
          }}>
            <span style={{ fontSize: 15 }}>⚙️</span> Account Settings
          </a>
        </nav>

        {/* User card + Logout */}
        <div style={{ padding: '14px 14px 18px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(59,130,246,0.25)', display: 'grid', placeItems: 'center', color: '#93c5fd', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.firstName} {user.lastName}</div>
              <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
            </div>
          </div>
          <button
            onClick={async () => {
              await api.post('/auth/logout').catch(() => {});
              setUser(null);
              router.replace('/shipper-login');
            }}
            style={{ width: '100%', padding: '7px 0', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main style={{ flex: 1, minWidth: 0, padding: '28px 32px', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
