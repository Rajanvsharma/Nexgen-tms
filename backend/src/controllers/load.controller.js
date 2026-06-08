const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const LOAD_INCLUDE = {
  customer: { select: { id: true, name: true } },
  carrier: { select: { id: true, name: true, mcNumber: true } },
  createdBy: { select: { firstName: true, lastName: true } },
};

async function getLoads(req, res) {
  try {
    const orgId = req.user.organizationId;
    const where = { organizationId: orgId };
    if (req.user.role !== 'ADMIN' && req.user.role !== 'ACCOUNTING') where.createdById = req.user.id;
    if (req.query.status) where.status = req.query.status;

    const loads = await prisma.load.findMany({ where, orderBy: { createdAt: 'desc' }, include: LOAD_INCLUDE });
    res.json(loads);
  } catch (err) {
    console.error('getLoads error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getLoad(req, res) {
  try {
    const load = await prisma.load.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      include: { ...LOAD_INCLUDE, quote: true, invoice: true, payment: true },
    });
    if (!load) return res.status(404).json({ message: 'Load not found' });
    res.json(load);
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
  const loads = await prisma.load.findMany({ where: { organizationId: orgId }, select: { loadNumber: true } });
  const prefix = slug.toUpperCase().replace(/-+$/, '');
  let max = 10000;
  for (const l of loads) {
    const n = parseInt(l.loadNumber.replace(/^[^-]+-/, '').replace(/^PRO-/, ''), 10);
    if (!isNaN(n) && n > max) max = n;
  }
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
        specialInstructions, createdById: req.user.id,
      },
      include: LOAD_INCLUDE,
    });
    res.status(201).json(load);
  } catch (err) {
    console.error('createLoad error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateLoad(req, res) {
  try {
    const orgId = req.user.organizationId;
    const existing = await prisma.load.findFirst({ where: { id: req.params.id, organizationId: orgId }, select: { customerRate: true, carrierRate: true } });
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

    const load = await prisma.load.update({ where: { id: req.params.id }, data, include: LOAD_INCLUDE });
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

module.exports = { getLoads, getLoad, createLoad, updateLoad, deleteLoad, dispatchLoad, checkDuplicate };
