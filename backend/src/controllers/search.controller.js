const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function globalSearch(req, res) {
  try {
    const orgId = req.user.organizationId;
    const q     = (req.query.q || '').trim();

    if (!q || q.length < 2) return res.json({ loads: [], carriers: [], customers: [], quotes: [] });

    const search = { contains: q, mode: 'insensitive' };

    const [loads, carriers, customers, quotes] = await Promise.all([
      prisma.load.findMany({
        where: {
          organizationId: orgId,
          OR: [
            { loadNumber:   search },
            { pickupCity:   search },
            { deliveryCity: search },
            { driverName:   search },
            { commodity:    search },
            { customer: { name: search } },
            { carrier:  { name: search } },
          ],
        },
        select: {
          id: true, loadNumber: true, status: true,
          pickupCity: true, pickupState: true,
          deliveryCity: true, deliveryState: true,
          customerRate: true, createdAt: true,
          customer: { select: { name: true } },
          carrier:  { select: { name: true } },
        },
        take: 8,
        orderBy: { createdAt: 'desc' },
      }),

      prisma.carrier.findMany({
        where: {
          organizationId: orgId,
          OR: [
            { name:     search },
            { mcNumber: search },
            { dotNumber: search },
            { contactName: search },
          ],
        },
        select: { id: true, name: true, mcNumber: true, safetyRating: true, isActive: true },
        take: 6,
      }),

      prisma.customer.findMany({
        where: {
          organizationId: orgId,
          OR: [
            { name:  search },
            { email: search },
            { phone: search },
            { city:  search },
          ],
        },
        select: { id: true, name: true, email: true, phone: true, creditStatus: true },
        take: 6,
      }),

      prisma.quote.findMany({
        where: {
          organizationId: orgId,
          OR: [
            { quoteNumber:  search },
            { pickupCity:   search },
            { deliveryCity: search },
            { customer: { name: search } },
          ],
        },
        select: {
          id: true, quoteNumber: true, status: true,
          pickupCity: true, pickupState: true,
          deliveryCity: true, deliveryState: true,
          rate: true, createdAt: true,
          customer: { select: { name: true } },
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({ loads, carriers, customers, quotes });
  } catch (err) {
    console.error('globalSearch error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
}

module.exports = { globalSearch };
