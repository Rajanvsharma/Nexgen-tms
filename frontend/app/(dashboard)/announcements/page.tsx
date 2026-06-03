'use client';

import { useEffect, useState } from 'react';
import { Bell, PlusCircle } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';

interface Announcement {
  id: string;
  title: string;
  body: string;
  postedBy: string;
  posterRole: string;
  createdAt: string;
  isRead: boolean;
}

const CAN_POST = ['ADMIN', 'ACCOUNTING', 'COMPLIANCE'];

export default function AnnouncementsPage() {
  const { user } = useAuthStore();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', body: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      const { data } = await api.get('/announcements');
      setAnnouncements(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function markRead(id: string) {
    await api.patch(`/announcements/${id}/read`);
    setAnnouncements((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)));
  }

  async function markAllRead() {
    const unread = announcements.filter((a) => !a.isRead);
    await Promise.all(unread.map((a) => api.patch(`/announcements/${a.id}/read`)));
    setAnnouncements((prev) => prev.map((a) => ({ ...a, isRead: true })));
  }

  async function handlePost() {
    if (!form.title || !form.body) { setError('Title and message are required'); return; }
    setSaving(true);
    setError('');
    try {
      await api.post('/announcements', form);
      setOpen(false);
      setForm({ title: '', body: '' });
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to post');
    } finally {
      setSaving(false);
    }
  }

  const unreadCount = announcements.filter((a) => !a.isRead).length;
  const canPost = user && CAN_POST.includes(user.role);

  return (
    <>
      <Topbar title="Announcements" />
      <main className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Company Announcements</h3>
            <p className="text-sm text-gray-500">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}</p>
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <Button variant="outline" onClick={markAllRead}>Mark All Read</Button>
            )}
            {canPost && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setForm({ title: '', body: '' }); setError(''); }}>
                    <PlusCircle className="h-4 w-4 mr-2" />Post Announcement
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Post Announcement</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <Label>Title *</Label>
                      <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Important update…" />
                    </div>
                    <div className="space-y-1">
                      <Label>Message *</Label>
                      <textarea
                        value={form.body}
                        onChange={(e) => setForm({ ...form, body: e.target.value })}
                        rows={4}
                        className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand resize-none"
                        placeholder="Write your announcement here…"
                      />
                    </div>
                    {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
                    <div className="flex justify-end gap-3">
                      <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                      <Button onClick={handlePost} disabled={saving}>{saving ? 'Posting…' : 'Post'}</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {loading && <p className="text-sm text-gray-400 animate-pulse">Loading announcements…</p>}
          {!loading && announcements.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Bell className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No announcements yet.</p>
            </div>
          )}
          {announcements.map((ann) => (
            <div key={ann.id} className={`bg-white rounded-xl border shadow-sm p-5 transition-colors ${!ann.isRead ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {!ann.isRead && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
                    <h4 className="font-semibold text-gray-800">{ann.title}</h4>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">{ann.body}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    Posted by <strong>{ann.postedBy}</strong> · {ann.posterRole} · {new Date(ann.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {!ann.isRead && (
                  <button onClick={() => markRead(ann.id)} className="text-xs text-blue-600 hover:underline shrink-0">
                    Mark read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
