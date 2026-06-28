const router = require('express').Router();
const { getLoads, getLoad, createLoad, updateLoad, deleteLoad, dispatchLoad, checkDuplicate, assignLoad, getLoadAudit, getLoadBids, acceptBid, rejectBid, getPendingBidsCount } = require('../controllers/load.controller');
const { bulkUpdateStatus, bulkDelete, bulkInvoice } = require('../controllers/bulk.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.use(verifyToken);
router.get('/check-duplicate', checkDuplicate);
router.get('/pending-bids', getPendingBidsCount);
router.get('/', getLoads);
router.get('/:id', getLoad);
router.post('/', createLoad);
router.put('/:id', updateLoad);
router.delete('/:id', deleteLoad);
router.post('/:id/dispatch', dispatchLoad);
router.patch('/:id/assign', assignLoad);
router.get('/:id/audit', getLoadAudit);
router.get('/:id/bids',            getLoadBids);
router.post('/:id/bids/:bidId/accept', acceptBid);
router.post('/:id/bids/:bidId/reject', rejectBid);

// Bulk operations
router.post('/bulk/status',  bulkUpdateStatus);
router.post('/bulk/delete',  bulkDelete);
router.post('/bulk/invoice', bulkInvoice);

module.exports = router;
