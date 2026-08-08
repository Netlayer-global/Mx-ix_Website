import mongoose, { Document, Schema, Types } from 'mongoose';

export type PeeringRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

/**
 * A bilateral peering request from one member to another network.
 * If the target ASN belongs to a member org, `toOrg` is linked and that member
 * can accept/reject from their portal. Otherwise it's tracked as external and
 * MX-IX facilitates.
 */
export interface IPeeringRequest extends Document {
  fromOrg: Types.ObjectId;
  fromAsn?: number;
  toOrg?: Types.ObjectId | null;
  toAsn: number;
  toName: string;
  status: PeeringRequestStatus;
  message?: string;
  responseMessage?: string;
  locations: string[];
  createdBy?: string;
  respondedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const peeringRequestSchema = new Schema<IPeeringRequest>(
  {
    fromOrg: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    fromAsn: { type: Number },
    toOrg: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    toAsn: { type: Number, required: true },
    toName: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'cancelled'],
      default: 'pending',
    },
    message: { type: String, default: '' },
    responseMessage: { type: String, default: '' },
    locations: { type: [String], default: [] },
    createdBy: { type: String, default: '' },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const PeeringRequest = mongoose.model<IPeeringRequest>('PeeringRequest', peeringRequestSchema);
export default PeeringRequest;
