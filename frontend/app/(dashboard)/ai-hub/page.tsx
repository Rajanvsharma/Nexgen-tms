'use client';

import { useEffect, useState, useCallback } from 'react';
import Topbar from '@/components/layout/Topbar';
import api from '@/lib/api';

interface AgentLog {
  id: string;
  agentName: string;
  status: 'RUNNING' | 'COMPLETED' | 'ERROR';
  summary: string | null;
  findings: number;
  actions: number;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface Insight {
  title: string;
  insight: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
}

const AGENTS = [
  { name: 'Compliance Guardian', icon: '🛡', desc: 'Scans carrier documents daily. Blocks carriers with expired insurance/authority.', schedule: 'Daily 6am', color: '#0e7490' },
  { name: 'Fraud Sentinel', icon: '🔍', desc: 'Monitors active loads for risky carrier assignments every 6 hours.', schedule: 'Every 6h', color: '#b91c1c' },
  { name: 'Invoice Aging Agent', icon: '💰', desc: 'Marks overdue invoices and tracks aging buckets. Runs daily.', schedule: 'Daily 7am', color: '#b45309' },
  { name: 'Rate Intelligence Agent', icon: '📊', desc: 'Flags loads with margins below 10% and suggests re-pricing.', schedule: 'Every 12h', color: '#6d28d9' },
  { name: 'Email Processing Agent', icon: '📧', desc: 'Polls IMAP mailboxes and creates quote leads from inbound emails.', schedule: 'Every 30m', color: '#1d4ed8' },
  { name: 'AI Insights Agent', icon: '✦', desc: 'Uses Claude AI to generate daily business briefings posted as announcements.', schedule: 'Daily 8am', color: '#15803d', requiresKey: true },
  { name: 'Duplicate Detector', icon: '⚡', desc: 'Detects duplicate load entries with same customer, lane, and date.', schedule: 'Every 1h', color: '#475569' },
];

const PRIORITY_COLORS = { high: '#b91c1c', medium: '#b45309', low: '#15803d' };
const STATUS_COLORS = { RUNNING: '#b45309', COMPLETED: '#15803d', ERROR: '#b91c1c' };

export default function AIHubPage() {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState('');
  const [triggering, setTriggering] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  const loadLogs = useCallback(async () => {
    try {
      const { data } = await api.get('/ai/agent-logs');
      setLogs(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 5000);
    return () => clearInterval(interval);
  }, [loadLogs]);

  async function loadInsights() {
    setInsightsLoading(true);
    setInsightsError('');
    try {
      const { data } = await api.get('/ai/insights');
      setInsights(data.insights || []);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setInsightsError(msg || 'Failed to load insights');
    } finally {
      setInsightsLoading(false);
    }
  }

  async function triggerAgent(name: string) {
    setTriggering(name);
    try {
      await api.post(`/ai/agents/${encodeURIComponent(name)}/run`);
      showToast(`${name} triggered — running now`);
      setTimeout(loadLogs, 2000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(msg || 'Failed to trigger agent');
    } finally {
      setTriggering(null);
    }
  }

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  }

  function getLastRun(name: string) {
    const agentLogs = logs.filter(l => l.agentName === name).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    return agentLogs[0] || null;
  }

  const totalFindings = logs.filter(l => l.status === 'COMPLETED').reduce((s, l) => s + l.findings, 0);
  const totalActions = logs.filter(l => l.status === 'COMPLETED').reduce((s, l) => s + l.actions, 0);
  const errorCount = logs.filter(l => l.status === 'ERROR').length;
  const runningCount = logs.filter(l => l.status === 'RUNNING').length;

  return (
    <>
      <Topbar title="AI Hub" />
      <main style={{ flex: 1, overflowY: 'auto', padding: '22px 26px 60px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 21, letterSpacing: '-0.4px', display: 'flex', alignItems: 'center', gap: 10 }}>
              AI Command Center
              <span className="ai-chip">✦ 7 Autonomous Agents</span>
            </h1>
            <div style={{ color: '#475569', fontSize: 13, marginTop: 3 }}>
              All agents run on schedule. Click "Run Now" to trigger manually.
            </div>
          </div>
          <button
            onClick={loadInsights}
            disabled={insightsLoading}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#1d4ed8', border: '1px solid #1d4ed8', color: '#fff', borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13, cursor: insightsLoading ? 'not-allowed' : 'pointer', opacity: insightsLoading ? 0.8 : 1 }}
          >
            {insightsLoading ? '✦ Generating…' : '✦ Get AI Insights'}
          </button>
        </div>

        {/* KPI Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
          {[
            { label: 'Active Agents', value: AGENTS.length, color: '#1d4ed8' },
            { label: 'Currently Running', value: runningCount, color: '#b45309' },
            { label: 'Total Findings', value: totalFindings, color: '#6d28d9' },
            { label: 'Actions Taken', value: totalActions, color: '#15803d' },
          ].map(k => (
            <div key={k.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 26, fontWeight: 700, color: k.color, marginTop: 2 }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* AI Insights */}
        {insightsError && (
          <div className="callout warn" style={{ marginBottom: 16 }}>
            <span>⚠</span><div>{insightsError}</div>
          </div>
        )}
        {insights.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="ai-chip">✦ Claude AI</span> Live Business Insights
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {insights.map((ins, i) => (
                <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, borderLeft: `4px solid ${PRIORITY_COLORS[ins.priority]}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{ins.title}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: ins.priority === 'high' ? '#fef2f2' : ins.priority === 'medium' ? '#fef6e7' : '#ecfdf3', color: PRIORITY_COLORS[ins.priority] }}>{ins.priority.toUpperCase()}</span>
                  </div>
                  <p style={{ margin: '0 0 8px', fontSize: 13, color: '#475569', lineHeight: 1.5 }}>{ins.insight}</p>
                  <div style={{ fontSize: 12, color: '#1d4ed8', fontWeight: 600 }}>→ {ins.action}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Agent Cards */}
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Autonomous Agents</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 24 }}>
          {AGENTS.map((agent) => {
            const last = getLastRun(agent.name);
            const isRunning = last?.status === 'RUNNING' || triggering === agent.name;
            const isTriggering = triggering === agent.name;

            return (
              <div key={agent.name} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, borderLeft: `4px solid ${agent.color}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 18 }}>{agent.icon}</span>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{agent.name}</span>
                      {agent.requiresKey && <span className="ai-chip" style={{ fontSize: 10 }}>Claude</span>}
                    </div>
                    <p style={{ margin: '0 0 10px', fontSize: 12, color: '#475569', lineHeight: 1.4 }}>{agent.desc}</p>
                    <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
                      <span style={{ color: '#94a3b8' }}>⏱ {agent.schedule}</span>
                      {last && (
                        <>
                          <span style={{ color: STATUS_COLORS[last.status], fontWeight: 600 }}>● {last.status}</span>
                          <span style={{ color: '#94a3b8' }}>{last.findings} findings · {last.actions} actions</span>
                        </>
                      )}
                    </div>
                    {last?.summary && (
                      <div style={{ marginTop: 8, fontSize: 11, color: '#475569', background: '#f8fafc', borderRadius: 6, padding: '6px 8px', lineHeight: 1.4 }}>
                        {last.summary.length > 120 ? last.summary.slice(0, 120) + '…' : last.summary}
                      </div>
                    )}
                    {last?.error && (
                      <div style={{ marginTop: 8, fontSize: 11, color: '#b91c1c', background: '#fef2f2', borderRadius: 6, padding: '6px 8px' }}>
                        Error: {last.error}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => triggerAgent(agent.name)}
                    disabled={isRunning}
                    style={{ border: '1px solid #e2e8f0', background: isRunning ? '#f8fafc' : '#fff', borderRadius: 7, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: isRunning ? 'not-allowed' : 'pointer', color: isRunning ? '#94a3b8' : '#1d4ed8', whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    {isTriggering ? '⏳ Running…' : isRunning ? '⏳ Running' : '▶ Run Now'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Agent Logs */}
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Recent Agent Activity</h3>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
          {logs.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              No agent activity yet. Agents run on schedule or click "Run Now" above.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {['Agent', 'Status', 'Summary', 'Findings', 'Actions', 'Ran At'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#94a3b8', fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 30).map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{log.agentName}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: log.status === 'COMPLETED' ? '#ecfdf3' : log.status === 'RUNNING' ? '#fef6e7' : '#fef2f2', color: STATUS_COLORS[log.status] }}>
                        {log.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#475569', fontSize: 12, maxWidth: 300 }}>
                      {log.error ? <span style={{ color: '#b91c1c' }}>{log.error}</span> : (log.summary || '—')}
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'IBM Plex Mono, monospace' }}>{log.findings}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'IBM Plex Mono, monospace' }}>{log.actions}</td>
                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 12 }}>
                      {new Date(log.startedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </main>

      {toastMsg && (
        <div style={{ position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)', background: '#fff', border: '1px solid #e2e8f0', borderLeft: '4px solid #15803d', borderRadius: 8, padding: '12px 20px', fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', zIndex: 9000 }}>
          {toastMsg}
        </div>
      )}
    </>
  );
}
