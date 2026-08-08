import mongoose, { Document, Schema, Types } from 'mongoose';

export type RsBackend = 'birdwatcher' | 'gobgp';
/** How the generated config reaches the daemon. */
export type RsDeployMethod = 'manual' | 'local' | 'ssh' | 'agent';
/**
 * Which address families this daemon carries. BIRD 2.x handles both in one
 * process, so `dual` is the normal choice for a modern rs1/rs2 pair; the
 * single-family values exist for split v4/v6 deployments.
 */
export type RsFamily = 'ipv4' | 'ipv6' | 'dual';
export type RsSoftware = 'bird2' | 'bird3';

/**
 * A route server.
 *
 * This model plays two roles:
 *
 *  1. **Alice-LG source** (original purpose) — `backend`, `apiUrl`,
 *     `birdwatcherType`, `group` generate the `[[sources]]` blocks in
 *     alice.conf. Untouched, so the looking glass keeps working.
 *
 *  2. **BIRD config target** (new) — `infrastructure`, `vlan`, `protocol`,
 *     `routerId`, `asn` and the deploy fields let the admin panel generate and
 *     push a complete bird.conf for this daemon.
 *
 * Typical layout for a multi-location IX: per Infrastructure, a redundant pair
 * of route servers (rs1 / rs2), each a dual-stack BIRD 2 instance. Use
 * `peerGroup` ('rs1' / 'rs2') when you split v4 and v6 into separate daemons on
 * the same host and want them deployed together.
 */
export interface IRouteServer extends Document {
  // ── Identity ──
  name: string;          // display name in the LG, e.g. "rs1.mumbai (IPv4)"
  group: string;         // Alice-LG group / location label, e.g. "Mumbai"
  location?: string;
  order: number;
  enabled: boolean;

  // ── Alice-LG looking glass source ──
  backend: RsBackend;
  apiUrl: string;        // birdwatcher/gobgp API endpoint
  birdwatcherType: string; // 'multi_table' | 'single_table'

  // ── BGP identity ──
  /** The fabric this RS serves. Required for BIRD config generation. */
  infrastructure?: Types.ObjectId | null;
  /** The peering VLAN whose VlanInterfaces become peers in the config. */
  vlan?: Types.ObjectId | null;
  /** Address families this daemon instance serves. */
  family: RsFamily;
  /** Local AS. Falls back to Infrastructure.asn when unset. */
  asn?: number;
  /** BGP router id (an IPv4 literal even for the v6 instance). */
  routerId?: string;
  /** The RS's own address on the peering LAN. */
  ipv4?: string;
  ipv6?: string;
  /**
   * Groups the daemons that live on the same host, e.g. 'rs1' / 'rs2'.
   * Deploying a group pushes every RouteServer sharing it.
   */
  peerGroup?: string;

  // ── Config generation options ──
  software: RsSoftware;
  /** Emit `protocol rpki` + RTR session and reject RPKI-invalid routes. */
  rpkiEnabled: boolean;
  rtrServer?: string;
  rtrPort?: number;
  /**
   * What to do when a peer has IRRDB filtering enabled but no cached prefixes
   * (as-set expansion never ran, or the last refresh failed).
   *
   *  false (default) — fail closed: the peer's prefix filter rejects everything.
   *                   Safe, but the member goes dark if the IRRDB refresh breaks.
   *  true            — fail open: skip the prefix-set check for that peer and
   *                   rely on the remaining filters.
   *
   * Either way the build reports a warning naming the affected peers.
   */
  irrdbFailOpen: boolean;
  /** Accept /32 (v4) and /128 (v6) blackhole routes and set next-hop. */
  blackholeEnabled: boolean;
  blackholeNextHopV4?: string;
  blackholeNextHopV6?: string;
  /** Longest/shortest accepted prefix length. */
  maxPrefixLengthV4: number;
  minPrefixLengthV4: number;
  maxPrefixLengthV6: number;
  minPrefixLengthV6: number;
  /** Default max-prefix limit when a peer has no explicit or PeeringDB value. */
  defaultMaxPrefixesV4: number;
  defaultMaxPrefixesV6: number;
  /** Blocks appended verbatim to the end of the generated config. */
  configExtras?: string;
  /** Static header injected before the generated content (logging, timeformat). */
  configHeaderExtras?: string;

