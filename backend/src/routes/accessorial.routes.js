const express = require('express');
const { verifyToken } = require('../middleware/auth.middleware');
const { listAccessorials, createAccessorial, updateAccessorial, deleteAccessorial } = require('../controllers/accessorial.controller');

const router = express.Router({ mergeParams: true });

router.get('/',     verifyToken, listAccessorials);
router.post('/',    verifyToken, createAccessorial);
router.patch('/:id', verifyToken, updateAccessorial);
router.delete('/:id', verifyToken, deleteAccessorial);

module.exports = router;
