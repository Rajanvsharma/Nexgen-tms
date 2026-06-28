'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ShipperSidebar from '@/components/layout/ShipperSidebar';
import Toaster from '@/components/ui/Toaster';
import { useAuthStore } from '@/store/auth.store';
import { useBrandingStore } from '@/store/branding.store';
import api, { setAccessToken } from '@/lib/api';

export default function ShipperLayout({ children }: { children: React.ReactNode }) {
  const { user, setUser, isLoading } = useAuthStore();
  const { load: loadBranding }       = useBrandingStore();
  const router                       = useRouter();

  useEffect(() => { loadBranding(); }, []);

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 text-sm animate-pulse">Loading…</div>
      </div>
    );
  }

  if (!user || user.role !== 'CUSTOMER') return null;

  return (
    <div className="flex min-h-screen">
      <ShipperSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
      <Toaster />
    </div>
  );
}
