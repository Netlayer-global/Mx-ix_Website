import { Types } from 'mongoose';
import { IpAddress, Vlan } from '../models';
import { IVlan } from '../models/vlan.model';
import {
  parseCidr,
  formatAddress,
  sortKeyFor,
  normalizeAddress,
  isInCidr,
  bigIntToIpv6,
} from '../utils/ip.util';

/**
 * IPAM for the peering LANs.
 *
 * A VLAN carries an IPv4 and/or IPv6 prefix; `seedVlanPool` materialises those
 * into IpAddress rows once, and provisioning then pulls the next free address
 * atomically. Members never get hand-typed addresses, which is what stops
 * duplicate IPs reaching the route servers.
 */

/**
 * Hard cap on how many addresses we materialise per family per VLAN.
 * A /64 has 2^64 addresses — seeding it is neither possible nor useful, so we
 * seed a working window from the start of the prefix and grow it on demand.
 */
export const DEFAULT_V6_POOL_SIZE = 512;
export const MAX_POOL_SIZE = 65536;

export interface SeedResult {
  family: 4 | 6;
  prefix: string;
  created: number;
  skipped: number;
  reserved: number;
  total: number;
}

/**
 * Materialise (or extend) the address pool for one VLAN.
 *
 * Idempotent: existing rows are left alone, so re-running after widening a
 * prefix or changing the reserved list only adds what's missing. Assignments
 * are never touched.
 */
export const seedVlanPool = async (
  vlanId: string | Types.ObjectId,
  opts: { v6Limit?: number; v4Limit?: number } = {}
): Promise<SeedResult[]> => {
  const vlan = await Vlan.findById(vlanId);
  if (!vlan) throw new Error('VLAN not found');

  const results: SeedResult[] = [];

  for (const family of [4, 6] as const) {
    const prefix = family === 4 ? vlan.ipv4Prefix : vlan.ipv6Prefix;
    if (!prefix) continue;

    const net = parseCidr(prefix);
    if (net.family !== family) {
      throw new Error(`VLAN ${vlan.name}: ${family === 4 ? 'ipv4Prefix' : 'ipv6Prefix'} "${prefix}" is not IPv${family}`);
    }

    const limit = Math.min(
      family === 4 ? opts.v4Limit ?? MAX_POOL_SIZE : opts.v6Limit ?? DEFAULT_V6_POOL_SIZE,
      MAX_POOL_SIZE
    );

    // Addresses the operator has explicitly carved out, plus the gateway.
    const reservedSet = new Set<string>();
    const reservedList = family === 4 ? vlan.ipv4Reserved : vlan.ipv6Reserved;
    for (const r of reservedList || []) {
      try {
        reservedSet.add(normalizeAddress(r));
      } catch {
        /* ignore malformed entries rather than failing the whole seed */
      }
    }
    const gateway = family === 4 ? vlan.ipv4Gateway : vlan.ipv6Gateway;
    if (gateway) {
      try {
        reservedSet.add(normalizeAddress(gateway));
      } catch {
        /* ignore */
      }
    }

    // For IPv4 /30 and larger, the first and last addresses are the network and
    // broadcast addresses and must never be handed out. /31 and /32 are
    // point-to-point / host routes where every address is usable.
    const skipFirstLast = family === 4 && net.prefixLength <= 30;
    // The all-zeros host in an IPv6 subnet is the subnet-router anycast address.
    const skipSubnetAnycast = family === 6 && net.prefixLength < 127;

    const start = net.first;
    const endExclusive = start + (net.size < BigInt(limit) ? net.size : BigInt(limit));

    const docs: any[] = [];
    let skipped = 0;
    for (let v = start; v < endExclusive; v++) {
      if (skipFirstLast && (v === net.first || v === net.last)) {
        skipped++;
        continue;
      }
      if (skipSubnetAnycast && v === net.first) {
        skipped++;
        continue;
      }
      const address = formatAddress(v, family);
      docs.push({
        vlan: vlan._id,
        family,
        address,
        sortKey: sortKeyFor(address, family),
        reserved: reservedSet.has(address),
        label: reservedSet.has(address) ? (gateway && normalizeAddress(gateway) === address ? 'Gateway' : 'Reserved') : '',
        assignedTo: null,
      });
    }

    // insertMany with ordered:false lets the unique (vlan, address) index reject
    // the rows that already exist while inserting the genuinely new ones.
    let created = 0;
    if (docs.length) {
      try {
        const inserted = await IpAddress.insertMany(docs, { ordered: false });
        created = inserted.length;
      } catch (err: any) {
        created = typeof err?.result?.nInserted === 'number' ? err.result.nInserted : err?.insertedDocs?.length || 0;
        // Anything other than duplicate-key (11000) is a real problem.
        const nonDuplicate = (err?.writeErrors || []).filter((e: any) => e?.err?.code !== 11000 && e?.code !== 11000);
        if (nonDuplicate.length) throw err;
      }
    }

    // Re-apply the reserved flag to pre-existing rows so editing the reserved
    // list on a seeded VLAN takes effect. Assigned addresses are left alone.
    if (reservedSet.size) {
      await IpAddress.updateMany(
        { vlan: vlan._id, family, address: { $in: Array.from(reservedSet) }, assignedTo: null },
        { $set: { reserved: true } }
      );
    }
    await IpAddress.updateMany(
      { vlan: vlan._id, family, address: { $nin: Array.from(reservedSet) }, reserved: true, assignedTo: null },
      { $set: { reserved: false, label: '' } }
    );

    const total = await IpAddress.countDocuments({ vlan: vlan._id, family });
    results.push({
      family,
      prefix,
      created,
      skipped,
      reserved: reservedSet.size,
      total,
    });
  }

  return results;
};

