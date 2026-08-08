import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * One address in a VLAN's pool. Rows are generated from Vlan.ipv4Prefix /
 * ipv6Prefix by services/ipam.service.ts, then handed out to VlanInterfaces.
 *
 * `assignedTo` being null is what makes an address available, so allocation is
 * a single atomic findOneAndUpdate on that field — no read-then-write race.
 */
export interface IIpAddress extends Document {
  vlan: Types.ObjectId;
  /** 4 or 6. */
  family: 4 | 6;
  /** Address without the prefix length, e.g. "103.139.191.42". */
  address: string;
  /** Zero-padded / expanded form used for correct lexical sorting. */
  sortKey: string;
  /** The VlanInterface holding this address, or null when free. */
  assignedTo: Types.ObjectId | null;
  /** Blocks allocation without assigning it (gateway, RS, anycast, DNS). */
  reserved: boolean;
  /** Why it is reserved / who it belongs to. */
  label?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ipAddressSchema = new Schema<IIpAddress>(
  {
    vlan: { type: Schema.Types.ObjectId, ref: 'Vlan', required: true, index: true },
    family: { type: Number, enum: [4, 6], required: true },
    address: { type: String, required: true, trim: true },
    sortKey: { type: String, default: '' },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'VlanInterface', default: null },
    reserved: { type: Boolean, default: false },
    label: { type: String, default: '' },
  },
  { timestamps: true }
);

// The same address can never exist twice in one VLAN. This is the hard
// backstop against duplicate IPs reaching the route servers.
ipAddressSchema.index({ vlan: 1, address: 1 }, { unique: true });
// Drives "give me the next free address" queries.
ipAddressSchema.index({ vlan: 1, family: 1, assignedTo: 1, reserved: 1, sortKey: 1 });

export const IpAddress = mongoose.model<IIpAddress>('IpAddress', ipAddressSchema);
export default IpAddress;
