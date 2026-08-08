import mongoose, { Document, Schema } from 'mongoose';

/**
 * A tag that can be applied to customer organizations for filtering.
 *
 * Tags are global (not per-org) — the same tag can be applied to many members.
 * The relationship is stored as an array of tag IDs on Organization (lightweight
 * many-to-many without a junction collection).
 */
export interface ICustomerTag extends Document {
  name: string;
  /** Colour used in the UI badge (hex or a Tailwind colour name). */
  colour: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const customerTagSchema = new Schema<ICustomerTag>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    colour: { type: String, default: '#6b7280' },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

export const CustomerTag = mongoose.model<ICustomerTag>('CustomerTag', customerTagSchema);
export default CustomerTag;
