import mongoose, { Document, Schema } from 'mongoose';

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
  // Integration links (used in later phases)
  ixpManagerId?: string;
  zohoContactId?: string;
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
    ixpManagerId: { type: String, default: '' },
    zohoContactId: { type: String, default: '' },
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
