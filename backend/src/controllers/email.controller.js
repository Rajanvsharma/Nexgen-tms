const { PrismaClient } = require('@prisma/client');
const { checkMailbox } = require('../services/email.service');

const prisma = new PrismaClient();

// ─── Email Config ─────────────────────────────────────────────────────────────

async function getConfig(req, res) {
  try {
    const config = await prisma.emailConfig.findFirst({ where: { userId: req.user.id } });
    if (!config) return res.json(null);
    res.json({ ...config, password: '••••••••' });
  } catch (err) {
    console.error('getConfig error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function saveConfig(req, res) {
  try {
    const { host, port, username, password, folder, isActive } = req.body;
    if (!host || !username || !password) return res.status(400).json({ message: 'host, username, and password are required' });

    const existing = await prisma.emailConfig.findFirst({ where: { userId: req.user.id } });
    const data = { host, port: parseInt(port) || 993, username, folder: folder || 'INBOX', isActive: isActive !== false };
    if (password !== '••••••••') data.password = password;

    let config;
    if (existing) {
      config = await prisma.emailConfig.update({ where: { id: existing.id }, data });
    } else {
      config = await prisma.emailConfig.create({ data: { ...data, userId: req.user.id } });
    }

    res.json({ ...config, password: '••••••••' });
  } catch (err) {
    console.error('saveConfig error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function testAndPoll(req, res) {
  try {
    const config = await prisma.emailConfig.findFirst({ where: { userId: req.user.id } });
    if (!config) return res.status(404).json({ message: 'No email config found' });

    const count = await checkMailbox(config);
    res.json({ message: `Mailbox checked. ${count} new email(s) processed.`, count });
  } catch (err) {
    console.error('testAndPoll error:', err);
    res.status(500).json({ message: `Connection failed: ${err.message}` });
  }
}

// ─── Email Logs ───────────────────────────────────────────────────────────────

async function getEmailLogs(req, res) {
  try {
    const logs = await prisma.emailLog.findMany({
      orderBy: { receivedAt: 'desc' },
      take: 100,
    });
    res.json(logs);
  } catch (err) {
    console.error('getEmailLogs error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function createQuoteFromEmail(req, res) {
  try {
    const log = await prisma.emailLog.findUnique({ where: { id: req.params.id } });
    if (!log) return res.status(404).json({ message: 'Email log not found' });
    if (log.status === 'QUOTE_CREATED') return res.status(400).json({ message: 'Quote already created from this email' });

    const { customerId, pickupCity, pickupState, deliveryCity, deliveryState,
      commodity, weight, equipment, pickupDate, deliveryDate, rate, specialInstructions } = req.body;

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
        source: `EMAIL:${log.fromEmail}`,
        createdById: req.user.id,
      },
      include: { customer: { select: { id: true, name: true } } },
    });

    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: 'QUOTE_CREATED', quoteId: quote.id },
    });

    res.status(201).json(quote);
  } catch (err) {
    console.error('createQuoteFromEmail error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function skipEmailLog(req, res) {
  try {
    await prisma.emailLog.update({ where: { id: req.params.id }, data: { status: 'SKIPPED' } });
    res.json({ message: 'Skipped' });
  } catch (err) {
    console.error('skipEmailLog error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getConfig, saveConfig, testAndPoll, getEmailLogs, createQuoteFromEmail, skipEmailLog };
