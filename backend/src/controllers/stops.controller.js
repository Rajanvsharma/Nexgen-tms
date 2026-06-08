const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listStops(req, res) {
  try {
    const orgId  = req.user.organizationId;
    const loadId = req.params.loadId;

    const load = await prisma.load.findFirst({ where: { id: loadId, organizationId: orgId } });
    if (!load) return res.status(404).json({ error: 'Load not found' });

    const stops = await prisma.loadStop.findMany({
      where: { loadId },
      orderBy: { sequence: 'asc' },
    });

    res.json(stops);
  } catch (err) {
    console.error('listStops error:', err);
    res.status(500).json({ error: 'Failed to fetch stops' });
  }
}

async function upsertStops(req, res) {
  try {
    const orgId  = req.user.organizationId;
    const loadId = req.params.loadId;
    const { stops } = req.body;

    if (!Array.isArray(stops)) return res.status(400).json({ error: 'stops must be an array' });

    const load = await prisma.load.findFirst({ where: { id: loadId, organizationId: orgId } });
    if (!load) return res.status(404).json({ error: 'Load not found' });

    await prisma.$transaction([
      prisma.loadStop.deleteMany({ where: { loadId } }),
      prisma.loadStop.createMany({
        data: stops.map((s, i) => ({
          loadId,
          sequence:        s.sequence ?? i + 1,
          type:            s.type           || 'STOP',
          city:            s.city,
          state:           s.state,
          address:         s.address        || null,
          zipCode:         s.zipCode        || null,
          contactName:     s.contactName    || null,
          contactPhone:    s.contactPhone   || null,
          appointmentDate: s.appointmentDate ? new Date(s.appointmentDate) : null,
          notes:           s.notes          || null,
        })),
      }),
    ]);

    const updated = await prisma.loadStop.findMany({ where: { loadId }, orderBy: { sequence: 'asc' } });
    res.json(updated);
  } catch (err) {
    console.error('upsertStops error:', err);
    res.status(500).json({ error: 'Failed to save stops' });
  }
}

async function markStopComplete(req, res) {
  try {
    const orgId = req.user.organizationId;
    const { loadId, stopId } = req.params;

    const load = await prisma.load.findFirst({ where: { id: loadId, organizationId: orgId } });
    if (!load) return res.status(404).json({ error: 'Load not found' });

    const stop = await prisma.loadStop.findFirst({ where: { id: stopId, loadId } });
    if (!stop) return res.status(404).json({ error: 'Stop not found' });

    const updated = await prisma.loadStop.update({
      where: { id: stopId },
      data: { completedAt: new Date() },
    });

    res.json(updated);
  } catch (err) {
    console.error('markStopComplete error:', err);
    res.status(500).json({ error: 'Failed to update stop' });
  }
}

module.exports = { listStops, upsertStops, markStopComplete };
