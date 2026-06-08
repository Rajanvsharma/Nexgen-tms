'use client';

import { useEffect, useState } from 'react';
import { MapPin, Truck, RefreshCw, Clock } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import api from '@/lib/api';

interface TrackedLoad {
  id: string;
  loadNumber: string;
  status: string;
  pickupCity: string; pickupState: string;
  deliveryCity: string; deliveryState: string;
  trackingLat: number; trackingLng: number;
  trackingUpdatedAt: string;
  driverName: string | null;
  carrier: { name: string } | null;
  customer: { name: string };
}

const STATUS_COLORS: Record<string, string> = {
  DISPATCHED: 'bg-blue-100 text-blue-700',
  DRIVER_ON_ROUTE: 'bg-indigo-100 text-indigo-700',
  IN_TRANSIT: 'bg-purple-100 text-purple-700',
  ON_ROUTE: 'bg-purple-100 text-purple-700',
  LOADING: 'bg-yellow-100 text-yellow-700',
  UNLOADING: 'bg-orange-100 text-orange-700',
};

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export default function TrackingPage() {
  const [loads, setLoads] = useState<TrackedLoad[]>([]);
  const [selected, setSelected] = useState<TrackedLoad | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchLoads() {
    try {
      const { data } = await api.get('/tracking/active');
      setLoads(data);
      if (data.length > 0 && !selected) setSelected(data[0]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchLoads();
    const interval = setInterval(fetchLoads, 60000); // auto-refresh every 60s
    return () => clearInterval(interval);
  }, []);

  function refresh() { setRefreshing(true); fetchLoads(); }

  const mapUrl = selected
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${selected.trackingLng - 3}%2C${selected.trackingLat - 2}%2C${selected.trackingLng + 3}%2C${selected.trackingLat + 2}&layer=mapnik&marker=${selected.trackingLat}%2C${selected.trackingLng}`
    : null;

  return (
    <>
      <Topbar title="GPS Tracking" />
      <main className="flex-1 overflow-hidden p-6 flex gap-6">

        {/* Load list */}
        <div className="w-80 flex flex-col gap-3 overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">{loads.length} Active Loads</span>
            <button onClick={refresh} disabled={refreshing} className="text-gray-400 hover:text-gray-600">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-gray-400 animate-pulse">Loading…</p>
          ) : loads.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <Truck className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No loads with GPS tracking active.</p>
              <p className="text-xs text-gray-400 mt-1">Drivers can POST to /api/tracking/loads/:id/location to update position.</p>
            </div>
          ) : loads.map((load) => (
            <button
              key={load.id}
              onClick={() => setSelected(load)}
              className={`text-left bg-white rounded-xl border p-4 transition-all ${selected?.id === load.id ? 'border-blue-400 shadow-md' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-sm font-semibold text-blue-600">{load.loadNumber}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[load.status] || 'bg-gray-100 text-gray-600'}`}>{load.status}</span>
              </div>
              <p className="text-xs text-gray-600 mb-1">{load.pickupCity}, {load.pickupState} → {load.deliveryCity}, {load.deliveryState}</p>
              <p className="text-xs text-gray-500">{load.carrier?.name || 'No carrier'} {load.driverName ? `· ${load.driverName}` : ''}</p>
              <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                <Clock className="h-3 w-3" />
                {timeAgo(load.trackingUpdatedAt)}
              </div>
            </button>
          ))}
        </div>

        {/* Map */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
          {selected ? (
            <>
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                <MapPin className="h-4 w-4 text-blue-600" />
                <div>
                  <span className="font-semibold text-sm text-gray-800">{selected.loadNumber}</span>
                  <span className="text-xs text-gray-500 ml-2">{selected.pickupCity}, {selected.pickupState} → {selected.deliveryCity}, {selected.deliveryState}</span>
                </div>
                <span className="ml-auto text-xs text-gray-400">
                  {selected.trackingLat.toFixed(4)}, {selected.trackingLng.toFixed(4)} · Updated {timeAgo(selected.trackingUpdatedAt)}
                </span>
              </div>
              <iframe
                src={mapUrl!}
                className="flex-1 w-full border-0"
                title={`Map for ${selected.loadNumber}`}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <MapPin className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Select a load to view on map</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
