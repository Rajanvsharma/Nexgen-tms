const router = require('express').Router();
const { authenticate } = require('../middleware/auth.middleware');
const {
  listEndpoints, createEndpoint, updateEndpoint, deleteEndpoint, listDeliveries,
} = require('../controllers/webhook.controller');

router.use(authenticate);

router.get('/',                   listEndpoints);
router.post('/',                  createEndpoint);
router.put('/:id',                updateEndpoint);
router.delete('/:id',             deleteEndpoint);
router.get('/deliveries',         listDeliveries);

module.exports = router;
