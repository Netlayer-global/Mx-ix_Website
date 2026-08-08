import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * A VLAN on an Infrastructure. The peering LAN is a VLAN; quarantine and
 * private VLANs are the same entity with different flags.
 *
 * The IPv4/IPv6 prefixes here are the source for the IpAddress pool
 * (see services/ipam.service.ts) — members never get hand-typed addresses.
 */
export interface IVlan extends Document {
  infrastructure: Types.ObjectId;
  name: string;             // e.g. "Peering LAN"
  /** 802.1Q tag. */
  number: number;
  /** Used in generated config identifiers. */
  shortname?: string;
  /** Peering LAN prefixes in CIDR form, e.g. 103.139.191.0/24 */
  ipv4Prefix?: string;
  ipv6Prefix?: string;
  ipv4Gateway?: string;
  ipv6Gateway?: string;
  /**
   * How IPv6 addresses are picked for new members.
   *  sequential  — next free address from the pool (predictable, compact)
   *  asn-encoded — the ASN's digits are embedded in the address
   *                (2001:db8:1::6:4500:1 for AS64500), falling back to
   *                sequential when the prefix can't carry it
   */
  ipv6AddressingMode: 'sequential' | 'asn-encoded';
  /** Excluded from allocation (network/broadcast/RS/anycast addresses). */
  ipv4Reserved: string[];
  ipv6Reserved: string[];
  /** Quarantine VLAN: new members land here before going live. */
  isQuarantine: boolean;
  /** Private VLAN (bilateral cross-connect), excluded from the RS + peering matrix. */
  isPrivate: boolean;
  /** Include this VLAN's members in the public peering matrix. */
  peeringMatrix: boolean;
  /** Publish in the IX-F member export. */
  ixfExport: boolean;
  /** DNS zone used to generate PTR suggestions for member addresses. */
  reverseDnsZoneV4?: string;
  reverseDnsZoneV6?: string;
  notes?: string;
  enabled: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const vlanSchema = new Schema<IVlan>(
  {
    infrastructure: { type: Schema.Types.ObjectId, ref: 'Infrastructure', required: true, index: true },
    name: { type: String, required: true, trim: true },
    number: { type: Number, required: true, min: 1, max: 4094 },
    shortname: { type: String, default: '' },
    ipv4Prefix: { type: String, default: '' },
    ipv6Prefix: { type: String, default: '' },
    ipv4Gateway: { type: String, default: '' },
    ipv6Gateway: { type: String, default: '' },
    ipv6AddressingMode: {
      type: String,
      enum: ['sequential', 'asn-encoded'],
      default: 'sequential',
    },
    ipv4Reserved: { type: [String], default: [] },
    ipv6Reserved: { type: [String], default: [] },
    isQuarantine: { type: Boolean, default: false },
    isPrivate: { type: Boolean, default: false },
    peeringMatrix: { type: Boolean, default: true },
    ixfExport: { type: Boolean, default: true },
    reverseDnsZoneV4: { type: String, default: '' },
    reverseDnsZoneV6: { type: String, default: '' },
    notes: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

vlanSchema.index({ infrastructure: 1, number: 1 }, { unique: true });

export const Vlan = mongoose.model<IVlan>('Vlan', vlanSchema);
export default Vlan;
