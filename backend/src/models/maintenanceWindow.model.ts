import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * A planned maintenance window. Different from incidents (which are unplanned):
 * maintenance is scheduled in advance, members are notified, and the window
 * has explicit start/end times.
 */

export type MaintenanceState = 'scheduled' | 'in-progress' | 'completed' | 'cancelled';

export interface IMaintenanceWindow extends Document {
  title: string;
  description: string;
  /** Which infrastructure / VLAN / devices are affected. */
  affectedComponents: string[];
  /** Org IDs of specifically-affected members; empty = all members. */
  affectedMembers: Types.ObjectId[];
  state: MaintenanceState;
  scheduledStart: Date;
  scheduledEnd: Date;
  actualStart?: Date;
  actualEnd?: Date;
  /** Whether a notification email was sent. */
  notified: boolean;
  notifiedAt?: Date;
  createdBy: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const maintenanceWindowSchema = new Schema<IMaintenanceWindow>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', trim: true, maxlength: 2000 },
    affectedComponents: { type: [String], default: [] },
    affectedMembers: { type: [Schema.Types.ObjectId], default: [], ref: 'Organization' },
    state: { type: String, enum: ['scheduled', 'in-progress', 'completed', 'cancelled'], default: 'scheduled' },
    scheduledStart: { type: Date, required: true },
    scheduledEnd: { type: Date, required: true },
    actualStart: { type: Date },
    actualEnd: { type: Date },
    notified: { type: Boolean, default: false },
    notifiedAt: { type: Date },
    createdBy: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

maintenanceWindowSchema.index({ state: 1, scheduledStart: -1 });

export const MaintenanceWindow = mongoose.model<IMaintenanceWindow>('MaintenanceWindow', maintenanceWindowSchema);
export default MaintenanceWindow;
