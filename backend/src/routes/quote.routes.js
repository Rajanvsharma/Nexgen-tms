const router = require('express').Router();
const { getQuotes, getQuote, createQuote, updateQuote, updateQuoteStatus, deleteQuote, convertToLoad } = require('../controllers/quote.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.use(verifyToken);
router.get('/', getQuotes);
router.get('/:id', getQuote);
router.post('/', createQuote);
router.put('/:id', updateQuote);
router.patch('/:id/status', updateQuoteStatus);
router.delete('/:id', deleteQuote);
router.post('/:id/convert', convertToLoad);

module.exports = router;
