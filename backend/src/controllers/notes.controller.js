const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getNotes(req, res) {
  try {
    const { loadId, carrierId, customerId } = req.query;
    const where = {};
    if (loadId) where.loadId = loadId;
    if (carrierId) where.carrierId = carrierId;
    if (customerId) where.customerId = customerId;

    const notes = await prisma.note.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { firstName: true, lastName: true, role: true } } },
    });
    res.json(notes);
  } catch (err) {
    console.error('getNotes error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function createNote(req, res) {
  try {
    const { body, loadId, carrierId, customerId } = req.body;
    if (!body) return res.status(400).json({ message: 'Note body is required' });
    if (!loadId && !carrierId && !customerId) {
      return res.status(400).json({ message: 'Must specify loadId, carrierId, or customerId' });
    }

    const note = await prisma.note.create({
      data: { body, loadId, carrierId, customerId, authorId: req.user.id },
      include: { author: { select: { firstName: true, lastName: true, role: true } } },
    });
    res.status(201).json(note);
  } catch (err) {
    console.error('createNote error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function deleteNote(req, res) {
  try {
    const note = await prisma.note.findUnique({ where: { id: req.params.id } });
    if (!note) return res.status(404).json({ message: 'Note not found' });
    if (note.authorId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    await prisma.note.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('deleteNote error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getNotes, createNote, deleteNote };
