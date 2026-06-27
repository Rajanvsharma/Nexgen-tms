'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuthStore, loadSession } from '@/store/auth.store';
import { setAccessToken } from '@/lib/api';
import api from '@/lib/api';

export function useInitAuth() {
  const { setUser, logout } = useAuthStore();

  useEffect(() => {
    // First: try localStorage cache (avoids cross-domain cookie issues on mobile)
    const cached = loadSession();
    if (cached) {
      setUser(cached.user, cached.token);
      return;
    }

    // Fallback: try cookie-based refresh (works on desktop / same-domain)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      // No URL configured — can't refresh, user must log in
      logout();
      return;
    }

    (async () => {
      try {
        const { data } = await axios.post(
          apiUrl + '/api/auth/refresh',
          {},
          { withCredentials: true, timeout: 8000 }
        );
        setAccessToken(data.accessToken);
        const { data: me } = await api.get('/auth/me');
        setUser(me, data.accessToken);
      } catch {
        logout();
      }
    })();
  }, []);
}

export function useRequireAuth(requiredRole?: string | string[]) {
  const { user, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    } else if (!isLoading && requiredRole && user) {
      const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      if (!allowed.includes(user.role) && user.role !== 'SUPER_ADMIN') {
        router.replace('/dashboard');
      }
    }
  }, [user, isLoading, requiredRole, router]);

  return { user, isLoading };
}
