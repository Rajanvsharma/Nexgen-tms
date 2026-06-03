'use client';

import { useEffect, useState } from 'react';
import { Radio, CheckCircle, XCircle, Send } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';

interface Load {
  id: string;
  loadNumber: string;
  status: string;
  pickupCity: string;
  pickupState: string;
  deliveryCity: string;
  deliveryState: string;
  equipment: string;
  customerRate: number;
  pickupDate: string | null;
  customer: { name: string };
}

interface Posting {
  id: string;
  board: string;
  postingId: string | null;
  status: string;
  postedAt: string;
}

const BOARDS = [
  { id: 'DAT', label: 'DAT Load Board', description: 'Largest freight marketplace in North America' },
  { id: 'TRUCKSTOP', label: 'Truckstop.com', description: 'Full-featured freight posting and search' },
  { id: 'BULKLOADS', label: 'BulkLoads', description: 'Specialized for bulk commodity freight' },
];

export default function LoadBoardPage() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [postings, setPostings] = useState<Record<string, Posting[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedLoad, setSelectedLoad] = useState<Load | null>(null);
  const [selectedBoards, setSelectedBoards] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState('');

  async function loadData() {
    try {
      const { data } = await api.get('/loads');
      const eligible = data.filter((l: Load) => ['CREATED', 'DISPATCHED'].includes(l.status));
      setLoads(eligible);

      const postingMap: Record<string, Posting[]> = {};
      await Promise.all(eligible.map(async (l: Load) => {
        const { data: p } = await api.get(`/loadboard/${l.id}/postings`);
        postingMap[l.id] = p;
      }));
      setPostings(postingMap);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  function toggleBoard(board: string) {
    setSelectedBoards((prev) => prev.includes(board) ? prev.filter((b) => b !== board) : [...prev, board]);
  }

  async function postLoad() {
    if (!selectedLoad || !selectedBoards.length) return;
    setPosting(true);
    setMessage('');
    try {
      const { data } = await api.post(`/loadboard/${selectedLoad.id}/post`, { boards: selectedBoards });
      const posted = data.filter((r: { status: string }) => r.status === 'POSTED').length;
      const already = data.filter((r: { status: string }) => r.status === 'ALREADY_POSTED').length;
      setMessage(`Posted to ${posted} board(s).${already > 0 ? ` ${already} already posted.` : ''}`);
      setSelectedLoad(null);
      setSelectedBoards([]);
      await loadData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMessage(msg || 'Failed to post');
    } finally {
      setPosting(false);
    }
  }

  async function removePosting(loadId: string, board: string) {
    await api.delete(`/loadboard/${loadId}/posting`, { data: { board } });
    await loadData();
  }

  return (
    <>
      <Topbar title="Load Board" />
      <main className="flex-1 overflow-auto p-6 space-y-6">

        {/* Board selector panel */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Radio className="h-5 w-5 text-brand" />Post a Load
          </h4>
          <div className="space-y-4">
            {/* Load selection */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">1. Select a load to post</p>
              {loading ? <p className="text-sm text-gray-400 animate-pulse">Loading…</p> : loads.length === 0 ? (
                <p className="text-sm text-gray-400">No eligible loads (must be CREATED or DISPATCHED).</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {loads.map((l) => (
                    <button key={l.id} onClick={() => setSelectedLoad(selectedLoad?.id === l.id ? null : l)}
                      className={`text-left p-3 rounded-lg border transition-colors ${selectedLoad?.id === l.id ? 'border-brand bg-brand/5 ring-1 ring-brand' : 'border-gray-200 hover:border-gray-300'}`}>
                      <p className="font-mono font-medium text-brand text-sm">{l.loadNumber}</p>
                      <p className="text-xs text-gray-600 mt-1">{l.pickupCity}, {l.pickupState} → {l.deliveryCity}, {l.deliveryState}</p>
                      <p className="text-xs text-gray-500">{l.equipment} · ${l.customerRate.toLocaleString()}</p>
                      {postings[l.id]?.filter((p) => p.status === 'POSTED').length > 0 && (
                        <p className="text-xs text-green-600 mt-1">
                          Posted on: {postings[l.id].filter((p) => p.status === 'POSTED').map((p) => p.board).join(', ')}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Board selection */}
            {selectedLoad && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">2. Select boards</p>
                <div className="flex flex-wrap gap-3">
                  {BOARDS.map((board) => {
                    const isPosted = postings[selectedLoad.id]?.some((p) => p.board === board.id && p.status === 'POSTED');
                    return (
                      <button key={board.id}
                        onClick={() => !isPosted && toggleBoard(board.id)}
                        disabled={isPosted}
                        className={`p-3 rounded-lg border transition-colors text-left min-w-[180px] ${isPosted ? 'border-green-200 bg-green-50 cursor-not-allowed' : selectedBoards.includes(board.id) ? 'border-brand bg-brand/5 ring-1 ring-brand' : 'border-gray-200 hover:border-gray-300'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-sm text-gray-800">{board.label}</p>
                          {isPosted && <CheckCircle className="h-4 w-4 text-green-500" />}
                        </div>
                        <p className="text-xs text-gray-500">{board.description}</p>
                        {isPosted && <p className="text-xs text-green-600 mt-1">Already posted</p>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedLoad && selectedBoards.length > 0 && (
              <div className="flex items-center gap-4">
                <Button onClick={postLoad} disabled={posting}>
                  <Send className="h-4 w-4 mr-2" />{posting ? 'Posting…' : `Post to ${selectedBoards.length} Board(s)`}
                </Button>
                {message && <p className="text-sm text-gray-600">{message}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Active Postings */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h4 className="font-semibold text-gray-800">Active Postings</h4>
          </div>
          {loading ? (
            <p className="p-6 text-sm text-gray-400 animate-pulse">Loading…</p>
          ) : Object.values(postings).every((p) => p.filter((x) => x.status === 'POSTED').length === 0) ? (
            <p className="p-6 text-sm text-gray-400">No active postings. Post a load above to get started.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Load #', 'Route', 'Board', 'Posting ID', 'Posted At', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loads.flatMap((l) =>
                  (postings[l.id] || []).filter((p) => p.status === 'POSTED').map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-brand font-medium">{l.loadNumber}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{l.pickupCity}, {l.pickupState} → {l.deliveryCity}, {l.deliveryState}</td>
                      <td className="px-4 py-3"><span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{p.board}</span></td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.postingId || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{new Date(p.postedAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => removePosting(l.id, p.board)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                          <XCircle className="h-3 w-3" />Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
          <strong>Note:</strong> Load board integrations (DAT, Truckstop, BulkLoads) are currently in simulation mode. To activate real posting, add API credentials to your backend .env file: <code>DAT_API_KEY</code>, <code>TRUCKSTOP_API_KEY</code>, <code>BULKLOADS_API_KEY</code>.
        </div>

      </main>
    </>
  );
}
