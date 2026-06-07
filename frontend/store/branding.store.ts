import { create } from 'zustand';
import axios from 'axios';

export interface BrandingConfig {
  id: string | null;
  companyName: string;
  tagline: string;
  logoData: string | null;
  primaryColor: string;
  darkColor: string;
  sidebarBg: string;
  accentColor: string;
  plan: string;
  planExpiresAt: string | null;
  isDefault: boolean;
  domain: string | null;
}

const FALLBACK: BrandingConfig = {
  id: null,
  companyName: 'NexGen TMS',
  tagline: 'Transportation Management System',
  logoData: null,
  primaryColor: '#3b82f6',
  darkColor: '#1d4ed8',
  sidebarBg: '#0d1b2a',
  accentColor: '#22c55e',
  plan: 'enterprise',
  planExpiresAt: null,
  isDefault: true,
  domain: null,
};

interface BrandingState {
  branding: BrandingConfig;
  loaded: boolean;
  load: () => Promise<void>;
  set: (b: Partial<BrandingConfig>) => void;
}

function applyCSS(b: BrandingConfig) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--brand-primary', b.primaryColor);
  root.style.setProperty('--brand-dark', b.darkColor);
  root.style.setProperty('--brand-sidebar', b.sidebarBg);
  root.style.setProperty('--brand-accent', b.accentColor);
}

export const useBrandingStore = create<BrandingState>((set, get) => ({
  branding: FALLBACK,
  loaded: false,

  load: async () => {
    if (get().loaded) return;
    try {
      const domain = typeof window !== 'undefined' ? window.location.hostname : '';
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const params = domain && domain !== 'localhost' ? `?domain=${encodeURIComponent(domain)}` : '';
      const { data } = await axios.get(`${apiBase}/api/branding${params}`);
      const b: BrandingConfig = { ...FALLBACK, ...data };
      applyCSS(b);
      set({ branding: b, loaded: true });
    } catch {
      applyCSS(FALLBACK);
      set({ branding: FALLBACK, loaded: true });
    }
  },

  set: (partial) => {
    const b = { ...get().branding, ...partial };
    applyCSS(b);
    set({ branding: b });
  },
}));
