'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';
import { setAccessToken } from '@/lib/api';
import api from '@/lib/api';

export function useInitAuth() {
  const { setUser, logout } = useAuthStore();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.post(
          process.env.NEXT_PUBLIC_API_URL + '/api/auth/refresh',
          {},
          { withCredentials: true }
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

export function useRequireAuth(requiredRole?: string) {
  const { user, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    } else if (!isLoading && requiredRole && user?.role !== requiredRole) {
      router.replace('/dashboard');
    }
  }, [user, isLoading, requiredRole, router]);

  return { user, isLoading };
}
