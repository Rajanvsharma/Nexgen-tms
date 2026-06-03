'use client';

import { useEffect, useState } from 'react';
import { PlusCircle, Pencil, UserX, UserCheck } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRequireAuth } from '@/hooks/useAuth';
import api from '@/lib/api';

interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

const ROLES = ['ADMIN', 'DISPATCHER', 'ACCOUNTING', 'COMPLIANCE'];
const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700',
  DISPATCHER: 'bg-blue-100 text-blue-700',
  ACCOUNTING: 'bg-yellow-100 text-yellow-700',
  COMPLIANCE: 'bg-green-100 text-green-700',
};

const EMPTY_FORM = { firstName: '', lastName: '', email: '', password: '', role: 'DISPATCHER' };

export default function UsersPage() {
  const { isLoading } = useRequireAuth('ADMIN');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadUsers() {
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => { loadUsers(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setOpen(true);
  }

  function openEdit(u: UserRow) {
    setEditing(u);
    setForm({ firstName: u.firstName, lastName: u.lastName, email: u.email, password: '', role: u.role });
    setError('');
    setOpen(true);
  }

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      if (editing) {
        const payload: Record<string, string> = {
          firstName: form.firstName,
          lastName: form.lastName,
          role: form.role,
        };
        if (form.password) payload.password = form.password;
        await api.put(`/users/${editing.id}`, payload);
      } else {
        await api.post('/users', form);
      }
      setOpen(false);
      await loadUsers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: UserRow) {
    await api.put(`/users/${u.id}`, { isActive: !u.isActive });
    await loadUsers();
  }

  if (isLoading) return null;

  return (
    <>
      <Topbar title="User Management" />
      <main className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">System Users</h3>
            <p className="text-sm text-gray-500">{users.length} user{users.length !== 1 ? 's' : ''} total</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? 'Edit User' : 'Create New User'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>First Name</Label>
                    <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Last Name</Label>
                    <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    disabled={!!editing}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{editing ? 'New Password (leave blank to keep)' : 'Password'}</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={editing ? 'Leave blank to keep current' : ''}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Role</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create User'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {fetching ? (
            <p className="p-6 text-sm text-gray-400 animate-pulse">Loading users…</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Name', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">{u.firstName} {u.lastName}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-700'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(u)} className="text-gray-400 hover:text-brand transition-colors">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => toggleActive(u)} className="text-gray-400 hover:text-red-500 transition-colors" title={u.isActive ? 'Deactivate' : 'Activate'}>
                          {u.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}
