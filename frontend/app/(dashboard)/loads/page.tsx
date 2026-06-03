'use client';

import { useEffect, useState } from 'react';
import { PlusCircle, Truck, ChevronRight, UserCircle, AlertTriangle } from 'lucide-react';
import { NotesPanel } from '@/components/ui/notes-panel';
import Topbar from '@/components/layout/Topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  pickupDate: string | null;
  customerRate: number;
  carrierRate: number | null;
  margin: number | null;
  isDuplicate: boolean;
  driverName: string | null;
  driverPhone: string | null;
  customer: { id: string; name: string };
  carrier: { id: string; name: string; mcNumber: string } | null;
  createdAt: string;
}

interface Customer { id: string; name: string; }
interface Carrier { id: string; name: string; mcNumber: string; }

const STATUS_COLORS: Record<string, string> = {
  CREATED: 'bg-gray-100 text-gray-700',
  DISPATCHED: 'bg-blue-100 text-blue-700',
  IN_TRANSIT: 'bg-yellow-100 text-yellow-700',
  DELIVERED: 'bg-green-100 text-green-700',
  INVOICED: 'bg-purple-100 text-purple-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const EQUIPMENT_OPTIONS = ['Dry Van', 'Reefer', 'Flatbed', 'Step Deck', 'RGN', 'Power Only', 'Box Truck'];
const LOAD_STATUSES = ['CREATED', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'INVOICED', 'CANCELLED'];
const EMPTY_FORM = { customerId: '', pickupCity: '', pickupState: '', deliveryCity: '', deliveryState: '', commodity: '', weight: '', equipment: 'Dry Van', pickupDate: '', deliveryDate: '', customerRate: '', carrierRate: '', specialInstructions: '' };

export default function LoadsPage() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [selectedLoad, setSelectedLoad] = useState<Load | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [dispatchForm, setDispatchForm] = useState({ carrierId: '', carrierRate: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [detailLoad, setDetailLoad] = useState<Load | null>(null);
  const [driverForm, setDriverForm] = useState({ driverName: '', driverPhone: '' });
  const [savingDriver, setSavingDriver] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{ loadNumber: string; status: string }[]>([]);

  async function loadData() {
    try {
      const [loadsRes, custRes, carrRes] = await Promise.all([
        api.get('/loads'),
        api.get('/customers'),
        api.get('/carriers'),
      ]);
      setLoads(loadsRes.data);
      setCustomers(custRes.data.filter((c: Customer & { isActive: boolean }) => c.isActive));
      setCarriers(carrRes.data.filter((c: Carrier & { status: string }) => c.status === 'ACTIVE'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleCreate() {
    if (!form.customerId || !form.pickupCity || !form.deliveryCity || !form.customerRate) {
      setError('Customer, pickup/delivery cities, and customer rate are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post('/loads', { ...form, customerRate: parseFloat(form.customerRate), carrierRate: form.carrierRate ? parseFloat(form.carrierRate) : undefined, weight: form.weight ? parseFloat(form.weight) : undefined });
      setOpen(false);
      setForm(EMPTY_FORM);
      await loadData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to create load');
    } finally {
      setSaving(false);
    }
  }

  async function handleDispatch() {
    if (!dispatchForm.carrierId || !dispatchForm.carrierRate) {
      setError('Carrier and carrier rate are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post(`/loads/${selectedLoad!.id}/dispatch`, { carrierId: dispatchForm.carrierId, carrierRate: parseFloat(dispatchForm.carrierRate) });
      setDispatchOpen(false);
      await loadData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to dispatch');
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(load: Load, status: string) {
    await api.put(`/loads/${load.id}`, { status });
    await loadData();
  }

  async function checkDuplicate() {
    if (!form.customerId || !form.pickupCity || !form.deliveryCity) return;
    try {
      const { data } = await api.get('/loads/check-duplicate', { params: { customerId: form.customerId, pickupCity: form.pickupCity, pickupState: form.pickupState, deliveryCity: form.deliveryCity, deliveryState: form.deliveryState, pickupDate: form.pickupDate } });
      setDuplicateWarning(data.matches || []);
    } catch { setDuplicateWarning([]); }
  }

  function openDetail(load: Load) {
    setDetailLoad(load);
    setDriverForm({ driverName: load.driverName || '', driverPhone: load.driverPhone || '' });
  }

  async function saveDriver() {
    if (!detailLoad) return;
    setSavingDriver(true);
    try {
      await api.put(`/loads/${detailLoad.id}`, driverForm);
      await loadData();
      setDetailLoad((prev) => prev ? { ...prev, ...driverForm } : prev);
    } finally { setSavingDriver(false); }
  }

  const filtered = loads.filter((l) => statusFilter === 'ALL' || l.status === statusFilter);

  return (
    <>
      <Topbar title="Loads" />
      <main className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Load Management</h3>
            <p className="text-sm text-gray-500">{loads.length} total loads</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                {LOAD_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { setForm(EMPTY_FORM); setError(''); }}>
                  <PlusCircle className="h-4 w-4 mr-2" />Create Load
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Create New Load</DialogTitle></DialogHeader>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                  <div className="space-y-1">
                    <Label>Customer *</Label>
                    <Select value={form.customerId} onValueChange={(v) => { setForm({ ...form, customerId: v }); setDuplicateWarning([]); }}>
                      <SelectTrigger><SelectValue placeholder="Select customer…" /></SelectTrigger>
                      <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Pickup City *</Label>
                      <Input value={form.pickupCity} onChange={(e) => setForm({ ...form, pickupCity: e.target.value })} onBlur={checkDuplicate} />
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Customer Rate ($) *</Label>
                      <Input type="number" value={form.customerRate} onChange={(e) => setForm({ ...form, customerRate: e.target.value })} placeholder="2500" />
                    </div>
                    <div className="space-y-1">
                      <Label>Carrier Rate ($)</Label>
                      <Input type="number" value={form.carrierRate} onChange={(e) => setForm({ ...form, carrierRate: e.target.value })} placeholder="2200" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Special Instructions</Label>
                    <Input value={form.specialInstructions} onChange={(e) => setForm({ ...form, specialInstructions: e.target.value })} />
                  </div>
                  {duplicateWarning.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded px-3 py-2 text-sm text-yellow-800">
                      <div className="flex items-center gap-2 font-medium mb-1"><AlertTriangle className="h-4 w-4" />Possible duplicate load detected</div>
                      {duplicateWarning.map((d) => <p key={d.loadNumber} className="text-xs">• {d.loadNumber} ({d.status})</p>)}
                    </div>
                  )}
                  {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
                  <div className="flex justify-end gap-3 pt-2">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreate} disabled={saving}>{saving ? 'Creating…' : 'Create Load'}</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Dispatch Modal */}
        <Dialog open={dispatchOpen} onOpenChange={setDispatchOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Dispatch Load {selectedLoad?.loadNumber}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Assign Carrier *</Label>
                <Select value={dispatchForm.carrierId} onValueChange={(v) => setDispatchForm({ ...dispatchForm, carrierId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select carrier…" /></SelectTrigger>
                  <SelectContent>{carriers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} (MC: {c.mcNumber})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Carrier Rate ($) *</Label>
                <Input type="number" value={dispatchForm.carrierRate} onChange={(e) => setDispatchForm({ ...dispatchForm, carrierRate: e.target.value })} />
              </div>
              {selectedLoad && dispatchForm.carrierRate && (
                <div className="bg-blue-50 rounded-lg p-3 text-sm">
                  <p className="text-gray-600">Customer Rate: <strong>${selectedLoad.customerRate.toLocaleString()}</strong></p>
                  <p className="text-gray-600">Carrier Rate: <strong>${parseFloat(dispatchForm.carrierRate).toLocaleString()}</strong></p>
                  <p className="text-brand font-semibold">Margin: {((selectedLoad.customerRate - parseFloat(dispatchForm.carrierRate)) / selectedLoad.customerRate * 100).toFixed(1)}%</p>
                </div>
              )}
              {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDispatchOpen(false)}>Cancel</Button>
                <Button onClick={handleDispatch} disabled={saving}>{saving ? 'Dispatching…' : 'Dispatch'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <p className="p-6 text-sm text-gray-400 animate-pulse">Loading loads…</p>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Truck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No loads found.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Load #', 'Customer', 'Route', 'Equipment', 'Carrier', 'Rate / Margin', 'Pickup', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-sm font-medium text-brand">
                      {l.loadNumber}
                      {l.isDuplicate && <span className="ml-1 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">DUP</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-800">{l.customer.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <div className="flex items-center gap-1">
                        <span>{l.pickupCity}, {l.pickupState}</span>
                        <ChevronRight className="h-3 w-3 text-gray-400" />
                        <span>{l.deliveryCity}, {l.deliveryState}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{l.equipment}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <div>{l.carrier ? l.carrier.name : <span className="text-gray-400 italic">Unassigned</span>}</div>
                      {l.driverName && <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><UserCircle className="h-3 w-3" />{l.driverName}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-800 font-medium">${l.customerRate.toLocaleString()}</div>
                      {l.margin !== null && (
                        <div className={`text-xs ${l.margin >= 15 ? 'text-green-600' : l.margin >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {l.margin}% margin
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{l.pickupDate ? new Date(l.pickupDate).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[l.status] || 'bg-gray-100 text-gray-700'}`}>{l.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {l.status === 'CREATED' && (
                          <button onClick={() => { setSelectedLoad(l); setDispatchForm({ carrierId: '', carrierRate: '' }); setError(''); setDispatchOpen(true); }}
                            className="text-xs bg-brand text-white px-2 py-1 rounded hover:bg-brand-light transition-colors">
                            Dispatch
                          </button>
                        )}
                        {l.status === 'DISPATCHED' && (
                          <button onClick={() => updateStatus(l, 'IN_TRANSIT')} className="text-xs bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600 transition-colors">
                            In Transit
                          </button>
                        )}
                        {l.status === 'IN_TRANSIT' && (
                          <button onClick={() => updateStatus(l, 'DELIVERED')} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition-colors">
                            Delivered
                          </button>
                        )}
                        <button onClick={() => openDetail(l)} className="text-xs text-gray-500 border border-gray-300 px-2 py-1 rounded hover:bg-gray-100 transition-colors">
                          Detail
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Load Detail Dialog */}
        {detailLoad && (
          <Dialog open={!!detailLoad} onOpenChange={() => setDetailLoad(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Load Detail — {detailLoad.loadNumber}</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Customer:</span> <span className="font-medium">{detailLoad.customer.name}</span></div>
                  <div><span className="text-gray-500">Status:</span> <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[detailLoad.status]}`}>{detailLoad.status}</span></div>
                  <div><span className="text-gray-500">Route:</span> <span className="font-medium">{detailLoad.pickupCity}, {detailLoad.pickupState} → {detailLoad.deliveryCity}, {detailLoad.deliveryState}</span></div>
                  <div><span className="text-gray-500">Equipment:</span> <span className="font-medium">{detailLoad.equipment}</span></div>
                  <div><span className="text-gray-500">Carrier Rate:</span> <span className="font-medium">{detailLoad.carrierRate ? `$${detailLoad.carrierRate.toLocaleString()}` : '—'}</span></div>
                  <div><span className="text-gray-500">Margin:</span> <span className="font-medium">{detailLoad.margin !== null ? `${detailLoad.margin}%` : '—'}</span></div>
                </div>

                {/* Driver Assignment */}
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <UserCircle className="h-4 w-4 text-brand" />Driver Assignment
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Driver Name</Label>
                      <Input value={driverForm.driverName} onChange={(e) => setDriverForm({ ...driverForm, driverName: e.target.value })} placeholder="John Smith" />
                    </div>
                    <div className="space-y-1">
                      <Label>Driver Phone</Label>
                      <Input value={driverForm.driverPhone} onChange={(e) => setDriverForm({ ...driverForm, driverPhone: e.target.value })} placeholder="(555) 000-0000" />
                    </div>
                  </div>
                  <div className="flex justify-end mt-3">
                    <Button size="sm" onClick={saveDriver} disabled={savingDriver}>{savingDriver ? 'Saving…' : 'Save Driver'}</Button>
                  </div>
                </div>

                {/* Notes */}
                <div className="border-t border-gray-100 pt-4">
                  <NotesPanel loadId={detailLoad.id} />
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </main>
    </>
  );
}
