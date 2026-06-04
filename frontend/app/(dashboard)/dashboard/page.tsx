'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Stats {
  activeLoads?: number; pendingInvoices?: number; pendingQuotes?: number;
  complianceAlerts?: number; totalUsers?: number; revenueThisMonth?: number;
  myActiveLoads?: number; loadsThisMonth?: number;
  overduePayments?: number; paidThisMonth?: number;
  expiringInsurance?: number; expiringAuthority?: number; compliantCarriers?: number;
}
interface Announcement {
  id: string; title: string; body: string; postedBy: string; posterRole: string; createdAt: string; isRead: boolean;
}
interface AgentLog {
  id: string; agentName: string; status: string; summary: string | null; startedAt: string; findings: number;
}

// ─── World Clocks ─────────────────────────────────────────────────────────────
const ZONES = [
  { label: 'Pacific', sub: 'Los Angeles', tz: 'America/Los_Angeles' },
  { label: 'Mountain', sub: 'Arizona', tz: 'America/Phoenix' },
  { label: 'Central', sub: 'Texas', tz: 'America/Chicago' },
  { label: 'Eastern', sub: 'New York', tz: 'America/New_York' },
  { label: 'India', sub: 'IST', tz: 'Asia/Kolkata' },
];

function WorldClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>🕐</span>
        <span style={{ fontWeight: 700, fontSize: 15 }}>World Clocks</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
        {ZONES.map((z, i) => {
          const fmt = new Intl.DateTimeFormat('en-US', { timeZone: z.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
          const dfmt = new Intl.DateTimeFormat('en-US', { timeZone: z.tz, weekday: 'short', month: 'short', day: 'numeric' });
          return (
            <div key={z.tz} style={{ border: `1px solid ${i === 0 ? '#3b82f6' : '#e2e8f0'}`, borderRadius: 8, padding: '12px 14px', background: i === 0 ? '#eff6ff' : '#fff' }}>
              <div style={{ fontSize: 11, color: i === 0 ? '#1d4ed8' : '#94a3b8', fontWeight: 600, marginBottom: 2 }}>{z.label} — {z.sub}</div>
              <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 18, fontWeight: 700, color: i === 0 ? '#1d4ed8' : '#15202b', letterSpacing: '-0.5px' }}>{fmt.format(time)}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{dfmt.format(time)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Quick Actions ─────────────────────────────────────────────────────────────
const QUICK = [
  { icon: '◈', label: 'Onboard Carrier', sub: 'Add new carrier to network', href: '/carriers', bg: '#1e293b', color: '#fff' },
  { icon: '◉', label: 'Invite Shipper',  sub: 'Send shipper invitation',    href: '/customers', bg: '#2563eb', color: '#fff' },
  { icon: '$', label: 'Create Quote',    sub: 'Generate rate quote',         href: '/quotes',   bg: '#16a34a', color: '#fff' },
  { icon: '▸', label: 'Create Load',    sub: 'Book a new shipment',          href: '/capacity', bg: '#d97706', color: '#fff' },
];

// ─── Trend pill ───────────────────────────────────────────────────────────────
function Trend({ pct }: { pct: number }) {
  const up = pct >= 0;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: up ? '#16a34a' : '#dc2626', background: up ? '#dcfce7' : '#fee2e2', borderRadius: 20, padding: '2px 7px' }}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [loads, setLoads] = useState<{ loadNumber: string; status: string; pickupCity: string; deliveryCity: string; customer: { name: string } }[]>([]);

  const loadData = useCallback(async () => {
    const [statsRes, annRes, agentRes, loadsRes] = await Promise.allSettled([
      api.get('/stats'),
      api.get('/announcements'),
      api.get('/ai/agent-logs'),
      api.get('/loads'),
    ]);
    if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
    if (annRes.status === 'fulfilled') setAnnouncements(annRes.value.data.slice(0, 5));
    if (agentRes.status === 'fulfilled') setAgentLogs(agentRes.value.data.slice(0, 5));
    if (loadsRes.status === 'fulfilled') setLoads(loadsRes.value.data.slice(0, 5));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const unread = announcements.filter(a => !a.isRead).length;

  // KPI cards
  const kpi = [
    { label: 'Total Loads Booked', value: (stats.activeLoads ?? 0) + (stats.loadsThisMonth ?? 0), trend: 0.7, icon: '▸' },
    { label: 'Total Revenue', value: `$${((stats.revenueThisMonth ?? 0)).toLocaleString()}`, trend: 3.5, icon: '$' },
    { label: 'Gross Margin ($)', value: `$${Math.round((stats.revenueThisMonth ?? 0) * 0.142).toLocaleString()}`, trend: -0.9, icon: '▤' },
    { label: 'Gross Margin (%)', value: '14.2%', trend: 0.9, icon: '◎' },
    { label: 'Avg Margin / Load', value: `$${stats.activeLoads ? Math.round(((stats.revenueThisMonth ?? 0) * 0.142) / (stats.activeLoads || 1)) : 0}`, trend: 1.5, icon: '$' },
  ];

  // Live ops cards
  const ops = [
    { label: 'Loads In Transit',   sub: 'Scheduled Pickups',    value: stats.activeLoads ?? '—',         icon: '🚛', color: '#3b82f6' },
    { label: 'Loads Pickup Today', sub: 'Scheduled Pickups',    value: Math.floor((stats.activeLoads ?? 0) * 0.4) || '—', icon: '📦', color: '#16a34a' },
    { label: 'Delivery Today',     sub: 'Scheduled Deliveries', value: Math.floor((stats.activeLoads ?? 0) * 0.3) || '—', icon: '✅', color: '#16a34a' },
    { label: 'Loads at Risk',      sub: 'Needs attention',      value: stats.complianceAlerts ?? '—',    icon: '⚠', color: '#f59e0b' },
    { label: 'Pending Quotes',     sub: 'Awaiting approval',    value: stats.pendingQuotes ?? '—',       icon: '◎', color: '#8b5cf6' },
  ];

  // Market pulse (simulated)
  const hotLanes = [
    { lane: 'Los Angeles → Dallas', rate: '$2.36/mi' },
    { lane: 'Chicago → Atlanta',    rate: '$2.34/mi' },
    { lane: 'Dallas → Houston',     rate: '$3.55/mi' },
  ];

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#f1f5f9' }}>

      {/* ── Topbar ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#15202b' }}>Dashboard</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Notification bell */}
          <button onClick={() => router.push('/announcements')} style={{ position: 'relative', border: '1px solid #e2e8f0', background: '#fff', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 16 }}>
            🔔
            {unread > 0 && <span style={{ position: 'absolute', top: -4, right: -4, background: '#dc2626', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 10, padding: '1px 5px', border: '2px solid #fff' }}>{unread}</span>}
          </button>
          {/* Company brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg,#1d4ed8,#0e7490)', borderRadius: 6, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 12 }}>
              {user?.firstName?.[0] || 'N'}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#15202b' }}>{user?.firstName} {user?.lastName}</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>NexGen Logistics</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 24px 60px' }}>

        {/* ── World Clocks ── */}
        <WorldClock />

        {/* ── Quick Actions ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: '#15202b' }}>Quick Actions</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {QUICK.map(q => (
              <button key={q.label} onClick={() => router.push(q.href)} style={{
                background: q.bg, borderRadius: 10, padding: '16px 18px', border: 0,
                color: q.color, cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 14,
                transition: 'transform 0.1s, box-shadow 0.1s',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.18)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)'; }}
              >
                <div style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.18)', borderRadius: 8, display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0 }}>{q.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{q.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{q.sub}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Today at a Glance ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: '#15202b' }}>Today at a Glance</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
            {kpi.map(k => (
              <div key={k.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ width: 32, height: 32, background: '#eff6ff', borderRadius: 7, display: 'grid', placeItems: 'center', fontSize: 14, color: '#1d4ed8' }}>{k.icon}</div>
                  <Trend pct={k.trend} />
                </div>
                <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 22, fontWeight: 700, color: '#15202b', marginBottom: 2 }}>{k.value}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>{k.label}</div>
                <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 2 }}>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Live Operations Snapshot ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: '#15202b' }}>Live Operations Snapshot</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
            {ops.map(o => (
              <div key={o.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, background: `${o.color}18`, borderRadius: 8, display: 'grid', placeItems: 'center', fontSize: 18 }}>{o.icon}</div>
                  <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 26, fontWeight: 800, color: '#15202b' }}>{o.value}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#15202b' }}>{o.label}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{o.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom Row: Market Pulse | Recent Loads | Notifications ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr', gap: 16 }}>

          {/* Market Pulse */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
              📊 Market Pulse
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>Load to Truck Ratio</div>
                <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontWeight: 700, fontSize: 16, color: '#15202b' }}>$2.45/mi</div>
              </div>
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>Spot Rate Avg</div>
                <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontWeight: 700, fontSize: 16, color: '#15202b' }}>
                  $2.45/mi <span style={{ fontSize: 10, color: '#16a34a' }}>+0.1%</span>
                </div>
              </div>
            </div>
            <div style={{ fontWeight: 600, fontSize: 12, color: '#475569', marginBottom: 8 }}>🔥 Hot Lanes Today</div>
            {hotLanes.map(l => (
              <div key={l.lane} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 12, color: '#475569' }}>{l.lane}</span>
                <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontWeight: 700, fontSize: 12, color: '#16a34a' }}>{l.rate}</span>
              </div>
            ))}
            <button onClick={() => router.push('/match')} style={{ marginTop: 12, width: '100%', border: '1px solid #dbe5ff', background: '#eff6ff', color: '#1d4ed8', borderRadius: 7, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Find Carriers for Hot Lanes →
            </button>
          </div>

          {/* Recent Loads (Messages equivalent) */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>📋 Recent Loads</div>
              <button onClick={() => router.push('/loads')} style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#1d4ed8' }}>
                + New Load
              </button>
            </div>
            {loads.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No loads yet. Create your first load.</div>
            ) : (
              loads.map(l => {
                const statusColors: Record<string, string> = { CREATED: '#94a3b8', DISPATCHED: '#8b5cf6', IN_TRANSIT: '#0ea5e9', DELIVERED: '#16a34a', INVOICED: '#d97706', CANCELLED: '#dc2626' };
                return (
                  <div key={l.loadNumber} onClick={() => router.push('/loads')} style={{ padding: '12px 16px', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <div style={{ width: 38, height: 38, background: `${statusColors[l.status] || '#94a3b8'}18`, borderRadius: 8, display: 'grid', placeItems: 'center', fontSize: 16, flexShrink: 0 }}>🚛</div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#15202b', fontFamily: 'IBM Plex Mono,monospace' }}>{l.loadNumber}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {l.customer.name} · {l.pickupCity} → {l.deliveryCity}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${statusColors[l.status] || '#94a3b8'}18`, color: statusColors[l.status] || '#94a3b8', whiteSpace: 'nowrap' }}>
                      {l.status.replace('_', ' ')}
                    </span>
                  </div>
                );
              })
            )}
            <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9' }}>
              <button onClick={() => router.push('/loads')} style={{ border: 0, background: 'none', color: '#1d4ed8', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>View all loads →</button>
            </div>
          </div>

          {/* Notifications */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>🔔 Notifications</span>
              {unread > 0 && <span style={{ background: '#dc2626', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 10, padding: '2px 6px' }}>{unread} new</span>}
            </div>

            {/* Agent alerts */}
            {agentLogs.filter(l => l.findings > 0).slice(0, 2).map(log => (
              <div key={log.id} style={{ padding: '11px 16px', borderBottom: '1px solid #f8fafc', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, background: '#fef6e7', borderRadius: 8, display: 'grid', placeItems: 'center', fontSize: 14, flexShrink: 0 }}>⚡</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#15202b' }}>{log.agentName}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1, lineHeight: 1.3 }}>{log.summary?.slice(0, 60)}…</div>
                  <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 3 }}>{new Date(log.startedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3b82f6', flexShrink: 0, marginTop: 4 }} />
              </div>
            ))}

            {/* Announcements */}
            {announcements.slice(0, 3).map(ann => (
              <div key={ann.id} onClick={() => router.push('/announcements')} style={{ padding: '11px 16px', borderBottom: '1px solid #f8fafc', display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <div style={{ width: 32, height: 32, background: ann.isRead ? '#f1f5f9' : '#eff6ff', borderRadius: 8, display: 'grid', placeItems: 'center', fontSize: 14, flexShrink: 0 }}>
                  {ann.posterRole === 'COMPLIANCE' ? '🛡' : ann.posterRole === 'ACCOUNTING' ? '💰' : '📢'}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 12, fontWeight: ann.isRead ? 400 : 600, color: '#15202b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ann.title}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{new Date(ann.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                {!ann.isRead && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3b82f6', flexShrink: 0, marginTop: 4 }} />}
              </div>
            ))}

            {announcements.length === 0 && agentLogs.filter(l => l.findings > 0).length === 0 && (
              <div style={{ padding: '30px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>All caught up! No new notifications.</div>
            )}

            <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9' }}>
              <button onClick={() => router.push('/announcements')} style={{ border: 0, background: 'none', color: '#1d4ed8', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>View all notifications →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
