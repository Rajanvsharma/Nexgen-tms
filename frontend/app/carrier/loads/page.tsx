'use client';

import { useEffect, useState } from 'react';
import CarrierTopbar from '@/components/layout/CarrierTopbar';
import api from '@/lib/api';

interface Stop { id:string; sequence:number; type:string; city:string; state:string; address:string|null; appointmentDate:string|null; completedAt:string|null; contactName:string|null; contactPhone:string|null; }
interface Load {
  id:string; loadNumber:string; status:string;
  pickupCity:string; pickupState:string; deliveryCity:string; deliveryState:string;
  equipment:string; commodity:string|null; weight:number|null; specialInstructions:string|null;
  pickupDate:string|null; deliveryDate:string|null; carrierRate:number;
  driverName:string|null; driverPhone:string|null;
  customer:{ name:string }|null;
  stops:Stop[];
  documents:{ id:string; type:string; filename:string }[];
  pods:{ id:string; filename:string; fileUrl:string; podType:string }[];
  invoice:{ status:string; totalAmount:number }|null;
  createdAt:string;
}

const COLORS: Record<string,string> = {
  CREATED:'#94a3b8', BOOKED:'#3b82f6', DISPATCHED:'#3b82f6', DRIVER_ON_ROUTE:'#f59e0b',
  IN_TRANSIT:'#f59e0b', ON_ROUTE:'#f59e0b', LOADING:'#f59e0b', UNLOADING:'#f59e0b',
  DELIVERED:'#22c55e', INVOICED:'#8b5cf6', PAYMENTS:'#8b5cf6',
  RECEIVED:'#22c55e', CANCELLED:'#ef4444',
};
const STATUSES = ['All','DISPATCHED','IN_TRANSIT','DELIVERED','INVOICED','CANCELLED'];

