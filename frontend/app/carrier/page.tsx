'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import CarrierTopbar from '@/components/layout/CarrierTopbar';
import api from '@/lib/api';

interface Load {
  id:string; loadNumber:string; status:string;
  pickupCity:string; pickupState:string; deliveryCity:string; deliveryState:string;
  equipment:string; pickupDate:string|null; deliveryDate:string|null;
  carrierRate:number; payment:{ status:string; amount:number }|null;
}
interface Bid {
  id:string; status:string; amount:number|null; createdAt:string;
  load:{ loadNumber:string; pickupCity:string; deliveryCity:string };
}
interface Notification {
  id:string; type:string; title:string; body:string; loadId:string|null; loadNumber:string; createdAt:string;
}

const LCOLOR: Record<string,string> = {
  CREATED:'#94a3b8', DISPATCHED:'#4338ca', DRIVER_ON_ROUTE:'#3730a3',
  LOADING:'#b45309', IN_TRANSIT:'#92400e', ON_ROUTE:'#a16207', UNLOADING:'#c2410c',
  DELIVERED:'#15803d', INVOICED:'#5b21b6', PAYMENTS:'#0e7490',
  RECEIVED:'#0f766e', COMPLETED:'#065f46', CANCELLED:'#b91c1c',
};
const BID_COLOR: Record<string,string> = { PENDING:'#b45309', ACCEPTED:'#065f46', REJECTED:'#b91c1c', WITHDRAWN:'#475569' };

