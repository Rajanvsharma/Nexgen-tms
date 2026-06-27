const prisma = require('../services/prisma.service');

const THIRTY_DAYS_AGO = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const THIRTY_DAYS_AHEAD = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

async function getStats(req, res) {
  try {
    const role = req.user.role;
    const userId = req.user.id;
    const orgId = req.user.organizationId;

    if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
      const [userCount, activeLoads, pendingInvoices, expiringCarriers, pendingQuotes, revenueThisMonth] = await Promise.all([
        prisma.user.count({ where: { organizationId: orgId, isActive: true } }),
        prisma.load.count({ where: { organizationId: orgId, status: { in: ['CREATED', 'DISPATCHED', 'IN_TRANSIT'] } } }),
        prisma.invoice.count({ where: { load: { organizationId: orgId }, status: { in: ['SENT', 'OVERDUE'] } } }),
        prisma.carrier.count({ where: { organizationId: orgId, status: 'ACTIVE', insuranceExpiry: { lt: THIRTY_DAYS_AHEAD() } } }),
        prisma.quote.count({ where: { organizationId: orgId, status: 'PENDING' } }),
        prisma.invoice.aggregate({
          where: { load: { organizationId: orgId }, status: 'PAID', paidDate: { gte: THIRTY_DAYS_AGO() } },
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

    if (role === 'DISPATCHER' || role === 'OPS_MANAGER' || role === 'SUPPORT' || role === 'TEAM_MANAGER') {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const teamId = req.user.teamId;
      // Dispatchers see own loads; Team Managers + OPS see full team scope
      const scope = role === 'DISPATCHER'
        ? { createdById: userId }
        : (teamId ? { teamId } : {});
      const [myActiveLoads, loadsThisMonth, pendingQuotes] = await Promise.all([
        prisma.load.count({ where: { organizationId: orgId, ...scope, status: { in: ['CREATED', 'DISPATCHED', 'IN_TRANSIT'] } } }),
        prisma.load.count({ where: { organizationId: orgId, ...scope, createdAt: { gte: startOfMonth } } }),
        prisma.quote.count({ where: { organizationId: orgId, ...(teamId ? { teamId } : {}), status: 'PENDING' } }),
      ]);
      return res.json({ myActiveLoads, loadsThisMonth, pendingQuotes });
    }

    if (role === 'ACCOUNT_EXEC') {
      const [pendingQuotes, totalCustomers, wonQuotes] = await Promise.all([
        prisma.quote.count({ where: { organizationId: orgId, createdById: userId, status: 'PENDING' } }),
        prisma.customer.count({ where: { organizationId: orgId } }),
        prisma.quote.count({ where: { organizationId: orgId, createdById: userId, status: 'CONVERTED' } }),
      ]);
      return res.json({ pendingQuotes, totalCustomers, wonQuotes });
    }

    if (role === 'CARRIER_RELATIONS') {
      const thirtyDays = THIRTY_DAYS_AHEAD();
      const [activeCarriers, expiringInsurance, pendingOnboarding] = await Promise.all([
        prisma.carrier.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
        prisma.carrier.count({ where: { organizationId: orgId, status: 'ACTIVE', insuranceExpiry: { lt: thirtyDays } } }),
        prisma.carrier.count({ where: { organizationId: orgId, status: 'INACTIVE' } }),
      ]);
      return res.json({ activeCarriers, expiringInsurance, pendingOnboarding });
    }

    if (role === 'ACCOUNTING' || role === 'AUDITOR') {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const [pendingInvoices, overduePayments, paidThisMonth] = await Promise.all([
        prisma.invoice.count({ where: { load: { organizationId: orgId }, status: { in: ['DRAFT', 'SENT'] } } }),
        prisma.invoice.count({ where: { load: { organizationId: orgId }, status: 'OVERDUE' } }),
        prisma.invoice.count({ where: { load: { organizationId: orgId }, status: 'PAID', paidDate: { gte: startOfMonth } } }),
      ]);
      return res.json({ pendingInvoices, overduePayments, paidThisMonth });
    }

    if (role === 'COMPLIANCE') {
      const thirtyDays = THIRTY_DAYS_AHEAD();
      const [expiringInsurance, expiringAuthority, compliantCarriers] = await Promise.all([
        prisma.carrier.count({ where: { organizationId: orgId, status: 'ACTIVE', insuranceExpiry: { lt: thirtyDays } } }),
        prisma.carrier.count({ where: { organizationId: orgId, status: 'ACTIVE', authorityExpiry: { lt: thirtyDays } } }),
        prisma.carrier.count({ where: { organizationId: orgId, status: 'ACTIVE', insuranceExpiry: { gt: thirtyDays }, w9OnFile: true } }),
      ]);
      return res.json({ expiringInsurance, expiringAuthority, compliantCarriers });
    }

    res.json({});
  } catch (err) {
    console.error('getStats error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getTeamOverview(req, res) {
  try {
    const { organizationId, teamId } = req.user;
    if (!teamId) return res.json([]);

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeStatuses = ['CREATED', 'BOOKED', 'DISPATCHED', 'DRIVER_ON_ROUTE', 'LOADING', 'ON_ROUTE', 'IN_TRANSIT', 'UNLOADING'];

    const members = await prisma.user.findMany({
      where: {
        organizationId,
        teamId,
        isActive: true,
        role: { in: ['DISPATCHER', 'ACCOUNT_EXEC', 'CARRIER_RELATIONS'] },
      },
      select: { id: true, firstName: true, lastName: true, role: true },
    });

    const stats = await Promise.all(
      members.map(async (m) => {
        const [activeLoads, loadsThisWeek, revenueAgg] = await Promise.all([
          prisma.load.count({ where: { organizationId, assignedTo: m.id, status: { in: activeStatuses } } }),
          prisma.load.count({ where: { organizationId, assignedTo: m.id, createdAt: { gte: sevenDaysAgo } } }),
          prisma.load.aggregate({
            where: { organizationId, assignedTo: m.id, createdAt: { gte: startOfMonth } },
            _sum: { customerRate: true },
          }),
        ]);
        return {
          user: m,
          activeLoads,
          loadsThisWeek,
          revenueMTD: revenueAgg._sum.customerRate || 0,
        };
      })
    );

    res.json(stats);
  } catch (err) {
    console.error('getTeamOverview error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getStats, getTeamOverview };
