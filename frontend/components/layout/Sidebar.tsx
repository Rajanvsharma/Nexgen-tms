'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore, type Role } from '@/store/auth.store';
import { useBrandingStore } from '@/store/branding.store';
import api from '@/lib/api';

interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  href: string;
  tag?: string;
  roles?: Role[];
}

interface NavGroup {
  label?: string;
  items: NavItem[];
  divider?: boolean;
}

// ── Inline SVG icons ──────────────────────────────────────────────────────
const Ic = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const GridIcon    = () => <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
const TruckIcon   = () => <Ic d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM18.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />;
const BoltIcon    = () => <Ic d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />;
const UsersIcon   = () => <Ic d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />;
const UserIcon    = () => <Ic d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />;
const CalIcon     = () => <Ic d="M3 4h18v18H3zM16 2v4M8 2v4M3 10h18" />;
const MailIcon    = () => <Ic d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6" />;
const DollarIcon  = () => <Ic d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />;
const ChartIcon   = () => <Ic d="M18 20V10M12 20V4M6 20v-6" />;
const NetworkIcon = () => <Ic d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M21 8a3 3 0 11-6 0 3 3 0 016 0zM9 11a4 4 0 100-8 4 4 0 000 8z" />;
const ShieldIcon  = () => <Ic d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />;
const StarIcon    = () => <Ic d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />;
const BotIcon     = () => <Ic d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h3a3 3 0 013 3v8a3 3 0 01-3 3H8a3 3 0 01-3-3v-8a3 3 0 013-3h3V5.73A2 2 0 0112 2zM9 14a1 1 0 100 2 1 1 0 000-2zM15 14a1 1 0 100 2 1 1 0 000-2z" />;
const FlowIcon    = () => <Ic d="M5 12h14M12 5l7 7-7 7" />;
const ChatIcon    = () => <Ic d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />;
const MegaIcon    = () => <Ic d="M18 8a5 5 0 010 8M16.72 9.28A2.5 2.5 0 0116.72 14.72M3 8v8a1 1 0 001 1h3V7H4a1 1 0 00-1 1zM7 7l6-4v18l-6-4" />;
const PaintIcon   = () => <Ic d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zM9 17H7v-7h2v7zM13 17h-2V7h2v10zM17 17h-2v-4h2v4z" />;
const BuildIcon   = () => <Ic d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />;
const GearIcon    = () => <Ic d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />;
const LogoutIcon  = () => <Ic d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />;
const MenuIcon    = () => <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
const CloseIcon   = () => <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

