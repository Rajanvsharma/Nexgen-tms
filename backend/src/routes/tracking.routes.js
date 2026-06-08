const router = require('express').Router();
const { updateLocation, getTracking, getActiveTracking } = require('../controllers/tracking.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Public location update (drivers post from mobile/carrier portal)
router.post('/loads/:id/location', updateLocation);

// Authenticated routes
router.use(verifyToken);
router.get('/active', getActiveTracking);
router.get('/loads/:id', getTracking);

module.exports = router;
