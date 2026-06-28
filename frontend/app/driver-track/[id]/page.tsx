'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000') + '/api';
const INTERVAL_MS = 30_000;

type Phase = 'requesting' | 'sharing' | 'denied' | 'error' | 'unsupported';

export default function DriverTrackPage() {
  const { id } = useParams<{ id: string }>();
  const [phase, setPhase]       = useState<Phase>('requesting');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [count, setCount]       = useState(0);
  const [loadNum, setLoadNum]   = useState('');
  const watchRef  = useRef<number | null>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const posRef    = useRef<GeolocationPosition | null>(null);

  // Fetch load number for display
  useEffect(() => {
    // We only need the load number — hit the tracking GET which is auth-gated,
    // so we'll just display the ID fragment instead
    setLoadNum(id.slice(-8).toUpperCase());
  }, [id]);

  async function postLocation(pos: GeolocationPosition) {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    try {
      await fetch(`${API}/tracking/loads/${id}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      });
      setLastUpdate(new Date());
      setCount(c => c + 1);
    } catch {
      // network error — will retry on next tick
    }
  }

  useEffect(() => {
    if (!navigator.geolocation) {
      setPhase('unsupported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        posRef.current = pos;
        setPhase('sharing');
        postLocation(pos);

        // Watch for position changes
        watchRef.current = navigator.geolocation.watchPosition(
          (p) => { posRef.current = p; },
          () => {},
          { enableHighAccuracy: true, maximumAge: 10000 }
        );

        // Post every 30 seconds
        timerRef.current = setInterval(() => {
          if (posRef.current) postLocation(posRef.current);
        }, INTERVAL_MS);
      },
      (err) => {
        if (err.code === GeolocationPositionError.PERMISSION_DENIED) setPhase('denied');
        else setPhase('error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );

    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      if (timerRef.current !== null) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const iconStyle: React.CSSProperties = { fontSize: 56, marginBottom: 16 };
  const card: React.CSSProperties = {
    minHeight: '100dvh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '32px 24px', background: '#0f172a', color: '#fff', textAlign: 'center',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };

  if (phase === 'unsupported') return (
    <div style={card}>
      <div style={iconStyle}>📵</div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 10px' }}>Not Supported</h1>
      <p style={{ color: '#94a3b8', fontSize: 14, maxWidth: 280 }}>
        Your browser doesn't support GPS. Please open this link in Chrome or Safari on your phone.
      </p>
    </div>
  );

  if (phase === 'denied') return (
    <div style={card}>
      <div style={iconStyle}>🚫</div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 10px' }}>Location Blocked</h1>
      <p style={{ color: '#94a3b8', fontSize: 14, maxWidth: 280, marginBottom: 20 }}>
        You need to allow location access. Tap the lock icon in your browser address bar and enable Location.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{ padding: '12px 28px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
      >
        Try Again
      </button>
    </div>
  );

  if (phase === 'requesting') return (
    <div style={card}>
      <div style={{ fontSize: 56, marginBottom: 16, animation: 'pulse 1.5s infinite' }}>📍</div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 10px' }}>Allow Location</h1>
      <p style={{ color: '#94a3b8', fontSize: 14, maxWidth: 280 }}>
        A browser prompt will appear asking for your location. Tap <strong style={{ color: '#fff' }}>Allow</strong> to start sharing.
      </p>
    </div>
  );

  return (
    <div style={card}>
      <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', border: '3px solid #22c55e', display: 'grid', placeItems: 'center', marginBottom: 20, position: 'relative' }}>
        <span style={{ fontSize: 34 }}>📍</span>
        {/* Pulse ring */}
        <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: '2px solid #22c55e', opacity: 0.4, animation: 'ring 2s ease-out infinite' }} />
        <style>{`@keyframes ring { 0%{transform:scale(1);opacity:.5} 100%{transform:scale(1.5);opacity:0} }`}</style>
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px' }}>Live Location Active</h1>
      <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 28 }}>Load #{loadNum}</p>

      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: '20px 28px', marginBottom: 28, width: '100%', maxWidth: 320 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>Status</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#22c55e' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'blink 1.5s step-end infinite' }} />
            <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
            Sharing
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>Updates sent</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{count}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>Last update</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>
            {lastUpdate ? lastUpdate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : '—'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>Interval</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Every 30 sec</span>
        </div>
      </div>

      <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 10, padding: '12px 16px', maxWidth: 320, width: '100%', marginBottom: 24 }}>
        <p style={{ margin: 0, fontSize: 12, color: '#93c5fd', lineHeight: 1.6 }}>
          Keep this page open while driving. The dispatcher and shipper can see your location in real-time.
        </p>
      </div>

      <button
        onClick={() => {
          if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
          if (timerRef.current !== null) clearInterval(timerRef.current);
          setPhase('error');
        }}
        style={{ padding: '10px 24px', background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
      >
        Stop Sharing
      </button>
    </div>
  );
}
