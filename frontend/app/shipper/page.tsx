'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface Quote {
  id: string; quoteNumber: string; status: string;
  pickupCity: string; pickupState: string; deliveryCity: string; deliveryState: string;
  equipment: string; commodity: string | null; weight: number | null;
  pickupDate: string | null; rate: number; source: string | null; createdAt: string;
  load: { id: string; loadNumber: string; status: string } | null;
}

interface ShipLoad {
  id: string; loadNumber: string; status: string;
  pickupCity: string; pickupState: string; deliveryCity: string; deliveryState: string;
  equipment: string; pickupDate: string | null; customerRate: number;
  driverName: string | null; carrier: { name: string } | null;
}

const QUOTE_COLORS: Record<string, string> = {
  PENDING: '#f59e0b', APPROVED: '#22c55e', REJECTED: '#ef4444', CONVERTED: '#3b82f6',
};
const LOAD_COLORS: Record<string, string> = {
  CREATED: '#94a3b8', DISPATCHED: '#3b82f6', IN_TRANSIT: '#f59e0b',
  DELIVERED: '#22c55e', INVOICED: '#8b5cf6', CANCELLED: '#ef4444',
};

export default function ShipperDashboard() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loads, setLoads] = useState<ShipLoad[]>([]);
  const [tab, setTab] = useState<'quotes' | 'loads'>('quotes');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      api.get('/portal/quotes'),
      api.get('/portal/loads'),
    ]).then(([q, l]) => {
      setQuotes(q.data);
      setLoads(l.data);
    }).finally(() => setLoading(false));
  }, []);

  const pending = quotes.filter(q => q.status === 'PENDING').length;
  const inTransit = loads.filter(l => l.status === 'IN_TRANSIT').length;
  const delivered = loads.filter(l => l.status === 'DELIVERED').length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>My Shipments</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Track your quotes and active shipments</p>
        </div>
        <button
          onClick={() => router.push('/shipper/new-quote')}
          style={{ height: 40, padding: '0 20px', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', color: '#fff', border: 0, borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
        >
          + Request a Quote
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Pending Quotes', value: pending, color: '#f59e0b', bg: '#fffbeb' },
          { label: 'In Transit', value: inTransit, color: '#3b82f6', bg: '#eff6ff' },
          { label: 'Delivered', value: delivered, color: '#22c55e', bg: '#f0fdf4' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: bg, display: 'grid', placeItems: 'center' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: color }} />
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a' }}>{value}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
          {(['quotes', 'loads'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '12px 24px', fontSize: 13, fontWeight: tab === t ? 700 : 400,
              color: tab === t ? '#3b82f6' : '#64748b', background: 'transparent', border: 0, cursor: 'pointer',
              borderBottom: tab === t ? '2px solid #3b82f6' : '2px solid transparent',
            }}>
              {t === 'quotes' ? `Quotes (${quotes.length})` : `Shipments (${loads.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Loading…</div>
        ) : tab === 'quotes' ? (
          quotes.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
              <div style={{ color: '#64748b', fontSize: 14 }}>No quotes yet</div>
              <button onClick={() => router.push('/shipper/new-quote')} style={{ marginTop: 14, padding: '8px 20px', background: '#3b82f6', color: '#fff', border: 0, borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                Request your first quote
              </button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Quote #', 'Route', 'Equipment', 'Pickup', 'Rate', 'Source', 'Status', 'Load'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quotes.map(q => (
                  <tr key={q.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>{q.quoteNumber}</td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>{q.pickupCity}, {q.pickupState} → {q.deliveryCity}, {q.deliveryState}</td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>{q.equipment}</td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>{q.pickupDate ? new Date(q.pickupDate).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>{q.rate > 0 ? `$${q.rate.toLocaleString()}` : 'TBD'}</td>
                    <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 12 }}>{q.source || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 700, background: `${QUOTE_COLORS[q.status]}22`, color: QUOTE_COLORS[q.status] }}>
                        {q.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#475569' }}>
                      {q.load ? <span style={{ color: '#22c55e', fontWeight: 600 }}>{q.load.loadNumber}</span> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          loads.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
              No active shipments. Your approved quotes will appear here as loads.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Load #', 'Route', 'Equipment', 'Carrier', 'Driver', 'Pickup', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loads.map(l => (
                  <tr key={l.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>{l.loadNumber}</td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>{l.pickupCity}, {l.pickupState} → {l.deliveryCity}, {l.deliveryState}</td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>{l.equipment}</td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>{l.carrier?.name || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Assigning…</span>}</td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>{l.driverName || '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>{l.pickupDate ? new Date(l.pickupDate).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 700, background: `${LOAD_COLORS[l.status]}22`, color: LOAD_COLORS[l.status] }}>
                        {l.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}
