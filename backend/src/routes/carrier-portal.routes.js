const router = require('express').Router();
const {
  getCarrierMe, updateCarrierMe, updateCarrierCompany, changeCarrierPassword,
  getCarrierLoads, getCarrierLoadDetail, getCarrierDocuments,
  getOpenLoads, expressInterest,
} = require('../controllers/carrier-portal.controller');
const { verifyToken } = require('../middleware/auth.middleware');

function requireCarrier(req, res, next) {
  if (req.user?.role !== 'CARRIER') return res.status(403).json({ message: 'Carrier portal access only' });
  next();
}

router.use(verifyToken, requireCarrier);

router.get('/me',             getCarrierMe);
router.put('/me',             updateCarrierMe);
router.put('/me/password',    changeCarrierPassword);
router.put('/company',        updateCarrierCompany);
router.get('/loads',          getCarrierLoads);
router.get('/loads/:id',      getCarrierLoadDetail);
router.get('/documents',      getCarrierDocuments);
router.get('/open-loads',     getOpenLoads);
router.post('/open-loads/:id/interest', expressInterest);

module.exports = router;
