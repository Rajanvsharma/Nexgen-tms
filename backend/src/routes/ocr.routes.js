const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const { uploadAndParse, getOcrLogs, createQuoteFromOcr } = require('../controllers/ocr.controller');
const { verifyToken } = require('../middleware/auth.middleware');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, require('os').tmpdir()),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.txt', '.pdf', '.png', '.jpg', '.jpeg', '.webp'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

router.use(verifyToken);
router.get('/', getOcrLogs);
router.post('/upload', upload.single('file'), uploadAndParse);
router.post('/:id/quote', createQuoteFromOcr);

module.exports = router;
