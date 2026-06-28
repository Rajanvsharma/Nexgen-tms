'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import ShipperTopbar from '@/components/layout/ShipperTopbar';
import api from '@/lib/api';

interface Quote { id: string; quoteNumber: string; status: string; pickupCity: string; pickupState: string; deliveryCity: string; deliveryState: string; equipment: string; rate: number; createdAt: string; }
interface Load  { id: string; loadNumber: string; status: string; pickupCity: string; pickupState: string; deliveryCity: string; deliveryState: string; equipment: string; pickupDate: string | null; carrier: { name: string } | null; }
interface Invoice { id: string; invoiceNumber: string; amount: number; status: string; dueDate: string | null; }

const QCOLOR: Record<string,string> = { PENDING:'#f59e0b', APPROVED:'#22c55e', REJECTED:'#ef4444', CONVERTED:'#3b82f6' };
const LCOLOR: Record<string,string> = { CREATED:'#94a3b8', DISPATCHED:'#3b82f6', IN_TRANSIT:'#f59e0b', DELIVERED:'#22c55e', INVOICED:'#8b5cf6', CANCELLED:'#ef4444' };

function Badge({ status, colors }: { status: string; colors: Record<string,string> }) {
  const c = colors[status] ?? '#64748b';
  return <span style={{ padding:'2px 9px', borderRadius:9999, fontSize:11, fontWeight:700, background:`${c}22`, color:c }}>{status.replace('_',' ')}</span>;
}

