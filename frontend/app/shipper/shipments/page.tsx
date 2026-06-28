'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface Load {
  id: string; loadNumber: string; status: string;
  pickupCity: string; pickupState: string; deliveryCity: string; deliveryState: string;
  equipment: string; commodity: string | null; weight: number | null;
  pickupDate: string | null; deliveryDate: string | null; customerRate: number;
  driverName: string | null; driverPhone: string | null;
  carrier: { name: string; phone: string | null } | null;
  createdAt: string;
}

const COLORS: Record<string,string> = { CREATED:'#94a3b8', DISPATCHED:'#3b82f6', IN_TRANSIT:'#f59e0b', DELIVERED:'#22c55e', INVOICED:'#8b5cf6', CANCELLED:'#ef4444' };
const STATUSES = ['All','CREATED','DISPATCHED','IN_TRANSIT','DELIVERED','INVOICED','CANCELLED'];

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'; }

export default function ShipmentsPage() {
  const [loads, setLoads]     = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('All');
  const [search, setSearch]   = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    api.get('/portal/loads').then(r => setLoads(r.data)).finally(() => setLoading(false));
  }, []);

  const visible = loads.filter(l => {
    const matchStatus = filter === 'All' || l.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || l.loadNumber.toLowerCase().includes(q) || l.pickupCity.toLowerCase().includes(q) || l.deliveryCity.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div>
      <div style={{ marginBottom:22 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:'#0f172a', margin:0 }}>🚚 My Shipments</h1>
        <p style={{ color:'#64748b', fontSize:13, marginTop:4 }}>{loads.length} total shipments</p>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap', alignItems:'center' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by load #, city…" style={{ height:36, padding:'0 12px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, width:220, outline:'none' }} />
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {STATUSES.map(s => (
            <button key={s} onClick={()=>setFilter(s)} style={{ padding:'5px 12px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', border:'none', background: filter===s ? '#0f172a' : '#f1f5f9', color: filter===s ? '#fff' : '#475569' }}>
              {s.replace('_',' ')} {s!=='All' && `(${loads.filter(l=>l.status===s).length})`}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden' }}>
        {loading ? (
          <div style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>Loading…</div>
        ) : visible.length === 0 ? (
          <div style={{ padding:'48px 24px', textAlign:'center', color:'#94a3b8', fontSize:14 }}>
            {loads.length === 0 ? 'No shipments yet. Approved quotes will appear here.' : 'No shipments match your filter.'}
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f8fafc' }}>
                {['Load #','Route','Equipment','Carrier','Pickup','Status','Rate'].map(h=>(
                  <th key={h} style={{ padding:'10px 16px', textAlign:'left', color:'#64748b', fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:'0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(l => {
                const c = COLORS[l.status] ?? '#64748b';
                const isOpen = expanded === l.id;
                return (
                  <>
                    <tr key={l.id} onClick={()=>setExpanded(isOpen ? null : l.id)} style={{ borderTop:'1px solid #f1f5f9', cursor:'pointer', background: isOpen ? '#f8fafc' : undefined }}>
                      <td style={{ padding:'12px 16px', fontFamily:'monospace', fontWeight:700, color:'#1d4ed8' }}>{l.loadNumber}</td>
                      <td style={{ padding:'12px 16px', color:'#334155' }}>{l.pickupCity}, {l.pickupState} → {l.deliveryCity}, {l.deliveryState}</td>
                      <td style={{ padding:'12px 16px', color:'#475569' }}>{l.equipment}</td>
                      <td style={{ padding:'12px 16px', color:'#475569' }}>{l.carrier?.name ?? <span style={{ color:'#94a3b8', fontStyle:'italic' }}>Assigning…</span>}</td>
                      <td style={{ padding:'12px 16px', color:'#475569' }}>{fmtDate(l.pickupDate)}</td>
                      <td style={{ padding:'12px 16px' }}><span style={{ padding:'2px 9px', borderRadius:9999, fontSize:11, fontWeight:700, background:`${c}22`, color:c }}>{l.status.replace('_',' ')}</span></td>
                      <td style={{ padding:'12px 16px', fontWeight:600, color:'#0f172a' }}>{l.customerRate > 0 ? `$${l.customerRate.toLocaleString()}` : '—'}</td>
                    </tr>
                    {isOpen && (
                      <tr key={`${l.id}-detail`} style={{ background:'#f8fafc', borderTop:'1px solid #e2e8f0' }}>
                        <td colSpan={7} style={{ padding:'14px 20px' }}>
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
                            <div><div style={{ fontSize:10, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', marginBottom:3 }}>Delivery Date</div><div style={{ fontSize:13, color:'#334155' }}>{fmtDate(l.deliveryDate)}</div></div>
                            <div><div style={{ fontSize:10, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', marginBottom:3 }}>Commodity</div><div style={{ fontSize:13, color:'#334155' }}>{l.commodity ?? '—'}</div></div>
                            <div><div style={{ fontSize:10, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', marginBottom:3 }}>Weight</div><div style={{ fontSize:13, color:'#334155' }}>{l.weight ? `${l.weight.toLocaleString()} lbs` : '—'}</div></div>
                            <div><div style={{ fontSize:10, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', marginBottom:3 }}>Driver</div><div style={{ fontSize:13, color:'#334155' }}>{l.driverName ?? '—'}{l.driverPhone && <span style={{ color:'#64748b' }}> · {l.driverPhone}</span>}</div></div>
                            {l.carrier?.phone && <div><div style={{ fontSize:10, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', marginBottom:3 }}>Carrier Phone</div><div style={{ fontSize:13, color:'#334155' }}>{l.carrier.phone}</div></div>}
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
  );
}
