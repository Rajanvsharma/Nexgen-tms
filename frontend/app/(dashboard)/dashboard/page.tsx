'use client';

import { useEffect, useState } from 'react';
import { Truck, Users, Bell, DollarSign, ShieldAlert, CheckCircle, Clock, FileText, TrendingUp } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';

interface Announcement {
  id: string;
  title: string;
  body: string;
  postedBy: string;
  posterRole: string;
  createdAt: string;
  isRead: boolean;
}

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}

function buildStats(role: string, data: Record<string, number>): StatCard[] {
  if (role === 'ADMIN') return [
    { label: 'Active Loads', value: data.activeLoads ?? '—', icon: Truck, color: 'bg-green-50 text-green-600' },
    { label: 'Pending Invoices', value: data.pendingInvoices ?? '—', icon: DollarSign, color: 'bg-yellow-50 text-yellow-600' },
    { label: 'Pending Quotes', value: data.pendingQuotes ?? '—', icon: FileText, color: 'bg-blue-50 text-blue-600' },
    { label: 'Compliance Alerts', value: data.complianceAlerts ?? '—', icon: ShieldAlert, color: 'bg-red-50 text-red-600' },
    { label: 'Total Users', value: data.totalUsers ?? '—', icon: Users, color: 'bg-purple-50 text-purple-600' },
    { label: 'Revenue This Month', value: data.revenueThisMonth != null ? `$${Number(data.revenueThisMonth).toLocaleString()}` : '—', icon: TrendingUp, color: 'bg-indigo-50 text-indigo-600' },
  ];
  if (role === 'DISPATCHER') return [
    { label: 'My Active Loads', value: data.myActiveLoads ?? '—', icon: Truck, color: 'bg-green-50 text-green-600' },
    { label: 'Loads This Month', value: data.loadsThisMonth ?? '—', icon: CheckCircle, color: 'bg-blue-50 text-blue-600' },
    { label: 'Pending Quotes', value: data.pendingQuotes ?? '—', icon: Clock, color: 'bg-yellow-50 text-yellow-600' },
  ];
  if (role === 'ACCOUNTING') return [
    { label: 'Pending Invoices', value: data.pendingInvoices ?? '—', icon: DollarSign, color: 'bg-yellow-50 text-yellow-600' },
    { label: 'Overdue Invoices', value: data.overduePayments ?? '—', icon: ShieldAlert, color: 'bg-red-50 text-red-600' },
    { label: 'Paid This Month', value: data.paidThisMonth ?? '—', icon: CheckCircle, color: 'bg-green-50 text-green-600' },
  ];
  if (role === 'COMPLIANCE') return [
    { label: 'Expiring Insurance', value: data.expiringInsurance ?? '—', icon: ShieldAlert, color: 'bg-red-50 text-red-600' },
    { label: 'Expiring Authority', value: data.expiringAuthority ?? '—', icon: Clock, color: 'bg-yellow-50 text-yellow-600' },
    { label: 'Compliant Carriers', value: data.compliantCarriers ?? '—', icon: CheckCircle, color: 'bg-green-50 text-green-600' },
  ];
  return [];
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingAnn, setLoadingAnn] = useState(true);
  const [stats, setStats] = useState<StatCard[]>([]);

  const unreadCount = announcements.filter((a) => !a.isRead).length;

  useEffect(() => {
    Promise.all([
      api.get('/announcements').catch(() => ({ data: [] })),
      api.get('/stats').catch(() => ({ data: {} })),
    ]).then(([annRes, statsRes]) => {
      setAnnouncements(annRes.data);
      if (user) setStats(buildStats(user.role, statsRes.data));
    }).finally(() => setLoadingAnn(false));
  }, [user]);

  async function markRead(id: string) {
    await api.patch(`/announcements/${id}/read`);
    setAnnouncements((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)));
  }

  return (
    <>
      <Topbar title="Dashboard" />
      <main className="flex-1 overflow-auto p-6 space-y-6">

        <div>
          <h3 className="text-xl font-semibold text-gray-800">
            Welcome back, {user?.firstName}!
          </h3>
          <p className="text-gray-500 text-sm mt-0.5">
            Here&apos;s what&apos;s happening in your {user?.role.toLowerCase()} view.
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Announcements */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-brand" />
              <h4 className="font-semibold text-gray-800">Announcements</h4>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">{unreadCount}</span>
              )}
            </div>
          </div>

          <div className="divide-y divide-gray-50">
            {loadingAnn && (
              <p className="px-6 py-4 text-sm text-gray-400 animate-pulse">Loading announcements…</p>
            )}
            {!loadingAnn && announcements.length === 0 && (
              <p className="px-6 py-4 text-sm text-gray-400">No announcements yet.</p>
            )}
            {announcements.map((ann) => (
              <div
                key={ann.id}
                className={`px-6 py-4 flex items-start justify-between gap-4 transition-colors ${!ann.isRead ? 'bg-blue-50/50' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {!ann.isRead && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
                    <p className="font-medium text-gray-800 text-sm">{ann.title}</p>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">{ann.body}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Posted by {ann.postedBy} · {ann.posterRole} · {new Date(ann.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {!ann.isRead && (
                  <button
                    onClick={() => markRead(ann.id)}
                    className="text-xs text-blue-600 hover:underline shrink-0 mt-0.5"
                  >
                    Mark read
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

      </main>
    </>
  );
}
