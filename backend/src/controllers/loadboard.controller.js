const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Load board stubs — replace with real API calls when credentials are available
async function postToBoard(board, load) {
  // Simulated posting — in production, call DAT/Truckstop/BulkLoads APIs here
  const mockPostingId = `${board}-${Date.now()}`;
  return { postingId: mockPostingId, success: true };
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

      const { postingId } = await postToBoard(board, load);
      await prisma.loadBoardPosting.create({ data: { loadId: load.id, board, postingId, status: 'POSTED' } });
      results.push({ board, status: 'POSTED', postingId });
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
