'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import CopilotChat from '@/components/layout/CopilotChat';
import Toaster from '@/components/ui/Toaster';
import { useAuthStore } from '@/store/auth.store';
import { useBrandingStore } from '@/store/branding.store';
import { useInitAuth } from '@/hooks/useAuth';
import { ErrorBoundary } from '@/components/error-boundary';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  useInitAuth();
  const { user, isLoading } = useAuthStore();
  const { load: loadBranding } = useBrandingStore();
  const router = useRouter();

  useEffect(() => { loadBranding(); }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 text-sm animate-pulse">Loading NexGen TMS…</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
        <CopilotChat />
        <Toaster />
      </div>
    </ErrorBoundary>
  );
}
