const prisma = require('../services/prisma.service');
const { emitToOrg }   = require('../services/socket.service');

async function bulkUpdateStatus(req, res) {
  try {
    const orgId  = req.user.organizationId;
    const { ids, status } = req.body;

    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids required' });
    if (!status) return res.status(400).json({ error: 'status required' });

    const result = await prisma.load.updateMany({
      where: { id: { in: ids }, organizationId: orgId },
      data:  { status },
    });

    emitToOrg(orgId, 'loads:bulk-status', { ids, status });
    res.json({ updated: result.count });
  } catch (err) {
    console.error('bulkUpdateStatus error:', err);
    res.status(500).json({ error: 'Bulk update failed' });
  }
}

async function bulkDelete(req, res) {
  try {
    const orgId = req.user.organizationId;
    const { ids } = req.body;

    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids required' });

    const result = await prisma.load.deleteMany({
      where: { id: { in: ids }, organizationId: orgId },
    });

    emitToOrg(orgId, 'loads:bulk-delete', { ids });
    res.json({ deleted: result.count });
  } catch (err) {
    console.error('bulkDelete error:', err);
    res.status(500).json({ error: 'Bulk delete failed' });
  }
}

async function bulkInvoice(req, res) {
  try {
    const orgId = req.user.organizationId;
    const { ids } = req.body;

    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids required' });

    const loads = await prisma.load.findMany({
      where: {
        id: { in: ids },
        organizationId: orgId,
        status: { in: ['DELIVERED', 'COMPLETED'] },
      },
      include: { customer: true },
    });

    if (!loads.length) return res.status(400).json({ error: 'No eligible loads (must be DELIVERED or COMPLETED)' });

    const created = [];
    for (const load of loads) {
      const existing = await prisma.invoice.findUnique({ where: { loadId: load.id } });
      if (existing) continue;

      const last = await prisma.invoice.findFirst({
        where: { load: { organizationId: orgId } },
        orderBy: { createdAt: 'desc' },
        select: { invoiceNumber: true },
      });
      const num = last ? parseInt(last.invoiceNumber.replace(/^[^-]+-/, ''), 10) + 1 : 1001;
      const invoiceNumber = `INV-${String(num).padStart(5, '0')}`;

      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          loadId: load.id,
          customerId: load.customerId,
          amount: load.customerRate,
          dueDate: new Date(Date.now() + (load.customer?.creditTerms || 30) * 24 * 60 * 60 * 1000),
        },
      });
      await prisma.load.update({ where: { id: load.id }, data: { status: 'INVOICED' } });
      created.push(invoice.id);
    }

    emitToOrg(orgId, 'loads:bulk-invoiced', { ids: loads.map(l => l.id) });
    res.json({ invoicesCreated: created.length, skipped: loads.length - created.length });
  } catch (err) {
    console.error('bulkInvoice error:', err);
    res.status(500).json({ error: 'Bulk invoice failed' });
  }
}

module.exports = { bulkUpdateStatus, bulkDelete, bulkInvoice };
