const router = require('express').Router();
const { getInvoices, createInvoice, updateInvoiceStatus, sendInvoice, getPayments, createPayment, updatePaymentStatus } = require('../controllers/accounting.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

router.use(verifyToken, requireRole('ADMIN', 'ACCOUNTING'));

router.get('/invoices', getInvoices);
router.post('/invoices', createInvoice);
router.patch('/invoices/:id/status', updateInvoiceStatus);
router.post('/invoices/:id/send', sendInvoice);

router.get('/payments', getPayments);
router.post('/payments', createPayment);
router.patch('/payments/:id/status', updatePaymentStatus);

module.exports = router;
