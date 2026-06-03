'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';

interface Note {
  id: string;
  body: string;
  createdAt: string;
  author: { firstName: string; lastName: string; role: string };
}

interface Props {
  loadId?: string;
  carrierId?: string;
  customerId?: string;
}

export function NotesPanel({ loadId, carrierId, customerId }: Props) {
  const { user } = useAuthStore();
  const [notes, setNotes] = useState<Note[]>([]);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const params = new URLSearchParams();
    if (loadId) params.set('loadId', loadId);
    if (carrierId) params.set('carrierId', carrierId);
    if (customerId) params.set('customerId', customerId);
    const { data } = await api.get(`/notes?${params}`);
    setNotes(data);
  }

  useEffect(() => { load(); }, [loadId, carrierId, customerId]);

  async function addNote() {
    if (!body.trim()) return;
    setSaving(true);
    try {
      await api.post('/notes', { body, loadId, carrierId, customerId });
      setBody('');
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(id: string) {
    await api.delete(`/notes/${id}`);
    await load();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare className="h-4 w-4 text-brand" />
        <h5 className="font-semibold text-gray-800 text-sm">Notes ({notes.length})</h5>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {notes.length === 0 && <p className="text-xs text-gray-400">No notes yet.</p>}
        {notes.map((n) => (
          <div key={n.id} className="bg-gray-50 rounded-lg px-3 py-2.5 text-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="text-gray-800 flex-1">{n.body}</p>
              {(user?.role === 'ADMIN' || n.author.firstName === user?.firstName) && (
                <button onClick={() => deleteNote(n.id)} className="text-gray-300 hover:text-red-400 shrink-0 mt-0.5">
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {n.author.firstName} {n.author.lastName} · {n.author.role} · {new Date(n.createdAt).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(); } }}
          placeholder="Add a note…"
          className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <button onClick={addNote} disabled={saving || !body.trim()} className="p-2 bg-brand text-white rounded-md hover:bg-brand-light disabled:opacity-50 transition-colors">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
