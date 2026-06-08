const router = require('express').Router();
const { generateRateConfirmation, generateBOL, getDocuments, sendRateConfirmation, getSignRequest, submitSignature } = require('../controllers/documents.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Public signing routes (no auth — carrier accesses via emailed link)
router.get('/sign/:token', getSignRequest);
router.post('/sign/:token', submitSignature);

router.use(verifyToken);
router.get('/', getDocuments);
router.get('/loads/:id/rate-confirmation', generateRateConfirmation);
router.get('/loads/:id/bol', generateBOL);
router.post('/loads/:id/send-rate-confirmation', sendRateConfirmation);

module.exports = router;