/**
 * Claim the lowest free address of a family for a VlanInterface.
 *
 * The findOneAndUpdate is a single atomic document operation, so two concurrent
 * provisioning runs can never be handed the same address.
 */
export const allocate = async (
  vlanId: string | Types.ObjectId,
  family: 4 | 6,
  vlanInterfaceId: string | Types.ObjectId
): Promise<{ id: Types.ObjectId; address: string } | null> => {
  const doc = await IpAddress.findOneAndUpdate(
    { vlan: vlanId, family, assignedTo: null, reserved: false },
    { $set: { assignedTo: vlanInterfaceId } },
    { sort: { sortKey: 1 }, new: true }
  );
  if (!doc) return null;
  return { id: doc._id as Types.ObjectId, address: doc.address };
};

/**
 * Claim a specific address. Used when an operator wants a memorable address or
 * is migrating a member that already has one in production.
 */
export const allocateSpecific = async (
  vlanId: string | Types.ObjectId,
  address: string,
  vlanInterfaceId: string | Types.ObjectId,
  opts: { allowReserved?: boolean } = {}
): Promise<{ id: Types.ObjectId; address: string }> => {
  const normalized = normalizeAddress(address);
  const filter: any = { vlan: vlanId, address: normalized, assignedTo: null };
  if (!opts.allowReserved) filter.reserved = false;

  const doc = await IpAddress.findOneAndUpdate(filter, { $set: { assignedTo: vlanInterfaceId } }, { new: true });
  if (!doc) {
    // Distinguish "not in the pool" from "already taken" — the operator needs
    // to know which so they can seed the pool vs pick another address.
    const existing = await IpAddress.findOne({ vlan: vlanId, address: normalized }).lean();
    if (!existing) throw new Error(`${normalized} is not in this VLAN's pool. Seed the pool or widen the prefix first.`);
    if (existing.assignedTo) throw new Error(`${normalized} is already assigned.`);
    throw new Error(`${normalized} is reserved.`);
  }
  return { id: doc._id as Types.ObjectId, address: doc.address };
};

