import { Request, Response } from 'express';
import { SitePromo, getSitePromo } from '../models/sitePromo.model';
import { logAudit } from '../services/audit.service';

/** Image types accepted for the popup upload. SVG is excluded on purpose. */
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
// Designed announcement artwork is often a few MB. Kept well inside both the
// 16 MB document ceiling and the 10 MB JSON body limit (base64 adds ~33%).
const MAX_IMAGE_BYTES = 5_000_000; // 5 MB decoded

/** Fields that, when changed, should re-show the announcement to visitors. */
const contentFingerprint = (doc: any): string =>
  JSON.stringify([
    doc.banner?.enabled,
    doc.banner?.message,
    doc.banner?.linkLabel,
    doc.banner?.linkUrl,
    doc.banner?.tone,
    doc.popup?.enabled,
    doc.popup?.eyebrow,
    doc.popup?.title,
    doc.popup?.body,
    doc.popup?.ctaLabel,
    doc.popup?.ctaUrl,
    doc.popup?.secondaryLabel,
    doc.popup?.secondaryUrl,
    doc.popup?.imageUrl,
    doc.popup?.imageFit,
    doc.popup?.image?.updatedAt,
  ]);

/** Shape returned to clients — never includes the raw image buffer. */
const toPublic = (doc: any) => {
  const hasUpload = !!doc.popup?.image?.contentType;
  return {
    banner: {
      enabled: !!doc.banner?.enabled,
      message: doc.banner?.message || '',
      linkLabel: doc.banner?.linkLabel || '',
      linkUrl: doc.banner?.linkUrl || '',
      tone: doc.banner?.tone || 'red',
      dismissible: doc.banner?.dismissible !== false,
    },
    popup: {
      enabled: !!doc.popup?.enabled,
      eyebrow: doc.popup?.eyebrow || '',
      title: doc.popup?.title || '',
      body: doc.popup?.body || '',
      ctaLabel: doc.popup?.ctaLabel || '',
      ctaUrl: doc.popup?.ctaUrl || '',
      secondaryLabel: doc.popup?.secondaryLabel || '',
      secondaryUrl: doc.popup?.secondaryUrl || '',
      // An upload takes precedence over an external URL.
      imageUrl: hasUpload ? `/api/site-promo/image?v=${doc.revision}` : doc.popup?.imageUrl || '',
      imageFit: doc.popup?.imageFit === 'cover' ? 'cover' : 'contain',
      hasUpload,
    },
    revision: doc.revision || 1,
    updatedAt: doc.updatedAt,
  };
};

/**
 * GET /api/site-promo — public. Cheap and cacheable; called on every page load.
 */
export const getPublicPromo = async (_req: Request, res: Response): Promise<void> => {
  try {
    const doc = await getSitePromo();
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ success: true, data: toPublic(doc) });
  } catch (error) {
    console.error('Site promo read error:', error);
    // Never break the site over an announcement: report it as "nothing to show".
    res.json({
      success: true,
      data: {
        banner: { enabled: false, message: '', linkLabel: '', linkUrl: '', tone: 'red', dismissible: true },
        popup: {
          enabled: false,
          eyebrow: '',
          title: '',
          body: '',
          ctaLabel: '',
          ctaUrl: '',
          secondaryLabel: '',
          secondaryUrl: '',
          imageUrl: '',
          imageFit: 'contain',
          hasUpload: false,
        },
        revision: 1,
      },
    });
  }
};

/**
 * GET /api/site-promo/image — public. Streams the uploaded popup image.
 */
export const getPromoImage = async (_req: Request, res: Response): Promise<void> => {
  try {
    const doc = await SitePromo.findOne().select('+popup.image.data');
    const image = (doc as any)?.popup?.image;
    if (!image?.data || !image?.contentType) {
      res.status(404).json({ success: false, error: 'No image uploaded.' });
      return;
    }
    res.set('Content-Type', image.contentType);
    // Immutable per revision: the URL carries ?v=<revision>.
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(image.data);
  } catch (error) {
    console.error('Site promo image error:', error);
    res.status(500).json({ success: false, error: 'Failed to load image.' });
  }
};

/**
 * GET /api/site-promo/admin — admin view (same payload, no caching).
 */
export const getAdminPromo = async (_req: Request, res: Response): Promise<void> => {
  try {
    const doc = await getSitePromo();
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: toPublic(doc) });
  } catch (error) {
    console.error('Site promo admin read error:', error);
    res.status(500).json({ success: false, error: 'Failed to load announcement.' });
  }
};

