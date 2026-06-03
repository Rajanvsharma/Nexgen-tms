const router = require('express').Router();
const { getCustomers, getCustomer, createCustomer, updateCustomer } = require('../controllers/customer.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.use(verifyToken);
router.get('/', getCustomers);
router.get('/:id', getCustomer);
router.post('/', createCustomer);
router.put('/:id', updateCustomer);

module.exports = router;
