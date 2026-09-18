import mongoose, { Document, Schema } from 'mongoose';
import crypto from 'crypto';

/**
 * Public status-page email subscriber.
 *
 * Every subscriber carries an opaque `token` so status emails can include a
 * one-click unsubscribe link. Without it there is no way to opt out, which is
 * both a poor experience and a compliance problem.
 */
export interface ISubscriber extends Document {
  email: string;
  active: boolean;
  /** Opaque unsubscribe token, safe to put in a URL. */
  token: string;
  unsubscribedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const subscriberSchema = new Schema<ISubscriber>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    active: { type: Boolean, default: true },
    token: { type: String, default: () => crypto.randomBytes(24).toString('hex'), index: true },
    unsubscribedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const newSubscriberToken = (): string => crypto.randomBytes(24).toString('hex');

export const Subscriber = mongoose.model<ISubscriber>('Subscriber', subscriberSchema);
export default Subscriber;
