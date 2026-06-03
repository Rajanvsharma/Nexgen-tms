const router = require('express').Router();
const { getCarrierScorecard, recordPerformance, recordTonu } = require('../controllers/scorecard.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.use(verifyToken);
router.get('/', getCarrierScorecard);
router.post('/performance', recordPerformance);
router.post('/tonu', recordTonu);

module.exports = router;
