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
  badge?: string;
}

interface NavGroup {
  group: string;
  items: NavItem[];
  roles?: Role[]; // hide entire group if role doesn't match
}

const NAV: NavGroup[] = [
  // ── Overview ───────────────────────────────────────
  {
    group: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard',     icon: '▦', href: '/dashboard' },
      { id: 'ai-hub',    label: 'AI Command Hub', icon: '✦', href: '/ai-hub', tag: 'AI' },
    ],
  },

  // ── Sales Pipeline ─────────────────────────────────
  {
    group: 'Sales',
    items: [
      { id: 'intake',    label: 'AI Intake',       icon: '⊕', href: '/intake',    tag: 'AI' },
      { id: 'email',     label: 'Email Inbox',     icon: '✉', href: '/email' },
      { id: 'ocr',       label: 'OCR / Screenshot', icon: '⊡', href: '/ocr' },
      { id: 'quotes',    label: 'Quotations',      icon: '◎', href: '/quotes' },
      { id: 'customers', label: 'Customers',       icon: '◉', href: '/customers' },
    ],
  },

  // ── Operations ─────────────────────────────────────
  {
    group: 'Operations',
    items: [
      { id: 'capacity',  label: 'Capacity Hub',    icon: '⚡', href: '/capacity', tag: 'NEW' },
      { id: 'loads',     label: 'Loads',           icon: '▸', href: '/loads' },
      { id: 'dispatch',  label: 'Dispatch Board',  icon: '⊞', href: '/dispatch' },
      { id: 'loadboard', label: 'Load Boards',     icon: '↥', href: '/loadboard' },
      { id: 'documents', label: 'Documents & PDFs', icon: '⊟', href: '/documents' },
    ],
  },

  // ── Carrier Network ────────────────────────────────
  {
    group: 'Carrier Network',
    items: [
      { id: 'carriers',  label: 'Carrier Database',  icon: '◈', href: '/carriers' },
      { id: 'match',     label: 'Smart Matching',     icon: '✦', href: '/match',     tag: 'AI' },
      { id: 'scorecard', label: 'Carrier Scorecard',  icon: '★', href: '/scorecard' },
    ],
  },

  // ── Risk & Compliance ──────────────────────────────
  {
    group: 'Risk & Compliance',
    roles: ['ADMIN', 'COMPLIANCE'],
    items: [
      { id: 'compliance', label: 'Compliance Monitor', icon: '✓', href: '/compliance' },
    ],
  },

  // ── Finance ────────────────────────────────────────
  {
    group: 'Finance',
    roles: ['ADMIN', 'ACCOUNTING'],
    items: [
      { id: 'accounting', label: 'Accounting & Billing', icon: '$', href: '/accounting' },
      { id: 'reports',    label: 'Reports & KPIs',       icon: '▤', href: '/reports' },
    ],
  },

  // ── AI & Automation ────────────────────────────────
  {
    group: 'AI & Automation',
    items: [
      { id: 'workflows', label: 'Workflow Builder', icon: '⟳', href: '/workflows', tag: 'AI' },
    ],
  },

  // ── Portals ────────────────────────────────────────
  {
    group: 'Portals',
    items: [
      { id: 'customer-portal', label: 'Customer Portal', icon: '⊙', href: '/customer-portal' },
      { id: 'carrier-portal',  label: 'Carrier Portal',  icon: '⊚', href: '/carrier-portal' },
    ],
  },

  // ── Admin ──────────────────────────────────────────
  {
    group: 'Admin',
    items: [
      { id: 'announcements', label: 'Announcements',  icon: '◎', href: '/announcements' },
      { id: 'users',         label: 'Users & Access', icon: '◯', href: '/users', roles: ['ADMIN'] },
    ],
  },
];

