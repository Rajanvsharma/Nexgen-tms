const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getCarriers(_req, res) {
  try {
    const carriers = await prisma.carrier.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { loads: true, lanes: true } } },
    });
    res.json(carriers);
  } catch (err) {
    console.error('getCarriers error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getCarrier(req, res) {
  try {
    const carrier = await prisma.carrier.findUnique({
      where: { id: req.params.id },
      include: {
        lanes: { orderBy: { lastUsed: 'desc' } },
        loads: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!carrier) return res.status(404).json({ message: 'Carrier not found' });
    res.json(carrier);
  } catch (err) {
    console.error('getCarrier error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function createCarrier(req, res) {
  try {
    const { name, mcNumber, dotNumber, email, phone, address, city, state, zipCode, equipmentTypes, insuranceExpiry, authorityExpiry, w9OnFile, notes } = req.body;
    if (!name || !mcNumber) return res.status(400).json({ message: 'name and mcNumber are required' });

    const exists = await prisma.carrier.findUnique({ where: { mcNumber } });
    if (exists) return res.status(409).json({ message: 'MC number already exists' });

    const carrier = await prisma.carrier.create({
      data: {
        name, mcNumber, dotNumber, email, phone, address, city, state, zipCode,
        equipmentTypes: equipmentTypes || [],
        insuranceExpiry: insuranceExpiry ? new Date(insuranceExpiry) : null,
        authorityExpiry: authorityExpiry ? new Date(authorityExpiry) : null,
        w9OnFile: w9OnFile || false,
        notes,
      },
    });
    res.status(201).json(carrier);
  } catch (err) {
    console.error('createCarrier error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateCarrier(req, res) {
  try {
    const { name, dotNumber, email, phone, address, city, state, zipCode, equipmentTypes, insuranceExpiry, authorityExpiry, w9OnFile, status, notes } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (dotNumber !== undefined) data.dotNumber = dotNumber;
    if (email !== undefined) data.email = email;
    if (phone !== undefined) data.phone = phone;
    if (address !== undefined) data.address = address;
    if (city !== undefined) data.city = city;
    if (state !== undefined) data.state = state;
    if (zipCode !== undefined) data.zipCode = zipCode;
    if (equipmentTypes !== undefined) data.equipmentTypes = equipmentTypes;
    if (insuranceExpiry !== undefined) data.insuranceExpiry = insuranceExpiry ? new Date(insuranceExpiry) : null;
    if (authorityExpiry !== undefined) data.authorityExpiry = authorityExpiry ? new Date(authorityExpiry) : null;
    if (w9OnFile !== undefined) data.w9OnFile = w9OnFile;
    if (status !== undefined) data.status = status;
    if (notes !== undefined) data.notes = notes;

    const carrier = await prisma.carrier.update({ where: { id: req.params.id }, data });
    res.json(carrier);
  } catch (err) {
    console.error('updateCarrier error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function addLane(req, res) {
  try {
    const { origin, destination, equipment, rate } = req.body;
    if (!origin || !destination) return res.status(400).json({ message: 'origin and destination are required' });
    const lane = await prisma.carrierLane.create({
      data: { carrierId: req.params.id, origin, destination, equipment, rate: rate ? parseFloat(rate) : null },
    });
    res.status(201).json(lane);
  } catch (err) {
    console.error('addLane error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function deleteCarrier(req, res) {
  try {
    const { id } = req.params;
    const carrier = await prisma.carrier.findUnique({ where: { id }, select: { _count: { select: { loads: true } } } });
    if (!carrier) return res.status(404).json({ message: 'Carrier not found' });
    if (carrier._count.loads > 0) return res.status(400).json({ message: `Cannot delete carrier with ${carrier._count.loads} load(s). Remove loads first or mark carrier as BLACKLISTED.` });
    await prisma.carrier.delete({ where: { id } });
    res.json({ message: 'Carrier deleted' });
  } catch (err) {
    console.error('deleteCarrier error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getCarriers, getCarrier, createCarrier, updateCarrier, deleteCarrier, addLane };
