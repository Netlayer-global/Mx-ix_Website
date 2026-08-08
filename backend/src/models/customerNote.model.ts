import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * A timestamped note on a customer account.
 *
 * Two visibility levels:
 *   - staff-only (default): internal commentary, only visible to admins
 *   - shared: the member can also see it in their portal (maintenance notes,
 *     onboarding instructions, etc.)
 */
export interface ICustomerNote extends Document {
  organization: Types.ObjectId;
  author: string;
  body: string;
  /** 'staff' = internal only, 'shared' = also visible to the member in their portal. */
  visibility: 'staff' | 'shared';
  /** Marks important notes that stick to the top of the list. */
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const customerNoteSchema = new Schema<ICustomerNote>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    author: { type: String, default: '' },
    body: { type: String, required: true },
    visibility: { type: String, enum: ['staff', 'shared'], default: 'staff' },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

customerNoteSchema.index({ organization: 1, createdAt: -1 });

export const CustomerNote = mongoose.model<ICustomerNote>('CustomerNote', customerNoteSchema);
export default CustomerNote;
