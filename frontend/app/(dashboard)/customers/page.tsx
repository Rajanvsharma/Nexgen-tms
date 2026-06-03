'use client';

import { useEffect, useState } from 'react';
import { PlusCircle, Pencil, Building2, Phone, Mail, ToggleLeft, ToggleRight } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import api from '@/lib/api';

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  creditTerms: number;
  isActive: boolean;
  createdAt: string;
  _count: { loads: number; quotes: number };
}

const EMPTY = { name: '', email: '', phone: '', address: '', city: '', state: '', zipCode: '', creditTerms: '30', notes: '' };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  async function load() {
    try {
      const { data } = await api.get('/customers');
      setCustomers(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setError('');
    setOpen(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({ name: c.name, email: c.email || '', phone: c.phone || '', address: '', city: c.city || '', state: c.state || '', zipCode: '', creditTerms: String(c.creditTerms), notes: '' });
    setError('');
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name) { setError('Company name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, creditTerms: parseInt(form.creditTerms) || 30 };
      if (editing) {
        await api.put(`/customers/${editing.id}`, payload);
      } else {
        await api.post('/customers', payload);
      }
      setOpen(false);
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(c: Customer) {
    await api.put(`/customers/${c.id}`, { isActive: !c.isActive });
    await load();
  }

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  return (
    <>
      <Topbar title="Customers" />
      <main className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Customer Accounts</h3>
            <p className="text-sm text-gray-500">{customers.length} customer{customers.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-3">
            <Input placeholder="Search customers…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}><PlusCircle className="h-4 w-4 mr-2" />Add Customer</Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>{editing ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label>Company Name *</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ACME Shipping Co." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Email</Label>
                      <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Phone</Label>
                      <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Address</Label>
                    <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1 col-span-1">
                      <Label>City</Label>
                      <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>State</Label>
                      <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="TX" maxLength={2} />
                    </div>
                    <div className="space-y-1">
                      <Label>ZIP</Label>
                      <Input value={form.zipCode} onChange={(e) => setForm({ ...form, zipCode: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Credit Terms (days)</Label>
                    <Input type="number" value={form.creditTerms} onChange={(e) => setForm({ ...form, creditTerms: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Notes</Label>
                    <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  </div>
                  {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
                  <div className="flex justify-end gap-3 pt-2">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Customer'}</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <p className="p-6 text-sm text-gray-400 animate-pulse">Loading customers…</p>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">{search ? 'No customers match your search.' : 'No customers yet. Add your first customer.'}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Company', 'Contact', 'Location', 'Credit Terms', 'Loads / Quotes', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                    <td className="px-4 py-3 text-gray-500">
                      <div className="flex flex-col gap-0.5">
                        {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                        {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{[c.city, c.state].filter(Boolean).join(', ') || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">Net {c.creditTerms}</td>
                    <td className="px-4 py-3 text-gray-600">{c._count.loads} / {c._count.quotes}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {c.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(c)} className="text-gray-400 hover:text-brand transition-colors"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => toggleActive(c)} className="text-gray-400 hover:text-orange-500 transition-colors" title={c.isActive ? 'Deactivate' : 'Activate'}>
                          {c.isActive ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4" />}
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
