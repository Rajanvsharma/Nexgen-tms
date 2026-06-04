const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const INCLUDE = {
  createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
  load:      { select: { id: true, loadNumber: true, status: true } },
  customer:  { select: { id: true, name: true } },
  carrier:   { select: { id: true, name: true, mcNumber: true } },
  messages: {
    orderBy: { createdAt: 'asc' },
    include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } } },
  },
  _count: { select: { messages: true } },
};

// GET /api/console — list conversations
async function getConversations(req, res) {
  try {
    const { status, search } = req.query;
    const where = {};
    if (status && status !== 'ALL') where.status = status;
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { load: { loadNumber: { contains: search, mode: 'insensitive' } } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { carrier: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }
    // Role scope: non-admins see only their own
    if (req.user.role !== 'ADMIN') where.createdById = req.user.id;

    const conversations = await prisma.conversation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: INCLUDE,
    });

    res.json(conversations);
  } catch (err) {
    console.error('getConversations error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /api/console/counts
async function getCounts(req, res) {
  try {
    const scope = req.user.role !== 'ADMIN' ? { createdById: req.user.id } : {};
    const [all, newC, open, escalated, resolved, reopened] = await Promise.all([
      prisma.conversation.count({ where: scope }),
      prisma.conversation.count({ where: { ...scope, status: 'NEW' } }),
      prisma.conversation.count({ where: { ...scope, status: 'OPEN' } }),
      prisma.conversation.count({ where: { ...scope, status: 'ESCALATED' } }),
      prisma.conversation.count({ where: { ...scope, status: 'RESOLVED' } }),
      prisma.conversation.count({ where: { ...scope, status: 'REOPENED' } }),
    ]);
    res.json({ all, new: newC, open, escalated, resolved, reopened });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
}

// POST /api/console
async function createConversation(req, res) {
  try {
    const { subject, loadId, customerId, carrierId, priority, firstMessage } = req.body;
    if (!subject) return res.status(400).json({ message: 'subject is required' });

    const conv = await prisma.conversation.create({
      data: {
        subject,
        status: 'NEW',
        priority: priority || 'NORMAL',
        createdById: req.user.id,
        loadId: loadId || null,
        customerId: customerId || null,
        carrierId: carrierId || null,
      },
      include: INCLUDE,
    });

    if (firstMessage?.trim()) {
      await prisma.convMessage.create({
        data: { conversationId: conv.id, senderId: req.user.id, content: firstMessage.trim() },
      });
    }

    const fresh = await prisma.conversation.findUnique({ where: { id: conv.id }, include: INCLUDE });
    res.status(201).json(fresh);
  } catch (err) {
    console.error('createConversation error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// PATCH /api/console/:id/status
async function updateStatus(req, res) {
  try {
    const { status } = req.body;
    const valid = ['NEW', 'OPEN', 'ESCALATED', 'RESOLVED', 'REOPENED'];
    if (!valid.includes(status)) return res.status(400).json({ message: 'Invalid status' });
    const conv = await prisma.conversation.update({ where: { id: req.params.id }, data: { status }, include: INCLUDE });
    res.json(conv);
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
}

// POST /api/console/:id/messages
async function addMessage(req, res) {
  try {
    const { content, isInternal, attachmentName } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'content is required' });

    const msg = await prisma.convMessage.create({
      data: {
        conversationId: req.params.id,
        senderId: req.user.id,
        content: content.trim(),
        isInternal: isInternal || false,
        attachmentName: attachmentName || null,
      },
      include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } } },
    });

    // Mark conversation as OPEN when replied to
    await prisma.conversation.update({ where: { id: req.params.id }, data: { status: 'OPEN', updatedAt: new Date() } });

    res.status(201).json(msg);
  } catch (err) {
    console.error('addMessage error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getConversations, getCounts, createConversation, updateStatus, addMessage };
