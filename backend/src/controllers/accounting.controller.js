const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function nextInvoiceNumber() {
  const last = await prisma.invoice.findFirst({ orderBy: { createdAt: 'desc' }, select: { invoiceNumber: true } });
  const num = last ? parseInt(last.invoiceNumber.replace('INV-', ''), 10) + 1 : 1001;
  return `INV-${String(num).padStart(5, '0')}`;
}

async function getInvoices(_req, res) {
  try {
    const invoices = await prisma.invoice.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        load: { select: { loadNumber: true } },
        customer: { select: { name: true } },
      },
    });
    res.json(invoices);
  } catch (err) {
    console.error('getInvoices error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function createInvoice(req, res) {
  try {
    const { loadId, dueDate, notes } = req.body;
    if (!loadId) return res.status(400).json({ message: 'loadId is required' });

    const load = await prisma.load.findUnique({ where: { id: loadId } });
    if (!load) return res.status(404).json({ message: 'Load not found' });
    if (load.invoice) return res.status(400).json({ message: 'Invoice already exists for this load' });

    const invoiceNumber = await nextInvoiceNumber();
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber, loadId, customerId: load.customerId,
        amount: load.customerRate,
        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + load.customer?.creditTerms * 24 * 60 * 60 * 1000 || 30 * 24 * 60 * 60 * 1000),
        notes,
      },
      include: { load: { select: { loadNumber: true } }, customer: { select: { name: true } } },
    });

    await prisma.load.update({ where: { id: loadId }, data: { status: 'INVOICED' } });
    res.status(201).json(invoice);
  } catch (err) {
    console.error('createInvoice error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateInvoiceStatus(req, res) {
  try {
    const { status, paidDate } = req.body;
    const data = { status };
    if (status === 'PAID') data.paidDate = paidDate ? new Date(paidDate) : new Date();
    const invoice = await prisma.invoice.update({ where: { id: req.params.id }, data });
    res.json(invoice);
  } catch (err) {
    console.error('updateInvoiceStatus error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getPayments(_req, res) {
  try {
    const payments = await prisma.carrierPayment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        load: { select: { loadNumber: true } },
        carrier: { select: { name: true, mcNumber: true } },
      },
    });
    res.json(payments);
  } catch (err) {
    console.error('getPayments error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function createPayment(req, res) {
  try {
    const { loadId, dueDate, notes } = req.body;
    if (!loadId) return res.status(400).json({ message: 'loadId is required' });

    const load = await prisma.load.findUnique({ where: { id: loadId } });
    if (!load) return res.status(404).json({ message: 'Load not found' });
    if (!load.carrierId || !load.carrierRate) return res.status(400).json({ message: 'Load must have carrier and carrier rate assigned' });

    const payment = await prisma.carrierPayment.create({
      data: {
        loadId, carrierId: load.carrierId, amount: load.carrierRate,
        dueDate: dueDate ? new Date(dueDate) : null,
        notes,
      },
      include: { load: { select: { loadNumber: true } }, carrier: { select: { name: true, mcNumber: true } } },
    });
    res.status(201).json(payment);
  } catch (err) {
    console.error('createPayment error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function updatePaymentStatus(req, res) {
  try {
    const { status, paidDate } = req.body;
    const data = { status };
    if (status === 'PAID') data.paidDate = paidDate ? new Date(paidDate) : new Date();
    const payment = await prisma.carrierPayment.update({ where: { id: req.params.id }, data });
    res.json(payment);
  } catch (err) {
    console.error('updatePaymentStatus error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getInvoices, createInvoice, updateInvoiceStatus, getPayments, createPayment, updatePaymentStatus };
