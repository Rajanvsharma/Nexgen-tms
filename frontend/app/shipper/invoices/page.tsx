'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface Invoice {
  id: string; invoiceNumber: string; amount: number; status: string;
  dueDate: string | null; paidDate: string | null; notes: string | null; createdAt: string;
  load: { loadNumber: string; pickupCity: string; pickupState: string; deliveryCity: string; deliveryState: string; status: string } | null;
}

const COLORS: Record<string,string> = { DRAFT:'#94a3b8', SENT:'#3b82f6', PAID:'#22c55e', OVERDUE:'#ef4444', VOID:'#94a3b8' };

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'; }
function fmtMoney(n: number) { return `$${n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`; }

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('All');

  useEffect(() => {
    api.get('/portal/invoices').then(r => setInvoices(r.data)).finally(() => setLoading(false));
  }, []);

  const visible = filter === 'All' ? invoices : invoices.filter(i => i.status === filter);
  const totalDue = invoices.filter(i => i.status !== 'PAID' && i.status !== 'VOID').reduce((s,i)=>s+i.amount,0);
  const totalPaid = invoices.filter(i => i.status === 'PAID').reduce((s,i)=>s+i.amount,0);

  return (
    <div>
      <div style={{ marginBottom:22 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:'#0f172a', margin:0 }}>💰 Invoices</h1>
        <p style={{ color:'#64748b', fontSize:13, marginTop:4 }}>{invoices.length} invoices</p>
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginBottom:22 }}>
        {[
          { label:'Total Outstanding', value:fmtMoney(totalDue), color:'#ef4444', bg:'#fee2e2', icon:'⚠️' },
          { label:'Total Paid', value:fmtMoney(totalPaid), color:'#22c55e', bg:'#f0fdf4', icon:'✅' },
          { label:'Total Invoices', value:String(invoices.length), color:'#3b82f6', bg:'#eff6ff', icon:'📋' },
        ].map(({ label, value, color, bg, icon }) => (
          <div key={label} style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:'16px 18px', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:42, height:42, borderRadius:10, background:bg, display:'grid', placeItems:'center', fontSize:18, flexShrink:0 }}>{icon}</div>
            <div>
              <div style={{ fontSize:20, fontWeight:800, color }}>{value}</div>
              <div style={{ fontSize:11, color:'#64748b' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:14 }}>
        {['All','SENT','OVERDUE','PAID','DRAFT'].map(s => (
          <button key={s} onClick={()=>setFilter(s)} style={{ padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', border:'none', background:filter===s?'#0f172a':'#f1f5f9', color:filter===s?'#fff':'#475569' }}>
            {s} {s!=='All' && `(${invoices.filter(i=>i.status===s).length})`}
          </button>
        ))}
      </div>

      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden' }}>
        {loading ? (
          <div style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>Loading…</div>
        ) : visible.length === 0 ? (
          <div style={{ padding:'48px 24px', textAlign:'center', color:'#94a3b8', fontSize:14 }}>
            {invoices.length === 0 ? 'No invoices yet. Invoices are generated after load delivery.' : 'No invoices match your filter.'}
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f8fafc' }}>
                {['Invoice #','Load','Route','Amount','Status','Due Date','Paid Date'].map(h=>(
                  <th key={h} style={{ padding:'10px 16px', textAlign:'left', color:'#64748b', fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:'0.4px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(inv => {
                const c = COLORS[inv.status] ?? '#64748b';
                return (
                  <tr key={inv.id} style={{ borderTop:'1px solid #f1f5f9' }}>
                    <td style={{ padding:'12px 16px', fontFamily:'monospace', fontWeight:700, color:'#1d4ed8' }}>{inv.invoiceNumber}</td>
                    <td style={{ padding:'12px 16px', fontFamily:'monospace', fontSize:12, color:'#475569' }}>{inv.load?.loadNumber ?? '—'}</td>
                    <td style={{ padding:'12px 16px', color:'#334155', fontSize:12 }}>{inv.load ? `${inv.load.pickupCity} → ${inv.load.deliveryCity}` : '—'}</td>
                    <td style={{ padding:'12px 16px', fontWeight:700, color:'#0f172a' }}>{fmtMoney(inv.amount)}</td>
                    <td style={{ padding:'12px 16px' }}><span style={{ padding:'2px 9px', borderRadius:9999, fontSize:11, fontWeight:700, background:`${c}22`, color:c }}>{inv.status}</span></td>
                    <td style={{ padding:'12px 16px', color: inv.status==='OVERDUE' ? '#ef4444':'#475569', fontWeight: inv.status==='OVERDUE' ? 600 : 400 }}>{fmtDate(inv.dueDate)}</td>
                    <td style={{ padding:'12px 16px', color:'#475569' }}>{fmtDate(inv.paidDate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
