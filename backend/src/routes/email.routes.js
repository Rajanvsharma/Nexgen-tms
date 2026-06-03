const router = require('express').Router();
const { getConfig, saveConfig, testAndPoll, getEmailLogs, createQuoteFromEmail, skipEmailLog } = require('../controllers/email.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.use(verifyToken);

router.get('/config', getConfig);
router.post('/config', saveConfig);
router.post('/poll', testAndPoll);
router.get('/logs', getEmailLogs);
router.post('/logs/:id/quote', createQuoteFromEmail);
router.patch('/logs/:id/skip', skipEmailLog);

module.exports = router;
