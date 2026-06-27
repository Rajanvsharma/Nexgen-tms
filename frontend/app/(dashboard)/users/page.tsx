'use client';

import { useEffect, useState } from 'react';
import { PlusCircle, Pencil, UserX, UserCheck, Mail, Trash2, RefreshCw, Users, UserPlus, X } from 'lucide-react';
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
  teamId?: string | null;
  team?: { id: string; name: string } | null;
}

interface CustomerOption { id: string; name: string; }

interface TeamMember { id: string; firstName: string; lastName: string; role: string; isActive: boolean; }
interface TeamRow {
  id: string;
  name: string;
  isActive: boolean;
  repVisibility: 'own' | 'team';
  manager: { id: string; firstName: string; lastName: string; role: string } | null;
  _count: { members: number };
}
interface TeamDetail extends TeamRow { members: TeamMember[]; }

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'OPS_MANAGER', 'TEAM_MANAGER', 'DISPATCHER', 'ACCOUNT_EXEC', 'CARRIER_RELATIONS', 'ACCOUNTING', 'COMPLIANCE', 'SUPPORT', 'AUDITOR', 'CUSTOMER', 'CARRIER'];
const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', ADMIN: 'Admin', OPS_MANAGER: 'Ops Manager', TEAM_MANAGER: 'Team Manager',
  DISPATCHER: 'Dispatcher', ACCOUNT_EXEC: 'Account Exec', CARRIER_RELATIONS: 'Carrier Relations',
  ACCOUNTING: 'Accounting', COMPLIANCE: 'Compliance', SUPPORT: 'Support', AUDITOR: 'Auditor',
  CUSTOMER: 'Shipper (portal)', CARRIER: 'Carrier (portal)',
};
const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-700', ADMIN: 'bg-purple-100 text-purple-700',
  OPS_MANAGER: 'bg-indigo-100 text-indigo-700', TEAM_MANAGER: 'bg-pink-100 text-pink-700',
  DISPATCHER: 'bg-blue-100 text-blue-700', ACCOUNT_EXEC: 'bg-cyan-100 text-cyan-700',
  CARRIER_RELATIONS: 'bg-teal-100 text-teal-700', ACCOUNTING: 'bg-yellow-100 text-yellow-700',
  COMPLIANCE: 'bg-green-100 text-green-700', SUPPORT: 'bg-sky-100 text-sky-700',
  AUDITOR: 'bg-violet-100 text-violet-700', CUSTOMER: 'bg-orange-100 text-orange-700',
  CARRIER: 'bg-amber-100 text-amber-700',
};

const EMPTY_FORM = { firstName: '', lastName: '', email: '', password: '', role: 'DISPATCHER', customerId: '', teamId: '' };
const EMPTY_INVITE = { firstName: '', lastName: '', email: '', role: 'DISPATCHER', teamId: '' };
const EMPTY_TEAM_FORM = { name: '', managerId: '' };

