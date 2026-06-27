'use client';

import { useState, useEffect, useCallback } from 'react';
import Topbar from '@/components/layout/Topbar';
import api from '@/lib/api';

interface WorkflowRun {
  id: string;
  status: string;
  summary: string | null;
  runAt: string;
}

interface Workflow {
  id: string;
  name: string;
  active: boolean;
  trigger: string;
  conditionType: string;
  conditionValue: string | null;
  actions: { type: string; message?: string; status?: string }[];
  totalRuns: number;
  lastRunAt: string | null;
  runs: WorkflowRun[];
}

const TRIGGER_OPTIONS = [
  { value: 'load_created',        label: 'Load Created' },
  { value: 'load_status_changed', label: 'Load Status Changed' },
  { value: 'carrier_assigned',    label: 'Carrier Assigned to Load' },
  { value: 'daily_scan',          label: 'Daily Scheduled Scan' },
];

const CONDITION_OPTIONS = [
  { value: 'always',               label: 'Always Run', hasValue: false },
  { value: 'margin_below',         label: 'Margin Below X%', hasValue: true, placeholder: '10' },
  { value: 'carrier_new',          label: 'Carrier Authority < X Days Old', hasValue: true, placeholder: '14' },
  { value: 'carrier_doc_expiring', label: 'Carrier Docs Expiring Within X Days', hasValue: true, placeholder: '30' },
  { value: 'load_no_carrier',      label: 'Load Has No Carrier Assigned', hasValue: false },
];

const ACTION_OPTIONS = [
  { value: 'flag_load',         label: 'Flag Load with Alert' },
  { value: 'flag_carrier',      label: 'Flag Carrier with Alert' },
  { value: 'update_load_status',label: 'Change Load Status' },
  { value: 'create_alert',      label: 'Create Dashboard Alert' },
];

const TRIGGER_LABEL: Record<string, string> = {
  load_created: 'Load Created',
  load_status_changed: 'Load Status Changed',
  carrier_assigned: 'Carrier Assigned',
  daily_scan: 'Daily Scan',
};

const CONDITION_LABEL: Record<string, string> = {
  always: 'Always',
  margin_below: 'Margin <',
  carrier_new: 'Carrier age <',
  carrier_doc_expiring: 'Docs expire within',
  load_no_carrier: 'No carrier assigned',
};

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  success: { bg: '#dcfce7', color: '#15803d' },
  skipped: { bg: '#f1f5f9', color: '#64748b' },
  failed:  { bg: '#fee2e2', color: '#b91c1c' },
  partial: { bg: '#fef3c7', color: '#b45309' },
};

