import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { CustomerDocument } from '../models/customerDocument.model';

/**
 * Member-visible documents (LOAs, contracts, policies).
 *
 * Only documents an administrator has explicitly marked `visibility: 'shared'`
 * are exposed here. A document is only offered for download when its bytes
 * actually exist on disk — metadata-only records are listed but flagged
 * `available: false` so the portal can say "contact support" instead of handing
 * the member a broken link.
 */

/** Resolve a stored path safely inside the configured upload root. */
const resolveStoredPath = (storagePath: string): string | null => {
  if (!storagePath) return null;
  // Remote object-store keys are not servable from here.
  if (/^https?:\/\//i.test(storagePath) || /^s3:\/\//i.test(storagePath)) return null;

  const root = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
  const full = path.resolve(root, storagePath.replace(/^[/\\]+/, ''));
  // Block traversal outside the upload root.
  if (!full.startsWith(root + path.sep) && full !== root) return null;
  return full;
};

const fileExists = (p: string | null): boolean => {
  if (!p) return false;
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

/**
 * GET /api/portal/documents
 */
export const listDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const docs = await CustomerDocument.find({
      organization: req.organization!._id,
      visibility: 'shared',
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    res.json({
      success: true,
      data: docs.map((d) => {
        const available = fileExists(resolveStoredPath(d.storagePath));
        return {
          _id: d._id,
          id: d._id,
          name: d.filename,
          filename: d.filename,
          category: d.category,
          description: d.description || '',
          size: d.size || 0,
          mimeType: d.mimeType,
          createdAt: d.createdAt,
          available,
          downloadUrl: available ? `/api/portal/documents/${d._id}/download` : undefined,
        };
      }),
    });
  } catch (error) {
    console.error('Portal documents error:', error);
    res.status(500).json({ success: false, error: 'Failed to load documents.' });
  }
};

/**
 * GET /api/portal/documents/:id/download
 */
export const downloadDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await CustomerDocument.findOne({
      _id: req.params.id,
      organization: req.organization!._id,
      visibility: 'shared',
    });
    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found.' });
      return;
    }

    const full = resolveStoredPath(doc.storagePath);
    if (!fileExists(full)) {
      res.status(410).json({
        success: false,
        error: 'This document is on record but its file is not available for download. Please contact support.',
      });
      return;
    }

    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${doc.filename.replace(/"/g, '')}"`);
    fs.createReadStream(full!).pipe(res);
  } catch (error) {
    console.error('Portal document download error:', error);
    res.status(500).json({ success: false, error: 'Failed to download document.' });
  }
};

export default { listDocuments, downloadDocument };
