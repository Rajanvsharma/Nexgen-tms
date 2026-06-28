'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useBrandingStore } from '@/store/branding.store';
import api from '@/lib/api';

// ── Inline SVG icons (same style as main Sidebar) ─────────────────────────────
const Ic = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const GridIcon   = () => <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
const TruckIcon  = () => <Ic d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM18.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />;
const ChatIcon   = () => <Ic d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />;
const DocIcon    = () => <Ic d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" />;
const DollarIcon = () => <Ic d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />;
const GearIcon   = () => <Ic d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />;
const LogoutIcon = () => <Ic d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />;
const MenuIcon   = () => <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
const CloseIcon  = () => <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

const NAV_MAIN = [
  { id: 'dashboard',  label: 'Dashboard',       icon: <GridIcon />,   href: '/shipper' },
  { id: 'shipments',  label: 'My Shipments',     icon: <TruckIcon />,  href: '/shipper/shipments' },
  { id: 'new-quote',  label: 'Request a Quote',  icon: <ChatIcon />,   href: '/shipper/new-quote' },
  { id: 'documents',  label: 'Documents',        icon: <DocIcon />,    href: '/shipper/documents' },
  { id: 'invoices',   label: 'Invoices',         icon: <DollarIcon />, href: '/shipper/invoices' },
];

const NAV_BOTTOM = [
  { id: 'settings', label: 'Account Settings', icon: <GearIcon />, href: '/shipper/settings' },
];

export default function ShipperSidebar() {
  const [open, setOpen]           = useState(true);
  const [isMobile, setIsMobile]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const pathname         = usePathname();
  const router           = useRouter();
  const { user, logout } = useAuthStore();
  const { branding }     = useBrandingStore();

  const primary    = branding.primaryColor;
  const accent     = branding.accentColor;
  const darkBg     = branding.sidebarBg;
  const activeBg   = `${accent}28`;
  const activeText = '#ffffff';

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

  useEffect(() => {
    if (isMobile) setMobileOpen(false);
  }, [pathname, isMobile]);

  async function handleLogout() {
    try { await api.post('/auth/logout'); } finally {
      logout();
      router.replace('/shipper-login');
    }
  }

  const initials       = user ? `${user.firstName[0]}${user.lastName[0]}` : 'U';
  const companyInitial = branding.companyName.charAt(0).toUpperCase();
  const isExpanded     = isMobile ? true : open;

  function isActive(href: string) {
    return href === '/shipper' ? pathname === '/shipper' : pathname.startsWith(href);
  }

  function NavLink({ id, label, icon, href }: { id: string; label: string; icon: React.ReactNode; href: string }) {
    const active = isActive(href);
    return (
      <Link
        key={id}
        href={href}
        title={!isExpanded ? label : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isExpanded ? 'flex-start' : 'center',
          gap: 10,
          padding: isExpanded ? '9px 12px' : '10px 0',
          borderRadius: 8,
          marginBottom: 1,
          color: active ? activeText : 'rgba(255,255,255,0.55)',
          fontWeight: active ? 600 : 400,
          fontSize: 13.5,
          textDecoration: 'none',
          background: active ? activeBg : 'transparent',
          transition: 'all 0.12s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; }}
        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, flexShrink: 0, color: active ? activeText : 'rgba(255,255,255,0.4)' }}>
          {icon}
        </span>
        {isExpanded && <span style={{ flex: 1 }}>{label}</span>}
      </Link>
    );
  }

  const sidebarContent = (
    <aside style={{ width: isMobile ? 260 : (open ? 232 : 62), height: '100%', background: darkBg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Logo header ── */}
      <div style={{ padding: '14px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => isMobile ? setMobileOpen(false) : setOpen(o => !o)}
            title={isExpanded ? 'Collapse' : 'Expand'}
            style={{ border: 0, background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', padding: 6, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.12s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.2)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'}
          >
            {isMobile ? <CloseIcon /> : <MenuIcon />}
          </button>

          {isExpanded && (
            branding.logoData ? (
              <img src={branding.logoData} alt={branding.companyName} style={{ height: 38, maxWidth: 140, objectFit: 'contain' }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 34, height: 34, background: `linear-gradient(135deg, ${primary}, ${accent})`, borderRadius: 9, display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0, boxShadow: `0 0 0 2px ${accent}44` }}>
                  {companyInitial}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14.5, color: '#fff', letterSpacing: '-0.3px', lineHeight: 1.1 }}>{branding.companyName}</div>
                  <div style={{ fontSize: 9.5, color: accent, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', marginTop: 3 }}>SHIPPER PORTAL</div>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: isExpanded ? '10px 8px' : '10px 6px' }}>
        {NAV_MAIN.map(item => <NavLink key={item.id} {...item} />)}

        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 4px' }} />

        {isExpanded && (
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.8px', textTransform: 'uppercase', padding: '8px 10px 4px', whiteSpace: 'nowrap' }}>
            Account
          </div>
        )}
        {NAV_BOTTOM.map(item => <NavLink key={item.id} {...item} />)}
      </nav>

      {/* ── User footer ── */}
      {user && (
        <div style={{ padding: isExpanded ? '12px 14px' : '10px 6px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: isExpanded ? 'flex-start' : 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg, ${primary}, ${accent})`, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
            {initials}
          </div>
          {isExpanded && (
            <>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.firstName} {user.lastName}</div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Shipper</div>
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
        {!mobileOpen && (
          <button
            onClick={() => setMobileOpen(true)}
            style={{ position: 'fixed', top: 12, left: 12, zIndex: 1100, width: 40, height: 40, borderRadius: 10, background: darkBg, border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.25)' }}
          >
            <MenuIcon />
          </button>
        )}
        {mobileOpen && (
          <div onClick={() => setMobileOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1099, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} />
        )}
        <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 1100, transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.25s cubic-bezier(.4,0,.2,1)', height: '100vh' }}>
          {sidebarContent}
        </div>
      </>
    );
  }

  return (
    <div style={{ width: open ? 232 : 62, minHeight: '100vh', flexShrink: 0, transition: 'width 0.22s cubic-bezier(.4,0,.2,1)', overflow: 'hidden' }}>
      {sidebarContent}
    </div>
  );
}
