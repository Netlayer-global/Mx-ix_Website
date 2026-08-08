import mongoose, { Document, Schema, Types } from 'mongoose';

export type LagFraming = 'none' | 'lacp' | 'static';

/**
 * VirtualInterface = a member's logical connection to one Infrastructure.
 *
 * It is the LAG container: one or more PhysicalInterfaces (the actual switch
 * ports) bundle into it, and one or more VlanInterfaces (the addressed,
 * BGP-speaking endpoints) hang off it. A member with a 2x100G LAG in Mumbai and
 * a single 10G in Delhi has two VirtualInterfaces.
 */
export interface IVirtualInterface extends Document {
  organization: Types.ObjectId;
  infrastructure: Types.ObjectId;
  /** Display name, e.g. "AS64500 Mumbai LAG". */
  name: string;
  /** Switch-side LAG id, e.g. 12 for Eth-Trunk12 / Port-Channel12. */
  channelGroup?: number;
  lagFraming: LagFraming;
  /** MTU for the bundle; falls back to Infrastructure.mtu when unset. */
  mtu?: number;
  /** Members may be billed on a different rate than the physical capacity. */
  billingSpeed?: number;
  /** True when the member reaches us through a reseller. */
  isReseller: boolean;
  reseller?: Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const virtualInterfaceSchema = new Schema<IVirtualInterface>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    infrastructure: { type: Schema.Types.ObjectId, ref: 'Infrastructure', required: true, index: true },
    name: { type: String, default: '' },
    channelGroup: { type: Number },
    lagFraming: { type: String, enum: ['none', 'lacp', 'static'], default: 'none' },
    mtu: { type: Number },
    billingSpeed: { type: Number },
    isReseller: { type: Boolean, default: false },
    reseller: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

export const VirtualInterface = mongoose.model<IVirtualInterface>(
  'VirtualInterface',
  virtualInterfaceSchema
);
export default VirtualInterface;
