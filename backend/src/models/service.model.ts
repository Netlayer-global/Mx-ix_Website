import mongoose, { Document, Schema } from 'mongoose';
import { IService, IServiceItem } from '../types';

export interface IServiceDocument extends Document {
  id: string;
  category: string;
  tagline: string;
  description: string;
  image: string;
  items: IServiceItem[];
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const serviceStatSchema = new Schema(
  {
    label: { type: String, required: true },
    value: { type: String, required: true },
    period: { type: String, required: true },
  },
  { _id: false }
);

const serviceItemSchema = new Schema(
  {
    name: { type: String, required: true },
    icon: { type: String, default: '' },
    description: { type: String, required: true },
    benefits: [{ type: String }],
    features: [{ type: String }],
    stats: [serviceStatSchema],
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const serviceSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    tagline: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      default: '',
    },
    items: [serviceItemSchema],
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for ordering
serviceSchema.index({ order: 1 });

export const Service = mongoose.model<IServiceDocument>('Service', serviceSchema);
export default Service;
