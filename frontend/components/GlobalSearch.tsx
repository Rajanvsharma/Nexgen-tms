'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface SearchResults {
  loads:     Array<{ id: string; loadNumber: string; status: string; pickupCity: string; pickupState: string; deliveryCity: string; deliveryState: string; customerRate: number; customer: { name: string } | null; carrier: { name: string } | null }>;
  carriers:  Array<{ id: string; name: string; mcNumber: string; safetyRating: string | null }>;
  customers: Array<{ id: string; name: string; email: string | null; phone: string | null }>;
  quotes:    Array<{ id: string; quoteNumber: string; status: string; pickupCity: string; pickupState: string; deliveryCity: string; deliveryState: string; customer: { name: string } | null }>;
}

const EMPTY: SearchResults = { loads: [], carriers: [], customers: [], quotes: [] };

const STATUS_COLOR: Record<string, string> = {
  DELIVERED: '#15803d', COMPLETED: '#065f46', INVOICED: '#5b21b6',
  IN_TRANSIT: '#b45309', DISPATCHED: '#4338ca', CANCELLED: '#b91c1c',
};

export default function GlobalSearch() {
  const [open,    setOpen]    = useState(false);
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [cursor,  setCursor]  = useState(0);
  const inputRef   = useRef<HTMLInputElement>(null);
  const router     = useRouter();

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 50); setQuery(''); setResults(EMPTY); }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(EMPTY); return; }
    setLoading(true);
    try {
      const { data } = await api.get(`/search?q=${encodeURIComponent(q)}`);
      setResults(data);
      setCursor(0);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 220);
    return () => clearTimeout(t);
  }, [query, search]);

  const total = results.loads.length + results.carriers.length + results.customers.length + results.quotes.length;

  function navigate(path: string) { setOpen(false); router.push(path); }

  // Flatten items for keyboard nav
  const flat: Array<{ label: string; sub: string; path: string; badge?: string; badgeColor?: string }> = [
    ...results.loads.map(l => ({
      label: l.loadNumber, sub: `${l.pickupCity}, ${l.pickupState} → ${l.deliveryCity}, ${l.deliveryState} · ${l.customer?.name || ''}`,
      path: `/loads/${l.id}`, badge: l.status, badgeColor: STATUS_COLOR[l.status] || '#64748b',
    })),
    ...results.customers.map(c => ({
      label: c.name, sub: [c.email, c.phone].filter(Boolean).join(' · '),
      path: '/customers', badge: 'Customer', badgeColor: '#0e7490',
    })),
    ...results.carriers.map(c => ({
      label: c.name, sub: `MC: ${c.mcNumber}${c.safetyRating ? ` · ${c.safetyRating}` : ''}`,
      path: '/carriers', badge: 'Carrier', badgeColor: '#6d28d9',
    })),
    ...results.quotes.map(q => ({
      label: q.quoteNumber, sub: `${q.pickupCity}, ${q.pickupState} → ${q.deliveryCity}, ${q.deliveryState}`,
      path: '/quotes', badge: q.status, badgeColor: '#b45309',
    })),
  ];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, flat.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
      if (e.key === 'Enter' && flat[cursor]) navigate(flat[cursor].path);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, flat, cursor]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', color: '#94a3b8', fontSize: 13 }}
      >
        <span style={{ fontSize: 15 }}>🔍</span>
        <span>Search…</span>
        <kbd style={{ marginLeft: 4, padding: '1px 5px', background: '#e2e8f0', borderRadius: 4, fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>⌘K</kbd>
      </button>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(2px)' }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 640, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: 18, color: '#94a3b8' }}>{loading ? '⏳' : '🔍'}</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search loads, carriers, customers, quotes…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: '#0f172a', background: 'transparent' }}
          />
          <kbd onClick={() => setOpen(false)} style={{ padding: '2px 7px', background: '#f1f5f9', borderRadius: 5, fontSize: 11, color: '#64748b', cursor: 'pointer', fontFamily: 'monospace' }}>Esc</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 460, overflowY: 'auto' }}>
          {query.length < 2 && (
            <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              Type at least 2 characters to search
            </div>
          )}

          {query.length >= 2 && total === 0 && !loading && (
            <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              No results for "{query}"
            </div>
          )}

          {flat.map((item, i) => (
            <div key={i}
              onClick={() => navigate(item.path)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', cursor: 'pointer', background: i === cursor ? '#f0f9ff' : 'transparent', borderLeft: i === cursor ? '3px solid #1d4ed8' : '3px solid transparent' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
                {item.sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sub}</div>}
              </div>
              {item.badge && (
                <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 700, background: `${item.badgeColor}18`, color: item.badgeColor, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {item.badge}
                </span>
              )}
            </div>
          ))}

          {total > 0 && (
            <div style={{ padding: '8px 18px', borderTop: '1px solid #f1f5f9', fontSize: 11, color: '#94a3b8', display: 'flex', gap: 4 }}>
              <span>↑↓ navigate</span><span style={{ margin: '0 6px' }}>·</span><span>↵ open</span><span style={{ margin: '0 6px' }}>·</span><span>Esc close</span>
            </div>
          )}
        </div>
      </div>
      <div style={{ position: 'fixed', inset: 0, zIndex: -1 }} onClick={() => setOpen(false)} />
    </div>
  );
}
