const router = require('express').Router();
const { generateRateConfirmation, generateBOL, getDocuments } = require('../controllers/documents.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.use(verifyToken);
router.get('/', getDocuments);
router.get('/loads/:id/rate-confirmation', generateRateConfirmation);
router.get('/loads/:id/bol', generateBOL);

module.exports = router;
