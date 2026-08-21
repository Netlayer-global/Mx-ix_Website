import mongoose, { Document, Schema } from 'mongoose';

/**
 * Site-wide promotional announcement (singleton).
 *
 * Drives two independent public surfaces:
 *  - `banner`: a slim headline bar pinned above the site navigation
 *  - `popup`:  a modal shown once per visitor per revision
 *
 * Each surface has its own `enabled` flag so an announcement can be prepared
 * in advance and switched on (or off again) at any time without losing content.
 *
 * `revision` increments whenever the visible content changes; the frontend keys
 * its "dismissed" / "already seen" memory on it, so editing an announcement
 * (or hitting "show again") re-displays it to returning visitors.
 */

export interface ISitePromoDocument extends Document {
  banner: {
    enabled: boolean;
    message: string;
    linkLabel: string;
    linkUrl: string;
    tone: 'red' | 'ink';
    dismissible: boolean;
  };
  popup: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    body: string;
    ctaLabel: string;
    ctaUrl: string;
    secondaryLabel: string;
    secondaryUrl: string;
    imageUrl: string;
    image?: {
      data?: Buffer;
      contentType?: string;
      updatedAt?: Date;
    };
  };
  revision: number;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const sitePromoSchema = new Schema<ISitePromoDocument>(
  {
    banner: {
      enabled: { type: Boolean, default: false },
      message: { type: String, default: '', trim: true, maxlength: 300 },
      linkLabel: { type: String, default: '', trim: true, maxlength: 60 },
      linkUrl: { type: String, default: '', trim: true, maxlength: 500 },
      tone: { type: String, enum: ['red', 'ink'], default: 'red' },
      dismissible: { type: Boolean, default: true },
    },
    popup: {
      enabled: { type: Boolean, default: false },
      eyebrow: { type: String, default: '', trim: true, maxlength: 60 },
      title: { type: String, default: '', trim: true, maxlength: 160 },
      body: { type: String, default: '', trim: true, maxlength: 1200 },
      ctaLabel: { type: String, default: '', trim: true, maxlength: 60 },
      ctaUrl: { type: String, default: '', trim: true, maxlength: 500 },
      secondaryLabel: { type: String, default: '', trim: true, maxlength: 60 },
      secondaryUrl: { type: String, default: '', trim: true, maxlength: 500 },
      // An externally hosted image; used when no upload is stored.
      imageUrl: { type: String, default: '', trim: true, maxlength: 500 },
      // An uploaded image, stored in the database so it survives redeploys.
      // `select: false` keeps the binary out of ordinary reads.
      image: {
        data: { type: Buffer, select: false },
        contentType: { type: String, default: '' },
        updatedAt: { type: Date },
      },
    },
    revision: { type: Number, default: 1 },
    updatedBy: { type: String, default: '' },
  },
  { timestamps: true }
);

export const SitePromo = mongoose.model<ISitePromoDocument>('SitePromo', sitePromoSchema);

/** Returns the singleton, creating it (disabled, empty) on first use. */
export const getSitePromo = async (): Promise<ISitePromoDocument> => {
  const existing = await SitePromo.findOne();
  if (existing) return existing;
  return SitePromo.create({});
};

export default SitePromo;
