const router = require('express').Router();
const { getLoads, getLoad, createLoad, updateLoad, deleteLoad, dispatchLoad, checkDuplicate } = require('../controllers/load.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.use(verifyToken);
router.get('/check-duplicate', checkDuplicate);
router.get('/', getLoads);
router.get('/:id', getLoad);
router.post('/', createLoad);
router.put('/:id', updateLoad);
router.delete('/:id', deleteLoad);
router.post('/:id/dispatch', dispatchLoad);

module.exports = router;
