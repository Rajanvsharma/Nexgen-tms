'use client';

import { useEffect, useRef, useState } from 'react';
import { Truck, FileText, ChevronRight, Clock, Plus, Upload, X, CheckCircle } from 'lucide-react';
import api from '@/lib/api';

interface Load {
  id: string; loadNumber: string; status: string;
  pickupCity: string; pickupState: string; deliveryCity: string; deliveryState: string;
  equipment: string; pickupDate: string | null; deliveryDate: string | null;
  customerRate: number; carrier: { name: string; mcNumber: string } | null;
  driverName: string | null; driverPhone: string | null;
}
interface Invoice {
  id: string; invoiceNumber: string; amount: number; status: string;
  dueDate: string | null; paidDate: string | null; load: { loadNumber: string };
}
interface Quote {
  id: string; quoteNumber: string; status: string;
  pickupCity: string; pickupState: string; deliveryCity: string; deliveryState: string;
  equipment: string; rate: number; commodity: string | null; createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  CREATED: 'bg-gray-100 text-gray-600', DISPATCHED: 'bg-blue-100 text-blue-700',
  IN_TRANSIT: 'bg-yellow-100 text-yellow-700', DELIVERED: 'bg-green-100 text-green-700',
  INVOICED: 'bg-purple-100 text-purple-700', CANCELLED: 'bg-red-100 text-red-700',
  PENDING: 'bg-yellow-100 text-yellow-700', APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700', DRAFT: 'bg-gray-100 text-gray-600',
  SENT: 'bg-blue-100 text-blue-700', PAID: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
};

const EQUIPMENT = ['Dry Van', 'Reefer', 'Flatbed', 'Step Deck', 'RGN', 'Power Only', 'Box Truck'];

const EMPTY_QUOTE = {
  pickupCity: '', pickupState: '', deliveryCity: '', deliveryState: '',
  equipment: 'Dry Van', commodity: '', weight: '', rate: '',
  pickupDate: '', deliveryDate: '', specialInstructions: '',
};