export default function UsersPage() {
  const { user: currentUser, isLoading } = useRequireAuth(['ADMIN', 'SUPER_ADMIN']);

  const [tab, setTab] = useState<'users' | 'teams'>('users');

  // ── Users state ──────────────────────────────────────────────────────────────
  const [users, setUsers]       = useState<UserRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [open, setOpen]         = useState(false);
  const [editing, setEditing]   = useState<UserRow | null>(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  const [inviteOpen, setInviteOpen]     = useState(false);
  const [inviteForm, setInviteForm]     = useState(EMPTY_INVITE);
  const [inviting, setInviting]         = useState(false);
  const [inviteResult, setInviteResult] = useState<{ emailSent: boolean; inviteUrl: string; emailError?: string | null } | null>(null);
  const [inviteError, setInviteError]   = useState('');

  // ── Teams state ───────────────────────────────────────────────────────────────
  const [teams, setTeams]               = useState<TeamRow[]>([]);
  const [teamsFetching, setTeamsFetching] = useState(true);
  const [expandedTeam, setExpandedTeam] = useState<TeamDetail | null>(null);
  const [teamOpen, setTeamOpen]         = useState(false);
  const [editingTeam, setEditingTeam]   = useState<TeamRow | null>(null);
  const [teamForm, setTeamForm]         = useState(EMPTY_TEAM_FORM);
  const [teamSaving, setTeamSaving]     = useState(false);
  const [teamError, setTeamError]       = useState('');
  const [addMemberUserId, setAddMemberUserId] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [updatingVisibility, setUpdatingVisibility] = useState<string | null>(null);

  // ── Data loaders ──────────────────────────────────────────────────────────────
  async function loadUsers() {
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } finally {
      setFetching(false);
    }
  }

  async function loadTeams() {
    try {
      const { data } = await api.get('/teams');
      setTeams(data);
    } finally {
      setTeamsFetching(false);
    }
  }

  async function expandTeam(team: TeamRow) {
    if (expandedTeam?.id === team.id) { setExpandedTeam(null); return; }
    const { data } = await api.get(`/teams/${team.id}`);
    setExpandedTeam(data);
  }

  useEffect(() => {
    loadUsers();
    loadTeams();
    api.get('/customers').then(({ data }) => setCustomers(data.filter((c: CustomerOption & { isActive: boolean }) => c.isActive)));
  }, []);

  // ── User actions ──────────────────────────────────────────────────────────────
  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setError('');
    setOpen(true);
  }

  function openEdit(u: UserRow) {
    setEditing(u);
    setForm({ firstName: u.firstName, lastName: u.lastName, email: u.email, password: '', role: u.role, customerId: '', teamId: u.teamId ?? '' });
    setError('');
    setOpen(true);
  }

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      if (editing) {
        const payload: Record<string, string | null> = { firstName: form.firstName, lastName: form.lastName, role: form.role, teamId: form.teamId || null };
        if (form.password) payload.password = form.password;
        if (form.role === 'CUSTOMER') payload.customerId = form.customerId || null;
        await api.put(`/users/${editing.id}`, payload);
      } else {
        const payload = { ...form, teamId: form.teamId || undefined };
        if (form.role !== 'CUSTOMER') delete (payload as Partial<typeof form>).customerId;
        await api.post('/users', payload);
      }
      setOpen(false);
      await Promise.all([loadUsers(), loadTeams()]);
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

  async function resendInvite(u: UserRow) {
    try {
      const { data } = await api.post(`/users/${u.id}/resend-invite`);
      if (data.inviteUrl) {
        const copy = window.confirm(`Email not configured — copy invite link?\n\n${data.inviteUrl}`);
        if (copy) navigator.clipboard.writeText(data.inviteUrl).catch(() => {});
      } else {
        alert(`Invite resent to ${u.email}`);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || 'Failed to resend invite');
    }
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
      const payload = { ...inviteForm, teamId: inviteForm.teamId || undefined };
      const { data } = await api.post('/users/invite', payload);
      setInviteResult(data);
      await Promise.all([loadUsers(), loadTeams()]);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setInviteError(msg || 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  }

  // ── Team actions ──────────────────────────────────────────────────────────────
  function openCreateTeam() {
    setEditingTeam(null);
    setTeamForm(EMPTY_TEAM_FORM);
    setTeamError('');
    setTeamOpen(true);
  }

  function openEditTeam(t: TeamRow) {
    setEditingTeam(t);
    setTeamForm({ name: t.name, managerId: t.manager?.id ?? '' });
    setTeamError('');
    setTeamOpen(true);
  }

  async function handleSaveTeam() {
    setTeamError('');
    if (!teamForm.name.trim()) { setTeamError('Team name is required'); return; }
    setTeamSaving(true);
    try {
      const payload = { name: teamForm.name.trim(), managerId: teamForm.managerId || null };
      if (editingTeam) {
        await api.put(`/teams/${editingTeam.id}`, payload);
      } else {
        await api.post('/teams', payload);
      }
      setTeamOpen(false);
      await Promise.all([loadTeams(), loadUsers()]);
      setExpandedTeam(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setTeamError(msg || 'Failed to save team');
    } finally {
      setTeamSaving(false);
    }
  }

  async function handleAddMember(teamId: string) {
    if (!addMemberUserId) return;
    setAddingMember(true);
    try {
      await api.post(`/teams/${teamId}/members`, { userId: addMemberUserId });
      setAddMemberUserId('');
      const [{ data: detail }] = await Promise.all([api.get(`/teams/${teamId}`), loadUsers(), loadTeams()]);
      setExpandedTeam(detail);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  }

  async function handleRemoveMember(teamId: string, userId: string) {
    try {
      await api.delete(`/teams/${teamId}/members/${userId}`);
      const [{ data: detail }] = await Promise.all([api.get(`/teams/${teamId}`), loadUsers(), loadTeams()]);
      setExpandedTeam(detail);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || 'Failed to remove member');
    }
  }

  async function handleSetRepVisibility(teamId: string, value: 'own' | 'team') {
    setUpdatingVisibility(teamId);
    try {
      await api.patch(`/teams/${teamId}/visibility`, { repVisibility: value });
      setTeams(ts => ts.map(t => t.id === teamId ? { ...t, repVisibility: value } : t));
    } catch {
      alert('Failed to update rep visibility');
    } finally {
      setUpdatingVisibility(null);
    }
  }

  // Users not yet assigned to any team (for the add-member picker)
  const unassignedUsers = users.filter(u => !u.teamId && u.role !== 'CUSTOMER' && u.role !== 'CARRIER');

  if (isLoading) return null;

  return (
    <>
      <Topbar title="Org Management" />
      <main className="flex-1 overflow-auto p-6">

        {/* ── Tab switcher ── */}
        <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
          {(['users', 'teams'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t === 'users' ? `Users (${users.length})` : `Teams (${teams.length})`}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════ USERS TAB ══════════════════════════════ */}
        {tab === 'users' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">{users.length} user{users.length !== 1 ? 's' : ''} total</p>
              <div className="flex items-center gap-2">

                {/* Invite User */}
                <Dialog open={inviteOpen} onOpenChange={(v) => { setInviteOpen(v); if (!v) setInviteResult(null); }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" onClick={openInvite}><Mail className="h-4 w-4 mr-2" />Invite User</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Invite User</DialogTitle></DialogHeader>
                    {inviteResult ? (
                      <div className="space-y-4">
                        <div className={`border rounded-lg p-4 text-sm ${inviteResult.emailSent ? 'bg-green-50 border-green-200 text-green-700' : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
                          {inviteResult.emailSent ? `✓ Invitation email sent to ${inviteForm.email}.` : `⚠ User created but email failed — share the link below manually.`}
                          {inviteResult.emailError && <div className="mt-1 text-xs text-red-600">{inviteResult.emailError}</div>}
                        </div>
                        <div className="space-y-2">
                          <Label>Invite Link (copy and share)</Label>
                          <div className="flex gap-2">
                            <Input readOnly value={inviteResult.inviteUrl} className="text-xs font-mono" />
                            <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(inviteResult.inviteUrl!)}>Copy</Button>
                          </div>
                          <p className="text-xs text-gray-400">Link expires in 72 hours.</p>
                        </div>
                        <Button className="w-full" onClick={() => { setInviteOpen(false); setInviteResult(null); }}>Done</Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1"><Label>First Name</Label><Input value={inviteForm.firstName} onChange={e => setInviteForm(f => ({ ...f, firstName: e.target.value }))} placeholder="Jane" /></div>
                          <div className="space-y-1"><Label>Last Name</Label><Input value={inviteForm.lastName} onChange={e => setInviteForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Smith" /></div>
                        </div>
                        <div className="space-y-1"><Label>Email Address</Label><Input type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@company.com" /></div>
                        <div className="space-y-1">
                          <Label>Role</Label>
                          <Select value={inviteForm.role} onValueChange={v => setInviteForm(f => ({ ...f, role: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{ROLES.filter(r => r !== 'CUSTOMER' && r !== 'CARRIER').map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r] ?? r}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Assign to Team <span className="text-gray-400 font-normal">(optional)</span></Label>
                          <Select value={inviteForm.teamId} onValueChange={v => setInviteForm(f => ({ ...f, teamId: v }))}>
                            <SelectTrigger><SelectValue placeholder="No team" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">No team</SelectItem>
                              {teams.filter(t => t.isActive).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <p className="text-xs text-gray-400">They'll receive an email with a link to set their password.</p>
                        {inviteError && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{inviteError}</p>}
                        <div className="flex justify-end gap-3 pt-2">
                          <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
                          <Button onClick={handleInvite} disabled={inviting}><Mail className="h-4 w-4 mr-2" />{inviting ? 'Sending…' : 'Send Invite'}</Button>
                        </div>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>

                {/* Add User */}
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={openCreate}><PlusCircle className="h-4 w-4 mr-2" />Add User</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{editing ? 'Edit User' : 'Create New User'}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><Label>First Name</Label><Input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /></div>
                        <div className="space-y-1"><Label>Last Name</Label><Input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></div>
                      </div>
                      <div className="space-y-1">
                        <Label>Email</Label>
                        <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} disabled={!!editing} />
                      </div>
                      <div className="space-y-1">
                        <Label>{editing ? 'New Password (leave blank to keep)' : 'Password'}</Label>
                        <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={editing ? 'Leave blank to keep current' : ''} />
                      </div>
                      <div className="space-y-1">
                        <Label>Role</Label>
                        <Select value={form.role} onValueChange={v => setForm({ ...form, role: v, customerId: '' })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r] ?? r}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      {form.role !== 'CUSTOMER' && form.role !== 'CARRIER' && (
                        <div className="space-y-1">
                          <Label>Team <span className="text-gray-400 font-normal">(optional)</span></Label>
                          <Select value={form.teamId} onValueChange={v => setForm({ ...form, teamId: v })}>
                            <SelectTrigger><SelectValue placeholder="No team" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">No team</SelectItem>
                              {teams.filter(t => t.isActive).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {form.role === 'CUSTOMER' && (
                        <div className="space-y-1">
                          <Label>Link to Customer Account *</Label>
                          <Select value={form.customerId} onValueChange={v => setForm({ ...form, customerId: v })}>
                            <SelectTrigger><SelectValue placeholder="Select customer…" /></SelectTrigger>
                            <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                          </Select>
                          <p className="text-xs text-gray-400">This user will only see their company's data in the shipper portal.</p>
                        </div>
                      )}
                      {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
                      <div className="flex justify-end gap-3 pt-2">
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create User'}</Button>
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
                      {['Name', 'Email', 'Role', 'Team', 'Status', 'Joined', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-800">{u.firstName} {u.lastName}</td>
                        <td className="px-4 py-3 text-gray-600">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-700'}`}>
                            {ROLE_LABELS[u.role] ?? u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{u.team?.name ?? <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {u.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openEdit(u)} className="text-gray-400 hover:text-blue-600 transition-colors" title="Edit"><Pencil className="h-4 w-4" /></button>
                            <button onClick={() => resendInvite(u)} className="text-gray-400 hover:text-indigo-600 transition-colors" title="Resend invite"><RefreshCw className="h-4 w-4" /></button>
                            <button onClick={() => toggleActive(u)} className="text-gray-400 hover:text-yellow-600 transition-colors" title={u.isActive ? 'Deactivate' : 'Activate'}>
                              {u.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                            </button>
                            {currentUser?.id !== u.id && (
                              <button onClick={() => deleteUser(u)} className="text-gray-400 hover:text-red-600 transition-colors" title="Delete"><Trash2 className="h-4 w-4" /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ══════════════════════════════ TEAMS TAB ══════════════════════════════ */}
        {tab === 'teams' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">{teams.length} team{teams.length !== 1 ? 's' : ''}</p>

              {/* Create Team */}
              <Dialog open={teamOpen} onOpenChange={setTeamOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openCreateTeam}><PlusCircle className="h-4 w-4 mr-2" />New Team</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{editingTeam ? 'Edit Team' : 'Create Team'}</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <Label>Team Name</Label>
                      <Input value={teamForm.name} onChange={e => setTeamForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. East Coast Team" />
                    </div>
                    <div className="space-y-1">
                      <Label>Team Manager <span className="text-gray-400 font-normal">(optional)</span></Label>
                      <Select value={teamForm.managerId} onValueChange={v => setTeamForm(f => ({ ...f, managerId: v }))}>
                        <SelectTrigger><SelectValue placeholder="Assign a manager…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">No manager yet</SelectItem>
                          {users
                            .filter(u => u.isActive && u.role !== 'CUSTOMER' && u.role !== 'CARRIER')
                            .map(u => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.firstName} {u.lastName} — {ROLE_LABELS[u.role] ?? u.role}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-400">Selecting a manager will set their role to Team Manager and assign them to this team.</p>
                    </div>
                    {teamError && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{teamError}</p>}
                    <div className="flex justify-end gap-3 pt-2">
                      <Button variant="outline" onClick={() => setTeamOpen(false)}>Cancel</Button>
                      <Button onClick={handleSaveTeam} disabled={teamSaving}>{teamSaving ? 'Saving…' : editingTeam ? 'Save Changes' : 'Create Team'}</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {teamsFetching ? (
              <p className="text-sm text-gray-400 animate-pulse">Loading teams…</p>
            ) : teams.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No teams yet</p>
                <p className="text-sm text-gray-400 mt-1">Create a team to group users and scope their data visibility.</p>
                <Button className="mt-4" onClick={openCreateTeam}><PlusCircle className="h-4 w-4 mr-2" />Create First Team</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {teams.map(team => (
                  <div key={team.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

                    {/* Team header row */}
                    <div
                      className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => expandTeam(team)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                          <Users className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800 flex items-center gap-2">
                            {team.name}
                            {!team.isActive && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Inactive</span>}
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${team.repVisibility === 'team' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                              {team.repVisibility === 'team' ? 'Full team' : 'Own loads'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {team.manager
                              ? <><span className="font-medium text-gray-600">{team.manager.firstName} {team.manager.lastName}</span> · Team Manager</>
                              : <span className="italic">No manager assigned</span>}
                            {' · '}
                            {team._count.members} member{team._count.members !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openEditTeam(team)} className="text-gray-400 hover:text-blue-600 p-1.5 rounded hover:bg-blue-50 transition-colors" title="Edit team">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <span className="text-gray-300 text-xs">{expandedTeam?.id === team.id ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {/* Expanded member list */}
                    {expandedTeam?.id === team.id && (
                      <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Members</p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500 mr-1">Reps see:</span>
                            {(['own', 'team'] as const).map(v => (
                              <button
                                key={v}
                                onClick={() => handleSetRepVisibility(expandedTeam.id, v)}
                                disabled={updatingVisibility === expandedTeam.id}
                                className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${expandedTeam.repVisibility === v ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                              >
                                {v === 'own' ? 'Own loads only' : 'All team loads'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Add member row */}
                        <div className="flex gap-2 mb-4">
                          <Select value={addMemberUserId} onValueChange={setAddMemberUserId}>
                            <SelectTrigger className="flex-1 bg-white">
                              <SelectValue placeholder="Select user to add…" />
                            </SelectTrigger>
                            <SelectContent>
                              {unassignedUsers
                                .filter(u => !expandedTeam.members.some(m => m.id === u.id))
                                .map(u => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.firstName} {u.lastName} — {ROLE_LABELS[u.role] ?? u.role}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <Button size="sm" disabled={!addMemberUserId || addingMember} onClick={() => handleAddMember(team.id)}>
                            <UserPlus className="h-4 w-4 mr-1" />{addingMember ? 'Adding…' : 'Add'}
                          </Button>
                        </div>

                        {/* Member list */}
                        {expandedTeam.members.length === 0 ? (
                          <p className="text-sm text-gray-400 italic py-2">No members yet — add someone above.</p>
                        ) : (
                          <div className="space-y-1">
                            {expandedTeam.members.map(m => (
                              <div key={m.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600">
                                    {m.firstName[0]}{m.lastName[0]}
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium text-gray-800">{m.firstName} {m.lastName}</span>
                                    {!m.isActive && <span className="ml-2 text-xs text-gray-400">(inactive)</span>}
                                  </div>
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[m.role] || 'bg-gray-100 text-gray-700'}`}>
                                    {ROLE_LABELS[m.role] ?? m.role}
                                  </span>
                                </div>
                                {m.id !== team.manager?.id && (
                                  <button
                                    onClick={() => handleRemoveMember(team.id, m.id)}
                                    className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded"
                                    title="Remove from team"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </main>
    </>
  );
}
