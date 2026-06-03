const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getCustomers(req, res) {
  try {
    const where = req.user.role === 'ADMIN' ? {} : { createdById: req.user.id };
    const customers = await prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { loads: true, quotes: true } } },
    });
    res.json(customers);
  } catch (err) {
    console.error('getCustomers error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getCustomer(req, res) {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
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
    const { name, email, phone, address, city, state, zipCode, creditTerms, notes } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required' });

    const customer = await prisma.customer.create({
      data: { name, email, phone, address, city, state, zipCode, creditTerms: creditTerms || 30, notes, createdById: req.user.id },
    });
    res.status(201).json(customer);
  } catch (err) {
    console.error('createCustomer error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateCustomer(req, res) {
  try {
    const { name, email, phone, address, city, state, zipCode, creditTerms, notes, isActive } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (phone !== undefined) data.phone = phone;
    if (address !== undefined) data.address = address;
    if (city !== undefined) data.city = city;
    if (state !== undefined) data.state = state;
    if (zipCode !== undefined) data.zipCode = zipCode;
    if (creditTerms !== undefined) data.creditTerms = creditTerms;
    if (notes !== undefined) data.notes = notes;
    if (isActive !== undefined) data.isActive = isActive;

    const customer = await prisma.customer.update({ where: { id: req.params.id }, data });
    res.json(customer);
  } catch (err) {
    console.error('updateCustomer error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getCustomers, getCustomer, createCustomer, updateCustomer };
