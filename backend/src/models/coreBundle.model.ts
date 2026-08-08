import mongoose, { Document, Schema, Types } from 'mongoose';

export type CoreBundleType = 'ecmp' | 'lacp' | 'l2-lag' | 'l3-lag';
export type CoreLinkState = 'up' | 'down' | 'maintenance' | 'planned' | 'decommissioned';

/**
 * A core bundle is a link between **our own** switches — a trunk / inter-switch
 * link (ISL). Distinct from a VirtualInterface, which is a *member's* LAG.
 *
 * Capacity here is what determines whether the fabric can absorb a member
 * upgrade, so the NOC dashboard reads utilisation off these.
 */
export interface ICoreBundle extends Document {
  infrastructure: Types.ObjectId;
  name: string;                  // e.g. "MB2 SW-01 <-> LVSB SW-01"
  type: CoreBundleType;
  /** The two switches this bundle joins. */
  switchA: Types.ObjectId;
  switchB: Types.ObjectId;
  /** Bundle/LAG interface name on each side, e.g. "Eth-Trunk1". */
  bundleNameA?: string;
  bundleNameB?: string;
  /** Whether the bundle is enabled in production. */
  enabled: boolean;
  state: CoreLinkState;
  /** Set when this is a graceful-shutdown / drain candidate. */
  drained: boolean;
  notes?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const coreBundleSchema = new Schema<ICoreBundle>(
  {
    infrastructure: { type: Schema.Types.ObjectId, ref: 'Infrastructure', required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['ecmp', 'lacp', 'l2-lag', 'l3-lag'], default: 'lacp' },
    switchA: { type: Schema.Types.ObjectId, ref: 'Switch', required: true },
    switchB: { type: Schema.Types.ObjectId, ref: 'Switch', required: true },
    bundleNameA: { type: String, default: '' },
    bundleNameB: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
    state: {
      type: String,
      enum: ['up', 'down', 'maintenance', 'planned', 'decommissioned'],
      default: 'planned',
    },
    drained: { type: Boolean, default: false },
    notes: { type: String, default: '' },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const CoreBundle = mongoose.model<ICoreBundle>('CoreBundle', coreBundleSchema);
export default CoreBundle;
