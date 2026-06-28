'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ShipperTopbar from '@/components/layout/ShipperTopbar';
import api from '@/lib/api';

interface Stop {
  id: string; sequence: number; type: string; city: string; state: string;
  address: string | null; contactName: string | null; contactPhone: string | null;
  appointmentDate: string | null; completedAt: string | null; notes: string | null;
}
interface AuditEntry { action: string; fromValue: string | null; toValue: string | null; changedAt: string; }
interface POD { id: string; filename: string; fileUrl: string; podType: string; createdAt: string; }
interface LoadDetail {
  id: string; loadNumber: string; status: string;
  pickupCity: string; pickupState: string; deliveryCity: string; deliveryState: string;
  equipment: string; commodity: string | null; weight: number | null;
  specialInstructions: string | null;
  pickupDate: string | null; deliveryDate: string | null; customerRate: number;
  driverName: string | null; driverPhone: string | null;
  trackingLat: number | null; trackingLng: number | null; trackingUpdatedAt: string | null;
  carrier: { name: string; phone: string | null; mcNumber: string | null } | null;
  stops: Stop[];
  auditLog: AuditEntry[];
  pods: POD[];
  createdAt: string; updatedAt: string;
}

// Status pipeline the shipper sees
const PIPELINE = [
  { key: 'CREATED',          label: 'Order Placed',   icon: '📋' },
  { key: 'DISPATCHED',       label: 'Dispatched',     icon: '📡' },
  { key: 'DRIVER_ON_ROUTE',  label: 'Driver En Route',icon: '🚗' },
  { key: 'IN_TRANSIT',       label: 'In Transit',     icon: '🚚' },
  { key: 'DELIVERED',        label: 'Delivered',      icon: '✅' },
  { key: 'INVOICED',         label: 'Invoiced',       icon: '💰' },
];

const STATUS_ORDER = PIPELINE.map(s => s.key);

