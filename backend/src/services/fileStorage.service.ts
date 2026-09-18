import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { Request } from 'express';

/**
 * Local-disk file storage for uploads.
 *
 * Files land under `UPLOAD_DIR` (default `<cwd>/uploads`) in a per-scope
 * subfolder, stored under a generated name. The original filename is kept as
 * metadata only, so a hostile name can never influence the path on disk.
 *
 * `storagePath` values written to the database are always *relative* to the
 * upload root. Resolving them back goes through `resolveStoredPath`, which
 * rejects anything that escapes the root.
 */

export const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));

/** 25 MB — comfortable for LOAs, contracts and diagrams. */
export const MAX_UPLOAD_BYTES = Number(process.env.UPLOAD_MAX_BYTES || 25 * 1024 * 1024);

/**
 * Allowed content types. Deliberately conservative: documents and images only.
 * Anything executable or script-like is rejected, since these files are served
 * back to members.
 */
export const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'application/zip',
]);

const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'application/zip': '.zip',
};

/** Strip anything that could act as a path or shell token from a filename. */
export const sanitizeFilename = (name: string): string => {
  const base = path.basename(String(name || 'file'));
  const cleaned = base.replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, ' ').trim();
  return (cleaned || 'file').slice(0, 180);
};

/** Ensure a directory exists. */
const ensureDir = (dir: string): void => {
  fs.mkdirSync(dir, { recursive: true });
};

/**
 * Build a multer instance that writes into `<UPLOAD_ROOT>/<scope>/<subdir>`.
 * `subdir` is derived from a route param so files stay grouped per customer or
 * per ticket; it is validated to be a plain id.
 */
export const makeUploader = (scope: string, subdirParam: string) => {
  const storage = multer.diskStorage({
    destination: (req: Request, _file, cb) => {
      const raw = String((req.params as any)?.[subdirParam] || 'misc');
      // Route ids are Mongo ObjectIds; reject anything else outright.
      const subdir = /^[a-zA-Z0-9_-]{1,64}$/.test(raw) ? raw : 'misc';
      const dir = path.join(UPLOAD_ROOT, scope, subdir);
      try {
        ensureDir(dir);
        cb(null, dir);
      } catch (err) {
        cb(err as Error, dir);
      }
    },
    filename: (_req, file, cb) => {
      const original = sanitizeFilename(file.originalname);
      const ext = path.extname(original) || EXT_BY_MIME[file.mimetype] || '';
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_MIME.has(file.mimetype)) {
        cb(new Error(`File type "${file.mimetype}" is not allowed.`));
        return;
      }
      cb(null, true);
    },
  });
};

/** Convert an absolute upload path into the relative value stored in the DB. */
export const toStoragePath = (absolutePath: string): string =>
  path.relative(UPLOAD_ROOT, absolutePath).split(path.sep).join('/');

/**
 * Resolve a stored path back to an absolute path inside the upload root.
 * Returns null for remote keys (http/s3) and for anything that escapes the root.
 */
export const resolveStoredPath = (storagePath: string): string | null => {
  if (!storagePath) return null;
  if (/^(https?|s3):\/\//i.test(storagePath)) return null;

  const full = path.resolve(UPLOAD_ROOT, storagePath.replace(/^[/\\]+/, ''));
  if (full !== UPLOAD_ROOT && !full.startsWith(UPLOAD_ROOT + path.sep)) return null;
  return full;
};

/** True when the stored file actually exists on disk. */
export const storedFileExists = (storagePath: string): boolean => {
  const full = resolveStoredPath(storagePath);
  if (!full) return false;
  try {
    return fs.statSync(full).isFile();
  } catch {
    return false;
  }
};

/** Best-effort delete of a stored file. Never throws. */
export const removeStoredFile = (storagePath: string): void => {
  const full = resolveStoredPath(storagePath);
  if (!full) return;
  try {
    fs.unlinkSync(full);
  } catch {
    /* already gone, or never written */
  }
};

/** A safe `Content-Disposition` value for a download. */
export const contentDisposition = (filename: string, inline = false): string => {
  const safe = sanitizeFilename(filename).replace(/"/g, '');
  const encoded = encodeURIComponent(safe);
  return `${inline ? 'inline' : 'attachment'}; filename="${safe}"; filename*=UTF-8''${encoded}`;
};

export default {
  UPLOAD_ROOT,
  MAX_UPLOAD_BYTES,
  ALLOWED_MIME,
  makeUploader,
  toStoragePath,
  resolveStoredPath,
  storedFileExists,
  removeStoredFile,
  sanitizeFilename,
  contentDisposition,
};
