import mongoose, { Document, Schema, Types } from 'mongoose';

export type RsMode = 'normal' | 'passive' | 'disabled';

/**
 * VlanInterface = an addressed, BGP-speaking endpoint of a member connection
 * on one VLAN. **This is the peer record.**
 *
 * Everything the route servers need lives here, so `services/birdConfig.service.ts`
 * generates a BGP protocol block per (VlanInterface x address family) with no
 * other lookups beyond the owning Organization's ASN.
 *
 * One VirtualInterface can hold several of these — e.g. the peering LAN plus a
 * quarantine VLAN, or dual-stack on separate VLANs.
 */
export interface IVlanInterface extends Document {
  virtualInterface: Types.ObjectId;
  vlan: Types.ObjectId;

  /** Allocated from the VLAN pool by services/ipam.service.ts. */
  ipv4Address: Types.ObjectId | null;
  ipv6Address: Types.ObjectId | null;
  ipv4Enabled: boolean;
  ipv6Enabled: boolean;

  /** Forward DNS for the member's interface addresses. */
  ipv4Hostname?: string;
  ipv6Hostname?: string;

  /** TCP-MD5 session secrets. Never returned by list/get handlers. */
  ipv4BgpMd5?: string;
  ipv6BgpMd5?: string;

  /** Include in ping/BGP reachability monitoring. */
  ipv4CanPingMonitor: boolean;
  ipv6CanPingMonitor: boolean;
  ipv4CanBgpMonitor: boolean;
  ipv6CanBgpMonitor: boolean;

  /**
   * Route-server client. When false the member is on the fabric for bilateral
   * peering only and gets no RS protocol block.
   */
  rsClient: boolean;
  /**
   * normal   — RS initiates and accepts
   * passive  — RS waits for the member to connect (default for new members,
   *            avoids log noise before the member is ready)
   * disabled — config emitted but the protocol is shut down
   */
  rsMode: RsMode;

  /** Apply IRRDB (as-set) derived prefix filters on top of the base filters. */
  irrdbFilter: boolean;
  /** Apply RPKI origin validation; invalids are rejected. */
  rpkiFilter: boolean;

  /** Override the org's registered as-set/as-macro for prefix generation. */
  asMacro?: string;
  asMacroV6?: string;

  /** Max-prefix limits. 0 / unset means "derive from PeeringDB, else default". */
  maxPrefixesV4?: number;
  maxPrefixesV6?: number;

  /** Peer AS override — for members peering with a secondary ASN. */
  peerAsn?: number;

  /** Send/accept the AS112 anycast prefixes. */
  as112Client: boolean;

  /** Marks a member whose traffic profile needs special handling in graphs. */
  busyHost: boolean;

  /** Free-form config injected into the peer's BIRD protocol block. */
  configExtrasV4?: string;
  configExtrasV6?: string;

  notes?: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const vlanInterfaceSchema = new Schema<IVlanInterface>(
  {
    virtualInterface: { type: Schema.Types.ObjectId, ref: 'VirtualInterface', required: true, index: true },
    vlan: { type: Schema.Types.ObjectId, ref: 'Vlan', required: true, index: true },

    ipv4Address: { type: Schema.Types.ObjectId, ref: 'IpAddress', default: null },
    ipv6Address: { type: Schema.Types.ObjectId, ref: 'IpAddress', default: null },
    ipv4Enabled: { type: Boolean, default: true },
    ipv6Enabled: { type: Boolean, default: true },

    ipv4Hostname: { type: String, default: '' },
    ipv6Hostname: { type: String, default: '' },

    ipv4BgpMd5: { type: String, default: '', select: false },
    ipv6BgpMd5: { type: String, default: '', select: false },

    ipv4CanPingMonitor: { type: Boolean, default: true },
    ipv6CanPingMonitor: { type: Boolean, default: true },
    ipv4CanBgpMonitor: { type: Boolean, default: true },
    ipv6CanBgpMonitor: { type: Boolean, default: true },

    rsClient: { type: Boolean, default: true },
    rsMode: { type: String, enum: ['normal', 'passive', 'disabled'], default: 'passive' },

    irrdbFilter: { type: Boolean, default: true },
    rpkiFilter: { type: Boolean, default: true },

    asMacro: { type: String, default: '' },
    asMacroV6: { type: String, default: '' },

    maxPrefixesV4: { type: Number, default: 0 },
    maxPrefixesV6: { type: Number, default: 0 },

    peerAsn: { type: Number },

    as112Client: { type: Boolean, default: false },
    busyHost: { type: Boolean, default: false },

    configExtrasV4: { type: String, default: '' },
    configExtrasV6: { type: String, default: '' },

    notes: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// A connection gets one interface per VLAN.
vlanInterfaceSchema.index({ virtualInterface: 1, vlan: 1 }, { unique: true });
// Sparse unique on the allocated addresses: an IpAddress row can only be held
// by one VlanInterface, enforced from both sides.
vlanInterfaceSchema.index({ ipv4Address: 1 }, { unique: true, sparse: true });
vlanInterfaceSchema.index({ ipv6Address: 1 }, { unique: true, sparse: true });

export const VlanInterface = mongoose.model<IVlanInterface>('VlanInterface', vlanInterfaceSchema);
export default VlanInterface;
