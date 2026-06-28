'use client';

import { useEffect, useState } from 'react';
import CarrierTopbar from '@/components/layout/CarrierTopbar';
import api from '@/lib/api';

interface Stop { id:string; sequence:number; type:string; city:string; state:string; }
interface OpenLoad {
  id:string; loadNumber:string; status:string;
  pickupCity:string; pickupState:string; deliveryCity:string; deliveryState:string;
  equipment:string; commodity:string|null; weight:number|null;
  pickupDate:string|null; deliveryDate:string|null;
  specialInstructions:string|null;
  stops:Stop[];
  createdAt:string;
}

function fmtDate(d:string|null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}
function daysDiff(d:string|null) {
  if (!d) return null;
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  return diff;
}

const EQUIP_TYPES = ['All','Dry Van','Reefer','Flatbed','Step Deck','Power Only','Box Truck','Sprinter'];

export default function AvailableLoadsPage() {
  const [loads,    setLoads]    = useState<OpenLoad[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [eqFilter, setEqFilter] = useState('All');
  const [expanded, setExpanded] = useState<string|null>(null);
  const [interests, setInterests] = useState<Record<string,boolean>>({});
  const [pending,   setPending]   = useState<Record<string,boolean>>({});

  useEffect(() => {
    api.get('/carrier-portal/open-loads').then(r => setLoads(r.data)).finally(() => setLoading(false));
  }, []);

  const visible = loads.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q || l.loadNumber.toLowerCase().includes(q)
      || l.pickupCity.toLowerCase().includes(q)
      || l.deliveryCity.toLowerCase().includes(q)
      || l.pickupState.toLowerCase().includes(q)
      || l.deliveryState.toLowerCase().includes(q)
      || (l.equipment||'').toLowerCase().includes(q);
    const matchEq = eqFilter === 'All' || l.equipment === eqFilter;
    return matchSearch && matchEq;
  });

  async function expressInterest(id: string) {
    setPending(p => ({ ...p, [id]: true }));
    try {
      await api.post(`/carrier-portal/open-loads/${id}/interest`);
      setInterests(p => ({ ...p, [id]: true }));
    } catch {
      // silently ignore — dispatcher will still be notified on retry
    } finally {
      setPending(p => ({ ...p, [id]: false }));
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <CarrierTopbar title="Available Loads" subtitle="Open loads looking for a carrier" />
      <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>

        <div style={{ marginBottom:20 }}>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#0f172a', margin:0 }}>Available Loads</h1>
          <p style={{ color:'#64748b', fontSize:13, marginTop:4 }}>
            {loads.length} open load{loads.length !== 1 ? 's' : ''} available · Express interest to notify the dispatcher
          </p>
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap', alignItems:'center' }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by city, state, equipment, load #…"
            style={{ height:36, padding:'0 12px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, width:280, outline:'none' }}
          />
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {EQUIP_TYPES.map(eq => (
              <button key={eq} onClick={()=>setEqFilter(eq)} style={{ padding:'5px 12px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', border:'none', background:eqFilter===eq?'#f59e0b':'#f1f5f9', color:eqFilter===eq?'#fff':'#475569' }}>
                {eq} {eq !== 'All' && `(${loads.filter(l=>l.equipment===eq).length})`}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ display:'grid', placeItems:'center', height:200, color:'#94a3b8' }}>Loading…</div>
        ) : visible.length === 0 ? (
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:'56px 24px', textAlign:'center' }}>
            <div style={{ fontSize:48, marginBottom:14 }}>📋</div>
            <div style={{ fontSize:17, fontWeight:700, color:'#0f172a', marginBottom:8 }}>
              {loads.length === 0 ? 'No available loads right now' : 'No loads match your filter'}
            </div>
            <div style={{ color:'#64748b', fontSize:13 }}>
              {loads.length === 0
                ? 'New loads will appear here as soon as they are created by a dispatcher.'
                : 'Try clearing your filters.'}
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {visible.map(l => {
              const days = daysDiff(l.pickupDate);
              const urgency = days !== null && days <= 2 ? '#ef4444' : days !== null && days <= 7 ? '#f59e0b' : '#22c55e';
              const isOpen = expanded === l.id;
              const alreadyExpressed = interests[l.id];
              const isPending = pending[l.id];

              return (
                <div key={l.id} style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, overflow:'hidden', transition:'box-shadow 0.15s' }}>
                  {/* Main row */}
                  <div style={{ padding:'16px 20px', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>

                    {/* Route */}
                    <div style={{ flex:'0 0 auto', minWidth:220 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                        <span style={{ fontFamily:'monospace', fontWeight:800, fontSize:12, color:'#1d4ed8', background:'#eff6ff', padding:'2px 7px', borderRadius:4 }}>{l.loadNumber}</span>
                        <span style={{ fontSize:11, padding:'2px 8px', borderRadius:9999, background:'#f1f5f9', color:'#475569', fontWeight:600 }}>{l.equipment}</span>
                      </div>
                      <div style={{ fontSize:15, fontWeight:700, color:'#0f172a' }}>
                        {l.pickupCity}, {l.pickupState}
                        <span style={{ color:'#94a3b8', fontWeight:400, fontSize:13, margin:'0 6px' }}>→</span>
                        {l.deliveryCity}, {l.deliveryState}
                      </div>
                      {l.stops.length > 0 && (
                        <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>+{l.stops.length} stop{l.stops.length !== 1 ? 's' : ''}</div>
                      )}
                    </div>

                    {/* Details */}
                    <div style={{ display:'flex', gap:20, flex:1, flexWrap:'wrap' }}>
                      <div>
                        <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', marginBottom:2 }}>Pickup</div>
                        <div style={{ fontSize:13, fontWeight:600, color: days !== null && days <= 0 ? '#ef4444' : '#0f172a' }}>{fmtDate(l.pickupDate)}</div>
                        {days !== null && (
                          <div style={{ fontSize:10, color:urgency, fontWeight:700, marginTop:1 }}>
                            {days < 0 ? 'Overdue' : days === 0 ? 'TODAY' : days === 1 ? 'Tomorrow' : `${days} days away`}
                          </div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', marginBottom:2 }}>Delivery</div>
                        <div style={{ fontSize:13, fontWeight:600, color:'#0f172a' }}>{fmtDate(l.deliveryDate)}</div>
                      </div>
                      {l.commodity && (
                        <div>
                          <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', marginBottom:2 }}>Commodity</div>
                          <div style={{ fontSize:13, color:'#334155' }}>{l.commodity}</div>
                        </div>
                      )}
                      {l.weight && (
                        <div>
                          <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', marginBottom:2 }}>Weight</div>
                          <div style={{ fontSize:13, color:'#334155' }}>{l.weight.toLocaleString()} lbs</div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
                      <button
                        onClick={() => setExpanded(isOpen ? null : l.id)}
                        style={{ padding:'7px 14px', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer', color:'#475569' }}
                      >
                        {isOpen ? '▲ Less' : '▼ Details'}
                      </button>
                      <button
                        onClick={() => !alreadyExpressed && expressInterest(l.id)}
                        disabled={isPending || alreadyExpressed}
                        style={{
                          padding:'7px 16px', border:'none', borderRadius:7, fontSize:12, fontWeight:700, cursor: alreadyExpressed ? 'default' : 'pointer',
                          background: alreadyExpressed ? '#f0fdf4' : isPending ? '#fef3c7' : '#f59e0b',
                          color: alreadyExpressed ? '#15803d' : isPending ? '#92400e' : '#fff',
                          transition:'background 0.2s',
                        }}
                      >
                        {alreadyExpressed ? '✓ Interest Sent' : isPending ? 'Sending…' : '🙋 Express Interest'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div style={{ padding:'14px 20px 18px', borderTop:'1px solid #f1f5f9', background:'#fafafa' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px,1fr))', gap:20 }}>

                        {/* Stops */}
                        {l.stops.length > 0 && (
                          <div>
                            <div style={{ fontWeight:700, fontSize:12, color:'#0f172a', marginBottom:10 }}>Stops</div>
                            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                              {l.stops.map(s => (
                                <div key={s.id} style={{ display:'flex', gap:8, alignItems:'center' }}>
                                  <span style={{ fontSize:10, padding:'2px 6px', borderRadius:4, background:'#dbeafe', color:'#1d4ed8', fontWeight:700 }}>{s.type}</span>
                                  <span style={{ fontSize:12, color:'#334155' }}>{s.city}, {s.state}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Special instructions */}
                        {l.specialInstructions && (
                          <div>
                            <div style={{ fontWeight:700, fontSize:12, color:'#0f172a', marginBottom:8 }}>Special Instructions</div>
                            <div style={{ fontSize:12, color:'#78350f', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, padding:'10px 12px', lineHeight:1.6 }}>
                              {l.specialInstructions}
                            </div>
                          </div>
                        )}

                        {/* What happens next */}
                        <div>
                          <div style={{ fontWeight:700, fontSize:12, color:'#0f172a', marginBottom:8 }}>How it works</div>
                          <div style={{ fontSize:12, color:'#64748b', lineHeight:1.7 }}>
                            1. Click <strong>Express Interest</strong> to notify the dispatcher<br/>
                            2. A dispatcher will reach out to confirm rates and details<br/>
                            3. Once confirmed, the load will appear in <strong>My Loads</strong>
                          </div>
                        </div>

                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
