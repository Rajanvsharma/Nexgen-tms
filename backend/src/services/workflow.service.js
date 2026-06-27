const prisma = require('./prisma.service');

// ── Condition evaluators ─────────────────────────────────────────────────────

function evalCondition(conditionType, conditionValue, ctx) {
  switch (conditionType) {
    case 'always':
      return true;

    case 'margin_below': {
      const threshold = parseFloat(conditionValue ?? '10');
      const { load } = ctx;
      if (!load?.customerRate || !load?.carrierRate) return false;
      const margin = ((load.customerRate - load.carrierRate) / load.customerRate) * 100;
      return margin < threshold;
    }

    case 'carrier_new': {
      const { carrier } = ctx;
      if (!carrier) return false;
      const days = parseFloat(conditionValue ?? '14');
      if (!carrier.createdAt) return false;
      const agedays = (Date.now() - new Date(carrier.createdAt)) / 86400000;
      return agedays < days;
    }

    case 'carrier_doc_expiring': {
      const { carrier } = ctx;
      if (!carrier) return false;
      const days = parseFloat(conditionValue ?? '30');
      const cutoff = new Date(Date.now() + days * 86400000);
      const insExp  = carrier.insuranceExpiry && new Date(carrier.insuranceExpiry) < cutoff;
      const authExp = carrier.authorityExpiry && new Date(carrier.authorityExpiry) < cutoff;
      return !!(insExp || authExp);
    }

    case 'load_no_carrier': {
      const { load } = ctx;
      return !load?.carrierId;
    }

    default:
      return true;
  }
}

// ── Action executors ─────────────────────────────────────────────────────────

async function runAction(action, ctx, orgId) {
  switch (action.type) {
    case 'flag_load': {
      const { load } = ctx;
      if (!load?.id) return { ok: false, reason: 'no load in context' };
      const msg = action.message || 'Flagged by workflow automation';
      const existing = await prisma.load.findUnique({ where: { id: load.id }, select: { specialInstructions: true } });
      const prefix = `[⚠ WORKFLOW] ${msg}`;
      const updated = existing?.specialInstructions?.includes(prefix)
        ? existing.specialInstructions
        : `${prefix}\n${existing?.specialInstructions || ''}`.trim();
      await prisma.load.update({ where: { id: load.id }, data: { specialInstructions: updated } });
      return { ok: true };
    }

    case 'flag_carrier': {
      const { carrier } = ctx;
      if (!carrier?.id) return { ok: false, reason: 'no carrier in context' };
      const msg = action.message || 'Flagged by workflow automation';
      const existing = await prisma.carrier.findUnique({ where: { id: carrier.id }, select: { notes: true } });
      const prefix = `[⚠ WORKFLOW] ${msg}`;
      const updated = existing?.notes?.includes(prefix)
        ? existing.notes
        : `${prefix}\n${existing?.notes || ''}`.trim();
      await prisma.carrier.update({ where: { id: carrier.id }, data: { notes: updated } });
      return { ok: true };
    }

    case 'update_load_status': {
      const { load } = ctx;
      if (!load?.id || !action.status) return { ok: false, reason: 'missing load or status' };
      await prisma.load.update({ where: { id: load.id }, data: { status: action.status } });
      return { ok: true };
    }

    case 'create_alert': {
      const summary = action.message || ctx.summary || 'Workflow automation alert';
      await prisma.agentLog.create({
        data: {
          agentName: `Workflow Alert`,
          status: 'COMPLETED',
          summary,
          findings: 1,
          actions: 1,
        },
      });
      return { ok: true };
    }

    default:
      return { ok: false, reason: `unknown action type: ${action.type}` };
  }
}

// ── Core fire function ───────────────────────────────────────────────────────

async function fireWorkflowEvent(triggerType, ctx) {
  const { organizationId } = ctx;
  if (!organizationId) return;

  let workflows;
  try {
    workflows = await prisma.workflow.findMany({
      where: { organizationId, trigger: triggerType, active: true },
    });
  } catch (err) {
    console.error('workflow lookup error:', err.message);
    return;
  }

  for (const wf of workflows) {
    await _runWorkflow(wf, ctx);
  }
}

