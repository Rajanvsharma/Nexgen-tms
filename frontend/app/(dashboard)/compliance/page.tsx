'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import api from '@/lib/api';

interface Carrier {
  id: string;
  name: string;
  mcNumber: string;
  dotNumber: string | null;
  email: string | null;
  phone: string | null;
  insuranceExpiry: string | null;
  authorityExpiry: string | null;
  w9OnFile: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

type ComplianceFlag = 'insurance_expired' | 'insurance_expiring' | 'authority_expired' | 'authority_expiring' | 'no_w9' | 'suspended';

interface CarrierCompliance {
  carrier: Carrier;
  flags: ComplianceFlag[];
  daysUntilInsurance: number | null;
  daysUntilAuthority: number | null;
}

const FLAG_LABELS: Record<ComplianceFlag, { label: string; color: string; icon: React.ElementType }> = {
  insurance_expired: { label: 'Insurance Expired', color: 'bg-red-100 text-red-700', icon: XCircle },
  insurance_expiring: { label: 'Insurance Expiring <30d', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  authority_expired: { label: 'Authority Expired', color: 'bg-red-100 text-red-700', icon: XCircle },
  authority_expiring: { label: 'Authority Expiring <30d', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  no_w9: { label: 'No W9 on File', color: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle },
  suspended: { label: 'Suspended', color: 'bg-red-100 text-red-700', icon: XCircle },
};

function getDaysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function buildCompliance(carriers: Carrier[]): CarrierCompliance[] {
  return carriers
    .map((c) => {
      const flags: ComplianceFlag[] = [];
      const daysIns = getDaysUntil(c.insuranceExpiry);
      const daysAuth = getDaysUntil(c.authorityExpiry);

      if (c.status === 'SUSPENDED') flags.push('suspended');
      if (daysIns !== null && daysIns < 0) flags.push('insurance_expired');
      else if (daysIns !== null && daysIns < 30) flags.push('insurance_expiring');
      if (daysAuth !== null && daysAuth < 0) flags.push('authority_expired');
      else if (daysAuth !== null && daysAuth < 30) flags.push('authority_expiring');
      if (!c.w9OnFile) flags.push('no_w9');

      return { carrier: c, flags, daysUntilInsurance: daysIns, daysUntilAuthority: daysAuth };
    })
    .filter((entry) => entry.flags.length > 0)
    .sort((a, b) => b.flags.length - a.flags.length);
}

export default function CompliancePage() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'critical' | 'expiring' | 'w9'>('all');

  useEffect(() => {
    api.get('/carriers')
      .then(({ data }) => setCarriers(data))
      .finally(() => setLoading(false));
  }, []);

  const complianceItems = buildCompliance(carriers);
  const critical = complianceItems.filter((i) => i.flags.some((f) => f.includes('expired') || f === 'suspended'));
  const expiring = complianceItems.filter((i) => i.flags.some((f) => f.includes('expiring')));
  const noW9 = complianceItems.filter((i) => i.flags.includes('no_w9'));
  const compliant = carriers.filter((c) => {
    const ins = getDaysUntil(c.insuranceExpiry);
    const auth = getDaysUntil(c.authorityExpiry);
    return c.status === 'ACTIVE' && (ins === null || ins >= 30) && (auth === null || auth >= 30) && c.w9OnFile;
  });

  const displayed = filter === 'critical' ? critical
    : filter === 'expiring' ? expiring
    : filter === 'w9' ? noW9
    : complianceItems;

  return (
    <>
      <Topbar title="Compliance" />
      <main className="flex-1 overflow-auto p-6 space-y-6">

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Critical Issues', value: critical.length, icon: XCircle, color: 'bg-red-50 text-red-600', key: 'critical' as const },
            { label: 'Expiring Soon', value: expiring.length, icon: AlertTriangle, color: 'bg-orange-50 text-orange-600', key: 'expiring' as const },
            { label: 'Missing W9', value: noW9.length, icon: Clock, color: 'bg-yellow-50 text-yellow-600', key: 'w9' as const },
            { label: 'Compliant Carriers', value: compliant.length, icon: CheckCircle, color: 'bg-green-50 text-green-600', key: 'all' as const },
          ].map((card) => (
            <button
              key={card.label}
              onClick={() => setFilter(filter === card.key && card.key !== 'all' ? 'all' : card.key)}
              className={`bg-white rounded-xl border p-5 flex items-center gap-4 shadow-sm transition-colors text-left ${filter === card.key ? 'border-brand ring-1 ring-brand' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className={`p-3 rounded-lg ${card.color}`}><card.icon className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{card.value}</p>
                <p className="text-sm text-gray-500">{card.label}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Compliance Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-brand" />
              <h4 className="font-semibold text-gray-800">
                {filter === 'all' ? 'All Compliance Issues' : filter === 'critical' ? 'Critical Issues' : filter === 'expiring' ? 'Expiring Soon' : 'Missing W9'}
              </h4>
              <span className="text-sm text-gray-400">({displayed.length})</span>
            </div>
            {filter !== 'all' && (
              <button onClick={() => setFilter('all')} className="text-xs text-brand hover:underline">Show all</button>
            )}
          </div>

          {loading ? (
            <p className="p-6 text-sm text-gray-400 animate-pulse">Loading compliance data…</p>
          ) : displayed.length === 0 ? (
            <div className="p-12 text-center">
              <ShieldCheck className="h-10 w-10 text-green-400 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">No compliance issues found</p>
              <p className="text-gray-400 text-xs mt-1">All active carriers are compliant</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Carrier', 'MC Number', 'Insurance Expiry', 'Authority Expiry', 'W9', 'Issues'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayed.map(({ carrier: c, flags, daysUntilInsurance, daysUntilAuthority }) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{c.name}</p>
                      {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-600">{c.mcNumber}</td>
                    <td className="px-4 py-3">
                      {c.insuranceExpiry ? (
                        <div className={`text-xs ${daysUntilInsurance !== null && daysUntilInsurance < 0 ? 'text-red-600 font-semibold' : daysUntilInsurance !== null && daysUntilInsurance < 30 ? 'text-orange-600 font-medium' : 'text-gray-600'}`}>
                          {new Date(c.insuranceExpiry).toLocaleDateString()}
                          {daysUntilInsurance !== null && (
                            <span className="ml-1">
                              ({daysUntilInsurance < 0 ? `${Math.abs(daysUntilInsurance)}d ago` : `${daysUntilInsurance}d left`})
                            </span>
                          )}
                        </div>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {c.authorityExpiry ? (
                        <div className={`text-xs ${daysUntilAuthority !== null && daysUntilAuthority < 0 ? 'text-red-600 font-semibold' : daysUntilAuthority !== null && daysUntilAuthority < 30 ? 'text-orange-600 font-medium' : 'text-gray-600'}`}>
                          {new Date(c.authorityExpiry).toLocaleDateString()}
                          {daysUntilAuthority !== null && (
                            <span className="ml-1">
                              ({daysUntilAuthority < 0 ? `${Math.abs(daysUntilAuthority)}d ago` : `${daysUntilAuthority}d left`})
                            </span>
                          )}
                        </div>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {c.w9OnFile
                        ? <CheckCircle className="h-4 w-4 text-green-500" />
                        : <XCircle className="h-4 w-4 text-red-400" />}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {flags.map((flag) => {
                          const { label, color, icon: Icon } = FLAG_LABELS[flag];
                          return (
                            <span key={flag} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
                              <Icon className="h-3 w-3" />{label}
                            </span>
                          );
                        })}
                      </div>
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
