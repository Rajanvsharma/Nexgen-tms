const prisma = require('../services/prisma.service');
const { fireWorkflowEvent, seedDefaultWorkflows } = require('../services/workflow.service');

async function getWorkflows(req, res) {
  try {
    const orgId = req.user.organizationId;
    await seedDefaultWorkflows(orgId);

    const workflows = await prisma.workflow.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'asc' },
      include: {
        runs: {
          orderBy: { runAt: 'desc' },
          take: 5,
          select: { id: true, status: true, summary: true, runAt: true },
        },
      },
    });
    res.json(workflows);
  } catch (err) {
    console.error('getWorkflows error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function createWorkflow(req, res) {
  try {
    const orgId = req.user.organizationId;
    const { name, trigger, conditionType, conditionValue, actions } = req.body;
    if (!name || !trigger) return res.status(400).json({ message: 'name and trigger are required' });

    const wf = await prisma.workflow.create({
      data: {
        organizationId: orgId,
        name,
        trigger,
        conditionType: conditionType || 'always',
        conditionValue: conditionValue || null,
        actions: Array.isArray(actions) ? actions : [],
        active: true,
      },
    });
    res.status(201).json(wf);
  } catch (err) {
    console.error('createWorkflow error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateWorkflow(req, res) {
  try {
    const orgId = req.user.organizationId;
    const existing = await prisma.workflow.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!existing) return res.status(404).json({ message: 'Workflow not found' });

    const { name, trigger, conditionType, conditionValue, actions, active } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (trigger !== undefined) data.trigger = trigger;
    if (conditionType !== undefined) data.conditionType = conditionType;
    if (conditionValue !== undefined) data.conditionValue = conditionValue;
    if (actions !== undefined) data.actions = actions;
    if (active !== undefined) data.active = active;

    const wf = await prisma.workflow.update({ where: { id: req.params.id }, data });
    res.json(wf);
  } catch (err) {
    console.error('updateWorkflow error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function toggleWorkflow(req, res) {
  try {
    const orgId = req.user.organizationId;
    const existing = await prisma.workflow.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!existing) return res.status(404).json({ message: 'Workflow not found' });
    const wf = await prisma.workflow.update({ where: { id: req.params.id }, data: { active: !existing.active } });
    res.json(wf);
  } catch (err) {
    console.error('toggleWorkflow error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function deleteWorkflow(req, res) {
  try {
    const orgId = req.user.organizationId;
    const existing = await prisma.workflow.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!existing) return res.status(404).json({ message: 'Workflow not found' });
    await prisma.workflow.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('deleteWorkflow error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getWorkflowRuns(req, res) {
  try {
    const orgId = req.user.organizationId;
    const wf = await prisma.workflow.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!wf) return res.status(404).json({ message: 'Workflow not found' });

    const runs = await prisma.workflowRun.findMany({
      where: { workflowId: req.params.id },
      orderBy: { runAt: 'desc' },
      take: 50,
    });
    res.json(runs);
  } catch (err) {
    console.error('getWorkflowRuns error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function testWorkflow(req, res) {
  try {
    const orgId = req.user.organizationId;
    const wf = await prisma.workflow.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!wf) return res.status(404).json({ message: 'Workflow not found' });

    // Build a synthetic test context based on trigger type
    let ctx = { organizationId: orgId };
    if (wf.trigger === 'load_created' || wf.trigger === 'load_status_changed' || wf.trigger === 'carrier_assigned') {
      const load = await prisma.load.findFirst({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' } });
      if (!load) return res.status(400).json({ message: 'No loads found to test against' });
      ctx.load = load;
      ctx.summary = `Test run on load ${load.loadNumber}`;
      if (wf.trigger === 'carrier_assigned' && load.carrierId) {
        ctx.carrier = await prisma.carrier.findUnique({ where: { id: load.carrierId } });
      }
    } else if (wf.trigger === 'daily_scan' && wf.conditionType === 'carrier_doc_expiring') {
      const carrier = await prisma.carrier.findFirst({
        where: { organizationId: orgId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      });
      if (!carrier) return res.status(400).json({ message: 'No active carriers found to test against' });
      ctx.carrier = carrier;
      ctx.summary = `Test run on carrier ${carrier.name}`;
    }

    await fireWorkflowEvent(wf.trigger, { ...ctx, organizationId: orgId });
    res.json({ message: 'Test run triggered. Check the run history below.' });
  } catch (err) {
    console.error('testWorkflow error:', err);
    res.status(500).json({ message: err.message });
  }
}

module.exports = { getWorkflows, createWorkflow, updateWorkflow, toggleWorkflow, deleteWorkflow, getWorkflowRuns, testWorkflow };
