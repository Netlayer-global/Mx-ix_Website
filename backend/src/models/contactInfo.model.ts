import mongoose, { Document, Schema } from 'mongoose';
import { IContactInfo, Department } from '../types';

export interface IContactInfoDocument extends Document, IContactInfo {
  createdAt: Date;
  updatedAt: Date;
}

const contactInfoSchema = new Schema<IContactInfoDocument>(
  {
    department: {
      type: String,
      enum: ['sales', 'services', 'support'] as Department[],
      required: true,
      lowercase: true, // Automatically convert to lowercase
    },
    locationId: {
      type: String,
      required: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index
contactInfoSchema.index({ department: 1, locationId: 1 }, { unique: true });

export const ContactInfo = mongoose.model<IContactInfoDocument>('ContactInfo', contactInfoSchema);
export default ContactInfo;
