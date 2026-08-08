import mongoose, { Document, Schema, Types } from 'mongoose';

export type OrgType = 'ISP' | 'Content' | 'Cloud' | 'CDN' | 'Enterprise' | 'Academic' | 'Other';
export type OrgPeeringPolicy = 'Open' | 'Selective' | 'Restrictive';
export type OrgStatus = 'pending' | 'active' | 'suspended';

/**
 * Organization = a customer account (the network/company that connects to MX-IX).
 * Distinct from the public `Member` directory used for marketing.
 * One Organization has many PortalUsers (logins) and many Ports.
 */
export interface IOrganization extends Document {
  name: string;
  legalName?: string;
  asn?: number;
  additionalAsns: number[];
  website?: string;
  type: OrgType;
  peeringPolicy: OrgPeeringPolicy;
  peeringPolicyUrl?: string;
  peeringNotes?: string;
  status: OrgStatus;
  locations: string[];
  nocEmail?: string;
  nocPhone?: string;
  /** Tags for filtering and categorization. */
  tags: Types.ObjectId[];
  // ── PeeringDB linkage ──
  /** PeeringDB `net` object id. Set once, then used for every refresh. */
  peeringdbNetId?: number;
  /** PeeringDB `org` object id. */
  peeringdbOrgId?: number;
  /**
   * Registered IRR as-set / as-macro (PeeringDB `irr_as_set`), e.g.
   * "AS-EXAMPLE" or "RIPE::AS-EXAMPLE". Feeds the route-server prefix filters.
   */
  irrAsSet?: string;
  /** PeeringDB info_prefixes4/6 — the member's own max-prefix expectation. */
  infoPrefixes4?: number;
  infoPrefixes6?: number;
  /** PeeringDB info_traffic / info_ratio / info_scope, kept for the profile. */
  infoTraffic?: string;
  infoRatio?: string;
  infoScope?: string;
  /** True when the member asks not to be a route-server client (PeeringDB flag). */
  neverViaRouteServers?: boolean;
  peeringdbSyncedAt?: Date | null;

  // Integration links (used in later phases)
  ixpManagerId?: string;
  zohoContactId?: string;
  zohoProfileKey?: string;
  notes?: string;
  approvedAt?: Date | null;
  approvedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    legalName: { type: String, default: '' },
    asn: { type: Number },
    additionalAsns: { type: [Number], default: [] },
    website: { type: String, default: '' },
    type: {
      type: String,
      enum: ['ISP', 'Content', 'Cloud', 'CDN', 'Enterprise', 'Academic', 'Other'],
      default: 'ISP',
    },
    peeringPolicy: {
      type: String,
      enum: ['Open', 'Selective', 'Restrictive'],
      default: 'Open',
    },
    peeringPolicyUrl: { type: String, default: '' },
    peeringNotes: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended'],
      default: 'pending',
    },
    locations: { type: [String], default: [] },
    nocEmail: { type: String, default: '' },
    nocPhone: { type: String, default: '' },
    peeringdbNetId: { type: Number, index: true, sparse: true },
    peeringdbOrgId: { type: Number },
    irrAsSet: { type: String, default: '' },
    infoPrefixes4: { type: Number },
    infoPrefixes6: { type: Number },
    infoTraffic: { type: String, default: '' },
    infoRatio: { type: String, default: '' },
    infoScope: { type: String, default: '' },
    neverViaRouteServers: { type: Boolean, default: false },
    peeringdbSyncedAt: { type: Date, default: null },
    tags: { type: [Schema.Types.ObjectId], ref: 'CustomerTag', default: [] },
    ixpManagerId: { type: String, default: '' },
    zohoContactId: { type: String, default: '' },
    zohoProfileKey: { type: String, default: '' },
    notes: { type: String, default: '' },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: String, default: null },
  },
  { timestamps: true }
);

/** All ASNs associated with the org (primary + additional), de-duped. */
organizationSchema.methods.allAsns = function (this: IOrganization): number[] {
  const set = new Set<number>();
  if (this.asn) set.add(this.asn);
  (this.additionalAsns || []).forEach((a) => a && set.add(a));
  return Array.from(set);
};

export const Organization = mongoose.model<IOrganization>('Organization', organizationSchema);
export default Organization;
