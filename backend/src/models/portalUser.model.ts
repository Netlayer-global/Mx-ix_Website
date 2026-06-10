import mongoose, { Document, Schema, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export type PortalRole = 'admin' | 'viewer' | 'billing';

/**
 * PortalUser = a customer login that belongs to an Organization.
 * Completely separate from the admin `User` model.
 */
export interface IPortalUser extends Document {
  organization: Types.ObjectId;
  email: string;
  password: string;
  name: string;
  role: PortalRole;
  isActive: boolean;
  lastLogin?: Date | null;
  resetToken?: string | null;
  resetTokenExpires?: Date | null;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string | null;
  twoFactorTempSecret?: string | null;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const portalUserSchema = new Schema<IPortalUser>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    name: { type: String, required: [true, 'Name is required'], trim: true },
    role: { type: String, enum: ['admin', 'viewer', 'billing'], default: 'admin' },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date, default: null },
    resetToken: { type: String, default: null, select: false },
    resetTokenExpires: { type: Date, default: null, select: false },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: null, select: false },
    twoFactorTempSecret: { type: String, default: null, select: false },
  },
  { timestamps: true }
);

portalUserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

portalUserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export const PortalUser = mongoose.model<IPortalUser>('PortalUser', portalUserSchema);
export default PortalUser;
