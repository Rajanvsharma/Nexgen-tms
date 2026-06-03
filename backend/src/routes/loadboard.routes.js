const router = require('express').Router();
const { postLoad, removePosting, getPostings } = require('../controllers/loadboard.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.use(verifyToken);
router.get('/:id/postings', getPostings);
router.post('/:id/post', postLoad);
router.delete('/:id/posting', removePosting);

module.exports = router;
