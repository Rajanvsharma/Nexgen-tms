'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface OrgInfo {
  plan: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
}

export default function TrialBanner() {
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    api.get('/organization').then(r => setOrg(r.data)).catch(() => {});
  }, []);

  if (!org) return null;
  if (org.subscriptionStatus === 'active') return null;

  const daysLeft = org.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(org.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const expired = daysLeft === 0 && org.subscriptionStatus === 'trialing';

  async function upgrade() {
    setUpgrading(true);
    try {
      const { data } = await api.post('/stripe/checkout', { planId: 'starter' });
      if (data.url) window.location.href = data.url;
      else alert('Stripe not configured. Add STRIPE_SECRET_KEY to backend environment.');
    } catch {
      alert('Billing not available. Contact support.');
    } finally { setUpgrading(false); }
  }

  return (
    <div style={{
      background: expired ? '#dc2626' : daysLeft <= 3 ? '#f59e0b' : '#1e40af',
      color: '#fff',
      padding: '8px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: 13,
      fontFamily: 'Inter, sans-serif',
    }}>
      <span>
        {expired
          ? '⚠ Your trial has expired. Upgrade to continue using NexGen TMS.'
          : `⏰ Trial: ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining. Upgrade to keep your data and features.`}
      </span>
      <button
        onClick={upgrade}
        disabled={upgrading}
        style={{
          marginLeft: 16, padding: '5px 16px', background: '#fff',
          color: expired ? '#dc2626' : daysLeft <= 3 ? '#92400e' : '#1e40af',
          border: 'none', borderRadius: 20, fontSize: 12, fontWeight: 700,
          cursor: 'pointer', opacity: upgrading ? 0.7 : 1, whiteSpace: 'nowrap',
        }}
      >
        {upgrading ? 'Loading…' : 'Upgrade Now →'}
      </button>
    </div>
  );
}
