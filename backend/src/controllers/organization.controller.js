const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getOrganization(req, res) {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.user.organizationId },
      select: {
        id: true, name: true, slug: true, plan: true,
        subscriptionStatus: true, trialEndsAt: true,
        maxUsers: true, maxLoadsPerMonth: true,
        createdAt: true,
      },
    });
    if (!org) return res.status(404).json({ message: 'Organization not found' });

    const [userCount, loadsThisMonth] = await Promise.all([
      prisma.user.count({ where: { organizationId: org.id, isActive: true } }),
      prisma.load.count({
        where: {
          organizationId: org.id,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
    ]);

    res.json({ ...org, usage: { users: userCount, loadsThisMonth } });
  } catch (err) {
    console.error('getOrganization error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateOrganization(req, res) {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required' });

    const org = await prisma.organization.update({
      where: { id: req.user.organizationId },
      data: { name },
      select: { id: true, name: true, slug: true, plan: true, subscriptionStatus: true, trialEndsAt: true },
    });
    res.json(org);
  } catch (err) {
    console.error('updateOrganization error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getMembers(req, res) {
  try {
    const users = await prisma.user.findMany({
      where: { organizationId: req.user.organizationId },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(users);
  } catch (err) {
    console.error('getMembers error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getOrganization, updateOrganization, getMembers };
