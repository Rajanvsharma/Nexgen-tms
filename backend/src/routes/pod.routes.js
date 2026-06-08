const express  = require('express');
const multer   = require('multer');
const { verifyToken } = require('../middleware/auth.middleware');
const { listPODs, uploadPOD, deletePOD } = require('../controllers/pod.controller');

const router  = express.Router({ mergeParams: true });
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.get('/',           verifyToken, listPODs);
router.post('/',          verifyToken, upload.single('file'), uploadPOD);
router.delete('/:podId',  verifyToken, deletePOD);

module.exports = router;
