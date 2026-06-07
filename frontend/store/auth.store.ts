import { create } from 'zustand';
import { setAccessToken } from '@/lib/api';

export type Role = 'ADMIN' | 'DISPATCHER' | 'ACCOUNTING' | 'COMPLIANCE' | 'CUSTOMER';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  customerId?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  setUser: (user: AuthUser | null, token?: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user, token) => {
    if (token) setAccessToken(token);
    set({ user, isLoading: false });
  },
  logout: () => {
    setAccessToken(null);
    set({ user: null, isLoading: false });
  },
}));
