'use client';

import { useEffect, useState } from 'react';
import ShipperTopbar from '@/components/layout/ShipperTopbar';
import api from '@/lib/api';

interface Doc  { id:string; type:string; filename:string; loadId:string|null; loadNumber?:string; createdAt:string; signedAt:string|null; }
interface POD  { id:string; filename:string; fileUrl:string; fileSize:number|null; podType:string; notes:string|null; loadId:string; loadNumber?:string; createdAt:string; }

function fmtDate(d:string) { return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }
function fmtSize(b:number|null) { if(!b) return ''; if(b<1024) return `${b}B`; if(b<1048576) return `${(b/1024).toFixed(1)}KB`; return `${(b/1048576).toFixed(1)}MB`; }

const TYPE_ICON: Record<string,string> = { RATE_CONFIRMATION:'📋', BOL:'📦', POD:'✅' };

export default function DocumentsPage() {
  const [docs, setDocs]   = useState<Doc[]>([]);
  const [pods, setPods]   = useState<POD[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]     = useState<'all'|'rc'|'bol'|'pod'>('all');

  useEffect(() => {
    api.get('/portal/documents').then(r => {
      setDocs(r.data.documents ?? []);
      setPods(r.data.pods ?? []);
    }).finally(()=>setLoading(false));
  }, []);

  const combined = [
    ...docs.map(d=>({ id:d.id, type:d.type, filename:d.filename, loadNumber:d.loadNumber, createdAt:d.createdAt, fileUrl:null as string|null, notes:null as string|null, size:null as number|null, signed:d.signedAt })),
    ...pods.map(p=>({ id:p.id, type:'POD', filename:p.filename, loadNumber:p.loadNumber, createdAt:p.createdAt, fileUrl:p.fileUrl, notes:p.notes, size:p.fileSize, signed:null })),
  ].sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());

  const visible = combined.filter(d => {
    if (tab==='all') return true;
    if (tab==='rc')  return d.type==='RATE_CONFIRMATION';
    if (tab==='bol') return d.type==='BOL';
    if (tab==='pod') return d.type==='POD';
    return true;
  });

  const counts = { rc:combined.filter(d=>d.type==='RATE_CONFIRMATION').length, bol:combined.filter(d=>d.type==='BOL').length, pod:combined.filter(d=>d.type==='POD').length };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <ShipperTopbar title="Documents" subtitle="Rate confirmations, BOLs & PODs" />
      <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>
      <div style={{ marginBottom:22 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:'#0f172a', margin:0 }}>Documents</h1>
        <p style={{ color:'#64748b', fontSize:13, marginTop:4 }}>{combined.length} documents</p>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:16 }}>
        {([['all','All',combined.length],['rc','Rate Confirmations',counts.rc],['bol','Bills of Lading',counts.bol],['pod','Proof of Delivery',counts.pod]] as const).map(([key,label,count])=>(
          <button key={key} onClick={()=>setTab(key)} style={{ padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', border:'none', background:tab===key?'#0f172a':'#f1f5f9', color:tab===key?'#fff':'#475569' }}>
            {label} ({count})
          </button>
        ))}
      </div>

      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden' }}>
        {loading ? (
          <div style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>Loading…</div>
        ) : visible.length === 0 ? (
          <div style={{ padding:'48px 24px', textAlign:'center' }}>
            <div style={{ fontSize:36, marginBottom:12 }}>📄</div>
            <div style={{ color:'#94a3b8', fontSize:14 }}>
              {combined.length === 0 ? 'No documents yet. Rate confirmations and PODs will appear here once your loads are dispatched.' : 'No documents in this category.'}
            </div>
          </div>
        ) : (
          <div>
            {visible.map(d => {
              const icon = TYPE_ICON[d.type] ?? '📄';
              const typeLabel = d.type === 'RATE_CONFIRMATION' ? 'Rate Confirmation' : d.type === 'BOL' ? 'Bill of Lading' : 'Proof of Delivery';
              return (
                <div key={d.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 18px', borderBottom:'1px solid #f1f5f9' }}>
                  <div style={{ width:42, height:42, borderRadius:10, background:'#f1f5f9', display:'grid', placeItems:'center', fontSize:20, flexShrink:0 }}>{icon}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontWeight:700, fontSize:13, color:'#0f172a' }}>{typeLabel}</span>
                      {d.loadNumber && <span style={{ fontSize:11, color:'#3b82f6', background:'#eff6ff', padding:'1px 7px', borderRadius:4, fontFamily:'monospace', fontWeight:600 }}>{d.loadNumber}</span>}
                      {d.signed && <span style={{ fontSize:10, color:'#22c55e', background:'#f0fdf4', padding:'1px 7px', borderRadius:4, fontWeight:600 }}>✓ Signed</span>}
                    </div>
                    <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{d.filename}{d.size ? ` · ${fmtSize(d.size)}` : ''} · {fmtDate(d.createdAt)}</div>
                    {d.notes && <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{d.notes}</div>}
                  </div>
                  {d.fileUrl ? (
                    <a href={d.fileUrl} target="_blank" rel="noreferrer" style={{ padding:'6px 14px', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:7, fontSize:12, fontWeight:600, color:'#334155', textDecoration:'none', flexShrink:0 }}>
                      Download ↗
                    </a>
                  ) : (
                    <span style={{ padding:'6px 14px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:7, fontSize:12, color:'#94a3b8', flexShrink:0 }}>
                      View in portal
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
