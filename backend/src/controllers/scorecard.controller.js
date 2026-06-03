const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getCarrierScorecard(req, res) {
  try {
    const carriers = await prisma.carrier.findMany({
      where: { status: 'ACTIVE' },
      include: {
        performances: { select: { pickupOnTime: true, deliveryOnTime: true, hasClaim: true, claimAmount: true, hasDetention: true, rating: true } },
        tonuRecords: { select: { id: true } },
        _count: { select: { loads: true } },
      },
      orderBy: { name: 'asc' },
    });

    const scorecards = carriers.map((c) => {
      const perf = c.performances;
      const total = perf.length;
      const onTimePickup = total > 0 ? (perf.filter((p) => p.pickupOnTime).length / total * 100).toFixed(1) : null;
      const onTimeDelivery = total > 0 ? (perf.filter((p) => p.deliveryOnTime).length / total * 100).toFixed(1) : null;
      const claimRate = total > 0 ? (perf.filter((p) => p.hasClaim).length / total * 100).toFixed(1) : null;
      const detentionRate = total > 0 ? (perf.filter((p) => p.hasDetention).length / total * 100).toFixed(1) : null;
      const avgRating = perf.filter((p) => p.rating).length > 0
        ? (perf.filter((p) => p.rating).reduce((s, p) => s + p.rating, 0) / perf.filter((p) => p.rating).length).toFixed(1)
        : null;
      const totalClaimAmount = perf.reduce((s, p) => s + (p.claimAmount || 0), 0);
      const tonuCount = c.tonuRecords.length;

      // Score 0-100
      let score = 100;
      if (onTimePickup !== null) score -= (100 - parseFloat(onTimePickup)) * 0.3;
      if (onTimeDelivery !== null) score -= (100 - parseFloat(onTimeDelivery)) * 0.4;
      if (claimRate !== null) score -= parseFloat(claimRate) * 1.5;
      score -= tonuCount * 5;
      score = Math.max(0, Math.min(100, score)).toFixed(0);

      return {
        id: c.id, name: c.name, mcNumber: c.mcNumber, totalLoads: c._count.loads,
        scoredLoads: total, onTimePickup, onTimeDelivery, claimRate, detentionRate,
        avgRating, totalClaimAmount, tonuCount, score,
      };
    });

    res.json(scorecards.sort((a, b) => parseFloat(b.score) - parseFloat(a.score)));
  } catch (err) {
    console.error('getCarrierScorecard error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function recordPerformance(req, res) {
  try {
    const { loadId, scheduledPickup, actualPickup, scheduledDelivery, actualDelivery, hasDetention, detentionHours, hasClaim, claimAmount, rating, notes } = req.body;
    if (!loadId) return res.status(400).json({ message: 'loadId is required' });

    const load = await prisma.load.findUnique({ where: { id: loadId } });
    if (!load || !load.carrierId) return res.status(400).json({ message: 'Load or carrier not found' });

    const pickupOnTime = scheduledPickup && actualPickup ? new Date(actualPickup) <= new Date(scheduledPickup) : null;
    const deliveryOnTime = scheduledDelivery && actualDelivery ? new Date(actualDelivery) <= new Date(scheduledDelivery) : null;

    const existing = await prisma.loadPerformance.findUnique({ where: { loadId } });
    let perf;
    if (existing) {
      perf = await prisma.loadPerformance.update({
        where: { loadId },
        data: {
          scheduledPickup: scheduledPickup ? new Date(scheduledPickup) : undefined,
          actualPickup: actualPickup ? new Date(actualPickup) : undefined,
          scheduledDelivery: scheduledDelivery ? new Date(scheduledDelivery) : undefined,
          actualDelivery: actualDelivery ? new Date(actualDelivery) : undefined,
          pickupOnTime, deliveryOnTime,
          hasDetention: hasDetention ?? false,
          detentionHours: detentionHours ? parseFloat(detentionHours) : undefined,
          hasClaim: hasClaim ?? false,
          claimAmount: claimAmount ? parseFloat(claimAmount) : undefined,
          rating: rating ? parseInt(rating) : undefined,
          notes,
        },
      });
    } else {
      perf = await prisma.loadPerformance.create({
        data: {
          loadId, carrierId: load.carrierId,
          scheduledPickup: scheduledPickup ? new Date(scheduledPickup) : null,
          actualPickup: actualPickup ? new Date(actualPickup) : null,
          scheduledDelivery: scheduledDelivery ? new Date(scheduledDelivery) : null,
          actualDelivery: actualDelivery ? new Date(actualDelivery) : null,
          pickupOnTime, deliveryOnTime,
          hasDetention: hasDetention ?? false,
          detentionHours: detentionHours ? parseFloat(detentionHours) : null,
          hasClaim: hasClaim ?? false,
          claimAmount: claimAmount ? parseFloat(claimAmount) : null,
          rating: rating ? parseInt(rating) : null,
          notes,
        },
      });
    }
    res.json(perf);
  } catch (err) {
    console.error('recordPerformance error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function recordTonu(req, res) {
  try {
    const { carrierId, loadId, amount, reason, notes } = req.body;
    if (!carrierId) return res.status(400).json({ message: 'carrierId is required' });

    const tonu = await prisma.tonuRecord.create({
      data: { carrierId, loadId: loadId || null, amount: parseFloat(amount) || 0, reason, notes },
    });
    res.status(201).json(tonu);
  } catch (err) {
    console.error('recordTonu error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getCarrierScorecard, recordPerformance, recordTonu };
