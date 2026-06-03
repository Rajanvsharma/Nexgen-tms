'use client';

import { useEffect, useState } from 'react';
import { PlusCircle, FileText, ChevronRight, ArrowRight } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';

interface Quote {
  id: string;
  quoteNumber: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONVERTED';
  pickupCity: string;
  pickupState: string;
  deliveryCity: string;
  deliveryState: string;
  equipment: string;
  commodity: string | null;
  weight: number | null;
  pickupDate: string | null;
  rate: number;
  source: string | null;
  customer: { id: string; name: string };
  createdBy: { firstName: string; lastName: string };
  createdAt: string;
}

interface Customer { id: string; name: string; }

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  CONVERTED: 'bg-blue-100 text-blue-700',
};

const EQUIPMENT_OPTIONS = ['Dry Van', 'Reefer', 'Flatbed', 'Step Deck', 'RGN', 'Power Only', 'Box Truck'];

const EMPTY = {
  customerId: '', pickupCity: '', pickupState: '', deliveryCity: '', deliveryState: '',
  commodity: '', weight: '', equipment: 'Dry Van', pickupDate: '', deliveryDate: '', rate: '', specialInstructions: '',
};

export default function QuotesPage() {
  const { user } = useAuthStore();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [converting, setConverting] = useState<string | null>(null);

  async function loadData() {
    try {
      const [qRes, cRes] = await Promise.all([api.get('/quotes'), api.get('/customers')]);
      setQuotes(qRes.data);
      setCustomers(cRes.data.filter((c: Customer & { isActive: boolean }) => c.isActive));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleCreate() {
    if (!form.customerId || !form.pickupCity || !form.pickupState || !form.deliveryCity || !form.deliveryState || !form.equipment || !form.rate) {
      setError('Customer, origin, destination, equipment, and rate are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post('/quotes', {
        ...form,
        rate: parseFloat(form.rate),
        weight: form.weight ? parseFloat(form.weight) : undefined,
      });
      setOpen(false);
      setForm(EMPTY);
      await loadData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to create quote');
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    await api.patch(`/quotes/${id}/status`, { status });
    await loadData();
  }

  async function convertToLoad(id: string) {
    setConverting(id);
    try {
      await api.post(`/quotes/${id}/convert`);
      await loadData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || 'Failed to convert to load');
    } finally {
      setConverting(null);
    }
  }

  const isAdmin = user?.role === 'ADMIN';
  const filtered = quotes.filter((q) => statusFilter === 'ALL' || q.status === statusFilter);

  return (
    <>
      <Topbar title="Quotes" />
      <main className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Quotation Management</h3>
            <p className="text-sm text-gray-500">{quotes.length} total quote{quotes.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                {['PENDING', 'APPROVED', 'REJECTED', 'CONVERTED'].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { setForm(EMPTY); setError(''); }}>
                  <PlusCircle className="h-4 w-4 mr-2" />New Quote
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Create New Quote</DialogTitle></DialogHeader>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                  <div className="space-y-1">
                    <Label>Customer *</Label>
                    <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select customer…" /></SelectTrigger>
                      <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Pickup City *</Label>
                      <Input value={form.pickupCity} onChange={(e) => setForm({ ...form, pickupCity: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Pickup State *</Label>
                      <Input value={form.pickupState} onChange={(e) => setForm({ ...form, pickupState: e.target.value })} maxLength={2} placeholder="TX" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Delivery City *</Label>
                      <Input value={form.deliveryCity} onChange={(e) => setForm({ ...form, deliveryCity: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Delivery State *</Label>
                      <Input value={form.deliveryState} onChange={(e) => setForm({ ...form, deliveryState: e.target.value })} maxLength={2} placeholder="CA" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label>Equipment *</Label>
                      <Select value={form.equipment} onValueChange={(v) => setForm({ ...form, equipment: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{EQUIPMENT_OPTIONS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Commodity</Label>
                      <Input value={form.commodity} onChange={(e) => setForm({ ...form, commodity: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Weight (lbs)</Label>
                      <Input type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Pickup Date</Label>
                      <Input type="date" value={form.pickupDate} onChange={(e) => setForm({ ...form, pickupDate: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Delivery Date</Label>
                      <Input type="date" value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Rate ($) *</Label>
                    <Input type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="2500" />
                  </div>
                  <div className="space-y-1">
                    <Label>Special Instructions</Label>
                    <Input value={form.specialInstructions} onChange={(e) => setForm({ ...form, specialInstructions: e.target.value })} />
                  </div>
                  {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
                  <div className="flex justify-end gap-3 pt-2">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreate} disabled={saving}>{saving ? 'Creating…' : 'Create Quote'}</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <p className="p-6 text-sm text-gray-400 animate-pulse">Loading quotes…</p>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No quotes found.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Quote #', 'Customer', 'Route', 'Equipment', 'Rate', 'Pickup Date', 'Source', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((q) => (
                  <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-sm font-medium text-brand">{q.quoteNumber}</td>
                    <td className="px-4 py-3 text-gray-800">{q.customer.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <div className="flex items-center gap-1">
                        <span>{q.pickupCity}, {q.pickupState}</span>
                        <ChevronRight className="h-3 w-3 text-gray-400" />
                        <span>{q.deliveryCity}, {q.deliveryState}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{q.equipment}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">${q.rate.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500">{q.pickupDate ? new Date(q.pickupDate).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">
                      {q.source ? (
                        <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                          {q.source.startsWith('EMAIL:') ? 'Email' : q.source}
                        </span>
                      ) : (
                        <span className="text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full">Manual</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[q.status]}`}>{q.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isAdmin && q.status === 'PENDING' && (
                          <>
                            <button onClick={() => updateStatus(q.id, 'APPROVED')}
                              className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition-colors">
                              Approve
                            </button>
                            <button onClick={() => updateStatus(q.id, 'REJECTED')}
                              className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 transition-colors">
                              Reject
                            </button>
                          </>
                        )}
                        {q.status === 'APPROVED' && (
                          <button
                            onClick={() => convertToLoad(q.id)}
                            disabled={converting === q.id}
                            className="text-xs bg-brand text-white px-2 py-1 rounded hover:bg-brand-light transition-colors flex items-center gap-1 disabled:opacity-50"
                          >
                            <ArrowRight className="h-3 w-3" />
                            {converting === q.id ? 'Converting…' : 'To Load'}
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