/** Release a single address back to the pool. */
export const release = async (ipAddressId: string | Types.ObjectId): Promise<void> => {
  await IpAddress.updateOne({ _id: ipAddressId }, { $set: { assignedTo: null } });
};

/** Release every address held by a VlanInterface (used on deprovision). */
export const releaseForInterface = async (vlanInterfaceId: string | Types.ObjectId): Promise<number> => {
  const res = await IpAddress.updateMany({ assignedTo: vlanInterfaceId }, { $set: { assignedTo: null } });
  return res.modifiedCount || 0;
};

/** Mark an address unavailable without assigning it (RS address, DNS, anycast). */
export const setReserved = async (
  ipAddressId: string | Types.ObjectId,
  reserved: boolean,
  label = ''
): Promise<void> => {
  await IpAddress.updateOne(
    { _id: ipAddressId, assignedTo: null },
    { $set: { reserved, label: reserved ? label : '' } }
  );
};

export interface PoolStats {
  family: 4 | 6;
  prefix: string;
  total: number;
  assigned: number;
  reserved: number;
  free: number;
  /** Percentage of allocatable addresses in use. */
  utilization: number;
}

/** Utilisation summary per family — surfaced on the VLAN admin screen. */
export const poolStats = async (vlanId: string | Types.ObjectId): Promise<PoolStats[]> => {
  const vlan = await Vlan.findById(vlanId).lean<IVlan>();
  if (!vlan) throw new Error('VLAN not found');

  const out: PoolStats[] = [];
  for (const family of [4, 6] as const) {
    const prefix = (family === 4 ? vlan.ipv4Prefix : vlan.ipv6Prefix) || '';
    if (!prefix) continue;
    const [total, assigned, reserved] = await Promise.all([
      IpAddress.countDocuments({ vlan: vlanId, family }),
      IpAddress.countDocuments({ vlan: vlanId, family, assignedTo: { $ne: null } }),
      IpAddress.countDocuments({ vlan: vlanId, family, reserved: true, assignedTo: null }),
    ]);
    const allocatable = total - reserved;
    out.push({
      family,
      prefix,
      total,
      assigned,
      reserved,
      free: allocatable - assigned,
      utilization: allocatable > 0 ? Math.round((assigned / allocatable) * 1000) / 10 : 0,
    });
  }
  return out;
};

/**
 * Suggest an ASN-encoded IPv6 address — the convention many IXPs use so a
 * member's address is readable straight off their ASN.
 *
 * The ASN's decimal digits are chunked into groups of up to 4 **from the
 * right**, and each chunk is written literally as a hex group so the rendered
 * address shows the ASN digits:
 *
 *   2001:db8:1::/64 + AS64500  -> 2001:db8:1::6:4500:1
 *   2001:db8:1::/64 + AS132215 -> 2001:db8:1::13:2215:1
 *   2001:db8:1::/64 + AS715    -> 2001:db8:1::715:1
 *
 * Returns null when the prefix has too few host bits to carry the encoding, in
 * which case the caller falls back to sequential allocation.
 */
export const suggestIpv6ForAsn = (ipv6Prefix: string, asn: number, index = 1): string | null => {
  try {
    const net = parseCidr(ipv6Prefix);
    if (net.family !== 6) return null;
    if (!Number.isInteger(asn) || asn <= 0) return null;
    if (!Number.isInteger(index) || index < 0 || index > 0xffff) return null;

    const digits = String(asn);
    const chunks: string[] = [];
    for (let i = digits.length; i > 0; i -= 4) {
      chunks.unshift(digits.slice(Math.max(0, i - 4), i));
    }

    // Each decimal chunk is reinterpreted as a hex literal so the group prints
    // the original digits (e.g. "4500" -> 0x4500 -> renders as "4500").
    const groups = [...chunks.map((c) => parseInt(c, 16)), index];
    if (groups.some((g) => !Number.isInteger(g) || g < 0 || g > 0xffff)) return null;

    const hostBits = 128n - BigInt(net.prefixLength);
    if (hostBits < BigInt(16 * groups.length)) return null;

    let host = 0n;
    for (const g of groups) host = (host << 16n) | BigInt(g);
    if (host >= 1n << hostBits) return null;

    return bigIntToIpv6(net.first + host);
  } catch {
    return null;
  }
};

