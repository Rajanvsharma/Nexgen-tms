'use client';

import { useEffect, useState } from 'react';
import { Truck, FileText, ChevronRight, CheckCircle, Clock } from 'lucide-react';
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
  deliveryDate: string | null;
  customerRate: number;
  carrier: { name: string; mcNumber: string } | null;
  driverName: string | null;
  driverPhone: string | null;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  dueDate: string | null;
  paidDate: string | null;
  load: { loadNumber: string };
}

interface Quote {
  id: string;
  quoteNumber: string;
  status: string;
  pickupCity: string;
  pickupState: string;
  deliveryCity: string;
  deliveryState: string;
  equipment: string;
  rate: number;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  CREATED: 'bg-gray-100 text-gray-600',
  DISPATCHED: 'bg-blue-100 text-blue-700',
  IN_TRANSIT: 'bg-yellow-100 text-yellow-700',
  DELIVERED: 'bg-green-100 text-green-700',
  INVOICED: 'bg-purple-100 text-purple-700',
  CANCELLED: 'bg-red-100 text-red-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  DRAFT: 'bg-gray-100 text-gray-600',
  SENT: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
};

export default function CustomerPortalPage() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [tab, setTab] = useState<'loads' | 'invoices' | 'quotes'>('loads');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/loads'), api.get('/accounting/invoices').catch(() => ({ data: [] })), api.get('/quotes')])
      .then(([ld, inv, qt]) => {
        setLoads(ld.data);
        setInvoices(inv.data);
        setQuotes(qt.data);
      }).finally(() => setLoading(false));
  }, []);

  const activeLoads = loads.filter((l) => ['DISPATCHED', 'IN_TRANSIT'].includes(l.status)).length;
  const unpaidInvoices = invoices.filter((i) => ['SENT', 'OVERDUE'].includes(i.status)).length;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-brand text-white px-6 py-5 shadow-sm">
        <h1 className="text-xl font-bold">NexGen TMS — Customer Portal</h1>
        <p className="text-blue-200 text-sm mt-0.5">Track your shipments, invoices, and quotes</p>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Shipments', value: loads.length, icon: Truck, color: 'bg-blue-50 text-blue-600' },
            { label: 'Active Loads', value: activeLoads, icon: Clock, color: 'bg-yellow-50 text-yellow-600' },
            { label: 'Unpaid Invoices', value: unpaidInvoices, icon: FileText, color: 'bg-red-50 text-red-600' },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
              <div className={`p-3 rounded-lg ${card.color}`}><card.icon className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{card.value}</p>
                <p className="text-sm text-gray-500">{card.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-200">
            {[{ key: 'loads', label: `Shipments (${loads.length})` }, { key: 'invoices', label: `Invoices (${invoices.length})` }, { key: 'quotes', label: `Quotes (${quotes.length})` }].map((t) => (
              <button key={t.key} onClick={() => setTab(t.key as 'loads' | 'invoices' | 'quotes')}
                className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${tab === t.key ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="p-6 text-sm text-gray-400 animate-pulse">Loading…</p>
          ) : tab === 'loads' ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Load #', 'Route', 'Equipment', 'Carrier', 'Driver', 'Pickup', 'Status'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loads.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No shipments found.</td></tr> : loads.map((l) => (
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
                <tr>{['Invoice #', 'Load', 'Amount', 'Status', 'Due Date', 'Paid Date'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No invoices found.</td></tr> : invoices.map((inv) => (
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
                <tr>{['Quote #', 'Route', 'Equipment', 'Rate', 'Status', 'Date'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quotes.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No quotes found.</td></tr> : quotes.map((q) => (
                  <tr key={q.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-brand font-medium">{q.quoteNumber}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{q.pickupCity}, {q.pickupState} → {q.deliveryCity}, {q.deliveryState}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{q.equipment}</td>
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
    </main>
  );
}
