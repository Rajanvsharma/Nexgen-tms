const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getRevenueByMonth(req, res) {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { status: 'PAID', paidDate: { not: null } },
      select: { amount: true, paidDate: true },
    });

    const payments = await prisma.carrierPayment.findMany({
      where: { status: 'PAID', paidDate: { not: null } },
      select: { amount: true, paidDate: true },
    });

    const byMonth = {};
    for (const inv of invoices) {
      const key = inv.paidDate.toISOString().slice(0, 7);
      if (!byMonth[key]) byMonth[key] = { month: key, revenue: 0, cost: 0, margin: 0 };
      byMonth[key].revenue += inv.amount;
    }
    for (const pay of payments) {
      const key = pay.paidDate.toISOString().slice(0, 7);
      if (!byMonth[key]) byMonth[key] = { month: key, revenue: 0, cost: 0, margin: 0 };
      byMonth[key].cost += pay.amount;
    }

    const result = Object.values(byMonth)
      .map((m) => ({ ...m, margin: m.revenue > 0 ? ((m.revenue - m.cost) / m.revenue * 100).toFixed(1) : '0' }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);

    res.json(result);
  } catch (err) {
    console.error('getRevenueByMonth error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getLoadsByStatus(req, res) {
  try {
    const statuses = ['CREATED', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'INVOICED', 'CANCELLED'];
    const counts = await Promise.all(statuses.map((s) => prisma.load.count({ where: { status: s } })));
    res.json(statuses.map((s, i) => ({ status: s, count: counts[i] })));
  } catch (err) {
    console.error('getLoadsByStatus error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getTopCarriers(req, res) {
  try {
    const carriers = await prisma.carrier.findMany({
      where: { status: 'ACTIVE' },
      select: {
        name: true, mcNumber: true,
        _count: { select: { loads: true } },
        loads: { where: { status: 'DELIVERED' }, select: { carrierRate: true } },
      },
      orderBy: { loads: { _count: 'desc' } },
      take: 10,
    });

    res.json(carriers.map((c) => ({
      name: c.name,
      mcNumber: c.mcNumber,
      loadCount: c._count.loads,
      totalPaid: c.loads.reduce((s, l) => s + (l.carrierRate || 0), 0),
    })));
  } catch (err) {
    console.error('getTopCarriers error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getTopCustomers(req, res) {
  try {
    const customers = await prisma.customer.findMany({
      select: {
        name: true,
        _count: { select: { loads: true } },
        loads: { where: { status: { in: ['DELIVERED', 'INVOICED'] } }, select: { customerRate: true } },
      },
      orderBy: { loads: { _count: 'desc' } },
      take: 10,
    });

    res.json(customers.map((c) => ({
      name: c.name,
      loadCount: c._count.loads,
      totalRevenue: c.loads.reduce((s, l) => s + (l.customerRate || 0), 0),
    })));
  } catch (err) {
    console.error('getTopCustomers error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getEquipmentMix(req, res) {
  try {
    const loads = await prisma.load.findMany({ select: { equipment: true } });
    const counts = {};
    for (const l of loads) {
      counts[l.equipment] = (counts[l.equipment] || 0) + 1;
    }
    res.json(Object.entries(counts).map(([equipment, count]) => ({ equipment, count })).sort((a, b) => b.count - a.count));
  } catch (err) {
    console.error('getEquipmentMix error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getAgingReport(req, res) {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { status: { in: ['SENT', 'OVERDUE'] } },
      include: { customer: { select: { name: true } }, load: { select: { loadNumber: true } } },
      orderBy: { dueDate: 'asc' },
    });

    const now = Date.now();
    const buckets = { current: [], days30: [], days60: [], days90plus: [] };

    for (const inv of invoices) {
      const daysOverdue = inv.dueDate ? Math.ceil((now - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
      const entry = { ...inv, daysOverdue };
      if (daysOverdue <= 0) buckets.current.push(entry);
      else if (daysOverdue <= 30) buckets.days30.push(entry);
      else if (daysOverdue <= 60) buckets.days60.push(entry);
      else buckets.days90plus.push(entry);
    }

    res.json(buckets);
  } catch (err) {
    console.error('getAgingReport error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getRevenueByMonth, getLoadsByStatus, getTopCarriers, getTopCustomers, getEquipmentMix, getAgingReport };
