'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useBrandingStore } from '@/store/branding.store';
import CarrierSidebar from '@/components/layout/CarrierSidebar';
import Toaster from '@/components/ui/Toaster';

export default function CarrierLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  const { load: loadBranding } = useBrandingStore();
  const router = useRouter();

  useEffect(() => { loadBranding(); }, []);
  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'CARRIER')) {
      router.replace('/carrier-login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role !== 'CARRIER') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc' }}>
        <div style={{ color: '#94a3b8', fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <CarrierSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
      <Toaster />
    </div>
  );
}
