const { PrismaClient } = require('@prisma/client');
const PDFDocument = require('pdfkit');
const { sendInvoiceEmail } = require('../services/outbound.service');
const prisma = new PrismaClient();

function buildInvoicePDF(invoice, load, customer) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const fmt = n => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US') : 'N/A';

    doc.fontSize(20).fillColor('#1e40af').text('NexGen TMS', 50, 50);
    doc.fontSize(10).fillColor('#6b7280').text('Transportation Management System', 50, 75);
    doc.fontSize(16).fillColor('#111827').text('INVOICE', 400, 50, { align: 'right' });
    doc.fontSize(10).fillColor('#6b7280')
      .text(`Invoice #: ${invoice.invoiceNumber}`, 400, 75, { align: 'right' })
      .text(`Date: ${fmtDate(invoice.createdAt)}`, 400, 90, { align: 'right' })
      .text(`Due: ${fmtDate(invoice.dueDate)}`, 400, 105, { align: 'right' });

    doc.moveTo(50, 125).lineTo(562, 125).strokeColor('#e5e7eb').stroke();
    doc.fontSize(11).fillColor('#374151').text('BILL TO', 50, 140);
    doc.fontSize(10).fillColor('#111827')
      .text(customer.name, 50, 158)
      .text(customer.email || '', 50, 173)
      .text(customer.phone || '', 50, 188);

    doc.fontSize(11).fillColor('#374151').text('LOAD DETAILS', 310, 140);
    doc.fontSize(10).fillColor('#111827')
      .text(`Load #: ${load.loadNumber}`, 310, 158)
      .text(`${load.pickupCity}, ${load.pickupState} → ${load.deliveryCity}, ${load.deliveryState}`, 310, 173)
      .text(`Equipment: ${load.equipment}`, 310, 188);

    doc.moveTo(50, 210).lineTo(562, 210).strokeColor('#e5e7eb').stroke();
    doc.rect(50, 225, 512, 20).fill('#f3f4f6');
    doc.fontSize(9).fillColor('#374151')
      .text('DESCRIPTION', 55, 231).text('AMOUNT', 500, 231, { align: 'right', width: 60 });
    doc.fontSize(10).fillColor('#111827')
      .text(`Freight services — Load ${load.loadNumber}`, 55, 252)
      .text(fmt(invoice.amount), 500, 252, { align: 'right', width: 60 });

    doc.moveTo(50, 275).lineTo(562, 275).strokeColor('#e5e7eb').stroke();
    doc.fontSize(12).fillColor('#111827').text('TOTAL DUE', 400, 285);
    doc.fontSize(16).fillColor('#1e40af').text(fmt(invoice.amount), 400, 303, { align: 'right', width: 160 });

    if (invoice.notes) doc.fontSize(9).fillColor('#6b7280').text('Notes:', 50, 340).text(invoice.notes, 50, 355);
    doc.end();
  });
}

async function nextInvoiceNumber(orgId) {
  const loads = await prisma.load.findMany({ where: { organizationId: orgId }, select: { id: true } });
  const loadIds = loads.map(l => l.id);
  const last = await prisma.invoice.findFirst({
    where: { loadId: { in: loadIds } },
    orderBy: { createdAt: 'desc' },
    select: { invoiceNumber: true },
  });
  const num = last ? parseInt(last.invoiceNumber.replace(/^[^-]+-/, ''), 10) + 1 : 1001;
  return `INV-${String(num).padStart(5, '0')}`;
}

async function getInvoices(req, res) {
  try {
    const orgId = req.user.organizationId;
    const invoices = await prisma.invoice.findMany({
      where: { load: { organizationId: orgId } },
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
    const orgId = req.user.organizationId;
    const { loadId, dueDate, notes } = req.body;
    if (!loadId) return res.status(400).json({ message: 'loadId is required' });

    const load = await prisma.load.findFirst({ where: { id: loadId, organizationId: orgId }, include: { customer: true } });
    if (!load) return res.status(404).json({ message: 'Load not found' });

    const existing = await prisma.invoice.findUnique({ where: { loadId } });
    if (existing) return res.status(400).json({ message: 'Invoice already exists for this load' });

    const invoiceNumber = await nextInvoiceNumber(orgId);
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber, loadId, customerId: load.customerId,
        amount: load.customerRate,
        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + (load.customer?.creditTerms || 30) * 24 * 60 * 60 * 1000),
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

async function getPayments(req, res) {
  try {
    const orgId = req.user.organizationId;
    const payments = await prisma.carrierPayment.findMany({
      where: { load: { organizationId: orgId } },
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
    const orgId = req.user.organizationId;
    const { loadId, dueDate, notes } = req.body;
    if (!loadId) return res.status(400).json({ message: 'loadId is required' });

    const load = await prisma.load.findFirst({ where: { id: loadId, organizationId: orgId } });
    if (!load) return res.status(404).json({ message: 'Load not found' });
    if (!load.carrierId || !load.carrierRate) return res.status(400).json({ message: 'Load must have carrier and carrier rate assigned' });

    const payment = await prisma.carrierPayment.create({
      data: { loadId, carrierId: load.carrierId, amount: load.carrierRate, dueDate: dueDate ? new Date(dueDate) : null, notes },
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

async function sendInvoice(req, res) {
  try {
    const orgId = req.user.organizationId;
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, load: { organizationId: orgId } },
      include: { load: true, customer: true },
    });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (!invoice.customer.email) return res.status(400).json({ message: 'Customer has no email address on file' });

    const pdfBuffer = await buildInvoicePDF(invoice, invoice.load, invoice.customer);
    const result = await sendInvoiceEmail({ invoice, load: invoice.load, customer: invoice.customer, pdfBuffer });

    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'SENT' } });
    res.json({ message: `Invoice sent to ${invoice.customer.email}`, simulated: !!result.simulated });
  } catch (err) {
    console.error('sendInvoice error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getInvoices, createInvoice, updateInvoiceStatus, sendInvoice, getPayments, createPayment, updatePaymentStatus };
