import mongoose, { Document, Schema, Types } from 'mongoose';

export type SwitchPortType =
  | 'peering'      // member-facing peering port
  | 'core'         // inter-switch link
  | 'reseller'
  | 'management'
  | 'fanout'
  | 'other';

export type SwitchPortStatus = 'free' | 'assigned' | 'reserved' | 'faulty' | 'decommissioned';

/**
 * A single interface on a Switch. Free ports are the inventory the
 * provisioning flow picks from; once a member is wired in, the port is
 * referenced by a PhysicalInterface and flips to `assigned`.
 */
export interface ISwitchPort extends Document {
  switch: Types.ObjectId;
  name: string;             // e.g. "100GE1/0/3" / "Ethernet1/1"
  type: SwitchPortType;
  /** SNMP ifIndex — used for per-port counters where name lookups are slow. */
  ifIndex?: number;
  /** Zabbix interface name, scopes the item filter on shared switches. */
  zabbixInterface?: string;
  /** Port capability in Mbit/s (1000, 10000, 100000, 400000). */
  speed?: number;
  /** Optical/DAC media descriptor, e.g. "100G-LR4". */
  media?: string;
  status: SwitchPortStatus;
  /** Set when the port is part of a LAG on the switch side. */
  lagName?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const switchPortSchema = new Schema<ISwitchPort>(
  {
    switch: { type: Schema.Types.ObjectId, ref: 'Switch', required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['peering', 'core', 'reseller', 'management', 'fanout', 'other'],
      default: 'peering',
    },
    ifIndex: { type: Number },
    zabbixInterface: { type: String, default: '' },
    speed: { type: Number },
    media: { type: String, default: '' },
    status: {
      type: String,
      enum: ['free', 'assigned', 'reserved', 'faulty', 'decommissioned'],
      default: 'free',
      index: true,
    },
    lagName: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// A port name is unique per switch — this is what stops two members being
// provisioned onto the same physical interface.
switchPortSchema.index({ switch: 1, name: 1 }, { unique: true });

export const SwitchPort = mongoose.model<ISwitchPort>('SwitchPort', switchPortSchema);
export default SwitchPort;
