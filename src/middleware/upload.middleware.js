import multer from 'multer';

const IMAGE_TYPES  = ['image/jpeg', 'image/png', 'image/webp'];
const DOCUMENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

function fileFilter(allowed) {
  return (req, file, cb) => {
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error(`Invalid file type. Allowed: ${allowed.join(', ')}`), false);
  };
}

export const profileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: fileFilter(IMAGE_TYPES),
}).single('file');

export const nationalIdUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilter(DOCUMENT_TYPES),
}).single('file');

export const trekUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilter(IMAGE_TYPES),
}).single('file');
