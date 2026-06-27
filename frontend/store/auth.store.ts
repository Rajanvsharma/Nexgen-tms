import { create } from 'zustand';
import { setAccessToken } from '@/lib/api';

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'OPS_MANAGER' | 'TEAM_MANAGER' | 'DISPATCHER' | 'ACCOUNT_EXEC' | 'CARRIER_RELATIONS' | 'ACCOUNTING' | 'COMPLIANCE' | 'SUPPORT' | 'AUDITOR' | 'CUSTOMER' | 'CARRIER';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  organizationId?: string | null;
  teamId?: string | null;
  customerId?: string | null;
  carrierId?: string | null;
  repVisibility?: 'own' | 'team' | null;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  setUser: (user: AuthUser | null, token?: string) => void;
  logout: () => void;
}

const SESSION_KEY = 'nexgen_session';
const SESSION_TTL = 23 * 60 * 60 * 1000; // 23 hours

export function saveSession(user: AuthUser, token: string) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user, token, exp: Date.now() + SESSION_TTL }));
  } catch {}
}

export function loadSession(): { user: AuthUser; token: string } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s.user || !s.token || s.exp < Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch { return null; }
}

export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user, token) => {
    if (token) {
      setAccessToken(token);
      if (user) saveSession(user, token);
    }
    set({ user, isLoading: false });
  },
  logout: () => {
    setAccessToken(null);
    clearSession();
    set({ user: null, isLoading: false });
  },
}));
