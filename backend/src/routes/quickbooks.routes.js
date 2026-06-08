const router = require('express').Router();
const { getStatus, getOAuthUrl, handleCallback, exportInvoice } = require('../controllers/quickbooks.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

// OAuth callback is public (browser redirect from QuickBooks)
router.get('/callback', handleCallback);

router.use(verifyToken, requireRole('ADMIN', 'ACCOUNTING'));
router.get('/status', getStatus);
router.get('/auth', getOAuthUrl);
router.post('/invoices/:id/export', exportInvoice);

module.exports = router;
