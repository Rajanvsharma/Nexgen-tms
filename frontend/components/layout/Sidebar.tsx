'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore, type Role } from '@/store/auth.store';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  href: string;
  tag?: string;
  roles?: Role[];
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    group: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: '⬡', href: '/dashboard' },
    ],
  },
  {
    group: 'Sales',
    items: [
      { id: 'intake', label: 'AI Intake', icon: '✦', href: '/intake', tag: 'AI' },
      { id: 'quotes', label: 'Quotations', icon: '◎', href: '/quotes' },
      { id: 'loads', label: 'Loads', icon: '▸', href: '/loads' },
    ],
  },
  {
    group: 'Operations',
    items: [
      { id: 'dispatch', label: 'Dispatch Board', icon: '⊞', href: '/dispatch' },
      { id: 'loadboard', label: 'Load Boards', icon: '↥', href: '/loadboard' },
    ],
  },
  {
    group: 'Network',
    items: [
      { id: 'carriers', label: 'Carrier Database', icon: '◈', href: '/carriers' },
      { id: 'match', label: 'Smart Matching', icon: '✦', href: '/match', tag: 'AI' },
    ],
  },
  {
    group: 'Risk & Compliance',
    items: [
      { id: 'compliance', label: 'Compliance', icon: '✓', href: '/compliance', roles: ['ADMIN', 'COMPLIANCE'] },
      { id: 'scorecard', label: 'Carrier Scorecard', icon: '★', href: '/scorecard' },
    ],
  },
  {
    group: 'Finance',
    items: [
      { id: 'accounting', label: 'Accounting', icon: '$', href: '/accounting', roles: ['ADMIN', 'ACCOUNTING'] },
      { id: 'reports', label: 'Reports & KPIs', icon: '▦', href: '/reports', roles: ['ADMIN', 'ACCOUNTING'] },
    ],
  },
  {
    group: 'AI Tools',
    items: [
      { id: 'workflows', label: 'Workflow Builder', icon: '⟳', href: '/workflows', tag: 'AI' },
      { id: 'ocr', label: 'OCR Upload', icon: '⊡', href: '/ocr' },
      { id: 'email', label: 'Email Inbox', icon: '✉', href: '/email' },
      { id: 'documents', label: 'Documents', icon: '⊟', href: '/documents' },
    ],
  },
  {
    group: 'Portals',
    items: [
      { id: 'customers', label: 'Customers', icon: '◉', href: '/customers' },
      { id: 'portal_customer', label: 'Customer Portal', icon: '⊙', href: '/customer-portal' },
      { id: 'portal_carrier', label: 'Carrier Portal', icon: '⊚', href: '/carrier-portal' },
    ],
  },
  {
    group: 'Admin',
    items: [
      { id: 'announcements', label: 'Announcements', icon: '◎', href: '/announcements' },
      { id: 'users', label: 'Users & Access', icon: '◯', href: '/users', roles: ['ADMIN'] },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  return (
    <aside style={{ width: 236, minHeight: '100vh', background: '#fff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 18px', height: 56, borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ width: 26, height: 26, background: '#1d4ed8', borderRadius: 6, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>N</div>
        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px' }}>NexGen</span>
        <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', marginLeft: 'auto' }}>TMS</span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 30px' }}>
        {NAV.map((section) => {
          const visible = section.items.filter((it) => !it.roles || (user && it.roles.includes(user.role)));
          if (!visible.length) return null;
          return (
            <div key={section.group}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.8px', color: '#94a3b8', textTransform: 'uppercase', padding: '14px 10px 5px' }}>
                {section.group}
              </div>
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
                      padding: '8px 10px',
                      borderRadius: 7,
                      marginBottom: 1,
                      border: '1px solid transparent',
                      color: isActive ? '#1e40af' : '#475569',
                      fontWeight: isActive ? 600 : 500,
                      fontSize: 13,
                      textDecoration: 'none',
                      background: isActive ? '#eff6ff' : 'transparent',
                      borderColor: isActive ? '#dbe5ff' : 'transparent',
                      transition: 'all 0.1s',
                    }}
                  >
                    <span style={{ width: 18, textAlign: 'center', fontSize: 14, opacity: 0.85 }}>{item.icon}</span>
                    {item.label}
                    {item.tag && (
                      <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, background: '#1d4ed8', color: '#fff', borderRadius: 5, padding: '1px 5px' }}>
                        {item.tag}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User */}
      {user && (
        <div style={{ padding: '12px 18px', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1e40af', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#15202b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.firstName} {user.lastName}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>{user.role}</div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
