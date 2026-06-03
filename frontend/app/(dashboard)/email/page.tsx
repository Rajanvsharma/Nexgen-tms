'use client';

import { useEffect, useState } from 'react';
import { Mail, Settings, RefreshCw, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';

interface EmailConfig {
  id: string;
  host: string;
  port: number;
  username: string;
  password: string;
  folder: string;
  isActive: boolean;
  lastChecked: string | null;
}

interface EmailLog {
  id: string;
  subject: string;
  fromEmail: string;
  fromName: string | null;
  receivedAt: string;
  bodyText: string;
  parsedData: {
    pickupCity: string | null;
    pickupState: string | null;
    deliveryCity: string | null;
    deliveryState: string | null;
    commodity: string | null;
    weight: number | null;
    equipment: string | null;
    pickupDate: string | null;
    deliveryDate: string | null;
    rate: number | null;
  } | null;
  status: 'PENDING' | 'PARSED' | 'QUOTE_CREATED' | 'SKIPPED' | 'FAILED';
}

interface Customer { id: string; name: string; }

const EQUIPMENT_OPTIONS = ['Dry Van', 'Reefer', 'Flatbed', 'Step Deck', 'RGN', 'Power Only', 'Box Truck'];

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  PARSED: 'bg-blue-100 text-blue-700',
  QUOTE_CREATED: 'bg-green-100 text-green-700',
  SKIPPED: 'bg-gray-100 text-gray-400',
  FAILED: 'bg-red-100 text-red-700',
};

const EMPTY_CONFIG = { host: '', port: '993', username: '', password: '', folder: 'INBOX', isActive: true };

