import crypto from 'crypto';
import { Types } from 'mongoose';
import {
  RouteServer,
  Infrastructure,
  Vlan,
  VlanInterface,
  VirtualInterface,
  IpAddress,
  IrrdbPrefix,
  Organization,
  Blackhole,
} from '../models';
import { IRouteServer } from '../models/routeServer.model';
import { IInfrastructure } from '../models/infrastructure.model';
import { IVlan } from '../models/vlan.model';

/**
 * BIRD 2.x route-server config generator.
 *
 * Turns the peering fabric in our database into a complete, deployable
 * `bird.conf` for one route server. Each BIRD runs on its own host (1 daemon per
 * server, 2 servers per location), so one RouteServer record == one config file.
 *
 * The generated policy follows RFC 7947 / RFC 7948 route-server behaviour plus
 * the filtering set every well-run IXP applies:
 *   - bogon prefix and bogon ASN rejection
 *   - prefix length bounds
 *   - next-hop enforcement (peer must not third-party its next hop)
 *   - origin ASN must match the peer's AS
 *   - our own ASN must not appear in the received path
 *   - IRRDB (as-set) prefix + origin filtering
 *   - RPKI origin validation, invalids rejected
 *   - max-prefix limits
 *   - RFC 8326 graceful shutdown
 *   - RFC 7999 blackholing
 *   - standard + large BGP control communities for selective announcement
 *
 * Nothing here executes anything; deployment is birdDeploy.service.ts.
 */

// ── Bogon definitions ──

/** RFC 6890 / RFC 5735 special-purpose IPv4 blocks. `+` covers more-specifics. */
const BOGONS_V4 = [
  '0.0.0.0/8{0,32}',
  '10.0.0.0/8{0,32}',
  '100.64.0.0/10{0,32}',
  '127.0.0.0/8{0,32}',
  '169.254.0.0/16{0,32}',
  '172.16.0.0/12{0,32}',
  '192.0.0.0/24{0,32}',
  '192.0.2.0/24{0,32}',
  '192.88.99.0/24{0,32}',
  '192.168.0.0/16{0,32}',
  '198.18.0.0/15{0,32}',
  '198.51.100.0/24{0,32}',
  '203.0.113.0/24{0,32}',
  '224.0.0.0/4{0,32}',
  '240.0.0.0/4{0,32}',
  '255.255.255.255/32',
];

/** RFC 6890 special-purpose IPv6 blocks. */
const BOGONS_V6 = [
  '::/8{0,128}',
  '0100::/64{0,128}',
  '2001:2::/48{0,128}',
  '2001:10::/28{0,128}',
  '2001:db8::/32{0,128}',
  '2002::/16{0,128}',
  '3ffe::/16{0,128}',
  'fc00::/7{0,128}',
  'fe80::/10{0,128}',
  'fec0::/10{0,128}',
  'ff00::/8{0,128}',
];

/**
 * Reserved / private / documentation ASNs that must never appear in a path on a
 * public peering LAN.
 */
const BOGON_ASNS: Array<[number, number]> = [
  [0, 0],
  [23456, 23456], // AS_TRANS
  [64496, 64511], // documentation (RFC 5398)
  [64512, 65534], // private use (16-bit)
  [65535, 65535], // reserved
  [65536, 65551], // documentation (RFC 5398)
  [4200000000, 4294967294], // private use (32-bit)
  [4294967295, 4294967295], // reserved
];

/** Longest AS path we accept — anything beyond this is a leak or a mistake. */
const MAX_AS_PATH_LENGTH = 64;

// ── Types ──

export interface BirdPeer {
  vlanInterfaceId: string;
  organizationId: string;
  orgName: string;
  asn: number;
  ipv4?: string;
  ipv6?: string;
  ipv4Enabled: boolean;
  ipv6Enabled: boolean;
  md5v4?: string;
  md5v6?: string;
  rsMode: 'normal' | 'passive' | 'disabled';
  maxPrefixesV4: number;
  maxPrefixesV6: number;
  irrdbFilter: boolean;
  rpkiFilter: boolean;
  asMacro?: string;
  /** IRRDB-derived prefix lists. Empty means the cache has nothing for them. */
  prefixesV4: Array<{ prefix: string; maxLength?: number }>;
  prefixesV6: Array<{ prefix: string; maxLength?: number }>;
  originAsnsV4: number[];
  originAsnsV6: number[];
  /** True when IRRDB filtering is on but the cache is empty for that family. */
  irrdbMissingV4: boolean;
  irrdbMissingV6: boolean;
  as112Client: boolean;
  configExtrasV4?: string;
  configExtrasV6?: string;
  /** BIRD symbol-safe identifier unique to this peer + connection. */
  symbol: string;
}

