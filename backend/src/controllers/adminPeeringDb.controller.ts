import { Request, Response } from 'express';
import { Organization, Infrastructure, Vlan, VlanInterface, VirtualInterface, IpAddress } from '../models';
import peeringdb from '../services/peeringdb.service';
import { getEffectivePeeringDb } from '../models/settings.model';
import { logAudit } from '../services/audit.service';
import { str, int, bool, objectId } from '../utils/validate.util';

/**
 * PeeringDB integration.
 *
 * Two jobs: fill in a member's details so an operator doesn't retype what
 * PeeringDB already knows, and compare PeeringDB's view of our IX against what
 * we have actually provisioned.
 */

const ok = (res: Response, data: any, status = 200): void => {
  res.status(status).json({ success: true, data });
};
const bad = (res: Response, error: string, status = 400): void => {
  res.status(status).json({ success: false, error });
};

export const status = async (_req: Request, res: Response): Promise<void> => {
  try {
    const cfg = await getEffectivePeeringDb();
    const test = await peeringdb.testConnection();
    ok(res, {
      configured: cfg.enabled,
      connected: test.ok,
      authenticated: test.ok ? !!test.data?.authenticated : false,
      anonymous: !cfg.enabled && test.ok,
      baseUrl: cfg.baseUrl || 'https://www.peeringdb.com/api',
      cacheTtlMinutes: cfg.cacheTtlMinutes || 60,
      error: test.error,
    });
  } catch (err: any) {
    bad(res, err?.message || 'Failed to query PeeringDB.', 500);
  }
};

/** Look up a network by ASN — used by the "add customer" form. */
export const lookupAsn = async (req: Request, res: Response): Promise<void> => {
  try {
    const asn = int(req.params.asn, { min: 1, max: 4294967294 });
    if (asn === undefined) return bad(res, 'Invalid ASN.');

    const result = await peeringdb.getNetByAsn(asn, { noCache: bool(req.query?.refresh) === true });
    if (!result.ok) return bad(res, result.error || 'PeeringDB lookup failed.', result.status === 429 ? 429 : 502);
    if (!result.data) return bad(res, `PeeringDB has no network registered for AS${asn}.`, 404);

    const net = result.data;
    const cfg = await getEffectivePeeringDb();

    // Flag an existing customer so the UI can offer "link" instead of "create".
    const existing = await Organization.findOne({
      $or: [{ peeringdbNetId: net.id }, { asn }, { additionalAsns: asn }],
    })
      .select('name asn peeringdbNetId')
      .lean();

    ok(res, {
      net,
      // The exact patch a sync would apply, so the operator can see it first.
      proposedPatch: peeringdb.mapNetToOrganization(net, {
        syncMaxPrefixes: cfg.syncMaxPrefixes,
        syncIrrAsSet: cfg.syncIrrAsSet,
      }),
      existingOrganization: existing
        ? { id: String(existing._id), name: existing.name, asn: existing.asn, linked: !!existing.peeringdbNetId }
        : null,
      ixPresence: (net.netixlan_set || []).map((n) => ({
        ixId: n.ix_id,
        ixLanId: n.ixlan_id,
        name: n.name,
        ipv4: n.ipaddr4,
        ipv6: n.ipaddr6,
        speed: n.speed,
        isRsPeer: n.is_rs_peer,
        operational: n.operational,
      })),
      facilities: (net.netfac_set || []).map((f) => ({ facId: f.fac_id, name: f.name, city: f.city, country: f.country })),
    });
  } catch (err: any) {
    bad(res, err?.message || 'PeeringDB lookup failed.', 500);
  }
};

/**
 * Pull PeeringDB data onto an existing customer.
 *
 * The customer's name is left alone by default: operators often use a shorter
 * internal name, and having a sync silently rename accounts is worse than having
 * to copy one field.
 */
export const syncOrganization = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = objectId(req.params.orgId);
    if (!orgId) return bad(res, 'Invalid customer id.');

    const org = await Organization.findById(orgId);
    if (!org) return bad(res, 'Customer not found.', 404);

    const cfg = await getEffectivePeeringDb();
    if (!cfg.enabled) return bad(res, 'PeeringDB is not enabled in Settings.');

    const asn = int(req.body?.asn, { min: 1 }) ?? org.asn;
    if (!asn) return bad(res, 'This customer has no ASN, and none was supplied.');

    const result = await peeringdb.getNetByAsn(asn, { noCache: true });
    if (!result.ok) return bad(res, result.error || 'PeeringDB lookup failed.', result.status === 429 ? 429 : 502);
    if (!result.data) return bad(res, `PeeringDB has no network registered for AS${asn}.`, 404);

    const patch = peeringdb.mapNetToOrganization(result.data, {
      syncMaxPrefixes: cfg.syncMaxPrefixes,
      syncIrrAsSet: cfg.syncIrrAsSet,
    });

    if (bool(req.body?.overwriteName) !== true) delete patch.name;

    const before = {
      irrAsSet: org.irrAsSet,
      infoPrefixes4: org.infoPrefixes4,
      infoPrefixes6: org.infoPrefixes6,
      peeringPolicy: org.peeringPolicy,
      peeringdbNetId: org.peeringdbNetId,
    };

    await Organization.updateOne({ _id: org._id }, { $set: patch });

    await logAudit({
      actor: req.user?.email,
      action: 'peeringdb.sync_org',
      resource: 'Organization',
      resourceId: String(org._id),
      before,
      after: patch,
    });

    ok(res, { organization: await Organization.findById(org._id).lean(), applied: patch });
  } catch (err: any) {
    bad(res, err?.message || 'PeeringDB sync failed.', 500);
  }
};

