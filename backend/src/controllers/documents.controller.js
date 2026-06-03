const { PrismaClient } = require('@prisma/client');
const PDFDocument = require('pdfkit');
const prisma = new PrismaClient();

function formatDate(d) {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatMoney(n) {
  if (n == null) return 'N/A';
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

async function generateRateConfirmation(req, res) {
  try {
    const load = await prisma.load.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        carrier: true,
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });
    if (!load) return res.status(404).json({ message: 'Load not found' });

    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="rate-confirmation-${load.loadNumber}.pdf"`);
    doc.pipe(res);

    // Header
    doc.fontSize(20).fillColor('#1e40af').text('NexGen TMS', 50, 50);
    doc.fontSize(10).fillColor('#6b7280').text('Transportation Management System', 50, 75);
    doc.fontSize(16).fillColor('#111827').text('RATE CONFIRMATION', 350, 50, { align: 'right' });
    doc.fontSize(10).fillColor('#6b7280').text(`Load #: ${load.loadNumber}`, 350, 75, { align: 'right' });
    doc.text(`Date: ${formatDate(new Date())}`, 350, 90, { align: 'right' });

    doc.moveTo(50, 115).lineTo(562, 115).strokeColor('#e5e7eb').stroke();

    // Shipper / Customer
    doc.fontSize(11).fillColor('#374151').text('SHIPPER (CUSTOMER)', 50, 130);
    doc.fontSize(10).fillColor('#111827')
      .text(load.customer.name, 50, 148)
      .text(load.customer.email || '', 50, 163)
      .text(load.customer.phone || '', 50, 178);

    // Carrier
    doc.fontSize(11).fillColor('#374151').text('CARRIER', 310, 130);
    doc.fontSize(10).fillColor('#111827')
      .text(load.carrier?.name || 'TBD', 310, 148)
      .text(`MC: ${load.carrier?.mcNumber || 'N/A'}`, 310, 163)
      .text(load.carrier?.phone || '', 310, 178);

    doc.moveTo(50, 200).lineTo(562, 200).strokeColor('#e5e7eb').stroke();

    // Shipment Details
    doc.fontSize(11).fillColor('#374151').text('SHIPMENT DETAILS', 50, 215);
    const details = [
      ['Pickup', `${load.pickupCity}, ${load.pickupState}`, 'Delivery', `${load.deliveryCity}, ${load.deliveryState}`],
      ['Pickup Date', formatDate(load.pickupDate), 'Delivery Date', formatDate(load.deliveryDate)],
      ['Equipment', load.equipment, 'Commodity', load.commodity || 'N/A'],
      ['Weight', load.weight ? `${load.weight.toLocaleString()} lbs` : 'N/A', 'Status', load.status],
    ];

    let y = 235;
    for (const [l1, v1, l2, v2] of details) {
      doc.fontSize(9).fillColor('#6b7280').text(l1, 50, y);
      doc.fontSize(10).fillColor('#111827').text(v1, 150, y);
      doc.fontSize(9).fillColor('#6b7280').text(l2, 310, y);
      doc.fontSize(10).fillColor('#111827').text(v2, 410, y);
      y += 20;
    }

    if (load.specialInstructions) {
      doc.fontSize(9).fillColor('#6b7280').text('Special Instructions', 50, y);
      doc.fontSize(10).fillColor('#111827').text(load.specialInstructions, 150, y);
      y += 20;
    }

    doc.moveTo(50, y + 10).lineTo(562, y + 10).strokeColor('#e5e7eb').stroke();

    // Rate
    y += 25;
    doc.fontSize(11).fillColor('#374151').text('RATE DETAILS', 50, y);
    y += 20;
    doc.fontSize(10).fillColor('#6b7280').text('Carrier Rate:', 50, y);
    doc.fontSize(14).fillColor('#1e40af').text(formatMoney(load.carrierRate), 150, y - 2);

    doc.moveTo(50, y + 30).lineTo(562, y + 30).strokeColor('#e5e7eb').stroke();

    // Terms
    y += 45;
    doc.fontSize(9).fillColor('#6b7280')
      .text('TERMS & CONDITIONS', 50, y)
      .text('1. Carrier agrees to transport the above-described shipment at the stated rate.', 50, y + 15)
      .text('2. Carrier must provide proof of delivery (POD) within 48 hours of delivery.', 50, y + 28)
      .text('3. Payment terms: Net 30 days from receipt of invoice and POD.', 50, y + 41)
      .text('4. Carrier must maintain minimum liability insurance as required by FMCSA.', 50, y + 54);

    // Signature lines
    y += 85;
    doc.moveTo(50, y).lineTo(220, y).strokeColor('#374151').stroke();
    doc.moveTo(310, y).lineTo(480, y).strokeColor('#374151').stroke();
    doc.fontSize(9).fillColor('#6b7280')
      .text('Carrier Signature / Date', 50, y + 5)
      .text('Broker Signature / Date', 310, y + 5);

    doc.end();

    // Save document record
    await prisma.document.create({
      data: { type: 'RATE_CONFIRMATION', loadId: load.id, filename: `rate-confirmation-${load.loadNumber}.pdf`, createdById: req.user.id },
    }).catch(() => {});
  } catch (err) {
    console.error('generateRateConfirmation error:', err);
    if (!res.headersSent) res.status(500).json({ message: 'Internal server error' });
  }
}

