const prisma = require('../services/prisma.service');
const { uploadFile }   = require('../services/storage.service');
const path             = require('path');
const crypto           = require('crypto');


async function listPODs(req, res) {
  try {
    const orgId  = req.user.organizationId;
    const loadId = req.params.loadId;

    const load = await prisma.load.findFirst({ where: { id: loadId, organizationId: orgId } });
    if (!load) return res.status(404).json({ error: 'Load not found' });

    const pods = await prisma.proofOfDelivery.findMany({
      where: { loadId, organizationId: orgId },
      include: { uploadedBy: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json(pods);
  } catch (err) {
    console.error('listPODs error:', err);
    res.status(500).json({ error: 'Failed to fetch PODs' });
  }
}

async function uploadPOD(req, res) {
  try {
    const orgId  = req.user.organizationId;
    const userId = req.user.id;
    const loadId = req.params.loadId;

    const load = await prisma.load.findFirst({ where: { id: loadId, organizationId: orgId } });
    if (!load) return res.status(404).json({ error: 'Load not found' });

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const ext      = path.extname(req.file.originalname);
    const unique   = crypto.randomBytes(8).toString('hex');
    const filename = `${orgId}/${loadId}/${unique}${ext}`;

    const fileUrl = await uploadFile(req.file.buffer, filename, req.file.mimetype);

    const pod = await prisma.proofOfDelivery.create({
      data: {
        organizationId: orgId,
        loadId,
        filename: req.file.originalname,
        fileUrl,
        fileSize: req.file.size,
        podType:  req.body.podType || 'POD',
        notes:    req.body.notes   || null,
        uploadedById: userId,
      },
      include: { uploadedBy: { select: { firstName: true, lastName: true, email: true } } },
    });

    res.status(201).json(pod);
  } catch (err) {
    console.error('uploadPOD error:', err);
    res.status(500).json({ error: 'Failed to upload POD' });
  }
}

async function deletePOD(req, res) {
  try {
    const orgId = req.user.organizationId;
    const { loadId, podId } = req.params;

    const pod = await prisma.proofOfDelivery.findFirst({
      where: { id: podId, loadId, organizationId: orgId },
    });
    if (!pod) return res.status(404).json({ error: 'POD not found' });

    await prisma.proofOfDelivery.delete({ where: { id: podId } });
    res.json({ success: true });
  } catch (err) {
    console.error('deletePOD error:', err);
    res.status(500).json({ error: 'Failed to delete POD' });
  }
}

module.exports = { listPODs, uploadPOD, deletePOD };
