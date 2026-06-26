const router = require('express').Router();
const { getOrganization, updateOrganization, getMembers, getAiConfig, saveAiConfig } = require('../controllers/organization.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

router.get('/', verifyToken, getOrganization);
router.patch('/', verifyToken, requireRole('ADMIN'), updateOrganization);
router.get('/members', verifyToken, getMembers);
router.get('/ai-config', verifyToken, getAiConfig);
router.post('/ai-config', verifyToken, requireRole('ADMIN'), saveAiConfig);

module.exports = router;
