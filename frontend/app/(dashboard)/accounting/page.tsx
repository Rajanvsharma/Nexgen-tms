'use client';

import { useEffect, useState } from 'react';
import { DollarSign, FileText, CreditCard, AlertTriangle, Send, ExternalLink } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { useRequireAuth } from '@/hooks/useAuth';

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  dueDate: string | null;
  paidDate: string | null;
  createdAt: string;
  load: { loadNumber: string };
  customer: { name: string };
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  dueDate: string | null;
  paidDate: string | null;
  createdAt: string;
  load: { loadNumber: string };
  carrier: { name: string; mcNumber: string };
}

const INV_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SENT: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  VOID: 'bg-gray-100 text-gray-400',
};

const PAY_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-400',
};

interface AgingBucket {
  current: AgingInvoice[];
  days30: AgingInvoice[];
  days60: AgingInvoice[];
  days90plus: AgingInvoice[];
}

interface AgingInvoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  dueDate: string | null;
  daysOverdue: number;
  load: { loadNumber: string };
  customer: { name: string };
}

export default function AccountingPage() {
  const { isLoading } = useRequireAuth();
  const [tab, setTab] = useState<'invoices' | 'payments' | 'aging'>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [aging, setAging] = useState<AgingBucket | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  async function loadData() {
    try {
      const [invRes, payRes, agingRes] = await Promise.all([
        api.get('/accounting/invoices'),
        api.get('/accounting/payments'),
        api.get('/reports/aging').catch(() => ({ data: null })),
      ]);
      setInvoices(invRes.data);
      setPayments(payRes.data);
      setAging(agingRes.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function markInvoicePaid(id: string) {
    await api.patch(`/accounting/invoices/${id}/status`, { status: 'PAID' });
    await loadData();
  }

  async function markPaymentPaid(id: string) {
    await api.patch(`/accounting/payments/${id}/status`, { status: 'PAID' });
    await loadData();
  }

  async function emailInvoice(id: string) {
    setSending(id);
    try {
      const { data } = await api.post(`/accounting/invoices/${id}/send`);
      showToast(data.simulated ? 'Invoice sent (simulated — configure SMTP to send real emails)' : data.message);
      await loadData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to send invoice';
      showToast(`Error: ${msg}`);
    } finally {
      setSending(null);
    }
  }

  async function exportToQuickBooks(id: string) {
    setExporting(id);
    try {
      const { data } = await api.post(`/quickbooks/invoices/${id}/export`);
      showToast(`Exported to QuickBooks: ${data.quickbooksId}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'QuickBooks export failed';
      showToast(`Error: ${msg}`);
    } finally {
      setExporting(null);
    }
  }

  const totalInvoiced = invoices.filter((i) => i.status !== 'VOID').reduce((s, i) => s + i.amount, 0);
  const totalPaidInv = invoices.filter((i) => i.status === 'PAID').reduce((s, i) => s + i.amount, 0);
  const totalOutstanding = invoices.filter((i) => ['SENT', 'OVERDUE'].includes(i.status)).reduce((s, i) => s + i.amount, 0);
  const totalPayments = payments.filter((p) => p.status !== 'CANCELLED').reduce((s, p) => s + p.amount, 0);

  if (isLoading) return null;

  return (
    <>
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded-lg shadow-lg max-w-sm">
          {toast}
        </div>
      )}
      <Topbar title="Accounting & Billing" />
      <main className="flex-1 overflow-auto p-6 space-y-6">

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Invoiced', value: `$${totalInvoiced.toLocaleString()}`, icon: FileText, color: 'bg-blue-50 text-blue-600' },
            { label: 'Collected', value: `$${totalPaidInv.toLocaleString()}`, icon: DollarSign, color: 'bg-green-50 text-green-600' },
            { label: 'Outstanding', value: `$${totalOutstanding.toLocaleString()}`, icon: DollarSign, color: 'bg-yellow-50 text-yellow-600' },
            { label: 'Carrier Payables', value: `$${totalPayments.toLocaleString()}`, icon: CreditCard, color: 'bg-purple-50 text-purple-600' },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
              <div className={`p-3 rounded-lg ${card.color}`}><card.icon className="h-5 w-5" /></div>
              <div>
                <p className="text-xl font-bold text-gray-800">{card.value}</p>
                <p className="text-sm text-gray-500">{card.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-200">
            {[
              { key: 'invoices', label: `Customer Invoices (${invoices.length})` },
              { key: 'payments', label: `Carrier Payments (${payments.length})` },
              { key: 'aging', label: 'Aging Report' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as 'invoices' | 'payments' | 'aging')}
                className={`px-6 py-3 text-sm font-medium capitalize transition-colors border-b-2 ${tab === t.key ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="p-6 text-sm text-gray-400 animate-pulse">Loading…</p>
          ) : tab === 'aging' ? (
            <div className="p-6 space-y-6">
              {!aging ? (
                <p className="text-gray-400 text-sm">Aging data unavailable (requires ADMIN or ACCOUNTING role).</p>
              ) : (
                <>
                  {/* Aging summary */}
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: 'Current', bucket: aging.current, color: 'bg-green-50 text-green-700 border-green-200' },
                      { label: '1-30 Days Overdue', bucket: aging.days30, color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
                      { label: '31-60 Days', bucket: aging.days60, color: 'bg-orange-50 text-orange-700 border-orange-200' },
                      { label: '60+ Days', bucket: aging.days90plus, color: 'bg-red-50 text-red-700 border-red-200' },
                    ].map((b) => (
                      <div key={b.label} className={`rounded-xl border p-4 ${b.color}`}>
                        <p className="text-xs font-semibold uppercase tracking-wide">{b.label}</p>
                        <p className="text-2xl font-bold mt-1">{b.bucket.length}</p>
                        <p className="text-sm mt-0.5">${b.bucket.reduce((s, i) => s + i.amount, 0).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                  {[
                    { label: '60+ Days Overdue', bucket: aging.days90plus, color: 'border-red-200' },
                    { label: '31-60 Days Overdue', bucket: aging.days60, color: 'border-orange-200' },
                    { label: '1-30 Days Overdue', bucket: aging.days30, color: 'border-yellow-200' },
                    { label: 'Current', bucket: aging.current, color: 'border-green-200' },
                  ].filter((b) => b.bucket.length > 0).map((b) => (
                    <div key={b.label}>
                      <h5 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />{b.label} ({b.bucket.length})
                      </h5>
                      <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            {['Invoice #', 'Load', 'Customer', 'Amount', 'Due Date', 'Days Overdue'].map((h) => (
                              <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {b.bucket.map((inv) => (
                            <tr key={inv.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2 font-mono text-brand">{inv.invoiceNumber}</td>
                              <td className="px-4 py-2 text-gray-600">{inv.load.loadNumber}</td>
                              <td className="px-4 py-2 text-gray-800">{inv.customer.name}</td>
                              <td className="px-4 py-2 font-medium">${inv.amount.toLocaleString()}</td>
                              <td className="px-4 py-2 text-gray-500">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}</td>
                              <td className={`px-4 py-2 font-semibold ${inv.daysOverdue > 60 ? 'text-red-600' : inv.daysOverdue > 30 ? 'text-orange-600' : inv.daysOverdue > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                                {inv.daysOverdue > 0 ? `${inv.daysOverdue}d` : 'Current'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </>
              )}
            </div>
          ) : tab === 'invoices' ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Invoice #', 'Load', 'Customer', 'Amount', 'Status', 'Due Date', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">No invoices yet.</td></tr>
                ) : invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-brand font-medium">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-gray-600">{inv.load.loadNumber}</td>
                    <td className="px-4 py-3 text-gray-800">{inv.customer.name}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">${inv.amount.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${INV_STATUS_COLORS[inv.status]}`}>{inv.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        {['DRAFT', 'SENT', 'OVERDUE'].includes(inv.status) && (
                          <Button size="sm" variant="outline" disabled={sending === inv.id} onClick={() => emailInvoice(inv.id)}>
                            <Send className="h-3 w-3 mr-1" />{sending === inv.id ? 'Sending…' : 'Email'}
                          </Button>
                        )}
                        {['SENT', 'OVERDUE'].includes(inv.status) && (
                          <Button size="sm" onClick={() => markInvoicePaid(inv.id)}>Mark Paid</Button>
                        )}
                        <Button size="sm" variant="outline" disabled={exporting === inv.id} onClick={() => exportToQuickBooks(inv.id)}>
                          <ExternalLink className="h-3 w-3 mr-1" />{exporting === inv.id ? '…' : 'QB'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Load', 'Carrier', 'Amount', 'Status', 'Due Date', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">No carrier payments yet.</td></tr>
                ) : payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-brand font-medium">{p.load.loadNumber}</td>
                    <td className="px-4 py-3 text-gray-800">{p.carrier.name} <span className="text-gray-400 text-xs">MC: {p.carrier.mcNumber}</span></td>
                    <td className="px-4 py-3 font-medium text-gray-800">${p.amount.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAY_STATUS_COLORS[p.status]}`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{p.dueDate ? new Date(p.dueDate).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">
                      {p.status === 'PENDING' && (
                        <Button size="sm" onClick={() => markPaymentPaid(p.id)}>Mark Paid</Button>
                      )}
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
