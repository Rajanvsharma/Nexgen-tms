const router = require('express').Router();
const { verifyToken } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const { getTeams, getTeam, createTeam, updateTeam, setRepVisibility, assignMember, removeMember } = require('../controllers/team.controller');

router.use(verifyToken);

router.get('/',                       getTeams);
router.get('/:id',                    getTeam);
router.post('/',    requireRole('ADMIN', 'SUPER_ADMIN', 'OPS_MANAGER'), createTeam);
router.put('/:id',  requireRole('ADMIN', 'SUPER_ADMIN', 'OPS_MANAGER'), updateTeam);
router.patch('/:id/visibility', requireRole('ADMIN', 'SUPER_ADMIN', 'OPS_MANAGER'), setRepVisibility);
router.post('/:id/members',           requireRole('ADMIN', 'SUPER_ADMIN', 'OPS_MANAGER', 'TEAM_MANAGER'), assignMember);
router.delete('/:id/members/:userId', requireRole('ADMIN', 'SUPER_ADMIN', 'OPS_MANAGER', 'TEAM_MANAGER'), removeMember);

module.exports = router;