const NAV: NavGroup[] = [
  {
    items: [
      { id: 'dashboard', label: 'Dashboard',     icon: <GridIcon />,    href: '/dashboard' },
      { id: 'loads',     label: 'Loads',          icon: <TruckIcon />,   href: '/loads' },
      { id: 'capacity',  label: 'CarrierQ™',      icon: <BoltIcon />,    href: '/capacity' },
      { id: 'quotes',    label: 'CRM',             icon: <UsersIcon />,   href: '/quotes' },
      { id: 'customers', label: 'Customers',       icon: <UserIcon />,    href: '/customers' },
      { id: 'dispatch',  label: 'Calendar',        icon: <CalIcon />,     href: '/dispatch' },
      { id: 'email',     label: 'Email Marketing', icon: <MailIcon />,    href: '/email' },
    ],
    divider: true,
  },
  {
    label: 'Finance',
    items: [
      { id: 'accounting', label: 'Accounting', icon: <DollarIcon />, href: '/accounting', roles: ['ADMIN', 'SUPER_ADMIN', 'OPS_MANAGER', 'TEAM_MANAGER', 'ACCOUNTING', 'AUDITOR'] },
      { id: 'reports',    label: 'Reports',    icon: <ChartIcon />,  href: '/reports',    roles: ['ADMIN', 'SUPER_ADMIN', 'OPS_MANAGER', 'TEAM_MANAGER', 'ACCOUNTING', 'AUDITOR'] },
    ],
    divider: true,
  },
  {
    label: 'Operations',
    items: [
      { id: 'carriers',   label: 'Carrier Network', icon: <NetworkIcon />, href: '/carriers' },
      { id: 'compliance', label: 'Compliance',       icon: <ShieldIcon />, href: '/compliance', roles: ['ADMIN', 'SUPER_ADMIN', 'OPS_MANAGER', 'TEAM_MANAGER', 'COMPLIANCE', 'AUDITOR'] },
      { id: 'ai-hub',     label: 'AI Hub',            icon: <StarIcon />,   href: '/ai-hub',  tag: 'AI' },
      { id: 'intake',     label: 'AI Intake',         icon: <BotIcon />,    href: '/intake',  tag: 'AI' },
      { id: 'workflows',  label: 'Automation',        icon: <FlowIcon />,   href: '/workflows' },
    ],
    divider: true,
  },
  {
    label: 'System',
    items: [
      { id: 'console',       label: 'Console',        icon: <ChatIcon />,   href: '/console' },
      { id: 'announcements', label: 'Announcements',  icon: <MegaIcon />,   href: '/announcements' },
      { id: 'branding',      label: 'White Label',    icon: <PaintIcon />,  href: '/branding',  roles: ['ADMIN', 'SUPER_ADMIN'] },
      { id: 'users',         label: 'Org Management', icon: <BuildIcon />,  href: '/users',     roles: ['ADMIN', 'SUPER_ADMIN'] },
      { id: 'settings',      label: 'Settings',       icon: <GearIcon />,   href: '/settings' },
    ],
  },
];

