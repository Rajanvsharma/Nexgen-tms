const router = require('express').Router();
const { getCarriers, getCarrier, createCarrier, updateCarrier, deleteCarrier, addLane } = require('../controllers/carrier.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.use(verifyToken);
router.get('/', getCarriers);
router.get('/:id', getCarrier);
router.post('/', createCarrier);
router.put('/:id', updateCarrier);
router.delete('/:id', deleteCarrier);
router.post('/:id/lanes', addLane);

module.exports = router;
