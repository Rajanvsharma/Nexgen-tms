const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const THIRTY_DAYS_AGO = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const now = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

async function getStats(req, res) {
  try {
    const role = req.user.role;
    const userId = req.user.id;

    if (role === 'ADMIN') {
      const [userCount, activeLoads, pendingInvoices, expiringCarriers, pendingQuotes, revenueThisMonth] = await Promise.all([
        prisma.user.count({ where: { isActive: true } }),
        prisma.load.count({ where: { status: { in: ['CREATED', 'DISPATCHED', 'IN_TRANSIT'] } } }),
        prisma.invoice.count({ where: { status: { in: ['SENT', 'OVERDUE'] } } }),
        prisma.carrier.count({ where: { status: 'ACTIVE', insuranceExpiry: { lt: now() } } }),
        prisma.quote.count({ where: { status: 'PENDING' } }),
        prisma.invoice.aggregate({
          where: { status: 'PAID', paidDate: { gte: THIRTY_DAYS_AGO() } },
          _sum: { amount: true },
        }),
      ]);

      return res.json({
        totalUsers: userCount,
        activeLoads,
        pendingInvoices,
        complianceAlerts: expiringCarriers,
        pendingQuotes,
        revenueThisMonth: revenueThisMonth._sum.amount || 0,
      });
    }

    if (role === 'DISPATCHER') {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const [myActiveLoads, loadsThisMonth, pendingQuotes] = await Promise.all([
        prisma.load.count({ where: { createdById: userId, status: { in: ['CREATED', 'DISPATCHED', 'IN_TRANSIT'] } } }),
        prisma.load.count({ where: { createdById: userId, createdAt: { gte: startOfMonth } } }),
        prisma.quote.count({ where: { createdById: userId, status: 'PENDING' } }),
      ]);

      return res.json({ myActiveLoads, loadsThisMonth, pendingQuotes });
    }

    if (role === 'ACCOUNTING') {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const [pendingInvoices, overduePayments, paidThisMonth] = await Promise.all([
        prisma.invoice.count({ where: { status: { in: ['DRAFT', 'SENT'] } } }),
        prisma.invoice.count({ where: { status: 'OVERDUE' } }),
        prisma.invoice.count({ where: { status: 'PAID', paidDate: { gte: startOfMonth } } }),
      ]);

      return res.json({ pendingInvoices, overduePayments, paidThisMonth });
    }

    if (role === 'COMPLIANCE') {
      const thirtyDays = now();
      const [expiringInsurance, expiringAuthority, compliantCarriers] = await Promise.all([
        prisma.carrier.count({ where: { status: 'ACTIVE', insuranceExpiry: { lt: thirtyDays } } }),
        prisma.carrier.count({ where: { status: 'ACTIVE', authorityExpiry: { lt: thirtyDays } } }),
        prisma.carrier.count({ where: { status: 'ACTIVE', insuranceExpiry: { gt: thirtyDays }, w9OnFile: true } }),
      ]);

      return res.json({ expiringInsurance, expiringAuthority, compliantCarriers });
    }

    res.json({});
  } catch (err) {
    console.error('getStats error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getStats };
