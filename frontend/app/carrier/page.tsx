'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import CarrierTopbar from '@/components/layout/CarrierTopbar';
import api from '@/lib/api';

interface Load {
  id: string; loadNumber: string; status: string;
  pickupCity: string; pickupState: string; deliveryCity: string; deliveryState: string;
  equipment: string; pickupDate: string | null; deliveryDate: string | null;
  carrierRate: number; customer: { name: string } | null;
  invoice: { status: string; totalAmount: number } | null;
}

const LCOLOR: Record<string,string> = {
  CREATED:'#94a3b8', DISPATCHED:'#3b82f6', DRIVER_ON_ROUTE:'#f59e0b',
  IN_TRANSIT:'#f59e0b', ON_ROUTE:'#f59e0b', DELIVERED:'#22c55e',
  INVOICED:'#8b5cf6', PAYMENTS:'#8b5cf6', RECEIVED:'#22c55e', CANCELLED:'#ef4444',
};

function Badge({ status, colors }: { status: string; colors: Record<string,string> }) {
  const c = colors[status] ?? '#64748b';
  return <span style={{ padding:'2px 9px', borderRadius:9999, fontSize:11, fontWeight:700, background:`${c}22`, color:c }}>{status.replace(/_/g,' ')}</span>;
}

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'; }
function fmtMoney(n: number) { return `$${n.toLocaleString()}`; }

export default function CarrierDashboard() {
  const { user } = useAuthStore();
  const router   = useRouter();
  const [loads,      setLoads]      = useState<Load[]>([]);
  const [openCount,  setOpenCount]  = useState(0);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/carrier-portal/loads'),
      api.get('/carrier-portal/open-loads'),
    ]).then(([myRes, openRes]) => {
      setLoads(myRes.data);
      setOpenCount(openRes.data.length);
    }).finally(() => setLoading(false));
  }, []);

  const active    = loads.filter(l => ['DISPATCHED','DRIVER_ON_ROUTE','IN_TRANSIT','ON_ROUTE','LOADING','UNLOADING'].includes(l.status));
  const delivered = loads.filter(l => ['DELIVERED','INVOICED','PAYMENTS','RECEIVED','COMPLETED'].includes(l.status));
  const pending   = loads.filter(l => ['CREATED','BOOKED'].includes(l.status));
  const totalEarned = delivered.reduce((s, l) => s + (l.carrierRate || 0), 0);

  const statCards = [
    { label: 'Active Loads',     value: active.length,        color: '#3b82f6', icon: '🚛', href: '/carrier/loads' },
    { label: 'Available Loads',  value: openCount,            color: '#f59e0b', icon: '📋', href: '/carrier/available' },
    { label: 'Completed',        value: delivered.length,     color: '#22c55e', icon: '✅', href: '/carrier/loads' },
    { label: 'Total Earnings',   value: fmtMoney(totalEarned),color: '#8b5cf6', icon: '💰', big: true },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <CarrierTopbar title="Dashboard" subtitle="Your loads at a glance" />
      <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>

        <div style={{ marginBottom:22 }}>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#0f172a', margin:0 }}>Welcome back, {user?.firstName}</h1>
          <p style={{ color:'#64748b', fontSize:13, marginTop:4 }}>Here's an overview of your loads and earnings</p>
        </div>

        {/* Stat cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:16, marginBottom:28 }}>
          {statCards.map(c => (
            <div key={c.label} onClick={()=>c.href&&router.push(c.href)} style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:'18px 20px', borderLeft:`4px solid ${c.color}`, cursor:c.href?'pointer':undefined, transition:'box-shadow 0.15s' }}
              onMouseEnter={e=>{ if(c.href) (e.currentTarget as HTMLElement).style.boxShadow='0 4px 16px rgba(0,0,0,0.08)'; }}
              onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.boxShadow=''; }}>
              <div style={{ fontSize:22, marginBottom:6 }}>{c.icon}</div>
              <div style={{ fontSize: c.big ? 20 : 28, fontWeight:800, color:'#0f172a' }}>{c.value}</div>
              <div style={{ fontSize:12, color:'#64748b', fontWeight:600, marginTop:2 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Active loads */}
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, marginBottom:20, overflow:'hidden' }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontWeight:700, fontSize:15, color:'#0f172a' }}>🚛 Active Loads</div>
            <button onClick={()=>router.push('/carrier/loads')} style={{ fontSize:12, color:'#3b82f6', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>View all →</button>
          </div>
          {loading ? (
            <div style={{ padding:'32px', textAlign:'center', color:'#94a3b8' }}>Loading…</div>
          ) : active.length === 0 ? (
            <div style={{ padding:'40px 24px', textAlign:'center' }}>
              <div style={{ fontSize:36, marginBottom:10 }}>🚛</div>
              <div style={{ color:'#94a3b8', fontSize:14 }}>No active loads right now</div>
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f8fafc' }}>
                  {['Load #','Route','Equipment','Pickup','Rate','Status',''].map(h => (
                    <th key={h} style={{ padding:'9px 16px', textAlign:'left', color:'#64748b', fontWeight:600, fontSize:11, textTransform:'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {active.slice(0,8).map(l => (
                  <tr key={l.id} style={{ borderTop:'1px solid #f1f5f9' }}>
                    <td style={{ padding:'11px 16px', fontFamily:'monospace', fontWeight:700, color:'#1d4ed8' }}>{l.loadNumber}</td>
                    <td style={{ padding:'11px 16px', color:'#334155' }}>{l.pickupCity}, {l.pickupState} → {l.deliveryCity}, {l.deliveryState}</td>
                    <td style={{ padding:'11px 16px', color:'#475569' }}>{l.equipment}</td>
                    <td style={{ padding:'11px 16px', color:'#475569' }}>{fmtDate(l.pickupDate)}</td>
                    <td style={{ padding:'11px 16px', fontWeight:600, color:'#0f172a' }}>{fmtMoney(l.carrierRate)}</td>
                    <td style={{ padding:'11px 16px' }}><Badge status={l.status} colors={LCOLOR} /></td>
                    <td style={{ padding:'11px 16px' }}>
                      <button onClick={()=>router.push(`/carrier/loads`)} style={{ padding:'4px 11px', background:'#0f172a', color:'#fff', border:'none', borderRadius:5, fontSize:11, fontWeight:700, cursor:'pointer' }}>View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent completed */}
        {delivered.length > 0 && (
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #f1f5f9' }}>
              <div style={{ fontWeight:700, fontSize:15, color:'#0f172a' }}>✅ Recently Completed</div>
            </div>
            <div>
              {delivered.slice(0,5).map(l => (
                <div key={l.id} style={{ padding:'12px 20px', borderBottom:'1px solid #f8fafc', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:12, color:'#1d4ed8' }}>{l.loadNumber}</div>
                    <div style={{ fontSize:11, color:'#475569', marginTop:1 }}>{l.pickupCity} → {l.deliveryCity} · {fmtDate(l.deliveryDate)}</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>{fmtMoney(l.carrierRate)}</span>
                    <Badge status={l.status} colors={LCOLOR} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
