const router = require('express').Router();
const { getBranding, getAllBranding, createBranding, updateBranding, deleteBranding } = require('../controllers/branding.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

// Public — frontend calls this on load to get branding for the domain
router.get('/', getBranding);

// Admin only
router.get('/all', verifyToken, requireRole('ADMIN'), getAllBranding);
router.post('/', verifyToken, requireRole('ADMIN'), createBranding);
router.put('/:id', verifyToken, requireRole('ADMIN'), updateBranding);
router.delete('/:id', verifyToken, requireRole('ADMIN'), deleteBranding);

module.exports = router;