function fmtDate(d:string|null) { return d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'; }
function fmtMoney(n:number) { return `$${n.toLocaleString()}`; }
function fmtDatetime(d:string|null) { return d ? new Date(d).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : '—'; }

export default function CarrierLoadsPage() {
  const [loads,   setLoads]   = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('All');
  const [search,  setSearch]  = useState('');
  const [expanded,setExpanded]= useState<string|null>(null);

  useEffect(() => {
    api.get('/carrier-portal/loads').then(r => setLoads(r.data)).finally(() => setLoading(false));
  }, []);

  const visible = loads.filter(l => {
    const matchStatus = filter === 'All' || l.status === filter || (filter === 'IN_TRANSIT' && ['DRIVER_ON_ROUTE','ON_ROUTE','LOADING','UNLOADING'].includes(l.status));
    const q = search.toLowerCase();
    const matchSearch = !q || l.loadNumber.toLowerCase().includes(q) || l.pickupCity.toLowerCase().includes(q) || l.deliveryCity.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <CarrierTopbar title="My Loads" subtitle="All loads assigned to your company" />
      <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>

        <div style={{ marginBottom:20 }}>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#0f172a', margin:0 }}>My Loads</h1>
          <p style={{ color:'#64748b', fontSize:13, marginTop:4 }}>{loads.length} total loads</p>
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap', alignItems:'center' }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by load #, city…" style={{ height:36, padding:'0 12px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, width:220, outline:'none' }} />
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {STATUSES.map(s => (
              <button key={s} onClick={()=>setFilter(s)} style={{ padding:'5px 12px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', border:'none', background:filter===s?'#0f172a':'#f1f5f9', color:filter===s?'#fff':'#475569' }}>
                {s.replace('_',' ')} {s!=='All' && `(${loads.filter(l => s==='IN_TRANSIT' ? ['IN_TRANSIT','DRIVER_ON_ROUTE','ON_ROUTE','LOADING','UNLOADING'].includes(l.status) : l.status===s).length})`}
              </button>
            ))}
          </div>
        </div>

        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden' }}>
          {loading ? (
            <div style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>Loading…</div>
          ) : visible.length === 0 ? (
            <div style={{ padding:'48px 24px', textAlign:'center' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🚛</div>
              <div style={{ color:'#94a3b8', fontSize:14 }}>{loads.length === 0 ? 'No loads assigned yet. Once a dispatcher assigns a load to your company, it will appear here.' : 'No loads match your filter.'}</div>
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f8fafc' }}>
                  {['Load #','Route','Equipment','Customer','Pickup','Delivery','Rate','Status',''].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', color:'#64748b', fontWeight:600, fontSize:11, textTransform:'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(l => {
                  const c = COLORS[l.status] ?? '#64748b';
                  const isOpen = expanded === l.id;
                  return (
                    <>
                      <tr key={l.id} onClick={()=>setExpanded(isOpen?null:l.id)} style={{ borderTop:'1px solid #f1f5f9', cursor:'pointer', background:isOpen?'#f8fafc':undefined }}>
                        <td style={{ padding:'12px 14px', fontFamily:'monospace', fontWeight:700, color:'#1d4ed8' }}>{l.loadNumber}</td>
                        <td style={{ padding:'12px 14px', color:'#334155', whiteSpace:'nowrap' }}>{l.pickupCity}, {l.pickupState} → {l.deliveryCity}, {l.deliveryState}</td>
                        <td style={{ padding:'12px 14px', color:'#475569' }}>{l.equipment}</td>
                        <td style={{ padding:'12px 14px', color:'#475569' }}>{l.customer?.name ?? '—'}</td>
                        <td style={{ padding:'12px 14px', color:'#475569', whiteSpace:'nowrap' }}>{fmtDate(l.pickupDate)}</td>
                        <td style={{ padding:'12px 14px', color:'#475569', whiteSpace:'nowrap' }}>{fmtDate(l.deliveryDate)}</td>
                        <td style={{ padding:'12px 14px', fontWeight:700, color:'#0f172a' }}>{fmtMoney(l.carrierRate)}</td>
                        <td style={{ padding:'12px 14px' }}><span style={{ padding:'2px 9px', borderRadius:9999, fontSize:11, fontWeight:700, background:`${c}22`, color:c }}>{l.status.replace(/_/g,' ')}</span></td>
                        <td style={{ padding:'12px 14px' }}><span style={{ color:'#94a3b8', fontSize:12 }}>{isOpen ? '▲' : '▼'}</span></td>
                      </tr>
                      {isOpen && (
                        <tr key={`${l.id}-x`} style={{ background:'#f8fafc', borderTop:'1px solid #e2e8f0' }}>
                          <td colSpan={9} style={{ padding:'16px 20px' }}>
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20 }}>

                              {/* Details */}
                              <div>
                                <div style={{ fontWeight:700, fontSize:12, color:'#0f172a', marginBottom:10 }}>Load Details</div>
                                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                                  {[
                                    ['Commodity', l.commodity || '—'],
                                    ['Weight', l.weight ? `${l.weight.toLocaleString()} lbs` : '—'],
                                    ['Driver', l.driverName || '—'],
                                    ['Driver Phone', l.driverPhone || '—'],
                                  ].map(([k,v]) => (
                                    <div key={k} style={{ display:'flex', gap:8 }}>
                                      <span style={{ fontSize:11, color:'#94a3b8', fontWeight:700, minWidth:90 }}>{k}</span>
                                      <span style={{ fontSize:12, color:'#334155' }}>{v}</span>
                                    </div>
                                  ))}
                                  {l.invoice && (
                                    <div style={{ display:'flex', gap:8 }}>
                                      <span style={{ fontSize:11, color:'#94a3b8', fontWeight:700, minWidth:90 }}>Payment</span>
                                      <span style={{ fontSize:12, color:'#334155' }}>{l.invoice.status} · {fmtMoney(l.invoice.totalAmount)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Stops */}
                              <div>
                                <div style={{ fontWeight:700, fontSize:12, color:'#0f172a', marginBottom:10 }}>Stops ({l.stops.length})</div>
                                {l.stops.length === 0 ? (
                                  <div style={{ fontSize:12, color:'#94a3b8' }}>No intermediate stops</div>
                                ) : (
                                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                                    {l.stops.map(s => (
                                      <div key={s.id} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                                        <span style={{ fontSize:10, padding:'2px 6px', borderRadius:4, background: s.completedAt?'#dcfce7':'#dbeafe', color:s.completedAt?'#15803d':'#1d4ed8', fontWeight:700, flexShrink:0 }}>{s.type}</span>
                                        <div>
                                          <div style={{ fontSize:12, fontWeight:600, color:'#0f172a' }}>{s.city}, {s.state}</div>
                                          {s.address && <div style={{ fontSize:11, color:'#64748b' }}>{s.address}</div>}
                                          {s.appointmentDate && <div style={{ fontSize:11, color:'#94a3b8' }}>Appt: {fmtDatetime(s.appointmentDate)}</div>}
                                          {s.completedAt && <div style={{ fontSize:11, color:'#22c55e' }}>✓ {fmtDatetime(s.completedAt)}</div>}
                                          {s.contactName && <div style={{ fontSize:11, color:'#64748b' }}>{s.contactName}{s.contactPhone && ` · ${s.contactPhone}`}</div>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Documents & PODs */}
                              <div>
                                <div style={{ fontWeight:700, fontSize:12, color:'#0f172a', marginBottom:10 }}>Documents</div>
                                {l.documents.length === 0 && l.pods.length === 0 ? (
                                  <div style={{ fontSize:12, color:'#94a3b8' }}>No documents yet</div>
                                ) : (
                                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                                    {l.documents.map(d => (
                                      <div key={d.id} style={{ fontSize:12, color:'#334155', display:'flex', gap:6, alignItems:'center' }}>
                                        <span>📄</span><span>{d.type === 'RATE_CONFIRMATION' ? 'Rate Confirmation' : d.type}</span>
                                      </div>
                                    ))}
                                    {l.pods.map(p => (
                                      <div key={p.id} style={{ display:'flex', gap:6, alignItems:'center' }}>
                                        <span style={{ fontSize:12 }}>✅</span>
                                        <a href={p.fileUrl} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'#3b82f6', textDecoration:'none' }}>{p.podType} — Download ↗</a>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {l.specialInstructions && (
                                  <div style={{ marginTop:12, padding:'8px 10px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:6 }}>
                                    <div style={{ fontSize:10, fontWeight:700, color:'#92400e', marginBottom:2 }}>SPECIAL INSTRUCTIONS</div>
                                    <div style={{ fontSize:11, color:'#78350f' }}>{l.specialInstructions}</div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
