'use client';

import { useEffect, useState, useRef } from 'react';
import CarrierTopbar from '@/components/layout/CarrierTopbar';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';

interface ConvMessage {
  id:string; content:string; createdAt:string; isInternal:boolean;
  sender:{ id:string; firstName:string; lastName:string; role:string; };
}
interface Conversation {
  id:string; subject:string; status:string; createdAt:string; updatedAt:string;
  load:{ loadNumber:string }|null;
  messages:ConvMessage[];
}

const STATUS_STYLE: Record<string,{bg:string;color:string}> = {
  NEW:{bg:'#dbeafe',color:'#1d4ed8'}, OPEN:{bg:'#fef3c7',color:'#b45309'},
  ESCALATED:{bg:'#fee2e2',color:'#b91c1c'}, RESOLVED:{bg:'#d1fae5',color:'#065f46'},
  REOPENED:{bg:'#e0e7ff',color:'#4338ca'},
};

function fmtTs(d:string) { return new Date(d).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}); }

export default function CarrierMessagesPage() {
  const { user }  = useAuthStore();
  const [convs,   setConvs]   = useState<Conversation[]>([]);
  const [active,  setActive]  = useState<Conversation|null>(null);
  const [detail,  setDetail]  = useState<Conversation|null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [reply,   setReply]   = useState('');
  const [newModal, setNewModal] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newContent, setNewContent] = useState('');
  const [creating,   setCreating]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/carrier-portal/conversations').then(r=>setConvs(r.data)).finally(()=>setLoading(false));
  }, []);

  useEffect(() => {
    if (active) {
      api.get(`/carrier-portal/conversations/${active.id}`).then(r=>setDetail(r.data));
    }
  }, [active]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:'smooth' });
  }, [detail?.messages]);

  async function handleSend() {
    if (!reply.trim() || !active) return;
    setSending(true);
    try {
      await api.post(`/carrier-portal/conversations/${active.id}/messages`, { content: reply });
      setReply('');
      const r = await api.get(`/carrier-portal/conversations/${active.id}`);
      setDetail(r.data);
    } finally {
      setSending(false);
    }
  }

  async function handleNewConversation() {
    if (!newSubject.trim() || !newContent.trim()) return;
    setCreating(true);
    try {
      await api.post('/carrier-portal/conversations', { subject: newSubject, content: newContent });
      setNewModal(false); setNewSubject(''); setNewContent('');
      const r = await api.get('/carrier-portal/conversations');
      setConvs(r.data);
    } finally {
      setCreating(false);
    }
  }

  const lastMessage = (c:Conversation) => c.messages?.[0];

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <CarrierTopbar title="Messages" subtitle="Communicate with your dispatcher" />
      <div style={{ flex:1, overflow:'hidden', display:'flex' }}>

        {/* Conversation list */}
        <div style={{ width:320, borderRight:'1px solid #e2e8f0', display:'flex', flexDirection:'column', background:'#fff', flexShrink:0 }}>
          <div style={{ padding:'16px', borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontWeight:700, fontSize:14, color:'#0f172a' }}>Conversations ({convs.length})</div>
            <button onClick={()=>setNewModal(true)} style={{ padding:'6px 12px', background:'#f59e0b', border:'none', borderRadius:7, fontSize:11, fontWeight:700, cursor:'pointer', color:'#fff' }}>
              + New
            </button>
          </div>
          <div style={{ flex:1, overflowY:'auto' }}>
            {loading ? (
              <div style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>Loading…</div>
            ) : convs.length === 0 ? (
              <div style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>
                <div style={{ fontSize:36, marginBottom:10 }}>💬</div>
                <div style={{ fontSize:13 }}>No conversations yet</div>
                <div style={{ fontSize:11, marginTop:4 }}>Click "+ New" to start one</div>
              </div>
            ) : convs.map(c => {
              const last = lastMessage(c);
              const isActive = active?.id === c.id;
              const ss = STATUS_STYLE[c.status] ?? { bg:'#f1f5f9', color:'#475569' };
              return (
                <div key={c.id} onClick={()=>setActive(c)} style={{ padding:'14px 16px', borderBottom:'1px solid #f1f5f9', cursor:'pointer',
                  background: isActive ? '#fffbeb' : 'transparent', borderLeft: isActive ? '3px solid #f59e0b' : '3px solid transparent' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:4 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#0f172a', lineHeight:1.3 }}>{c.subject}</div>
                    <span style={{ fontSize:10, padding:'1px 6px', borderRadius:9999, background:ss.bg, color:ss.color, fontWeight:700, flexShrink:0 }}>{c.status}</span>
                  </div>
                  {c.load && <div style={{ fontSize:11, color:'#94a3b8', marginBottom:4 }}>Load: {c.load.loadNumber}</div>}
                  {last && (
                    <div style={{ fontSize:11, color:'#64748b', lineHeight:1.4 }}>
                      <span style={{ fontWeight:600 }}>{last.sender.firstName}: </span>
                      {last.content.length>60 ? last.content.slice(0,60)+'…' : last.content}
                    </div>
                  )}
                  <div style={{ fontSize:10, color:'#94a3b8', marginTop:4 }}>{fmtTs(c.updatedAt)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Thread */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#f8fafc' }}>
          {!active ? (
            <div style={{ flex:1, display:'grid', placeItems:'center' }}>
              <div style={{ textAlign:'center', color:'#94a3b8' }}>
                <div style={{ fontSize:56, marginBottom:14 }}>💬</div>
                <div style={{ fontSize:16, fontWeight:700, color:'#334155', marginBottom:6 }}>Select a conversation</div>
                <div style={{ fontSize:13 }}>Choose a conversation from the left or start a new one</div>
              </div>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div style={{ padding:'14px 20px', background:'#fff', borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', gap:12 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:15, color:'#0f172a' }}>{active.subject}</div>
                  {detail?.load && <div style={{ fontSize:11, color:'#94a3b8' }}>Load {detail.load.loadNumber}</div>}
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>
                {!detail ? (
                  <div style={{ textAlign:'center', color:'#94a3b8', marginTop:40 }}>Loading…</div>
                ) : detail.messages.length === 0 ? (
                  <div style={{ textAlign:'center', color:'#94a3b8', marginTop:40 }}>No messages yet. Start the conversation!</div>
                ) : (
                  detail.messages.map(m => {
                    const isMine = m.sender.id === user?.id;
                    return (
                      <div key={m.id} style={{ display:'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom:14 }}>
                        {!isMine && (
                          <div style={{ width:32, height:32, borderRadius:'50%', background:'#e0e7ff', display:'grid', placeItems:'center', fontSize:12, fontWeight:700, color:'#4338ca', marginRight:10, flexShrink:0 }}>
                            {m.sender.firstName[0]}{m.sender.lastName[0]}
                          </div>
                        )}
                        <div style={{ maxWidth:'68%' }}>
                          {!isMine && (
                            <div style={{ fontSize:11, color:'#94a3b8', marginBottom:3, fontWeight:600 }}>
                              {m.sender.firstName} {m.sender.lastName}
                              {m.sender.role !== 'CARRIER' && <span style={{ marginLeft:6, padding:'1px 5px', background:'#e0e7ff', color:'#4338ca', borderRadius:4, fontSize:10 }}>Dispatcher</span>}
                            </div>
                          )}
                          <div style={{ padding:'10px 14px', borderRadius: isMine ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: isMine ? '#f59e0b' : '#fff', color: isMine ? '#fff' : '#0f172a', fontSize:13, lineHeight:1.5, border: isMine ? 'none' : '1px solid #e2e8f0' }}>
                            {m.content}
                          </div>
                          <div style={{ fontSize:10, color:'#94a3b8', marginTop:3, textAlign: isMine ? 'right' : 'left' }}>{fmtTs(m.createdAt)}</div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* Reply box */}
              <div style={{ padding:'14px 20px', background:'#fff', borderTop:'1px solid #e2e8f0' }}>
                <div style={{ display:'flex', gap:10 }}>
                  <textarea value={reply} onChange={e=>setReply(e.target.value)} placeholder="Type your message…"
                    onKeyDown={e=>{ if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    rows={2} style={{ flex:1, padding:'10px 14px', border:'1px solid #e2e8f0', borderRadius:10, fontSize:13, outline:'none', resize:'none', fontFamily:'inherit' }} />
                  <button onClick={handleSend} disabled={!reply.trim()||sending}
                    style={{ padding:'0 20px', background:'#f59e0b', border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', color:'#fff', opacity:(!reply.trim()||sending)?0.6:1 }}>
                    {sending ? '…' : 'Send'}
                  </button>
                </div>
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:5 }}>Press Enter to send, Shift+Enter for new line</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New conversation modal */}
      {newModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'grid', placeItems:'center' }} onClick={()=>setNewModal(false)}>
          <div style={{ background:'#fff', borderRadius:16, padding:'28px', width:480, maxWidth:'90vw' }} onClick={e=>e.stopPropagation()}>
            <h3 style={{ margin:'0 0 20px', fontSize:18, fontWeight:800, color:'#0f172a' }}>New Message</h3>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:5 }}>Subject</label>
              <input value={newSubject} onChange={e=>setNewSubject(e.target.value)} placeholder="e.g. Question about load LDN-001234"
                style={{ width:'100%', padding:'10px 12px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box' }} />
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:5 }}>Message</label>
              <textarea value={newContent} onChange={e=>setNewContent(e.target.value)} placeholder="Type your message…" rows={4}
                style={{ width:'100%', padding:'10px 12px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, outline:'none', resize:'vertical', fontFamily:'inherit', boxSizing:'border-box' }} />
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={()=>setNewModal(false)} style={{ padding:'9px 18px', background:'#f1f5f9', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', color:'#475569' }}>Cancel</button>
              <button onClick={handleNewConversation} disabled={!newSubject.trim()||!newContent.trim()||creating}
                style={{ padding:'9px 22px', background:'#f59e0b', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', color:'#fff', opacity:(!newSubject.trim()||!newContent.trim()||creating)?0.6:1 }}>
                {creating ? 'Sending…' : 'Send Message'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
