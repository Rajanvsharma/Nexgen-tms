'use client';
import { useToastStore } from '@/store/toast.store';

const ICONS = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
const COLORS = {
  success: { bg: '#f0fdf4', border: '#86efac', icon: '#16a34a', title: '#15803d' },
  error:   { bg: '#fef2f2', border: '#fca5a5', icon: '#dc2626', title: '#b91c1c' },
  info:    { bg: '#eff6ff', border: '#93c5fd', icon: '#2563eb', title: '#1d4ed8' },
  warning: { bg: '#fffbeb', border: '#fcd34d', icon: '#d97706', title: '#b45309' },
};

export default function Toaster() {
  const { toasts, remove } = useToastStore();
  if (!toasts.length) return null;

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none' }}>
      {toasts.map(t => {
        const c = COLORS[t.type];
        return (
          <div key={t.id} style={{
            minWidth: 300, maxWidth: 400, background: c.bg, border: `1px solid ${c.border}`,
            borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', pointerEvents: 'all',
            animation: 'slideIn 0.2s ease-out',
          }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: c.icon, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
              {ICONS[t.type]}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.title }}>{t.title}</div>
              {t.message && <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{t.message}</div>}
            </div>
            <button onClick={() => remove(t.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
          </div>
        );
      })}
      <style>{`@keyframes slideIn { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }`}</style>
    </div>
  );
}
