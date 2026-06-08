const express = require('express');
const { verifyToken } = require('../middleware/auth.middleware');
const { listStops, upsertStops, markStopComplete } = require('../controllers/stops.controller');

const router = express.Router({ mergeParams: true });

router.get('/',                   verifyToken, listStops);
router.put('/',                   verifyToken, upsertStops);
router.patch('/:stopId/complete', verifyToken, markStopComplete);

module.exports = router;
