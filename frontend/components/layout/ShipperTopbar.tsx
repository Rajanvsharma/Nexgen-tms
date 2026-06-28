'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useBrandingStore } from '@/store/branding.store';
import api from '@/lib/api';

interface Props { title?: string; subtitle?: string; }

export default function ShipperTopbar({ title, subtitle }: Props) {
  const router           = useRouter();
  const { user, logout } = useAuthStore();
  const { branding }     = useBrandingStore();
  const primary          = branding.primaryColor;

  async function handleLogout() {
    try { await api.post('/auth/logout'); } finally {
      logout();
      router.replace('/shipper-login');
    }
  }

  return (
    <header style={{ height: 56, background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px', flexShrink: 0 }}>
      {/* Page title */}
      {title && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', lineHeight: 1.2 }}>{title}</span>
          {subtitle && <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', lineHeight: 1.2 }}>{subtitle}</span>}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* User info */}
      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: '#475569' }}>{user.firstName} {user.lastName}</span>
          <span style={{ fontSize: 10, fontWeight: 700, background: `${primary}18`, color: primary, border: `1px solid ${primary}33`, borderRadius: 20, padding: '2px 8px' }}>Shipper</span>
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
