'use client';

import { useEffect, useState } from 'react';
import { PlusCircle, Pencil, Truck, Phone, Mail, AlertTriangle } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';

interface Carrier {
  id: string;
  name: string;
  mcNumber: string;
  dotNumber: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  equipmentTypes: string[];
  insuranceExpiry: string | null;
  authorityExpiry: string | null;
  w9OnFile: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  _count: { loads: number; lanes: number };
}

const EQUIPMENT_OPTIONS = ['Dry Van', 'Reefer', 'Flatbed', 'Step Deck', 'RGN', 'Power Only', 'Box Truck', 'Sprinter'];
const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-600',
  SUSPENDED: 'bg-red-100 text-red-700',
};

const EMPTY = { name: '', mcNumber: '', dotNumber: '', email: '', phone: '', city: '', state: '', zipCode: '', insuranceExpiry: '', authorityExpiry: '', w9OnFile: false, status: 'ACTIVE', notes: '' };

export default function CarriersPage() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Carrier | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  async function load() {
    try {
      const { data } = await api.get('/carriers');
      setCarriers(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setEquipment([]);
    setError('');
    setOpen(true);
  }

  function openEdit(c: Carrier) {
    setEditing(c);
    setForm({
      name: c.name, mcNumber: c.mcNumber, dotNumber: c.dotNumber || '', email: c.email || '',
      phone: c.phone || '', city: c.city || '', state: c.state || '', zipCode: '',
      insuranceExpiry: c.insuranceExpiry ? c.insuranceExpiry.slice(0, 10) : '',
      authorityExpiry: c.authorityExpiry ? c.authorityExpiry.slice(0, 10) : '',
      w9OnFile: c.w9OnFile, status: c.status, notes: '',
    });
    setEquipment(c.equipmentTypes);
    setError('');
    setOpen(true);
  }

  function toggleEquipment(eq: string) {
    setEquipment((prev) => prev.includes(eq) ? prev.filter((e) => e !== eq) : [...prev, eq]);
  }

  async function handleSave() {
    if (!form.name || !form.mcNumber) { setError('Name and MC number are required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, equipmentTypes: equipment };
      if (editing) {
        await api.put(`/carriers/${editing.id}`, payload);
      } else {
        await api.post('/carriers', payload);
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

  function isExpiringSoon(dateStr: string | null) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const diff = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff < 30;
  }

  const filtered = carriers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.mcNumber.includes(search) ||
    c.dotNumber?.includes(search)
  );

  return (
    <>
      <Topbar title="Carrier Database" />
      <main className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Carrier Database</h3>
            <p className="text-sm text-gray-500">{carriers.length} carrier{carriers.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-3">
            <Input placeholder="Search by name, MC, DOT…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}><PlusCircle className="h-4 w-4 mr-2" />Add Carrier</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editing ? 'Edit Carrier' : 'Add New Carrier'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Carrier Name *</Label>
                      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>MC Number *</Label>
                      <Input value={form.mcNumber} onChange={(e) => setForm({ ...form, mcNumber: e.target.value })} disabled={!!editing} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>DOT Number</Label>
                      <Input value={form.dotNumber} onChange={(e) => setForm({ ...form, dotNumber: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Phone</Label>
                      <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1 col-span-1">
                      <Label>City</Label>
                      <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>State</Label>
                      <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} maxLength={2} />
                    </div>
                    <div className="space-y-1">
                      <Label>ZIP</Label>
                      <Input value={form.zipCode} onChange={(e) => setForm({ ...form, zipCode: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Insurance Expiry</Label>
                      <Input type="date" value={form.insuranceExpiry} onChange={(e) => setForm({ ...form, insuranceExpiry: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Authority Expiry</Label>
                      <Input type="date" value={form.authorityExpiry} onChange={(e) => setForm({ ...form, authorityExpiry: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Equipment Types</Label>
                    <div className="flex flex-wrap gap-2">
                      {EQUIPMENT_OPTIONS.map((eq) => (
                        <button
                          key={eq}
                          type="button"
                          onClick={() => toggleEquipment(eq)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${equipment.includes(eq) ? 'bg-brand text-white border-brand' : 'bg-white text-gray-600 border-gray-300 hover:border-brand'}`}
                        >
                          {eq}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Status</Label>
                      <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-3 pt-6">
                      <input type="checkbox" id="w9" checked={form.w9OnFile} onChange={(e) => setForm({ ...form, w9OnFile: e.target.checked })} className="h-4 w-4 rounded" />
                      <Label htmlFor="w9">W9 on File</Label>
                    </div>
                  </div>
                  {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
                  <div className="flex justify-end gap-3 pt-2">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Carrier'}</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <p className="p-6 text-sm text-gray-400 animate-pulse">Loading carriers…</p>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Truck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">{search ? 'No carriers match your search.' : 'No carriers yet. Add your first carrier.'}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Carrier', 'MC / DOT', 'Contact', 'Equipment', 'Insurance', 'Loads', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {c.name}
                      {c.w9OnFile && <span className="ml-2 text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">W9</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <div>MC: {c.mcNumber}</div>
                      {c.dotNumber && <div className="text-gray-400">DOT: {c.dotNumber}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {c.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</div>}
                      {c.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.equipmentTypes.slice(0, 2).map((eq) => (
                          <span key={eq} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{eq}</span>
                        ))}
                        {c.equipmentTypes.length > 2 && <span className="text-xs text-gray-400">+{c.equipmentTypes.length - 2}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {c.insuranceExpiry ? (
                        <div className={`flex items-center gap-1 text-xs ${isExpiringSoon(c.insuranceExpiry) ? 'text-red-600' : 'text-gray-600'}`}>
                          {isExpiringSoon(c.insuranceExpiry) && <AlertTriangle className="h-3 w-3" />}
                          {new Date(c.insuranceExpiry).toLocaleDateString()}
                        </div>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c._count.loads}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(c)} className="text-gray-400 hover:text-brand transition-colors"><Pencil className="h-4 w-4" /></button>
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
