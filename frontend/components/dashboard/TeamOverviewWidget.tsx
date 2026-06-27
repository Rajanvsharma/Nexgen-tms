'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface RepStat {
  user: { id: string; firstName: string; lastName: string; role: string };
  activeLoads: number;
  loadsThisWeek: number;
  revenueMTD: number;
}

function fmtMoney(n: number) {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

export default function TeamOverviewWidget() {
  const router = useRouter();
  const [stats, setStats] = useState<RepStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/stats/team-overview')
      .then(({ data }) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginTop: 20 }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>👥 Team Overview</span>
        <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 'auto' }}>Rep performance this month</span>
      </div>

      {loading ? (
        <div style={{ padding: '24px 18px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 36, background: '#f1f5f9', borderRadius: 6, marginBottom: 8, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ) : stats.length === 0 ? (
        <div style={{ padding: '32px 18px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          Your team has no reps assigned yet
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Rep', 'Active Loads', 'This Week', 'Revenue MTD'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.map(s => (
              <tr
                key={s.user.id}
                onClick={() => router.push(`/loads?assignedTo=${s.user.id}`)}
                style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
              >
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#eff6ff', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {s.user.firstName[0]}{s.user.lastName[0]}
                    </div>
                    {s.user.firstName} {s.user.lastName}
                  </div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ padding: '3px 10px', background: s.activeLoads > 0 ? '#dbeafe' : '#f1f5f9', color: s.activeLoads > 0 ? '#1d4ed8' : '#94a3b8', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                    {s.activeLoads}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', color: '#64748b', fontWeight: 500 }}>{s.loadsThisWeek}</td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: s.revenueMTD > 0 ? '#15803d' : '#94a3b8' }}>
                  {fmtMoney(s.revenueMTD)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
