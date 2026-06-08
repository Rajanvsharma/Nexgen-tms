const router = require('express').Router();
const { getPlans, createCheckoutSession, handleWebhook, getPortalSession } = require('../controllers/stripe.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

// Stripe webhook — raw body needed
router.post('/webhook', handleWebhook);

// Public plan listing
router.get('/plans', getPlans);

// Authenticated billing actions (ADMIN only)
router.post('/checkout', verifyToken, requireRole('ADMIN'), createCheckoutSession);
router.post('/portal', verifyToken, requireRole('ADMIN'), getPortalSession);

module.exports = router;
