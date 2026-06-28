'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useBrandingStore } from '@/store/branding.store';
import api from '@/lib/api';

let _cachedCarrier: { name: string; mcNumber: string } | null = null;

const GridIcon   = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>;
const TruckIcon  = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3"/><rect x="9" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/></svg>;
const DocIcon    = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
const GearIcon   = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
const LogoutIcon = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const MenuIcon   = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
const CloseIcon  = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

const BoardIcon   = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="17" width="11" height="4" rx="1"/></svg>;
const MoneyIcon   = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>;
const ChatIcon    = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>;

const NAV_MAIN = [
  { id: 'dashboard', label: 'Dashboard',       icon: <GridIcon />,  href: '/carrier' },
  { id: 'available', label: 'Available Loads',  icon: <BoardIcon />, href: '/carrier/available' },
  { id: 'loads',     label: 'My Loads',         icon: <TruckIcon />, href: '/carrier/loads' },
  { id: 'documents', label: 'Documents',        icon: <DocIcon />,   href: '/carrier/documents' },
  { id: 'payments',  label: 'Payments',         icon: <MoneyIcon />, href: '/carrier/payments' },
  { id: 'messages',  label: 'Messages',         icon: <ChatIcon />,  href: '/carrier/messages' },
];
const NAV_BOTTOM = [
  { id: 'settings', label: 'Account Settings', icon: <GearIcon />, href: '/carrier/settings' },
];

export default function CarrierSidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout } = useAuthStore();
  const { branding }     = useBrandingStore();
  const [open, setOpen]   = useState(true);
  const [mobile, setMobile] = useState(false);
  const [carrierInfo, setCarrierInfo] = useState(_cachedCarrier);

  useEffect(() => {
    api.get('/carrier-portal/me').then(r => {
      if (r.data.carrier) {
        _cachedCarrier = { name: r.data.carrier.name, mcNumber: r.data.carrier.mcNumber };
        setCarrierInfo(_cachedCarrier);
      }
    }).catch(() => {});
  }, [user?.id]);

  const primaryColor = branding.primaryColor;
  const accentColor  = branding.accentColor;
  const sidebarBg    = branding.sidebarBg;

  useEffect(() => {}, []);
  useEffect(() => {
    const check = () => {
      const isMobile = window.innerWidth < 768;
      setMobile(isMobile);
      if (isMobile) setOpen(false); else setOpen(true);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  function handleLogout() {
    logout();
    router.replace('/carrier-login');
  }

  const dark    = sidebarBg    || '#0f172a';
  const primary = primaryColor || '#f59e0b';
  const accent  = accentColor  || '#d97706';

  const companyName    = carrierInfo?.name ?? 'Carrier Portal';
  const companyInitial = companyName[0]?.toUpperCase() ?? 'C';
  const userInitials   = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  function isActive(href: string) {
    if (href === '/carrier') return pathname === '/carrier';
    return pathname.startsWith(href);
  }

  const sidebar = (
    <div style={{
      width: open ? 232 : 62, minHeight: '100vh', background: dark,
      display: 'flex', flexDirection: 'column', transition: 'width 0.25s ease',
      overflow: 'hidden', flexShrink: 0,
      position: mobile ? 'fixed' : 'relative', zIndex: mobile ? 200 : undefined,
      transform: mobile && !open ? 'translateX(-100%)' : 'translateX(0)',
    }}>
      {/* Header */}
      <div style={{ padding: open ? '18px 16px 14px' : '18px 0 14px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: open ? 'space-between' : 'center', borderBottom: `1px solid rgba(255,255,255,0.07)` }}>
        {open && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg,${primary},${accent})`, display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
              {companyInitial}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 13, letterSpacing: '-0.3px', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
                {companyName}
              </div>
              {carrierInfo?.mcNumber && (
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 600, letterSpacing: '0.5px' }}>MC# {carrierInfo.mcNumber}</div>
              )}
            </div>
          </div>
        )}
        <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 4, display: 'flex', borderRadius: 6 }}>
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_MAIN.map(item => {
          const active = isActive(item.href);
          return (
            <button key={item.id} onClick={() => { router.push(item.href); if (mobile) setOpen(false); }} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: open ? '9px 12px' : '9px 0', justifyContent: open ? 'flex-start' : 'center',
              background: active ? `${primary}22` : 'transparent',
              border: 'none', borderRadius: 8, cursor: 'pointer', width: '100%',
              color: active ? primary : 'rgba(255,255,255,0.55)',
              fontWeight: active ? 700 : 500, fontSize: 13,
              borderLeft: active ? `3px solid ${primary}` : '3px solid transparent',
              transition: 'all 0.15s',
            }}>
              <span style={{ flexShrink: 0 }}>{item.icon}</span>
              {open && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Bottom nav */}
      <div style={{ padding: '8px 8px 4px', borderTop: `1px solid rgba(255,255,255,0.07)` }}>
        {NAV_BOTTOM.map(item => {
          const active = isActive(item.href);
          return (
            <button key={item.id} onClick={() => { router.push(item.href); if (mobile) setOpen(false); }} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: open ? '9px 12px' : '9px 0', justifyContent: open ? 'flex-start' : 'center',
              background: active ? `${primary}22` : 'transparent',
              border: 'none', borderRadius: 8, cursor: 'pointer', width: '100%',
              color: active ? primary : 'rgba(255,255,255,0.55)',
              fontWeight: active ? 700 : 500, fontSize: 13,
              borderLeft: active ? `3px solid ${primary}` : '3px solid transparent',
            }}>
              <span style={{ flexShrink: 0 }}>{item.icon}</span>
              {open && <span>{item.label}</span>}
            </button>
          );
        })}
      </div>

      {/* User footer */}
      <div style={{ padding: open ? '12px 14px' : '12px 6px', borderTop: `1px solid rgba(255,255,255,0.07)`, display: 'flex', alignItems: 'center', gap: 10, justifyContent: open ? 'space-between' : 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg,${primary},${accent})`, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
            {userInitials}
          </div>
          {open && (
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#fff', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>{user?.firstName} {user?.lastName}</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{companyName}</div>
            </div>
          )}
        </div>
        {open && (
          <button onClick={handleLogout} title="Logout" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', padding: 4, display: 'flex', borderRadius: 6, transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}>
            <LogoutIcon />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {sidebar}
      {mobile && open && <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', zIndex: 199 }} />}
    </>
  );
}
