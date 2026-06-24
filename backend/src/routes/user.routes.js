const router = require('express').Router();
const { getUsers, createUser, updateUser, deleteUser, inviteUser } = require('../controllers/user.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

router.use(verifyToken, requireRole('ADMIN'));

router.get('/', getUsers);
router.post('/', createUser);
router.post('/invite', inviteUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;
