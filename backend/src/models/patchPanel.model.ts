import mongoose, { Document, Schema, Types } from 'mongoose';

export type PatchPanelConnector = 'LC' | 'SC' | 'MPO' | 'MTP' | 'RJ45' | 'ST' | 'Other';
export type PatchPanelMedia = 'SMF' | 'MMF-OM3' | 'MMF-OM4' | 'MMF-OM5' | 'Copper' | 'Other';

/**
 * A patch panel in one of our cabinets. Member cross-connects land here, so this
 * plus PatchPanelPort is how we answer "which fibre is this member on and what
 * is the LOA reference".
 *
 * Port counting follows the IXP Manager convention: a panel with 12 *duplex*
 * ports is created with `portCount: 24` and each port is paired with its
 * partner. That keeps the model correct for simplex/BiDi optics and xWDM, where
 * one physical port is used on its own.
 */
export interface IPatchPanel extends Document {
  facility: Types.ObjectId;
  cabinet?: Types.ObjectId | null;
  name: string;                 // e.g. "MB2-R12-PP01"
  /** Total *physical* ports. For a 12-duplex panel this is 24. */
  portCount: number;
  /** True when ports are normally allocated in pairs. */
  duplex: boolean;
  connectorType: PatchPanelConnector;
  mediaType: PatchPanelMedia;
  /** Where the far end of this panel goes, e.g. "Meet-me room A, rack 3". */
  farEndLocation?: string;
  /** Colo provider's identifier for the panel / trunk. */
  providerRef?: string;
  /** Prefix used when auto-generating port names, e.g. "P" -> P1, P2, ... */
  portNamePrefix?: string;
  notes?: string;
  active: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const patchPanelSchema = new Schema<IPatchPanel>(
  {
    facility: { type: Schema.Types.ObjectId, ref: 'Facility', required: true, index: true },
    cabinet: { type: Schema.Types.ObjectId, ref: 'Cabinet', default: null, index: true },
    name: { type: String, required: true, trim: true },
    portCount: { type: Number, default: 24, min: 1, max: 1024 },
    duplex: { type: Boolean, default: true },
    connectorType: {
      type: String,
      enum: ['LC', 'SC', 'MPO', 'MTP', 'RJ45', 'ST', 'Other'],
      default: 'LC',
    },
    mediaType: {
      type: String,
      enum: ['SMF', 'MMF-OM3', 'MMF-OM4', 'MMF-OM5', 'Copper', 'Other'],
      default: 'SMF',
    },
    farEndLocation: { type: String, default: '' },
    providerRef: { type: String, default: '' },
    portNamePrefix: { type: String, default: 'P' },
    notes: { type: String, default: '' },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

patchPanelSchema.index({ facility: 1, name: 1 }, { unique: true });

export const PatchPanel = mongoose.model<IPatchPanel>('PatchPanel', patchPanelSchema);
export default PatchPanel;
