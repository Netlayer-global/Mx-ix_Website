import mongoose, { Document, Schema } from 'mongoose';

/**
 * Infrastructure = one switching fabric / IX instance, normally one per city
 * or metro (e.g. "Mumbai", "Delhi"). This is the top of the peering hierarchy:
 *
 *   Infrastructure
 *     ├── Switch ──> SwitchPort
 *     ├── Vlan ──> IpAddress (pool)
 *     └── RouteServer (typically 2 per infrastructure)
 *
 * A member's connection hangs off it as:
 *   Organization ──> VirtualInterface ──> PhysicalInterface ──> SwitchPort
 *                                    └──> VlanInterface ──> Vlan + IpAddress
 *
 * This replaces IXP Manager's `Infrastructure` entity so the admin panel owns
 * the operational data instead of mirroring it.
 */
export interface IInfrastructure extends Document {
  name: string;              // display name, e.g. "MX-IX Mumbai"
  shortname: string;         // slug used in generated config, e.g. "mumbai"
  /** The IX's own ASN — used as the route-server local AS. */
  asn: number;
  /** Peering LAN name shown to members, e.g. "MX-IX Mumbai Peering LAN". */
  peeringLanName: string;
  /** Location slug (matches Location.id) this fabric lives in. */
  location: string;
  /** Additional location slugs when the fabric spans sites. */
  additionalLocations: string[];
  /** IX-F export identifier (only needed if you publish an IX-F member list). */
  ixfId?: number;
  /** PeeringDB `ix` object id, so we can pull netixlan participants. */
  peeringdbIxId?: number;
  /** PeeringDB `ixlan` id — netixlan records are keyed on this. */
  peeringdbIxLanId?: number;
  /** Default MTU advertised for new connections on this fabric. */
  mtu: number;
  /** Marks the primary fabric (used as the default in provisioning forms). */
  isPrimary: boolean;
  /** RFC 5398-style contact info published in generated config comments. */
  nocEmail?: string;
  nocPhone?: string;
  nocWebsite?: string;
  notes?: string;
  /** Custom port speed presets in Mbit/s available on this IX. */
  portSpeeds: number[];
  enabled: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const infrastructureSchema = new Schema<IInfrastructure>(
  {
    name: { type: String, required: true, trim: true },
    shortname: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      // Used verbatim in generated BIRD/Alice config filenames and symbol
      // names, so keep it to a safe identifier charset.
      match: [/^[a-z0-9_-]+$/, 'shortname may only contain a-z, 0-9, - and _'],
    },
    asn: { type: Number, required: true },
    peeringLanName: { type: String, default: '' },
    location: { type: String, default: '', index: true },
    additionalLocations: { type: [String], default: [] },
    ixfId: { type: Number },
    peeringdbIxId: { type: Number },
    peeringdbIxLanId: { type: Number },
    mtu: { type: Number, default: 1500 },
    isPrimary: { type: Boolean, default: false },
    nocEmail: { type: String, default: '' },
    nocPhone: { type: String, default: '' },
    nocWebsite: { type: String, default: '' },
    notes: { type: String, default: '' },
    /** Custom port speed presets in Mbit/s available on this IX (e.g. [1000, 10000, 100000, 400000]). */
    portSpeeds: { type: [Number], default: [1000, 10000, 100000, 400000] },
    enabled: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Infrastructure = mongoose.model<IInfrastructure>('Infrastructure', infrastructureSchema);
export default Infrastructure;
