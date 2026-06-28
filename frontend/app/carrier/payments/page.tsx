'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CarrierTopbar from '@/components/layout/CarrierTopbar';
import api from '@/lib/api';

interface Payment {
  id:string; amount:number; status:string;
  dueDate:string|null; paidDate:string|null; notes:string|null;
  createdAt:string; updatedAt:string;
  load: { loadNumber:string; pickupCity:string; pickupState:string; deliveryCity:string; deliveryState:string; deliveryDate:string|null; };
}

const STATUS_STYLE: Record<string,{bg:string;color:string}> = {
  PENDING:   { bg:'#fef3c7', color:'#b45309' },
  SCHEDULED: { bg:'#dbeafe', color:'#1d4ed8' },
  PAID:      { bg:'#d1fae5', color:'#065f46' },
  CANCELLED: { bg:'#fee2e2', color:'#b91c1c' },
};

function fmtDate(d:string|null) { return d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'; }
function fmtMoney(n:number) { return `$${n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`; }

export default function CarrierPaymentsPage() {
  const router  = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('ALL');

  useEffect(() => {
    api.get('/carrier-portal/payments').then(r=>setPayments(r.data)).finally(()=>setLoading(false));
  }, []);

  const visible = filter==='ALL' ? payments : payments.filter(p=>p.status===filter);

  const totalPaid    = payments.filter(p=>p.status==='PAID').reduce((s,p)=>s+p.amount,0);
  const totalPending = payments.filter(p=>p.status==='PENDING'||p.status==='SCHEDULED').reduce((s,p)=>s+p.amount,0);
  const totalAll     = payments.reduce((s,p)=>s+p.amount,0);

  const FILTERS = ['ALL','PENDING','SCHEDULED','PAID','CANCELLED'];

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <CarrierTopbar title="Payments" subtitle="Payment status for all your loads" />
      <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>

        <div style={{ marginBottom:20 }}>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#0f172a', margin:0 }}>Payment History</h1>
          <p style={{ color:'#64748b', fontSize:13, marginTop:4 }}>Track all payments for your completed loads</p>
        </div>

        {/* Summary cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:14, marginBottom:24 }}>
          {[
            { label:'Total Earnings',  value:fmtMoney(totalAll),     color:'#0f172a', icon:'💰' },
            { label:'Received',        value:fmtMoney(totalPaid),    color:'#065f46', icon:'✅' },
            { label:'Pending/Due',     value:fmtMoney(totalPending), color:'#b45309', icon:'⏳' },
            { label:'Payments',        value:payments.length,        color:'#475569', icon:'📋' },
          ].map(c => (
            <div key={c.label} style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:'18px 20px', borderLeft:`4px solid ${c.color}` }}>
              <div style={{ fontSize:22, marginBottom:6 }}>{c.icon}</div>
              <div style={{ fontSize:20, fontWeight:800, color:'#0f172a' }}>{c.value}</div>
              <div style={{ fontSize:12, color:'#64748b', fontWeight:600, marginTop:2 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Filter chips */}
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
          {FILTERS.map(f => {
            const count = f==='ALL' ? payments.length : payments.filter(p=>p.status===f).length;
            const st    = STATUS_STYLE[f] || { bg:'#f1f5f9', color:'#475569' };
            return (
              <button key={f} onClick={()=>setFilter(f)} style={{ padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', border:`2px solid ${filter===f ? st.color : 'transparent'}`,
                background: filter===f ? st.bg : '#f1f5f9', color: filter===f ? st.color : '#475569' }}>
                {f} ({count})
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ display:'grid', placeItems:'center', height:200, color:'#94a3b8' }}>Loading…</div>
        ) : visible.length === 0 ? (
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:'56px 24px', textAlign:'center' }}>
            <div style={{ fontSize:48, marginBottom:14 }}>💰</div>
            <div style={{ fontSize:17, fontWeight:700, color:'#0f172a', marginBottom:8 }}>No payments found</div>
            <div style={{ color:'#64748b', fontSize:13 }}>Payments will appear here once loads are delivered and invoiced.</div>
          </div>
        ) : (
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f8fafc' }}>
                  {['Load','Route','Delivered','Amount','Due Date','Paid Date','Status'].map(h=>(
                    <th key={h} style={{ padding:'10px 16px', textAlign:'left', color:'#64748b', fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid #e2e8f0', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(p => {
                  const ss = STATUS_STYLE[p.status] ?? { bg:'#f1f5f9', color:'#475569' };
                  const isOverdue = p.status==='PENDING' && p.dueDate && new Date(p.dueDate) < new Date();
                  return (
                    <tr key={p.id} style={{ borderTop:'1px solid #f1f5f9' }}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#fafafa'}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=''}>
                      <td style={{ padding:'12px 16px' }}>
                        <span style={{ fontFamily:'monospace', fontWeight:700, color:'#1d4ed8', fontSize:13 }}>{p.load.loadNumber}</span>
                      </td>
                      <td style={{ padding:'12px 16px' }}>
                        <div style={{ fontSize:13, fontWeight:500, color:'#0f172a' }}>{p.load.pickupCity}, {p.load.pickupState}</div>
                        <div style={{ fontSize:11, color:'#94a3b8' }}>→ {p.load.deliveryCity}, {p.load.deliveryState}</div>
                      </td>
                      <td style={{ padding:'12px 16px', color:'#475569', whiteSpace:'nowrap' }}>{fmtDate(p.load.deliveryDate)}</td>
                      <td style={{ padding:'12px 16px', fontWeight:800, fontSize:14, color:'#0f172a' }}>{fmtMoney(p.amount)}</td>
                      <td style={{ padding:'12px 16px', whiteSpace:'nowrap' }}>
                        <span style={{ color: isOverdue ? '#b91c1c' : '#475569', fontWeight: isOverdue ? 700 : 400 }}>
                          {fmtDate(p.dueDate)}{isOverdue ? ' ⚠️' : ''}
                        </span>
                      </td>
                      <td style={{ padding:'12px 16px', color:'#22c55e', fontWeight:600, whiteSpace:'nowrap' }}>
                        {p.paidDate ? fmtDate(p.paidDate) : '—'}
                      </td>
                      <td style={{ padding:'12px 16px' }}>
                        <span style={{ padding:'2px 9px', borderRadius:9999, fontSize:11, fontWeight:700, background:ss.bg, color:ss.color }}>
                          {p.status}
                        </span>
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
