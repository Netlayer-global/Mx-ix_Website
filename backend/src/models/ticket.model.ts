import mongoose, { Document, Schema, Types } from 'mongoose';

export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketCategory = 'technical' | 'billing' | 'peering' | 'provisioning' | 'general';

export interface ITicketMessage {
  from: 'member' | 'staff';
  authorName: string;
  body: string;
  at: Date;
}

export interface ITicket extends Document {
  organization: Types.ObjectId;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  messages: ITicketMessage[];
  assignedTo?: string;
  createdBy?: string;
  lastReplyAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ticketSchema = new Schema<ITicket>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    subject: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['technical', 'billing', 'peering', 'provisioning', 'general'],
      default: 'general',
    },
    priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
    status: { type: String, enum: ['open', 'pending', 'resolved', 'closed'], default: 'open' },
    messages: {
      type: [
        {
          from: { type: String, enum: ['member', 'staff'], required: true },
          authorName: { type: String, default: '' },
          body: { type: String, required: true },
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    assignedTo: { type: String, default: '' },
    createdBy: { type: String, default: '' },
    lastReplyAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Ticket = mongoose.model<ITicket>('Ticket', ticketSchema);
export default Ticket;
