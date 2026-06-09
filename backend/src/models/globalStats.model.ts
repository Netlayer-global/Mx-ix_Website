import mongoose, { Document, Schema } from 'mongoose';

export interface StatValueDoc {
  value: number;
  unit: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
}

export interface GlobalStatsDoc extends Document {
  totalCapacity: StatValueDoc;
  peakTraffic: StatValueDoc;
  connectedNetworks: StatValueDoc;
  ipv4Prefixes: StatValueDoc;
  updatedAt: Date;
  createdAt: Date;
}

const statValueSchema = new Schema<StatValueDoc>(
  {
    value: { type: Number, required: true },
    unit: { type: String, required: true },
    trend: {
      type: String,
      enum: ['up', 'down', 'stable'],
      required: false,
    },
    trendValue: { type: String, required: false },
  },
  { _id: false }
);

const globalStatsSchema = new Schema<GlobalStatsDoc>(
  {
    totalCapacity: {
      type: statValueSchema,
      required: true,
    },
    peakTraffic: {
      type: statValueSchema,
      required: true,
    },
    connectedNetworks: {
      type: statValueSchema,
      required: true,
    },
    ipv4Prefixes: {
      type: statValueSchema,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model<GlobalStatsDoc>('GlobalStats', globalStatsSchema);
