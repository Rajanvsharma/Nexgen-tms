const router = require('express').Router();
const { getAnnouncements, createAnnouncement, markRead, deactivateAnnouncement } = require('../controllers/announcement.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

router.use(verifyToken);

router.get('/', getAnnouncements);
router.post('/', requireRole('ADMIN', 'ACCOUNTING', 'COMPLIANCE'), createAnnouncement);
router.patch('/:id/read', markRead);
router.delete('/:id', requireRole('ADMIN'), deactivateAnnouncement);

module.exports = router;
