'use client';

import { useState } from 'react';
import Topbar from '@/components/layout/Topbar';

interface WorkflowNode {
  type: 'trigger' | 'cond' | 'action';
  label: string;
}

interface Workflow {
  id: string;
  name: string;
  active: boolean;
  runs: number;
  nodes: WorkflowNode[];
}

const DEFAULT_WORKFLOWS: Workflow[] = [
  {
    id: 'wf1',
    name: 'Auto-quote inbound emails',
    active: true,
    runs: 142,
    nodes: [
      { type: 'trigger', label: 'New email in shared inbox' },
      { type: 'cond', label: 'Contains pickup + delivery + commodity' },
      { type: 'action', label: 'Run AI extraction → create Pending quote' },
      { type: 'action', label: 'Notify assigned broker via dashboard' },
    ],
  },
  {
    id: 'wf2',
    name: 'Margin protection alert',
    active: true,
    runs: 89,
    nodes: [
      { type: 'trigger', label: 'Load created or carrier assigned' },
      { type: 'cond', label: 'Margin < 10%' },
      { type: 'action', label: 'Flag load at-risk in dispatch board' },
      { type: 'action', label: 'Alert broker + suggest re-rate' },
    ],
  },
  {
    id: 'wf3',
    name: 'Carrier fraud screen',
    active: true,
    runs: 34,
    nodes: [
      { type: 'trigger', label: 'Carrier assigned to load' },
      { type: 'cond', label: 'Bank change OR authority < 14 days' },
      { type: 'action', label: 'Block dispatch — hold for review' },
      { type: 'action', label: 'Open fraud review task in compliance' },
    ],
  },
  {
    id: 'wf4',
    name: 'Auto-post to load boards',
    active: false,
    runs: 0,
    nodes: [
      { type: 'trigger', label: 'Load status = Booked (no carrier)' },
      { type: 'cond', label: 'Load is unassigned for > 2 hours' },
      { type: 'action', label: 'Post to DAT + Truckstop automatically' },
      { type: 'action', label: 'Notify dispatcher with posting status' },
    ],
  },
  {
    id: 'wf5',
    name: 'Insurance expiry reminders',
    active: true,
    runs: 12,
    nodes: [
      { type: 'trigger', label: 'Daily compliance scan (6am CT)' },
      { type: 'cond', label: 'Carrier insurance expires within 30 days' },
      { type: 'action', label: 'Flag carrier in compliance board' },
      { type: 'action', label: 'Email carrier with renewal reminder' },
    ],
  },
];

const NODE_LABELS: Record<string, string> = {
  trigger: 'When',
  cond: 'If',
  action: 'Then',
};

