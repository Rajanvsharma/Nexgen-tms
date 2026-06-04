'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Sender { id: string; firstName: string; lastName: string; role: string; }
interface ConvMessage { id: string; content: string; senderId: string; sender: Sender; isInternal: boolean; attachmentName: string | null; createdAt: string; }
interface Conversation {
  id: string; subject: string; status: string; priority: string; createdAt: string; updatedAt: string;
  createdBy: Sender;
  load: { id: string; loadNumber: string; status: string } | null;
  customer: { id: string; name: string } | null;
  carrier: { id: string; name: string; mcNumber: string } | null;
  messages: ConvMessage[];
  _count: { messages: number };
}
interface Counts { all: number; new: number; open: number; escalated: number; resolved: number; reopened: number; }
interface LoadOption { id: string; loadNumber: string; }
interface CustomerOption { id: string; name: string; }
interface CarrierOption { id: string; name: string; mcNumber: string; }

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_TABS = ['ALL', 'NEW', 'OPEN', 'ESCALATED', 'RESOLVED', 'REOPENED'] as const;

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  NEW:       { bg: '#eff6ff', color: '#1d4ed8' },
  OPEN:      { bg: '#f0fdf4', color: '#15803d' },
  ESCALATED: { bg: '#fff7ed', color: '#c2410c' },
  RESOLVED:  { bg: '#f0fdf4', color: '#16a34a' },
  REOPENED:  { bg: '#fdf4ff', color: '#7c3aed' },
};

const PRIORITY_COLORS: Record<string, string> = {
  HIGH:   '#dc2626',
  NORMAL: '#94a3b8',
  LOW:    '#cbd5e1',
};

