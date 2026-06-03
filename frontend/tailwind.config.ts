import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        brand: {
          DEFAULT: '#1d4ed8',
          ink: '#1e40af',
          soft: '#eff6ff',
          light: '#3b82f6',
        },
        ink: {
          DEFAULT: '#15202b',
          2: '#475569',
          3: '#94a3b8',
        },
        line: {
          DEFAULT: '#e2e8f0',
          2: '#cbd5e1',
        },
        surface: {
          DEFAULT: '#ffffff',
          2: '#f8fafc',
          3: '#f1f5f9',
        },
        success: { DEFAULT: '#15803d', soft: '#ecfdf3' },
        warning: { DEFAULT: '#b45309', soft: '#fef6e7' },
        danger: { DEFAULT: '#b91c1c', soft: '#fef2f2' },
        teal: { DEFAULT: '#0e7490', soft: '#ecfeff' },
        purple: { DEFAULT: '#6d28d9', soft: '#f5f0ff' },
      },
      borderRadius: {
        lg: '8px',
        md: '6px',
        sm: '4px',
      },
    },
  },
  plugins: [],
};

export default config;
