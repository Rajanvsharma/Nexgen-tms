const router = require('express').Router();
const { getRateSuggestion, composeEmail, fraudScan, getInsights, getLoadSummary, optimizeMargin, getAgentLogs, triggerAgent, negotiateRate } = require('../controllers/ai.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

router.use(verifyToken);

// AI features
router.post('/rate-suggestion', getRateSuggestion);
router.post('/compose-email', composeEmail);
router.post('/fraud-scan/:carrierId', fraudScan);
router.get('/insights', requireRole('ADMIN', 'ACCOUNTING'), getInsights);
router.get('/load-summary/:id', getLoadSummary);
router.get('/margin-optimizer', requireRole('ADMIN', 'ACCOUNTING'), optimizeMargin);

// Agent management
router.get('/agent-logs', getAgentLogs);
router.post('/agents/:agentName/run', requireRole('ADMIN'), triggerAgent);

// Voice negotiation
router.post('/negotiate', negotiateRate);

module.exports = router;
