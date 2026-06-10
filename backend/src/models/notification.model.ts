import mongoose, { Document, Schema, Types } from 'mongoose';

export type NotificationType = 'order' | 'ticket' | 'peering' | 'alert' | 'billing' | 'system';

export interface INotification extends Document {
  organization: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  link?: string; // portal section id to deep-link to
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    type: { type: String, enum: ['order', 'ticket', 'peering', 'alert', 'billing', 'system'], default: 'system' },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    link: { type: String, default: '' },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
export default Notification;