/**
 * Ensure a specific address exists as a pool row, creating it if the seeded
 * window doesn't reach that far. Needed for ASN-encoded v6 addresses, which sit
 * far outside the sequential window.
 */
export const ensureAddressInPool = async (
  vlanId: string | Types.ObjectId,
  address: string,
  family: 4 | 6
): Promise<void> => {
  const vlan = await Vlan.findById(vlanId).lean<IVlan>();
  if (!vlan) throw new Error('VLAN not found');
  const prefix = family === 4 ? vlan.ipv4Prefix : vlan.ipv6Prefix;
  if (!prefix) throw new Error(`VLAN has no IPv${family} prefix configured.`);

  const normalized = normalizeAddress(address);
  if (!isInCidr(normalized, prefix)) {
    throw new Error(`${normalized} is outside the VLAN prefix ${prefix}.`);
  }

  await IpAddress.updateOne(
    { vlan: vlanId, address: normalized },
    {
      $setOnInsert: {
        vlan: vlanId,
        family,
        address: normalized,
        sortKey: sortKeyFor(normalized, family),
        reserved: false,
        assignedTo: null,
      },
    },
    { upsert: true }
  );
};

/**
 * Allocate both families for a VlanInterface in one go.
 *
 * IPv6 prefers the ASN-encoded address when the prefix allows it and it's free,
 * otherwise falls back to the next sequential address. Partial success is
 * reported rather than thrown so the caller can decide whether a v4-only
 * provision is acceptable.
 */
export const allocateForInterface = async (
  vlanId: string | Types.ObjectId,
  vlanInterfaceId: string | Types.ObjectId,
  opts: { wantV4?: boolean; wantV6?: boolean; asn?: number } = {}
): Promise<{
  ipv4?: { id: Types.ObjectId; address: string };
  ipv6?: { id: Types.ObjectId; address: string };
  errors: string[];
}> => {
  const { wantV4 = true, wantV6 = true, asn } = opts;
  const errors: string[] = [];
  const out: any = { errors };

  if (wantV4) {
    const v4 = await allocate(vlanId, 4, vlanInterfaceId);
    if (v4) out.ipv4 = v4;
    else errors.push('No free IPv4 address in this VLAN — seed or widen the pool.');
  }

  if (wantV6) {
    const vlan = await Vlan.findById(vlanId).lean<IVlan>();
    let assigned: { id: Types.ObjectId; address: string } | null = null;

    // ASN-encoded addressing is opt-in per VLAN; anything else allocates
    // sequentially so addresses stay compact and predictable.
    if (asn && vlan?.ipv6Prefix && vlan.ipv6AddressingMode === 'asn-encoded') {
      const suggestion = suggestIpv6ForAsn(vlan.ipv6Prefix, asn);
      if (suggestion) {
        try {
          await ensureAddressInPool(vlanId, suggestion, 6);
          assigned = await allocateSpecific(vlanId, suggestion, vlanInterfaceId);
        } catch {
          // ASN-encoded address taken or unusable — fall through to sequential.
          assigned = null;
        }
      }
    }

    if (!assigned) assigned = await allocate(vlanId, 6, vlanInterfaceId);
    if (assigned) out.ipv6 = assigned;
    else errors.push('No free IPv6 address in this VLAN — seed or widen the pool.');
  }

  return out;
};

export default {
  seedVlanPool,
  allocate,
  allocateSpecific,
  allocateForInterface,
  release,
  releaseForInterface,
  setReserved,
  poolStats,
  suggestIpv6ForAsn,
  ensureAddressInPool,
  DEFAULT_V6_POOL_SIZE,
  MAX_POOL_SIZE,
};