/**
 * PUT /api/site-promo — admin. Accepts a partial update.
 *
 * Image handling:
 *  - `imageBase64` (data URL or bare base64) + `imageContentType` stores an upload
 *  - `removeImage: true` clears the stored upload
 *  - `bumpRevision: true` re-shows the announcement to visitors who dismissed it
 */
export const updatePromo = async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await getSitePromo();
    const before = toPublic(doc);
    const { banner, popup, imageBase64, imageContentType, removeImage, bumpRevision } = req.body || {};

    if (banner && typeof banner === 'object') {
      if (banner.enabled !== undefined) doc.banner.enabled = !!banner.enabled;
      if (banner.message !== undefined) doc.banner.message = String(banner.message).slice(0, 300);
      if (banner.linkLabel !== undefined) doc.banner.linkLabel = String(banner.linkLabel).slice(0, 60);
      if (banner.linkUrl !== undefined) doc.banner.linkUrl = String(banner.linkUrl).slice(0, 500);
      if (banner.tone !== undefined) doc.banner.tone = banner.tone === 'ink' ? 'ink' : 'red';
      if (banner.dismissible !== undefined) doc.banner.dismissible = !!banner.dismissible;
    }

    if (popup && typeof popup === 'object') {
      if (popup.enabled !== undefined) doc.popup.enabled = !!popup.enabled;
      if (popup.eyebrow !== undefined) doc.popup.eyebrow = String(popup.eyebrow).slice(0, 60);
      if (popup.title !== undefined) doc.popup.title = String(popup.title).slice(0, 160);
      if (popup.body !== undefined) doc.popup.body = String(popup.body).slice(0, 1200);
      if (popup.ctaLabel !== undefined) doc.popup.ctaLabel = String(popup.ctaLabel).slice(0, 60);
      if (popup.ctaUrl !== undefined) doc.popup.ctaUrl = String(popup.ctaUrl).slice(0, 500);
      if (popup.secondaryLabel !== undefined) doc.popup.secondaryLabel = String(popup.secondaryLabel).slice(0, 60);
      if (popup.secondaryUrl !== undefined) doc.popup.secondaryUrl = String(popup.secondaryUrl).slice(0, 500);
      if (popup.imageUrl !== undefined) doc.popup.imageUrl = String(popup.imageUrl).slice(0, 500);
      if (popup.imageFit !== undefined) doc.popup.imageFit = popup.imageFit === 'cover' ? 'cover' : 'contain';
    }

    if (removeImage) {
      doc.set('popup.image', { data: undefined, contentType: '', updatedAt: undefined });
    } else if (imageBase64) {
      const raw = String(imageBase64);
      const dataUrl = raw.match(/^data:([^;,]+);base64,(.*)$/);
      const declaredType = String(dataUrl?.[1] || imageContentType || '').toLowerCase();
      const payload = dataUrl?.[2] ?? raw;

      if (!ALLOWED_IMAGE_TYPES.includes(declaredType)) {
        res.status(400).json({
          success: false,
          error: `Unsupported image type. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}.`,
        });
        return;
      }

      let buffer: Buffer;
      try {
        buffer = Buffer.from(payload, 'base64');
      } catch {
        res.status(400).json({ success: false, error: 'Image data could not be decoded.' });
        return;
      }
      if (!buffer.length) {
        res.status(400).json({ success: false, error: 'Image data is empty.' });
        return;
      }
      if (buffer.length > MAX_IMAGE_BYTES) {
        res.status(400).json({
          success: false,
          error: `Image is too large (${(buffer.length / 1_000_000).toFixed(2)} MB). Maximum is ${
            MAX_IMAGE_BYTES / 1_000_000
          } MB.`,
        });
        return;
      }

      doc.set('popup.image', { data: buffer, contentType: declaredType, updatedAt: new Date() });
    }

    // Re-show to returning visitors when the content changed or on request.
    const changed = contentFingerprint(doc) !== contentFingerprint({ ...before, popup: { ...before.popup } });
    if (bumpRevision || changed || removeImage || imageBase64) {
      doc.revision = (doc.revision || 1) + 1;
    }
    doc.updatedBy = req.user?.email || '';

    await doc.save();
    const after = toPublic(doc);

    await logAudit({
      actor: req.user?.email,
      action: 'sitePromo.update',
      resource: 'SitePromo',
      resourceId: String(doc._id),
      before,
      after,
    });

    res.json({ success: true, data: after });
  } catch (error: any) {
    console.error('Site promo update error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to save announcement.' });
  }
};

export default { getPublicPromo, getPromoImage, getAdminPromo, updatePromo };
