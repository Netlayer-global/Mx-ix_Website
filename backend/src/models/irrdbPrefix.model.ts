import mongoose, { Document, Schema } from 'mongoose';

/**
 * Cached IRRDB (as-set) expansion for one ASN + address family.
 *
 * Expanding an as-set is slow (bgpq4 / RIR queries), and the route servers need
 * the result on every config build, so results are cached here and refreshed on
 * a schedule or on demand. `services/irrdb.service.ts` owns the refresh.
 *
 * One document per (asn, family) holding the whole prefix list keeps the BIRD
 * generator to a single query per peer instead of thousands of rows.
 */
export interface IIrrdbPrefix extends Document {
  asn: number;
  family: 4 | 6;
  /** The as-set/as-macro actually expanded, e.g. "AS-EXAMPLE" or "AS64500". */
  source: string;
  /** Prefixes with an optional max-length, BIRD-ready. */
  prefixes: Array<{ prefix: string; maxLength?: number }>;
  /** Origin ASNs found inside the as-set — used for AS-path origin filtering. */
  originAsns: number[];
  /** Where the data came from: 'bgpq4' | 'ripe-stat' | 'manual'. */
  provider: string;
  /** Populated when the last refresh failed, so we can fail open/closed knowingly. */
  lastError?: string;
  lastRefreshedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const irrdbPrefixSchema = new Schema<IIrrdbPrefix>(
  {
    asn: { type: Number, required: true },
    family: { type: Number, enum: [4, 6], required: true },
    source: { type: String, default: '' },
    prefixes: {
      type: [
        new Schema(
          {
            prefix: { type: String, required: true },
            maxLength: { type: Number },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    originAsns: { type: [Number], default: [] },
    provider: { type: String, default: 'bgpq4' },
    lastError: { type: String, default: '' },
    lastRefreshedAt: { type: Date },
  },
  { timestamps: true }
);

irrdbPrefixSchema.index({ asn: 1, family: 1 }, { unique: true });

export const IrrdbPrefix = mongoose.model<IIrrdbPrefix>('IrrdbPrefix', irrdbPrefixSchema);
export default IrrdbPrefix;
