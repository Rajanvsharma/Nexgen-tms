const prisma   = require('../services/prisma.service');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const path     = require('path');
const { uploadFile } = require('../services/storage.service');
const { sendCarrierStatusUpdateEmail, sendPODUploadedEmail, sendNewBidEmail } = require('../services/outbound.service');

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
        phone: phone || null, email: email || null, address: address || null,
        city: city || null, state: state || null, zipCode: zipCode || null,
        equipmentTypes: equipmentTypes || [], contactPerson: contactPerson || null,
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
        pickupDate: true, deliveryDate: true, carrierRate: true,
        driverName: true, driverPhone: true, specialInstructions: true,
        trackingLat: true, trackingLng: true, trackingUpdatedAt: true,
        customer: { select: { name: true } },
        stops: { orderBy: { sequence: 'asc' }, select: { id: true, sequence: true, type: true, city: true, state: true, address: true, appointmentDate: true, completedAt: true, contactName: true, contactPhone: true } },
        documents: { select: { id: true, type: true, filename: true, createdAt: true } },
        pods: { select: { id: true, filename: true, fileUrl: true, podType: true, createdAt: true } },
        invoice: { select: { id: true, status: true, totalAmount: true, dueDate: true } },
        payment: { select: { id: true, status: true, amount: true, dueDate: true, paidDate: true } },
        auditLog: { where: { action: 'status_changed' }, orderBy: { changedAt: 'asc' }, select: { action: true, toValue: true, changedAt: true } },
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
        pickupDate: true, deliveryDate: true, carrierRate: true,
        specialInstructions: true, driverName: true, driverPhone: true,
        trackingLat: true, trackingLng: true, trackingUpdatedAt: true,
        customer: { select: { name: true, phone: true, email: true } },
        stops: { orderBy: { sequence: 'asc' } },
        documents: { select: { id: true, type: true, filename: true, signedAt: true, createdAt: true } },
        pods: { select: { id: true, filename: true, fileUrl: true, podType: true, notes: true, createdAt: true } },
        invoice: { select: { id: true, status: true, totalAmount: true, dueDate: true, paidAt: true } },
        payment: { select: { id: true, status: true, amount: true, dueDate: true, paidDate: true, notes: true } },
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

// ── Update Load Status (carrier/driver) ───────────────────────────────────────

const CARRIER_ALLOWED_TRANSITIONS = {
  DISPATCHED:    ['DRIVER_ON_ROUTE', 'LOADING'],
  DRIVER_ON_ROUTE: ['LOADING', 'IN_TRANSIT'],
  LOADING:       ['IN_TRANSIT'],
  IN_TRANSIT:    ['UNLOADING', 'DELIVERED'],
  ON_ROUTE:      ['DELIVERED'],
  UNLOADING:     ['DELIVERED'],
};

async function updateCarrierLoadStatus(req, res) {
  try {
    const carrierId = await resolveCarrierId(req.user);
    if (!carrierId) return res.status(403).json({ message: 'No carrier account linked' });

    const { status, note } = req.body;
    if (!status) return res.status(400).json({ message: 'status is required' });

    const load = await prisma.load.findFirst({
      where: { id: req.params.id, carrierId },
      select: { id: true, status: true, loadNumber: true },
    });
    if (!load) return res.status(404).json({ message: 'Load not found' });

    const allowed = CARRIER_ALLOWED_TRANSITIONS[load.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: `Cannot transition from ${load.status} to ${status}` });
    }

    await prisma.$transaction([
      prisma.load.update({ where: { id: load.id }, data: { status } }),
      prisma.loadAuditLog.create({
        data: {
          loadId: load.id, action: 'status_changed',
          fromValue: load.status, toValue: status,
          changedById: req.user.id,
        },
      }),
      ...(note ? [prisma.note.create({ data: { loadId: load.id, body: `[Carrier Update] ${note}`, authorId: req.user.id } })] : []),
    ]);

    // Email the dispatcher / assigned user about the carrier's status update
    const fullLoad = await prisma.load.findUnique({
      where: { id: load.id },
      select: { id: true, loadNumber: true, pickupCity: true, pickupState: true, deliveryCity: true, deliveryState: true, assignedTo: true, organizationId: true },
    }).catch(() => null);
    if (fullLoad) {
      const carrier = carrierId ? await prisma.carrier.findUnique({ where: { id: carrierId }, select: { name: true } }).catch(() => null) : null;
      const targets = [];
      if (fullLoad.assignedTo) {
        const u = await prisma.user.findUnique({ where: { id: fullLoad.assignedTo }, select: { email: true, firstName: true, lastName: true } }).catch(() => null);
        if (u?.email) targets.push(u);
      } else {
        // Fallback: email org admins
        const admins = await prisma.user.findMany({
          where: { organizationId: fullLoad.organizationId, role: { in: ['ADMIN','OPS_MANAGER','DISPATCHER'] }, isActive: true },
          select: { email: true, firstName: true, lastName: true },
          take: 3,
        }).catch(() => []);
        targets.push(...admins);
      }
      targets.forEach(u => {
        sendCarrierStatusUpdateEmail({
          load: fullLoad, toEmail: u.email,
          toName: `${u.firstName} ${u.lastName}`.trim(),
          newStatus: status, note: note || null,
          carrierName: carrier?.name || req.user.email,
        }).catch(() => {});
      });
    }

    res.json({ ok: true, status });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ── POD Upload ────────────────────────────────────────────────────────────────

