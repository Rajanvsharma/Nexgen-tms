const prisma = require('../services/prisma.service');
const { emitToOrg }   = require('../services/socket.service');
const { fireWorkflowEvent } = require('../services/workflow.service');
const { getVisibilityFilter } = require('../middleware/visibility.middleware');
const { logLoadAction } = require('../services/audit.service');

const LOAD_INCLUDE = {
  customer: { select: { id: true, name: true } },
  carrier: { select: { id: true, name: true, mcNumber: true } },
  createdBy: { select: { firstName: true, lastName: true } },
  assignedUser: { select: { id: true, firstName: true, lastName: true } },
};

async function getLoads(req, res) {
  try {
    const where = { ...getVisibilityFilter(req.user) };
    if (req.query.status) where.status = req.query.status;
    if (req.query.assignedTo) where.assignedTo = req.query.assignedTo;
    if (req.query.search) {
      const s = req.query.search;
      where.OR = [
        { loadNumber: { contains: s, mode: 'insensitive' } },
        { pickupCity: { contains: s, mode: 'insensitive' } },
        { deliveryCity: { contains: s, mode: 'insensitive' } },
      ];
    }

    // Fix #5: paginate — default 50 per page
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(200, parseInt(req.query.limit) || 50);
    const skip  = (page - 1) * limit;

    const [loads, total] = await Promise.all([
      prisma.load.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, include: LOAD_INCLUDE }),
      prisma.load.count({ where }),
    ]);
    const result = req.user.role === 'CUSTOMER' ? loads.map(stripDriverPII) : loads;
    res.json({ loads: result, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('getLoads error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// Fix #12: strip driver PII for CUSTOMER portal users
function stripDriverPII(load) {
  const { driverName, driverPhone, carrierRate, margin, ...safe } = load;
  return safe;
}

async function getLoad(req, res) {
  try {
    const load = await prisma.load.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      include: { ...LOAD_INCLUDE, quote: true, invoice: true, payment: true },
    });
    if (!load) return res.status(404).json({ message: 'Load not found' });
    res.json(req.user.role === 'CUSTOMER' ? stripDriverPII(load) : load);
  } catch (err) {
    console.error('getLoad error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

const CREDIT_EXCLUDED = ['CANCELLED', 'COMPLETED', 'RECEIVED'];

async function checkCreditLimit(customerId, orgId, newAmount) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: orgId },
    select: { creditLimit: true, name: true },
  });
  if (!customer || customer.creditLimit == null) return null;

  const agg = await prisma.load.aggregate({
    where: { customerId, organizationId: orgId, status: { notIn: CREDIT_EXCLUDED } },
    _sum: { customerRate: true },
  });
  const used = agg._sum.customerRate || 0;
  const available = customer.creditLimit - used;
  if (newAmount > available) {
    const fmt = n => `$${Math.round(n).toLocaleString('en-US')}`;
    return `Credit limit exceeded for "${customer.name}". Available: ${fmt(available)}, Load value: ${fmt(newAmount)}.`;
  }
  return null;
}

async function nextLoadNumber(orgId, slug) {
  // Fix #2: single ordered query instead of fetching all loads — O(1) not O(n)
  const prefix = slug.toUpperCase().replace(/-+$/, '');
  const last = await prisma.load.findFirst({
    where: { organizationId: orgId, loadNumber: { startsWith: prefix + '-' } },
    orderBy: { createdAt: 'desc' },
    select: { loadNumber: true },
  });
  const max = last ? (parseInt(last.loadNumber.split('-').pop(), 10) || 10000) : 10000;
  return `${prefix}-${String(max + 1).padStart(6, '0')}`;
}

async function getOrgSlug(orgId) {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { slug: true } });
  return org?.slug || 'PRO';
}

