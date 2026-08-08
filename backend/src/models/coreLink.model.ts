import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * One physical member link inside a CoreBundle: switch A port <-> switch B port.
 *
 * A 4x100G trunk is one CoreBundle with four CoreLinks. Keeping the individual
 * links lets the NOC see which strand of a bundle is down and how much capacity
 * that actually costs.
 */
export interface ICoreLink extends Document {
  coreBundle: Types.ObjectId;
  switchPortA: Types.ObjectId;
  switchPortB: Types.ObjectId;
  /** Link speed in Mbit/s — the unit the rest of the fabric maths uses. */
  speed: number;
  enabled: boolean;
  /** True when this strand is the bundle's designated BFD/monitoring link. */
  bfdEnabled: boolean;
  /** Patch panel ports carrying this link, when it leaves the cabinet. */
  patchPanelPortA?: Types.ObjectId | null;
  patchPanelPortB?: Types.ObjectId | null;
  notes?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const coreLinkSchema = new Schema<ICoreLink>(
  {
    coreBundle: { type: Schema.Types.ObjectId, ref: 'CoreBundle', required: true, index: true },
    switchPortA: { type: Schema.Types.ObjectId, ref: 'SwitchPort', required: true },
    switchPortB: { type: Schema.Types.ObjectId, ref: 'SwitchPort', required: true },
    speed: { type: Number, default: 100000 },
    enabled: { type: Boolean, default: true },
    bfdEnabled: { type: Boolean, default: false },
    patchPanelPortA: { type: Schema.Types.ObjectId, ref: 'PatchPanelPort', default: null },
    patchPanelPortB: { type: Schema.Types.ObjectId, ref: 'PatchPanelPort', default: null },
    notes: { type: String, default: '' },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// A switch port can only carry one core link — and PhysicalInterface enforces
// the same for member ports, so a port can never be both.
coreLinkSchema.index({ switchPortA: 1 }, { unique: true });
coreLinkSchema.index({ switchPortB: 1 }, { unique: true });

export const CoreLink = mongoose.model<ICoreLink>('CoreLink', coreLinkSchema);
export default CoreLink;