function fmtDate(d:string|null) { return d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'; }
function fmtMoney(n:number) { return `$${n.toLocaleString('en-US',{minimumFractionDigits:0})}`; }
function fmtTs(d:string) { return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric'}); }

function Badge({ status, map }: { status:string; map:Record<string,string> }) {
  const c = map[status] ?? '#64748b';
  return <span style={{ padding:'2px 9px', borderRadius:9999, fontSize:11, fontWeight:700, background:`${c}22`, color:c }}>{status.replace(/_/g,' ')}</span>;
}

export default function CarrierDashboard() {
  const { user } = useAuthStore();
  const router   = useRouter();
  const [loads,   setLoads]   = useState<Load[]>([]);
  const [openCnt, setOpenCnt] = useState(0);
  const [notifs,  setNotifs]  = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/carrier-portal/loads'),
      api.get('/carrier-portal/open-loads'),
      api.get('/carrier-portal/notifications').catch(()=>({ data:[] })),
    ]).then(([myRes, openRes, notifRes]) => {
      setLoads(myRes.data);
      setOpenCnt(openRes.data.length);
      setNotifs(notifRes.data.slice(0,8));
    }).finally(()=>setLoading(false));
  }, []);

  const active    = loads.filter(l=>['DISPATCHED','DRIVER_ON_ROUTE','LOADING','IN_TRANSIT','ON_ROUTE','UNLOADING'].includes(l.status));
  const delivered = loads.filter(l=>['DELIVERED','INVOICED','PAYMENTS','RECEIVED','COMPLETED'].includes(l.status));
  const pending   = loads.filter(l=>['CREATED','BOOKED'].includes(l.status));
  const totalEarned  = delivered.reduce((s,l)=>s+(l.carrierRate||0),0);
  const pendingPay   = loads.reduce((s,l)=>l.payment?.status==='PENDING'?s+(l.payment.amount||0):s, 0);

  const NOTIF_COLOR: Record<string,string> = { BID_ACCEPTED:'#065f46', BID_REJECTED:'#b91c1c', PAYMENT_UPDATE:'#1d4ed8', LOAD_STATUS:'#b45309' };
  const NOTIF_ICON: Record<string,string>  = { BID_ACCEPTED:'✅', BID_REJECTED:'❌', PAYMENT_UPDATE:'💰', LOAD_STATUS:'🚛' };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <CarrierTopbar title="Dashboard" subtitle="Your loads at a glance" />
      <div style={{ flex:1, overflowY:'auto', padding:'24px 28px', background:'#f8fafc' }}>

        {/* Greeting */}
        <div style={{ marginBottom:22 }}>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#0f172a', margin:0 }}>Welcome back, {user?.firstName} 👋</h1>
          <p style={{ color:'#64748b', fontSize:13, marginTop:4 }}>Here's an overview of your loads and earnings</p>
        </div>

        {/* KPI Cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))', gap:14, marginBottom:24 }}>
          {[
            { label:'Active Loads',   value:active.length,        color:'#4338ca', icon:'🚛', href:'/carrier/loads' },
            { label:'Available',      value:openCnt,              color:'#f59e0b', icon:'📋', href:'/carrier/available' },
            { label:'Completed',      value:delivered.length,     color:'#065f46', icon:'✅', href:'/carrier/loads' },
            { label:'Total Earned',   value:fmtMoney(totalEarned),color:'#0f172a', icon:'💰', big:true },
            { label:'Pending Pay',    value:fmtMoney(pendingPay), color:'#b45309', icon:'⏳', href:'/carrier/payments' },
            { label:'Pending Loads',  value:pending.length,       color:'#475569', icon:'📦', href:'/carrier/loads' },
          ].map(c=>(
            <div key={c.label} onClick={()=>c.href&&router.push(c.href)} style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:'18px 20px', borderLeft:`4px solid ${c.color}`, cursor:c.href?'pointer':undefined, transition:'box-shadow 0.15s' }}
              onMouseEnter={e=>{ if(c.href)(e.currentTarget as HTMLElement).style.boxShadow='0 4px 16px rgba(0,0,0,0.08)'; }}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.boxShadow=''; }}>
              <div style={{ fontSize:22, marginBottom:6 }}>{c.icon}</div>
              <div style={{ fontSize:c.big?18:26, fontWeight:800, color:'#0f172a' }}>{c.value}</div>
              <div style={{ fontSize:12, color:'#64748b', fontWeight:600, marginTop:2 }}>{c.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:16 }}>

          {/* Active Loads table */}
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontWeight:700, fontSize:15, color:'#0f172a' }}>🚛 Active Loads</div>
              <button onClick={()=>router.push('/carrier/loads')} style={{ fontSize:12, color:'#3b82f6', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>View all →</button>
            </div>
            {loading ? (
              <div style={{ padding:'32px', textAlign:'center', color:'#94a3b8' }}>Loading…</div>
            ) : active.length===0 ? (
              <div style={{ padding:'40px 24px', textAlign:'center' }}>
                <div style={{ fontSize:36, marginBottom:10 }}>🚛</div>
                <div style={{ color:'#94a3b8', fontSize:14 }}>No active loads right now</div>
                <button onClick={()=>router.push('/carrier/available')} style={{ marginTop:12, padding:'8px 16px', background:'#f59e0b', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', color:'#fff' }}>
                  Browse Available Loads
                </button>
              </div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'#f8fafc' }}>
                    {['Load #','Route','Equipment','Pickup','Rate','Status',''].map(h=>(
                      <th key={h} style={{ padding:'9px 16px', textAlign:'left', color:'#64748b', fontWeight:600, fontSize:11, textTransform:'uppercase', borderBottom:'1px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {active.slice(0,8).map(l=>(
                    <tr key={l.id} style={{ borderTop:'1px solid #f1f5f9' }}>
                      <td style={{ padding:'11px 16px', fontFamily:'monospace', fontWeight:700, color:'#1d4ed8' }}>{l.loadNumber}</td>
                      <td style={{ padding:'11px 16px', color:'#334155' }}>{l.pickupCity}, {l.pickupState}<span style={{ color:'#94a3b8' }}> → </span>{l.deliveryCity}, {l.deliveryState}</td>
                      <td style={{ padding:'11px 16px', color:'#475569' }}>{l.equipment}</td>
                      <td style={{ padding:'11px 16px', color:'#475569' }}>{fmtDate(l.pickupDate)}</td>
                      <td style={{ padding:'11px 16px', fontWeight:600, color:'#0f172a' }}>{fmtMoney(l.carrierRate)}</td>
                      <td style={{ padding:'11px 16px' }}><Badge status={l.status} map={LCOLOR} /></td>
                      <td style={{ padding:'11px 16px' }}>
                        <button onClick={()=>router.push(`/carrier/loads/${l.id}`)} style={{ padding:'4px 11px', background:'#0f172a', color:'#fff', border:'none', borderRadius:5, fontSize:11, fontWeight:700, cursor:'pointer' }}>View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Right column */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

            {/* Recent Notifications */}
            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, overflow:'hidden' }}>
              <div style={{ padding:'14px 18px', borderBottom:'1px solid #f1f5f9', fontWeight:700, fontSize:14, color:'#0f172a' }}>🔔 Recent Activity</div>
              {loading ? (
                <div style={{ padding:24, textAlign:'center', color:'#94a3b8', fontSize:13 }}>Loading…</div>
              ) : notifs.length===0 ? (
                <div style={{ padding:'24px 18px', textAlign:'center', color:'#94a3b8', fontSize:13 }}>No recent activity</div>
              ) : notifs.map(n => {
                const c = NOTIF_COLOR[n.type] ?? '#475569';
                const icon = NOTIF_ICON[n.type] ?? '📌';
                return (
                  <div key={n.id} style={{ padding:'11px 18px', borderBottom:'1px solid #f8fafc', display:'flex', gap:10, alignItems:'flex-start' }}>
                    <span style={{ fontSize:16, flexShrink:0, marginTop:1 }}>{icon}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'#0f172a' }}>{n.title}</div>
                      <div style={{ fontSize:11, color:'#64748b', marginTop:1, lineHeight:1.4 }}>{n.body}</div>
                      <div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>{fmtTs(n.createdAt)}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Recently Completed */}
            {delivered.length > 0 && (
              <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, overflow:'hidden' }}>
                <div style={{ padding:'14px 18px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ fontWeight:700, fontSize:14, color:'#0f172a' }}>✅ Recent Completed</div>
                </div>
                {delivered.slice(0,5).map(l=>(
                  <div key={l.id} style={{ padding:'11px 18px', borderBottom:'1px solid #f8fafc', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}
                    onClick={()=>router.push(`/carrier/loads/${l.id}`)}>
                    <div>
                      <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:12, color:'#1d4ed8' }}>{l.loadNumber}</div>
                      <div style={{ fontSize:11, color:'#475569', marginTop:1 }}>{l.pickupCity} → {l.deliveryCity}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>{fmtMoney(l.carrierRate)}</div>
                      {l.payment && (
                        <div style={{ fontSize:10, marginTop:2, padding:'1px 6px', borderRadius:9999, background: l.payment.status==='PAID'?'#d1fae5':'#fef3c7', color: l.payment.status==='PAID'?'#065f46':'#b45309', fontWeight:700 }}>
                          {l.payment.status}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
