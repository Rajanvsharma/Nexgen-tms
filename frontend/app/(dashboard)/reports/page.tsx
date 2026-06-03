'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Truck, Users, Package } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import api from '@/lib/api';

interface RevenueRow { month: string; revenue: number; cost: number; margin: string; }
interface StatusRow { status: string; count: number; }
interface CarrierRow { name: string; mcNumber: string; loadCount: number; totalPaid: number; }
interface CustomerRow { name: string; loadCount: number; totalRevenue: number; }
interface EquipRow { equipment: string; count: number; }

const STATUS_COLORS: Record<string, string> = {
  CREATED: '#94a3b8', DISPATCHED: '#60a5fa', IN_TRANSIT: '#fbbf24',
  DELIVERED: '#34d399', INVOICED: '#a78bfa', CANCELLED: '#f87171',
};
const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

export default function ReportsPage() {
  const [revenue, setRevenue] = useState<RevenueRow[]>([]);
  const [statusData, setStatusData] = useState<StatusRow[]>([]);
  const [topCarriers, setTopCarriers] = useState<CarrierRow[]>([]);
  const [topCustomers, setTopCustomers] = useState<CustomerRow[]>([]);
  const [equipment, setEquipment] = useState<EquipRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/reports/revenue'),
      api.get('/reports/loads-by-status'),
      api.get('/reports/top-carriers'),
      api.get('/reports/top-customers'),
      api.get('/reports/equipment-mix'),
    ]).then(([rev, status, carriers, customers, equip]) => {
      setRevenue(rev.data);
      setStatusData(status.data);
      setTopCarriers(carriers.data);
      setTopCustomers(customers.data);
      setEquipment(equip.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const totalRevenue = revenue.reduce((s, r) => s + r.revenue, 0);
  const totalCost = revenue.reduce((s, r) => s + r.cost, 0);
  const totalLoads = statusData.reduce((s, r) => s + r.count, 0);

  if (loading) return (
    <>
      <Topbar title="Reports & KPIs" />
      <main className="flex-1 p-6 flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Loading reports…</p>
      </main>
    </>
  );

  return (
    <>
      <Topbar title="Reports & KPIs" />
      <main className="flex-1 overflow-auto p-6 space-y-6">

        {/* Summary KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: TrendingUp, color: 'bg-green-50 text-green-600' },
            { label: 'Total Cost (Carrier)', value: `$${totalCost.toLocaleString()}`, icon: TrendingUp, color: 'bg-red-50 text-red-600' },
            { label: 'Net Margin', value: totalRevenue > 0 ? `${((totalRevenue - totalCost) / totalRevenue * 100).toFixed(1)}%` : '—', icon: TrendingUp, color: 'bg-blue-50 text-blue-600' },
            { label: 'Total Loads', value: totalLoads, icon: Truck, color: 'bg-purple-50 text-purple-600' },
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

        {/* Revenue & Margin chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-brand" />Revenue vs Cost (Last 12 Months)
          </h4>
          {revenue.length === 0 ? (
            <p className="text-center text-gray-400 py-12 text-sm">No revenue data yet. Mark invoices and payments as paid to see data.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenue} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cost" name="Carrier Cost" fill="#f87171" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Load status pie */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Truck className="h-5 w-5 text-brand" />Loads by Status
            </h4>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} label={(props) => `${(props as unknown as {status:string;count:number}).status}: ${(props as unknown as {status:string;count:number}).count}`}>
                  {statusData.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Equipment mix pie */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-brand" />Equipment Mix
            </h4>
            {equipment.length === 0 ? (
              <p className="text-center text-gray-400 py-12 text-sm">No loads yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={equipment} dataKey="count" nameKey="equipment" cx="50%" cy="50%" outerRadius={80}>
                    {equipment.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Carriers */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <Truck className="h-5 w-5 text-brand" />
              <h4 className="font-semibold text-gray-800">Top Carriers by Load Count</h4>
            </div>
            {topCarriers.length === 0 ? (
              <p className="p-6 text-sm text-gray-400">No carrier data yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Carrier', 'MC', 'Loads', 'Total Paid'].map((h) => (
                      <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topCarriers.map((c) => (
                    <tr key={c.mcNumber} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-800">{c.name}</td>
                      <td className="px-4 py-2 font-mono text-gray-500">{c.mcNumber}</td>
                      <td className="px-4 py-2 text-gray-700">{c.loadCount}</td>
                      <td className="px-4 py-2 text-gray-700">${c.totalPaid.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Top Customers */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <Users className="h-5 w-5 text-brand" />
              <h4 className="font-semibold text-gray-800">Top Customers by Revenue</h4>
            </div>
            {topCustomers.length === 0 ? (
              <p className="p-6 text-sm text-gray-400">No customer data yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Customer', 'Loads', 'Total Revenue'].map((h) => (
                      <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topCustomers.map((c) => (
                    <tr key={c.name} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-800">{c.name}</td>
                      <td className="px-4 py-2 text-gray-700">{c.loadCount}</td>
                      <td className="px-4 py-2 text-gray-700">${c.totalRevenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </main>
    </>
  );
}