export default function ShipperDashboard() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [quotes, setQuotes]   = useState<Quote[]>([]);
  const [loads, setLoads]     = useState<Load[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/portal/quotes'),
      api.get('/portal/loads'),
      api.get('/portal/invoices').catch(() => ({ data: [] })),
    ]).then(([q, l, inv]) => {
      setQuotes(q.data); setLoads(l.data); setInvoices(inv.data);
    }).finally(() => setLoading(false));
  }, []);

  const pendingQ  = quotes.filter(q => q.status === 'PENDING').length;
  const inTransit = loads.filter(l => l.status === 'IN_TRANSIT').length;
  const delivered = loads.filter(l => l.status === 'DELIVERED').length;
  const openInv   = invoices.filter(i => i.status !== 'PAID').length;

  const stats = [
    { label:'Pending Quotes', value:pendingQ,  color:'#f59e0b', bg:'#fffbeb', icon:'💬' },
    { label:'In Transit',     value:inTransit, color:'#3b82f6', bg:'#eff6ff', icon:'🚚' },
    { label:'Delivered',      value:delivered, color:'#22c55e', bg:'#f0fdf4', icon:'✅' },
    { label:'Open Invoices',  value:openInv,   color:'#8b5cf6', bg:'#f5f3ff', icon:'💰' },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <ShipperTopbar title="Dashboard" subtitle="Shipments overview" />
      <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>
      {/* Header */}
      <div style={{ marginBottom:26 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:'#0f172a', margin:0 }}>Welcome back, {user?.firstName} 👋</h1>
        <p style={{ color:'#64748b', fontSize:13, marginTop:4 }}>Here's an overview of your shipments and quotes.</p>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:28 }}>
        {stats.map(({ label, value, color, bg, icon }) => (
          <div key={label} style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:'18px 20px', display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:46, height:46, borderRadius:11, background:bg, display:'grid', placeItems:'center', fontSize:20, flexShrink:0 }}>{icon}</div>
            <div>
              <div style={{ fontSize:28, fontWeight:800, color }}>{value}</div>
              <div style={{ fontSize:11, color:'#64748b', marginTop:1 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>Loading…</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

          {/* Recent Quotes */}
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontWeight:700, fontSize:14, color:'#0f172a' }}>💬 Recent Quotes</div>
              <button onClick={() => router.push('/shipper/new-quote')} style={{ fontSize:12, color:'#3b82f6', background:'#eff6ff', border:'none', padding:'4px 12px', borderRadius:6, cursor:'pointer', fontWeight:600 }}>+ New</button>
            </div>
            {quotes.length === 0 ? (
              <div style={{ padding:'32px 18px', textAlign:'center', color:'#94a3b8', fontSize:13 }}>No quotes yet</div>
            ) : (
              <div>
                {quotes.slice(0,5).map(q => (
                  <div key={q.id} style={{ padding:'11px 18px', borderBottom:'1px solid #f8fafc', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:'#1d4ed8', fontFamily:'monospace' }}>{q.quoteNumber}</div>
                      <div style={{ fontSize:11, color:'#475569', marginTop:1 }}>{q.pickupCity} → {q.deliveryCity}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <Badge status={q.status} colors={QCOLOR} />
                      <div style={{ fontSize:11, color:'#94a3b8', marginTop:3 }}>{q.rate > 0 ? `$${q.rate.toLocaleString()}` : 'TBD'}</div>
                    </div>
                  </div>
                ))}
                {quotes.length > 5 && (
                  <div style={{ padding:'10px 18px', textAlign:'center' }}>
                    <button onClick={() => router.push('/shipper')} style={{ fontSize:12, color:'#3b82f6', background:'none', border:'none', cursor:'pointer' }}>View all {quotes.length} quotes →</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recent Shipments */}
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontWeight:700, fontSize:14, color:'#0f172a' }}>🚚 Active Shipments</div>
              <button onClick={() => router.push('/shipper/shipments')} style={{ fontSize:12, color:'#3b82f6', background:'#eff6ff', border:'none', padding:'4px 12px', borderRadius:6, cursor:'pointer', fontWeight:600 }}>View all</button>
            </div>
            {loads.length === 0 ? (
              <div style={{ padding:'32px 18px', textAlign:'center', color:'#94a3b8', fontSize:13 }}>No active shipments</div>
            ) : (
              <div>
                {loads.slice(0,5).map(l => (
                  <div key={l.id} style={{ padding:'11px 18px', borderBottom:'1px solid #f8fafc', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:'#1d4ed8', fontFamily:'monospace' }}>{l.loadNumber}</div>
                      <div style={{ fontSize:11, color:'#475569', marginTop:1 }}>{l.pickupCity} → {l.deliveryCity} · {l.equipment}</div>
                    </div>
                    <Badge status={l.status} colors={LCOLOR} />
                  </div>
                ))}
                {loads.length > 5 && (
                  <div style={{ padding:'10px 18px', textAlign:'center' }}>
                    <button onClick={() => router.push('/shipper/shipments')} style={{ fontSize:12, color:'#3b82f6', background:'none', border:'none', cursor:'pointer' }}>View all {loads.length} shipments →</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Open Invoices */}
          {invoices.length > 0 && (
            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden', gridColumn:'1/-1' }}>
              <div style={{ padding:'14px 18px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ fontWeight:700, fontSize:14, color:'#0f172a' }}>💰 Recent Invoices</div>
                <button onClick={() => router.push('/shipper/invoices')} style={{ fontSize:12, color:'#8b5cf6', background:'#f5f3ff', border:'none', padding:'4px 12px', borderRadius:6, cursor:'pointer', fontWeight:600 }}>View all</button>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead><tr style={{ background:'#f8fafc' }}>
                  {['Invoice #','Amount','Status','Due Date'].map(h=>(
                    <th key={h} style={{ padding:'9px 18px', textAlign:'left', color:'#64748b', fontWeight:600, fontSize:11, textTransform:'uppercase' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {invoices.slice(0,4).map(inv => (
                    <tr key={inv.id} style={{ borderTop:'1px solid #f1f5f9' }}>
                      <td style={{ padding:'10px 18px', fontFamily:'monospace', fontWeight:700, color:'#1d4ed8' }}>{inv.invoiceNumber}</td>
                      <td style={{ padding:'10px 18px', fontWeight:600 }}>${inv.amount.toLocaleString()}</td>
                      <td style={{ padding:'10px 18px' }}><Badge status={inv.status} colors={{ DRAFT:'#94a3b8', SENT:'#3b82f6', PAID:'#22c55e', OVERDUE:'#ef4444' }} /></td>
                      <td style={{ padding:'10px 18px', color:'#64748b' }}>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
