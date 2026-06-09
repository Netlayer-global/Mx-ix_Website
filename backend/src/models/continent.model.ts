import mongoose, { Document, Schema } from 'mongoose';

export interface IContinentDocument extends Document {
  id: string;
  name: string;
  description: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const continentSchema = new Schema<IContinentDocument>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
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

// Indexes
continentSchema.index({ order: 1 });
continentSchema.index({ isActive: 1 });

export const Continent = mongoose.model<IContinentDocument>('Continent', continentSchema);
export default Continent;
