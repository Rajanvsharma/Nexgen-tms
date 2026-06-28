const prisma  = require('../services/prisma.service');
const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');
const { sendCarrierInviteEmail } = require('../services/outbound.service');

async function getCarriers(req, res) {
  try {
    const orgId = req.user.organizationId;
    const carriers = await prisma.carrier.findMany({
      where: { organizationId: orgId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { loads: true, lanes: true } },
        portalUsers: {
          select: { id: true, firstName: true, lastName: true, email: true, resetToken: true, createdAt: true },
        },
      },
    });
    res.json(carriers);
  } catch (err) {
    console.error('getCarriers error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getCarrier(req, res) {
  try {
    const carrier = await prisma.carrier.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
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
    const orgId = req.user.organizationId;
    const { name, mcNumber, dotNumber, email, phone, address, city, state, zipCode, equipmentTypes, insuranceExpiry, authorityExpiry, w9OnFile, notes } = req.body;
    if (!name || !mcNumber) return res.status(400).json({ message: 'name and mcNumber are required' });

    const exists = await prisma.carrier.findFirst({ where: { mcNumber, organizationId: orgId } });
    if (exists) return res.status(409).json({ message: 'MC number already exists in your network' });

    const carrier = await prisma.carrier.create({
      data: {
        organizationId: orgId, name, mcNumber, dotNumber, email, phone, address, city, state, zipCode,
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
    const exists = await prisma.carrier.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (!exists) return res.status(404).json({ message: 'Carrier not found' });

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
    const exists = await prisma.carrier.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (!exists) return res.status(404).json({ message: 'Carrier not found' });

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
    const carrier = await prisma.carrier.findFirst({ where: { id, organizationId: req.user.organizationId }, select: { _count: { select: { loads: true } } } });
    if (!carrier) return res.status(404).json({ message: 'Carrier not found' });
    if (carrier._count.loads > 0) return res.status(400).json({ message: `Cannot delete carrier with ${carrier._count.loads} load(s). Mark as BLACKLISTED instead.` });
    await prisma.carrier.delete({ where: { id } });
    res.json({ message: 'Carrier deleted' });
  } catch (err) {
    console.error('deleteCarrier error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// Invite existing carrier to portal
async function inviteCarrier(req, res) {
  try {
    const { firstName, lastName, email } = req.body;
    if (!email || !firstName) return res.status(400).json({ message: 'First name and email are required' });

    const carrier = await prisma.carrier.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (!carrier) return res.status(404).json({ message: 'Carrier not found' });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ message: 'An account with this email already exists' });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const randomPw = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);

    const portalUser = await prisma.user.create({
      data: {
        organizationId: req.user.organizationId,
        email,
        password: randomPw,
        firstName,
        lastName: lastName || '',
        role: 'CARRIER',
        isActive: true,
        carrierId: carrier.id,
        resetToken: hashedToken,
        resetTokenExpiry: new Date(Date.now() + 72 * 60 * 60 * 1000),
      },
    });

    const inviteUrl = `${process.env.FRONTEND_URL || 'https://nexgentms.vercel.app'}/reset-password?token=${rawToken}`;
    const inviter = await prisma.user.findUnique({ where: { id: req.user.id }, select: { firstName: true, lastName: true } });
    const invitedBy = inviter ? `${inviter.firstName} ${inviter.lastName}`.trim() : 'NexGen TMS';

    await sendCarrierInviteEmail({ toEmail: email, firstName, companyName: carrier.name, inviteUrl, invitedBy });

    res.status(201).json({
      portalUserId: portalUser.id,
      carrierId: carrier.id,
      inviteUrl: !process.env.RESEND_API_KEY ? inviteUrl : null,
      emailSent: !!process.env.RESEND_API_KEY,
    });
  } catch (err) {
    console.error('inviteCarrier error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// Invite new carrier (create carrier + portal user together)
async function inviteNewCarrier(req, res) {
  try {
    const orgId = req.user.organizationId;
    const {
      companyName, mcNumber, dotNumber, companyEmail, companyPhone,
      companyAddress, companyCity, companyState, companyZip,
      equipmentTypes,
      contactFirstName, contactLastName, contactEmail,
    } = req.body;

    if (!companyName) return res.status(400).json({ message: 'Company name is required' });
    if (!mcNumber)    return res.status(400).json({ message: 'MC Number is required' });
    if (!contactEmail || !contactFirstName) return res.status(400).json({ message: 'Contact first name and email are required' });

    const emailInUse = await prisma.user.findUnique({ where: { email: contactEmail } });
    if (emailInUse) return res.status(409).json({ message: 'An account with this email already exists' });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const randomPw = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);

    const { carrier, portalUser } = await prisma.$transaction(async (tx) => {
      const carrier = await tx.carrier.create({
        data: {
          organizationId: orgId,
          name: companyName,
          mcNumber,
          dotNumber: dotNumber || null,
          email: companyEmail || null,
          phone: companyPhone || null,
          address: companyAddress || null,
          city: companyCity || null,
          state: companyState || null,
          zipCode: companyZip || null,
          equipmentTypes: equipmentTypes || [],
        },
      });
      const portalUser = await tx.user.create({
        data: {
          organizationId: orgId,
          email: contactEmail,
          password: randomPw,
          firstName: contactFirstName,
          lastName: contactLastName || '',
          role: 'CARRIER',
          isActive: true,
          carrierId: carrier.id,
          resetToken: hashedToken,
          resetTokenExpiry: new Date(Date.now() + 72 * 60 * 60 * 1000),
        },
      });
      return { carrier, portalUser };
    });

    const inviteUrl = `${process.env.FRONTEND_URL || 'https://nexgentms.vercel.app'}/reset-password?token=${rawToken}`;
    const inviter = await prisma.user.findUnique({ where: { id: req.user.id }, select: { firstName: true, lastName: true } });
    const invitedBy = inviter ? `${inviter.firstName} ${inviter.lastName}`.trim() : 'NexGen TMS';

    await sendCarrierInviteEmail({ toEmail: contactEmail, firstName: contactFirstName, companyName, inviteUrl, invitedBy });

    res.status(201).json({
      carrierId: carrier.id,
      portalUserId: portalUser.id,
      inviteUrl: !process.env.RESEND_API_KEY ? inviteUrl : null,
      emailSent: !!process.env.RESEND_API_KEY,
      carrierName: companyName,
    });
  } catch (err) {
    console.error('inviteNewCarrier error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getCarriers, getCarrier, createCarrier, updateCarrier, deleteCarrier, addLane, inviteCarrier, inviteNewCarrier };
