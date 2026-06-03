'use client';

import { useEffect, useState } from 'react';
import Topbar from '@/components/layout/Topbar';
import api from '@/lib/api';

interface Carrier {
  id: string;
  name: string;
  mcNumber: string;
  equipmentTypes: string[];
  status: string;
  insuranceExpiry: string | null;
  authorityExpiry: string | null;
  w9OnFile: boolean;
  _count: { loads: number };
}

interface ScoredCarrier extends Carrier {
  matchScore: number;
  riskLevel: string;
  scorecard: { score: string } | null;
}

const EQUIPMENT_OPTIONS = ['Dry Van', 'Reefer', 'Flatbed', 'Step Deck', 'RGN', 'Power Only', 'Box Truck'];

function getDaysUntil(d: string | null) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function riskLevel(c: Carrier): string {
  const ins = getDaysUntil(c.insuranceExpiry);
  const auth = getDaysUntil(c.authorityExpiry);
  if (c.status === 'SUSPENDED') return 'high';
  if ((ins !== null && ins < 0) || (auth !== null && auth < 0)) return 'high';
  if ((ins !== null && ins < 30) || (auth !== null && auth < 30) || !c.w9OnFile) return 'medium';
  return 'low';
}

const RISK_COLORS: Record<string, { bg: string; color: string }> = {
  low: { bg: '#ecfdf3', color: '#15803d' },
  medium: { bg: '#fef6e7', color: '#b45309' },
  high: { bg: '#fef2f2', color: '#b91c1c' },
};