async function uploadCarrierPOD(req, res) {
  try {
    const carrierId = await resolveCarrierId(req.user);
    if (!carrierId) return res.status(403).json({ message: 'No carrier account linked' });

    const load = await prisma.load.findFirst({
      where: { id: req.params.id, carrierId },
      select: { id: true, organizationId: true },
    });
    if (!load) return res.status(404).json({ message: 'Load not found' });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const ext      = path.extname(req.file.originalname);
    const unique   = crypto.randomBytes(8).toString('hex');
    const filename = `${load.organizationId}/${load.id}/carrier-${unique}${ext}`;

    const fileUrl = await uploadFile(req.file.buffer, filename, req.file.mimetype);

    const podType = req.body.podType || 'POD';
    const pod = await prisma.proofOfDelivery.create({
      data: {
        organizationId: load.organizationId,
        loadId: load.id,
        filename: req.file.originalname,
        fileUrl,
        fileSize: req.file.size,
        podType,
        notes: req.body.notes || null,
        uploadedById: req.user.id,
      },
    });

    // Email dispatcher / assigned user about the POD upload
    const fullLoad = await prisma.load.findUnique({
      where: { id: load.id },
      select: { id: true, loadNumber: true, pickupCity: true, pickupState: true, deliveryCity: true, deliveryState: true, assignedTo: true, organizationId: true },
    }).catch(() => null);
    if (fullLoad) {
      const carrierRec = carrierId ? await prisma.carrier.findUnique({ where: { id: carrierId }, select: { name: true } }).catch(() => null) : null;
      const targets = [];
      if (fullLoad.assignedTo) {
        const u = await prisma.user.findUnique({ where: { id: fullLoad.assignedTo }, select: { email: true, firstName: true, lastName: true } }).catch(() => null);
        if (u?.email) targets.push(u);
      } else {
        const admins = await prisma.user.findMany({
          where: { organizationId: fullLoad.organizationId, role: { in: ['ADMIN','OPS_MANAGER','DISPATCHER'] }, isActive: true },
          select: { email: true, firstName: true, lastName: true }, take: 3,
        }).catch(() => []);
        targets.push(...admins);
      }
      targets.forEach(u => {
        sendPODUploadedEmail({
          load: fullLoad, toEmail: u.email,
          toName: `${u.firstName} ${u.lastName}`.trim(),
          podType, filename: req.file.originalname,
          carrierName: carrierRec?.name || req.user.email,
        }).catch(() => {});
      });
    }

    res.status(201).json(pod);
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
    const documents = loads.flatMap(l => l.documents.map(d => ({ ...d, loadNumber: l.loadNumber, loadId: l.id })));
    const pods      = loads.flatMap(l => l.pods.map(p => ({ ...p, loadNumber: l.loadNumber, loadId: l.id })));
    res.json({ documents, pods });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ── Open / Available Loads ────────────────────────────────────────────────────

async function getOpenLoads(req, res) {
  try {
    const carrierId = await resolveCarrierId(req.user);
    const loads = await prisma.load.findMany({
      where: { organizationId: req.user.organizationId, carrierId: null, status: { in: ['CREATED', 'BOOKED', 'DRAFT'] } },
      orderBy: { pickupDate: 'asc' },
      select: {
        id: true, loadNumber: true, status: true,
        pickupCity: true, pickupState: true, deliveryCity: true, deliveryState: true,
        equipment: true, commodity: true, weight: true,
        pickupDate: true, deliveryDate: true, specialInstructions: true,
        stops: { select: { id: true, sequence: true, type: true, city: true, state: true } },
        ...(carrierId ? { bids: { where: { carrierId }, select: { id: true, amount: true, status: true, notes: true, createdAt: true } } } : {}),
        createdAt: true,
      },
    });
    // Flatten: attach my bid if present
    const result = loads.map(l => {
      const myBid = l.bids?.[0] || null;
      const { bids, ...rest } = l;
      return { ...rest, myBid };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ── Bids ──────────────────────────────────────────────────────────────────────

async function submitBid(req, res) {
  try {
    const carrierId = await resolveCarrierId(req.user);
    if (!carrierId) return res.status(403).json({ message: 'No carrier account linked' });

    const load = await prisma.load.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId, carrierId: null },
      select: { id: true, loadNumber: true },
    });
    if (!load) return res.status(404).json({ message: 'Load not found or already assigned' });

    const { amount, notes } = req.body;

    const bid = await prisma.loadBid.upsert({
      where: { loadId_carrierId: { loadId: load.id, carrierId } },
      update: { amount: amount ? parseFloat(amount) : null, notes: notes || null, status: 'PENDING' },
      create: { loadId: load.id, carrierId, amount: amount ? parseFloat(amount) : null, notes: notes || null },
    });

    // Note + email for dispatcher visibility
    const carrier = await prisma.carrier.findUnique({ where: { id: carrierId }, select: { name: true, mcNumber: true } });
    const label = carrier ? `${carrier.name} (MC#${carrier.mcNumber})` : req.user.email;
    const rateStr = amount ? ` at $${parseFloat(amount).toLocaleString()}` : '';
    await prisma.note.upsert({
      where: { id: bid.id },
      update: { body: `🚛 Carrier bid: ${label} submitted a rate bid${rateStr}.${notes ? ' Notes: ' + notes : ''}` },
      create: { id: bid.id, loadId: load.id, body: `🚛 Carrier bid: ${label} submitted a rate bid${rateStr}.${notes ? ' Notes: ' + notes : ''}`, authorId: req.user.id },
    }).catch(() => {});

    // Email dispatcher about the new bid
    const fullLoad = await prisma.load.findUnique({
      where: { id: load.id },
      select: { id: true, loadNumber: true, pickupCity: true, pickupState: true, deliveryCity: true, deliveryState: true, assignedTo: true, organizationId: true },
    }).catch(() => null);
    if (fullLoad && carrier) {
      const targets = [];
      if (fullLoad.assignedTo) {
        const u = await prisma.user.findUnique({ where: { id: fullLoad.assignedTo }, select: { email: true, firstName: true, lastName: true } }).catch(() => null);
        if (u?.email) targets.push(u);
      } else {
        const admins = await prisma.user.findMany({
          where: { organizationId: fullLoad.organizationId, role: { in: ['ADMIN','OPS_MANAGER','DISPATCHER','CARRIER_RELATIONS'] }, isActive: true },
          select: { email: true, firstName: true, lastName: true }, take: 3,
        }).catch(() => []);
        targets.push(...admins);
      }
      targets.forEach(u => {
        sendNewBidEmail({
          load: fullLoad, toEmail: u.email, toName: `${u.firstName} ${u.lastName}`.trim(),
          carrierName: carrier.name, mcNumber: carrier.mcNumber,
          amount: amount ? parseFloat(amount) : null, notes: notes || null,
        }).catch(() => {});
      });
    }

    res.json(bid);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function withdrawBid(req, res) {
  try {
    const carrierId = await resolveCarrierId(req.user);
    if (!carrierId) return res.status(403).json({ message: 'No carrier account linked' });
    await prisma.loadBid.updateMany({
      where: { loadId: req.params.id, carrierId, status: 'PENDING' },
      data: { status: 'WITHDRAWN' },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function expressInterest(req, res) {
  try {
    const carrierId = await resolveCarrierId(req.user);
    const carrier   = carrierId ? await prisma.carrier.findUnique({ where: { id: carrierId }, select: { name: true, mcNumber: true } }) : null;
    const label     = carrier ? `${carrier.name} (MC#${carrier.mcNumber})` : req.user.email;
    const load = await prisma.load.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId, carrierId: null },
      select: { id: true, loadNumber: true },
    });
    if (!load) return res.status(404).json({ message: 'Load not found or already assigned' });
    await prisma.note.create({ data: { loadId: load.id, body: `🚛 Carrier interest: ${label} expressed interest via the carrier portal.`, authorId: req.user.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ── Payments ──────────────────────────────────────────────────────────────────

async function getCarrierPayments(req, res) {
  try {
    const carrierId = await resolveCarrierId(req.user);
    if (!carrierId) return res.status(403).json({ message: 'No carrier account linked' });
    const payments = await prisma.carrierPayment.findMany({
      where: { carrierId },
      orderBy: { createdAt: 'desc' },
      include: {
        load: { select: { loadNumber: true, pickupCity: true, pickupState: true, deliveryCity: true, deliveryState: true, deliveryDate: true } },
      },
    });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ── Messaging ─────────────────────────────────────────────────────────────────

async function getCarrierConversations(req, res) {
  try {
    const carrierId = await resolveCarrierId(req.user);
    if (!carrierId) return res.status(403).json({ message: 'No carrier account linked' });
    const convs = await prisma.conversation.findMany({
      where: { carrierId },
      orderBy: { updatedAt: 'desc' },
      include: {
        load: { select: { loadNumber: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { content: true, createdAt: true, sender: { select: { firstName: true, lastName: true } } } },
      },
    });
    res.json(convs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function getConversationDetail(req, res) {
  try {
    const carrierId = await resolveCarrierId(req.user);
    if (!carrierId) return res.status(403).json({ message: 'No carrier account linked' });
    const conv = await prisma.conversation.findFirst({
      where: { id: req.params.id, carrierId },
      include: {
        load: { select: { loadNumber: true, pickupCity: true, pickupState: true, deliveryCity: true, deliveryState: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          where: { isInternal: false },
          include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } } },
        },
      },
    });
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });
    res.json(conv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function sendCarrierMessage(req, res) {
  try {
    const carrierId = await resolveCarrierId(req.user);
    if (!carrierId) return res.status(403).json({ message: 'No carrier account linked' });
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'Message content required' });
    const conv = await prisma.conversation.findFirst({ where: { id: req.params.id, carrierId } });
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });

    const [msg] = await prisma.$transaction([
      prisma.convMessage.create({ data: { conversationId: conv.id, senderId: req.user.id, content: content.trim() } }),
      prisma.conversation.update({ where: { id: conv.id }, data: { status: 'OPEN', updatedAt: new Date() } }),
    ]);
    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function startConversation(req, res) {
  try {
    const carrierId = await resolveCarrierId(req.user);
    if (!carrierId) return res.status(403).json({ message: 'No carrier account linked' });
    const { subject, loadId, content } = req.body;
    if (!subject || !content) return res.status(400).json({ message: 'subject and content required' });

    if (loadId) {
      const load = await prisma.load.findFirst({ where: { id: loadId, carrierId } });
      if (!load) return res.status(404).json({ message: 'Load not found' });
    }

    const conv = await prisma.conversation.create({
      data: {
        subject,
        carrierId,
        loadId: loadId || null,
        createdById: req.user.id,
      },
    });
    await prisma.convMessage.create({ data: { conversationId: conv.id, senderId: req.user.id, content: content.trim() } });
    res.status(201).json(conv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ── Notifications (aggregated from recent activity) ───────────────────────────

async function getCarrierNotifications(req, res) {
  try {
    const carrierId = await resolveCarrierId(req.user);
    if (!carrierId) return res.status(403).json({ message: 'No carrier account linked' });

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // last 30 days

    const [bids, payments, statusChanges] = await Promise.all([
      prisma.loadBid.findMany({
        where: { carrierId, updatedAt: { gte: since }, status: { in: ['ACCEPTED', 'REJECTED'] } },
        include: { load: { select: { loadNumber: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
      prisma.carrierPayment.findMany({
        where: { carrierId, updatedAt: { gte: since } },
        include: { load: { select: { loadNumber: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
      prisma.loadAuditLog.findMany({
        where: {
          load: { carrierId },
          action: 'status_changed',
          changedAt: { gte: since },
        },
        include: { load: { select: { loadNumber: true, id: true } } },
        orderBy: { changedAt: 'desc' },
        take: 20,
      }),
    ]);

    const notifications = [
      ...bids.map(b => ({
        id: `bid-${b.id}`,
        type: b.status === 'ACCEPTED' ? 'BID_ACCEPTED' : 'BID_REJECTED',
        title: b.status === 'ACCEPTED' ? 'Bid Accepted' : 'Bid Rejected',
        body: `Your bid on load ${b.load.loadNumber} was ${b.status.toLowerCase()}.`,
        loadId: b.loadId,
        loadNumber: b.load.loadNumber,
        createdAt: b.updatedAt,
      })),
      ...payments.map(p => ({
        id: `pay-${p.id}`,
        type: 'PAYMENT_UPDATE',
        title: 'Payment Update',
        body: `Payment for ${p.load.loadNumber}: ${p.status} — $${p.amount.toLocaleString()}`,
        loadId: p.loadId,
        loadNumber: p.load.loadNumber,
        createdAt: p.updatedAt,
      })),
      ...statusChanges.map(a => ({
        id: `status-${a.id}`,
        type: 'LOAD_STATUS',
        title: 'Load Status Updated',
        body: `Load ${a.load.loadNumber} is now ${a.toValue?.replace(/_/g, ' ')}.`,
        loadId: a.load.id,
        loadNumber: a.load.loadNumber,
        createdAt: a.changedAt,
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 30);

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = {
  getCarrierMe, updateCarrierMe, updateCarrierCompany, changeCarrierPassword,
  getCarrierLoads, getCarrierLoadDetail, updateCarrierLoadStatus,
  uploadCarrierPOD, getCarrierDocuments,
  getOpenLoads, expressInterest, submitBid, withdrawBid,
  getCarrierPayments,
  getCarrierConversations, getConversationDetail, sendCarrierMessage, startConversation,
  getCarrierNotifications,
};
