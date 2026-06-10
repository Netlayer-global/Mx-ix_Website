import mongoose, { Document, Schema } from 'mongoose';

export type MemberType = 'ISP' | 'Content' | 'Cloud' | 'CDN' | 'Enterprise' | 'Academic' | 'Other';
export type PeeringPolicy = 'Open' | 'Selective' | 'Restrictive';

export interface IMember extends Document {
  name: string;
  asn?: number;
  logo?: string;
  website?: string;
  type: MemberType;
  peeringPolicy: PeeringPolicy;
  capacity?: string;
  locations: string[];
  joinedDate?: Date | null;
  featured: boolean;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const memberSchema = new Schema<IMember>(
  {
    name: { type: String, required: true },
    asn: { type: Number },
    logo: { type: String, default: '' },
    website: { type: String, default: '' },
    type: {
      type: String,
      enum: ['ISP', 'Content', 'Cloud', 'CDN', 'Enterprise', 'Academic', 'Other'],
      default: 'ISP',
    },
    peeringPolicy: {
      type: String,
      enum: ['Open', 'Selective', 'Restrictive'],
      default: 'Open',
    },
    capacity: { type: String, default: '' },
    locations: { type: [String], default: [] },
    joinedDate: { type: Date, default: null },
    featured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Member = mongoose.model<IMember>('Member', memberSchema);
export default Member;
