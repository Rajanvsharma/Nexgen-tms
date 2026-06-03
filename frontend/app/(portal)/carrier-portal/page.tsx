'use client';

import { useEffect, useState } from 'react';
import { Truck, ChevronRight, CheckCircle, Clock, DollarSign } from 'lucide-react';
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
  carrierRate: number | null;
  driverName: string | null;
  driverPhone: string | null;
  customer: { name: string };
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  dueDate: string | null;
  paidDate: string | null;
  load: { loadNumber: string };
}

const STATUS_COLORS: Record<string, string> = {
  CREATED: 'bg-gray-100 text-gray-600',
  DISPATCHED: 'bg-blue-100 text-blue-700',
  IN_TRANSIT: 'bg-yellow-100 text-yellow-700',
  DELIVERED: 'bg-green-100 text-green-700',
  INVOICED: 'bg-purple-100 text-purple-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-400',
};

export default function CarrierPortalPage() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tab, setTab] = useState<'loads' | 'payments'>('loads');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/loads'),
      api.get('/accounting/payments').catch(() => ({ data: [] })),
    ]).then(([ld, pay]) => {
      setLoads(ld.data.filter((l: Load) => l.status !== 'CREATED'));
      setPayments(pay.data);
    }).finally(() => setLoading(false));
  }, []);

  const activeLoads = loads.filter((l) => ['DISPATCHED', 'IN_TRANSIT'].includes(l.status)).length;
  const pendingPayments = payments.filter((p) => p.status === 'PENDING').length;
  const totalEarnings = payments.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amount, 0);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-brand text-white px-6 py-5 shadow-sm">
        <h1 className="text-xl font-bold">NexGen TMS — Carrier Portal</h1>
        <p className="text-blue-200 text-sm mt-0.5">View your assigned loads and payment status</p>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Active Loads', value: activeLoads, icon: Truck, color: 'bg-yellow-50 text-yellow-600' },
            { label: 'Pending Payments', value: pendingPayments, icon: Clock, color: 'bg-orange-50 text-orange-600' },
            { label: 'Total Earned', value: `$${totalEarnings.toLocaleString()}`, icon: DollarSign, color: 'bg-green-50 text-green-600' },
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

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-200">
            {[{ key: 'loads', label: `Loads (${loads.length})` }, { key: 'payments', label: `Payments (${payments.length})` }].map((t) => (
              <button key={t.key} onClick={() => setTab(t.key as 'loads' | 'payments')}
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
                <tr>{['Load #', 'Customer', 'Route', 'Equipment', 'Driver', 'Pickup Date', 'Rate', 'Status'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loads.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No assigned loads found.</td></tr> : loads.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-brand font-medium">{l.loadNumber}</td>
                    <td className="px-4 py-3 text-gray-800 text-xs">{l.customer.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <div className="flex items-center gap-1 text-xs">
                        <span>{l.pickupCity}, {l.pickupState}</span>
                        <ChevronRight className="h-3 w-3" />
                        <span>{l.deliveryCity}, {l.deliveryState}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{l.equipment}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{l.driverName || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{l.pickupDate ? new Date(l.pickupDate).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{l.carrierRate ? `$${l.carrierRate.toLocaleString()}` : '—'}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[l.status]}`}>{l.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Load #', 'Amount', 'Status', 'Due Date', 'Paid Date'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No payment records found.</td></tr> : payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-brand font-medium">{p.load.loadNumber}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">${p.amount.toLocaleString()}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status]}`}>{p.status}</span></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{p.dueDate ? new Date(p.dueDate).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{p.paidDate ? new Date(p.paidDate).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <strong>POD Upload:</strong> To submit Proof of Delivery or invoices, please contact your broker directly or email documents to the address on your rate confirmation.
        </div>
      </div>
    </main>
  );
}
