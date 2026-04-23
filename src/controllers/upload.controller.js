import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { ApiError } from '../utils/apiError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR  = path.resolve(__dirname, '../../public/uploads');
const PRIVATE_DIR = path.resolve(__dirname, '../../private/uploads');

function uniqueName(originalname) {
  const ext = path.extname(originalname).toLowerCase() || '.jpg';
  return `${crypto.randomUUID()}${ext}`;
}

function baseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

export async function uploadProfilePhoto(req, res, next) {
  try {
    if (!req.file) throw new ApiError(400, 'No file provided');
    const filename = uniqueName(req.file.originalname);
    const dest     = path.join(PUBLIC_DIR, 'profiles', filename);
    await fs.writeFile(dest, req.file.buffer);
    const url = `${baseUrl(req)}/uploads/profiles/${filename}`;
    res.json({ url, publicId: `profiles/${filename}` });
  } catch (err) {
    next(err);
  }
}

export async function uploadNationalId(req, res, next) {
  try {
    if (!req.file) throw new ApiError(400, 'No file provided');
    const filename = uniqueName(req.file.originalname);
    const dest     = path.join(PRIVATE_DIR, 'national-ids', filename);
    await fs.writeFile(dest, req.file.buffer);
    // Return only publicId — URL is never exposed publicly
    res.json({ publicId: `national-ids/${filename}` });
  } catch (err) {
    next(err);
  }
}

export async function uploadTrekPhoto(req, res, next) {
  try {
    if (!req.file) throw new ApiError(400, 'No file provided');
    const filename = uniqueName(req.file.originalname);
    const dest     = path.join(PUBLIC_DIR, 'treks', filename);
    await fs.writeFile(dest, req.file.buffer);
    const url = `${baseUrl(req)}/uploads/treks/${filename}`;
    res.json({ url, publicId: `treks/${filename}` });
  } catch (err) {
    next(err);
  }
}
