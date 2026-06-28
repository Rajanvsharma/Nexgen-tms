const prisma = require('../services/prisma.service');
const bcrypt  = require('bcryptjs');

async function resolveCarrierId(user) {
  if (user.carrierId) return user.carrierId;
  const u = await prisma.user.findUnique({ where: { id: user.id }, select: { carrierId: true } });
  return u?.carrierId ?? null;
}

// ── Me ────────────────────────────────────────────────────────────────────────

async function getCarrierMe(req, res) {
  try {
    const carrierId = await resolveCarrierId(req.user);
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, createdAt: true },
    });
    const carrier = carrierId ? await prisma.carrier.findUnique({
      where: { id: carrierId },
      select: {
        id: true, name: true, mcNumber: true, dotNumber: true,
        email: true, phone: true, address: true, city: true, state: true, zipCode: true,
        equipmentTypes: true, contactPerson: true,
        insuranceExpiry: true, authorityExpiry: true, w9OnFile: true,
        status: true, createdAt: true,
      },
    }) : null;
    res.json({ user, carrier });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function updateCarrierMe(req, res) {
  try {
    const { firstName, lastName, phone } = req.body;
    await prisma.user.update({
      where: { id: req.user.id },
      data: { firstName, lastName, phone: phone || null },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function updateCarrierCompany(req, res) {
  try {
    const carrierId = await resolveCarrierId(req.user);
    if (!carrierId) return res.status(403).json({ message: 'No carrier account linked' });

    const { phone, email, address, city, state, zipCode, equipmentTypes, contactPerson, dotNumber } = req.body;
    await prisma.carrier.update({
      where: { id: carrierId },
      data: {
        phone: phone || null,
        email: email || null,
        address: address || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        equipmentTypes: equipmentTypes || [],
        contactPerson: contactPerson || null,
        dotNumber: dotNumber || null,
      },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function changeCarrierPassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Both fields required' });
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hashed } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ── Loads ─────────────────────────────────────────────────────────────────────

async function getCarrierLoads(req, res) {
  try {
    const carrierId = await resolveCarrierId(req.user);
    if (!carrierId) return res.status(403).json({ message: 'No carrier account linked' });

    const loads = await prisma.load.findMany({
      where: { carrierId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, loadNumber: true, status: true,
        pickupCity: true, pickupState: true, deliveryCity: true, deliveryState: true,
        equipment: true, commodity: true, weight: true,
        pickupDate: true, deliveryDate: true,
        carrierRate: true,
        driverName: true, driverPhone: true,
        specialInstructions: true,
        customer: { select: { name: true } },
        stops: { orderBy: { sequence: 'asc' }, select: { id: true, sequence: true, type: true, city: true, state: true, address: true, appointmentDate: true, completedAt: true, contactName: true, contactPhone: true } },
        documents: { select: { id: true, type: true, filename: true, createdAt: true } },
        pods: { select: { id: true, filename: true, fileUrl: true, podType: true, createdAt: true } },
        invoice: { select: { id: true, status: true, totalAmount: true, dueDate: true } },
        createdAt: true,
      },
    });
    res.json(loads);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function getCarrierLoadDetail(req, res) {
  try {
    const carrierId = await resolveCarrierId(req.user);
    if (!carrierId) return res.status(403).json({ message: 'No carrier account linked' });

    const load = await prisma.load.findFirst({
      where: { id: req.params.id, carrierId },
      select: {
        id: true, loadNumber: true, status: true,
        pickupCity: true, pickupState: true, deliveryCity: true, deliveryState: true,
        equipment: true, commodity: true, weight: true,
        pickupDate: true, deliveryDate: true,
        carrierRate: true, specialInstructions: true,
        driverName: true, driverPhone: true,
        customer: { select: { name: true, phone: true, email: true } },
        stops: { orderBy: { sequence: 'asc' } },
        documents: { select: { id: true, type: true, filename: true, signedAt: true, createdAt: true } },
        pods: { select: { id: true, filename: true, fileUrl: true, podType: true, notes: true, createdAt: true } },
        invoice: { select: { id: true, status: true, totalAmount: true, dueDate: true, paidAt: true } },
        auditLog: { orderBy: { changedAt: 'asc' }, select: { action: true, toValue: true, changedAt: true }, where: { action: 'status_changed' } },
        createdAt: true,
      },
    });
    if (!load) return res.status(404).json({ message: 'Load not found' });
    res.json(load);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ── Documents ─────────────────────────────────────────────────────────────────

async function getCarrierDocuments(req, res) {
  try {
    const carrierId = await resolveCarrierId(req.user);
    if (!carrierId) return res.status(403).json({ message: 'No carrier account linked' });

    const loads = await prisma.load.findMany({
      where: { carrierId },
      select: {
        id: true, loadNumber: true,
        documents: { select: { id: true, type: true, filename: true, signedAt: true, createdAt: true } },
        pods: { select: { id: true, filename: true, fileUrl: true, podType: true, notes: true, fileSize: true, createdAt: true } },
      },
    });

    const documents = loads.flatMap(l =>
      l.documents.map(d => ({ ...d, loadNumber: l.loadNumber, loadId: l.id }))
    );
    const pods = loads.flatMap(l =>
      l.pods.map(p => ({ ...p, loadNumber: l.loadNumber, loadId: l.id }))
    );

    res.json({ documents, pods });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ── Open / Available Loads ────────────────────────────────────────────────────

async function getOpenLoads(req, res) {
  try {
    const loads = await prisma.load.findMany({
      where: {
        organizationId: req.user.organizationId,
        carrierId: null,
        status: { in: ['CREATED', 'BOOKED', 'DRAFT'] },
      },
      orderBy: { pickupDate: 'asc' },
      select: {
        id: true, loadNumber: true, status: true,
        pickupCity: true, pickupState: true, deliveryCity: true, deliveryState: true,
        equipment: true, commodity: true, weight: true,
        pickupDate: true, deliveryDate: true,
        specialInstructions: true,
        stops: { select: { id: true, sequence: true, type: true, city: true, state: true } },
        createdAt: true,
      },
    });
    res.json(loads);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function expressInterest(req, res) {
  try {
    const carrierId = await resolveCarrierId(req.user);
    const carrier = carrierId ? await prisma.carrier.findUnique({ where: { id: carrierId }, select: { name: true, mcNumber: true } }) : null;
    const carrierLabel = carrier ? `${carrier.name} (MC#${carrier.mcNumber})` : req.user.email;

    const load = await prisma.load.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId, carrierId: null },
      select: { id: true, loadNumber: true },
    });
    if (!load) return res.status(404).json({ message: 'Load not found or already assigned' });

    await prisma.note.create({
      data: {
        loadId: load.id,
        body: `🚛 Carrier interest: ${carrierLabel} expressed interest in this load via the carrier portal.`,
        authorId: req.user.id,
      },
    });

    res.json({ ok: true, message: 'Interest submitted. A dispatcher will be in touch.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = {
  getCarrierMe, updateCarrierMe, updateCarrierCompany, changeCarrierPassword,
  getCarrierLoads, getCarrierLoadDetail, getCarrierDocuments,
  getOpenLoads, expressInterest,
};