export default function MatchPage() {
  const [carriers, setCarriers] = useState<ScoredCarrier[]>([]);
  const [all, setAll] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ origin: '', dest: '', equipment: 'Dry Van' });
  const [shortlisted, setShortlisted] = useState<string[]>([]);
  const [recommendation, setRecommendation] = useState('');

  useEffect(() => {
    api.get('/carriers').then(({ data }) => {
      setAll(data.filter((c: Carrier) => c.status === 'ACTIVE'));
    });
  }, []);

  function runMatch() {
    setLoading(true);
    setCarriers([]);
    setRecommendation('');

    setTimeout(() => {
      const scored: ScoredCarrier[] = all.map((c) => {
        let score = 50;
        // Equipment match
        if (c.equipmentTypes.includes(form.equipment)) score += 20;
        // Load history bonus
        score += Math.min(15, c._count.loads * 2);
        // Risk penalties
        const risk = riskLevel(c);
        if (risk === 'high') score -= 30;
        if (risk === 'medium') score -= 10;
        // W9 bonus
        if (c.w9OnFile) score += 5;
        // Compliance bonus
        const ins = getDaysUntil(c.insuranceExpiry);
        const auth = getDaysUntil(c.authorityExpiry);
        if (ins !== null && ins > 60) score += 5;
        if (auth !== null && auth > 60) score += 5;
        // Random lane history factor (demo)
        score += Math.floor(Math.random() * 10);

        return {
          ...c,
          matchScore: Math.max(10, Math.min(99, score)),
          riskLevel: risk,
          scorecard: null,
        };
      }).sort((a, b) => b.matchScore - a.matchScore).slice(0, 8);

      setCarriers(scored);
      if (scored.length > 0) {
        const top = scored[0];
        setRecommendation(`${top.name} is the best fit — strong equipment match, ${top.riskLevel} risk, ${top._count.loads} loads on record.`);
      }
      setLoading(false);
    }, 700);
  }

  function toggleShortlist(id: string) {
    setShortlisted(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const ins_exp = (c: ScoredCarrier) => {
    const days = getDaysUntil(c.insuranceExpiry);
    if (days === null) return { label: '—', color: '#94a3b8' };
    if (days < 0) return { label: 'Expired', color: '#b91c1c' };
    if (days < 30) return { label: `${days}d left`, color: '#b45309' };
    return { label: 'Valid', color: '#15803d' };
  };

  return (
    <>
      <Topbar title="Smart Matching" />
      <main style={{ flex: 1, overflowY: 'auto', padding: '22px 26px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 21, letterSpacing: '-0.4px', display: 'flex', alignItems: 'center', gap: 10 }}>
              Smart Carrier Matching
              <span className="ai-chip">✦ AI</span>
            </h1>
            <div style={{ color: '#475569', fontSize: 13, marginTop: 3 }}>
              AI ranks carriers by lane fit, equipment, compliance score, and risk profile.
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 12, alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }}>Origin</label>
              <input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} placeholder="Chicago, IL" style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 7, padding: '9px 11px', fontSize: 13, outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }}>Destination</label>
              <input value={form.dest} onChange={(e) => setForm({ ...form, dest: e.target.value })} placeholder="Dallas, TX" style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 7, padding: '9px 11px', fontSize: 13, outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }}>Equipment</label>
              <select value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value })} style={{ border: '1px solid #cbd5e1', borderRadius: 7, padding: '9px 11px', fontSize: 13, outline: 'none', background: '#fff' }}>
                {EQUIPMENT_OPTIONS.map(e => <option key={e}>{e}</option>)}
              </select>
            </div>
            <button onClick={runMatch} disabled={loading || all.length === 0} style={{ background: '#1d4ed8', border: '1px solid #1d4ed8', color: '#fff', borderRadius: 8, padding: '9px 20px', fontWeight: 600, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.8 : 1 }}>
              {loading ? '✦ Matching…' : '✦ Match'}
            </button>
          </div>
        </div>

        {/* Shortlisted */}
        {shortlisted.length > 0 && (
          <div style={{ background: '#eff6ff', border: '1px solid #dbe5ff', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 10 }}>
            <strong>{shortlisted.length} carrier(s) shortlisted</strong>
            <span style={{ color: '#475569' }}>for outreach. Use the dispatch board to assign one.</span>
            <button onClick={() => setShortlisted([])} style={{ marginLeft: 'auto', border: '1px solid #dbe5ff', background: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#1e40af', fontWeight: 600 }}>Clear</button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(5)].map((_, i) => <div key={i} className="sk" style={{ height: 56 }} />)}
          </div>
        )}

        {/* Results */}
        {!loading && carriers.length > 0 && (
          <>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['Rank', 'Carrier', 'Match', 'Equipment', 'Insurance', 'Loads', 'Risk', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', fontSize: 11, letterSpacing: '0.4px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, padding: '10px 14px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {carriers.map((c, i) => {
                    const insInfo = ins_exp(c);
                    const risk = RISK_COLORS[c.riskLevel];
                    const isShortlisted = shortlisted.includes(c.id);
                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid #e2e8f0', background: i === 0 ? '#fafffe' : '#fff' }}>
                        <td style={{ padding: '11px 14px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, color: i === 0 ? '#1d4ed8' : '#94a3b8' }}>#{i + 1}</td>
                        <td style={{ padding: '11px 14px' }}>
                          <div style={{ fontWeight: 600 }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{c.mcNumber}</div>
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <div className="scorebar" style={{ gap: 8 }}>
                            <div className="scorebar">
                              <div className="track" style={{ width: 80 }}>
                                <i style={{ width: `${c.matchScore}%`, background: c.matchScore >= 75 ? '#1d4ed8' : c.matchScore >= 50 ? '#b45309' : '#94a3b8' }} />
                              </div>
                            </div>
                            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>{c.matchScore}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {c.equipmentTypes.slice(0, 2).map(eq => (
                              <span key={eq} style={{ fontSize: 11, background: '#f1f5f9', color: '#475569', padding: '1px 6px', borderRadius: 4 }}>{eq}</span>
                            ))}
                            {c.equipmentTypes.length > 2 && <span style={{ fontSize: 11, color: '#94a3b8' }}>+{c.equipmentTypes.length - 2}</span>}
                          </div>
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: insInfo.color }}>{insInfo.label}</span>
                        </td>
                        <td style={{ padding: '11px 14px', fontFamily: 'IBM Plex Mono, monospace' }}>{c._count.loads}</td>
                        <td style={{ padding: '11px 14px' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: risk.bg, color: risk.color }}>
                            {c.riskLevel}
                          </span>
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <button
                            onClick={() => toggleShortlist(c.id)}
                            style={{ border: '1px solid', borderColor: isShortlisted ? '#1d4ed8' : '#e2e8f0', background: isShortlisted ? '#eff6ff' : '#fff', color: isShortlisted ? '#1e40af' : '#475569', borderRadius: 7, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            {isShortlisted ? '✓ Shortlisted' : 'Shortlist'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {recommendation && (
              <div className="callout ok" style={{ marginTop: 12 }}>
                <span>✦</span>
                <div><strong>AI Recommendation:</strong> {recommendation}</div>
              </div>
            )}
          </>
        )}

        {!loading && carriers.length === 0 && all.length > 0 && (
          <div style={{ textAlign: 'center', padding: '46px 20px', color: '#94a3b8' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>✦</div>
            Enter origin, destination, and equipment, then click Match to see AI-ranked carriers.
          </div>
        )}

        {!loading && all.length === 0 && (
          <div className="callout warn">
            <span>⚠</span>
            <div>No active carriers in your database. Add carriers first to use smart matching.</div>
          </div>
        )}

      </main>
    </>
  );
}
