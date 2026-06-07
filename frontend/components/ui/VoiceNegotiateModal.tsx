'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import api from '@/lib/api';

interface Load {
  id: string;
  loadNumber: string;
  pickupCity: string;
  pickupState: string;
  deliveryCity: string;
  deliveryState: string;
  equipment: string;
  customerRate: number;
  carrierRate: number | null;
  pickupDate: string | null;
}

interface Message {
  role: 'assistant' | 'user';
  content: string;
}

interface Props {
  load: Load;
  onClose: () => void;
  onDeal: (agreedRate: number) => void;
}

type Phase = 'idle' | 'calling' | 'ai-thinking' | 'ai-speaking' | 'in-call' | 'listening' | 'deal' | 'ended';

export function VoiceNegotiateModal({ load, onClose, onDeal }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [dealRate, setDealRate] = useState<number | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [error, setError] = useState('');
  const [elapsedSecs, setElapsedSecs] = useState(0);

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStartRef = useRef(0);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<Phase>('idle');
  const messagesRef = useRef<Message[]>([]);

  phaseRef.current = phase;
  messagesRef.current = messages;

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages, phase]);

  useEffect(() => {
    const active = ['in-call', 'ai-speaking', 'listening', 'ai-thinking'].includes(phase);
    if (active && !timerRef.current) {
      callStartRef.current = Date.now() - elapsedSecs * 1000;
      timerRef.current = setInterval(() => {
        setElapsedSecs(Math.floor((Date.now() - callStartRef.current) / 1000));
      }, 1000);
    } else if (!active && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const speak = useCallback((text: string): Promise<void> => new Promise((resolve) => {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.95;
    utt.pitch = 1.0;
    utt.volume = 1.0;
    const applyVoice = () => {
      const v = window.speechSynthesis.getVoices();
      const pick = v.find(x => x.lang.startsWith('en') && (x.name.includes('Google') || x.name.includes('Samantha') || x.name.includes('Daniel') || x.name.includes('Karen')));
      if (pick) utt.voice = pick;
    };
    if (window.speechSynthesis.getVoices().length) applyVoice();
    else window.speechSynthesis.onvoiceschanged = applyVoice;
    utt.onend = () => resolve();
    utt.onerror = () => resolve();
    window.speechSynthesis.speak(utt);
  }), []);

  const sendToAI = useCallback(async (msgs: Message[]) => {
    setPhase('ai-thinking');
    try {
      const { data } = await api.post('/ai/negotiate', {
        loadId: load.id,
        messages: msgs.map(m => ({ role: m.role, content: m.content })),
      });
      const aiMsg: Message = { role: 'assistant', content: data.reply };
      const next = [...msgs, aiMsg];
      setMessages(next);
      setDemoMode(!!data.demoMode);
      setPhase('ai-speaking');
      await speak(data.reply);
      if (data.dealReached) {
        setDealRate(data.agreedRate);
        setPhase('deal');
      } else {
        setPhase('in-call');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Connection error — check backend');
      setPhase('ended');
    }
  }, [load.id, speak]);

  async function startCall() {
    setPhase('calling');
    setMessages([]);
    setError('');
    setDealRate(null);
    setElapsedSecs(0);
    await new Promise(r => setTimeout(r, 1800));
    await sendToAI([]);
  }

  function startListening() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setError('Speech recognition requires Chrome or Edge.'); return; }

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';
    recognitionRef.current = rec;
    setPhase('listening');

    rec.onresult = async (e: any) => {
      const text = e.results[0][0].transcript;
      const userMsg: Message = { role: 'user', content: text };
      const next = [...messagesRef.current, userMsg];
      setMessages(next);
      await sendToAI(next);
    };
    rec.onerror = () => { setPhase('in-call'); };
    rec.onend = () => { if (phaseRef.current === 'listening') setPhase('in-call'); };
    rec.start();
  }

  function endCall() {
    window.speechSynthesis.cancel();
    recognitionRef.current?.stop();
    setPhase('ended');
  }

  const targetRate = load.carrierRate || Math.round(load.customerRate * 0.82);
  const statusLabel: Record<Phase, string> = {
    idle: 'READY', calling: 'CONNECTING', 'ai-thinking': 'IN CALL',
    'ai-speaking': 'IN CALL', 'in-call': 'IN CALL', listening: 'IN CALL',
    deal: 'DEAL REACHED', ended: 'ENDED',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 490, background: '#0f172a', borderRadius: 20,
        overflow: 'hidden', boxShadow: '0 30px 70px rgba(0,0,0,0.7)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>

        {/* ── Header ── */}
        <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: 50, height: 50, borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6, #7c3aed)',
                display: 'grid', placeItems: 'center', fontSize: 24,
              }}>🤖</div>
              {['in-call', 'ai-speaking', 'listening', 'ai-thinking'].includes(phase) && (
                <div style={{
                  position: 'absolute', inset: -4, borderRadius: '50%',
                  border: '2px solid #22c55e',
                  animation: 'nex-pulse 2s ease-in-out infinite',
                }} />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                Alex — AI Voice Agent
                {demoMode && (
                  <span style={{ fontSize: 10, fontWeight: 600, background: 'rgba(245,158,11,0.2)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 4, padding: '1px 6px' }}>DEMO</span>
                )}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>NexGen TMS · Carrier Rate Negotiation</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#22c55e', fontFamily: 'monospace', fontSize: 18, fontWeight: 700 }}>
                {['idle', 'calling'].includes(phase) ? '--:--' : fmt(elapsedSecs)}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2, letterSpacing: '0.5px' }}>{statusLabel[phase]}</div>
            </div>
          </div>

          <div style={{ marginTop: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'rgba(255,255,255,0.55)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: '#60a5fa', fontWeight: 600 }}>{load.loadNumber}</span>
            <span>·</span>
            <span>{load.pickupCity}, {load.pickupState} → {load.deliveryCity}, {load.deliveryState}</span>
            <span>·</span>
            <span>{load.equipment}</span>
            <span>·</span>
            <span style={{ color: '#a3e635', fontWeight: 600 }}>Target ${targetRate.toLocaleString()}</span>
          </div>
        </div>

        {/* ── Transcript ── */}
        <div ref={transcriptRef} style={{
          height: 260, overflowY: 'auto', padding: '14px 16px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {phase === 'idle' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
              <div style={{ fontSize: 36 }}>📞</div>
              <div style={{ fontSize: 13 }}>AI will open negotiations — you reply as the carrier</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>Uses your browser mic · No Twilio required · Free to test</div>
            </div>
          )}

          {phase === 'calling' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <div style={{ fontSize: 36, animation: 'nex-spin 1.2s linear infinite' }}>📡</div>
              <div style={{ color: '#60a5fa', fontSize: 14 }}>Connecting...</div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'assistant' ? 'flex-start' : 'flex-end' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 3, paddingLeft: m.role === 'assistant' ? 4 : 0, paddingRight: m.role === 'user' ? 4 : 0 }}>
                {m.role === 'assistant' ? '🤖 Alex (AI)' : '📞 Carrier (You)'}
              </div>
              <div style={{
                maxWidth: '88%', padding: '9px 13px', fontSize: 13, lineHeight: 1.55,
                borderRadius: 12,
                borderTopLeftRadius: m.role === 'assistant' ? 4 : 12,
                borderTopRightRadius: m.role === 'user' ? 4 : 12,
                background: m.role === 'assistant' ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.07)',
                color: m.role === 'assistant' ? '#bfdbfe' : '#e2e8f0',
              }}>
                {m.content}
              </div>
            </div>
          ))}

          {phase === 'ai-thinking' && (
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{ background: 'rgba(59,130,246,0.18)', borderRadius: 12, borderTopLeftRadius: 4, padding: '9px 16px', color: '#60a5fa', fontSize: 18, letterSpacing: 3 }}>•••</div>
            </div>
          )}

          {phase === 'deal' && dealRate && (
            <div style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.28)', borderRadius: 10, padding: '12px 16px', textAlign: 'center', marginTop: 4 }}>
              <div style={{ color: '#4ade80', fontWeight: 700, fontSize: 17 }}>Deal Reached!</div>
              <div style={{ color: '#86efac', fontSize: 13, marginTop: 3 }}>
                Agreed carrier rate: <strong>${dealRate.toLocaleString()}</strong>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 3 }}>
                Margin: ${(load.customerRate - dealRate).toLocaleString()} ({Math.round((load.customerRate - dealRate) / load.customerRate * 100)}%)
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '9px 13px', color: '#fca5a5', fontSize: 12 }}>
              {error}
            </div>
          )}
        </div>

        {/* ── Controls ── */}
        <div style={{ padding: '12px 20px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {phase === 'idle' && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={startCall} style={{ flex: 1, height: 44, background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', border: 0, borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                📞 Start Negotiation
              </button>
              <button onClick={onClose} style={{ height: 44, padding: '0 18px', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, cursor: 'pointer', fontSize: 13 }}>
                Cancel
              </button>
            </div>
          )}

          {phase === 'calling' && (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13, padding: '8px 0' }}>Dialing...</div>
          )}

          {phase === 'ai-speaking' && (
            <div style={{ textAlign: 'center', color: '#60a5fa', fontSize: 13, padding: '8px 0' }}>
              🔊 Alex is speaking...
            </div>
          )}

          {phase === 'ai-thinking' && (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13, padding: '8px 0' }}>
              Thinking...
            </div>
          )}

          {phase === 'in-call' && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={startListening} style={{ flex: 1, height: 44, background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', border: 0, borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                🎙 Speak as Carrier
              </button>
              <button onClick={endCall} style={{ height: 44, padding: '0 16px', background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.28)', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                End Call
              </button>
            </div>
          )}

          {phase === 'listening' && (
            <div style={{ textAlign: 'center', padding: '4px 0' }}>
              <div style={{ color: '#f87171', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'nex-blink 1s ease-in-out infinite' }} />
                Listening — speak as the carrier now
              </div>
              <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11, marginTop: 5 }}>Stops automatically when you pause</div>
            </div>
          )}

          {phase === 'deal' && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { if (dealRate) { onDeal(dealRate); onClose(); } }} style={{ flex: 1, height: 44, background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', border: 0, borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                ✓ Accept ${dealRate?.toLocaleString()} — Update Load
              </button>
              <button onClick={onClose} style={{ height: 44, padding: '0 16px', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, cursor: 'pointer', fontSize: 13 }}>
                Decline
              </button>
            </div>
          )}

          {phase === 'ended' && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={startCall} style={{ flex: 1, height: 44, background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.28)', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Try Again
              </button>
              <button onClick={onClose} style={{ flex: 1, height: 44, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, cursor: 'pointer', fontSize: 13 }}>
                Close
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes nex-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.06)} }
        @keyframes nex-spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes nex-blink { 0%,100%{opacity:1} 50%{opacity:0.25} }
      `}</style>
    </div>
  );
}
