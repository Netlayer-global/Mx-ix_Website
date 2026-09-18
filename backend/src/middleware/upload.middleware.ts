import { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';
import { MAX_UPLOAD_BYTES } from '../services/fileStorage.service';

const mb = (bytes: number) => Math.round((bytes / (1024 * 1024)) * 10) / 10;

/**
 * Turns multer failures into the same JSON envelope the rest of the API uses.
 *
 * Placed directly after the upload middleware in a route's handler chain, so a
 * rejected file (too large, wrong type) returns a clear 400 instead of falling
 * through to the generic 500 handler.
 */
export const uploadErrorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!err) {
    next();
    return;
  }

  if (err instanceof MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `File is too large. The maximum upload size is ${mb(MAX_UPLOAD_BYTES)} MB.`
        : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
        ? 'Upload one file at a time, using the "file" field.'
        : 'Upload failed.';
    res.status(400).json({ success: false, error: message });
    return;
  }

  res.status(400).json({
    success: false,
    error: err instanceof Error ? err.message : 'Upload failed.',
  });
};

export default { uploadErrorHandler };
