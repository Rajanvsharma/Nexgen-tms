const router = require('express').Router();
const { getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer, inviteShipper, inviteNewShipper } = require('../controllers/customer.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.use(verifyToken);
router.post('/invite-new', inviteNewShipper);
router.get('/', getCustomers);
router.get('/:id', getCustomer);
router.post('/', createCustomer);
router.post('/:id/invite', inviteShipper);
router.put('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);

module.exports = router;
