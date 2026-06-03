const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function getAnnouncements(req, res) {
  try {
    const announcements = await prisma.announcement.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        poster: { select: { firstName: true, lastName: true, role: true } },
        reads: { where: { userId: req.user.id }, select: { readAt: true } },
      },
    });

    const result = announcements.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      postedBy: `${a.poster.firstName} ${a.poster.lastName}`,
      posterRole: a.poster.role,
      createdAt: a.createdAt,
      isRead: a.reads.length > 0,
    }));

    res.json(result);
  } catch (err) {
    console.error('getAnnouncements error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function createAnnouncement(req, res) {
  try {
    const { title, body } = req.body;
    if (!title || !body) return res.status(400).json({ message: 'title and body are required' });

    const announcement = await prisma.announcement.create({
      data: { title, body, postedBy: req.user.id },
      include: { poster: { select: { firstName: true, lastName: true } } },
    });

    res.status(201).json({
      id: announcement.id,
      title: announcement.title,
      body: announcement.body,
      postedBy: `${announcement.poster.firstName} ${announcement.poster.lastName}`,
      createdAt: announcement.createdAt,
      isRead: false,
    });
  } catch (err) {
    console.error('createAnnouncement error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function markRead(req, res) {
  try {
    const { id } = req.params;
    await prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId: id, userId: req.user.id } },
      create: { announcementId: id, userId: req.user.id },
      update: {},
    });
    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error('markRead error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function deactivateAnnouncement(req, res) {
  try {
    const { id } = req.params;
    await prisma.announcement.update({ where: { id }, data: { isActive: false } });
    res.json({ message: 'Announcement deactivated' });
  } catch (err) {
    console.error('deactivateAnnouncement error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getAnnouncements, createAnnouncement, markRead, deactivateAnnouncement };
