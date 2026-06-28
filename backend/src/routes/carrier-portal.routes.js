const router = require('express').Router();
const multer = require('multer');
const {
  getCarrierMe, updateCarrierMe, updateCarrierCompany, changeCarrierPassword,
  getCarrierLoads, getCarrierLoadDetail, updateCarrierLoadStatus,
  uploadCarrierPOD, getCarrierDocuments,
  getOpenLoads, expressInterest, submitBid, withdrawBid,
  getCarrierPayments,
  getCarrierConversations, getConversationDetail, sendCarrierMessage, startConversation,
  getCarrierNotifications,
} = require('../controllers/carrier-portal.controller');
const { verifyToken } = require('../middleware/auth.middleware');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function requireCarrier(req, res, next) {
  if (req.user?.role !== 'CARRIER') return res.status(403).json({ message: 'Carrier portal access only' });
  next();
}

router.use(verifyToken, requireCarrier);

// Profile
router.get('/me',              getCarrierMe);
router.put('/me',              updateCarrierMe);
router.put('/me/password',     changeCarrierPassword);
router.put('/company',         updateCarrierCompany);

// My loads
router.get('/loads',           getCarrierLoads);
router.get('/loads/:id',       getCarrierLoadDetail);
router.put('/loads/:id/status', updateCarrierLoadStatus);
router.post('/loads/:id/pod',  upload.single('file'), uploadCarrierPOD);

// Documents
router.get('/documents',       getCarrierDocuments);

// Available loads & bidding
router.get('/open-loads',      getOpenLoads);
router.post('/open-loads/:id/bid',      submitBid);
router.delete('/open-loads/:id/bid',    withdrawBid);
router.post('/open-loads/:id/interest', expressInterest);

// Payments
router.get('/payments',        getCarrierPayments);

// Messaging
router.get('/conversations',           getCarrierConversations);
router.post('/conversations',          startConversation);
router.get('/conversations/:id',       getConversationDetail);
router.post('/conversations/:id/messages', sendCarrierMessage);

// Notifications
router.get('/notifications',   getCarrierNotifications);

module.exports = router;
