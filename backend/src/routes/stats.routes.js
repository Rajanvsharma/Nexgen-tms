const router = require('express').Router();
const { getStats } = require('../controllers/stats.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.use(verifyToken);
router.get('/', getStats);

module.exports = router;
