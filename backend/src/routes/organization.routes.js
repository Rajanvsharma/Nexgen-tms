const router = require('express').Router();
const { getOrganization, updateOrganization, getMembers, getAiConfig, saveAiConfig, getCustomDomains, setCustomDomains, resolveTenantByDomain } = require('../controllers/organization.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

router.get('/', verifyToken, getOrganization);
router.patch('/', verifyToken, requireRole('ADMIN'), updateOrganization);
router.get('/members', verifyToken, getMembers);
router.get('/ai-config', verifyToken, getAiConfig);
router.post('/ai-config', verifyToken, requireRole('ADMIN'), saveAiConfig);
router.get('/domains', verifyToken, getCustomDomains);
router.put('/domains', verifyToken, requireRole('ADMIN'), setCustomDomains);

// Public — no auth, used by Next.js middleware to resolve custom hostname → org
router.get('/resolve-domain', resolveTenantByDomain);

module.exports = router;
