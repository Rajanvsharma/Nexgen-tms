'use client';

import { useEffect, useState } from 'react';
import { FileText, Download, Truck } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';

interface Load {
  id: string;
  loadNumber: string;
  status: string;
  customer: { name: string };
  carrier: { name: string } | null;
  pickupCity: string;
  pickupState: string;
  deliveryCity: string;
  deliveryState: string;
}

interface Document {
  id: string;
  type: string;
  filename: string;
  createdAt: string;
  load: { loadNumber: string } | null;
  createdBy: { firstName: string; lastName: string };
}

const DOC_LABELS: Record<string, string> = { RATE_CONFIRMATION: 'Rate Confirmation', BOL: 'Bill of Lading' };

export default function DocumentsPage() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  async function loadData() {
    try {
      const [loadsRes, docsRes] = await Promise.all([api.get('/loads'), api.get('/documents')]);
      setLoads(loadsRes.data.filter((l: Load) => l.status !== 'CANCELLED'));
      setDocs(docsRes.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  function openPdf(loadId: string, type: 'rate-confirmation' | 'bol') {
    setGenerating(`${loadId}-${type}`);
    const token = document.cookie.split('; ').find((r) => r.startsWith('accessToken='))?.split('=')[1];
    const url = `http://localhost:4000/api/documents/loads/${loadId}/${type}`;
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.click();
    setTimeout(() => {
      setGenerating(null);
      loadData();
    }, 2000);
  }

  return (
    <>
      <Topbar title="Documents" />
      <main className="flex-1 overflow-auto p-6 space-y-6">

        {/* Generate Documents */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <FileText className="h-5 w-5 text-brand" />
            <h4 className="font-semibold text-gray-800">Generate Documents</h4>
          </div>
          {loading ? (
            <p className="p-6 text-sm text-gray-400 animate-pulse">Loading loads…</p>
          ) : loads.length === 0 ? (
            <div className="p-12 text-center">
              <Truck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No loads available. Create loads first.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Load #', 'Customer', 'Route', 'Carrier', 'Status', 'Rate Confirmation', 'Bill of Lading'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loads.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-brand font-medium">{l.loadNumber}</td>
                    <td className="px-4 py-3 text-gray-800">{l.customer.name}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{l.pickupCity}, {l.pickupState} → {l.deliveryCity}, {l.deliveryState}</td>
                    <td className="px-4 py-3 text-gray-600">{l.carrier?.name || <span className="text-gray-400 italic">Unassigned</span>}</td>
                    <td className="px-4 py-3"><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{l.status}</span></td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="outline" disabled={generating === `${l.id}-rate-confirmation`}
                        onClick={() => openPdf(l.id, 'rate-confirmation')}>
                        <Download className="h-3 w-3 mr-1" />
                        {generating === `${l.id}-rate-confirmation` ? 'Generating…' : 'Generate'}
                      </Button>
                    </td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="outline" disabled={generating === `${l.id}-bol`}
                        onClick={() => openPdf(l.id, 'bol')}>
                        <Download className="h-3 w-3 mr-1" />
                        {generating === `${l.id}-bol` ? 'Generating…' : 'Generate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Document History */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h4 className="font-semibold text-gray-800">Document History ({docs.length})</h4>
          </div>
          {docs.length === 0 ? (
            <p className="p-6 text-sm text-gray-400">No documents generated yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Type', 'Load', 'Filename', 'Generated By', 'Date'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {docs.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{DOC_LABELS[d.type] || d.type}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-600">{d.load?.loadNumber || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{d.filename}</td>
                    <td className="px-4 py-3 text-gray-600">{d.createdBy.firstName} {d.createdBy.lastName}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(d.createdAt).toLocaleDateString()}</td>
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
