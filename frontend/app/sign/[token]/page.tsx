'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface LoadInfo {
  loadNumber: string;
  pickupCity: string; pickupState: string;
  deliveryCity: string; deliveryState: string;
  pickupDate: string | null;
  equipment: string;
  carrierRate: number;
  carrier: { name: string; mcNumber: string } | null;
}

interface SignRequest {
  documentId: string;
  type: string;
  filename: string;
  signed: boolean;
  signedAt: string | null;
  signerName: string | null;
  load: LoadInfo | null;
}

export default function SignPage() {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<SignRequest | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [signing, setSigning] = useState(false);
  const [done, setDone] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    axios.get(`${API}/api/documents/sign/${token}`)
      .then(r => setDoc(r.data))
      .catch(() => setError('This signing link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  function startDraw(e: React.MouseEvent<HTMLCanvasElement>) {
    isDrawing.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }
  function draw(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineCap = 'round';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  }
  function endDraw() { isDrawing.current = false; }
  function clearCanvas() {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }

  async function handleSign(e: React.FormEvent) {
    e.preventDefault();
    if (!signerName.trim()) { setError('Please enter your full name'); return; }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const blank = document.createElement('canvas');
    blank.width = canvas.width; blank.height = canvas.height;
    if (canvas.toDataURL() === blank.toDataURL()) { setError('Please draw your signature'); return; }

    setSigning(true);
    setError('');
    try {
      await axios.post(`${API}/api/documents/sign/${token}`, {
        signerName: signerName.trim(),
        signerEmail: signerEmail.trim() || undefined,
        signatureData: canvas.toDataURL(),
      });
      setDone(true);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.message : 'Signing failed';
      setError(msg || 'Signing failed');
    } finally {
      setSigning(false);
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>;

  if (error && !doc) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
        <div className="text-4xl mb-4">❌</div>
        <p className="text-red-600">{error}</p>
      </div>
    </div>
  );

  if (doc?.signed || done) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Document Signed</h2>
        <p className="text-gray-500 text-sm">
          {doc?.signed
            ? `This document was signed by ${doc.signerName} on ${doc.signedAt ? new Date(doc.signedAt).toLocaleDateString() : 'N/A'}.`
            : 'Your signature has been recorded. You may close this window.'}
        </p>
      </div>
    </div>
  );

  const load = doc?.load;
  const fmt = (n: number | null | undefined) => n != null ? `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'N/A';

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">N</div>
            <div>
              <h1 className="font-bold text-gray-800">NexGen TMS</h1>
              <p className="text-xs text-gray-500">Rate Confirmation — Please review and sign</p>
            </div>
          </div>

          {load && (
            <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
              <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Load Details</div>
              <div className="divide-y divide-gray-100">
                {[
                  ['Load #', load.loadNumber],
                  ['Origin', `${load.pickupCity}, ${load.pickupState}`],
                  ['Destination', `${load.deliveryCity}, ${load.deliveryState}`],
                  ['Pickup Date', load.pickupDate ? new Date(load.pickupDate).toLocaleDateString() : 'TBD'],
                  ['Equipment', load.equipment],
                  ['Carrier', load.carrier?.name || 'N/A'],
                  ['MC #', load.carrier?.mcNumber || 'N/A'],
                  ['Rate', fmt(load.carrierRate)],
                ].map(([label, value]) => (
                  <div key={label} className="flex px-4 py-2">
                    <span className="w-32 text-xs text-gray-500 font-medium">{label}</span>
                    <span className="text-sm text-gray-800 font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-gray-500 bg-yellow-50 border border-yellow-200 rounded p-3">
            By signing, you agree to transport the above shipment at the stated rate and comply with all applicable FMCSA regulations.
          </div>
        </div>

        <form onSubmit={handleSign} className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Sign Document</h2>

          {error && <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-600">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={signerName}
              onChange={e => setSignerName(e.target.value)}
              placeholder="Your full name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email (optional)</label>
            <input
              type="email"
              value={signerEmail}
              onChange={e => setSignerEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Draw Signature <span className="text-red-500">*</span></label>
              <button type="button" onClick={clearCanvas} className="text-xs text-gray-500 hover:text-gray-700 underline">Clear</button>
            </div>
            <canvas
              ref={canvasRef}
              width={580}
              height={120}
              className="w-full border border-gray-300 rounded-lg bg-white cursor-crosshair"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
            />
            <p className="text-xs text-gray-400 mt-1">Draw your signature above using your mouse or trackpad</p>
          </div>

          <button
            type="submit"
            disabled={signing}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {signing ? 'Signing…' : 'Sign Rate Confirmation'}
          </button>
        </form>
      </div>
    </div>
  );
}
