import mongoose, { Document, Schema, Types } from 'mongoose';

export type PortStatus = 'active' | 'provisioning' | 'down' | 'maintenance';

/**
 * Port = a physical/logical connection an Organization has on the MX-IX fabric.
 * In the Option-1 hybrid, the operational source of truth is IXP Manager; this
 * record mirrors that (linked via ixpManagerPortId) so the portal can display it.
 */
export interface IPort extends Document {
  organization: Types.ObjectId;
  name: string;
  location: string;        // location id or display name
  speed: string;           // e.g. '1G' | '10G' | '100G' | '400G'
  vlan?: string;
  ipv4?: string;
  ipv6?: string;
  macAddress?: string;
  status: PortStatus;
  // Metric source linkage (Grafana/Zabbix per-port graphs in later phases)
  zabbixHostId?: string;
  ixpManagerPortId?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const portSchema = new Schema<IPort>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    location: { type: String, default: '' },
    speed: { type: String, default: '10G' },
    vlan: { type: String, default: '' },
    ipv4: { type: String, default: '' },
    ipv6: { type: String, default: '' },
    macAddress: { type: String, default: '' },
    status: {
      type: String,
      enum: ['active', 'provisioning', 'down', 'maintenance'],
      default: 'provisioning',
    },
    zabbixHostId: { type: String, default: '' },
    ixpManagerPortId: { type: String, default: '' },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Port = mongoose.model<IPort>('Port', portSchema);
export default Port;
