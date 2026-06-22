const express = require('express');
const { verifyToken } = require('../middleware/auth.middleware');
const { globalSearch } = require('../controllers/search.controller');

const router = express.Router();
router.get('/', verifyToken, globalSearch);
module.exports = router;
