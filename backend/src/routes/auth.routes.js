const router = require('express').Router();
const { login, refresh, logout, me, updateMe, forgotPassword, resetPassword } = require('../controllers/auth.controller');
const { setupTOTP, verifyAndEnableTOTP, disableTOTP, getTOTPStatus } = require('../controllers/totp.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', verifyToken, me);
router.patch('/me', verifyToken, updateMe);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// 2FA routes
router.get('/2fa/status', verifyToken, getTOTPStatus);
router.post('/2fa/setup', verifyToken, setupTOTP);
router.post('/2fa/verify', verifyToken, verifyAndEnableTOTP);
router.post('/2fa/disable', verifyToken, disableTOTP);

module.exports = router;
