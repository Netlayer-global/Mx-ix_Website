import mongoose, { Document, Schema, Types } from 'mongoose';

export type OrderType = 'new_port' | 'upgrade' | 'addon';
export type OrderStatus =
  | 'submitted'
  | 'reviewing'
  | 'approved'
  | 'provisioning'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export interface IOrderUpdate {
  status: OrderStatus;
  message: string;
  by: string;
  at: Date;
}

export interface IOrder extends Document {
  organization: Types.ObjectId;
  type: OrderType;
  // Flexible request details
  location?: string;
  speed?: string;
  addon?: string; // 'cloud_connect' | 'ddos' | 'blackholing' | 'vlan' | ...
  portId?: Types.ObjectId | null; // for upgrades / addon-on-port
  quantity?: number;
  notes?: string;
  status: OrderStatus;
  adminNotes?: string;
  ixpManagerRef?: string;
  updates: IOrderUpdate[];
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IOrder>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    type: { type: String, enum: ['new_port', 'upgrade', 'addon'], required: true },
    location: { type: String, default: '' },
    speed: { type: String, default: '' },
    addon: { type: String, default: '' },
    portId: { type: Schema.Types.ObjectId, ref: 'Port', default: null },
    quantity: { type: Number, default: 1 },
    notes: { type: String, default: '' },
    status: {
      type: String,
      enum: ['submitted', 'reviewing', 'approved', 'provisioning', 'completed', 'rejected', 'cancelled'],
      default: 'submitted',
    },
    adminNotes: { type: String, default: '' },
    ixpManagerRef: { type: String, default: '' },
    updates: {
      type: [
        {
          status: { type: String, required: true },
          message: { type: String, default: '' },
          by: { type: String, default: '' },
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    createdBy: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Order = mongoose.model<IOrder>('Order', orderSchema);
export default Order;
