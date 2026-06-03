'use client';

import { useEffect, useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, ArrowRight } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';

interface OcrLog {
  id: string;
  filename: string;
  parsedData: {
    pickupCity: string | null;
    pickupState: string | null;
    deliveryCity: string | null;
    deliveryState: string | null;
    commodity: string | null;
    weight: number | null;
    equipment: string | null;
    pickupDate: string | null;
    rate: number | null;
  } | null;
  status: string;
  quoteId: string | null;
  createdAt: string;
  createdBy: { firstName: string; lastName: string };
}

interface Customer { id: string; name: string; }

const EQUIPMENT_OPTIONS = ['Dry Van', 'Reefer', 'Flatbed', 'Step Deck', 'RGN', 'Power Only', 'Box Truck'];

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  PARSED: 'bg-blue-100 text-blue-700',
  QUOTE_CREATED: 'bg-green-100 text-green-700',
};

export default function OcrPage() {
  const [logs, setLogs] = useState<OcrLog[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [reviewLog, setReviewLog] = useState<OcrLog | null>(null);
  const [quoteForm, setQuoteForm] = useState({ customerId: '', pickupCity: '', pickupState: '', deliveryCity: '', deliveryState: '', commodity: '', weight: '', equipment: 'Dry Van', pickupDate: '', deliveryDate: '', rate: '', specialInstructions: '' });
  const [quoteError, setQuoteError] = useState('');
  const [savingQuote, setSavingQuote] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadData() {
    try {
      const [logsRes, custRes] = await Promise.all([api.get('/ocr'), api.get('/customers')]);
      setLogs(logsRes.data);
      setCustomers(custRes.data.filter((c: Customer & { isActive: boolean }) => c.isActive));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (extractedText) formData.append('extractedText', extractedText);
      await api.post('/ocr/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setExtractedText('');
      if (fileRef.current) fileRef.current.value = '';
      await loadData();
    } catch (err: unknown) {
      alert((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function openReview(log: OcrLog) {
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
      deliveryDate: '',
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
      await api.post(`/ocr/${reviewLog!.id}/quote`, { ...quoteForm, rate: parseFloat(quoteForm.rate), weight: quoteForm.weight ? parseFloat(quoteForm.weight) : undefined });
      setReviewLog(null);
      await loadData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setQuoteError(msg || 'Failed to create quote');
    } finally {
      setSavingQuote(false);
    }
  }

  const parsedLogs = logs.filter((l) => l.status === 'PARSED');

  return (
    <>
      <Topbar title="AI / OCR Upload" />
      <main className="flex-1 overflow-auto p-6 space-y-6">

        {/* Upload section */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h4 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <Upload className="h-5 w-5 text-brand" />Upload & Parse Document
          </h4>
          <p className="text-sm text-gray-500 mb-4">Upload a screenshot, PDF, or image of a load request. The system will extract route, equipment, and rate details automatically.</p>

          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-brand transition-colors cursor-pointer" onClick={() => fileRef.current?.click()}>
              <Upload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Click to upload or drag & drop</p>
              <p className="text-xs text-gray-400 mt-1">Supported: .txt, .pdf, .png, .jpg, .jpeg, .webp (max 10MB)</p>
              <input ref={fileRef} type="file" className="hidden" accept=".txt,.pdf,.png,.jpg,.jpeg,.webp" onChange={handleUpload} />
            </div>

            <div className="space-y-1">
              <Label>Or paste extracted text / email body</Label>
              <textarea
                value={extractedText}
                onChange={(e) => setExtractedText(e.target.value)}
                rows={5}
                placeholder="Paste text from WhatsApp, email body, or any message containing load details here. Then upload a placeholder file above."
                className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand resize-none"
              />
            </div>
          </div>

          {uploading && <p className="text-sm text-brand animate-pulse mt-3">Uploading and parsing…</p>}
        </div>

        {/* Parsed items awaiting review */}
        {parsedLogs.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Pending Review ({parsedLogs.length})</h4>
            <div className="space-y-3">
              {parsedLogs.map((log) => (
                <div key={log.id} className="bg-white rounded-xl border border-blue-200 shadow-sm p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-gray-800 text-sm">{log.filename}</p>
                      {log.parsedData && (
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-600">
                          {log.parsedData.pickupCity && (
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
                    <Button size="sm" onClick={() => openReview(log)}>Create Quote</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Log history */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h4 className="font-semibold text-gray-800">Upload History ({logs.length})</h4>
          </div>
          {loading ? (
            <p className="p-6 text-sm text-gray-400 animate-pulse">Loading…</p>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No uploads yet. Upload a document above to get started.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Filename', 'Parsed Route', 'Status', 'Uploaded By', 'Date'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-800 font-medium">{log.filename}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {log.parsedData?.pickupCity ? `${log.parsedData.pickupCity}, ${log.parsedData.pickupState} → ${log.parsedData.deliveryCity}, ${log.parsedData.deliveryState}` : <span className="text-gray-400">Not parsed</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[log.status] || 'bg-gray-100 text-gray-600'}`}>
                        {log.status === 'QUOTE_CREATED' ? 'Quote Created' : log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{log.createdBy.firstName} {log.createdBy.lastName}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(log.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Quote Review Dialog */}
        {reviewLog && (
          <Dialog open={!!reviewLog} onOpenChange={() => setReviewLog(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Create Quote from Upload: {reviewLog.filename}</DialogTitle></DialogHeader>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                <div className="space-y-1">
                  <Label>Customer *</Label>
                  <Select value={quoteForm.customerId} onValueChange={(v) => setQuoteForm({ ...quoteForm, customerId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select customer…" /></SelectTrigger>
                    <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><Label>Pickup City *</Label><Input value={quoteForm.pickupCity} onChange={(e) => setQuoteForm({ ...quoteForm, pickupCity: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Pickup State *</Label><Input value={quoteForm.pickupState} onChange={(e) => setQuoteForm({ ...quoteForm, pickupState: e.target.value })} maxLength={2} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><Label>Delivery City *</Label><Input value={quoteForm.deliveryCity} onChange={(e) => setQuoteForm({ ...quoteForm, deliveryCity: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Delivery State *</Label><Input value={quoteForm.deliveryState} onChange={(e) => setQuoteForm({ ...quoteForm, deliveryState: e.target.value })} maxLength={2} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Equipment *</Label>
                    <Select value={quoteForm.equipment} onValueChange={(v) => setQuoteForm({ ...quoteForm, equipment: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{EQUIPMENT_OPTIONS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label>Commodity</Label><Input value={quoteForm.commodity} onChange={(e) => setQuoteForm({ ...quoteForm, commodity: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Weight (lbs)</Label><Input type="number" value={quoteForm.weight} onChange={(e) => setQuoteForm({ ...quoteForm, weight: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><Label>Pickup Date</Label><Input type="date" value={quoteForm.pickupDate} onChange={(e) => setQuoteForm({ ...quoteForm, pickupDate: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Delivery Date</Label><Input type="date" value={quoteForm.deliveryDate} onChange={(e) => setQuoteForm({ ...quoteForm, deliveryDate: e.target.value })} /></div>
                </div>
                <div className="space-y-1"><Label>Rate ($) *</Label><Input type="number" value={quoteForm.rate} onChange={(e) => setQuoteForm({ ...quoteForm, rate: e.target.value })} /></div>
                <div className="space-y-1"><Label>Special Instructions</Label><Input value={quoteForm.specialInstructions} onChange={(e) => setQuoteForm({ ...quoteForm, specialInstructions: e.target.value })} /></div>
                {quoteError && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{quoteError}</p>}
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setReviewLog(null)}>Cancel</Button>
                  <Button onClick={createQuote} disabled={savingQuote}>
                    <CheckCircle className="h-4 w-4 mr-2" />{savingQuote ? 'Creating…' : 'Create Quote'}
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
