const router = require('express').Router();
const { getMyQuotes, getMyLoads, createQuote, parseEmail, parseExcel, getPortalMe } = require('../controllers/portal.controller');
const { verifyToken } = require('../middleware/auth.middleware');

function requireCustomer(req, res, next) {
  if (req.user?.role !== 'CUSTOMER') return res.status(403).json({ message: 'Customer portal access only' });
  next();
}

router.use(verifyToken, requireCustomer);

router.get('/me', getPortalMe);
router.get('/quotes', getMyQuotes);
router.get('/loads', getMyLoads);
router.post('/quotes', createQuote);
router.post('/quotes/parse-email', parseEmail);
router.post('/quotes/parse-excel', parseExcel);

module.exports = router;
