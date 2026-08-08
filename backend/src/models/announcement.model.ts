import mongoose, { Document, Schema } from 'mongoose';

export type AnnouncementType = 'info' | 'maintenance' | 'incident';

export interface IAnnouncement extends Document {
  title: string;
  body: string;
  type: AnnouncementType;
  channels: { inApp: boolean; email: boolean };
  audience: 'all' | 'active';
  sentBy?: string;
  recipients: number;
  createdAt: Date;
  updatedAt: Date;
}

const announcementSchema = new Schema<IAnnouncement>(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    type: { type: String, enum: ['info', 'maintenance', 'incident'], default: 'info' },
    channels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
    },
    audience: { type: String, enum: ['all', 'active'], default: 'active' },
    sentBy: { type: String, default: '' },
    recipients: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Announcement = mongoose.model<IAnnouncement>('Announcement', announcementSchema);
export default Announcement;
