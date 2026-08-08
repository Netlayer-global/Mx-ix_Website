import mongoose, { Document, Schema, Types } from 'mongoose';
import { normalizeMac } from '../utils/mac.util';

/**
 * A layer-2 address seen on (or declared for) a member's VLAN interface.
 *
 * Two uses:
 *  - **Declared** MACs let us build port security / MAC-filter config for the
 *    switch, and let the member self-service their own list.
 *  - **Learned** MACs (scraped from the switch ARP/ND or MAC table) let the NOC
 *    spot an undeclared device or a member who quietly changed hardware.
 *
 * Addresses are stored bare and lowercase — see utils/mac.util.ts.
 */
export interface IMacAddress extends Document {
  vlanInterface: Types.ObjectId;
  /** 12 lowercase hex chars, no separators. */
  address: string;
  source: 'declared' | 'learned' | 'imported';
  /** Whether the NOC has accepted this address as legitimate. */
  approved: boolean;
  firstSeenAt?: Date | null;
  lastSeenAt?: Date | null;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const macAddressSchema = new Schema<IMacAddress>(
  {
    vlanInterface: { type: Schema.Types.ObjectId, ref: 'VlanInterface', required: true, index: true },
    address: {
      type: String,
      required: true,
      // Normalise on the way in so callers can pass any common notation and the
      // unique index below still does its job.
      set: (v: string) => {
        try {
          return normalizeMac(v);
        } catch {
          // Leave it alone and let the match validator produce the error.
          return String(v || '').trim().toLowerCase();
        }
      },
      match: [/^[0-9a-f]{12}$/, 'MAC address must be 12 hex characters'],
    },
    source: { type: String, enum: ['declared', 'learned', 'imported'], default: 'declared' },
    approved: { type: Boolean, default: false },
    firstSeenAt: { type: Date, default: null },
    lastSeenAt: { type: Date, default: null },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

macAddressSchema.index({ vlanInterface: 1, address: 1 }, { unique: true });
// "Who owns this MAC?" — asked constantly during L2 troubleshooting.
macAddressSchema.index({ address: 1 });

export const MacAddress = mongoose.model<IMacAddress>('MacAddress', macAddressSchema);
export default MacAddress;
