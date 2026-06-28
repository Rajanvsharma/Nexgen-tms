const router = require('express').Router();
const multer = require('multer');
const { getQuotes, getQuote, createQuote, updateQuote, updateQuoteStatus, deleteQuote, convertToLoad, uploadQuotes } = require('../controllers/quote.controller');
const { verifyToken } = require('../middleware/auth.middleware');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(verifyToken);
router.get('/', getQuotes);
router.get('/:id', getQuote);
router.post('/', createQuote);
router.post('/upload', upload.single('file'), uploadQuotes);
router.put('/:id', updateQuote);
router.patch('/:id/status', updateQuoteStatus);
router.delete('/:id', deleteQuote);
router.post('/:id/convert', convertToLoad);

module.exports = router;