/**
 * Refresh every customer that is already linked to PeeringDB.
 *
 * Sequential on purpose — PeeringDB rate-limits aggressively, and a fabric with
 * a few hundred members would otherwise trip the limiter part-way through and
 * leave half the accounts updated.
 */
export const syncAll = async (req: Request, res: Response): Promise<void> => {
  try {
    const cfg = await getEffectivePeeringDb();
    if (!cfg.enabled) return bad(res, 'PeeringDB is not enabled in Settings.');

    const orgs = await Organization.find({ asn: { $ne: null }, status: { $ne: 'suspended' } })
      .select('name asn')
      .lean();

    const results: Array<{ id: string; name: string; asn: number; ok: boolean; error?: string }> = [];
    for (const org of orgs as any[]) {
      const net = await peeringdb.getNetByAsn(org.asn);
      if (!net.ok) {
        results.push({ id: String(org._id), name: org.name, asn: org.asn, ok: false, error: net.error });
        // A rate limit will not clear on the next request, so stop rather than
        // hammering through the rest of the list.
        if (net.status === 429) break;
        continue;
      }
      if (!net.data) {
        results.push({ id: String(org._id), name: org.name, asn: org.asn, ok: false, error: 'Not in PeeringDB' });
        continue;
      }
      const patch = peeringdb.mapNetToOrganization(net.data, {
        syncMaxPrefixes: cfg.syncMaxPrefixes,
        syncIrrAsSet: cfg.syncIrrAsSet,
      });
      delete patch.name;
      await Organization.updateOne({ _id: org._id }, { $set: patch });
      results.push({ id: String(org._id), name: org.name, asn: org.asn, ok: true });
    }

    await logAudit({
      actor: req.user?.email,
      action: 'peeringdb.sync_all',
      resource: 'Organization',
      after: { attempted: results.length, succeeded: results.filter((r) => r.ok).length },
    });

    ok(res, {
      attempted: results.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      total: orgs.length,
      results,
    });
  } catch (err: any) {
    bad(res, err?.message || 'PeeringDB sync failed.', 500);
  }
};

/**
 * Compare PeeringDB's participant list for one of our IX LANs against what we
 * have provisioned.
 *
 * Three things worth acting on: members whose PeeringDB address does not match
 * the address we assigned (their traceroutes and ACLs will be wrong), networks
 * claiming a presence they never provisioned, and members we host who have not
 * registered with us in PeeringDB.
 */
