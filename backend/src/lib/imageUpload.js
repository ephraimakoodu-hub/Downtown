import multer from 'multer';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { HttpError } from '../utils/httpError.js';

// Accepts only a small set of real image types by declared mimetype; verifyImageSignature.js (kept
// separate so it has no dependency on multer) then checks the actual file bytes match. Files are
// stored under a fixed directory with server generated names, never the client's original filename,
// so there is no path traversal or script-execution risk from the upload.
const ALLOWED_MIMETYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;

export const uploadDir = path.join(process.cwd(), 'uploads', 'products');

export const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype] || '';
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIMETYPES.has(file.mimetype)) return cb(new HttpError(415, 'BAD_FILE_TYPE', 'Upload a JPEG, PNG or WebP image.'));
    cb(null, true);
  },
});

export { verifyImageSignature } from './imageSignature.js';
