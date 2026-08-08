import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * Cabinet = a rack inside a Facility.
 *
 * Rack units are **not** stored as rows. A device declares the lowest unit it
 * occupies (`rackPosition`) and how tall it is (`rackUnits`), and the elevation
 * view is derived from that in services/rack.service.ts. Storing 42 rows per
 * rack would add nothing except a second place for the truth to drift.
 */
export interface ICabinet extends Document {
  facility: Types.ObjectId;
  name: string;              // e.g. "R12" / "MB2:01:0304"
  /** Total rack units, used to validate device placement. */
  uHeight: number;
  /**
   * Unit numbering direction.
   *  bottom-up — U1 at the bottom (the common convention)
   *  top-down  — U1 at the top (some providers label this way)
   * Only affects how the elevation is rendered, not how positions are stored.
   */
  uNumbering: 'bottom-up' | 'top-down';

  /** Our cage/suite and row references at the facility. */
  cageRef?: string;
  rowRef?: string;
  /** Colo provider's own identifier for this rack, quoted on tickets. */
  providerRef?: string;

  /** Power feeds — capacity planning and remote-hands context. */
  powerFeedA?: string;
  powerFeedB?: string;
  powerBudgetWatts?: number;

  notes?: string;
  active: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const cabinetSchema = new Schema<ICabinet>(
  {
    facility: { type: Schema.Types.ObjectId, ref: 'Facility', required: true, index: true },
    name: { type: String, required: true, trim: true },
    uHeight: { type: Number, default: 42, min: 1, max: 100 },
    uNumbering: { type: String, enum: ['bottom-up', 'top-down'], default: 'bottom-up' },

    cageRef: { type: String, default: '' },
    rowRef: { type: String, default: '' },
    providerRef: { type: String, default: '' },

    powerFeedA: { type: String, default: '' },
    powerFeedB: { type: String, default: '' },
    powerBudgetWatts: { type: Number },

    notes: { type: String, default: '' },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

cabinetSchema.index({ facility: 1, name: 1 }, { unique: true });

export const Cabinet = mongoose.model<ICabinet>('Cabinet', cabinetSchema);
export default Cabinet;
