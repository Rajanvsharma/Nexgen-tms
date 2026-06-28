'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CarrierTopbar from '@/components/layout/CarrierTopbar';
import { useAuthStore } from '@/store/auth.store';
import { useSocket } from '@/hooks/useSocket';
import api from '@/lib/api';

interface Stop { id:string; sequence:number; type:string; city:string; state:string; address:string|null; completedAt:string|null; }
interface Pod { id:string; filename:string; fileUrl:string; podType:string; }
interface Load {
  id:string; loadNumber:string; status:string;
  pickupCity:string; pickupState:string; deliveryCity:string; deliveryState:string;
  equipment:string; commodity:string|null; weight:number|null;
  pickupDate:string|null; deliveryDate:string|null; carrierRate:number|null;
  driverName:string|null; driverPhone:string|null;
  customer:{ name:string }|null;
  stops:Stop[]; pods:Pod[];
  payment:{ status:string; amount:number }|null;
  createdAt:string;
}

const STATUS_STYLE: Record<string,{bg:string;color:string}> = {
  CREATED:{bg:'#f1f5f9',color:'#475569'}, BOOKED:{bg:'#dbeafe',color:'#1d4ed8'},
  DISPATCHED:{bg:'#e0e7ff',color:'#4338ca'}, DRIVER_ON_ROUTE:{bg:'#c7d2fe',color:'#3730a3'},
  LOADING:{bg:'#fef3c7',color:'#b45309'}, IN_TRANSIT:{bg:'#fde68a',color:'#92400e'},
  ON_ROUTE:{bg:'#fef9c3',color:'#a16207'}, UNLOADING:{bg:'#ffedd5',color:'#c2410c'},
  DELIVERED:{bg:'#dcfce7',color:'#15803d'}, INVOICED:{bg:'#ddd6fe',color:'#5b21b6'},
  PAYMENTS:{bg:'#cffafe',color:'#0e7490'}, RECEIVED:{bg:'#ccfbf1',color:'#0f766e'},
  COMPLETED:{bg:'#d1fae5',color:'#065f46'}, CANCELLED:{bg:'#fee2e2',color:'#b91c1c'},
};
const PAY_STYLE: Record<string,{bg:string;color:string}> = {
  PENDING:{bg:'#fef3c7',color:'#b45309'}, SCHEDULED:{bg:'#dbeafe',color:'#1d4ed8'},
  PAID:{bg:'#d1fae5',color:'#065f46'}, CANCELLED:{bg:'#fee2e2',color:'#b91c1c'},
};
const STATUS_GROUPS = [
  { label:'All',       values:[] as string[] },
  { label:'Active',    values:['DISPATCHED','DRIVER_ON_ROUTE','LOADING','IN_TRANSIT','ON_ROUTE','UNLOADING'] },
  { label:'Pending',   values:['CREATED','BOOKED'] },
  { label:'Delivered', values:['DELIVERED','INVOICED','PAYMENTS','RECEIVED','COMPLETED'] },
  { label:'Issue',     values:['DELAYED','ON_HOLD','TONU','DISPUTED','CANCELLED'] },
];

