'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useBrandingStore } from '@/store/branding.store';
import { useSocket } from '@/hooks/useSocket';
import api from '@/lib/api';
import GlobalSearch from '@/components/GlobalSearch';

interface TopbarProps {
  title?: string;
  subtitle?: string;
}

export default function Topbar({ title, subtitle }: TopbarProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { branding } = useBrandingStore();
  const primary = branding.primaryColor;

  const [pendingBids, setPendingBids] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchPendingBids() {
    try {
      const { data } = await api.get('/loads/pending-bids');
      setPendingBids(data.count || 0);
    } catch { /* non-critical */ }
  }

  useEffect(() => {
    if (!user) return;
    fetchPendingBids();
    intervalRef.current = setInterval(fetchPendingBids, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [user]);

  useSocket({
    new_bid: () => { fetchPendingBids(); },
  });

  async function handleLogout() {
    try { await api.post('/auth/logout'); } finally {
      logout();
      router.replace('/login');
    }
  }

  function handleCmd(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const v = (e.target as HTMLInputElement).value.trim();
    if (!v) return;
    (e.target as HTMLInputElement).value = '';
    const event = new CustomEvent('copilot:ask', { detail: v });
    window.dispatchEvent(event);
  }

  return (
    <header className="topbar-header" style={{ height: 56, background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px', flexShrink: 0 }}>
      {/* Command bar */}
      <div style={{ flex: 1, maxWidth: 560, display: 'flex', alignItems: 'center', gap: 8, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 12px' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: primary, flexShrink: 0 }} />
        <input
          onKeyDown={handleCmd}
          placeholder='Ask AI…'
          className="topbar-input"
          style={{ border: 0, background: 'transparent', outline: 'none', flex: 1, fontSize: 13, color: '#15202b' }}
        />
        <kbd style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: 4, padding: '1px 5px', background: '#fff' }}>↵</kbd>
      </div>

      {/* Page title (small) — hidden on mobile */}
      {title && (
        <div className="topbar-title" style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', lineHeight: 1.2 }}>{title}</span>
          {subtitle && <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', lineHeight: 1.2 }}>{subtitle}</span>}
        </div>
      )}

      {/* Global search — hidden on mobile */}
      <div className="topbar-search">
        <GlobalSearch />
      </div>

      {/* Notification bell — shows red badge when carriers have submitted bids */}
      <button
        onClick={() => router.push('/loads')}
        title={pendingBids > 0 ? `${pendingBids} pending carrier bid${pendingBids > 1 ? 's' : ''}` : 'Loads'}
        style={{ position: 'relative', width: 34, height: 34, border: '1px solid #e2e8f0', background: '#fff', borderRadius: 8, display: 'grid', placeItems: 'center', fontSize: 15, color: '#475569', cursor: 'pointer', flexShrink: 0 }}
      >
        🔔
        {pendingBids > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -5,
            background: '#ef4444', color: '#fff',
            borderRadius: 9999, fontSize: 10, fontWeight: 800,
            minWidth: 17, height: 17, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', border: '2px solid #fff', lineHeight: 1,
          }}>
            {pendingBids > 99 ? '99+' : pendingBids}
          </span>
        )}
      </button>

      {/* User info — hide verbose info on mobile */}
      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span className="topbar-username" style={{ fontSize: 12, color: '#475569' }}>{user.firstName} {user.lastName}</span>
          <span className="topbar-role" style={{ fontSize: 10, fontWeight: 700, background: `${primary}18`, color: primary, border: `1px solid ${primary}33`, borderRadius: 20, padding: '2px 8px' }}>{user.role}</span>
          <button
            onClick={handleLogout}
            style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#475569', cursor: 'pointer' }}
          >
            Logout
          </button>
        </div>
      )}
    </header>
  );
}
