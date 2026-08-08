import mongoose, { Document, Schema, Types } from 'mongoose';

export type PhysicalInterfaceStatus =
  | 'connected'
  | 'awaiting-xconnect'
  | 'quarantine'
  | 'disabled'
  | 'notconnected'
  | 'decommissioned';

export type Duplex = 'full' | 'half';

/**
 * PhysicalInterface = the cross-connect: it binds one member's
 * VirtualInterface (LAG) to one SwitchPort.
 *
 * Two of these on the same VirtualInterface means a 2-port LAG.
 */
export interface IPhysicalInterface extends Document {
  virtualInterface: Types.ObjectId;
  switchPort: Types.ObjectId;
  /** Negotiated speed in Mbit/s (1000 / 10000 / 100000 / 400000). */
  speed: number;
  duplex: Duplex;
  status: PhysicalInterfaceStatus;
  /** Auto-negotiation left on? Most IX peering ports are hard-set. */
  autoNegotiation: boolean;
  /** Cross-connect / LOA reference from the colo provider. */
  xconnectRef?: string;
  /** Patch panel position, useful for remote-hands tickets. */
  patchPanelPort?: string;
  /** Set when this port is a fanout child of another physical interface. */
  fanoutParent?: Types.ObjectId | null;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const physicalInterfaceSchema = new Schema<IPhysicalInterface>(
  {
    virtualInterface: { type: Schema.Types.ObjectId, ref: 'VirtualInterface', required: true, index: true },
    switchPort: { type: Schema.Types.ObjectId, ref: 'SwitchPort', required: true },
    speed: { type: Number, default: 10000 },
    duplex: { type: String, enum: ['full', 'half'], default: 'full' },
    status: {
      type: String,
      enum: ['connected', 'awaiting-xconnect', 'quarantine', 'disabled', 'notconnected', 'decommissioned'],
      default: 'awaiting-xconnect',
    },
    autoNegotiation: { type: Boolean, default: false },
    xconnectRef: { type: String, default: '' },
    patchPanelPort: { type: String, default: '' },
    fanoutParent: { type: Schema.Types.ObjectId, ref: 'PhysicalInterface', default: null },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// A switch port can only ever be wired to one member connection. Without this
// two provisioning runs could silently double-book the same port.
physicalInterfaceSchema.index({ switchPort: 1 }, { unique: true });

export const PhysicalInterface = mongoose.model<IPhysicalInterface>(
  'PhysicalInterface',
  physicalInterfaceSchema
);
export default PhysicalInterface;
