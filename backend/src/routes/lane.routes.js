const express = require('express');
const { verifyToken } = require('../middleware/auth.middleware');
const { getLaneRates } = require('../controllers/lane.controller');

const router = express.Router();
router.get('/', verifyToken, getLaneRates);
module.exports = router;
