const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function nextQuoteNumber() {
  const last = await prisma.quote.findFirst({ orderBy: { createdAt: 'desc' }, select: { quoteNumber: true } });
  const num = last ? parseInt(last.quoteNumber.replace('Q-', ''), 10) + 1 : 1001;
  return `Q-${String(num).padStart(5, '0')}`;
}

async function getQuotes(req, res) {
  try {
    const where = req.user.role === 'ADMIN' ? {} : { createdById: req.user.id };
    const quotes = await prisma.quote.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { id: true, name: true } }, createdBy: { select: { firstName: true, lastName: true } } },
    });
    res.json(quotes);
  } catch (err) {
    console.error('getQuotes error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getQuote(req, res) {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id: req.params.id },
      include: { customer: true, createdBy: { select: { firstName: true, lastName: true } }, load: true },
    });
    if (!quote) return res.status(404).json({ message: 'Quote not found' });
    res.json(quote);
  } catch (err) {
    console.error('getQuote error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function createQuote(req, res) {
  try {
    const { customerId, pickupCity, pickupState, deliveryCity, deliveryState, commodity, weight, equipment, pickupDate, deliveryDate, rate, specialInstructions, source } = req.body;
    if (!customerId || !pickupCity || !pickupState || !deliveryCity || !deliveryState || !equipment || !rate) {
      return res.status(400).json({ message: 'customerId, pickup/delivery cities & states, equipment, and rate are required' });
    }

    const quoteNumber = await nextQuoteNumber();
    const quote = await prisma.quote.create({
      data: {
        quoteNumber, customerId, pickupCity, pickupState, deliveryCity, deliveryState,
        commodity, weight: weight ? parseFloat(weight) : null, equipment,
        pickupDate: pickupDate ? new Date(pickupDate) : null,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        rate: parseFloat(rate), specialInstructions, source,
        createdById: req.user.id,
      },
      include: { customer: { select: { id: true, name: true } } },
    });
    res.status(201).json(quote);
  } catch (err) {
    console.error('createQuote error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateQuoteStatus(req, res) {
  try {
    const { status } = req.body;
    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const quote = await prisma.quote.update({ where: { id: req.params.id }, data: { status } });
    res.json(quote);
  } catch (err) {
    console.error('updateQuoteStatus error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function convertToLoad(req, res) {
  try {
    const quote = await prisma.quote.findUnique({ where: { id: req.params.id } });
    if (!quote) return res.status(404).json({ message: 'Quote not found' });
    if (quote.status !== 'APPROVED') return res.status(400).json({ message: 'Quote must be APPROVED before converting to load' });
    if (quote.load) return res.status(400).json({ message: 'Quote already converted to a load' });

    const last = await prisma.load.findFirst({ orderBy: { createdAt: 'desc' }, select: { loadNumber: true } });
    const num = last ? parseInt(last.loadNumber.replace('PRO-', ''), 10) + 1 : 10001;
    const loadNumber = `PRO-${String(num).padStart(6, '0')}`;

    const load = await prisma.load.create({
      data: {
        loadNumber, quoteId: quote.id, customerId: quote.customerId,
        pickupCity: quote.pickupCity, pickupState: quote.pickupState,
        deliveryCity: quote.deliveryCity, deliveryState: quote.deliveryState,
        commodity: quote.commodity, weight: quote.weight, equipment: quote.equipment,
        pickupDate: quote.pickupDate, deliveryDate: quote.deliveryDate,
        customerRate: quote.rate, specialInstructions: quote.specialInstructions,
        createdById: req.user.id,
      },
      include: { customer: { select: { id: true, name: true } } },
    });

    await prisma.quote.update({ where: { id: quote.id }, data: { status: 'CONVERTED' } });
    res.status(201).json(load);
  } catch (err) {
    console.error('convertToLoad error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getQuotes, getQuote, createQuote, updateQuoteStatus, convertToLoad };
