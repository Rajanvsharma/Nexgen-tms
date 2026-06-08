const { PrismaClient } = require('@prisma/client');
const https = require('https');
const prisma = new PrismaClient();

async function postToDAT(load) {
  const apiKey = process.env.DAT_API_KEY;
  if (!apiKey) return { postingId: `DAT-SIM-${Date.now()}`, simulated: true };

  // DAT Freight & Analytics REST API
  // Docs: https://freight.dat.com/freight-exchange-api
  const payload = JSON.stringify({
    origin: { city: load.pickupCity, stateProv: load.pickupState },
    destination: { city: load.deliveryCity, stateProv: load.deliveryState },
    equipmentType: mapEquipmentToDAT(load.equipment),
    weight: load.weight,
    loadDate: load.pickupDate,
    postedRate: load.carrierRate,
    commodity: load.commodity || 'General Freight',
    comments: load.specialInstructions || '',
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'freight.dat.com',
      path: '/freight-exchange/v2/loads',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const body = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) resolve({ postingId: body.id || body.loadId, simulated: false });
          else reject(new Error(body.message || `DAT API error ${res.statusCode}`));
        } catch { reject(new Error('DAT API: invalid response')); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function postToTruckstop(load) {
  const apiKey = process.env.TRUCKSTOP_API_KEY;
  if (!apiKey) return { postingId: `TRUCKSTOP-SIM-${Date.now()}`, simulated: true };

  // Truckstop.com Integration Platform API
  const payload = JSON.stringify({
    originCity: load.pickupCity, originState: load.pickupState,
    destinationCity: load.deliveryCity, destinationState: load.deliveryState,
    equipmentType: mapEquipmentToTruckstop(load.equipment),
    weight: load.weight, pickupDate: load.pickupDate,
    rate: load.carrierRate, commodity: load.commodity,
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.integration.truckstop.com',
      path: '/webservices/loadboard/v3/loads',
      method: 'POST',
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const body = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) resolve({ postingId: body.loadId || body.id, simulated: false });
          else reject(new Error(body.message || `Truckstop API error ${res.statusCode}`));
        } catch { reject(new Error('Truckstop API: invalid response')); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function mapEquipmentToDAT(eq) {
  const map = { 'Dry Van': 'V', 'Reefer': 'R', 'Flatbed': 'F', 'Step Deck': 'SD', 'Power Only': 'PO', 'Box Truck': 'BT' };
  return map[eq] || 'V';
}
function mapEquipmentToTruckstop(eq) {
  const map = { 'Dry Van': 'V', 'Reefer': 'R', 'Flatbed': 'F', 'Step Deck': 'SD', 'Power Only': 'PO' };
  return map[eq] || 'V';
}

async function postToBoard(board, load) {
  switch (board) {
    case 'DAT':        return postToDAT(load);
    case 'TRUCKSTOP':  return postToTruckstop(load);
    default:           return { postingId: `${board}-SIM-${Date.now()}`, simulated: true };
  }
}

async function postLoad(req, res) {
  try {
    const { boards } = req.body; // array: ['DAT', 'TRUCKSTOP', 'BULKLOADS']
    if (!boards || !boards.length) return res.status(400).json({ message: 'boards array is required' });

    const load = await prisma.load.findUnique({
      where: { id: req.params.id },
      include: { customer: { select: { name: true } } },
    });
    if (!load) return res.status(404).json({ message: 'Load not found' });
    if (!['CREATED', 'DISPATCHED'].includes(load.status)) {
      return res.status(400).json({ message: 'Only CREATED or DISPATCHED loads can be posted' });
    }

    const results = [];
    for (const board of boards) {
      const existing = await prisma.loadBoardPosting.findFirst({ where: { loadId: load.id, board, status: 'POSTED' } });
      if (existing) { results.push({ board, status: 'ALREADY_POSTED', postingId: existing.postingId }); continue; }

      const { postingId, simulated } = await postToBoard(board, load);
      await prisma.loadBoardPosting.create({ data: { loadId: load.id, board, postingId, status: 'POSTED' } });
      results.push({ board, status: 'POSTED', postingId, simulated: !!simulated });
    }

    res.json(results);
  } catch (err) {
    console.error('postLoad error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function removePosting(req, res) {
  try {
    const { board } = req.body;
    const posting = await prisma.loadBoardPosting.findFirst({ where: { loadId: req.params.id, board, status: 'POSTED' } });
    if (!posting) return res.status(404).json({ message: 'Posting not found' });

    await prisma.loadBoardPosting.update({ where: { id: posting.id }, data: { status: 'REMOVED', removedAt: new Date() } });
    res.json({ message: 'Removed' });
  } catch (err) {
    console.error('removePosting error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getPostings(req, res) {
  try {
    const postings = await prisma.loadBoardPosting.findMany({
      where: { loadId: req.params.id },
      orderBy: { postedAt: 'desc' },
    });
    res.json(postings);
  } catch (err) {
    console.error('getPostings error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { postLoad, removePosting, getPostings };