export interface BirdBuildResult {
  config: string;
  configHash: string;
  routeServer: {
    id: string;
    name: string;
    family: string;
    asn: number;
    routerId: string;
  };
  peers: BirdPeer[];
  stats: {
    totalPeers: number;
    v4Sessions: number;
    v6Sessions: number;
    passiveSessions: number;
    disabledSessions: number;
    irrdbFiltered: number;
    irrdbMissing: number;
    rpkiFiltered: number;
    blackholePrefixes: number;
  };
  warnings: string[];
}

// ── Helpers ──

/** BIRD symbols allow letters, digits and underscore only. */
const sanitizeSymbol = (s: string): string => String(s).replace(/[^A-Za-z0-9_]/g, '_');

/**
 * Escape a value going into a BIRD double-quoted string.
 *
 * Applies to MD5 secrets and free-text descriptions. Without this a stray quote
 * in a password would break the config or, worse, inject a directive.
 */
const birdString = (s: string): string =>
  `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ')}"`;

/** Strip anything that could terminate a BIRD comment line. */
const birdComment = (s: string): string => String(s).replace(/[\r\n]+/g, ' ').replace(/\*\//g, '* /');

const indent = (text: string, spaces = 2): string =>
  text
    .split('\n')
    .map((l) => (l.trim() ? ' '.repeat(spaces) + l : l))
    .join('\n');

// ── Peer collection ──

/**
 * Load every peer that belongs on this route server.
 *
 * MD5 secrets are `select:false` on the model, so they are pulled in explicitly
 * here — this is the only place that legitimately needs them.
 */
const collectPeers = async (rs: IRouteServer, vlanId: Types.ObjectId): Promise<{ peers: BirdPeer[]; warnings: string[] }> => {
  const warnings: string[] = [];

  const vlis = await VlanInterface.find({ vlan: vlanId, enabled: true, rsClient: true })
    .select('+ipv4BgpMd5 +ipv6BgpMd5')
    .lean();

  if (!vlis.length) return { peers: [], warnings };

  // Resolve the owning organisation via the virtual interface, and the
  // allocated addresses, in bulk rather than per-peer.
  const viIds = vlis.map((v: any) => v.virtualInterface).filter(Boolean);
  const vis = await VirtualInterface.find({ _id: { $in: viIds } })
    .select('organization infrastructure')
    .lean();
  const viById = new Map(vis.map((v: any) => [String(v._id), v]));

  const orgIds = vis.map((v: any) => v.organization).filter(Boolean);
  const orgs = await Organization.find({ _id: { $in: orgIds } })
    .select('name asn additionalAsns status irrAsSet infoPrefixes4 infoPrefixes6 neverViaRouteServers')
    .lean();
  const orgById = new Map(orgs.map((o: any) => [String(o._id), o]));

  const addrIds = vlis
    .flatMap((v: any) => [v.ipv4Address, v.ipv6Address])
    .filter(Boolean);
  const addrs = await IpAddress.find({ _id: { $in: addrIds } }).select('address family').lean();
  const addrById = new Map(addrs.map((a: any) => [String(a._id), a]));

  // IRRDB cache for every ASN involved, both families, in one query.
  const peerAsns = new Set<number>();
  for (const vli of vlis as any[]) {
    const vi = viById.get(String(vli.virtualInterface));
    const org = vi ? orgById.get(String(vi.organization)) : undefined;
    const asn = vli.peerAsn || org?.asn;
    if (asn) peerAsns.add(Number(asn));
  }
  const irrdbRows = peerAsns.size
    ? await IrrdbPrefix.find({ asn: { $in: Array.from(peerAsns) } }).lean()
    : [];
  const irrdbByKey = new Map(irrdbRows.map((r: any) => [`${r.asn}:${r.family}`, r]));

  const peers: BirdPeer[] = [];

  for (const vli of vlis as any[]) {
    const vi = viById.get(String(vli.virtualInterface));
    if (!vi) {
      warnings.push(`VLAN interface ${vli._id} has no virtual interface — skipped.`);
      continue;
    }
    const org = orgById.get(String(vi.organization));
    if (!org) {
      warnings.push(`VLAN interface ${vli._id} has no organisation — skipped.`);
      continue;
    }

    // A suspended member keeps their config out of the route servers. This is
    // the enforcement point for suspension, so it must not be skippable.
    if (org.status === 'suspended') {
      warnings.push(`${org.name} is suspended — excluded from the route server.`);
      continue;
    }

    const asn = Number(vli.peerAsn || org.asn || 0);
    if (!asn) {
      warnings.push(`${org.name} has no ASN — excluded.`);
      continue;
    }

    if (org.neverViaRouteServers) {
      warnings.push(
        `${org.name} (AS${asn}) sets "never via route servers" in PeeringDB but is marked as an RS client — excluded.`
      );
      continue;
    }

    const v4 = vli.ipv4Address ? addrById.get(String(vli.ipv4Address)) : undefined;
    const v6 = vli.ipv6Address ? addrById.get(String(vli.ipv6Address)) : undefined;

    const wantV4 = vli.ipv4Enabled && !!v4 && rs.family !== 'ipv6';
    const wantV6 = vli.ipv6Enabled && !!v6 && rs.family !== 'ipv4';

    if (vli.ipv4Enabled && !v4 && rs.family !== 'ipv6') {
      warnings.push(`${org.name} (AS${asn}) has IPv4 enabled but no address allocated — no IPv4 session generated.`);
    }
    if (vli.ipv6Enabled && !v6 && rs.family !== 'ipv4') {
      warnings.push(`${org.name} (AS${asn}) has IPv6 enabled but no address allocated — no IPv6 session generated.`);
    }
    if (!wantV4 && !wantV6) continue;

    const irr4 = irrdbByKey.get(`${asn}:4`);
    const irr6 = irrdbByKey.get(`${asn}:6`);
    const prefixesV4 = (irr4?.prefixes || []) as Array<{ prefix: string; maxLength?: number }>;
    const prefixesV6 = (irr6?.prefixes || []) as Array<{ prefix: string; maxLength?: number }>;

    const irrdbMissingV4 = !!vli.irrdbFilter && wantV4 && prefixesV4.length === 0;
    const irrdbMissingV6 = !!vli.irrdbFilter && wantV6 && prefixesV6.length === 0;

    if (irrdbMissingV4 || irrdbMissingV6) {
      const families = [irrdbMissingV4 ? 'IPv4' : null, irrdbMissingV6 ? 'IPv6' : null].filter(Boolean).join(' and ');
      warnings.push(
        rs.irrdbFailOpen
          ? `${org.name} (AS${asn}) has no cached IRRDB prefixes for ${families} — prefix filtering SKIPPED (fail-open is on).`
          : `${org.name} (AS${asn}) has no cached IRRDB prefixes for ${families} — all ${families} routes will be REJECTED. Refresh the IRRDB cache.`
      );
    }

    // Max-prefix precedence: explicit per-peer override, then the member's own
    // PeeringDB figure, then the route server default.
    const maxV4 = vli.maxPrefixesV4 || org.infoPrefixes4 || rs.defaultMaxPrefixesV4 || 200000;
    const maxV6 = vli.maxPrefixesV6 || org.infoPrefixes6 || rs.defaultMaxPrefixesV6 || 50000;

    peers.push({
      vlanInterfaceId: String(vli._id),
      organizationId: String(org._id),
      orgName: org.name,
      asn,
      ipv4: wantV4 ? v4!.address : undefined,
      ipv6: wantV6 ? v6!.address : undefined,
      ipv4Enabled: wantV4,
      ipv6Enabled: wantV6,
      md5v4: vli.ipv4BgpMd5 || '',
      md5v6: vli.ipv6BgpMd5 || '',
      rsMode: vli.rsMode || 'passive',
      maxPrefixesV4: maxV4,
      maxPrefixesV6: maxV6,
      irrdbFilter: !!vli.irrdbFilter,
      rpkiFilter: !!vli.rpkiFilter,
      asMacro: vli.asMacro || org.irrAsSet || '',
      prefixesV4,
      prefixesV6,
      originAsnsV4: (irr4?.originAsns || []) as number[],
      originAsnsV6: (irr6?.originAsns || []) as number[],
      irrdbMissingV4,
      irrdbMissingV6,
      as112Client: !!vli.as112Client,
      configExtrasV4: vli.configExtrasV4 || '',
      configExtrasV6: vli.configExtrasV6 || '',
      // Last 8 hex of the id keeps the symbol short but unique even when one
      // ASN has several connections on the same VLAN.
      symbol: `as${asn}_${sanitizeSymbol(String(vli._id).slice(-8))}`,
    });
  }

  // Two peers must never share an address — that would silently break one of
  // them. Cheap to check here and worth failing loudly over.
  for (const family of ['ipv4', 'ipv6'] as const) {
    const seen = new Map<string, string>();
    for (const p of peers) {
      const addr = p[family];
      if (!addr) continue;
      const prev = seen.get(addr);
      if (prev) warnings.push(`Duplicate ${family} address ${addr} used by both ${prev} and ${p.orgName}.`);
      else seen.set(addr, p.orgName);
    }
  }

  peers.sort((a, b) => a.asn - b.asn || a.orgName.localeCompare(b.orgName));
  return { peers, warnings };
};

// ── Config sections ──

const buildHeader = (
  rs: IRouteServer,
  infra: IInfrastructure,
  vlan: IVlan,
  peers: BirdPeer[],
  generatedAt: Date
): string => {
  const v4 = peers.filter((p) => p.ipv4Enabled).length;
  const v6 = peers.filter((p) => p.ipv6Enabled).length;
  return `################################################################################
#
#  BIRD configuration for ${birdComment(rs.name)}
#
#  GENERATED BY THE MX-IX ADMIN PANEL — DO NOT EDIT BY HAND.
#  Any manual change is lost on the next deploy. Use the admin panel, or the
#  per-route-server "extra config" field for anything not modelled here.
#
#  Generated at : ${generatedAt.toISOString()}
#  Infrastructure: ${birdComment(infra.name)} (AS${infra.asn})
#  Peering VLAN  : ${birdComment(vlan.name)} (802.1Q tag ${vlan.number})
#  Address family: ${rs.family}
#  Peers         : ${peers.length} (${v4} x IPv4, ${v6} x IPv6)
#
################################################################################
`;
};

const buildGlobals = (rs: IRouteServer, infra: IInfrastructure, vlan: IVlan): string => {
  const asn = rs.asn || infra.asn;
  const routerId = rs.routerId || rs.ipv4 || '';

  let out = `
# ── Global settings ─────────────────────────────────────────────────────────────
log syslog all;
debug protocols off;

define OWNAS = ${asn};
router id ${routerId};
`;

  if (vlan.ipv4Prefix) out += `define PEERING_LAN_V4 = ${vlan.ipv4Prefix};\n`;
  if (vlan.ipv6Prefix) out += `define PEERING_LAN_V6 = ${vlan.ipv6Prefix};\n`;

  if (rs.configHeaderExtras && rs.configHeaderExtras.trim()) {
    out += `
# ── Operator header additions ──
${rs.configHeaderExtras.trim()}
`;
  }

  out += `
# The device protocol is required for BIRD to see local interfaces.
protocol device {
  scan time 10;
}
`;
  return out;
};

const buildBogonDefinitions = (rs: IRouteServer): string => {
  let out = `
# ── Bogon prefixes (RFC 6890 special-purpose blocks, plus more-specifics) ──────
`;
  if (rs.family !== 'ipv6') {
    out += `define BOGONS_V4 = [\n${BOGONS_V4.map((b) => `  ${b}`).join(',\n')}\n];\n`;
  }
  if (rs.family !== 'ipv4') {
    out += `define BOGONS_V6 = [\n${BOGONS_V6.map((b) => `  ${b}`).join(',\n')}\n];\n`;
  }
  return out;
};

const buildRpki = (rs: IRouteServer): string => {
  if (!rs.rpkiEnabled) {
    return `
# ── RPKI ──
# RPKI validation is disabled for this route server. Enable it in the admin
# panel and set an RTR server to have invalid routes rejected.
`;
  }
  if (!rs.rtrServer) {
    return `
# ── RPKI ──
# WARNING: RPKI is enabled but no RTR server is configured, so no ROA data will
# be loaded and every prefix would validate as "unknown". Filtering is inert.
`;
  }

  let tables = '';
  let roaBlocks = '';
  if (rs.family !== 'ipv6') {
    tables += 'roa4 table rpki4;\n';
    roaBlocks += '  roa4 { table rpki4; };\n';
  }
  if (rs.family !== 'ipv4') {
    tables += 'roa6 table rpki6;\n';
    roaBlocks += '  roa6 { table rpki6; };\n';
  }

  return `
# ── RPKI / RTR ────────────────────────────────────────────────────────────────
${tables}
protocol rpki rpki_rtr {
${roaBlocks}  remote ${birdString(rs.rtrServer)} port ${rs.rtrPort || 3323};

  # Keep the last known-good ROA set if the validator becomes unreachable,
  # rather than failing open and accepting everything.
  retry keep 90;
  refresh keep 900;
  expire keep 172800;
}
`;
};

const buildFunctions = (rs: IRouteServer, vlan: IVlan): string => {
  let out = `
# ── Shared filter helpers ─────────────────────────────────────────────────────

# Reserved, private and documentation ASNs have no business in a path on a
# public peering LAN.
function has_bogon_asn() {
  return bgp_path ~ [= * ${BOGON_ASNS.map(([lo, hi]) => (lo === hi ? `${lo}` : `${lo}..${hi}`)).join(' * =] || bgp_path ~ [= * ')} * =];
}

# RFC 8326: a peer asking for graceful shutdown wants its routes de-preferenced,
# not dropped, so traffic drains before the session goes away.
function honour_graceful_shutdown() {
  if (65535, 0) ~ bgp_community then {
    bgp_local_pref = 0;
  }
}

# A peer must originate what it announces: the first ASN in the path has to be
# the peer's own AS. Catches the most common form of accidental leak.
function origin_matches_peer(int peer_as) {
  return bgp_path.first = peer_as;
}

# Our own ASN reappearing in a received path means a loop or a leak.
function path_contains_own_as() {
  return OWNAS ~ bgp_path;
}

function path_too_long() {
  return bgp_path.len > ${MAX_AS_PATH_LENGTH};
}
`;

  if (rs.family !== 'ipv6') {
    out += `
# IPv4 sanity: bogons, prefix length bounds, and the peering LAN itself — a peer
# announcing the peering LAN would blackhole the fabric for everyone on it.
function prefix_sane_v4() {
  if net ~ BOGONS_V4 then return false;
  if net.len < ${rs.minPrefixLengthV4} || net.len > ${rs.maxPrefixLengthV4} then return false;
${vlan.ipv4Prefix ? '  if net ~ PEERING_LAN_V4 then return false;\n' : ''}  return true;
}
`;
  }

  if (rs.family !== 'ipv4') {
    out += `
function prefix_sane_v6() {
  if net ~ BOGONS_V6 then return false;
  if net.len < ${rs.minPrefixLengthV6} || net.len > ${rs.maxPrefixLengthV6} then return false;
${vlan.ipv6Prefix ? '  if net ~ PEERING_LAN_V6 then return false;\n' : ''}  return true;
}
`;
  }

  if (rs.rpkiEnabled && rs.rtrServer) {
    if (rs.family !== 'ipv6') {
      out += `
# RPKI origin validation. "Unknown" is accepted (most of the table is still
# unsigned); only explicit invalids are dropped.
function rpki_valid_v4() {
  case roa_check(rpki4, net, bgp_path.last) {
    ROA_INVALID: return false;
    else: return true;
  }
}
`;
    }
    if (rs.family !== 'ipv4') {
      out += `
function rpki_valid_v6() {
  case roa_check(rpki6, net, bgp_path.last) {
    ROA_INVALID: return false;
    else: return true;
  }
}
`;
    }
  }

  out += `
# Selective announcement control.
#
# Standard communities:
#   0:OWNAS          -> do not announce to anyone
#   OWNAS:peer_as    -> announce to this peer
#   0:peer_as        -> do not announce to this peer
#
# Large communities (preferred, 32-bit ASN safe):
#   (OWNAS, 0, peer_as) -> do not announce to this peer
#   (OWNAS, 1, peer_as) -> announce to this peer
#   (OWNAS, 0, 0)       -> do not announce to anyone
#   (OWNAS, 1, 0)       -> announce to everyone
function announce_to(int peer_as) {
  # Explicit global block.
  if (0, OWNAS) ~ bgp_community then return false;
  if (OWNAS, 0, 0) ~ bgp_large_community then return false;

  # Explicit per-peer block wins over any allow.
  if (0, peer_as) ~ bgp_community then return false;
  if (OWNAS, 0, peer_as) ~ bgp_large_community then return false;

  # If the route carries any per-peer allow, it is an allow-list: only the
  # named peers get it.
  if (OWNAS, 1, 0) ~ bgp_large_community then return true;
  if bgp_large_community ~ [(OWNAS, 1, *)] then {
    return (OWNAS, 1, peer_as) ~ bgp_large_community;
  }
  if bgp_community ~ [(OWNAS, *)] then {
    return (OWNAS, peer_as) ~ bgp_community;
  }

  return true;
}
`;

  if (rs.blackholeEnabled) {
    out += `
# RFC 7999 blackholing: a peer may ask us to discard traffic to one of its own
# host routes. Accepted only at maximum prefix length and only inside a prefix
# the peer is already authorised to announce.
function is_blackhole() {
  return (65535, 666) ~ bgp_community;
}
`;
  }

  return out;
};

const buildBlackholeStatic = async (
  rs: IRouteServer,
  peers: BirdPeer[]
): Promise<{ config: string; count: number; warnings: string[] }> => {
  if (!rs.blackholeEnabled) return { config: '', count: 0, warnings: [] };

  const warnings: string[] = [];
  const orgIds = peers.map((p) => new Types.ObjectId(p.organizationId));
  const now = new Date();
  const holes = await Blackhole.find({
    organization: { $in: orgIds },
    active: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  })
    .select('organization prefix description')
    .lean();

  if (!holes.length) return { config: '', count: 0, warnings };

  const orgById = new Map(peers.map((p) => [p.organizationId, p]));
  const v4: string[] = [];
  const v6: string[] = [];

  for (const h of holes as any[]) {
    const owner = orgById.get(String(h.organization));
    if (!owner) continue;
    const prefix = String(h.prefix || '').trim();
    const isV6 = prefix.includes(':');
    // Only accept host routes — a blackhole on a covering prefix would discard
    // far more than the member intended.
    if (isV6 && !/\/128$/.test(prefix)) {
      warnings.push(`Blackhole ${prefix} for ${owner.orgName} is not a /128 — skipped.`);
      continue;
    }
    if (!isV6 && !/\/32$/.test(prefix)) {
      warnings.push(`Blackhole ${prefix} for ${owner.orgName} is not a /32 — skipped.`);
      continue;
    }
    const line = `  route ${prefix} blackhole;   # AS${owner.asn} ${birdComment(owner.orgName)}`;
    if (isV6) v6.push(line);
    else v4.push(line);
  }

  let config = '';
  if (v4.length && rs.family !== 'ipv6') {
    config += `
# ── Member-requested blackholes (IPv4) ──
protocol static blackholes_v4 {
  ipv4 { table master4; };
${v4.join('\n')}
}
`;
  }
  if (v6.length && rs.family !== 'ipv4') {
    config += `
# ── Member-requested blackholes (IPv6) ──
protocol static blackholes_v6 {
  ipv6 { table master6; };
${v6.join('\n')}
}
`;
  }

  return { config, count: v4.length + v6.length, warnings };
};

/** Per-peer prefix set from the IRRDB cache. */
const buildPrefixSet = (peer: BirdPeer, family: 4 | 6): string => {
  const list = family === 4 ? peer.prefixesV4 : peer.prefixesV6;
  const name = `PFX_${peer.symbol}_v${family}`;
  if (!list.length) return `define ${name} = [];   # no cached IRRDB data\n`;

  const entries = list.map((p) => {
    const maxLen = p.maxLength;
    // "prefix{len,max}" lets the peer announce more-specifics up to max, which
    // is what a route-object max-length means.
    if (maxLen && Number.isInteger(maxLen)) {
      const own = Number(String(p.prefix).split('/')[1]);
      if (Number.isInteger(own) && maxLen > own) return `  ${p.prefix}{${own},${maxLen}}`;
    }
    return `  ${p.prefix}`;
  });

  return `define ${name} = [\n${entries.join(',\n')}\n];\n`;
};

/**
 * Blank BGP session passwords in a generated config.
 *
 * Applied *after* hashing, so a redacted preview and the real deployed config
 * hash identically. Redacting before hashing would make the "already deployed"
 * comparison never match for any peer that uses MD5.
 */
const redactPasswords = (config: string): string =>
  config.replace(/^(\s*password\s+).*$/gm, '$1"(redacted)";');

const buildPeerBlock = (rs: IRouteServer, peer: BirdPeer, family: 4 | 6): string => {
  const neighbor = family === 4 ? peer.ipv4 : peer.ipv6;
  if (!neighbor) return '';

  const md5 = family === 4 ? peer.md5v4 : peer.md5v6;
  const maxPrefixes = family === 4 ? peer.maxPrefixesV4 : peer.maxPrefixesV6;
  const irrdbMissing = family === 4 ? peer.irrdbMissingV4 : peer.irrdbMissingV6;
  const extras = family === 4 ? peer.configExtrasV4 : peer.configExtrasV6;
  const channel = family === 4 ? 'ipv4' : 'ipv6';
  const table = family === 4 ? 'master4' : 'master6';
  const sane = family === 4 ? 'prefix_sane_v4()' : 'prefix_sane_v6()';
  const proto = `pb_${peer.symbol}_v${family}`;
  const pfxSet = `PFX_${peer.symbol}_v${family}`;
  const rpkiOn = rs.rpkiEnabled && !!rs.rtrServer && peer.rpkiFilter;

  // Import filter — everything the peer sends us runs through this.
  const importChecks: string[] = [];
  importChecks.push(`  # Reject anything that isn't a sane, routable prefix.
  if ! ${sane} then {
    ${rs.blackholeEnabled ? `if ! (is_blackhole() && net.len = ${family === 4 ? 32 : 128}) then ` : ''}reject "not a routable prefix";
  }`);

  importChecks.push(`  # The peer must originate what it announces.
  if ! origin_matches_peer(${peer.asn}) then reject "first ASN in path is not AS${peer.asn}";`);

  importChecks.push(`  if has_bogon_asn() then reject "bogon ASN in path";`);
  importChecks.push(`  if path_contains_own_as() then reject "our own ASN in path";`);
  importChecks.push(`  if path_too_long() then reject "AS path too long";`);

  importChecks.push(`  # The peer must be the next hop — no third-party next hops on the RS.
  if bgp_next_hop != ${neighbor} then reject "next hop is not the peer";`);

  if (peer.irrdbFilter) {
    if (irrdbMissing) {
      if (rs.irrdbFailOpen) {
        importChecks.push(`  # IRRDB filtering requested but the cache is empty for this peer.
  # Fail-open is enabled on this route server, so the prefix check is skipped.
  # Refresh the IRRDB cache to restore filtering.`);
      } else {
        importChecks.push(`  # IRRDB filtering requested but the cache is empty for this peer.
  # Failing closed: nothing is accepted until the cache is refreshed.
  reject "no IRRDB data cached for AS${peer.asn}";`);
      }
    } else {
      importChecks.push(`  # IRRDB: prefix must appear in ${peer.asMacro ? birdComment(peer.asMacro) : `AS${peer.asn}`}.
  if ! (net ~ ${pfxSet}) then reject "prefix not in IRRDB set for AS${peer.asn}";`);
    }
  }

  if (rpkiOn) {
    importChecks.push(`  if ! rpki_valid_v${family}() then reject "RPKI invalid";`);
  }

  if (rs.blackholeEnabled) {
    const nextHop = family === 4 ? rs.blackholeNextHopV4 : rs.blackholeNextHopV6;
    if (nextHop) {
      importChecks.push(`  # RFC 7999 blackhole: rewrite the next hop to the discard target.
  if is_blackhole() then {
    bgp_next_hop = ${nextHop};
  }`);
    }
  }

  importChecks.push(`  honour_graceful_shutdown();`);

  const importFilter = `filter f_import_${peer.symbol}_v${family}
{
${importChecks.join('\n\n')}

  accept;
}`;

  const exportFilter = `filter f_export_${peer.symbol}_v${family}
{
  # Never send a peer its own routes back.
  if bgp_path.first = ${peer.asn} then reject;
  if ! announce_to(${peer.asn}) then reject;
  accept;
}`;

  // Always emitted in full here; redactPasswords() strips it for previews once
  // the hash has been taken.
  const md5Line = md5 ? `  password ${birdString(md5)};\n` : '';

  const modeLines =
    peer.rsMode === 'disabled'
      ? '  disabled;\n'
      : peer.rsMode === 'passive'
        ? '  passive;   # wait for the member to initiate\n'
        : '';

  return `
# ── AS${peer.asn} — ${birdComment(peer.orgName)} — ${neighbor} ${'─'.repeat(Math.max(0, 30 - String(peer.asn).length - peer.orgName.length))}
${peer.irrdbFilter && !irrdbMissing ? buildPrefixSet(peer, family) : ''}${importFilter}

${exportFilter}

protocol bgp ${proto} {
  description ${birdString(`AS${peer.asn} ${peer.orgName}`)};
  local as OWNAS;
  neighbor ${neighbor} as ${peer.asn};

  # RFC 7947 route-server behaviour: do not prepend our ASN, do not rewrite the
  # next hop, and keep the received attributes transparent.
  rs client;

  # Never let one member's leak exhaust the route server's memory.
  ${channel} {
    table ${table};
    import filter f_import_${peer.symbol}_v${family};
    export filter f_export_${peer.symbol}_v${family};
    import limit ${maxPrefixes} action restart;
    next hop keep;
  };

${md5Line}${modeLines}  # Advertise support for graceful restart so a reload doesn't drop traffic.
  graceful restart on;
  interpret communities off;
${extras && extras.trim() ? `\n  # Operator additions for this peer\n${indent(extras.trim(), 2)}\n` : ''}}
`;
};

// ── Entry point ──

export interface BuildOptions {
  /**
   * Replace MD5 secrets with a placeholder. Defaults to true — a preview is
   * rendered in a browser, and BGP passwords should not travel there.
   * The deploy path sets this to false.
   */
  redactSecrets?: boolean;
}

/**
 * Generate the complete bird.conf for one route server.
 *
 * Returns the config plus a hash (so a no-op deploy can be skipped), the peer
 * list, counts, and any warnings the operator needs to see. Never throws for
 * data problems — those come back as warnings so a partially-configured fabric
 * is still diagnosable from the panel.
 */
export const buildConfig = async (
  routeServerId: string | Types.ObjectId,
  opts: BuildOptions = {}
): Promise<BirdBuildResult> => {
  const redactSecrets = opts.redactSecrets !== false;

  const rs = await RouteServer.findById(routeServerId);
  if (!rs) throw new Error('Route server not found');
  if (!rs.infrastructure) {
    throw new Error(
      `Route server "${rs.name}" has no infrastructure set. Assign it to an infrastructure and peering VLAN before generating config.`
    );
  }
  if (!rs.vlan) {
    throw new Error(`Route server "${rs.name}" has no peering VLAN set.`);
  }

  const infra = await Infrastructure.findById(rs.infrastructure).lean<IInfrastructure>();
  if (!infra) throw new Error('The route server references an infrastructure that no longer exists.');

  const vlan = await Vlan.findById(rs.vlan).lean<IVlan>();
  if (!vlan) throw new Error('The route server references a VLAN that no longer exists.');

  const warnings: string[] = [];

  if (!rs.routerId && !rs.ipv4) {
    warnings.push('No router id or IPv4 address is set — BIRD needs a router id and the generated config will not start.');
  }
  if (rs.family !== 'ipv6' && !vlan.ipv4Prefix) {
    warnings.push(`VLAN "${vlan.name}" has no IPv4 prefix, so IPv4 peers cannot be addressed.`);
  }
  if (rs.family !== 'ipv4' && !vlan.ipv6Prefix) {
    warnings.push(`VLAN "${vlan.name}" has no IPv6 prefix, so IPv6 peers cannot be addressed.`);
  }

  const { peers, warnings: peerWarnings } = await collectPeers(rs, vlan._id as Types.ObjectId);
  warnings.push(...peerWarnings);

  const generatedAt = new Date();
  const parts: string[] = [];

  parts.push(buildHeader(rs, infra, vlan, peers, generatedAt));
  parts.push(buildGlobals(rs, infra, vlan));
  parts.push(buildBogonDefinitions(rs));
  parts.push(buildRpki(rs));
  parts.push(buildFunctions(rs, vlan));

  // Master tables. BIRD 2 has master4/master6 built in; declaring the channels
  // on each protocol is what wires them up.
  parts.push(`
# ── Peers ─────────────────────────────────────────────────────────────────────
# One BGP protocol per peer per address family, each with its own import and
# export filter so a change to one member cannot affect another.
`);

  let v4Sessions = 0;
  let v6Sessions = 0;
  for (const peer of peers) {
    if (peer.ipv4Enabled) {
      parts.push(buildPeerBlock(rs, peer, 4));
      v4Sessions++;
    }
    if (peer.ipv6Enabled) {
      parts.push(buildPeerBlock(rs, peer, 6));
      v6Sessions++;
    }
  }

  const blackhole = await buildBlackholeStatic(rs, peers);
  if (blackhole.config) parts.push(blackhole.config);
  warnings.push(...blackhole.warnings);

  if (rs.configExtras && rs.configExtras.trim()) {
    parts.push(`
# ── Operator additions ────────────────────────────────────────────────────────
${rs.configExtras.trim()}
`);
  }

  parts.push(`
# ── End of generated configuration ────────────────────────────────────────────
`);

  // Built with real secrets, then hashed, then optionally redacted — so the hash
  // identifies the config that would actually be deployed regardless of whether
  // this particular caller is allowed to see the passwords.
  const config = parts.join('\n');
  const configHash = crypto.createHash('sha256').update(config).digest('hex');

  return {
    config: redactSecrets ? redactPasswords(config) : config,
    configHash,
    routeServer: {
      id: String(rs._id),
      name: rs.name,
      family: rs.family,
      asn: rs.asn || infra.asn,
      routerId: rs.routerId || rs.ipv4 || '',
    },
    peers,
    stats: {
      totalPeers: peers.length,
      v4Sessions,
      v6Sessions,
      passiveSessions: peers.filter((p) => p.rsMode === 'passive').length,
      disabledSessions: peers.filter((p) => p.rsMode === 'disabled').length,
      irrdbFiltered: peers.filter((p) => p.irrdbFilter).length,
      irrdbMissing: peers.filter((p) => p.irrdbMissingV4 || p.irrdbMissingV6).length,
      rpkiFiltered: peers.filter((p) => p.rpkiFilter).length,
      blackholePrefixes: blackhole.count,
    },
    warnings,
  };
};

export default { buildConfig };