function timeAgo(d: string) {
  const secs = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function initials(s: Sender) { return `${s.firstName[0]}${s.lastName[0]}`; }

function EntityTag({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: `${color}18`, color, border: `1px solid ${color}30`, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ConsolePage() {
  const { user } = useAuthStore();
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [counts, setCounts] = useState<Counts>({ all: 0, new: 0, open: 0, escalated: 0, resolved: 0, reopened: 0 });
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);

  // New conversation
  const [showNew, setShowNew] = useState(false);
  const [loads, setLoads] = useState<LoadOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [carriers, setCarriers] = useState<CarrierOption[]>([]);
  const [newForm, setNewForm] = useState({ subject: '', loadId: '', customerId: '', carrierId: '', priority: 'NORMAL', firstMessage: '' });
  const [creating, setCreating] = useState(false);

  // Messaging
  const [msgInput, setMsgInput] = useState('');
  const [sending, setSending] = useState(false);
  const [isInternal, setIsInternal] = useState(false);
  const msgEndRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (search) params.search = search;
      const [convRes, countRes] = await Promise.all([
        api.get('/console', { params }),
        api.get('/console/counts'),
      ]);
      setConversations(convRes.data);
      setCounts(countRes.data);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (showNew) {
      Promise.all([api.get('/loads'), api.get('/customers'), api.get('/carriers')]).then(([l, c, ca]) => {
        setLoads(l.data.slice(0, 50));
        setCustomers(c.data.filter((x: CustomerOption & { isActive: boolean }) => x.isActive));
        setCarriers(ca.data.filter((x: CarrierOption & { status: string }) => x.status === 'ACTIVE'));
      });
    }
  }, [showNew]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected?.messages]);

  async function handleCreate() {
    if (!newForm.subject.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post('/console', newForm);
      setConversations(prev => [data, ...prev]);
      setSelected(data);
      setShowNew(false);
      setNewForm({ subject: '', loadId: '', customerId: '', carrierId: '', priority: 'NORMAL', firstMessage: '' });
      await loadData();
    } finally { setCreating(false); }
  }

  async function sendMessage() {
    if (!msgInput.trim() || !selected) return;
    setSending(true);
    try {
      const { data: msg } = await api.post(`/console/${selected.id}/messages`, { content: msgInput.trim(), isInternal });
      setSelected(prev => prev ? { ...prev, messages: [...prev.messages, msg], status: 'OPEN' } : prev);
      setMsgInput('');
      setIsInternal(false);
      await loadData();
    } finally { setSending(false); }
  }

  async function setStatus(id: string, status: string) {
    const { data } = await api.patch(`/console/${id}/status`, { status });
    setSelected(data);
    await loadData();
  }

  function selectConv(conv: Conversation) {
    setSelected(conv);
    if (conv.status === 'NEW') setStatus(conv.id, 'OPEN');
  }

  const statusColor = (s: string) => STATUS_COLORS[s] || { bg: '#f1f5f9', color: '#94a3b8' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc' }}>

      {/* ── Top bar ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', height: 56, display: 'flex', alignItems: 'center', gap: 14, padding: '0 20px', flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>Home &rsaquo; <span style={{ color: '#15202b' }}>NexGen Console</span></div>
        <div style={{ flex: 1 }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍  Search conversations…"
          style={{ width: 340, border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 12px', fontSize: 13, outline: 'none', background: '#f8fafc' }}
        />
      </div>

      {/* ── Page header ── */}
      <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
        <h1 style={{ margin: '0 0 14px', fontSize: 22, fontWeight: 800, letterSpacing: '-0.4px', color: '#15202b' }}>NexGen Console</h1>

        {/* Status filter tabs */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 0 }}>
          {STATUS_TABS.map(tab => {
            const count = tab === 'ALL' ? counts.all : counts[tab.toLowerCase() as keyof Counts] ?? 0;
            const isActive = statusFilter === tab;
            return (
              <button key={tab} onClick={() => setStatusFilter(tab)} style={{
                border: 0, background: 'none', padding: '10px 16px', fontWeight: isActive ? 700 : 500, fontSize: 13,
                color: isActive ? '#1d4ed8' : '#475569', borderBottom: isActive ? '2px solid #1d4ed8' : '2px solid transparent',
                cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: -1,
              }}>
                {tab === 'ALL' ? `All (${count})` : `${tab.charAt(0) + tab.slice(1).toLowerCase()} (${count})`}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <button onClick={() => setShowNew(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1d4ed8', border: 0, color: '#fff', borderRadius: 7, padding: '7px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 4 }}>
            Start New +
          </button>
        </div>
      </div>

      {/* ── Two-panel layout ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', gap: 0 }}>

        {/* ── Left: Conversation list ── */}
        <div style={{ width: 380, flexShrink: 0, borderRight: '1px solid #e2e8f0', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Conversations</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{conversations.length} shown</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && <div style={{ padding: 20, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>Loading…</div>}
            {!loading && conversations.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>No conversations yet</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Click "Start New +" to begin</div>
              </div>
            )}
            {conversations.map(conv => {
              const isActive = selected?.id === conv.id;
              const sc = statusColor(conv.status);
              const lastMsg = conv.messages[conv.messages.length - 1];

              return (
                <div key={conv.id} onClick={() => selectConv(conv)} style={{
                  padding: '12px 14px', borderBottom: '1px solid #f8fafc', cursor: 'pointer',
                  background: isActive ? '#eff6ff' : conv.status === 'NEW' ? '#fafeff' : '#fff',
                  borderLeft: `3px solid ${isActive ? '#1d4ed8' : conv.status === 'ESCALATED' ? '#dc2626' : 'transparent'}`,
                  transition: 'background 0.1s',
                }}>
                  {/* Row 1: avatar + name + tags + time */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {initials(conv.createdBy)}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#1d4ed8' }}>{conv.createdBy.firstName} {conv.createdBy.lastName}</span>
                        <span style={{ fontSize: 10, color: '#94a3b8' }}>({conv.createdBy.role})</span>
                        {conv.load && <EntityTag label={conv.load.loadNumber} color="#1d4ed8" />}
                        {conv.customer && <EntityTag label={`SH-${conv.customer.name.slice(0, 4).toUpperCase()}`} color="#7c3aed" />}
                        {conv.carrier && <EntityTag label={`CR-${conv.carrier.name.slice(0, 4).toUpperCase()}`} color="#15803d" />}
                        {conv.status === 'ESCALATED' && <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 4, padding: '1px 5px' }}>Escalated</span>}
                        {conv.status === 'RESOLVED' && <span style={{ fontSize: 10, fontWeight: 700, color: '#15803d', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 4, padding: '1px 5px' }}>Resolved</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>{timeAgo(conv.updatedAt)}</span>
                      {conv.status === 'ESCALATED' && <span style={{ color: '#dc2626', fontSize: 14 }}>!</span>}
                      {conv.status === 'NEW' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1d4ed8', display: 'block' }} />}
                    </div>
                  </div>

                  {/* Row 2: subject */}
                  <div style={{ fontSize: 13, fontWeight: conv.status === 'NEW' ? 700 : 500, color: '#15202b', marginLeft: 38, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {conv.subject}
                  </div>

                  {/* Row 3: last message preview */}
                  {lastMsg && (
                    <div style={{ fontSize: 11, color: '#94a3b8', marginLeft: 38, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {lastMsg.sender.firstName}: {lastMsg.content}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right: Chat panel ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!selected ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Select a conversation</div>
              <div style={{ fontSize: 13 }}>Choose from the list or start a new one</div>
              <button onClick={() => setShowNew(true)} style={{ marginTop: 16, background: '#1d4ed8', border: 0, color: '#fff', borderRadius: 8, padding: '10px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Start New +
              </button>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                      {initials(selected.createdBy)}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: '#1d4ed8' }}>{selected.createdBy.firstName} {selected.createdBy.lastName}</span>
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>({selected.createdBy.role})</span>
                        {selected.load && <EntityTag label={selected.load.loadNumber} color="#1d4ed8" />}
                        {selected.customer && <EntityTag label={selected.customer.name} color="#7c3aed" />}
                        {selected.carrier && <EntityTag label={selected.carrier.name} color="#15803d" />}
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: statusColor(selected.status).bg, color: statusColor(selected.status).color }}>
                          {selected.status}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                        Subject: <strong style={{ color: '#475569' }}>{selected.subject}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {selected.status !== 'ESCALATED' && (
                      <button onClick={() => setStatus(selected.id, 'ESCALATED')} style={{ border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', borderRadius: 7, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        ! Escalate
                      </button>
                    )}
                    {selected.status !== 'RESOLVED' ? (
                      <button onClick={() => setStatus(selected.id, 'RESOLVED')} style={{ background: '#16a34a', border: 0, color: '#fff', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        Mark as Resolved ✓
                      </button>
                    ) : (
                      <button onClick={() => setStatus(selected.id, 'REOPENED')} style={{ border: '1px solid #e2e8f0', background: '#fff', color: '#475569', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        Reopen
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages area */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#f8fafc' }}>
                {selected.messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40, fontSize: 13 }}>No messages yet. Send the first one below.</div>
                )}
                {selected.messages.map((msg, i) => {
                  const isMe = msg.senderId === user?.id;
                  const showAvatar = i === 0 || selected.messages[i - 1].senderId !== msg.senderId;

                  return (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 12, gap: 10 }}>
                      {!isMe && showAvatar && (
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, alignSelf: 'flex-end' }}>
                          {initials(msg.sender)}
                        </div>
                      )}
                      {!isMe && !showAvatar && <div style={{ width: 32, flexShrink: 0 }} />}

                      <div style={{ maxWidth: '65%' }}>
                        {showAvatar && !isMe && (
                          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3, marginLeft: 2 }}>
                            {msg.sender.firstName} {msg.sender.lastName} · {msg.sender.role}
                          </div>
                        )}
                        <div style={{
                          background: isMe ? '#1d4ed8' : msg.isInternal ? '#fef6e7' : '#fff',
                          color: isMe ? '#fff' : '#15202b',
                          borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                          padding: '10px 14px',
                          fontSize: 13,
                          lineHeight: 1.5,
                          border: msg.isInternal ? '1px solid #fed7aa' : isMe ? 'none' : '1px solid #e2e8f0',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        }}>
                          {msg.isInternal && <div style={{ fontSize: 9, fontWeight: 700, color: '#b45309', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>🔒 Internal note</div>}
                          {msg.content}
                          {msg.attachmentName && (
                            <div style={{ marginTop: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 6, padding: '5px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}>
                              📎 {msg.attachmentName}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 3, textAlign: isMe ? 'right' : 'left', paddingRight: isMe ? 4 : 0, paddingLeft: isMe ? 0 : 4 }}>
                          {new Date(msg.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={msgEndRef} />
              </div>

              {/* Message input */}
              <div style={{ background: '#fff', borderTop: '1px solid #e2e8f0', padding: '12px 20px', flexShrink: 0 }}>
                {/* Internal toggle */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <button onClick={() => setIsInternal(false)} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: `1px solid ${!isInternal ? '#1d4ed8' : '#e2e8f0'}`, background: !isInternal ? '#eff6ff' : '#fff', color: !isInternal ? '#1d4ed8' : '#94a3b8', cursor: 'pointer' }}>
                    Reply
                  </button>
                  <button onClick={() => setIsInternal(true)} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: `1px solid ${isInternal ? '#d97706' : '#e2e8f0'}`, background: isInternal ? '#fef6e7' : '#fff', color: isInternal ? '#b45309' : '#94a3b8', cursor: 'pointer' }}>
                    🔒 Internal Note
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, border: `1px solid ${isInternal ? '#fed7aa' : '#e2e8f0'}`, borderRadius: 10, padding: '10px 14px', background: isInternal ? '#fffbf5' : '#f8fafc' }}>
                    <textarea
                      value={msgInput}
                      onChange={e => setMsgInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                      placeholder={isInternal ? 'Add an internal note (only visible to team)…' : 'Type here… (Enter to send, Shift+Enter for new line)'}
                      rows={2}
                      style={{ width: '100%', border: 0, background: 'transparent', outline: 'none', fontSize: 13, resize: 'none', color: '#15202b', fontFamily: 'IBM Plex Sans, sans-serif' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button title="Attach file" style={{ width: 38, height: 38, border: '1px solid #e2e8f0', background: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 16, display: 'grid', placeItems: 'center' }}>📎</button>
                    <button onClick={sendMessage} disabled={!msgInput.trim() || sending} style={{ width: 38, height: 38, border: 0, background: msgInput.trim() ? '#1d4ed8' : '#e2e8f0', color: '#fff', borderRadius: 8, cursor: msgInput.trim() ? 'pointer' : 'not-allowed', fontSize: 16, display: 'grid', placeItems: 'center' }}>
                      {sending ? '⟳' : '➤'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── New Conversation Modal ── */}
      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Start New Conversation</h2>
              <button onClick={() => setShowNew(false)} style={{ border: 0, background: 'none', fontSize: 20, color: '#94a3b8', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }}>Subject *</label>
                <input value={newForm.subject} onChange={e => setNewForm({ ...newForm, subject: e.target.value })} placeholder="e.g. Please approve this shipper" style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }}>Link to Load</label>
                  <select value={newForm.loadId} onChange={e => setNewForm({ ...newForm, loadId: e.target.value })} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 12, outline: 'none', background: '#fff' }}>
                    <option value="">None</option>
                    {loads.map(l => <option key={l.id} value={l.id}>{l.loadNumber}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }}>Link to Customer</label>
                  <select value={newForm.customerId} onChange={e => setNewForm({ ...newForm, customerId: e.target.value })} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 12, outline: 'none', background: '#fff' }}>
                    <option value="">None</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }}>Link to Carrier</label>
                  <select value={newForm.carrierId} onChange={e => setNewForm({ ...newForm, carrierId: e.target.value })} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 12, outline: 'none', background: '#fff' }}>
                    <option value="">None</option>
                    {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }}>Priority</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['LOW', 'NORMAL', 'HIGH'].map(p => (
                    <button key={p} onClick={() => setNewForm({ ...newForm, priority: p })} style={{ flex: 1, border: `1px solid ${newForm.priority === p ? PRIORITY_COLORS[p] : '#e2e8f0'}`, background: newForm.priority === p ? `${PRIORITY_COLORS[p]}15` : '#fff', color: newForm.priority === p ? PRIORITY_COLORS[p] : '#94a3b8', borderRadius: 7, padding: '7px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }}>First Message</label>
                <textarea value={newForm.firstMessage} onChange={e => setNewForm({ ...newForm, firstMessage: e.target.value })} placeholder="Type your first message…" rows={3} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'IBM Plex Sans, sans-serif' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
                <button onClick={() => setShowNew(false)} style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: 8, padding: '9px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: '#475569' }}>Cancel</button>
                <button onClick={handleCreate} disabled={!newForm.subject.trim() || creating} style={{ border: 0, background: '#1d4ed8', color: '#fff', borderRadius: 8, padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: creating ? 0.8 : 1 }}>
                  {creating ? 'Starting…' : 'Start Conversation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