async function _runWorkflow(wf, ctx) {
  const conditionMet = evalCondition(wf.conditionType, wf.conditionValue, ctx);
  const actions = Array.isArray(wf.actions) ? wf.actions : [];

  let status = 'skipped';
  let summary = 'Condition not met — skipped';
  const results = [];

  if (conditionMet) {
    for (const action of actions) {
      try {
        const r = await runAction(action, ctx, wf.organizationId);
        results.push({ type: action.type, ...r });
      } catch (err) {
        results.push({ type: action.type, ok: false, reason: err.message });
      }
    }
    const failed = results.filter(r => !r.ok).length;
    status = failed === 0 ? 'success' : failed === results.length ? 'failed' : 'partial';
    summary = `Ran ${results.length} action(s): ${results.map(r => `${r.type}=${r.ok ? 'ok' : r.reason}`).join(', ')}`;
  }

  try {
    await prisma.workflowRun.create({
      data: {
        workflowId: wf.id,
        status,
        summary,
        context: { trigger: wf.trigger, conditionMet, entity: ctx.summary || null },
      },
    });
    await prisma.workflow.update({
      where: { id: wf.id },
      data: { totalRuns: { increment: 1 }, lastRunAt: new Date() },
    });
  } catch (err) {
    console.error('workflow run log error:', err.message);
  }
}

// ── Daily scan ───────────────────────────────────────────────────────────────

async function runDailyScan() {
  console.log('[workflow] running daily scan');
  try {
    const workflows = await prisma.workflow.findMany({
      where: { trigger: 'daily_scan', active: true },
    });

    for (const wf of workflows) {
      if (wf.conditionType === 'carrier_doc_expiring') {
        const days = parseFloat(wf.conditionValue ?? '30');
        const cutoff = new Date(Date.now() + days * 86400000);
        const expiring = await prisma.carrier.findMany({
          where: {
            organizationId: wf.organizationId,
            status: 'ACTIVE',
            OR: [
              { insuranceExpiry: { lte: cutoff, not: null } },
              { authorityExpiry: { lte: cutoff, not: null } },
            ],
          },
        });
        for (const carrier of expiring) {
          const daysLeft = Math.min(
            carrier.insuranceExpiry ? Math.ceil((new Date(carrier.insuranceExpiry) - Date.now()) / 86400000) : 999,
            carrier.authorityExpiry ? Math.ceil((new Date(carrier.authorityExpiry) - Date.now()) / 86400000) : 999,
          );
          await _runWorkflow(wf, {
            organizationId: wf.organizationId,
            carrier,
            summary: `${carrier.name} — docs expire in ${daysLeft} day(s)`,
          });
        }
      } else if (wf.conditionType === 'load_no_carrier') {
        const hours = parseFloat(wf.conditionValue ?? '2');
        const cutoff = new Date(Date.now() - hours * 3600000);
        const loads = await prisma.load.findMany({
          where: {
            organizationId: wf.organizationId,
            carrierId: null,
            status: { in: ['CREATED', 'BOOKED'] },
            createdAt: { lte: cutoff },
          },
        });
        for (const load of loads) {
          await _runWorkflow(wf, {
            organizationId: wf.organizationId,
            load,
            summary: `Load ${load.loadNumber} has no carrier assigned`,
          });
        }
      } else {
        await _runWorkflow(wf, { organizationId: wf.organizationId });
      }
    }
  } catch (err) {
    console.error('[workflow] daily scan error:', err.message);
  }
}

// ── Seeder — create default workflows for a new org ─────────────────────────

async function seedDefaultWorkflows(organizationId) {
  const count = await prisma.workflow.count({ where: { organizationId } });
  if (count > 0) return; // already seeded

  await prisma.workflow.createMany({
    data: [
      {
        organizationId,
        name: 'Margin Protection Alert',
        trigger: 'load_created',
        conditionType: 'margin_below',
        conditionValue: '10',
        active: true,
        actions: [
          { type: 'flag_load', message: 'Low margin detected — review before dispatch' },
          { type: 'create_alert', message: 'Low margin load created — check Loads page' },
        ],
      },
      {
        organizationId,
        name: 'Carrier Fraud Screen',
        trigger: 'carrier_assigned',
        conditionType: 'carrier_new',
        conditionValue: '14',
        active: true,
        actions: [
          { type: 'flag_load', message: 'New carrier (<14 days) assigned — verify before dispatch' },
          { type: 'flag_carrier', message: 'Recently onboarded — pending fraud review' },
        ],
      },
      {
        organizationId,
        name: 'Insurance Expiry Reminders',
        trigger: 'daily_scan',
        conditionType: 'carrier_doc_expiring',
        conditionValue: '30',
        active: true,
        actions: [
          { type: 'flag_carrier', message: 'Documents expiring soon — renew before next dispatch' },
          { type: 'create_alert', message: 'Carrier has expiring documents — check Compliance' },
        ],
      },
    ],
  });
  console.log(`[workflow] seeded default workflows for org ${organizationId}`);
}

module.exports = { fireWorkflowEvent, runDailyScan, seedDefaultWorkflows };
