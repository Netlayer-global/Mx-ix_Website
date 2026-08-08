import { Request, Response } from 'express';
import { Vlan, Infrastructure, IpAddress, VlanInterface, RouteServer } from '../models';
import ipam from '../services/ipam.service';
import { logAudit } from '../services/audit.service';
import { normalizeCidr, normalizeAddress } from '../utils/ip.util';
import { pick, str, int, objectId, oneOf, param, Validator } from '../utils/validate.util';

/**
 * VLAN and IP address management.
 *
 * A VLAN owns the peering-LAN prefixes; the address pool is materialised from
 * them and handed out atomically by ipam.service.ts. Prefix changes are the
 * riskiest edit here, so they are guarded against orphaning addresses that are
 * already assigned to live peers.
 */

const ok = (res: Response, data: any, status = 200): void => {
  res.status(status).json({ success: true, data });
};
const bad = (res: Response, error: string, status = 400): void => {
  res.status(status).json({ success: false, error });
};

const VLAN_FIELDS = [
  'infrastructure',
  'name',
  'number',
  'shortname',
  'ipv4Prefix',
  'ipv6Prefix',
  'ipv4Gateway',
  'ipv6Gateway',
  'ipv4Reserved',
  'ipv6Reserved',
  'ipv6AddressingMode',
  'isQuarantine',
  'isPrivate',
  'peeringMatrix',
  'ixfExport',
  'reverseDnsZoneV4',
  'reverseDnsZoneV6',
  'notes',
  'enabled',
  'order',
] as const;

/** Validate and normalise the prefix fields, collecting all problems at once. */
const normalisePrefixes = (payload: Record<string, any>, v: Validator): void => {
  for (const [field, family] of [['ipv4Prefix', 4], ['ipv6Prefix', 6]] as const) {
    if (payload[field] === undefined) continue;
    const raw = str(payload[field]);
    if (!raw) {
      payload[field] = '';
      continue;
    }
    try {
      const normalised = normalizeCidr(raw);
      // Guard against an IPv6 prefix being typed into the IPv4 box and vice versa.
      const isV6 = normalised.includes(':');
      if ((family === 4 && isV6) || (family === 6 && !isV6)) {
        v.add(`${field} must be an IPv${family} prefix.`);
        continue;
      }
      payload[field] = normalised;
    } catch (err: any) {
      v.add(`${field}: ${err?.message || 'invalid prefix'}`);
    }
  }

  for (const field of ['ipv4Gateway', 'ipv6Gateway'] as const) {
    if (payload[field] === undefined) continue;
    const raw = str(payload[field]);
    if (!raw) {
      payload[field] = '';
      continue;
    }
    try {
      payload[field] = normalizeAddress(raw);
    } catch {
      v.add(`${field} is not a valid IP address.`);
    }
  }

  for (const field of ['ipv4Reserved', 'ipv6Reserved'] as const) {
    if (payload[field] === undefined) continue;
    if (!Array.isArray(payload[field])) {
      v.add(`${field} must be a list of addresses.`);
      continue;
    }
    const out: string[] = [];
    for (const entry of payload[field]) {
      const raw = str(entry);
      if (!raw) continue;
      try {
        out.push(normalizeAddress(raw));
      } catch {
        v.add(`${field} contains an invalid address: ${raw}`);
      }
    }
    payload[field] = out;
  }
};

export const listVlans = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: any = {};
    const infra = objectId(req.query?.infrastructure);
    if (infra) filter.infrastructure = infra;

    const rows = await Vlan.find(filter)
      .populate('infrastructure', 'name shortname asn')
      .sort({ order: 1, number: 1 })
      .lean();

    const ids = rows.map((r: any) => r._id);
    const [addrAgg, peerAgg] = await Promise.all([
      ids.length
        ? IpAddress.aggregate([
            { $match: { vlan: { $in: ids } } },
            {
              $group: {
                _id: { vlan: '$vlan', family: '$family' },
                total: { $sum: 1 },
                assigned: { $sum: { $cond: [{ $ne: ['$assignedTo', null] }, 1, 0] } },
                reserved: { $sum: { $cond: [{ $and: ['$reserved', { $eq: ['$assignedTo', null] }] }, 1, 0] } },
              },
            },
          ])
        : [],
      ids.length
        ? VlanInterface.aggregate([{ $match: { vlan: { $in: ids } } }, { $group: { _id: '$vlan', n: { $sum: 1 } } }])
        : [],
    ]);

    const poolByVlan = new Map<string, any>();
    for (const row of addrAgg as any[]) {
      const key = String(row._id.vlan);
      const entry = poolByVlan.get(key) || {};
      entry[`v${row._id.family}`] = {
        total: row.total,
        assigned: row.assigned,
        reserved: row.reserved,
        free: row.total - row.reserved - row.assigned,
      };
      poolByVlan.set(key, entry);
    }
    const peers = new Map(peerAgg.map((r: any) => [String(r._id), r.n]));

    ok(
      res,
      rows.map((r: any) => ({
        ...r,
        pool: poolByVlan.get(String(r._id)) || {},
        peerCount: peers.get(String(r._id)) || 0,
      }))
    );
  } catch {
    bad(res, 'Failed to load VLANs.', 500);
  }
};

