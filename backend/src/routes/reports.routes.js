const router = require('express').Router();
const { getRevenueByMonth, getLoadsByStatus, getTopCarriers, getTopCustomers, getEquipmentMix, getAgingReport } = require('../controllers/reports.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

router.use(verifyToken, requireRole('ADMIN', 'ACCOUNTING'));
router.get('/revenue', getRevenueByMonth);
router.get('/loads-by-status', getLoadsByStatus);
router.get('/top-carriers', getTopCarriers);
router.get('/top-customers', getTopCustomers);
router.get('/equipment-mix', getEquipmentMix);
router.get('/aging', getAgingReport);

module.exports = router;
