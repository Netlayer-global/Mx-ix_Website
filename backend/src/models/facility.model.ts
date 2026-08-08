import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * Facility = a data centre / colocation site where we have presence.
 *
 * Top of the physical hierarchy:
 *
 *   Facility (data centre)
 *     └── Cabinet (rack)
 *           └── Switch/Device (occupies rack units)
 *                 └── SwitchPort
 *
 * A Facility is where cross-connects terminate, so it carries the remote-hands
 * and LOA contact details the provisioning workflow needs. One Infrastructure
 * (metro fabric) usually spans several Facilities.
 */
export interface IFacility extends Document {
  name: string;               // e.g. "Equinix Mumbai MB2"
  shortname: string;          // slug used in config comments and LOA refs
  /** Primary fabric served here. Devices carry the authoritative link. */
  infrastructure?: Types.ObjectId | null;
  /** Colo provider / operator, e.g. "Equinix". */
  provider?: string;

  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;

  /** PeeringDB `fac` object id, so we can match member presence automatically. */
  peeringdbFacId?: number;
  /** Telco identifiers used on LOAs. */
  clli?: string;
  npanxx?: string;

  /** Where cross-connect / remote-hands requests go. */
  supportEmail?: string;
  supportPhone?: string;
  ticketUrl?: string;
  /** Our own cage/suite reference at this site. */
  cageRef?: string;

  notes?: string;
  active: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const facilitySchema = new Schema<IFacility>(
  {
    name: { type: String, required: true, trim: true },
    shortname: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      match: [/^[a-z0-9_-]+$/, 'shortname may only contain a-z, 0-9, - and _'],
    },
    infrastructure: { type: Schema.Types.ObjectId, ref: 'Infrastructure', default: null, index: true },
    provider: { type: String, default: '' },

    address1: { type: String, default: '' },
    address2: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    postcode: { type: String, default: '' },
    country: { type: String, default: '' },
    latitude: { type: Number },
    longitude: { type: Number },

    peeringdbFacId: { type: Number, index: true, sparse: true },
    clli: { type: String, default: '' },
    npanxx: { type: String, default: '' },

    supportEmail: { type: String, default: '' },
    supportPhone: { type: String, default: '' },
    ticketUrl: { type: String, default: '' },
    cageRef: { type: String, default: '' },

    notes: { type: String, default: '' },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Facility = mongoose.model<IFacility>('Facility', facilitySchema);
export default Facility;
