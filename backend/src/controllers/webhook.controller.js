const prisma = require('../services/prisma.service');
const crypto = require('crypto');

async function listEndpoints(req, res) {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { organizationId: req.user.organizationId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(endpoints);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function createEndpoint(req, res) {
  try {
    const { url, events, description } = req.body;
    if (!url || !events?.length) return res.status(400).json({ message: 'url and events required' });
    const secret = crypto.randomBytes(32).toString('hex');
    const ep = await prisma.webhookEndpoint.create({
      data: {
        organizationId: req.user.organizationId,
        url,
        secret,
        events,
        description,
      },
    });
    res.status(201).json(ep);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function updateEndpoint(req, res) {
  try {
    const { url, events, description, isActive } = req.body;
    const ep = await prisma.webhookEndpoint.updateMany({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      data: { url, events, description, isActive },
    });
    if (ep.count === 0) return res.status(404).json({ message: 'Endpoint not found' });
    res.json({ updated: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function deleteEndpoint(req, res) {
  try {
    await prisma.webhookEndpoint.deleteMany({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function listDeliveries(req, res) {
  try {
    const deliveries = await prisma.webhookDelivery.findMany({
      where: { endpoint: { organizationId: req.user.organizationId } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { endpoint: { select: { url: true } } },
    });
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = { listEndpoints, createEndpoint, updateEndpoint, deleteEndpoint, listDeliveries };
