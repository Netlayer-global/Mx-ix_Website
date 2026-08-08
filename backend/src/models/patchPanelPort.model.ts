import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * Lifecycle of a patch panel port. Mirrors how a cross-connect actually
 * progresses so the NOC can see what is waiting on whom.
 */
export type PatchPanelPortState =
  | 'available'          // free to allocate
  | 'reserved'           // held for a member, no LOA issued yet
  | 'awaiting-loa'       // allocated, LOA not sent
  | 'awaiting-xconnect'  // LOA sent, waiting on the colo/member to patch
  | 'connected'          // live
  | 'awaiting-cease'     // member leaving, cease ordered
  | 'ceased'             // cross-connect removed, port not yet reclaimed
  | 'broken'
  | 'decommissioned';

/**
 * One physical port on a patch panel, and the cross-connect that runs through
 * it.
 *
 * This is the record that ties the member's side (Organization) to our side
 * (SwitchPort), and carries the paperwork — LOA reference, colo order number,
 * and the dates the NOC gets asked about.
 */
export interface IPatchPanelPort extends Document {
  patchPanel: Types.ObjectId;
  /** 1-based physical port number on the panel. */
  number: number;
  /** Display name, e.g. "P12". Generated from the panel prefix when blank. */
  name: string;

  state: PatchPanelPortState;

  /** The member this cross-connect belongs to. */
  organization?: Types.ObjectId | null;
  /** Our switch port at the near end, once patched. */
  switchPort?: Types.ObjectId | null;

  /**
   * The other half of a duplex pair (Tx/Rx). Set on both rows so either can be
   * read on its own. Left null for simplex / BiDi / xWDM allocations.
   */
  duplexPartner?: Types.ObjectId | null;

  // ── Cross-connect paperwork ──
  /** Our LOA identifier, quoted to the member and the colo. */
  loaCode?: string;
  loaIssuedAt?: Date | null;
  /** The colo provider's cross-connect / order reference. */
  xconnectRef?: string;
  /** Member's own reference, so their tickets can be matched up. */
  customerRef?: string;

  /** Key dates the NOC reports on. */
  assignedAt?: Date | null;
  connectedAt?: Date | null;
  ceaseRequestedAt?: Date | null;
  ceasedAt?: Date | null;

  /** Optical budget / test results recorded at handover. */
  opticalLossDb?: number;
  notes?: string;
  /** Notes safe to show the member (the rest are internal). */
  memberVisibleNotes?: string;

  createdAt: Date;
  updatedAt: Date;
}

const patchPanelPortSchema = new Schema<IPatchPanelPort>(
  {
    patchPanel: { type: Schema.Types.ObjectId, ref: 'PatchPanel', required: true, index: true },
    number: { type: Number, required: true, min: 1 },
    name: { type: String, default: '' },

    state: {
      type: String,
      enum: [
        'available',
        'reserved',
        'awaiting-loa',
        'awaiting-xconnect',
        'connected',
        'awaiting-cease',
        'ceased',
        'broken',
        'decommissioned',
      ],
      default: 'available',
      index: true,
    },

    organization: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    switchPort: { type: Schema.Types.ObjectId, ref: 'SwitchPort', default: null },
    duplexPartner: { type: Schema.Types.ObjectId, ref: 'PatchPanelPort', default: null },

    loaCode: { type: String, default: '' },
    loaIssuedAt: { type: Date, default: null },
    xconnectRef: { type: String, default: '' },
    customerRef: { type: String, default: '' },

    assignedAt: { type: Date, default: null },
    connectedAt: { type: Date, default: null },
    ceaseRequestedAt: { type: Date, default: null },
    ceasedAt: { type: Date, default: null },

    opticalLossDb: { type: Number },
    notes: { type: String, default: '' },
    memberVisibleNotes: { type: String, default: '' },
  },
  { timestamps: true }
);

// A port number exists once per panel.
patchPanelPortSchema.index({ patchPanel: 1, number: 1 }, { unique: true });
// One switch port can only be fed by one patch panel port.
patchPanelPortSchema.index({ switchPort: 1 }, { unique: true, sparse: true });
// LOA codes are quoted externally, so they must be unambiguous.
patchPanelPortSchema.index({ loaCode: 1 }, { unique: true, sparse: true });

export const PatchPanelPort = mongoose.model<IPatchPanelPort>('PatchPanelPort', patchPanelPortSchema);
export default PatchPanelPort;
