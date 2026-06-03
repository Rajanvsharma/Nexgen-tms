const router = require('express').Router();
const { login, refresh, logout, me } = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', verifyToken, me);

module.exports = router;
