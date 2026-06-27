const prisma = require('../services/prisma.service');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendUserInviteEmail } = require('../services/outbound.service');


const SAFE_SELECT = {
  id: true, email: true, firstName: true, lastName: true,
  role: true, isActive: true, customerId: true, createdAt: true, updatedAt: true,
};

async function getUsers(req, res) {
  try {
    const users = await prisma.user.findMany({
      where: { organizationId: req.user.organizationId },
      select: SAFE_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (err) {
    console.error('getUsers error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function createUser(req, res) {
  try {
    const orgId = req.user.organizationId;
    const { email, password, firstName, lastName, role, customerId } = req.body;
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ message: 'email, password, firstName, lastName are required' });
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ message: 'Email already in use' });

    // Check user limit for this org
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { maxUsers: true } });
    const userCount = await prisma.user.count({ where: { organizationId: orgId, isActive: true } });
    if (org && userCount >= org.maxUsers) {
      return res.status(403).json({ message: `User limit reached (${org.maxUsers}). Upgrade your plan to add more users.` });
    }

    const hashed = await bcrypt.hash(password, 12);
    const data = { organizationId: orgId, email, password: hashed, firstName, lastName, role: role || 'DISPATCHER' };
    if (customerId) data.customerId = customerId;

    const user = await prisma.user.create({ data, select: SAFE_SELECT });
    res.status(201).json(user);
  } catch (err) {
    console.error('createUser error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const target = await prisma.user.findFirst({ where: { id, organizationId: req.user.organizationId } });
    if (!target) return res.status(404).json({ message: 'User not found' });

    const { firstName, lastName, role, isActive, password } = req.body;
    const data = {};
    if (firstName !== undefined) data.firstName = firstName;
    if (lastName !== undefined) data.lastName = lastName;
    if (role !== undefined) data.role = role;
    if (isActive !== undefined) data.isActive = isActive;
    if (password) data.password = await bcrypt.hash(password, 12);

    const user = await prisma.user.update({ where: { id }, data, select: SAFE_SELECT });
    res.json(user);
  } catch (err) {
    console.error('updateUser error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    if (req.user.id === id) return res.status(400).json({ message: 'Cannot delete your own account' });
    const target = await prisma.user.findFirst({ where: { id, organizationId: req.user.organizationId } });
    if (!target) return res.status(404).json({ message: 'User not found' });
    await prisma.user.delete({ where: { id } });
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('deleteUser error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function inviteUser(req, res) {
  try {
    const orgId = req.user.organizationId;
    const { email, firstName, lastName, role } = req.body;
    if (!email || !firstName || !lastName) {
      return res.status(400).json({ message: 'email, firstName, and lastName are required' });
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ message: 'An account with this email already exists' });

    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { maxUsers: true } });
    const userCount = await prisma.user.count({ where: { organizationId: orgId, isActive: true } });
    if (org && userCount >= org.maxUsers) {
      return res.status(403).json({ message: `User limit reached (${org.maxUsers}). Upgrade your plan.` });
    }

    const randomPw = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiry = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        organizationId: orgId,
        email,
        password: randomPw,
        firstName,
        lastName,
        role: role || 'DISPATCHER',
        isActive: true,
        resetToken: hashedToken,
        resetTokenExpiry: expiry,
      },
      select: SAFE_SELECT,
    });

    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${rawToken}`;
    const inviter = await prisma.user.findUnique({ where: { id: req.user.id }, select: { firstName: true, lastName: true, email: true } });
    const invitedBy = inviter ? `${inviter.firstName} ${inviter.lastName}`.trim() : inviter?.email || 'NexGen TMS';
    await sendUserInviteEmail({ toEmail: email, firstName, inviteUrl, invitedBy, role: role || 'DISPATCHER' });

    res.status(201).json({
      user,
      inviteUrl: !process.env.RESEND_API_KEY ? inviteUrl : null,
      emailSent: !!process.env.RESEND_API_KEY,
    });
  } catch (err) {
    console.error('inviteUser error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getUsers, createUser, updateUser, deleteUser, inviteUser };