export const createVlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = new Validator();
    const infrastructure = v.require(objectId(req.body?.infrastructure), 'Infrastructure');
    const name = v.require(str(req.body?.name), 'Name');
    const number = v.require(int(req.body?.number, { min: 1, max: 4094 }), 'VLAN number (1-4094)');

    const payload = pick(req.body, VLAN_FIELDS) as Record<string, any>;
    normalisePrefixes(payload, v);
    if (v.failed) return bad(res, v.message);

    if (!(await Infrastructure.exists({ _id: infrastructure }))) return bad(res, 'Infrastructure not found.', 404);

    payload.infrastructure = infrastructure;
    payload.name = name;
    payload.number = number;

    const created = await Vlan.create(payload);

    // Seed the pool immediately so the VLAN is usable without a second step.
    let seeded: any[] = [];
    try {
      seeded = await ipam.seedVlanPool(created._id as any);
    } catch (err: any) {
      // A bad prefix shouldn't lose the VLAN itself; report it instead.
      await logAudit({
        actor: req.user?.email,
        action: 'vlan.seed_failed',
        resource: 'Vlan',
        resourceId: String(created._id),
        after: { error: err?.message },
      });
    }

    await logAudit({
      actor: req.user?.email,
      action: 'vlan.create',
      resource: 'Vlan',
      resourceId: String(created._id),
      after: { name: created.name, number: created.number, seeded: seeded.map((s) => ({ family: s.family, created: s.created })) },
    });
    ok(res, { vlan: created, pool: seeded }, 201);
  } catch (err: any) {
    if (err?.code === 11000) return bad(res, 'That VLAN number already exists on this infrastructure.', 409);
    bad(res, 'Failed to create the VLAN.', 500);
  }
};

export const updateVlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await Vlan.findById(req.params.id);
    if (!existing) return bad(res, 'VLAN not found.', 404);

    const v = new Validator();
    const payload = pick(req.body, VLAN_FIELDS) as Record<string, any>;
    normalisePrefixes(payload, v);
    if (v.failed) return bad(res, v.message);

    // Changing a prefix would leave already-assigned addresses outside the
    // range, which is how a live peer ends up with an address the fabric no
    // longer routes. Block it while any address is in use.
    for (const [field, family] of [['ipv4Prefix', 4], ['ipv6Prefix', 6]] as const) {
      if (payload[field] === undefined) continue;
      const current = family === 4 ? existing.ipv4Prefix : existing.ipv6Prefix;
      if (String(payload[field]) === String(current || '')) continue;

      const assigned = await IpAddress.countDocuments({ vlan: existing._id, family, assignedTo: { $ne: null } });
      if (assigned) {
        return bad(
          res,
          `${assigned} IPv${family} address(es) in this VLAN are assigned to peers, so the prefix cannot be changed. Deprovision them first.`
        );
      }
      // No assignments — clear the stale pool so re-seeding starts clean.
      await IpAddress.deleteMany({ vlan: existing._id, family });
    }

    const before = existing.toObject();
    const updated = await Vlan.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true });

    let seeded: any[] = [];
    try {
      seeded = await ipam.seedVlanPool(param(req.params.id));
    } catch (err: any) {
      seeded = [];
    }

    await logAudit({
      actor: req.user?.email,
      action: 'vlan.update',
      resource: 'Vlan',
      resourceId: String(req.params.id),
      before: { ipv4Prefix: before.ipv4Prefix, ipv6Prefix: before.ipv6Prefix, number: before.number },
      after: payload,
    });
    ok(res, { vlan: updated, pool: seeded });
  } catch (err: any) {
    if (err?.code === 11000) return bad(res, 'That VLAN number already exists on this infrastructure.', 409);
    bad(res, 'Failed to update the VLAN.', 500);
  }
};

export const deleteVlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const [peers, routeServers] = await Promise.all([
      VlanInterface.countDocuments({ vlan: req.params.id }),
      RouteServer.countDocuments({ vlan: req.params.id }),
    ]);
    if (peers || routeServers) {
      return bad(
        res,
        `This VLAN still has ${peers} peer(s) and is used by ${routeServers} route server(s). Remove those first.`,
        409
      );
    }
    await IpAddress.deleteMany({ vlan: req.params.id });
    await Vlan.findByIdAndDelete(req.params.id);
    await logAudit({ actor: req.user?.email, action: 'vlan.delete', resource: 'Vlan', resourceId: String(req.params.id) });
    ok(res, { deleted: true });
  } catch {
    bad(res, 'Failed to delete the VLAN.', 500);
  }
};

