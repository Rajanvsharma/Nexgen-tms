const { PrismaClient } = require('@prisma/client');
const { parseEmailBody } = require('../services/email.service');
const fs = require('fs');
const prisma = new PrismaClient();

async function uploadAndParse(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    // Read file text if it's a text/plain, otherwise use filename heuristics
    // For image/PDF files: in production, integrate with Google Vision or Tesseract
    let bodyText = '';
    if (req.file.mimetype === 'text/plain') {
      bodyText = fs.readFileSync(req.file.path, 'utf8');
    } else {
      bodyText = req.body.extractedText || '';
    }

    const parsedData = parseEmailBody(req.file.originalname, bodyText);

    const log = await prisma.ocrLog.create({
      data: {
        filename: req.file.originalname,
        parsedData,
        status: parsedData.pickupCity && parsedData.deliveryCity ? 'PARSED' : 'PENDING',
        createdById: req.user.id,
      },
    });

    // Clean up temp file
    fs.unlink(req.file.path, () => {});

    res.status(201).json(log);
  } catch (err) {
    console.error('uploadAndParse error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getOcrLogs(req, res) {
  try {
    const logs = await prisma.ocrLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    });
    res.json(logs);
  } catch (err) {
    console.error('getOcrLogs error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function createQuoteFromOcr(req, res) {
  try {
    const log = await prisma.ocrLog.findUnique({ where: { id: req.params.id } });
    if (!log) return res.status(404).json({ message: 'OCR log not found' });
    if (log.quoteId) return res.status(400).json({ message: 'Quote already created' });

    const { customerId, pickupCity, pickupState, deliveryCity, deliveryState, commodity, weight, equipment, pickupDate, deliveryDate, rate, specialInstructions } = req.body;
    if (!customerId || !pickupCity || !deliveryCity || !equipment || !rate) {
      return res.status(400).json({ message: 'customerId, cities, equipment, and rate are required' });
    }

    const last = await prisma.quote.findFirst({ orderBy: { createdAt: 'desc' }, select: { quoteNumber: true } });
    const num = last ? parseInt(last.quoteNumber.replace('Q-', ''), 10) + 1 : 1001;
    const quoteNumber = `Q-${String(num).padStart(5, '0')}`;

    const quote = await prisma.quote.create({
      data: {
        quoteNumber, customerId, pickupCity, pickupState, deliveryCity, deliveryState,
        commodity, weight: weight ? parseFloat(weight) : null, equipment,
        pickupDate: pickupDate ? new Date(pickupDate) : null,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        rate: parseFloat(rate), specialInstructions,
        source: `OCR:${log.filename}`,
        createdById: req.user.id,
      },
      include: { customer: { select: { id: true, name: true } } },
    });

    await prisma.ocrLog.update({ where: { id: log.id }, data: { quoteId: quote.id, status: 'QUOTE_CREATED' } });
    res.status(201).json(quote);
  } catch (err) {
    console.error('createQuoteFromOcr error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { uploadAndParse, getOcrLogs, createQuoteFromOcr };