// Role-aware descriptions shown under each group name
const GROUP_DESC: Record<string, Partial<Record<Role, string>>> = {
  Finance: {
    ACCOUNTING: 'Your billing workspace',
    ADMIN: 'Full financial view',
  },
  'Risk & Compliance': {
    COMPLIANCE: 'Your compliance workspace',
    ADMIN: 'Carrier risk & docs',
  },
};

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  return (
    <aside style={{
      width: 240,
      minHeight: '100vh',
      background: '#fff',
      borderRight: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>

      {/* ── Brand ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 16px', height: 56, borderBottom: '1px solid #e2e8f0', flexShrink: 0,
      }}>
        <div style={{
          width: 28, height: 28, background: '#1d4ed8', borderRadius: 7,
          display: 'grid', placeItems: 'center', color: '#fff',
          fontWeight: 800, fontSize: 15, flexShrink: 0, letterSpacing: '-0.5px',
        }}>N</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px', lineHeight: 1.1 }}>NexGen</div>
          <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase' }}>TMS Platform</div>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 24px' }}>
        {NAV.map((section) => {
          // Filter group by top-level roles
          if (section.roles && user && !section.roles.includes(user.role)) return null;

          // Filter items by item-level roles
          const visible = section.items.filter(
            (it) => !it.roles || (user && it.roles.includes(user.role))
          );
          if (!visible.length) return null;

          const desc = user ? GROUP_DESC[section.group]?.[user.role] : undefined;

          return (
            <div key={section.group} style={{ marginBottom: 4 }}>
              {/* Group header */}
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.9px',
                color: '#94a3b8', textTransform: 'uppercase',
                padding: '12px 10px 4px',
                display: 'flex', alignItems: 'baseline', gap: 6,
              }}>
                {section.group}
                {desc && (
                  <span style={{ fontSize: 9, fontWeight: 500, color: '#cbd5e1', letterSpacing: '0.3px', textTransform: 'none' }}>
                    — {desc}
                  </span>
                )}
              </div>

              {/* Items */}
              {visible.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9,
                      padding: '7px 10px', borderRadius: 7, marginBottom: 1,
                      border: `1px solid ${isActive ? '#dbe5ff' : 'transparent'}`,
                      color: isActive ? '#1e40af' : '#475569',
                      fontWeight: isActive ? 600 : 500,
                      fontSize: 13,
                      textDecoration: 'none',
                      background: isActive ? '#eff6ff' : 'transparent',
                      transition: 'background 0.1s, color 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.background = '#f8fafc';
                        (e.currentTarget as HTMLElement).style.color = '#15202b';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = '#475569';
                      }
                    }}
                  >
                    {/* Icon */}
                    <span style={{
                      width: 20, textAlign: 'center', fontSize: 13,
                      opacity: isActive ? 1 : 0.7, flexShrink: 0,
                    }}>
                      {item.icon}
                    </span>

                    {/* Label */}
                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.label}
                    </span>

                    {/* AI tag */}
                    {item.tag === 'AI' && (
                      <span style={{
                        fontSize: 9, fontWeight: 700,
                        background: isActive ? '#1d4ed8' : '#eff6ff',
                        color: isActive ? '#fff' : '#1d4ed8',
                        border: '1px solid #dbe5ff',
                        borderRadius: 4, padding: '1px 5px',
                        flexShrink: 0,
                      }}>AI</span>
                    )}
                    {/* NEW tag */}
                    {item.tag === 'NEW' && (
                      <span style={{
                        fontSize: 9, fontWeight: 700,
                        background: '#15803d', color: '#fff',
                        borderRadius: 4, padding: '1px 5px',
                        flexShrink: 0,
                      }}>NEW</span>
                    )}

                    {/* Badge */}
                    {item.badge && (
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        background: '#b91c1c', color: '#fff',
                        borderRadius: 10, padding: '1px 6px',
                        flexShrink: 0,
                      }}>{item.badge}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* ── User footer ── */}
      {user && (
        <div style={{
          padding: '12px 14px', borderTop: '1px solid #e2e8f0', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#1e40af', color: '#fff',
              display: 'grid', placeItems: 'center',
              fontWeight: 700, fontSize: 12, flexShrink: 0,
            }}>
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{
                fontSize: 12, fontWeight: 600, color: '#15202b',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {user.firstName} {user.lastName}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{user.role}</div>
            </div>
            <div style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px',
              background: '#eff6ff', color: '#1e40af',
              border: '1px solid #dbe5ff', borderRadius: 20,
              flexShrink: 0,
            }}>
              {user.role === 'ADMIN' ? 'Admin' :
               user.role === 'DISPATCHER' ? 'Disp' :
               user.role === 'ACCOUNTING' ? 'Acct' : 'Comp'}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
