const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const LOAD_INCLUDE = {
  customer: { select: { id: true, name: true } },
  carrier: { select: { id: true, name: true, mcNumber: true } },
  createdBy: { select: { firstName: true, lastName: true } },
};

async function getLoads(req, res) {
  try {
    const where = req.user.role === 'ADMIN' ? {} : { createdById: req.user.id };
    const { status } = req.query;
    if (status) where.status = status;

    const loads = await prisma.load.findMany({ where, orderBy: { createdAt: 'desc' }, include: LOAD_INCLUDE });
    res.json(loads);
  } catch (err) {
    console.error('getLoads error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getLoad(req, res) {
  try {
    const load = await prisma.load.findUnique({
      where: { id: req.params.id },
      include: { ...LOAD_INCLUDE, quote: true, invoice: true, payment: true },
    });
    if (!load) return res.status(404).json({ message: 'Load not found' });
    res.json(load);
  } catch (err) {
    console.error('getLoad error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function createLoad(req, res) {
  try {
    const { customerId, pickupCity, pickupState, deliveryCity, deliveryState, commodity, weight, equipment, pickupDate, deliveryDate, customerRate, carrierRate, specialInstructions } = req.body;
    if (!customerId || !pickupCity || !pickupState || !deliveryCity || !deliveryState || !equipment || !customerRate) {
      return res.status(400).json({ message: 'customerId, cities, states, equipment, and customerRate are required' });
    }

    const last = await prisma.load.findFirst({ orderBy: { createdAt: 'desc' }, select: { loadNumber: true } });
    const num = last ? parseInt(last.loadNumber.replace('PRO-', ''), 10) + 1 : 10001;
    const loadNumber = `PRO-${String(num).padStart(6, '0')}`;

    const cr = carrierRate ? parseFloat(carrierRate) : null;
    const cust = parseFloat(customerRate);

    const load = await prisma.load.create({
      data: {
        loadNumber, customerId, pickupCity, pickupState, deliveryCity, deliveryState,
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
    const { carrierId, status, carrierRate, pickupDate, deliveryDate, specialInstructions, driverName, driverPhone } = req.body;
    const data = {};
    if (carrierId !== undefined) data.carrierId = carrierId;
    if (status !== undefined) data.status = status;
    if (pickupDate !== undefined) data.pickupDate = pickupDate ? new Date(pickupDate) : null;
    if (deliveryDate !== undefined) data.deliveryDate = deliveryDate ? new Date(deliveryDate) : null;
    if (specialInstructions !== undefined) data.specialInstructions = specialInstructions;
    if (driverName !== undefined) data.driverName = driverName;
    if (driverPhone !== undefined) data.driverPhone = driverPhone;
    if (carrierRate !== undefined) {
      data.carrierRate = parseFloat(carrierRate);
      const load = await prisma.load.findUnique({ where: { id: req.params.id }, select: { customerRate: true } });
      if (load) {
        data.margin = parseFloat(((load.customerRate - data.carrierRate) / load.customerRate * 100).toFixed(2));
      }
    }

    const load = await prisma.load.update({ where: { id: req.params.id }, data, include: LOAD_INCLUDE });
    res.json(load);
  } catch (err) {
    console.error('updateLoad error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function checkDuplicate(req, res) {
  try {
    const { pickupCity, pickupState, deliveryCity, deliveryState, pickupDate, customerId } = req.query;
    const where = { customerId, pickupCity, pickupState, deliveryCity, deliveryState, status: { not: 'CANCELLED' } };
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
    const { carrierId, carrierRate } = req.body;
    if (!carrierId || !carrierRate) return res.status(400).json({ message: 'carrierId and carrierRate are required' });

    const existing = await prisma.load.findUnique({ where: { id: req.params.id }, select: { customerRate: true, status: true } });
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
      where: { carrierId, origin: load.pickupState, destination: load.deliveryState },
      data: { lastUsed: new Date() },
    });

    res.json(load);
  } catch (err) {
    console.error('dispatchLoad error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getLoads, getLoad, createLoad, updateLoad, dispatchLoad, checkDuplicate };
