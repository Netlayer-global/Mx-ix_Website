import mongoose, { Document, Schema, Types } from 'mongoose';

export type ContactRole = 'noc' | 'peering' | 'billing' | 'admin' | 'sales' | 'legal' | 'other';

/**
 * A contact person at a member organization.
 *
 * One org can have many contacts with different roles — this is what the NOC
 * uses to know who to call at 3am when a port goes down (role: noc), who
 * handles peering requests (role: peering), and who gets the invoices (role:
 * billing).
 *
 * Contact groups are implicit: filter by role to get "all NOC contacts" or
 * "all billing contacts" for group operations (announcements, mailing lists).
 */
export interface IMemberContact extends Document {
  organization: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  role: ContactRole;
  /** Job title / position at the member, e.g. "Network Engineer". */
  position?: string;
  /** PeeringDB-sourced contacts are marked so a sync doesn't clobber manual entries. */
  source: 'manual' | 'peeringdb' | 'imported';
  /** Whether this contact receives operational notifications (maintenance, incidents). */
  receiveNotifications: boolean;
  /** Whether this contact receives billing emails. */
  receiveBilling: boolean;
  /** Whether this is the primary contact for their role. */
  isPrimary: boolean;
  /** Last time we confirmed this contact is still valid. */
  lastVerifiedAt?: Date | null;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const memberContactSchema = new Schema<IMemberContact>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: '' },
    role: {
      type: String,
      enum: ['noc', 'peering', 'billing', 'admin', 'sales', 'legal', 'other'],
      default: 'noc',
    },
    position: { type: String, default: '' },
    source: { type: String, enum: ['manual', 'peeringdb', 'imported'], default: 'manual' },
    receiveNotifications: { type: Boolean, default: true },
    receiveBilling: { type: Boolean, default: false },
    isPrimary: { type: Boolean, default: false },
    lastVerifiedAt: { type: Date, default: null },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// One email per role per org — prevents accidental duplicates.
memberContactSchema.index({ organization: 1, email: 1, role: 1 }, { unique: true });
// "All NOC contacts" for group notifications.
memberContactSchema.index({ role: 1, receiveNotifications: 1 });

export const MemberContact = mongoose.model<IMemberContact>('MemberContact', memberContactSchema);
export default MemberContact;
