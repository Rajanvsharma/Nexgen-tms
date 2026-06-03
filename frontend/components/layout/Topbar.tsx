'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';

interface TopbarProps {
  title?: string;
}

export default function Topbar({ title }: TopbarProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();

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
    // Fire copilot
    const event = new CustomEvent('copilot:ask', { detail: v });
    window.dispatchEvent(event);
  }

  return (
    <header style={{ height: 56, background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px', flexShrink: 0 }}>
      {/* Command bar */}
      <div style={{ flex: 1, maxWidth: 560, display: 'flex', alignItems: 'center', gap: 8, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 12px' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1d4ed8', flexShrink: 0 }} />
        <input
          onKeyDown={handleCmd}
          placeholder='Ask AI: "find carriers Chicago→Dallas reefer", "post load", "margin this week"…'
          style={{ border: 0, background: 'transparent', outline: 'none', flex: 1, fontSize: 13, color: '#15202b' }}
        />
        <kbd style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: 4, padding: '1px 5px', background: '#fff' }}>↵</kbd>
      </div>

      {/* Page title (small) */}
      {title && <span style={{ fontSize: 13, fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>{title}</span>}

      {/* Notification bell */}
      <button
        onClick={() => router.push('/announcements')}
        style={{ position: 'relative', width: 34, height: 34, border: '1px solid #e2e8f0', background: '#fff', borderRadius: 8, display: 'grid', placeItems: 'center', fontSize: 15, color: '#475569', cursor: 'pointer' }}
      >
        🔔
      </button>

      {/* User info */}
      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#475569' }}>{user.firstName} {user.lastName}</span>
          <span style={{ fontSize: 10, fontWeight: 700, background: '#eff6ff', color: '#1e40af', border: '1px solid #dbe5ff', borderRadius: 20, padding: '2px 8px' }}>{user.role}</span>
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
