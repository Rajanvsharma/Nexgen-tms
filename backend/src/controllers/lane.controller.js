const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getLaneRates(req, res) {
  try {
    const orgId     = req.user.organizationId;
    const { originState, destinationState, originCity, destinationCity } = req.query;

    if (!originState || !destinationState) {
      return res.status(400).json({ error: 'originState and destinationState are required' });
    }

    const where = {
      organizationId: orgId,
      pickupState:    originState.toUpperCase(),
      deliveryState:  destinationState.toUpperCase(),
      customerRate:   { gt: 0 },
      status:         { in: ['DELIVERED','COMPLETED','INVOICED','INVOICING','RECEIVED'] },
    };

    if (originCity)      where.pickupCity    = { contains: originCity,      mode: 'insensitive' };
    if (destinationCity) where.deliveryCity  = { contains: destinationCity, mode: 'insensitive' };

    const loads = await prisma.load.findMany({
      where,
      select: {
        customerRate: true, carrierRate: true, margin: true,
        pickupCity: true, pickupState: true,
        deliveryCity: true, deliveryState: true,
        pickupDate: true, createdAt: true,
        equipment: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    if (!loads.length) return res.json({ count: 0, avgRate: null, minRate: null, maxRate: null, avgMargin: null, recentRates: [] });

    const rates   = loads.map(l => l.customerRate);
    const margins = loads.filter(l => l.margin != null).map(l => l.margin);

    const avg = n => n.length ? n.reduce((s, v) => s + v, 0) / n.length : null;

    res.json({
      count:       loads.length,
      avgRate:     avg(rates),
      minRate:     Math.min(...rates),
      maxRate:     Math.max(...rates),
      avgMargin:   avg(margins),
      recentRates: loads.slice(0, 10).map(l => ({
        rate: l.customerRate, margin: l.margin, equipment: l.equipment,
        date: l.pickupDate || l.createdAt,
        route: `${l.pickupCity}, ${l.pickupState} → ${l.deliveryCity}, ${l.deliveryState}`,
      })),
    });
  } catch (err) {
    console.error('getLaneRates error:', err);
    res.status(500).json({ error: 'Failed to fetch lane rates' });
  }
}

module.exports = { getLaneRates };
