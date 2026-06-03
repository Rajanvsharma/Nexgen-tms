const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const SAFE_SELECT = {
  id: true, email: true, firstName: true, lastName: true,
  role: true, isActive: true, createdAt: true, updatedAt: true,
};

async function getUsers(_req, res) {
  try {
    const users = await prisma.user.findMany({ select: SAFE_SELECT, orderBy: { createdAt: 'desc' } });
    res.json(users);
  } catch (err) {
    console.error('getUsers error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function createUser(req, res) {
  try {
    const { email, password, firstName, lastName, role } = req.body;
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ message: 'email, password, firstName, lastName are required' });
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ message: 'Email already in use' });

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, password: hashed, firstName, lastName, role: role || 'DISPATCHER' },
      select: SAFE_SELECT,
    });
    res.status(201).json(user);
  } catch (err) {
    console.error('createUser error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateUser(req, res) {
  try {
    const { id } = req.params;
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
    await prisma.user.delete({ where: { id } });
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('deleteUser error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getUsers, createUser, updateUser, deleteUser };
