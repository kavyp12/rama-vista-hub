import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// --- Configuration ---
const UPLOAD_BASE_DIR = path.join(__dirname, '../../uplodall');

if (!fs.existsSync(UPLOAD_BASE_DIR)) {
  fs.mkdirSync(UPLOAD_BASE_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    let folder = 'others';
    if (req.originalUrl.includes('/document')) {
      folder = 'document';
    } else if (req.originalUrl.includes('/image')) {
      folder = 'image';
    } else if (req.query.type) {
      folder = String(req.query.type).replace(/[^a-z0-9]/gi, '');
    }

    const uploadPath = path.join(UPLOAD_BASE_DIR, folder);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } 
});

// --- Routes ---

// 1. Generic Upload
router.post('/', authenticate, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  const folder = path.basename(path.dirname(req.file.path));
  const fileUrl = `/uploads/${folder}/${req.file.filename}`;

  return res.json({ 
    success: true, 
    url: fileUrl,
    filename: req.file.filename,
    originalName: req.file.originalname
  });
});

// 2. Document Upload
router.post('/document', authenticate, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const fileUrl = `/uploads/document/${req.file.filename}`;
  return res.json({ success: true, url: fileUrl });
});

// 3. Image Upload
router.post('/image', authenticate, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const fileUrl = `/uploads/image/${req.file.filename}`;
  return res.json({ success: true, url: fileUrl });
});

export default router;