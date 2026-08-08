import mongoose, { Document, Schema } from 'mongoose';
import { INetworkStats } from '../types';

export interface INetworkStatsDocument extends Document, INetworkStats {
  createdAt: Date;
  updatedAt: Date;
}

const networkStatsSchema = new Schema<INetworkStatsDocument>(
  {
    globalLatency: {
      value: {
        type: Number,
        required: true,
        default: 0.4,
      },
      unit: {
        type: String,
        required: true,
        default: 'ms',
      },
    },
    activeNodes: {
      type: Number,
      required: true,
      default: 4921,
    },
    throughput: {
      type: Number,
      required: true,
      default: 124,
    },
    locationsCount: {
      type: Number,
      required: false,
      default: 14,
    },
  },
  {
    timestamps: true,
    // Only allow one document (singleton pattern)
    capped: { size: 1024, max: 1 },
  }
);

// Static method to get or create the singleton
networkStatsSchema.statics.getStats = async function () {
  let stats = await this.findOne();
  if (!stats) {
    stats = await this.create({
      globalLatency: { value: 0.4, unit: 'ms' },
      activeNodes: 4921,
      throughput: 124,
      locationsCount: 14,
    });
  }
  return stats;
};

export const NetworkStats = mongoose.model<INetworkStatsDocument>('NetworkStats', networkStatsSchema);
export default NetworkStats;
