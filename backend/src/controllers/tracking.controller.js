const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Public endpoint — carriers/drivers update load location via a token or load number
async function updateLocation(req, res) {
  try {
    const { lat, lng, note } = req.body;
    if (!lat || !lng) return res.status(400).json({ message: 'lat and lng are required' });
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return res.status(400).json({ message: 'Invalid coordinates' });

    const load = await prisma.load.findUnique({
      where: { id: req.params.id },
      select: { id: true, status: true, trackingHistory: true },
    });
    if (!load) return res.status(404).json({ message: 'Load not found' });

    const newPoint = { lat, lng, timestamp: new Date().toISOString(), note: note || null };
    const history = Array.isArray(load.trackingHistory) ? load.trackingHistory : [];
    history.push(newPoint);
    if (history.length > 200) history.splice(0, history.length - 200); // keep last 200 points

    await prisma.load.update({
      where: { id: load.id },
      data: {
        trackingLat: lat,
        trackingLng: lng,
        trackingUpdatedAt: new Date(),
        trackingHistory: history,
      },
    });

    res.json({ message: 'Location updated', point: newPoint });
  } catch (err) {
    console.error('updateLocation error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getTracking(req, res) {
  try {
    const load = await prisma.load.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, loadNumber: true, status: true,
        pickupCity: true, pickupState: true,
        deliveryCity: true, deliveryState: true,
        pickupDate: true, deliveryDate: true,
        driverName: true, driverPhone: true,
        trackingLat: true, trackingLng: true,
        trackingUpdatedAt: true, trackingHistory: true,
        carrier: { select: { name: true, phone: true } },
      },
    });
    if (!load) return res.status(404).json({ message: 'Load not found' });
    res.json(load);
  } catch (err) {
    console.error('getTracking error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// Get all active loads with location data
async function getActiveTracking(_req, res) {
  try {
    const loads = await prisma.load.findMany({
      where: {
        status: { in: ['DISPATCHED', 'DRIVER_ON_ROUTE', 'IN_TRANSIT', 'ON_ROUTE', 'LOADING', 'UNLOADING'] },
        trackingLat: { not: null },
      },
      select: {
        id: true, loadNumber: true, status: true,
        pickupCity: true, pickupState: true,
        deliveryCity: true, deliveryState: true,
        trackingLat: true, trackingLng: true,
        trackingUpdatedAt: true,
        driverName: true,
        carrier: { select: { name: true } },
        customer: { select: { name: true } },
      },
    });
    res.json(loads);
  } catch (err) {
    console.error('getActiveTracking error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { updateLocation, getTracking, getActiveTracking };
