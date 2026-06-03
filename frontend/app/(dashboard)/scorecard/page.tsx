'use client';

import { useEffect, useState } from 'react';
import { Star, AlertTriangle, CheckCircle, TrendingDown, PlusCircle } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';

interface ScorecardRow {
  id: string;
  name: string;
  mcNumber: string;
  totalLoads: number;
  scoredLoads: number;
  onTimePickup: string | null;
  onTimeDelivery: string | null;
  claimRate: string | null;
  detentionRate: string | null;
  avgRating: string | null;
  totalClaimAmount: number;
  tonuCount: number;
  score: string;
}

interface Load { id: string; loadNumber: string; carrierId: string | null; }

function ScoreBadge({ score }: { score: string }) {
  const n = parseFloat(score);
  const color = n >= 80 ? 'bg-green-100 text-green-700' : n >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
  return <span className={`text-sm font-bold px-3 py-1 rounded-full ${color}`}>{score}</span>;
}

export default function ScorecardPage() {
  const [cards, setCards] = useState<ScorecardRow[]>([]);
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [perfOpen, setPerfOpen] = useState(false);
  const [tonuOpen, setTonuOpen] = useState(false);
  const [search, setSearch] = useState('');

  const [perfForm, setPerfForm] = useState({ loadId: '', scheduledPickup: '', actualPickup: '', scheduledDelivery: '', actualDelivery: '', hasDetention: false, detentionHours: '', hasClaim: false, claimAmount: '', rating: '', notes: '' });
  const [tonuForm, setTonuForm] = useState({ carrierId: '', loadId: '', amount: '', reason: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      const [sc, ld] = await Promise.all([api.get('/scorecard'), api.get('/loads')]);
      setCards(sc.data);
      setLoads(ld.data.filter((l: Load & { carrierId: string | null }) => l.carrierId));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function savePerf() {
    if (!perfForm.loadId) { setError('Select a load'); return; }
    setSaving(true); setError('');
    try {
      await api.post('/scorecard/performance', perfForm);
      setPerfOpen(false);
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to save');
    } finally { setSaving(false); }
  }

  async function saveTonu() {
    if (!tonuForm.carrierId) { setError('Select a carrier'); return; }
    setSaving(true); setError('');
    try {
      await api.post('/scorecard/tonu', tonuForm);
      setTonuOpen(false);
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to save');
    } finally { setSaving(false); }
  }

  const filtered = cards.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.mcNumber.includes(search));

  return (
    <>
      <Topbar title="Carrier Scorecard" />
      <main className="flex-1 overflow-auto p-6 space-y-6">

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Avg Score', value: cards.length > 0 ? (cards.reduce((s, c) => s + parseFloat(c.score), 0) / cards.length).toFixed(0) : '—', icon: Star, color: 'bg-blue-50 text-blue-600' },
            { label: 'High Performers (≥80)', value: cards.filter((c) => parseFloat(c.score) >= 80).length, icon: CheckCircle, color: 'bg-green-50 text-green-600' },
            { label: 'At Risk (<60)', value: cards.filter((c) => parseFloat(c.score) < 60).length, icon: AlertTriangle, color: 'bg-red-50 text-red-600' },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
              <div className={`p-3 rounded-lg ${card.color}`}><card.icon className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{card.value}</p>
                <p className="text-sm text-gray-500">{card.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <Input placeholder="Search carriers…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setPerfForm({ loadId: '', scheduledPickup: '', actualPickup: '', scheduledDelivery: '', actualDelivery: '', hasDetention: false, detentionHours: '', hasClaim: false, claimAmount: '', rating: '', notes: '' }); setError(''); setPerfOpen(true); }}>
              <PlusCircle className="h-4 w-4 mr-2" />Record Performance
            </Button>
            <Button variant="outline" onClick={() => { setTonuForm({ carrierId: '', loadId: '', amount: '', reason: '', notes: '' }); setError(''); setTonuOpen(true); }}>
              <TrendingDown className="h-4 w-4 mr-2" />Record TONU
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <p className="p-6 text-sm text-gray-400 animate-pulse">Loading scorecards…</p>
          ) : filtered.length === 0 ? (
            <p className="p-12 text-center text-gray-400 text-sm">No active carriers. Add carriers to see scorecards.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Carrier', 'Score', 'On-Time Pickup', 'On-Time Delivery', 'Claim Rate', 'Avg Rating', 'TONU', 'Total Loads'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{c.name}</p>
                      <p className="text-xs text-gray-400">MC: {c.mcNumber}</p>
                    </td>
                    <td className="px-4 py-3"><ScoreBadge score={c.score} /></td>
                    <td className="px-4 py-3">
                      {c.onTimePickup !== null ? (
                        <span className={parseFloat(c.onTimePickup) >= 90 ? 'text-green-600' : parseFloat(c.onTimePickup) >= 70 ? 'text-yellow-600' : 'text-red-600'}>
                          {c.onTimePickup}%
                        </span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {c.onTimeDelivery !== null ? (
                        <span className={parseFloat(c.onTimeDelivery) >= 90 ? 'text-green-600' : parseFloat(c.onTimeDelivery) >= 70 ? 'text-yellow-600' : 'text-red-600'}>
                          {c.onTimeDelivery}%
                        </span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {c.claimRate !== null ? (
                        <span className={parseFloat(c.claimRate) === 0 ? 'text-green-600' : parseFloat(c.claimRate) < 5 ? 'text-yellow-600' : 'text-red-600'}>
                          {c.claimRate}%
                        </span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {c.avgRating ? (
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />{c.avgRating}
                        </span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">{c.tonuCount > 0 ? <span className="text-red-600 font-medium">{c.tonuCount}</span> : '0'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.totalLoads}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Record Performance Dialog */}
        <Dialog open={perfOpen} onOpenChange={setPerfOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Record Load Performance</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Load *</Label>
                <Select value={perfForm.loadId} onValueChange={(v) => setPerfForm({ ...perfForm, loadId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select dispatched load…" /></SelectTrigger>
                  <SelectContent>{loads.map((l) => <SelectItem key={l.id} value={l.id}>{(l as unknown as { loadNumber: string }).loadNumber}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Scheduled Pickup</Label><Input type="datetime-local" value={perfForm.scheduledPickup} onChange={(e) => setPerfForm({ ...perfForm, scheduledPickup: e.target.value })} /></div>
                <div className="space-y-1"><Label>Actual Pickup</Label><Input type="datetime-local" value={perfForm.actualPickup} onChange={(e) => setPerfForm({ ...perfForm, actualPickup: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Scheduled Delivery</Label><Input type="datetime-local" value={perfForm.scheduledDelivery} onChange={(e) => setPerfForm({ ...perfForm, scheduledDelivery: e.target.value })} /></div>
                <div className="space-y-1"><Label>Actual Delivery</Label><Input type="datetime-local" value={perfForm.actualDelivery} onChange={(e) => setPerfForm({ ...perfForm, actualDelivery: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 pt-6">
                  <input type="checkbox" id="det" checked={perfForm.hasDetention} onChange={(e) => setPerfForm({ ...perfForm, hasDetention: e.target.checked })} className="h-4 w-4" />
                  <Label htmlFor="det">Has Detention</Label>
                </div>
                {perfForm.hasDetention && (
                  <div className="space-y-1"><Label>Detention Hours</Label><Input type="number" value={perfForm.detentionHours} onChange={(e) => setPerfForm({ ...perfForm, detentionHours: e.target.value })} /></div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 pt-6">
                  <input type="checkbox" id="claim" checked={perfForm.hasClaim} onChange={(e) => setPerfForm({ ...perfForm, hasClaim: e.target.checked })} className="h-4 w-4" />
                  <Label htmlFor="claim">Has Claim</Label>
                </div>
                {perfForm.hasClaim && (
                  <div className="space-y-1"><Label>Claim Amount ($)</Label><Input type="number" value={perfForm.claimAmount} onChange={(e) => setPerfForm({ ...perfForm, claimAmount: e.target.value })} /></div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Rating (1-5)</Label>
                  <Select value={perfForm.rating} onValueChange={(v) => setPerfForm({ ...perfForm, rating: v })}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n} Star{n > 1 ? 's' : ''}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Notes</Label><Input value={perfForm.notes} onChange={(e) => setPerfForm({ ...perfForm, notes: e.target.value })} /></div>
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setPerfOpen(false)}>Cancel</Button>
                <Button onClick={savePerf} disabled={saving}>{saving ? 'Saving…' : 'Save Performance'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Record TONU Dialog */}
        <Dialog open={tonuOpen} onOpenChange={setTonuOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Record TONU (Truck Order Not Used)</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Carrier *</Label>
                <Select value={tonuForm.carrierId} onValueChange={(v) => setTonuForm({ ...tonuForm, carrierId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select carrier…" /></SelectTrigger>
                  <SelectContent>{cards.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} (MC: {c.mcNumber})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Amount ($)</Label><Input type="number" value={tonuForm.amount} onChange={(e) => setTonuForm({ ...tonuForm, amount: e.target.value })} placeholder="0" /></div>
              <div className="space-y-1"><Label>Reason</Label><Input value={tonuForm.reason} onChange={(e) => setTonuForm({ ...tonuForm, reason: e.target.value })} /></div>
              <div className="space-y-1"><Label>Notes</Label><Input value={tonuForm.notes} onChange={(e) => setTonuForm({ ...tonuForm, notes: e.target.value })} /></div>
              {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setTonuOpen(false)}>Cancel</Button>
                <Button onClick={saveTonu} disabled={saving}>{saving ? 'Saving…' : 'Record TONU'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </main>
    </>
  );
}
