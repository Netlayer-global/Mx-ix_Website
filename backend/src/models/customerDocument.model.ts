import mongoose, { Document, Schema, Types } from 'mongoose';

export type DocCategory = 'loa' | 'invoice' | 'contract' | 'policy' | 'diagram' | 'other';

/**
 * A document attached to a customer account.
 *
 * File storage is pluggable: the `storagePath` field holds either a local
 * filesystem path or an S3/object-store key. The upload handler writes the file,
 * this model just tracks the metadata.
 *
 * Member-visible documents (visibility: 'shared') appear in the member portal
 * under their account section, so they can self-service their own LOAs.
 */
export interface ICustomerDocument extends Document {
  organization: Types.ObjectId;
  /** Original filename as uploaded. */
  filename: string;
  /** Where the file lives on disk or in object storage. */
  storagePath: string;
  /** MIME type for proper Content-Type on download. */
  mimeType: string;
  /** File size in bytes. */
  size: number;
  category: DocCategory;
  /** Human description, e.g. "LOA for MB2 cross-connect #3". */
  description?: string;
  visibility: 'staff' | 'shared';
  uploadedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const customerDocumentSchema = new Schema<ICustomerDocument>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    filename: { type: String, required: true },
    storagePath: { type: String, required: true },
    mimeType: { type: String, default: 'application/octet-stream' },
    size: { type: Number, default: 0 },
    category: {
      type: String,
      enum: ['loa', 'invoice', 'contract', 'policy', 'diagram', 'other'],
      default: 'other',
    },
    description: { type: String, default: '' },
    visibility: { type: String, enum: ['staff', 'shared'], default: 'staff' },
    uploadedBy: { type: String, default: '' },
  },
  { timestamps: true }
);

customerDocumentSchema.index({ organization: 1, category: 1 });

export const CustomerDocument = mongoose.model<ICustomerDocument>('CustomerDocument', customerDocumentSchema);
export default CustomerDocument;