// ── IP address pool ──

/** Utilisation per family, for the VLAN detail screen. */
export const poolStats = async (req: Request, res: Response): Promise<void> => {
  try {
    ok(res, await ipam.poolStats(param(req.params.id)));
  } catch (err: any) {
    bad(res, err?.message || 'Failed to read the pool.', err?.message === 'VLAN not found' ? 404 : 500);
  }
};

/**
 * Materialise or extend the pool.
 *
 * Idempotent, so it is also the way to widen the IPv6 window or re-apply a
 * changed reserved list.
 */
export const seedPool = async (req: Request, res: Response): Promise<void> => {
  try {
    const v6Limit = int(req.body?.v6Limit, { min: 1, max: ipam.MAX_POOL_SIZE });
    const v4Limit = int(req.body?.v4Limit, { min: 1, max: ipam.MAX_POOL_SIZE });

    const result = await ipam.seedVlanPool(param(req.params.id), { v6Limit, v4Limit });
    await logAudit({
      actor: req.user?.email,
      action: 'vlan.seed_pool',
      resource: 'Vlan',
      resourceId: String(req.params.id),
      after: result,
    });
    ok(res, result);
  } catch (err: any) {
    bad(res, err?.message || 'Failed to seed the pool.', err?.message === 'VLAN not found' ? 404 : 500);
  }
};

/** Paged address list with the peer holding each one. */
export const listAddresses = async (req: Request, res: Response): Promise<void> => {
  try {
    const family = int(req.query?.family, { min: 4, max: 6 });
    const state = oneOf(req.query?.state, ['free', 'assigned', 'reserved'] as const);
    const limit = int(req.query?.limit, { min: 1, max: 1000 }) ?? 250;
    const skip = int(req.query?.skip, { min: 0 }) ?? 0;

    const filter: any = { vlan: req.params.id };
    if (family === 4 || family === 6) filter.family = family;
    if (state === 'free') {
      filter.assignedTo = null;
      filter.reserved = false;
    } else if (state === 'assigned') {
      filter.assignedTo = { $ne: null };
    } else if (state === 'reserved') {
      filter.reserved = true;
      filter.assignedTo = null;
    }

    const [rows, total] = await Promise.all([
      IpAddress.find(filter).sort({ family: 1, sortKey: 1 }).skip(skip).limit(limit).lean(),
      IpAddress.countDocuments(filter),
    ]);

    // Resolve who holds each assigned address, in one pass.
    const assignedIds = rows.filter((r: any) => r.assignedTo).map((r: any) => r.assignedTo);
    const holders = assignedIds.length
      ? await VlanInterface.find({ _id: { $in: assignedIds } })
          .populate({
            path: 'virtualInterface',
            select: 'organization name',
            populate: { path: 'organization', select: 'name asn' },
          })
          .select('virtualInterface')
          .lean()
      : [];
    const holderById = new Map(holders.map((h: any) => [String(h._id), h]));

    ok(res, {
      total,
      skip,
      limit,
      addresses: rows.map((r: any) => {
        const holder: any = r.assignedTo ? holderById.get(String(r.assignedTo)) : null;
        const org = holder?.virtualInterface?.organization;
        return {
          ...r,
          holder: org ? { id: String(org._id), name: org.name, asn: org.asn } : null,
        };
      }),
    });
  } catch {
    bad(res, 'Failed to load addresses.', 500);
  }
};

/** Reserve or un-reserve an address (RS address, gateway, anycast, DNS). */
export const setAddressReserved = async (req: Request, res: Response): Promise<void> => {
  try {
    const reserved = req.body?.reserved !== false;
    const label = str(req.body?.label) || '';

    const address = await IpAddress.findOne({ _id: req.params.addressId, vlan: req.params.id });
    if (!address) return bad(res, 'Address not found.', 404);
    if (address.assignedTo) {
      return bad(res, 'This address is assigned to a peer, so it cannot be reserved. Release it first.');
    }

    await ipam.setReserved(address._id as any, reserved, label);
    await logAudit({
      actor: req.user?.email,
      action: reserved ? 'vlan.address.reserve' : 'vlan.address.unreserve',
      resource: 'IpAddress',
      resourceId: String(address._id),
      after: { address: address.address, label },
    });
    ok(res, await IpAddress.findById(address._id).lean());
  } catch {
    bad(res, 'Failed to update the address.', 500);
  }
};

export default {
  listVlans,
  createVlan,
  updateVlan,
  deleteVlan,
  poolStats,
  seedPool,
  listAddresses,
  setAddressReserved,
};