async function createLoad(req, res) {
  try {
    const orgId = req.user.organizationId;
    const { customerId, pickupCity, pickupState, deliveryCity, deliveryState, commodity, weight, equipment, pickupDate, deliveryDate, customerRate, carrierRate, specialInstructions } = req.body;
    if (!customerId || !pickupCity || !pickupState || !deliveryCity || !deliveryState || !equipment || !customerRate) {
      return res.status(400).json({ message: 'customerId, cities, states, equipment, and customerRate are required' });
    }

    // Fix #11: enforce monthly load limit per plan
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { maxLoadsPerMonth: true, subscriptionStatus: true } });
    if (org && org.subscriptionStatus !== 'active' && org.subscriptionStatus !== 'trialing') {
      return res.status(403).json({ message: 'Your subscription is inactive. Please update your billing to create loads.' });
    }
    if (org && org.maxLoadsPerMonth) {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const loadsThisMonth = await prisma.load.count({ where: { organizationId: orgId, createdAt: { gte: monthStart } } });
      if (loadsThisMonth >= org.maxLoadsPerMonth) {
        return res.status(403).json({ message: `Monthly load limit reached (${org.maxLoadsPerMonth}). Upgrade your plan.` });
      }
    }

    const cust = parseFloat(customerRate);
    const creditError = await checkCreditLimit(customerId, orgId, cust);
    if (creditError) return res.status(400).json({ message: creditError });

    const slug = await getOrgSlug(orgId);
    const loadNumber = await nextLoadNumber(orgId, slug);
    const cr = carrierRate ? parseFloat(carrierRate) : null;

    const load = await prisma.load.create({
      data: {
        organizationId: orgId, loadNumber, customerId,
        pickupCity, pickupState, deliveryCity, deliveryState,
        commodity, weight: weight ? parseFloat(weight) : null, equipment,
        pickupDate: pickupDate ? new Date(pickupDate) : null,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        customerRate: cust, carrierRate: cr,
        margin: cr ? parseFloat(((cust - cr) / cust * 100).toFixed(2)) : null,
        specialInstructions, createdById: req.user.id, teamId: req.user.teamId || null,
      },
      include: LOAD_INCLUDE,
    });
    emitToOrg(orgId, 'load:created', load);
    // Fire workflow event (non-blocking)
    fireWorkflowEvent('load_created', { organizationId: orgId, load }).catch(() => {});
    res.status(201).json(load);
  } catch (err) {
    console.error('createLoad error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateLoad(req, res) {
  try {
    const orgId = req.user.organizationId;
    const existing = await prisma.load.findFirst({ where: { id: req.params.id, organizationId: orgId }, select: { customerRate: true, carrierRate: true, carrierId: true, status: true } });
    if (!existing) return res.status(404).json({ message: 'Load not found' });

    const { customerId, carrierId, status, customerRate, carrierRate, pickupCity, pickupState, deliveryCity, deliveryState, commodity, weight, equipment, pickupDate, deliveryDate, specialInstructions, driverName, driverPhone } = req.body;
    const data = {};
    if (customerId !== undefined) data.customerId = customerId;
    if (carrierId !== undefined) data.carrierId = carrierId || null;
    if (status !== undefined) data.status = status;
    if (pickupCity !== undefined) data.pickupCity = pickupCity;
    if (pickupState !== undefined) data.pickupState = pickupState;
    if (deliveryCity !== undefined) data.deliveryCity = deliveryCity;
    if (deliveryState !== undefined) data.deliveryState = deliveryState;
    if (commodity !== undefined) data.commodity = commodity;
    if (weight !== undefined) data.weight = weight ? parseFloat(weight) : null;
    if (equipment !== undefined) data.equipment = equipment;
    if (pickupDate !== undefined) data.pickupDate = pickupDate ? new Date(pickupDate) : null;
    if (deliveryDate !== undefined) data.deliveryDate = deliveryDate ? new Date(deliveryDate) : null;
    if (specialInstructions !== undefined) data.specialInstructions = specialInstructions;
    if (driverName !== undefined) data.driverName = driverName;
    if (driverPhone !== undefined) data.driverPhone = driverPhone;
    if (customerRate !== undefined) data.customerRate = parseFloat(customerRate);
    if (carrierRate !== undefined) data.carrierRate = carrierRate ? parseFloat(carrierRate) : null;
    const cust = data.customerRate ?? existing.customerRate;
    const carr = data.carrierRate ?? existing.carrierRate;
    if (cust && carr) data.margin = parseFloat(((cust - carr) / cust * 100).toFixed(2));

    // Fix #4: include organizationId in update where clause for proper tenant isolation
    const prevCarrierId = existing.carrierId ?? null;
    const load = await prisma.load.update({ where: { id: req.params.id, organizationId: orgId }, data, include: LOAD_INCLUDE });
    emitToOrg(orgId, 'load:updated', load);

    // Fire workflow events (non-blocking)
    if (data.carrierId && data.carrierId !== prevCarrierId) {
      const carrier = await prisma.carrier.findUnique({ where: { id: data.carrierId } }).catch(() => null);
      fireWorkflowEvent('carrier_assigned', { organizationId: orgId, load, carrier }).catch(() => {});
    }
    if (data.status && data.status !== existing.status) {
      fireWorkflowEvent('load_status_changed', { organizationId: orgId, load }).catch(() => {});
    }

    res.json(load);
  } catch (err) {
    console.error('updateLoad error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function deleteLoad(req, res) {
  try {
    const { id } = req.params;
    const load = await prisma.load.findFirst({ where: { id, organizationId: req.user.organizationId }, select: { status: true, invoice: { select: { id: true } } } });
    if (!load) return res.status(404).json({ message: 'Load not found' });
    if (load.invoice) return res.status(400).json({ message: 'Cannot delete a load that has an invoice. Void the invoice first.' });
    await prisma.load.delete({ where: { id } });
    emitToOrg(req.user.organizationId, 'load:deleted', { id });
    res.json({ message: 'Load deleted' });
  } catch (err) {
    console.error('deleteLoad error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function checkDuplicate(req, res) {
  try {
    const orgId = req.user.organizationId;
    const { pickupCity, pickupState, deliveryCity, deliveryState, pickupDate, customerId } = req.query;
    const where = { organizationId: orgId, customerId, pickupCity, pickupState, deliveryCity, deliveryState, status: { not: 'CANCELLED' } };
    if (pickupDate) {
      const d = new Date(pickupDate);
      where.pickupDate = { gte: new Date(d.setHours(0, 0, 0, 0)), lte: new Date(d.setHours(23, 59, 59, 999)) };
    }
    const existing = await prisma.load.findMany({ where, select: { loadNumber: true, status: true, createdAt: true }, take: 5 });
    res.json({ isDuplicate: existing.length > 0, matches: existing });
  } catch (err) {
    console.error('checkDuplicate error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function dispatchLoad(req, res) {
  try {
    const orgId = req.user.organizationId;
    const { carrierId, carrierRate } = req.body;
    if (!carrierId || !carrierRate) return res.status(400).json({ message: 'carrierId and carrierRate are required' });

    const existing = await prisma.load.findFirst({ where: { id: req.params.id, organizationId: orgId }, select: { customerRate: true, status: true, pickupState: true, deliveryState: true } });
    if (!existing) return res.status(404).json({ message: 'Load not found' });
    if (existing.status !== 'CREATED') return res.status(400).json({ message: 'Only CREATED loads can be dispatched' });

    const cr = parseFloat(carrierRate);
    const margin = parseFloat(((existing.customerRate - cr) / existing.customerRate * 100).toFixed(2));

    const load = await prisma.load.update({
      where: { id: req.params.id },
      data: { carrierId, carrierRate: cr, margin, status: 'DISPATCHED' },
      include: LOAD_INCLUDE,
    });

    await prisma.carrierLane.updateMany({
      where: { carrierId, origin: existing.pickupState, destination: existing.deliveryState },
      data: { lastUsed: new Date() },
    });

    res.json(load);
  } catch (err) {
    console.error('dispatchLoad error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function assignLoad(req, res) {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;
    if (!assignedTo) return res.status(400).json({ message: 'assignedTo is required' });

    const load = await prisma.load.findFirst({
      where: { id, organizationId: req.user.organizationId },
      select: { id: true, loadNumber: true, assignedTo: true },
    });
    if (!load) return res.status(404).json({ message: 'Load not found' });

    const role = req.user.role;
    const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'OPS_MANAGER';

    // TEAM_MANAGER can only assign within their own team
    if (!isSuperAdmin) {
      const assignee = await prisma.user.findFirst({
        where: { id: assignedTo, organizationId: req.user.organizationId, teamId: req.user.teamId },
      });
      if (!assignee) return res.status(403).json({ message: 'Assignee must be a member of your team' });
    } else {
      const assignee = await prisma.user.findFirst({
        where: { id: assignedTo, organizationId: req.user.organizationId },
      });
      if (!assignee) return res.status(404).json({ message: 'Assignee not found' });
    }

    const isReassign = !!load.assignedTo;
    const [updated] = await prisma.$transaction([
      prisma.load.update({ where: { id }, data: { assignedTo }, include: LOAD_INCLUDE }),
      prisma.loadAuditLog.create({
        data: {
          loadId: id,
          action: isReassign ? 'reassigned' : 'assigned',
          fromValue: load.assignedTo ?? null,
          toValue: assignedTo,
          changedById: req.user.id,
        },
      }),
    ]);

    res.json(updated);
  } catch (err) {
    console.error('assignLoad error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getLoadAudit(req, res) {
  try {
    const { id } = req.params;
    const load = await prisma.load.findFirst({
      where: { id, organizationId: req.user.organizationId },
      select: { id: true },
    });
    if (!load) return res.status(404).json({ message: 'Load not found' });

    const entries = await prisma.loadAuditLog.findMany({
      where: { loadId: id },
      orderBy: { changedAt: 'desc' },
      include: { changedBy: { select: { id: true, firstName: true, lastName: true, role: true } } },
    });
    res.json(entries);
  } catch (err) {
    console.error('getLoadAudit error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getLoads, getLoad, createLoad, updateLoad, deleteLoad, dispatchLoad, checkDuplicate, assignLoad, getLoadAudit };
