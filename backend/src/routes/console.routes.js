const router = require('express').Router();
const { getConversations, getCounts, createConversation, updateStatus, addMessage } = require('../controllers/console.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.use(verifyToken);

router.get('/',           getConversations);
router.get('/counts',     getCounts);
router.post('/',          createConversation);
router.patch('/:id/status', updateStatus);
router.post('/:id/messages', addMessage);

module.exports = router;
