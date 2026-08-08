import mongoose, { Document, Schema, Types } from 'mongoose';

export type DeviceVendor =
  | 'Huawei'
  | 'Cisco'
  | 'Juniper'
  | 'Arista'
  | 'Nokia'
  | 'Extreme'
  | 'MikroTik'
  | 'Edgecore'
  | 'Other';

/**
 * What kind of box this is. The peering fabric only cares about `switch`, but
 * the same inventory holds the supporting hardware an IXP has to track.
 */
export type DeviceType =
  | 'switch'
  | 'router'
  | 'route-server'
  | 'console-server'
  | 'pdu'
  | 'server'
  | 'patch-panel'
  | 'other';

/**
 * A rack-mounted device — normally a peering switch.
 *
 * Sits in the middle of the physical hierarchy:
 *
 *   Facility ──> Cabinet ──> Switch (this) ──> SwitchPort
 *
 * Rack occupancy is stored as `rackPosition` (lowest unit occupied) plus
 * `rackUnits` (height). The rack elevation view is derived from those in
 * services/rack.service.ts rather than stored as one row per unit.
 *
 * `zabbixHostName` is the bridge to the existing Grafana/Zabbix traffic
 * plumbing — `Port.zabbixHostId` already stores a Zabbix host *name*, and
 * portalTraffic.controller.ts queries the Zabbix datasource with it.
 */
export interface ISwitch extends Document {
  infrastructure: Types.ObjectId;
  /** Rack this device is mounted in. Null while it is on order / in transit. */
  cabinet?: Types.ObjectId | null;
  /**
   * Denormalised from `cabinet.facility`. Kept so "every device in this data
   * centre" is one query, and refreshed whenever the cabinet changes.
   */
  facility?: Types.ObjectId | null;

  name: string;              // e.g. "MB2 SW-01"
  hostname?: string;         // FQDN / management name
  deviceType: DeviceType;
  vendor: DeviceVendor;
  /**
   * Hardware model, e.g. "CE6881-48S6CQ".
   * Named `hardwareModel` rather than `model` because Mongoose's Document
   * already defines a `model()` method and shadowing it breaks the type.
   */
  hardwareModel?: string;
  os?: string;               // e.g. "VRP" / "NX-OS"
  osVersion?: string;
  serialNumber?: string;
  assetTag?: string;

  // ── Rack occupancy ──
  /** Lowest rack unit this device occupies (1-based). */
  rackPosition?: number;
  /** Height in rack units. */
  rackUnits: number;
  /** Front/rear mount, for elevation rendering. */
  rackFace: 'front' | 'rear';

  // ── Management ──
  managementIpv4?: string;
  managementIpv6?: string;
  /** Loopback used as the BGP/router id when this device peers. */
  loopbackIpv4?: string;
  snmpCommunity?: string;    // stored secret — never returned to the client
  /** Zabbix host name as it appears in the Grafana Zabbix datasource. */
  zabbixHostName?: string;
  /** Out-of-band access: console server + line number. */
  consoleServer?: Types.ObjectId | null;
  consolePort?: string;

  /** Power draw for cabinet budget planning. */
  powerWatts?: number;

  notes?: string;
  active: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const switchSchema = new Schema<ISwitch>(
  {
    infrastructure: { type: Schema.Types.ObjectId, ref: 'Infrastructure', required: true, index: true },
    cabinet: { type: Schema.Types.ObjectId, ref: 'Cabinet', default: null, index: true },
    facility: { type: Schema.Types.ObjectId, ref: 'Facility', default: null, index: true },

    name: { type: String, required: true, trim: true },
    hostname: { type: String, default: '' },
    deviceType: {
      type: String,
      enum: ['switch', 'router', 'route-server', 'console-server', 'pdu', 'server', 'patch-panel', 'other'],
      default: 'switch',
    },
    vendor: {
      type: String,
      enum: ['Huawei', 'Cisco', 'Juniper', 'Arista', 'Nokia', 'Extreme', 'MikroTik', 'Edgecore', 'Other'],
      default: 'Other',
    },
    hardwareModel: { type: String, default: '' },
    os: { type: String, default: '' },
    osVersion: { type: String, default: '' },
    serialNumber: { type: String, default: '' },
    assetTag: { type: String, default: '' },

    rackPosition: { type: Number, min: 1, max: 100 },
    rackUnits: { type: Number, default: 1, min: 1, max: 60 },
    rackFace: { type: String, enum: ['front', 'rear'], default: 'front' },

    managementIpv4: { type: String, default: '' },
    managementIpv6: { type: String, default: '' },
    loopbackIpv4: { type: String, default: '' },
    // select:false so the community string is not leaked by generic list/get
    // handlers — matches the Settings model's treatment of secrets.
    snmpCommunity: { type: String, default: '', select: false },
    zabbixHostName: { type: String, default: '' },
    consoleServer: { type: Schema.Types.ObjectId, ref: 'Switch', default: null },
    consolePort: { type: String, default: '' },

    powerWatts: { type: Number },

    notes: { type: String, default: '' },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

switchSchema.index({ infrastructure: 1, name: 1 }, { unique: true });

export const Switch = mongoose.model<ISwitch>('Switch', switchSchema);
export default Switch;
