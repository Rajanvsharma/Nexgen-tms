'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useBrandingStore } from '@/store/branding.store';
import api from '@/lib/api';

interface Props { title?: string; subtitle?: string; }

let _cachedCarrierName: string | null = null;

export default function CarrierTopbar({ title, subtitle }: Props) {
  const { user, logout } = useAuthStore();
  const { branding }     = useBrandingStore();
  const router  = useRouter();
  const primary = branding.primaryColor || '#f59e0b';
  const [carrierName, setCarrierName] = useState(_cachedCarrierName);

  useEffect(() => {
    if (_cachedCarrierName) return;
    api.get('/carrier-portal/me').then(r => {
      if (r.data.carrier?.name) {
        _cachedCarrierName = r.data.carrier.name;
        setCarrierName(_cachedCarrierName);
      }
    }).catch(() => {});
  }, []);

  function handleLogout() { logout(); router.replace('/carrier-login'); }

  return (
    <div style={{ height: 56, background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, flexShrink: 0 }}>
      <div style={{ flex: 1 }}>
        {title && <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', lineHeight: 1.2 }}>{title}</div>}
        {subtitle && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{subtitle}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {carrierName && (
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            🏢 {carrierName}
          </span>
        )}
        <span style={{ fontSize: 14, color: '#334155', fontWeight: 600 }}>{user?.firstName} {user?.lastName}</span>
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, background: `${primary}20`, color: primary, fontWeight: 700 }}>Carrier</span>
        <button onClick={handleLogout} style={{ padding: '6px 14px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          Logout
        </button>
      </div>
    </div>
  );
}
