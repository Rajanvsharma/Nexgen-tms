const router = require('express').Router();
const { getQuotes, getQuote, createQuote, updateQuoteStatus, convertToLoad } = require('../controllers/quote.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.use(verifyToken);
router.get('/', getQuotes);
router.get('/:id', getQuote);
router.post('/', createQuote);
router.patch('/:id/status', updateQuoteStatus);
router.post('/:id/convert', convertToLoad);

module.exports = router;