const NODE_COLORS: Record<string, { border: string; color: string; label: string }> = {
  trigger: { border: '#3b82f6', color: '#1d4ed8', label: 'WHEN' },
  cond:    { border: '#f59e0b', color: '#b45309', label: 'IF' },
  action:  { border: '#22c55e', color: '#15803d', label: 'THEN' },
};

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [selectedRuns, setSelectedRuns] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<{ id: string; msg: string; ok: boolean } | null>(null);
  const [newForm, setNewForm] = useState({
    name: '',
    trigger: 'load_created',
    conditionType: 'always',
    conditionValue: '',
    actionType: 'flag_load',
    actionMessage: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/workflows');
      setWorkflows(data);
    } catch (e: unknown) {
      setError('Failed to load workflows');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggle(id: string) {
    try {
      const { data } = await api.patch(`/workflows/${id}/toggle`);
      setWorkflows(prev => prev.map(w => w.id === id ? { ...w, active: data.active } : w));
    } catch { setError('Failed to toggle workflow'); }
  }

  async function deleteWf(id: string) {
    if (!confirm('Delete this workflow?')) return;
    try {
      await api.delete(`/workflows/${id}`);
      setWorkflows(prev => prev.filter(w => w.id !== id));
    } catch { setError('Failed to delete workflow'); }
  }

  async function createWorkflow() {
    if (!newForm.name.trim()) return;
    setSaving(true);
    try {
      const condOption = CONDITION_OPTIONS.find(c => c.value === newForm.conditionType);
      const { data } = await api.post('/workflows', {
        name: newForm.name,
        trigger: newForm.trigger,
        conditionType: newForm.conditionType,
        conditionValue: condOption?.hasValue ? newForm.conditionValue || condOption.placeholder : null,
        actions: [
          { type: newForm.actionType, message: newForm.actionMessage || undefined },
        ],
      });
      setWorkflows(prev => [data, ...prev]);
      setShowNew(false);
      setNewForm({ name: '', trigger: 'load_created', conditionType: 'always', conditionValue: '', actionType: 'flag_load', actionMessage: '' });
    } catch { setError('Failed to create workflow'); }
    finally { setSaving(false); }
  }

  async function testWorkflow(id: string) {
    setTestingId(id);
    setTestMsg(null);
    try {
      const { data } = await api.post(`/workflows/${id}/test`);
      setTestMsg({ id, msg: data.message, ok: true });
      // Refresh to pick up new run
      setTimeout(load, 1000);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Test failed';
      setTestMsg({ id, msg, ok: false });
    } finally {
      setTestingId(null);
    }
  }

  async function loadRuns(id: string) {
    setSelectedRuns(id === selectedRuns ? null : id);
  }

  const activeCount = workflows.filter(w => w.active).length;
  const totalRuns   = workflows.reduce((s, w) => s + w.totalRuns, 0);

  const condOpt = CONDITION_OPTIONS.find(c => c.value === newForm.conditionType);

  return (
    <>
      <Topbar title="Automation" />
      <main style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', padding: '22px 26px 60px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: '-0.4px', display: 'flex', alignItems: 'center', gap: 10 }}>
              Workflow Automation <span className="ai-chip">✦ LIVE</span>
            </h1>
            <div style={{ color: '#475569', fontSize: 13, marginTop: 3 }}>
              Real automations — every trigger fires against your live TMS data.
            </div>
          </div>
          <button onClick={() => { setShowNew(true); setError(''); }} style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid #1d4ed8', background: '#1d4ed8', color: '#fff', borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            + New Workflow
          </button>
        </div>

        {/* KPIs */}
        <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
          {[
            { label: 'Total Workflows', value: workflows.length, color: '#1d4ed8' },
            { label: 'Active', value: activeCount, color: '#15803d' },
            { label: 'Paused', value: workflows.length - activeCount, color: '#94a3b8' },
            { label: 'Total Runs', value: totalRuns, color: '#6d28d9' },
          ].map(k => (
            <div key={k.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 28, fontWeight: 800, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {error && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#b91c1c' }}>
            {error}
          </div>
        )}

        {/* Create form */}
        {showNew && (
          <div style={{ background: '#fff', border: '1px solid #3b82f6', borderRadius: 12, padding: 22, marginBottom: 22 }}>
            <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 700 }}>New Workflow</h3>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }}>Workflow Name</label>
              <input value={newForm.name} onChange={e => setNewForm({ ...newForm, name: e.target.value })}
                placeholder="e.g. Alert on low margin loads"
                style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 7, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Trigger */}
              <div className="flownode trigger" style={{ border: '1px solid #3b82f6', borderLeft: '4px solid #3b82f6', borderRadius: 8, padding: '12px 14px', background: '#eff6ff' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', letterSpacing: '0.5px', marginBottom: 6 }}>WHEN (Trigger)</div>
                <select value={newForm.trigger} onChange={e => setNewForm({ ...newForm, trigger: e.target.value })}
                  style={{ width: '100%', border: '1px solid #bfdbfe', borderRadius: 6, padding: '7px 10px', fontSize: 13, outline: 'none', background: '#fff' }}>
                  {TRIGGER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 18, margin: '-4px 0' }}>↓</div>
              {/* Condition */}
              <div style={{ border: '1px solid #f59e0b', borderLeft: '4px solid #f59e0b', borderRadius: 8, padding: '12px 14px', background: '#fffbeb' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#b45309', letterSpacing: '0.5px', marginBottom: 6 }}>IF (Condition)</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select value={newForm.conditionType} onChange={e => setNewForm({ ...newForm, conditionType: e.target.value, conditionValue: '' })}
                    style={{ flex: 1, border: '1px solid #fde68a', borderRadius: 6, padding: '7px 10px', fontSize: 13, outline: 'none', background: '#fff' }}>
                    {CONDITION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {condOpt?.hasValue && (
                    <input type="number" value={newForm.conditionValue}
                      onChange={e => setNewForm({ ...newForm, conditionValue: e.target.value })}
                      placeholder={condOpt.placeholder}
                      style={{ width: 80, border: '1px solid #fde68a', borderRadius: 6, padding: '7px 10px', fontSize: 13, outline: 'none' }} />
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 18, margin: '-4px 0' }}>↓</div>
              {/* Action */}
              <div style={{ border: '1px solid #22c55e', borderLeft: '4px solid #22c55e', borderRadius: 8, padding: '12px 14px', background: '#f0fdf4' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#15803d', letterSpacing: '0.5px', marginBottom: 6 }}>THEN (Action)</div>
                <select value={newForm.actionType} onChange={e => setNewForm({ ...newForm, actionType: e.target.value })}
                  style={{ width: '100%', border: '1px solid #bbf7d0', borderRadius: 6, padding: '7px 10px', fontSize: 13, outline: 'none', background: '#fff', marginBottom: 8 }}>
                  {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input value={newForm.actionMessage} onChange={e => setNewForm({ ...newForm, actionMessage: e.target.value })}
                  placeholder="Alert message (optional)"
                  style={{ width: '100%', border: '1px solid #bbf7d0', borderRadius: 6, padding: '7px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button onClick={() => setShowNew(false)} style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: '#475569' }}>Cancel</button>
              <button onClick={createWorkflow} disabled={saving || !newForm.name.trim()} style={{ border: '1px solid #1d4ed8', background: '#1d4ed8', color: '#fff', borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : 'Save & Activate'}
              </button>
            </div>
          </div>
        )}

        {/* Workflow cards */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading workflows…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {workflows.map(wf => (
              <div key={wf.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', opacity: wf.active ? 1 : 0.65 }}>
                {/* Card header */}
                <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{wf.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      {wf.totalRuns} run{wf.totalRuns !== 1 ? 's' : ''}
                      {wf.lastRunAt && ` · last ${new Date(wf.lastRunAt).toLocaleDateString()}`}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: wf.active ? '#dcfce7' : '#f1f5f9', color: wf.active ? '#15803d' : '#94a3b8', flexShrink: 0 }}>
                    {wf.active ? '● Active' : '○ Paused'}
                  </span>
                  <button onClick={() => testWorkflow(wf.id)} disabled={testingId === wf.id}
                    title="Test this workflow against your latest load/carrier"
                    style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#1d4ed8', flexShrink: 0, opacity: testingId === wf.id ? 0.6 : 1 }}>
                    {testingId === wf.id ? 'Running…' : '▶ Test'}
                  </button>
                  <button onClick={() => toggle(wf.id)}
                    style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#475569', flexShrink: 0 }}>
                    {wf.active ? 'Pause' : 'Activate'}
                  </button>
                  <button onClick={() => loadRuns(wf.id)}
                    style={{ border: '1px solid #e2e8f0', background: selectedRuns === wf.id ? '#f1f5f9' : '#fff', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#475569', flexShrink: 0 }}>
                    Runs {selectedRuns === wf.id ? '▲' : '▼'}
                  </button>
                  <button onClick={() => deleteWf(wf.id)}
                    style={{ border: '1px solid #fee2e2', background: '#fff', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#dc2626', flexShrink: 0 }}>
                    ✕
                  </button>
                </div>

                {/* Flow nodes */}
                <div style={{ padding: '14px 18px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Trigger node */}
                  <div style={{ border: `1px solid ${NODE_COLORS.trigger.border}`, borderLeft: `4px solid ${NODE_COLORS.trigger.border}`, borderRadius: 8, padding: '8px 12px', background: '#eff6ff', flexShrink: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: NODE_COLORS.trigger.color, letterSpacing: '0.5px' }}>WHEN</div>
                    <div style={{ fontSize: 12, color: '#15202b', marginTop: 2 }}>{TRIGGER_LABEL[wf.trigger] || wf.trigger}</div>
                  </div>
                  <span style={{ color: '#cbd5e1', fontSize: 18 }}>→</span>
                  {/* Condition node */}
                  <div style={{ border: `1px solid ${NODE_COLORS.cond.border}`, borderLeft: `4px solid ${NODE_COLORS.cond.border}`, borderRadius: 8, padding: '8px 12px', background: '#fffbeb', flexShrink: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: NODE_COLORS.cond.color, letterSpacing: '0.5px' }}>IF</div>
                    <div style={{ fontSize: 12, color: '#15202b', marginTop: 2 }}>
                      {CONDITION_LABEL[wf.conditionType] || wf.conditionType}
                      {wf.conditionValue ? ` ${wf.conditionValue}` : ''}
                      {wf.conditionType === 'margin_below' ? '%' : ''}
                      {wf.conditionType === 'carrier_new' || wf.conditionType === 'carrier_doc_expiring' ? ' days' : ''}
                    </div>
                  </div>
                  <span style={{ color: '#cbd5e1', fontSize: 18 }}>→</span>
                  {/* Action nodes */}
                  {wf.actions.map((a, i) => (
                    <div key={i} style={{ border: `1px solid ${NODE_COLORS.action.border}`, borderLeft: `4px solid ${NODE_COLORS.action.border}`, borderRadius: 8, padding: '8px 12px', background: '#f0fdf4', flexShrink: 0 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: NODE_COLORS.action.color, letterSpacing: '0.5px' }}>THEN</div>
                      <div style={{ fontSize: 12, color: '#15202b', marginTop: 2 }}>
                        {ACTION_OPTIONS.find(o => o.value === a.type)?.label || a.type}
                        {a.message && <span style={{ color: '#64748b', marginLeft: 4 }}>— {a.message.slice(0, 30)}{a.message.length > 30 ? '…' : ''}</span>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Test result */}
                {testMsg?.id === wf.id && (
                  <div style={{ margin: '0 18px 12px', padding: '8px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: testMsg.ok ? '#f0fdf4' : '#fee2e2', color: testMsg.ok ? '#15803d' : '#dc2626', border: `1px solid ${testMsg.ok ? '#bbf7d0' : '#fca5a5'}` }}>
                    {testMsg.ok ? '✓' : '✗'} {testMsg.msg}
                  </div>
                )}

                {/* Run history */}
                {selectedRuns === wf.id && (
                  <div style={{ borderTop: '1px solid #f1f5f9', background: '#f8fafc', padding: '12px 18px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>Recent Runs</div>
                    {wf.runs.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>No runs yet. Click ▶ Test to fire a test run.</div>
                    ) : (
                      wf.runs.map(r => {
                        const sc = STATUS_COLOR[r.status] || STATUS_COLOR.skipped;
                        return (
                          <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.color, flexShrink: 0, marginTop: 1 }}>
                              {r.status}
                            </span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, color: '#334155' }}>{r.summary || '—'}</div>
                              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{new Date(r.runAt).toLocaleString()}</div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="callout" style={{ marginTop: 24 }}>
          <span>✦</span>
          <div>
            <strong>How it works:</strong> Workflows fire automatically — <em>Margin Protection</em> runs every time a load is created, <em>Carrier Fraud Screen</em> fires when a carrier is assigned, and <em>Insurance Expiry</em> runs daily. Click <strong>▶ Test</strong> to fire a workflow manually against your most recent data.
          </div>
        </div>

      </main>
    </>
  );
}
