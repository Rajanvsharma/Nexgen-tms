const router = require('express').Router();
const { getCarriers, getCarrier, createCarrier, updateCarrier, addLane } = require('../controllers/carrier.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.use(verifyToken);
router.get('/', getCarriers);
router.get('/:id', getCarrier);
router.post('/', createCarrier);
router.put('/:id', updateCarrier);
router.post('/:id/lanes', addLane);

module.exports = router;
