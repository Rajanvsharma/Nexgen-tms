const router = require('express').Router();
const { getLoads, getLoad, createLoad, updateLoad, dispatchLoad, checkDuplicate } = require('../controllers/load.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.use(verifyToken);
router.get('/', getLoads);
router.get('/:id', getLoad);
router.post('/', createLoad);
router.put('/:id', updateLoad);
router.post('/:id/dispatch', dispatchLoad);
router.get('/check-duplicate', checkDuplicate);

module.exports = router;
