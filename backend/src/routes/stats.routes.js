const router = require('express').Router();
const { getStats, getTeamOverview } = require('../controllers/stats.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

router.use(verifyToken);
router.get('/', getStats);
router.get('/team-overview', requireRole('TEAM_MANAGER'), getTeamOverview);

module.exports = router;
