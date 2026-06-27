const prisma = require('../services/prisma.service');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendShipperInviteEmail } = require('../services/outbound.service');

const CREDIT_EXCLUDED = ['CANCELLED', 'COMPLETED', 'RECEIVED'];

async function getCustomers(req, res) {
  try {
    const orgId = req.user.organizationId;
    const where = { organizationId: orgId };

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { loads: true, quotes: true } },
        loads: { where: { status: { notIn: CREDIT_EXCLUDED } }, select: { customerRate: true } },
      },
    });
    const result = customers.map(c => {
      const usedCredit = c.loads.reduce((sum, l) => sum + l.customerRate, 0);
      const availableCredit = c.creditLimit != null ? c.creditLimit - usedCredit : null;
      const { loads, ...rest } = c;
      return { ...rest, usedCredit, availableCredit };
    });
    res.json(result);
  } catch (err) {
    console.error('getCustomers error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getCustomer(req, res) {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      include: {
        loads: { orderBy: { createdAt: 'desc' }, take: 10 },
        quotes: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    console.error('getCustomer error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function createCustomer(req, res) {
  try {
    const orgId = req.user.organizationId;
    const { name, email, phone, address, city, state, zipCode, creditTerms, creditLimit, notes } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required' });

    const customer = await prisma.customer.create({
      data: {
        organizationId: orgId, name, email, phone, address, city, state, zipCode,
        creditTerms: creditTerms || 30,
        creditLimit: creditLimit ? parseFloat(creditLimit) : null,
        notes, createdById: req.user.id,
      },
    });
    res.status(201).json(customer);
  } catch (err) {
    console.error('createCustomer error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateCustomer(req, res) {
  try {
    const exists = await prisma.customer.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
    if (!exists) return res.status(404).json({ message: 'Customer not found' });

    const { name, email, phone, address, city, state, zipCode, creditTerms, creditLimit, notes, isActive } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (phone !== undefined) data.phone = phone;
    if (address !== undefined) data.address = address;
    if (city !== undefined) data.city = city;
    if (state !== undefined) data.state = state;
    if (zipCode !== undefined) data.zipCode = zipCode;
    if (creditTerms !== undefined) data.creditTerms = parseInt(creditTerms) || 30;
    if (creditLimit !== undefined) data.creditLimit = creditLimit ? parseFloat(creditLimit) : null;
    if (notes !== undefined) data.notes = notes;
    if (isActive !== undefined) data.isActive = isActive;

    const customer = await prisma.customer.update({ where: { id: req.params.id }, data });
    res.json(customer);
  } catch (err) {
    console.error('updateCustomer error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function deleteCustomer(req, res) {
  try {
    const { id } = req.params;
    const customer = await prisma.customer.findFirst({ where: { id, organizationId: req.user.organizationId }, select: { _count: { select: { loads: true, quotes: true } } } });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    if (customer._count.loads > 0 || customer._count.quotes > 0) {
      return res.status(400).json({ message: `Cannot delete customer with ${customer._count.loads} load(s). Deactivate instead.` });
    }
    await prisma.customer.delete({ where: { id } });
    res.json({ message: 'Customer deleted' });
  } catch (err) {
    console.error('deleteCustomer error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function inviteShipper(req, res) {
  try {
    const orgId = req.user.organizationId;
    const { id } = req.params;
    const { email, firstName, lastName } = req.body;
    if (!email || !firstName) {
      return res.status(400).json({ message: 'email and firstName are required' });
    }

    const customer = await prisma.customer.findFirst({ where: { id, organizationId: orgId } });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ message: 'An account with this email already exists' });

    const randomPw = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiry = new Date(Date.now() + 72 * 60 * 60 * 1000);

    await prisma.user.create({
      data: {
        organizationId: orgId,
        email,
        password: randomPw,
        firstName,
        lastName: lastName || '',
        role: 'CUSTOMER',
        isActive: true,
        customerId: id,
        resetToken: hashedToken,
        resetTokenExpiry: expiry,
      },
    });

    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${rawToken}`;
    const inviter = await prisma.user.findUnique({ where: { id: req.user.id }, select: { firstName: true, lastName: true, email: true } });
    const invitedBy = inviter ? `${inviter.firstName} ${inviter.lastName}`.trim() : inviter?.email || 'NexGen TMS';
    await sendShipperInviteEmail({ toEmail: email, firstName, companyName: customer.name, inviteUrl, invitedBy });

    res.status(201).json({
      inviteUrl: !process.env.RESEND_API_KEY ? inviteUrl : null,
      emailSent: !!process.env.RESEND_API_KEY,
      customerName: customer.name,
    });
  } catch (err) {
    console.error('inviteShipper error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer, inviteShipper };
