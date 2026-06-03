const router = require('express').Router();
const { chat } = require('../controllers/copilot.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.use(verifyToken);
router.post('/chat', chat);

module.exports = router;
