import mongoose, { Document, Schema } from 'mongoose';
import { IGlobalFabricStats } from '../types';

export interface IGlobalFabricStatsDocument extends Document, IGlobalFabricStats {
  createdAt: Date;
  updatedAt: Date;
}

const globalFabricStatsSchema = new Schema<IGlobalFabricStatsDocument>(
  {
    totalCapacity: {
      type: String,
      required: true,
      default: '5.2 Tbps',
    },
    activeRoutes: {
      type: String,
      required: true,
      default: '10,000+',
    },
    avgLatency: {
      type: String,
      required: true,
      default: '<5ms',
    },
    globalCoverage: {
      type: String,
      required: true,
      default: '100%',
    },
  },
  {
    timestamps: true,
  }
);

// Static method to get or create the singleton
globalFabricStatsSchema.statics.getStats = async function () {
  let stats = await this.findOne();
  if (!stats) {
    stats = await this.create({
      totalCapacity: '5.2 Tbps',
      activeRoutes: '10,000+',
      avgLatency: '<5ms',
      globalCoverage: '100%',
    });
  }
  return stats;
};

export const GlobalFabricStats = mongoose.model<IGlobalFabricStatsDocument>('GlobalFabricStats', globalFabricStatsSchema);
export default GlobalFabricStats;
