'use client';

import { useEffect, useState } from 'react';
import CarrierTopbar from '@/components/layout/CarrierTopbar';
import api from '@/lib/api';

interface Stop { id:string; sequence:number; type:string; city:string; state:string; }
interface MyBid { id:string; amount:number|null; notes:string|null; status:string; createdAt:string; }
interface OpenLoad {
  id:string; loadNumber:string; status:string;
  pickupCity:string; pickupState:string; deliveryCity:string; deliveryState:string;
  equipment:string; commodity:string|null; weight:number|null;
  pickupDate:string|null; deliveryDate:string|null; specialInstructions:string|null;
  stops:Stop[]; myBid:MyBid|null; createdAt:string;
}

function fmtDate(d:string|null) {
  return d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
}
function daysDiff(d:string|null) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}
function fmtMoney(n:number) { return `$${n.toLocaleString('en-US',{minimumFractionDigits:0})}`; }

const BID_STYLE: Record<string,{bg:string;color:string;label:string}> = {
  PENDING:   { bg:'#fef3c7', color:'#b45309', label:'⏳ Bid Pending' },
  ACCEPTED:  { bg:'#d1fae5', color:'#065f46', label:'✓ Bid Accepted' },
  REJECTED:  { bg:'#fee2e2', color:'#b91c1c', label:'✗ Bid Rejected' },
  WITHDRAWN: { bg:'#f1f5f9', color:'#475569', label:'Withdrawn' },
};

const EQUIP_TYPES = ['All','Dry Van','Reefer','Flatbed','Step Deck','Power Only','Box Truck','Sprinter'];

