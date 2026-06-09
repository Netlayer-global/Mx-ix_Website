import mongoose, { Document, Schema } from 'mongoose';

export type ComponentStatus =
  | 'operational'
  | 'degraded'
  | 'partial_outage'
  | 'major_outage'
  | 'maintenance';

export interface IStatusComponent extends Document {
  name: string;
  group: string;
  status: ComponentStatus;
  description?: string;
  uptime?: number; // optional 0-100
  order: number;
  isActive: boolean;
  history: { date: string; status: ComponentStatus }[];
  createdAt: Date;
  updatedAt: Date;
}

const statusComponentSchema = new Schema<IStatusComponent>(
  {
    name: { type: String, required: true },
    group: { type: String, default: 'Core Services' },
    status: {
      type: String,
      enum: ['operational', 'degraded', 'partial_outage', 'major_outage', 'maintenance'],
      default: 'operational',
    },
    description: { type: String, default: '' },
    uptime: { type: Number, default: 100 },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    // Daily snapshot history: one entry per day with the worst status observed
    history: {
      type: [
        {
          date: { type: String, required: true }, // YYYY-MM-DD
          status: { type: String, required: true },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export const StatusComponent = mongoose.model<IStatusComponent>('StatusComponent', statusComponentSchema);
export default StatusComponent;