export default function EmailPage() {
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);
  const [configForm, setConfigForm] = useState(EMPTY_CONFIG);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configError, setConfigError] = useState('');
  const [polling, setPolling] = useState(false);
  const [pollMessage, setPollMessage] = useState('');
  const [reviewLog, setReviewLog] = useState<EmailLog | null>(null);
  const [quoteForm, setQuoteForm] = useState({
    customerId: '', pickupCity: '', pickupState: '', deliveryCity: '', deliveryState: '',
    commodity: '', weight: '', equipment: 'Dry Van', pickupDate: '', deliveryDate: '', rate: '', specialInstructions: '',
  });
  const [quoteError, setQuoteError] = useState('');
  const [savingQuote, setSavingQuote] = useState(false);

  async function loadData() {
    try {
      const [cfgRes, logsRes, custRes] = await Promise.all([
        api.get('/email/config').catch(() => ({ data: null })),
        api.get('/email/logs'),
        api.get('/customers'),
      ]);
      setConfig(cfgRes.data);
      setLogs(logsRes.data);
      setCustomers(custRes.data.filter((c: Customer & { isActive: boolean }) => c.isActive));
    } finally {
      setLoadingLogs(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  function openConfig() {
    if (config) {
      setConfigForm({
        host: config.host, port: String(config.port), username: config.username,
        password: '••••••••', folder: config.folder, isActive: config.isActive,
      });
    } else {
      setConfigForm(EMPTY_CONFIG);
    }
    setConfigError('');
    setConfigOpen(true);
  }

  async function saveConfig() {
    if (!configForm.host || !configForm.username || !configForm.password) {
      setConfigError('Host, username, and password are required');
      return;
    }
    setSavingConfig(true);
    setConfigError('');
    try {
      const { data } = await api.post('/email/config', { ...configForm, port: parseInt(configForm.port) || 993 });
      setConfig(data);
      setConfigOpen(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setConfigError(msg || 'Failed to save config');
    } finally {
      setSavingConfig(false);
    }
  }

  async function pollMailbox() {
    setPolling(true);
    setPollMessage('');
    try {
      const { data } = await api.post('/email/poll');
      setPollMessage(data.message);
      await loadData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setPollMessage(msg || 'Failed to connect to mailbox');
    } finally {
      setPolling(false);
    }
  }

  function openReview(log: EmailLog) {
    const p = log.parsedData;
    setQuoteForm({
      customerId: '',
      pickupCity: p?.pickupCity || '',
      pickupState: p?.pickupState || '',
      deliveryCity: p?.deliveryCity || '',
      deliveryState: p?.deliveryState || '',
      commodity: p?.commodity || '',
      weight: p?.weight ? String(p.weight) : '',
      equipment: p?.equipment || 'Dry Van',
      pickupDate: p?.pickupDate ? new Date(p.pickupDate).toISOString().slice(0, 10) : '',
      deliveryDate: p?.deliveryDate ? new Date(p.deliveryDate).toISOString().slice(0, 10) : '',
      rate: p?.rate ? String(p.rate) : '',
      specialInstructions: '',
    });
    setQuoteError('');
    setReviewLog(log);
  }

  async function createQuote() {
    if (!quoteForm.customerId || !quoteForm.pickupCity || !quoteForm.deliveryCity || !quoteForm.equipment || !quoteForm.rate) {
      setQuoteError('Customer, cities, equipment, and rate are required');
      return;
    }
    setSavingQuote(true);
    setQuoteError('');
    try {
      await api.post(`/email/logs/${reviewLog!.id}/quote`, {
        ...quoteForm,
        rate: parseFloat(quoteForm.rate),
        weight: quoteForm.weight ? parseFloat(quoteForm.weight) : undefined,
      });
      setReviewLog(null);
      await loadData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setQuoteError(msg || 'Failed to create quote');
    } finally {
      setSavingQuote(false);
    }
  }

  async function skipLog(id: string) {
    await api.patch(`/email/logs/${id}/skip`);
    await loadData();
  }

  const parsedLogs = logs.filter((l) => l.status === 'PARSED');
  const otherLogs = logs.filter((l) => l.status !== 'PARSED');

  return (
    <>
      <Topbar title="Email Inbox" />
      <main className="flex-1 overflow-auto p-6 space-y-6">

        {/* Config + Poll bar */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config?.isActive ? 'bg-green-50' : 'bg-gray-100'}`}>
              <Mail className={`h-5 w-5 ${config?.isActive ? 'text-green-600' : 'text-gray-400'}`} />
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">{config ? config.username : 'No mailbox configured'}</p>
              <p className="text-xs text-gray-500">
                {config ? `${config.host}:${config.port} · ${config.folder}` : 'Click "Configure" to connect an IMAP mailbox'}
              </p>
              {config?.lastChecked && (
                <p className="text-xs text-gray-400 mt-0.5">Last checked: {new Date(config.lastChecked).toLocaleString()}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {pollMessage && (
              <p className="text-sm text-gray-600 bg-gray-50 rounded px-3 py-1.5">{pollMessage}</p>
            )}
            {config && (
              <Button variant="outline" onClick={pollMailbox} disabled={polling}>
                <RefreshCw className={`h-4 w-4 mr-2 ${polling ? 'animate-spin' : ''}`} />
                {polling ? 'Checking…' : 'Check Now'}
              </Button>
            )}
            <Button variant="outline" onClick={openConfig}>
              <Settings className="h-4 w-4 mr-2" />Configure
            </Button>
          </div>
        </div>

        {/* Parsed emails needing review */}
        {parsedLogs.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Pending Review ({parsedLogs.length})
            </h4>
            <div className="space-y-3">
              {parsedLogs.map((log) => (
                <div key={log.id} className="bg-white rounded-xl border border-blue-200 shadow-sm p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">{log.subject}</p>
                      <p className="text-xs text-gray-500 mt-0.5">From: {log.fromName || log.fromEmail} · {new Date(log.receivedAt).toLocaleString()}</p>
                      {log.parsedData && (
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-600">
                          {log.parsedData.pickupCity && log.parsedData.deliveryCity && (
                            <span className="flex items-center gap-1">
                              <span className="font-medium">{log.parsedData.pickupCity}, {log.parsedData.pickupState}</span>
                              <ArrowRight className="h-3 w-3" />
                              <span className="font-medium">{log.parsedData.deliveryCity}, {log.parsedData.deliveryState}</span>
                            </span>
                          )}
                          {log.parsedData.equipment && <span className="bg-gray-100 px-2 py-0.5 rounded">{log.parsedData.equipment}</span>}
                          {log.parsedData.rate && <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded">${log.parsedData.rate.toLocaleString()}</span>}
                          {log.parsedData.weight && <span>{log.parsedData.weight.toLocaleString()} lbs</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" onClick={() => openReview(log)}>Create Quote</Button>
                      <Button size="sm" variant="outline" onClick={() => skipLog(log.id)}>Skip</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All email logs */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Email Log ({logs.length})</h4>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {loadingLogs ? (
              <p className="p-6 text-sm text-gray-400 animate-pulse">Loading email logs…</p>
            ) : otherLogs.length === 0 && parsedLogs.length === 0 ? (
              <div className="p-12 text-center">
                <Mail className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No emails processed yet. Configure your mailbox and click "Check Now".</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Subject', 'From', 'Received', 'Parsed Route', 'Status'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...parsedLogs, ...otherLogs].map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-800 max-w-xs truncate">{log.subject}</td>
                      <td className="px-4 py-3 text-gray-500">{log.fromName || log.fromEmail}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(log.receivedAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {log.parsedData?.pickupCity ? (
                          <span>{log.parsedData.pickupCity}, {log.parsedData.pickupState} → {log.parsedData.deliveryCity}, {log.parsedData.deliveryState}</span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[log.status]}`}>
                          {log.status === 'QUOTE_CREATED' ? 'Quote Created' : log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* IMAP Config Dialog */}
        <Dialog open={configOpen} onOpenChange={setConfigOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>IMAP Mailbox Configuration</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>IMAP Host *</Label>
                <Input value={configForm.host} onChange={(e) => setConfigForm({ ...configForm, host: e.target.value })} placeholder="imap.gmail.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Port</Label>
                  <Input type="number" value={configForm.port} onChange={(e) => setConfigForm({ ...configForm, port: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Folder</Label>
                  <Input value={configForm.folder} onChange={(e) => setConfigForm({ ...configForm, folder: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Username / Email *</Label>
                <Input value={configForm.username} onChange={(e) => setConfigForm({ ...configForm, username: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Password / App Password *</Label>
                <Input type="password" value={configForm.password} onChange={(e) => setConfigForm({ ...configForm, password: e.target.value })} />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="active" checked={configForm.isActive} onChange={(e) => setConfigForm({ ...configForm, isActive: e.target.checked })} className="h-4 w-4 rounded" />
                <Label htmlFor="active">Active (auto-poll enabled)</Label>
              </div>
              {configError && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{configError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setConfigOpen(false)}>Cancel</Button>
                <Button onClick={saveConfig} disabled={savingConfig}>{savingConfig ? 'Saving…' : 'Save'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Quote Review Dialog */}
        {reviewLog && (
          <Dialog open={!!reviewLog} onOpenChange={() => setReviewLog(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Quote from Email</DialogTitle>
              </DialogHeader>
              <div className="bg-gray-50 rounded-lg p-3 mb-2 text-xs text-gray-600">
                <p className="font-medium text-gray-700 mb-1">{reviewLog.subject}</p>
                <p className="line-clamp-3">{reviewLog.bodyText}</p>
              </div>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                <div className="space-y-1">
                  <Label>Customer *</Label>
                  <Select value={quoteForm.customerId} onValueChange={(v) => setQuoteForm({ ...quoteForm, customerId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select customer…" /></SelectTrigger>
                    <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Pickup City *</Label>
                    <Input value={quoteForm.pickupCity} onChange={(e) => setQuoteForm({ ...quoteForm, pickupCity: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Pickup State *</Label>
                    <Input value={quoteForm.pickupState} onChange={(e) => setQuoteForm({ ...quoteForm, pickupState: e.target.value })} maxLength={2} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Delivery City *</Label>
                    <Input value={quoteForm.deliveryCity} onChange={(e) => setQuoteForm({ ...quoteForm, deliveryCity: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Delivery State *</Label>
                    <Input value={quoteForm.deliveryState} onChange={(e) => setQuoteForm({ ...quoteForm, deliveryState: e.target.value })} maxLength={2} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Equipment *</Label>
                    <Select value={quoteForm.equipment} onValueChange={(v) => setQuoteForm({ ...quoteForm, equipment: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{EQUIPMENT_OPTIONS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Commodity</Label>
                    <Input value={quoteForm.commodity} onChange={(e) => setQuoteForm({ ...quoteForm, commodity: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Weight (lbs)</Label>
                    <Input type="number" value={quoteForm.weight} onChange={(e) => setQuoteForm({ ...quoteForm, weight: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Pickup Date</Label>
                    <Input type="date" value={quoteForm.pickupDate} onChange={(e) => setQuoteForm({ ...quoteForm, pickupDate: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Delivery Date</Label>
                    <Input type="date" value={quoteForm.deliveryDate} onChange={(e) => setQuoteForm({ ...quoteForm, deliveryDate: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Rate ($) *</Label>
                  <Input type="number" value={quoteForm.rate} onChange={(e) => setQuoteForm({ ...quoteForm, rate: e.target.value })} placeholder="2500" />
                </div>
                <div className="space-y-1">
                  <Label>Special Instructions</Label>
                  <Input value={quoteForm.specialInstructions} onChange={(e) => setQuoteForm({ ...quoteForm, specialInstructions: e.target.value })} />
                </div>
                {quoteError && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{quoteError}</p>}
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setReviewLog(null)}>Cancel</Button>
                  <Button onClick={createQuote} disabled={savingQuote}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {savingQuote ? 'Creating…' : 'Create Quote'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

      </main>
    </>
  );
}
