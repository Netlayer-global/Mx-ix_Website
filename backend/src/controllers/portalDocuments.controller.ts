import { Request, Response } from 'express';
import fs from 'fs';
import { CustomerDocument } from '../models/customerDocument.model';
import { resolveStoredPath, storedFileExists, contentDisposition } from '../services/fileStorage.service';

/**
 * Member-visible documents (LOAs, contracts, policies).
 *
 * Only documents an administrator has explicitly marked `visibility: 'shared'`
 * are exposed here. A document is only offered for download when its bytes
 * actually exist on disk — legacy metadata-only records are still listed but
 * flagged `available: false`, so the portal says "on record" instead of handing
 * the member a broken link.
 */

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
        const available = storedFileExists(d.storagePath);
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
    if (!full || !storedFileExists(doc.storagePath)) {
      res.status(410).json({
        success: false,
        error: 'This document is on record but its file is not available for download. Please contact support.',
      });
      return;
    }

    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', contentDisposition(doc.filename));
    fs.createReadStream(full).pipe(res);
  } catch (error) {
    console.error('Portal document download error:', error);
    res.status(500).json({ success: false, error: 'Failed to download document.' });
  }
};

export default { listDocuments, downloadDocument };
