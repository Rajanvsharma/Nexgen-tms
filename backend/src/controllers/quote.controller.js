const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function nextQuoteNumber() {
  // Find the highest Q-XXXXX number, ignoring other formats (QSP-..., etc.)
  const quotes = await prisma.quote.findMany({
    where: { quoteNumber: { startsWith: 'Q-' } },
    select: { quoteNumber: true },
    orderBy: { createdAt: 'desc' },
  });
  let max = 1000;
  for (const q of quotes) {
    const n = parseInt(q.quoteNumber.replace('Q-', ''), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return `Q-${String(max + 1).padStart(5, '0')}`;
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
    const quote = await prisma.quote.findUnique({
      where: { id: req.params.id },
      include: { load: { select: { id: true } } },
    });
    if (!quote) return res.status(404).json({ message: 'Quote not found' });
    if (quote.status !== 'APPROVED') return res.status(400).json({ message: 'Quote must be APPROVED before converting to load' });
    if (quote.load) return res.status(400).json({ message: 'Quote already converted to a load' });

    // Credit limit check
    const customer = await prisma.customer.findUnique({ where: { id: quote.customerId }, select: { creditLimit: true, name: true } });
    if (customer && customer.creditLimit != null) {
      const agg = await prisma.load.aggregate({
        where: { customerId: quote.customerId, status: { notIn: ['CANCELLED', 'COMPLETED', 'RECEIVED'] } },
        _sum: { customerRate: true },
      });
      const used = agg._sum.customerRate || 0;
      const available = customer.creditLimit - used;
      if (quote.rate > available) {
        const fmt = n => `$${Math.round(n).toLocaleString('en-US')}`;
        return res.status(400).json({ message: `Credit limit exceeded for "${customer.name}". Available: ${fmt(available)}, Load value: ${fmt(quote.rate)}. Increase the credit limit first.` });
      }
    }

    // Derive next load number safely — scan all PRO- numbers for the highest
    const loads = await prisma.load.findMany({ select: { loadNumber: true } });
    let maxNum = 10000;
    for (const l of loads) {
      const n = parseInt(l.loadNumber.replace('PRO-', ''), 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
    const loadNumber = `PRO-${String(maxNum + 1).padStart(6, '0')}`;

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

async function updateQuote(req, res) {
  try {
    const { customerId, pickupCity, pickupState, deliveryCity, deliveryState, commodity, weight, equipment, pickupDate, deliveryDate, rate, specialInstructions, source } = req.body;
    const data = {};
    if (customerId !== undefined) data.customerId = customerId;
    if (pickupCity !== undefined) data.pickupCity = pickupCity;
    if (pickupState !== undefined) data.pickupState = pickupState;
    if (deliveryCity !== undefined) data.deliveryCity = deliveryCity;
    if (deliveryState !== undefined) data.deliveryState = deliveryState;
    if (commodity !== undefined) data.commodity = commodity;
    if (weight !== undefined) data.weight = weight ? parseFloat(weight) : null;
    if (equipment !== undefined) data.equipment = equipment;
    if (pickupDate !== undefined) data.pickupDate = pickupDate ? new Date(pickupDate) : null;
    if (deliveryDate !== undefined) data.deliveryDate = deliveryDate ? new Date(deliveryDate) : null;
    if (rate !== undefined) data.rate = parseFloat(rate);
    if (specialInstructions !== undefined) data.specialInstructions = specialInstructions;
    if (source !== undefined) data.source = source;

    const quote = await prisma.quote.update({
      where: { id: req.params.id }, data,
      include: { customer: { select: { id: true, name: true } } },
    });
    res.json(quote);
  } catch (err) {
    console.error('updateQuote error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function deleteQuote(req, res) {
  try {
    const { id } = req.params;
    const quote = await prisma.quote.findUnique({ where: { id }, select: { load: { select: { id: true } } } });
    if (!quote) return res.status(404).json({ message: 'Quote not found' });
    if (quote.load) return res.status(400).json({ message: 'Quote is already converted to a load. Delete the load first.' });
    await prisma.quote.delete({ where: { id } });
    res.json({ message: 'Quote deleted' });
  } catch (err) {
    console.error('deleteQuote error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getQuotes, getQuote, createQuote, updateQuote, updateQuoteStatus, deleteQuote, convertToLoad };
