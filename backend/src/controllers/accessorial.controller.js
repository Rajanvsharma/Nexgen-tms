const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listAccessorials(req, res) {
  try {
    const orgId  = req.user.organizationId;
    const loadId = req.params.loadId;

    const load = await prisma.load.findFirst({ where: { id: loadId, organizationId: orgId } });
    if (!load) return res.status(404).json({ error: 'Load not found' });

    const items = await prisma.accessorial.findMany({
      where: { loadId, organizationId: orgId },
      include: { createdBy: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json(items);
  } catch (err) {
    console.error('listAccessorials error:', err);
    res.status(500).json({ error: 'Failed to fetch accessorials' });
  }
}

async function createAccessorial(req, res) {
  try {
    const orgId  = req.user.organizationId;
    const userId = req.user.id;
    const loadId = req.params.loadId;
    const { type, amount, billTo, description } = req.body;

    if (!type || amount == null) return res.status(400).json({ error: 'type and amount are required' });

    const load = await prisma.load.findFirst({ where: { id: loadId, organizationId: orgId } });
    if (!load) return res.status(404).json({ error: 'Load not found' });

    const item = await prisma.accessorial.create({
      data: {
        organizationId: orgId,
        loadId,
        type,
        amount: parseFloat(amount),
        billTo: billTo || 'CUSTOMER',
        description: description || null,
        createdById: userId,
      },
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    });

    res.status(201).json(item);
  } catch (err) {
    console.error('createAccessorial error:', err);
    res.status(500).json({ error: 'Failed to create accessorial' });
  }
}

async function updateAccessorial(req, res) {
  try {
    const orgId = req.user.organizationId;
    const { loadId, id } = req.params;
    const { approved, amount, description } = req.body;

    const existing = await prisma.accessorial.findFirst({
      where: { id, loadId, organizationId: orgId },
    });
    if (!existing) return res.status(404).json({ error: 'Accessorial not found' });

    const updated = await prisma.accessorial.update({
      where: { id },
      data: {
        ...(approved !== undefined && { approved: Boolean(approved) }),
        ...(amount   !== undefined && { amount: parseFloat(amount) }),
        ...(description !== undefined && { description }),
      },
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    });

    res.json(updated);
  } catch (err) {
    console.error('updateAccessorial error:', err);
    res.status(500).json({ error: 'Failed to update accessorial' });
  }
}

async function deleteAccessorial(req, res) {
  try {
    const orgId = req.user.organizationId;
    const { loadId, id } = req.params;

    const existing = await prisma.accessorial.findFirst({
      where: { id, loadId, organizationId: orgId },
    });
    if (!existing) return res.status(404).json({ error: 'Accessorial not found' });

    await prisma.accessorial.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('deleteAccessorial error:', err);
    res.status(500).json({ error: 'Failed to delete accessorial' });
  }
}

module.exports = { listAccessorials, createAccessorial, updateAccessorial, deleteAccessorial };
