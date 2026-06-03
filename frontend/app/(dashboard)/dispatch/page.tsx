'use client';

import { useEffect, useState, useRef } from 'react';
import Topbar from '@/components/layout/Topbar';
import api from '@/lib/api';

interface Load {
  id: string;
  loadNumber: string;
  status: string;
  pickupCity: string;
  pickupState: string;
  deliveryCity: string;
  deliveryState: string;
  equipment: string;
  customerRate: number;
  carrierRate: number | null;
  carrier: { name: string; mcNumber: string } | null;
  customer: { name: string };
  isDuplicate: boolean;
}

const STAGES: { key: string; label: string; color: string }[] = [
  { key: 'CREATED', label: 'Created', color: '#94a3b8' },
  { key: 'DISPATCHED', label: 'Dispatched', color: '#6d28d9' },
  { key: 'IN_TRANSIT', label: 'In Transit', color: '#0e7490' },
  { key: 'DELIVERED', label: 'Delivered', color: '#15803d' },
];

const STATUS_NEXT: Record<string, string> = {
  CREATED: 'DISPATCHED',
  DISPATCHED: 'IN_TRANSIT',
  IN_TRANSIT: 'DELIVERED',
};

export default function DispatchPage() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  async function loadData() {
    try {
      const { data } = await api.get('/loads');
      setLoads(data.filter((l: Load) => l.status !== 'CANCELLED' && l.status !== 'INVOICED'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function moveLoad(loadId: string, newStatus: string) {
    const load = loads.find(l => l.id === loadId);
    if (!load) return;

    if (newStatus === 'DISPATCHED' && !load.carrier) {
      showToast(`Assign a carrier to ${load.loadNumber} before dispatching.`, 'err');
      return;
    }

    // Duplicate detection
    const dup = loads.find(l =>
      l.id !== loadId &&
      l.pickupCity === load.pickupCity &&
      l.deliveryCity === load.deliveryCity &&
      l.customer.name === load.customer.name &&
      l.status !== 'DELIVERED'
    );

    try {
      await api.put(`/loads/${loadId}`, { status: newStatus });
      await loadData();
      showToast(`${load.loadNumber} → ${newStatus}${dup ? ` ⚠ Possible duplicate of ${dup.loadNumber}` : ''}`);
      if (dup) setTimeout(() => showToast(`Duplicate detected: ${load.loadNumber} matches ${dup.loadNumber} (same lane + customer)`, 'err'), 500);
    } catch {
      showToast('Failed to update status', 'err');
    }
  }

  function onDragStart(e: React.DragEvent, id: string) {
    setDragging(id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDrop(e: React.DragEvent, stage: string) {
    e.preventDefault();
    setOver(null);
    if (!dragging) return;
    const load = loads.find(l => l.id === dragging);
    if (!load || load.status === stage) return;
    moveLoad(dragging, stage);
    setDragging(null);
  }

  const margin = (l: Load) => l.customerRate - (l.carrierRate || 0);

  return (
    <>
      <Topbar title="Dispatch Board" />
      <main style={{ flex: 1, overflowY: 'auto', padding: '22px 26px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 21, letterSpacing: '-0.4px' }}>Dispatch Board</h1>
            <div style={{ color: '#475569', fontSize: 13, marginTop: 3 }}>
              Drag loads across stages · Duplicate-load detection runs on drop
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[...Array(4)].map((_, i) => <div key={i} className="sk" style={{ height: 300, borderRadius: 10 }} />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, alignItems: 'start' }}>
            {STAGES.map(({ key, label, color }) => {
              const colLoads = loads.filter(l => l.status === key);
              return (
                <div
                  key={key}
                  onDragOver={(e) => { e.preventDefault(); setOver(key); }}
                  onDragLeave={() => setOver(null)}
                  onDrop={(e) => onDrop(e, key)}
                  style={{
                    background: '#f8fafc',
                    border: `1px solid ${over === key ? '#1d4ed8' : '#e2e8f0'}`,
                    outline: over === key ? '2px dashed #1d4ed8' : 'none',
                    outlineOffset: -3,
                    borderRadius: 10,
                    minHeight: 200,
                    padding: 10,
                    transition: 'all 0.1s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h4 style={{ margin: 0, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#475569', fontWeight: 700 }}>{label}</h4>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: '#94a3b8', fontSize: 11 }}>{colLoads.length}</span>
                  </div>

                  {colLoads.length === 0 && (
                    <div style={{ color: '#94a3b8', fontSize: 12, padding: 6 }}>No loads</div>
                  )}

                  {colLoads.map((l) => {
                    const mg = margin(l);
                    const mgPct = l.customerRate > 0 ? Math.round(mg / l.customerRate * 100) : 0;
                    return (
                      <div
                        key={l.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, l.id)}
                        onDragEnd={() => setDragging(null)}
                        style={{
                          background: '#fff',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          padding: 10,
                          marginBottom: 9,
                          cursor: 'grab',
                          opacity: dragging === l.id ? 0.4 : 1,
                          transition: 'opacity 0.1s',
                          borderLeft: `3px solid ${color}`,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, fontSize: 12, color: '#1d4ed8' }}>{l.loadNumber}</span>
                          {l.isDuplicate && <span style={{ fontSize: 10, background: '#fef6e7', color: '#b45309', border: '1px solid #fde68a', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>DUP</span>}
                        </div>
                        <div style={{ fontSize: 12, color: '#475569', margin: '4px 0' }}>
                          {l.pickupCity}, {l.pickupState} → {l.deliveryCity}, {l.deliveryState}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{l.equipment}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, fontSize: 11, color: '#94a3b8' }}>
                          <span>{l.carrier?.name || <span style={{ fontStyle: 'italic' }}>unassigned</span>}</span>
                          <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: mgPct < 10 ? '#b91c1c' : '#15803d', fontWeight: 600 }}>
                            ${mg.toLocaleString()}
                          </span>
                        </div>
                        {/* Quick action button */}
                        {STATUS_NEXT[key] && (
                          <button
                            onClick={() => moveLoad(l.id, STATUS_NEXT[key])}
                            style={{ marginTop: 7, width: '100%', border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: 6, padding: '5px 8px', fontSize: 11, fontWeight: 600, color: '#475569', cursor: 'pointer' }}
                          >
                            → Move to {STAGES.find(s => s.key === STATUS_NEXT[key])?.label}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16 }}>
          {STAGES.map(({ key, label, color }) => {
            const colLoads = loads.filter(l => l.status === key);
            const rev = colLoads.reduce((s, l) => s + l.customerRate, 0);
            return (
              <div key={key} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, borderLeft: `3px solid ${color}` }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#94a3b8', fontWeight: 700 }}>{label}</div>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 22, fontWeight: 700, marginTop: 2 }}>{colLoads.length}</div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>${rev.toLocaleString()} revenue</div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)', background: '#fff', border: `1px solid #e2e8f0`, borderLeft: `4px solid ${toast.type === 'ok' ? '#15803d' : '#b91c1c'}`, borderRadius: 8, padding: '12px 20px', fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', zIndex: 9000, maxWidth: 440, whiteSpace: 'nowrap' }}>
          {toast.msg}
        </div>
      )}
    </>
  );
}