function fmtDate(d:string|null) { return d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'; }
function fmtMoney(n:number|null) { return n!=null ? `$${n.toLocaleString('en-US',{minimumFractionDigits:0})}` : '—'; }

export default function CarrierLoadsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loads,   setLoads]   = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [group,   setGroup]   = useState('All');
  const [newBidToast, setNewBidToast] = useState<string|null>(null);

  const fetchLoads = useCallback(() => {
    api.get('/carrier-portal/loads').then(r=>setLoads(r.data)).finally(()=>setLoading(false));
  }, []);

  useEffect(() => { fetchLoads(); }, [fetchLoads]);

  useSocket({
    bid_accepted: (data: unknown) => {
      const d = data as { carrierId?: string; loadNumber?: string };
      if (!d.carrierId || !user?.carrierId) return;
      if (d.carrierId !== user.carrierId) return;
      fetchLoads();
      setNewBidToast(`✅ Your bid on load ${d.loadNumber} was accepted! It's now in your loads.`);
      setTimeout(() => setNewBidToast(null), 6000);
    },
  });

  const visible = loads.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q || l.loadNumber.toLowerCase().includes(q)
      || l.pickupCity.toLowerCase().includes(q) || l.deliveryCity.toLowerCase().includes(q)
      || (l.customer?.name||'').toLowerCase().includes(q)
      || (l.equipment||'').toLowerCase().includes(q);
    const g = STATUS_GROUPS.find(s=>s.label===group);
    const matchGroup = !g || g.values.length===0 || g.values.includes(l.status);
    return matchSearch && matchGroup;
  });

  const counts = STATUS_GROUPS.reduce((acc, g) => {
    acc[g.label] = g.values.length===0 ? loads.length : loads.filter(l=>g.values.includes(l.status)).length;
    return acc;
  }, {} as Record<string,number>);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <CarrierTopbar title="My Loads" subtitle="All loads assigned to your carrier" />
      {newBidToast && (
        <div style={{ background:'#065f46', color:'#fff', padding:'12px 24px', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:10 }}>
          {newBidToast}
          <button onClick={()=>setNewBidToast(null)} style={{ marginLeft:'auto', background:'none', border:'none', color:'rgba(255,255,255,0.7)', cursor:'pointer', fontSize:16 }}>✕</button>
        </div>
      )}
      <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>

        <div style={{ marginBottom:16 }}>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#0f172a', margin:0 }}>My Loads</h1>
          <p style={{ color:'#64748b', fontSize:13, marginTop:4 }}>{loads.length} total loads assigned to your carrier</p>
        </div>

        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:'14px 16px', marginBottom:16, display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by load #, city, customer…"
            style={{ height:36, padding:'0 12px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, width:260, outline:'none' }} />
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {STATUS_GROUPS.map(g => (
              <button key={g.label} onClick={()=>setGroup(g.label)} style={{ padding:'5px 12px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', border:'none',
                background: group===g.label ? '#0f172a' : '#f1f5f9', color: group===g.label ? '#fff' : '#475569' }}>
                {g.label} ({counts[g.label]||0})
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ display:'grid', placeItems:'center', height:200, color:'#94a3b8' }}>Loading…</div>
        ) : visible.length === 0 ? (
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:'56px 24px', textAlign:'center' }}>
            <div style={{ fontSize:48, marginBottom:14 }}>🚛</div>
            <div style={{ fontSize:17, fontWeight:700, color:'#0f172a', marginBottom:8 }}>No loads found</div>
            <div style={{ color:'#64748b', fontSize:13 }}>
              {loads.length===0 ? 'Loads assigned to your carrier will appear here.' : 'Try clearing your filters.'}
            </div>
          </div>
        ) : (
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f8fafc' }}>
                  {['Load #','Route','Equipment','Pickup','Delivery','Rate','Payment','Status',''].map(h=>(
                    <th key={h} style={{ padding:'10px 16px', textAlign:'left', color:'#64748b', fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid #e2e8f0', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(l => {
                  const ss = STATUS_STYLE[l.status] ?? { bg:'#f1f5f9', color:'#475569' };
                  const ps = l.payment ? PAY_STYLE[l.payment.status] : null;
                  return (
                    <tr key={l.id} style={{ borderTop:'1px solid #f1f5f9' }}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#fafafa'}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=''}>
                      <td style={{ padding:'12px 16px' }}>
                        <span style={{ fontFamily:'monospace', fontWeight:700, color:'#1d4ed8', fontSize:13 }}>{l.loadNumber}</span>
                      </td>
                      <td style={{ padding:'12px 16px' }}>
                        <div style={{ fontSize:13, fontWeight:600, color:'#0f172a' }}>{l.pickupCity}, {l.pickupState}</div>
                        <div style={{ fontSize:11, color:'#94a3b8' }}>→ {l.deliveryCity}, {l.deliveryState}</div>
                      </td>
                      <td style={{ padding:'12px 16px', color:'#475569' }}>{l.equipment}</td>
                      <td style={{ padding:'12px 16px', color:'#475569', whiteSpace:'nowrap' }}>{fmtDate(l.pickupDate)}</td>
                      <td style={{ padding:'12px 16px', color:'#475569', whiteSpace:'nowrap' }}>{fmtDate(l.deliveryDate)}</td>
                      <td style={{ padding:'12px 16px', fontWeight:700, color:'#0f172a' }}>{fmtMoney(l.carrierRate)}</td>
                      <td style={{ padding:'12px 16px' }}>
                        {ps ? (
                          <span style={{ padding:'2px 8px', borderRadius:9999, fontSize:11, fontWeight:700, background:ps.bg, color:ps.color }}>
                            {l.payment!.status}
                          </span>
                        ) : <span style={{ color:'#94a3b8', fontSize:11 }}>—</span>}
                      </td>
                      <td style={{ padding:'12px 16px' }}>
                        <span style={{ padding:'2px 9px', borderRadius:9999, fontSize:11, fontWeight:700, background:ss.bg, color:ss.color, whiteSpace:'nowrap' }}>
                          {l.status.replace(/_/g,' ')}
                        </span>
                      </td>
                      <td style={{ padding:'12px 16px' }}>
                        <button onClick={()=>router.push(`/carrier/loads/${l.id}`)}
                          style={{ padding:'5px 12px', background:'#0f172a', color:'#fff', border:'none', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer' }}>
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
