const router = require('express').Router();
const { getUsers, createUser, updateUser, deleteUser, inviteUser, resendInvite } = require('../controllers/user.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

router.use(verifyToken);

// TEAM_MANAGER and OPS_MANAGER can list users (scoped in controller)
router.get('/', requireRole('ADMIN', 'OPS_MANAGER', 'TEAM_MANAGER'), getUsers);
router.post('/', createUser);
router.post('/invite', inviteUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);
router.post('/:id/resend-invite', resendInvite);

module.exports = router;
