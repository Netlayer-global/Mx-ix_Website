import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IBlackhole extends Document {
  organization: Types.ObjectId;
  prefix: string; // CIDR, e.g. 203.0.113.5/32 or 2001:db8::/48
  description?: string;
  active: boolean;
  expiresAt?: Date | null;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const blackholeSchema = new Schema<IBlackhole>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    prefix: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    active: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
    createdBy: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Blackhole = mongoose.model<IBlackhole>('Blackhole', blackholeSchema);
export default Blackhole;
