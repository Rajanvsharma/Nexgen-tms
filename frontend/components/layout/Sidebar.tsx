'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore, type Role } from '@/store/auth.store';
import { useBrandingStore } from '@/store/branding.store';
import api from '@/lib/api';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  href: string;
  tag?: string;
  roles?: Role[];
}

interface NavGroup {
  items: NavItem[];
  roles?: Role[];
  divider?: boolean;
}

const NAV: NavGroup[] = [
  {
    items: [
      { id: 'dashboard', label: 'Dashboard',     icon: '⊞', href: '/dashboard' },
      { id: 'loads',     label: 'Loads',          icon: '▸', href: '/loads' },
      { id: 'capacity',  label: 'CarrierQ™',      icon: '⚡', href: '/capacity' },
      { id: 'quotes',    label: 'CRM',             icon: '◎', href: '/quotes' },
      { id: 'customers', label: 'Customers',        icon: '◉', href: '/customers' },
      { id: 'dispatch',  label: 'Calendar',        icon: '▦', href: '/dispatch' },
      { id: 'email',     label: 'Email Marketing', icon: '✉', href: '/email' },
    ],
    divider: true,
  },
  {
    items: [
      { id: 'accounting', label: 'Accounting', icon: '$', href: '/accounting', roles: ['ADMIN', 'ACCOUNTING'] },
      { id: 'reports',    label: 'Reports',    icon: '▤', href: '/reports',    roles: ['ADMIN', 'ACCOUNTING'] },
    ],
    divider: true,
  },
  {
    items: [
      { id: 'carriers',   label: 'Carrier Network', icon: '◈', href: '/carriers' },
      { id: 'compliance', label: 'Compliance',      icon: '✓', href: '/compliance', roles: ['ADMIN', 'COMPLIANCE'] },
      { id: 'ai-hub',     label: 'AI Hub',           icon: '✦', href: '/ai-hub',  tag: 'AI' },
      { id: 'intake',     label: 'AI Intake',        icon: '⬡', href: '/intake',  tag: 'AI' },
      { id: 'workflows',  label: 'Automation',       icon: '⟳', href: '/workflows' },
    ],
    divider: true,
  },
  {
    items: [
      { id: 'console',       label: 'Console',        icon: '💬', href: '/console' },
      { id: 'announcements', label: 'Announcements',  icon: '◎', href: '/announcements' },
      { id: 'branding',      label: 'White Label',    icon: '🎨', href: '/branding',  roles: ['ADMIN'] },
      { id: 'users',         label: 'Org Management', icon: '◯', href: '/users',     roles: ['ADMIN'] },
      { id: 'settings',      label: 'Settings',       icon: '⚙', href: '/settings' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { branding } = useBrandingStore();

  const primary = branding.primaryColor;
  const primaryBg = `${primary}cc`;

  async function handleLogout() {
    try { await api.post('/auth/logout'); } finally {
      logout();
      router.replace('/login');
    }
  }

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}` : 'U';
  // Company initial for fallback logo
  const companyInitial = branding.companyName.charAt(0).toUpperCase();

  return (
    <aside style={{
      width: 224,
      minHeight: '100vh',
      background: branding.sidebarBg,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>

      {/* ── Logo ── */}
      <div style={{ padding: '16px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {branding.logoData ? (
            <img
              src={branding.logoData}
              alt={branding.companyName}
              style={{ height: 36, maxWidth: 140, objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <>
              <div style={{
                width: 34, height: 34,
                background: `linear-gradient(135deg, ${primary}, ${branding.darkColor})`,
                borderRadius: 8, display: 'grid', placeItems: 'center',
                fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0,
              }}>
                {companyInitial}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#fff', letterSpacing: '-0.3px', lineHeight: 1 }}>
                  {branding.companyName}
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginTop: 2 }}>
                  {branding.tagline}
                </div>
              </div>
            </>
          )}
        </div>
        {branding.logoData && (
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginTop: 8 }}>
            {branding.tagline}
          </div>
        )}
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
        {NAV.map((group, gi) => {
          const visible = group.items.filter(it => !it.roles || (user && it.roles.includes(user.role)));
          if (!visible.length) return null;
          return (
            <div key={gi}>
              {visible.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 12px',
                      borderRadius: 8,
                      marginBottom: 2,
                      color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
                      fontWeight: isActive ? 600 : 400,
                      fontSize: 13.5,
                      textDecoration: 'none',
                      background: isActive ? primaryBg : 'transparent',
                      transition: 'all 0.12s',
                      position: 'relative',
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <span style={{ width: 18, textAlign: 'center', fontSize: 14, opacity: isActive ? 1 : 0.7, flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.tag === 'AI' && (
                      <span style={{ fontSize: 9, fontWeight: 700, background: `${primary}33`, color: primary, border: `1px solid ${primary}55`, borderRadius: 4, padding: '1px 5px' }}>AI</span>
                    )}
                  </Link>
                );
              })}
              {group.divider && (
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '8px 4px' }} />
              )}
            </div>
          );
        })}
      </nav>

      {/* ── User ── */}
      {user && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: `linear-gradient(135deg,${primary},${branding.darkColor})`,
              color: '#fff', display: 'grid', placeItems: 'center',
              fontWeight: 700, fontSize: 12, flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.firstName} {user.lastName}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{user.role}</div>
            </div>
            <button onClick={handleLogout} title="Logout" style={{ border: 0, background: 'transparent', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 14, padding: 4 }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#f87171'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'}
            >⎋</button>
          </div>
        </div>
      )}
    </aside>
  );
}