export default function AvailableLoadsPage() {
  const [loads,     setLoads]     = useState<OpenLoad[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [eqFilter,  setEqFilter]  = useState('All');
  const [expanded,  setExpanded]  = useState<string|null>(null);
  const [bidModal,  setBidModal]  = useState<OpenLoad|null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidNotes,  setBidNotes]  = useState('');
  const [bidSaving, setBidSaving] = useState(false);
  const [toast,     setToast]     = useState<{msg:string;ok:boolean}|null>(null);

  function showToast(msg:string, ok=true) {
    setToast({msg,ok});
    setTimeout(()=>setToast(null),3000);
  }

  useEffect(() => {
    reload();
  }, []);

  function reload() {
    setLoading(true);
    api.get('/carrier-portal/open-loads').then(r=>setLoads(r.data)).finally(()=>setLoading(false));
  }

  const visible = loads.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q || l.loadNumber.toLowerCase().includes(q)
      || l.pickupCity.toLowerCase().includes(q) || l.deliveryCity.toLowerCase().includes(q)
      || l.pickupState.toLowerCase().includes(q) || l.deliveryState.toLowerCase().includes(q)
      || (l.equipment||'').toLowerCase().includes(q);
    const matchEq = eqFilter === 'All' || l.equipment === eqFilter;
    return matchSearch && matchEq;
  });

  async function handleSubmitBid() {
    if (!bidModal) return;
    setBidSaving(true);
    try {
      await api.post(`/carrier-portal/open-loads/${bidModal.id}/bid`, {
        amount: bidAmount ? parseFloat(bidAmount) : null,
        notes: bidNotes || null,
      });
      showToast('Bid submitted successfully!');
      setBidModal(null); setBidAmount(''); setBidNotes('');
      reload();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Failed to submit bid', false);
    } finally {
      setBidSaving(false);
    }
  }

  async function handleWithdraw(loadId:string) {
    try {
      await api.delete(`/carrier-portal/open-loads/${loadId}/bid`);
      showToast('Bid withdrawn');
      reload();
    } catch {
      showToast('Failed to withdraw bid', false);
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <CarrierTopbar title="Available Loads" subtitle="Open loads looking for a carrier" />

      {toast && (
        <div style={{ position:'fixed', top:16, right:16, zIndex:9999, padding:'12px 20px', borderRadius:10, background: toast.ok ? '#d1fae5' : '#fee2e2', color: toast.ok ? '#065f46' : '#b91c1c', fontWeight:700, fontSize:13, boxShadow:'0 4px 16px rgba(0,0,0,0.12)' }}>
          {toast.msg}
        </div>
      )}

      <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>
        {/* Header */}
        <div style={{ marginBottom:20 }}>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#0f172a', margin:0 }}>Load Board</h1>
          <p style={{ color:'#64748b', fontSize:13, marginTop:4 }}>
            {loads.length} open load{loads.length!==1?'s':''} available · Submit a rate bid or express interest
          </p>
        </div>

        {/* Filters */}
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:'14px 16px', marginBottom:18, display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by city, state, equipment, load #…"
            style={{ height:36, padding:'0 12px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, width:280, outline:'none' }} />
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {EQUIP_TYPES.map(eq => (
              <button key={eq} onClick={()=>setEqFilter(eq)} style={{ padding:'5px 12px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', border:'none',
                background: eqFilter===eq ? '#f59e0b' : '#f1f5f9', color: eqFilter===eq ? '#fff' : '#475569' }}>
                {eq}{eq!=='All' && ` (${loads.filter(l=>l.equipment===eq).length})`}
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
              {loads.length===0 ? 'No available loads right now' : 'No loads match your filter'}
            </div>
            <div style={{ color:'#64748b', fontSize:13 }}>
              {loads.length===0 ? 'New loads will appear here as soon as dispatchers create them.' : 'Try clearing your filters.'}
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {visible.map(l => {
              const days    = daysDiff(l.pickupDate);
              const urgency = days!==null && days<=2 ? '#ef4444' : days!==null && days<=7 ? '#f59e0b' : '#22c55e';
              const isOpen  = expanded === l.id;
              const bid     = l.myBid;
              const bidStyle = bid ? BID_STYLE[bid.status] : null;

              return (
                <div key={l.id} style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, overflow:'hidden' }}>
                  {/* Main row */}
                  <div style={{ padding:'16px 20px', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>

                    {/* Route info */}
                    <div style={{ flex:'0 0 auto', minWidth:240 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                        <span style={{ fontFamily:'monospace', fontWeight:800, fontSize:12, color:'#1d4ed8', background:'#eff6ff', padding:'2px 7px', borderRadius:4 }}>{l.loadNumber}</span>
                        <span style={{ fontSize:11, padding:'2px 8px', borderRadius:9999, background:'#f1f5f9', color:'#475569', fontWeight:600 }}>{l.equipment}</span>
                        {bidStyle && (
                          <span style={{ fontSize:11, padding:'2px 9px', borderRadius:9999, background:bidStyle.bg, color:bidStyle.color, fontWeight:700 }}>
                            {bidStyle.label}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize:15, fontWeight:700, color:'#0f172a' }}>
                        {l.pickupCity}, {l.pickupState}
                        <span style={{ color:'#94a3b8', fontWeight:400, fontSize:13, margin:'0 8px' }}>→</span>
                        {l.deliveryCity}, {l.deliveryState}
                      </div>
                      {l.stops.length > 0 && <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>+{l.stops.length} stop{l.stops.length!==1?'s':''}</div>}
                    </div>

                    {/* Dates & details */}
                    <div style={{ display:'flex', gap:24, flex:1, flexWrap:'wrap' }}>
                      <div>
                        <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', marginBottom:2 }}>Pickup</div>
                        <div style={{ fontSize:13, fontWeight:600, color: days!==null&&days<=0 ? '#ef4444' : '#0f172a' }}>{fmtDate(l.pickupDate)}</div>
                        {days!==null && (
                          <div style={{ fontSize:10, color:urgency, fontWeight:700, marginTop:1 }}>
                            {days<0?'Overdue':days===0?'TODAY':days===1?'Tomorrow':`${days} days`}
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
                      {bid?.amount && (
                        <div>
                          <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', marginBottom:2 }}>My Bid</div>
                          <div style={{ fontSize:14, fontWeight:800, color:'#0f172a' }}>{fmtMoney(bid.amount)}</div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
                      <button onClick={()=>setExpanded(isOpen?null:l.id)}
                        style={{ padding:'7px 14px', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', color:'#475569' }}>
                        {isOpen ? '▲ Less' : '▼ Details'}
                      </button>
                      {(!bid || bid.status==='WITHDRAWN' || bid.status==='REJECTED') && (
                        <button onClick={()=>{ setBidModal(l); setBidAmount(''); setBidNotes(''); }}
                          style={{ padding:'7px 16px', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', background:'#f59e0b', color:'#fff' }}>
                          💰 Submit Rate
                        </button>
                      )}
                      {bid?.status==='PENDING' && (
                        <button onClick={()=>handleWithdraw(l.id)}
                          style={{ padding:'7px 14px', border:'1px solid #fca5a5', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', background:'#fff', color:'#dc2626' }}>
                          Withdraw
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div style={{ padding:'16px 20px 20px', borderTop:'1px solid #f1f5f9', background:'#fafafa' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:20 }}>
                        {l.stops.length > 0 && (
                          <div>
                            <div style={{ fontWeight:700, fontSize:12, color:'#0f172a', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.05em' }}>Stops</div>
                            {l.stops.map(s => (
                              <div key={s.id} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:6 }}>
                                <span style={{ fontSize:10, padding:'2px 6px', borderRadius:4, background:'#dbeafe', color:'#1d4ed8', fontWeight:700 }}>{s.type}</span>
                                <span style={{ fontSize:12, color:'#334155' }}>{s.city}, {s.state}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {l.specialInstructions && (
                          <div>
                            <div style={{ fontWeight:700, fontSize:12, color:'#0f172a', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>Special Instructions</div>
                            <div style={{ fontSize:12, color:'#78350f', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, padding:'10px 12px', lineHeight:1.6 }}>
                              {l.specialInstructions}
                            </div>
                          </div>
                        )}
                        {bid && (
                          <div>
                            <div style={{ fontWeight:700, fontSize:12, color:'#0f172a', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>Your Bid</div>
                            <div style={{ fontSize:12, color:'#334155', lineHeight:1.7 }}>
                              <div>Rate: <strong>{bid.amount ? fmtMoney(bid.amount) : 'Not specified'}</strong></div>
                              {bid.notes && <div>Notes: {bid.notes}</div>}
                              <div>Status: <span style={{ fontWeight:700, color: bidStyle?.color }}>{bidStyle?.label}</span></div>
                            </div>
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight:700, fontSize:12, color:'#0f172a', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>How it works</div>
                          <div style={{ fontSize:12, color:'#64748b', lineHeight:1.7 }}>
                            1. Click <strong>Submit Rate</strong> to bid with your rate<br/>
                            2. Dispatcher reviews bids and selects the best carrier<br/>
                            3. Accepted load appears in <strong>My Loads</strong>
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

      {/* Bid Modal */}
      {bidModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'grid', placeItems:'center' }} onClick={()=>setBidModal(null)}>
          <div style={{ background:'#fff', borderRadius:16, padding:'28px', width:460, maxWidth:'90vw', boxShadow:'0 24px 48px rgba(0,0,0,0.2)' }} onClick={e=>e.stopPropagation()}>
            <div style={{ marginBottom:20 }}>
              <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'#0f172a' }}>Submit Rate Bid</h3>
              <p style={{ margin:'6px 0 0', fontSize:13, color:'#64748b' }}>
                {bidModal.pickupCity}, {bidModal.pickupState} → {bidModal.deliveryCity}, {bidModal.deliveryState}
                &nbsp;·&nbsp;{bidModal.loadNumber}
              </p>
            </div>

            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:5 }}>Your Rate (USD)</label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#94a3b8', fontSize:14, fontWeight:600 }}>$</span>
                <input type="number" placeholder="e.g. 1250" value={bidAmount} onChange={e=>setBidAmount(e.target.value)}
                  style={{ width:'100%', padding:'10px 12px 10px 26px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:14, fontWeight:600, outline:'none', boxSizing:'border-box' }} />
              </div>
            </div>

            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:5 }}>Notes (optional)</label>
              <textarea value={bidNotes} onChange={e=>setBidNotes(e.target.value)} placeholder="Availability, special conditions, equipment details…" rows={3}
                style={{ width:'100%', padding:'10px 12px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, outline:'none', resize:'vertical', fontFamily:'inherit', boxSizing:'border-box' }} />
            </div>

            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={()=>setBidModal(null)} style={{ padding:'9px 18px', background:'#f1f5f9', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', color:'#475569' }}>
                Cancel
              </button>
              <button onClick={handleSubmitBid} disabled={bidSaving}
                style={{ padding:'9px 22px', background:'#f59e0b', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', color:'#fff', opacity: bidSaving ? 0.7 : 1 }}>
                {bidSaving ? 'Submitting…' : '💰 Submit Bid'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