export default function CustomerPortalPage() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [tab, setTab] = useState<'loads' | 'invoices' | 'quotes'>('loads');
  const [loading, setLoading] = useState(true);

  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteForm, setQuoteForm] = useState({ ...EMPTY_QUOTE });
  const [quoteSaving, setQuoteSaving] = useState(false);
  const [quoteError, setQuoteError] = useState('');

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ created: number; errors: { row: number; reason: string }[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function loadData() {
    setLoading(true);
    Promise.all([
      api.get('/loads'),
      api.get('/accounting/invoices').catch(() => ({ data: [] })),
      api.get('/quotes'),
    ]).then(([ld, inv, qt]) => {
      setLoads(ld.data.loads ?? ld.data);
      setInvoices(inv.data);
      setQuotes(qt.data);
    }).finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, []);

  async function handleSubmitQuote() {
    setQuoteError('');
    const { pickupCity, pickupState, deliveryCity, deliveryState, equipment, rate } = quoteForm;
    if (!pickupCity || !pickupState || !deliveryCity || !deliveryState || !equipment || !rate) {
      setQuoteError('Pickup city/state, delivery city/state, equipment and rate are required.');
      return;
    }
    setQuoteSaving(true);
    try {
      await api.post('/quotes', {
        pickupCity, pickupState, deliveryCity, deliveryState, equipment,
        commodity: quoteForm.commodity || undefined,
        weight: quoteForm.weight ? parseFloat(quoteForm.weight) : undefined,
        rate: parseFloat(rate),
        pickupDate: quoteForm.pickupDate || undefined,
        deliveryDate: quoteForm.deliveryDate || undefined,
        specialInstructions: quoteForm.specialInstructions || undefined,
      });
      setQuoteOpen(false);
      setQuoteForm({ ...EMPTY_QUOTE });
      loadData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setQuoteError(msg || 'Failed to submit quote');
    } finally {
      setQuoteSaving(false);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/quotes/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUploadResult(data);
      loadData();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setUploadResult({ created: 0, errors: [{ row: 0, reason: msg || 'Upload failed' }] });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const activeLoads = loads.filter(l => ['DISPATCHED', 'IN_TRANSIT'].includes(l.status)).length;
  const unpaidInvoices = invoices.filter(i => ['SENT', 'OVERDUE'].includes(i.status)).length;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-brand text-white px-6 py-5 shadow-sm">
        <h1 className="text-xl font-bold">Customer Portal</h1>
        <p className="text-blue-200 text-sm mt-0.5">Track your shipments, invoices, and quotes</p>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Shipments', value: loads.length, icon: Truck, color: 'bg-blue-50 text-blue-600' },
            { label: 'Active Loads', value: activeLoads, icon: Clock, color: 'bg-yellow-50 text-yellow-600' },
            { label: 'Unpaid Invoices', value: unpaidInvoices, icon: FileText, color: 'bg-red-50 text-red-600' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
              <div className={`p-3 rounded-lg ${card.color}`}><card.icon className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{card.value}</p>
                <p className="text-sm text-gray-500">{card.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Main panel */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Tab bar + action buttons */}
          <div className="flex items-center justify-between border-b border-gray-200 pr-4">
            <div className="flex">
              {[
                { key: 'loads', label: `Shipments (${loads.length})` },
                { key: 'invoices', label: `Invoices (${invoices.length})` },
                { key: 'quotes', label: `Quotes (${quotes.length})` },
              ].map(t => (
                <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
                  className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${tab === t.key ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            {tab === 'quotes' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setUploadOpen(true); setUploadResult(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" /> Upload Excel
                </button>
                <button
                  onClick={() => { setQuoteOpen(true); setQuoteError(''); setQuoteForm({ ...EMPTY_QUOTE }); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-brand text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                  <Plus className="h-3.5 w-3.5" /> New Quote
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <p className="p-6 text-sm text-gray-400 animate-pulse">Loading…</p>
          ) : tab === 'loads' ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Load #', 'Route', 'Equipment', 'Carrier', 'Driver', 'Pickup', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loads.length === 0
                  ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No shipments yet.</td></tr>
                  : loads.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-brand font-medium">{l.loadNumber}</td>
                      <td className="px-4 py-3 text-gray-600">
                        <div className="flex items-center gap-1 text-xs">
                          <span>{l.pickupCity}, {l.pickupState}</span>
                          <ChevronRight className="h-3 w-3" />
                          <span>{l.deliveryCity}, {l.deliveryState}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{l.equipment}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{l.carrier?.name || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{l.driverName || '—'}{l.driverPhone ? ` · ${l.driverPhone}` : ''}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{l.pickupDate ? new Date(l.pickupDate).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[l.status]}`}>{l.status}</span></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : tab === 'invoices' ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Invoice #', 'Load', 'Amount', 'Status', 'Due Date', 'Paid Date'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.length === 0
                  ? <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No invoices yet.</td></tr>
                  : invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-brand font-medium">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 text-gray-600">{inv.load.loadNumber}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">${inv.amount.toLocaleString()}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[inv.status]}`}>{inv.status}</span></td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{inv.paidDate ? new Date(inv.paidDate).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Quote #', 'Route', 'Equipment', 'Commodity', 'Rate', 'Status', 'Date'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quotes.length === 0
                  ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No quotes yet. Click <strong>New Quote</strong> to request one.</td></tr>
                  : quotes.map(q => (
                    <tr key={q.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-brand font-medium">{q.quoteNumber}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{q.pickupCity}, {q.pickupState} → {q.deliveryCity}, {q.deliveryState}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{q.equipment}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{q.commodity || '—'}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">${q.rate.toLocaleString()}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[q.status]}`}>{q.status}</span></td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(q.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── New Quote Modal ── */}
      {quoteOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Request a Quote</h2>
              <button onClick={() => setQuoteOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Pickup City *</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
                    value={quoteForm.pickupCity} onChange={e => setQuoteForm(f => ({ ...f, pickupCity: e.target.value }))} placeholder="Chicago" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Pickup State *</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
                    value={quoteForm.pickupState} onChange={e => setQuoteForm(f => ({ ...f, pickupState: e.target.value }))} placeholder="IL" maxLength={2} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Delivery City *</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
                    value={quoteForm.deliveryCity} onChange={e => setQuoteForm(f => ({ ...f, deliveryCity: e.target.value }))} placeholder="Dallas" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Delivery State *</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
                    value={quoteForm.deliveryState} onChange={e => setQuoteForm(f => ({ ...f, deliveryState: e.target.value }))} placeholder="TX" maxLength={2} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Equipment *</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand bg-white"
                    value={quoteForm.equipment} onChange={e => setQuoteForm(f => ({ ...f, equipment: e.target.value }))}>
                    {EQUIPMENT.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Target Rate ($) *</label>
                  <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
                    value={quoteForm.rate} onChange={e => setQuoteForm(f => ({ ...f, rate: e.target.value }))} placeholder="2500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Commodity</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
                    value={quoteForm.commodity} onChange={e => setQuoteForm(f => ({ ...f, commodity: e.target.value }))} placeholder="General Freight" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Weight (lbs)</label>
                  <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
                    value={quoteForm.weight} onChange={e => setQuoteForm(f => ({ ...f, weight: e.target.value }))} placeholder="42000" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Pickup Date</label>
                  <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
                    value={quoteForm.pickupDate} onChange={e => setQuoteForm(f => ({ ...f, pickupDate: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Delivery Date</label>
                  <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
                    value={quoteForm.deliveryDate} onChange={e => setQuoteForm(f => ({ ...f, deliveryDate: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Special Instructions</label>
                <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand resize-none"
                  value={quoteForm.specialInstructions} onChange={e => setQuoteForm(f => ({ ...f, specialInstructions: e.target.value }))} placeholder="Any special requirements…" />
              </div>

              {quoteError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{quoteError}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setQuoteOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                <button onClick={handleSubmitQuote} disabled={quoteSaving}
                  className="px-5 py-2 text-sm font-semibold bg-brand text-white rounded-lg hover:opacity-90 disabled:opacity-50">
                  {quoteSaving ? 'Submitting…' : 'Submit Quote'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Upload Excel Modal ── */}
      {uploadOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Upload Quotes via Excel</h2>
              <button onClick={() => setUploadOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {!uploadResult ? (
                <>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-700 mb-1">Drop your Excel file here</p>
                    <p className="text-xs text-gray-400 mb-3">Supports .xlsx and .xls — max 5 MB</p>
                    <input ref={fileRef} type="file" accept=".xlsx,.xls"
                      onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }}
                      className="hidden" />
                    <button onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="px-4 py-2 text-sm font-semibold bg-brand text-white rounded-lg hover:opacity-90 disabled:opacity-50">
                      {uploading ? 'Uploading…' : 'Choose File'}
                    </button>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
                    <p className="font-semibold text-gray-700 mb-1">Required column headers:</p>
                    <p><span className="font-medium">Pickup City, Pickup State, Delivery City, Delivery State, Equipment, Rate</span></p>
                    <p className="text-gray-400">Optional: Commodity, Weight, Pickup Date, Delivery Date, Special Instructions</p>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className={`flex items-center gap-3 p-4 rounded-xl ${uploadResult.created > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    <CheckCircle className={`h-6 w-6 ${uploadResult.created > 0 ? 'text-green-600' : 'text-red-400'}`} />
                    <div>
                      <p className={`font-semibold text-sm ${uploadResult.created > 0 ? 'text-green-800' : 'text-red-700'}`}>
                        {uploadResult.created} quote{uploadResult.created !== 1 ? 's' : ''} created
                      </p>
                      {uploadResult.errors.length > 0 && (
                        <p className="text-xs text-red-600 mt-0.5">{uploadResult.errors.length} row{uploadResult.errors.length !== 1 ? 's' : ''} skipped</p>
                      )}
                    </div>
                  </div>
                  {uploadResult.errors.length > 0 && (
                    <div className="bg-red-50 rounded-lg p-3 text-xs text-red-600 space-y-1 max-h-40 overflow-y-auto">
                      {uploadResult.errors.map((e, i) => (
                        <p key={i}>Row {e.row}: {e.reason}</p>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setUploadResult(null); if (fileRef.current) fileRef.current.value = ''; }}
                      className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Upload Another</button>
                    <button onClick={() => { setUploadOpen(false); setUploadResult(null); }}
                      className="px-4 py-2 text-sm font-semibold bg-brand text-white rounded-lg hover:opacity-90">Done</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
