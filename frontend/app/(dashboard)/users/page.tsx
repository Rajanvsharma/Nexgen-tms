'use client';

import { useEffect, useState } from 'react';
import { PlusCircle, Pencil, UserX, UserCheck, Mail, Trash2 } from 'lucide-react';
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

interface CustomerOption { id: string; name: string; }

const ROLES = ['ADMIN', 'DISPATCHER', 'ACCOUNTING', 'COMPLIANCE', 'CUSTOMER'];
const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700',
  DISPATCHER: 'bg-blue-100 text-blue-700',
  ACCOUNTING: 'bg-yellow-100 text-yellow-700',
  COMPLIANCE: 'bg-green-100 text-green-700',
  CUSTOMER: 'bg-orange-100 text-orange-700',
};

const EMPTY_FORM = { firstName: '', lastName: '', email: '', password: '', role: 'DISPATCHER', customerId: '' };
const EMPTY_INVITE = { firstName: '', lastName: '', email: '', role: 'DISPATCHER' };

export default function UsersPage() {
  const { user: currentUser, isLoading } = useRequireAuth('ADMIN');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE);
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ emailSent: boolean; inviteUrl: string | null } | null>(null);
  const [inviteError, setInviteError] = useState('');

  async function loadUsers() {
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    loadUsers();
    api.get('/customers').then(({ data }) => setCustomers(data.filter((c: CustomerOption & { isActive: boolean }) => c.isActive)));
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setError('');
    setOpen(true);
  }

  function openEdit(u: UserRow) {
    setEditing(u);
    setForm({ firstName: u.firstName, lastName: u.lastName, email: u.email, password: '', role: u.role, customerId: '' });
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
        const payload = { ...form };
        if (form.role !== 'CUSTOMER') delete (payload as Partial<typeof form>).customerId;
        await api.post('/users', payload);
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

  async function deleteUser(u: UserRow) {
    if (!confirm(`Permanently delete ${u.firstName} ${u.lastName}? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      await loadUsers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || 'Failed to delete user');
    }
  }

  function openInvite() {
    setInviteForm(EMPTY_INVITE);
    setInviteError('');
    setInviteResult(null);
    setInviteOpen(true);
  }

  async function handleInvite() {
    setInviteError('');
    if (!inviteForm.email || !inviteForm.firstName || !inviteForm.lastName) {
      setInviteError('First name, last name, and email are required');
      return;
    }
    setInviting(true);
    try {
      const { data } = await api.post('/users/invite', inviteForm);
      setInviteResult(data);
      await loadUsers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setInviteError(msg || 'Failed to send invite');
    } finally {
      setInviting(false);
    }
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
          <div className="flex items-center gap-2">
            {/* Invite User Dialog */}
            <Dialog open={inviteOpen} onOpenChange={(v) => { setInviteOpen(v); if (!v) setInviteResult(null); }}>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={openInvite}>
                  <Mail className="h-4 w-4 mr-2" />
                  Invite User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite User</DialogTitle>
                </DialogHeader>
                {inviteResult ? (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">
                      {inviteResult.emailSent
                        ? `Invitation email sent to ${inviteForm.email}.`
                        : 'User created. No SMTP configured — share this link manually:'}
                    </div>
                    {inviteResult.inviteUrl && (
                      <div className="space-y-2">
                        <Label>Invite Link (copy and share)</Label>
                        <div className="flex gap-2">
                          <Input readOnly value={inviteResult.inviteUrl} className="text-xs font-mono" />
                          <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(inviteResult.inviteUrl!)}>Copy</Button>
                        </div>
                      </div>
                    )}
                    <Button className="w-full" onClick={() => { setInviteOpen(false); setInviteResult(null); }}>Done</Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label>First Name</Label>
                        <Input value={inviteForm.firstName} onChange={e => setInviteForm(f => ({ ...f, firstName: e.target.value }))} placeholder="Jane" />
                      </div>
                      <div className="space-y-1">
                        <Label>Last Name</Label>
                        <Input value={inviteForm.lastName} onChange={e => setInviteForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Smith" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Email Address</Label>
                      <Input type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@company.com" />
                    </div>
                    <div className="space-y-1">
                      <Label>Role</Label>
                      <Select value={inviteForm.role} onValueChange={v => setInviteForm(f => ({ ...f, role: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLES.filter(r => r !== 'CUSTOMER').map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-gray-400">They'll receive an email with a link to set their password and access the TMS.</p>
                    {inviteError && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{inviteError}</p>}
                    <div className="flex justify-end gap-3 pt-2">
                      <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
                      <Button onClick={handleInvite} disabled={inviting}>
                        <Mail className="h-4 w-4 mr-2" />
                        {inviting ? 'Sending…' : 'Send Invite'}
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

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
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v, customerId: '' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => <SelectItem key={r} value={r}>{r}{r === 'CUSTOMER' ? ' (Shipper Portal)' : ''}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {form.role === 'CUSTOMER' && (
                  <div className="space-y-1">
                    <Label>Link to Customer Account *</Label>
                    <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select customer…" /></SelectTrigger>
                      <SelectContent>
                        {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-400">This user will see only their company's quotes and loads in the shipper portal.</p>
                  </div>
                )}
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
                        <button onClick={() => openEdit(u)} className="text-gray-400 hover:text-blue-600 transition-colors" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => toggleActive(u)} className="text-gray-400 hover:text-yellow-600 transition-colors" title={u.isActive ? 'Deactivate' : 'Activate'}>
                          {u.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </button>
                        {currentUser?.id !== u.id && (
                          <button onClick={() => deleteUser(u)} className="text-gray-400 hover:text-red-600 transition-colors" title="Delete user permanently">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
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