async function generateBOL(req, res) {
  try {
    const load = await prisma.load.findUnique({
      where: { id: req.params.id },
      include: { customer: true, carrier: true },
    });
    if (!load) return res.status(404).json({ message: 'Load not found' });

    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="bol-${load.loadNumber}.pdf"`);
    doc.pipe(res);

    doc.fontSize(20).fillColor('#1e40af').text('NexGen TMS', 50, 50);
    doc.fontSize(16).fillColor('#111827').text('BILL OF LADING', 350, 50, { align: 'right' });
    doc.fontSize(10).fillColor('#6b7280').text(`PRO #: ${load.loadNumber}`, 350, 72, { align: 'right' });
    doc.text(`Date: ${formatDate(new Date())}`, 350, 87, { align: 'right' });

    doc.moveTo(50, 110).lineTo(562, 110).strokeColor('#e5e7eb').stroke();

    doc.fontSize(11).fillColor('#374151').text('SHIPPER', 50, 125);
    doc.fontSize(10).fillColor('#111827')
      .text(load.customer.name, 50, 143)
      .text(`${load.pickupCity}, ${load.pickupState}`, 50, 158);

    doc.fontSize(11).fillColor('#374151').text('CONSIGNEE', 310, 125);
    doc.fontSize(10).fillColor('#111827')
      .text(load.customer.name, 310, 143)
      .text(`${load.deliveryCity}, ${load.deliveryState}`, 310, 158);

    doc.moveTo(50, 180).lineTo(562, 180).strokeColor('#e5e7eb').stroke();

    doc.fontSize(11).fillColor('#374151').text('CARRIER INFORMATION', 50, 195);
    doc.fontSize(10).fillColor('#111827')
      .text(`Carrier: ${load.carrier?.name || 'TBD'}`, 50, 213)
      .text(`MC #: ${load.carrier?.mcNumber || 'N/A'}`, 50, 228)
      .text(`Driver: ${load.driverName || 'TBD'}`, 310, 213)
      .text(`Driver Phone: ${load.driverPhone || 'N/A'}`, 310, 228);

    doc.moveTo(50, 250).lineTo(562, 250).strokeColor('#e5e7eb').stroke();

    // Freight table header
    doc.rect(50, 265, 512, 20).fill('#f3f4f6');
    doc.fontSize(9).fillColor('#374151')
      .text('COMMODITY', 55, 271)
      .text('WEIGHT', 250, 271)
      .text('EQUIPMENT', 350, 271)
      .text('SPECIAL INSTRUCTIONS', 430, 271);

    doc.fontSize(10).fillColor('#111827')
      .text(load.commodity || 'General Freight', 55, 292)
      .text(load.weight ? `${load.weight.toLocaleString()} lbs` : 'N/A', 250, 292)
      .text(load.equipment, 350, 292)
      .text(load.specialInstructions || 'None', 430, 292, { width: 130 });

    doc.moveTo(50, 330).lineTo(562, 330).strokeColor('#e5e7eb').stroke();

    doc.fontSize(9).fillColor('#6b7280').text(
      'RECEIVED in apparent good order, except as noted (contents and condition of contents of packages unknown), marked, consigned, and destined as shown above which carrier (the word carrier being understood throughout this contract as meaning any person or corporation in possession of the property under the contract) agrees to carry to its usual place of delivery at destination, if on its route, otherwise to deliver to another carrier on the route to destination. It is mutually agreed that the responsibility of this carrier shall be limited to its own line.',
      50, 345, { width: 512 }
    );

    let sigY = 440;
    doc.moveTo(50, sigY).lineTo(220, sigY).strokeColor('#374151').stroke();
    doc.moveTo(310, sigY).lineTo(480, sigY).strokeColor('#374151').stroke();
    doc.fontSize(9).fillColor('#6b7280')
      .text('Shipper Signature / Date', 50, sigY + 5)
      .text('Carrier Signature / Date', 310, sigY + 5);

    doc.end();

    await prisma.document.create({
      data: { type: 'BOL', loadId: load.id, filename: `bol-${load.loadNumber}.pdf`, createdById: req.user.id },
    }).catch(() => {});
  } catch (err) {
    console.error('generateBOL error:', err);
    if (!res.headersSent) res.status(500).json({ message: 'Internal server error' });
  }
}

async function getDocuments(req, res) {
  try {
    const { loadId } = req.query;
    const docs = await prisma.document.findMany({
      where: loadId ? { loadId } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        load: { select: { loadNumber: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });
    res.json(docs);
  } catch (err) {
    console.error('getDocuments error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { generateRateConfirmation, generateBOL, getDocuments };