export default function Sidebar() {
  const [open, setOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout } = useAuthStore();
  const { branding }     = useBrandingStore();

  const primary    = branding.primaryColor;
  const accent     = branding.accentColor;
  const darkBg     = branding.sidebarBg;
  const activeBg   = `${accent}28`;
  const activeText = '#ffffff';

  // Detect mobile
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setMobileOpen(false);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Close mobile sidebar on navigation
  useEffect(() => {
    if (isMobile) setMobileOpen(false);
  }, [pathname, isMobile]);

  async function handleLogout() {
    try { await api.post('/auth/logout'); } finally {
      logout();
      router.replace('/login');
    }
  }

  const initials       = user ? `${user.firstName[0]}${user.lastName[0]}` : 'U';
  const companyInitial = branding.companyName.charAt(0).toUpperCase();

  const sidebarWidth = isMobile ? 260 : (open ? 232 : 62);
  const isExpanded   = isMobile ? true : open;

  const navContent = (
    <aside style={{
      width: sidebarWidth,
      height: '100%',
      background: darkBg,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* ── Logo header ── */}
      <div style={{ padding: '14px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Hamburger / Close button */}
          <button
            onClick={() => isMobile ? setMobileOpen(false) : setOpen(o => !o)}
            title={isExpanded ? 'Collapse' : 'Expand'}
            style={{
              border: 0, background: 'rgba(255,255,255,0.1)', color: '#fff',
              cursor: 'pointer', padding: 6, borderRadius: 7,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'background 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.2)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'}
          >
            {isMobile ? <CloseIcon /> : <MenuIcon />}
          </button>

          {/* Logo / company name */}
          {isExpanded && (
            branding.logoData ? (
              <img
                src={branding.logoData}
                alt={branding.companyName}
                style={{ height: 38, maxWidth: 140, objectFit: 'contain', display: 'block' }}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{
                  width: 34, height: 34,
                  background: `linear-gradient(135deg, ${primary}, ${accent})`,
                  borderRadius: 9, display: 'grid', placeItems: 'center',
                  fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0,
                  boxShadow: `0 0 0 2px ${accent}44`,
                }}>
                  {companyInitial}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14.5, color: '#fff', letterSpacing: '-0.3px', lineHeight: 1.1 }}>
                    {branding.companyName}
                  </div>
                  <div style={{ fontSize: 9.5, color: accent, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', marginTop: 3 }}>
                    AI FREIGHT
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: isExpanded ? '10px 8px' : '10px 6px' }}>
        {NAV.map((group, gi) => {
          const visible = group.items.filter(it => !it.roles || (user && it.roles.includes(user.role)));
          if (!visible.length) return null;
          return (
            <div key={gi} style={{ marginBottom: 4 }}>
              {isExpanded && group.label && (
                <div style={{
                  fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)',
                  letterSpacing: '0.8px', textTransform: 'uppercase',
                  padding: '8px 10px 4px', whiteSpace: 'nowrap',
                }}>
                  {group.label}
                </div>
              )}
              {visible.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    title={!isExpanded ? item.label : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isExpanded ? 'flex-start' : 'center',
                      gap: 10,
                      padding: isExpanded ? '9px 12px' : '10px 0',
                      borderRadius: 8,
                      marginBottom: 1,
                      color: isActive ? activeText : 'rgba(255,255,255,0.55)',
                      fontWeight: isActive ? 600 : 400,
                      fontSize: 13.5,
                      textDecoration: 'none',
                      background: isActive ? activeBg : 'transparent',
                      transition: 'all 0.12s',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <span style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 20, flexShrink: 0,
                      color: isActive ? activeText : 'rgba(255,255,255,0.4)',
                    }}>
                      {item.icon}
                    </span>
                    {isExpanded && <span style={{ flex: 1 }}>{item.label}</span>}
                    {isExpanded && item.tag === 'AI' && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: '0.5px',
                        background: `${primary}18`, color: primary,
                        border: `1px solid ${primary}30`,
                        borderRadius: 4, padding: '1px 5px',
                      }}>AI</span>
                    )}
                  </Link>
                );
              })}
              {group.divider && (
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 4px' }} />
              )}
            </div>
          );
        })}
      </nav>

      {/* ── User footer ── */}
      {user && (
        <div style={{
          padding: isExpanded ? '12px 14px' : '10px 6px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: isExpanded ? 'flex-start' : 'center',
          gap: 10,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: `linear-gradient(135deg, ${primary}, ${accent})`,
            color: '#fff', display: 'grid', placeItems: 'center',
            fontWeight: 700, fontSize: 12, flexShrink: 0,
          }}>
            {initials}
          </div>
          {isExpanded && (
            <>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.firstName} {user.lastName}
                </div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{user.role}</div>
              </div>
              <button
                onClick={handleLogout}
                title="Logout"
                style={{ border: 0, background: 'transparent', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 6, borderRadius: 6, display: 'flex', flexShrink: 0 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.15)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <LogoutIcon />
              </button>
            </>
          )}
        </div>
      )}
    </aside>
  );

  if (isMobile) {
    return (
      <>
        {/* Mobile hamburger button (fixed, always visible) */}
        {!mobileOpen && (
          <button
            onClick={() => setMobileOpen(true)}
            style={{
              position: 'fixed', top: 12, left: 12, zIndex: 1100,
              width: 40, height: 40, borderRadius: 10,
              background: darkBg, border: 'none', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
            }}
          >
            <MenuIcon />
          </button>
        )}

        {/* Backdrop */}
        {mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 1099,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(2px)',
            }}
          />
        )}

        {/* Drawer */}
        <div style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 1100,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s cubic-bezier(.4,0,.2,1)',
          height: '100vh',
        }}>
          {navContent}
        </div>
      </>
    );
  }

  // Desktop: normal sidebar
  return (
    <div style={{
      width: open ? 232 : 62,
      minHeight: '100vh',
      flexShrink: 0,
      transition: 'width 0.22s cubic-bezier(.4,0,.2,1)',
      overflow: 'hidden',
    }}>
      {navContent}
    </div>
  );
}
