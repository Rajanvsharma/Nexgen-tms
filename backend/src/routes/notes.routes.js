const router = require('express').Router();
const { getNotes, createNote, deleteNote } = require('../controllers/notes.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.use(verifyToken);
router.get('/', getNotes);
router.post('/', createNote);
router.delete('/:id', deleteNote);

module.exports = router;