const TRIGGER_OPTIONS = ['New email received', 'Load created', 'Load status changed', 'Carrier assigned', 'Quote approved', 'Daily scheduled scan'];
const CONDITION_OPTIONS = ['Margin below threshold', 'Contains load details', 'Carrier risk = high', 'Authority < 14 days', 'Load unassigned > 2h', 'Always run'];
const ACTION_OPTIONS = ['Run AI extraction', 'Post to load boards', 'Notify broker', 'Flag at-risk', 'Generate AI email', 'Block carrier dispatch', 'Update load status'];

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>(DEFAULT_WORKFLOWS);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', trigger: TRIGGER_OPTIONS[0], condition: CONDITION_OPTIONS[0], action: ACTION_OPTIONS[0] });
  const [saved, setSaved] = useState('');

  function toggleActive(id: string) {
    setWorkflows(prev => prev.map(w => w.id === id ? { ...w, active: !w.active } : w));
  }

  function createWorkflow() {
    if (!newForm.name.trim()) return;
    const wf: Workflow = {
      id: 'wf' + Date.now(),
      name: newForm.name,
      active: true,
      runs: 0,
      nodes: [
        { type: 'trigger', label: newForm.trigger },
        { type: 'cond', label: newForm.condition },
        { type: 'action', label: newForm.action },
      ],
    };
    setWorkflows(prev => [wf, ...prev]);
    setShowNew(false);
    setNewForm({ name: '', trigger: TRIGGER_OPTIONS[0], condition: CONDITION_OPTIONS[0], action: ACTION_OPTIONS[0] });
    setSaved(wf.name);
    setTimeout(() => setSaved(''), 2500);
  }

  const activeCount = workflows.filter(w => w.active).length;
  const totalRuns = workflows.reduce((s, w) => s + w.runs, 0);

  return (
    <>
      <Topbar title="Workflow Builder" />
      <main style={{ flex: 1, overflowY: 'auto', padding: '22px 26px 60px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 21, letterSpacing: '-0.4px', display: 'flex', alignItems: 'center', gap: 10 }}>
              Workflow Automation
              <span className="ai-chip">✦ AI</span>
            </h1>
            <div style={{ color: '#475569', fontSize: 13, marginTop: 3 }}>
              Trigger → Condition → Action. Build agentic automations without code.
            </div>
          </div>
          <button onClick={() => setShowNew(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid #1d4ed8', background: '#1d4ed8', color: '#fff', borderRadius: 8, padding: '8px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            + New Workflow
          </button>
        </div>

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
          {[
            { label: 'Total Workflows', value: workflows.length, color: '#1d4ed8' },
            { label: 'Active', value: activeCount, color: '#15803d' },
            { label: 'Inactive', value: workflows.length - activeCount, color: '#94a3b8' },
            { label: 'Total Runs', value: totalRuns, color: '#6d28d9' },
          ].map((k) => (
            <div key={k.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 13, color: '#475569', fontWeight: 600, marginBottom: 2 }}>{k.label}</div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 26, fontWeight: 700, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* New workflow form */}
        {showNew && (
          <div style={{ background: '#fff', border: '1px solid #1d4ed8', borderRadius: 10, padding: 20, marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>New Workflow</h3>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }}>Workflow Name</label>
              <input value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} placeholder="e.g. Auto-post covered loads" style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 7, padding: '9px 11px', fontSize: 13, outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Trigger */}
              <div className="flownode trigger">
                <div className="ntype">When (Trigger)</div>
                <select value={newForm.trigger} onChange={(e) => setNewForm({ ...newForm, trigger: e.target.value })} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 6, padding: '7px 8px', marginTop: 6, fontSize: 13, outline: 'none' }}>
                  {TRIGGER_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 16 }}>↓</div>
              {/* Condition */}
              <div className="flownode cond">
                <div className="ntype">If (Condition)</div>
                <select value={newForm.condition} onChange={(e) => setNewForm({ ...newForm, condition: e.target.value })} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 6, padding: '7px 8px', marginTop: 6, fontSize: 13, outline: 'none' }}>
                  {CONDITION_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 16 }}>↓</div>
              {/* Action */}
              <div className="flownode action">
                <div className="ntype">Then (Action)</div>
                <select value={newForm.action} onChange={(e) => setNewForm({ ...newForm, action: e.target.value })} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 6, padding: '7px 8px', marginTop: 6, fontSize: 13, outline: 'none' }}>
                  {ACTION_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button onClick={() => setShowNew(false)} style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: 8, padding: '8px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: '#475569' }}>Cancel</button>
              <button onClick={createWorkflow} style={{ border: '1px solid #1d4ed8', background: '#1d4ed8', color: '#fff', borderRadius: 8, padding: '8px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Save & Activate</button>
            </div>
          </div>
        )}

        {saved && (
          <div style={{ background: '#ecfdf3', border: '1px solid #15803d', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#15803d', fontWeight: 600 }}>
            ✓ Workflow "{saved}" activated successfully.
          </div>
        )}

        {/* Workflow cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {workflows.map((w) => (
            <div key={w.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, opacity: w.active ? 1 : 0.65 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, flex: 1, paddingRight: 8 }}>{w.name}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: w.active ? '#ecfdf3' : '#f1f5f9', color: w.active ? '#15803d' : '#94a3b8' }}>
                    {w.active ? 'Active' : 'Off'}
                  </span>
                  <button
                    onClick={() => toggleActive(w.id)}
                    style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#475569' }}
                  >
                    {w.active ? 'Pause' : 'Activate'}
                  </button>
                </div>
              </div>

              {/* Flow visualization */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {w.nodes.map((node, i) => (
                  <div key={i}>
                    <div className={`flownode ${node.type}`} style={{ padding: '9px 12px' }}>
                      <div className="ntype">{NODE_LABELS[node.type]}</div>
                      <div style={{ fontSize: 12, color: '#15202b', marginTop: 2 }}>{node.label}</div>
                    </div>
                    {i < w.nodes.length - 1 && (
                      <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 14, margin: '-2px 0' }}>↓</div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8' }}>
                <span>{w.runs} total runs</span>
                <button style={{ border: 0, background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 11, padding: 0 }}>Edit →</button>
              </div>
            </div>
          ))}
        </div>

        {/* Info callout */}
        <div className="callout" style={{ marginTop: 20 }}>
          <span>✦</span>
          <div>
            <strong>AI-powered execution:</strong> Workflows run on the backend using your live TMS data.
            The AI Intake workflow processes emails in real-time via your configured IMAP mailbox.
            Connect your ANTHROPIC_API_KEY to enable intelligent extraction and email drafting.
          </div>
        </div>

      </main>
    </>
  );
}