export const participantDiff = async (req: Request, res: Response): Promise<void> => {
  try {
    const infraId = objectId(req.params.infrastructureId);
    if (!infraId) return bad(res, 'Invalid infrastructure id.');

    const infra = await Infrastructure.findById(infraId).lean();
    if (!infra) return bad(res, 'Infrastructure not found.', 404);

    const ixLanId = int(req.query?.ixLanId, { min: 1 }) ?? (infra as any).peeringdbIxLanId;
    if (!ixLanId) {
      return bad(
        res,
        'This infrastructure has no PeeringDB ixlan id set. Add it on the infrastructure, or pass ixLanId.'
      );
    }

    const remote = await peeringdb.getIxLanParticipants(ixLanId);
    if (!remote.ok) return bad(res, remote.error || 'PeeringDB lookup failed.', remote.status === 429 ? 429 : 502);

    // Our own view: every peer on a non-private VLAN of this fabric.
    const vlans = await Vlan.find({ infrastructure: infraId, isPrivate: false }).select('_id name number').lean();
    const vlanIds = vlans.map((v: any) => v._id);

    const vlis = await VlanInterface.find({ vlan: { $in: vlanIds }, enabled: true })
      .select('virtualInterface ipv4Address ipv6Address rsClient')
      .lean();
    const vis = await VirtualInterface.find({ _id: { $in: vlis.map((v: any) => v.virtualInterface) } })
      .select('organization')
      .lean();
    const viById = new Map(vis.map((v: any) => [String(v._id), v]));
    const orgs = await Organization.find({ _id: { $in: vis.map((v: any) => v.organization) } })
      .select('name asn')
      .lean();
    const orgById = new Map(orgs.map((o: any) => [String(o._id), o]));

    const addrIds = vlis.flatMap((v: any) => [v.ipv4Address, v.ipv6Address]).filter(Boolean);
    const addrs = addrIds.length ? await IpAddress.find({ _id: { $in: addrIds } }).select('address').lean() : [];
    const addrById = new Map(addrs.map((a: any) => [String(a._id), a.address]));

    const localByAsn = new Map<number, { name: string; ipv4?: string; ipv6?: string; rsClient: boolean }>();
    for (const vli of vlis as any[]) {
      const vi = viById.get(String(vli.virtualInterface));
      if (!vi) continue;
      const org = orgById.get(String(vi.organization));
      if (!org?.asn) continue;
      localByAsn.set(Number(org.asn), {
        name: org.name,
        ipv4: vli.ipv4Address ? addrById.get(String(vli.ipv4Address)) : undefined,
        ipv6: vli.ipv6Address ? addrById.get(String(vli.ipv6Address)) : undefined,
        rsClient: !!vli.rsClient,
      });
    }

    const remoteList = remote.data || [];
    const mismatched: any[] = [];
    const notProvisioned: any[] = [];
    const matched: any[] = [];

    for (const entry of remoteList) {
      const asn = Number(entry.asn);
      const local = localByAsn.get(asn);
      if (!local) {
        notProvisioned.push({ asn, name: entry.name, ipv4: entry.ipaddr4, ipv6: entry.ipaddr6, speed: entry.speed });
        continue;
      }
      const problems: string[] = [];
      if (entry.ipaddr4 && local.ipv4 && entry.ipaddr4 !== local.ipv4) {
        problems.push(`PeeringDB says IPv4 ${entry.ipaddr4}, we assigned ${local.ipv4}`);
      }
      if (entry.ipaddr6 && local.ipv6 && entry.ipaddr6.toLowerCase() !== String(local.ipv6).toLowerCase()) {
        problems.push(`PeeringDB says IPv6 ${entry.ipaddr6}, we assigned ${local.ipv6}`);
      }
      if (entry.is_rs_peer && !local.rsClient) {
        problems.push('PeeringDB says they peer with the route servers, but they are not an RS client here');
      }
      if (problems.length) mismatched.push({ asn, name: local.name, problems });
      else matched.push({ asn, name: local.name });
    }

    const remoteAsns = new Set(remoteList.map((r) => Number(r.asn)));
    const notInPeeringDb = Array.from(localByAsn.entries())
      .filter(([asn]) => !remoteAsns.has(asn))
      .map(([asn, local]) => ({ asn, name: local.name }));

    ok(res, {
      ixLanId,
      counts: {
        peeringDb: remoteList.length,
        local: localByAsn.size,
        matched: matched.length,
        mismatched: mismatched.length,
        notProvisioned: notProvisioned.length,
        notInPeeringDb: notInPeeringDb.length,
      },
      mismatched,
      notProvisioned,
      notInPeeringDb,
      matched,
    });
  } catch (err: any) {
    bad(res, err?.message || 'Comparison failed.', 500);
  }
};

/** Search PeeringDB exchanges, for filling in an infrastructure's ix/ixlan ids. */
export const searchIx = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = str(req.query?.q);
    if (!q) return bad(res, 'A search term is required.');
    const result = await peeringdb.searchIx(q);
    if (!result.ok) return bad(res, result.error || 'PeeringDB search failed.', 502);
    ok(
      res,
      (result.data || []).map((ix) => ({
        id: ix.id,
        name: ix.name,
        nameLong: ix.name_long,
        city: ix.city,
        country: ix.country,
        netCount: ix.net_count,
        ixLans: (ix.ixlan_set || []).map((l) => ({ id: l.id, name: l.name, mtu: l.mtu })),
      }))
    );
  } catch (err: any) {
    bad(res, err?.message || 'PeeringDB search failed.', 500);
  }
};

/** Search PeeringDB facilities, for filling in a facility's peeringdbFacId. */
export const searchFacilities = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = str(req.query?.q);
    if (!q) return bad(res, 'A search term is required.');
    const result = await peeringdb.searchFacilities(q);
    if (!result.ok) return bad(res, result.error || 'PeeringDB search failed.', 502);
    ok(
      res,
      (result.data || []).map((f) => ({
        id: f.id,
        name: f.name,
        address1: f.address1 || '',
        city: f.city,
        country: f.country,
        clli: f.clli,
        npanxx: f.npanxx,
        latitude: f.latitude,
        longitude: f.longitude,
        netCount: f.net_count,
        org_id: f.org_id,
      }))
    );
  } catch (err: any) {
    bad(res, err?.message || 'PeeringDB search failed.', 500);
  }
};

/** Drop the in-process cache, for when PeeringDB has just been corrected. */
export const clearCache = async (req: Request, res: Response): Promise<void> => {
  try {
    peeringdb.clearCache();
    await logAudit({ actor: req.user?.email, action: 'peeringdb.clear_cache', resource: 'PeeringDB' });
    ok(res, { cleared: true });
  } catch {
    bad(res, 'Failed to clear the cache.', 500);
  }
};

export default {
  status,
  lookupAsn,
  syncOrganization,
  syncAll,
  participantDiff,
  searchIx,
  searchFacilities,
  clearCache,
};
