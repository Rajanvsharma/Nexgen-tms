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
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl || apiUrl === 'undefined') {
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