const STATUS_COLOR: Record<string, string> = {
  CREATED:'#94a3b8', DRAFT:'#94a3b8', BOOKED:'#3b82f6',
  DISPATCHED:'#8b5cf6', DRIVER_ON_ROUTE:'#f59e0b', LOADING:'#f59e0b',
  ON_ROUTE:'#f59e0b', IN_TRANSIT:'#f59e0b', UNLOADING:'#f59e0b',
  DELIVERED:'#22c55e', DELAYED:'#ef4444', ON_HOLD:'#f97316',
  INVOICING:'#8b5cf6', INVOICED:'#8b5cf6', RECEIVED:'#22c55e',
  CANCELLED:'#ef4444', COMPLETED:'#22c55e',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function fmtDateShort(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TrackingPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const [load, setLoad]     = useState<LoadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    api.get(`/portal/loads/${id}`)
      .then(r => setLoad(r.data))
      .catch(() => setError('Load not found or access denied.'))
      .finally(() => setLoading(false));

    // Poll every 30s so the GPS map updates without page reload
    const timer = setInterval(() => {
      api.get(`/portal/loads/${id}`)
        .then(r => setLoad(r.data))
        .catch(() => {});
    }, 30_000);
    return () => clearInterval(timer);
  }, [id]);

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <ShipperTopbar title="Tracking" />
      <div style={{ flex:1, display:'grid', placeItems:'center', color:'#94a3b8' }}>Loading…</div>
    </div>
  );

  if (error || !load) return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <ShipperTopbar title="Tracking" />
      <div style={{ flex:1, display:'grid', placeItems:'center' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📦</div>
          <div style={{ color:'#64748b' }}>{error || 'Load not found'}</div>
          <button onClick={()=>router.back()} style={{ marginTop:14, padding:'8px 20px', background:'#0f172a', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:13 }}>← Go Back</button>
        </div>
      </div>
    </div>
  );

  const stepIdx   = STATUS_ORDER.findIndex(s => s === load.status);
  const pipeIdx   = PIPELINE.findIndex(p => p.key === load.status);
  const activeColor = STATUS_COLOR[load.status] ?? '#3b82f6';
  const isDelivered = ['DELIVERED','RECEIVED','COMPLETED','INVOICED','INVOICING'].includes(load.status);
  const isCancelled = ['CANCELLED','TONU','DISPUTED'].includes(load.status);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <ShipperTopbar title={`Tracking — ${load.loadNumber}`} subtitle={`${load.pickupCity} → ${load.deliveryCity}`} />
      <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>

        {/* Header card */}
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:'20px 24px', marginBottom:20, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
              <span style={{ fontFamily:'monospace', fontWeight:800, fontSize:18, color:'#0f172a' }}>{load.loadNumber}</span>
              <span style={{ padding:'3px 10px', borderRadius:9999, fontSize:12, fontWeight:700, background:`${activeColor}20`, color:activeColor }}>
                {load.status.replace(/_/g,' ')}
              </span>
              {isCancelled && <span style={{ padding:'3px 10px', borderRadius:9999, fontSize:12, fontWeight:700, background:'#fee2e2', color:'#ef4444' }}>Cancelled</span>}
            </div>
            <div style={{ fontSize:15, fontWeight:600, color:'#334155' }}>
              {load.pickupCity}, {load.pickupState} → {load.deliveryCity}, {load.deliveryState}
            </div>
            <div style={{ fontSize:13, color:'#64748b', marginTop:3 }}>
              {load.equipment} {load.commodity ? `· ${load.commodity}` : ''} {load.weight ? `· ${load.weight.toLocaleString()} lbs` : ''}
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:11, color:'#94a3b8', textTransform:'uppercase', fontWeight:700 }}>Pickup</div>
            <div style={{ fontSize:14, fontWeight:600, color:'#0f172a' }}>{fmtDateShort(load.pickupDate)}</div>
            <div style={{ fontSize:11, color:'#94a3b8', textTransform:'uppercase', fontWeight:700, marginTop:8 }}>Delivery</div>
            <div style={{ fontSize:14, fontWeight:600, color:'#0f172a' }}>{fmtDateShort(load.deliveryDate)}</div>
          </div>
        </div>

        {/* Status timeline */}
        {!isCancelled && (
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:'22px 28px', marginBottom:20 }}>
            <div style={{ fontWeight:700, fontSize:14, color:'#0f172a', marginBottom:20 }}>📍 Shipment Progress</div>
            <div style={{ display:'flex', alignItems:'flex-start', position:'relative' }}>
              {/* Progress bar */}
              <div style={{ position:'absolute', top:20, left:20, right:20, height:3, background:'#f1f5f9', borderRadius:9999, zIndex:0 }}>
                <div style={{ height:'100%', borderRadius:9999, background:`linear-gradient(90deg, ${activeColor}, ${activeColor}cc)`, width: pipeIdx < 0 ? '0%' : `${Math.min(100, (pipeIdx / (PIPELINE.length - 1)) * 100)}%`, transition:'width 0.5s ease' }} />
              </div>
              {PIPELINE.map((step, i) => {
                const done    = pipeIdx >= i;
                const current = pipeIdx === i;
                const c       = done ? activeColor : '#cbd5e1';
                return (
                  <div key={step.key} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:8, position:'relative', zIndex:1 }}>
                    <div style={{ width:40, height:40, borderRadius:'50%', background: done ? activeColor : '#f8fafc', border:`2px solid ${c}`, display:'grid', placeItems:'center', fontSize:18, boxShadow: current ? `0 0 0 4px ${activeColor}30` : undefined, transition:'all 0.3s' }}>
                      {step.icon}
                    </div>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:11, fontWeight: current ? 700 : 500, color: done ? '#0f172a' : '#94a3b8', whiteSpace:'nowrap' }}>{step.label}</div>
                      {current && <div style={{ fontSize:10, color:activeColor, fontWeight:700, marginTop:1 }}>● NOW</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18, marginBottom:20 }}>

          {/* Driver & Carrier */}
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:'18px 20px' }}>
            <div style={{ fontWeight:700, fontSize:14, color:'#0f172a', marginBottom:14 }}>🚛 Driver & Carrier</div>
            {load.carrier ? (
              <div style={{ marginBottom:14, paddingBottom:14, borderBottom:'1px solid #f1f5f9' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', marginBottom:3 }}>Carrier</div>
                <div style={{ fontSize:14, fontWeight:600, color:'#0f172a' }}>{load.carrier.name}</div>
                {load.carrier.mcNumber && <div style={{ fontSize:12, color:'#64748b' }}>MC# {load.carrier.mcNumber}</div>}
                {load.carrier.phone && (
                  <a href={`tel:${load.carrier.phone}`} style={{ fontSize:12, color:'#3b82f6', textDecoration:'none', display:'flex', alignItems:'center', gap:4, marginTop:4 }}>📞 {load.carrier.phone}</a>
                )}
              </div>
            ) : (
              <div style={{ marginBottom:14, paddingBottom:14, borderBottom:'1px solid #f1f5f9', color:'#94a3b8', fontSize:13, fontStyle:'italic' }}>Carrier being assigned…</div>
            )}
            {load.driverName ? (
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', marginBottom:3 }}>Driver</div>
                <div style={{ fontSize:14, fontWeight:600, color:'#0f172a' }}>{load.driverName}</div>
                {load.driverPhone && (
                  <a href={`tel:${load.driverPhone}`} style={{ fontSize:12, color:'#3b82f6', textDecoration:'none', display:'flex', alignItems:'center', gap:4, marginTop:4 }}>📞 {load.driverPhone}</a>
                )}
              </div>
            ) : (
              <div style={{ color:'#94a3b8', fontSize:13, fontStyle:'italic' }}>Driver not yet assigned</div>
            )}
          </div>

          {/* Live Location or Route map */}
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:'18px 20px' }}>
            <div style={{ fontWeight:700, fontSize:14, color:'#0f172a', marginBottom:12 }}>
              📡 {load.trackingLat ? 'Live Location' : 'Route'}
            </div>
            {load.trackingLat && load.trackingLng ? (
              <>
                <iframe
                  title="driver-location"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${load.trackingLng - 0.15},${load.trackingLat - 0.15},${load.trackingLng + 0.15},${load.trackingLat + 0.15}&layer=mapnik&marker=${load.trackingLat},${load.trackingLng}`}
                  style={{ width:'100%', height:180, border:'none', borderRadius:8 }}
                />
                {load.trackingUpdatedAt && (
                  <div style={{ fontSize:11, color:'#94a3b8', marginTop:6 }}>Updated {fmtDate(load.trackingUpdatedAt)}</div>
                )}
              </>
            ) : (
              <div style={{ background:'#f8fafc', borderRadius:10, padding:'20px 16px', border:'1px solid #e2e8f0' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background:'#22c55e', flexShrink:0 }} />
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:'#374151' }}>PICKUP</div>
                    <div style={{ fontSize:13, color:'#0f172a' }}>{load.pickupCity}, {load.pickupState}</div>
                    <div style={{ fontSize:11, color:'#64748b' }}>{fmtDateShort(load.pickupDate)}</div>
                  </div>
                </div>
                <div style={{ marginLeft:5, width:2, height:28, background:'linear-gradient(#22c55e,#3b82f6)', marginBottom:12 }} />
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background:'#3b82f6', flexShrink:0 }} />
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:'#374151' }}>DELIVERY</div>
                    <div style={{ fontSize:13, color:'#0f172a' }}>{load.deliveryCity}, {load.deliveryState}</div>
                    <div style={{ fontSize:11, color:'#64748b' }}>{fmtDateShort(load.deliveryDate)}</div>
                  </div>
                </div>
                <div style={{ marginTop:12, fontSize:11, color:'#94a3b8', textAlign:'center' }}>
                  Live GPS available once driver is assigned & dispatched
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stops */}
        {load.stops.length > 0 && (
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:'18px 20px', marginBottom:20 }}>
            <div style={{ fontWeight:700, fontSize:14, color:'#0f172a', marginBottom:14 }}>📌 Stops</div>
            <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
              {load.stops.map((stop, i) => (
                <div key={stop.id} style={{ display:'flex', gap:14, position:'relative' }}>
                  {/* Line connector */}
                  {i < load.stops.length - 1 && (
                    <div style={{ position:'absolute', left:12, top:28, bottom:-4, width:2, background:'#e2e8f0' }} />
                  )}
                  <div style={{ width:26, height:26, borderRadius:'50%', flexShrink:0, display:'grid', placeItems:'center', fontSize:11, fontWeight:700, background: stop.completedAt ? '#22c55e' : '#f1f5f9', color: stop.completedAt ? '#fff' : '#64748b', border:`2px solid ${stop.completedAt ? '#22c55e' : '#e2e8f0'}`, marginTop:4 }}>
                    {stop.completedAt ? '✓' : stop.sequence}
                  </div>
                  <div style={{ flex:1, paddingBottom:16 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:'#0f172a' }}>{stop.city}, {stop.state}</span>
                      <span style={{ fontSize:10, padding:'1px 7px', borderRadius:4, background: stop.type === 'PICKUP' ? '#dcfce7' : stop.type === 'DELIVERY' ? '#dbeafe' : '#f1f5f9', color: stop.type === 'PICKUP' ? '#15803d' : stop.type === 'DELIVERY' ? '#1d4ed8' : '#475569', fontWeight:700 }}>{stop.type}</span>
                      {stop.completedAt && <span style={{ fontSize:10, color:'#22c55e', fontWeight:600 }}>✓ Completed</span>}
                    </div>
                    {stop.address && <div style={{ fontSize:12, color:'#64748b', marginTop:1 }}>{stop.address}</div>}
                    <div style={{ display:'flex', gap:14, marginTop:3, flexWrap:'wrap' }}>
                      {stop.appointmentDate && <span style={{ fontSize:11, color:'#94a3b8' }}>Appt: {fmtDate(stop.appointmentDate)}</span>}
                      {stop.completedAt && <span style={{ fontSize:11, color:'#22c55e' }}>Done: {fmtDate(stop.completedAt)}</span>}
                      {stop.contactName && <span style={{ fontSize:11, color:'#64748b' }}>{stop.contactName} {stop.contactPhone && `· ${stop.contactPhone}`}</span>}
                    </div>
                    {stop.notes && <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{stop.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns: load.pods.length > 0 ? '1fr 1fr' : '1fr', gap:18, marginBottom:20 }}>

          {/* Status history */}
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:'18px 20px' }}>
            <div style={{ fontWeight:700, fontSize:14, color:'#0f172a', marginBottom:14 }}>🕐 Status History</div>
            {load.auditLog.length === 0 ? (
              <div style={{ color:'#94a3b8', fontSize:13 }}>No status changes yet</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {/* Creation event */}
                <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'#3b82f6', marginTop:5, flexShrink:0 }} />
                  <div>
                    <div style={{ fontSize:12, fontWeight:600, color:'#0f172a' }}>Order Created</div>
                    <div style={{ fontSize:11, color:'#94a3b8' }}>{fmtDate(load.createdAt)}</div>
                  </div>
                </div>
                {load.auditLog.map((entry, i) => {
                  const c = STATUS_COLOR[entry.toValue ?? ''] ?? '#64748b';
                  return (
                    <div key={i} style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:c, marginTop:5, flexShrink:0 }} />
                      <div>
                        <div style={{ fontSize:12, fontWeight:600, color:'#0f172a' }}>{(entry.toValue ?? '').replace(/_/g,' ')}</div>
                        <div style={{ fontSize:11, color:'#94a3b8' }}>{fmtDate(entry.changedAt)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* PODs */}
          {load.pods.length > 0 && (
            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:'18px 20px' }}>
              <div style={{ fontWeight:700, fontSize:14, color:'#0f172a', marginBottom:14 }}>✅ Proof of Delivery</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {load.pods.map(pod => (
                  <div key={pod.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', background:'#f8fafc', borderRadius:8, border:'1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:600, color:'#0f172a' }}>{pod.podType}</div>
                      <div style={{ fontSize:11, color:'#64748b' }}>{pod.filename} · {fmtDateShort(pod.createdAt)}</div>
                    </div>
                    <a href={pod.fileUrl} target="_blank" rel="noreferrer" style={{ padding:'5px 12px', background:'#0f172a', color:'#fff', borderRadius:6, fontSize:11, fontWeight:700, textDecoration:'none' }}>
                      Download ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        {load.specialInstructions && (
          <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:12, padding:'14px 18px', marginBottom:20 }}>
            <div style={{ fontWeight:700, fontSize:13, color:'#92400e', marginBottom:4 }}>📝 Special Instructions</div>
            <div style={{ fontSize:13, color:'#78350f' }}>{load.specialInstructions}</div>
          </div>
        )}

        <button onClick={()=>router.back()} style={{ padding:'9px 20px', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, fontWeight:600, color:'#475569', cursor:'pointer' }}>
          ← Back to Shipments
        </button>

      </div>
    </div>
  );
}