  // ── Deployment ──
  deployMethod: RsDeployMethod;
  /** Where bird.conf is written (local or remote path). */
  configPath?: string;
  /**
   * BIRD control socket, e.g. `/run/bird/bird.ctl`.
   *
   * Deliberately a socket path rather than a free-text command: the validate and
   * reload commands are assembled by birdDeploy.service.ts from a fixed argv
   * template. Storing an arbitrary shell command here would turn "edit a route
   * server" into remote code execution on the BIRD host.
   */
  birdSocket?: string;
  /**
   * How the daemon is told to re-read its config.
   *  birdc     — `birdc -s <socket> configure` (preferred)
   *  systemctl — `systemctl reload <unit>`
   * Anything more exotic belongs behind the `agent` deploy method, where the
   * script lives on the BIRD host and is not editable through this API.
   */
  reloadStrategy: 'birdc' | 'systemctl';
  /** systemd unit name when reloadStrategy is `systemctl`, e.g. `bird`. */
  systemdUnit?: string;
  /** Prefix the validate/reload commands with sudo (non-interactive). */
  useSudo: boolean;
  /** SSH transport (deployMethod: 'ssh'). */
  sshHost?: string;
  sshPort?: number;
  sshUser?: string;
  sshKeyPath?: string;
  /** HTTP agent transport (deployMethod: 'agent'). */
  agentUrl?: string;
  agentToken?: string;

  lastDeployedAt?: Date | null;
  lastDeployHash?: string;

  createdAt: Date;
  updatedAt: Date;
}

const routeServerSchema = new Schema<IRouteServer>(
  {
    name: { type: String, required: true, trim: true },
    group: { type: String, default: '' },
    location: { type: String, default: '' },
    order: { type: Number, default: 0 },
    enabled: { type: Boolean, default: true },

    backend: { type: String, enum: ['birdwatcher', 'gobgp'], default: 'birdwatcher' },
    apiUrl: { type: String, required: true, trim: true },
    birdwatcherType: { type: String, default: 'multi_table' },

    infrastructure: { type: Schema.Types.ObjectId, ref: 'Infrastructure', default: null, index: true },
    vlan: { type: Schema.Types.ObjectId, ref: 'Vlan', default: null },
    family: { type: String, enum: ['ipv4', 'ipv6', 'dual'], default: 'dual' },
    asn: { type: Number },
    routerId: { type: String, default: '' },
    ipv4: { type: String, default: '' },
    ipv6: { type: String, default: '' },
    peerGroup: { type: String, default: '' },

    software: { type: String, enum: ['bird2', 'bird3'], default: 'bird2' },
    rpkiEnabled: { type: Boolean, default: false },
    rtrServer: { type: String, default: '' },
    rtrPort: { type: Number, default: 3323 },
    irrdbFailOpen: { type: Boolean, default: false },
    blackholeEnabled: { type: Boolean, default: true },
    blackholeNextHopV4: { type: String, default: '' },
    blackholeNextHopV6: { type: String, default: '' },
    maxPrefixLengthV4: { type: Number, default: 24 },
    minPrefixLengthV4: { type: Number, default: 8 },
    maxPrefixLengthV6: { type: Number, default: 48 },
    minPrefixLengthV6: { type: Number, default: 16 },
    defaultMaxPrefixesV4: { type: Number, default: 200000 },
    defaultMaxPrefixesV6: { type: Number, default: 50000 },
    configExtras: { type: String, default: '' },
    configHeaderExtras: { type: String, default: '' },

    deployMethod: { type: String, enum: ['manual', 'local', 'ssh', 'agent'], default: 'manual' },
    configPath: { type: String, default: '' },
    birdSocket: { type: String, default: '/run/bird/bird.ctl' },
    reloadStrategy: { type: String, enum: ['birdc', 'systemctl'], default: 'birdc' },
    systemdUnit: { type: String, default: 'bird' },
    useSudo: { type: Boolean, default: false },
    sshHost: { type: String, default: '' },
    sshPort: { type: Number, default: 22 },
    sshUser: { type: String, default: '' },
    sshKeyPath: { type: String, default: '' },
    agentUrl: { type: String, default: '' },
    // Bearer token for the agent transport — treated like the other secrets.
    agentToken: { type: String, default: '', select: false },

    lastDeployedAt: { type: Date, default: null },
    lastDeployHash: { type: String, default: '' },
  },
  { timestamps: true }
);

export const RouteServer = mongoose.model<IRouteServer>('RouteServer', routeServerSchema);
export default RouteServer;
