import { Request, Response } from 'express';
import { RouteServer, Infrastructure, Vlan, BirdDeployment } from '../models';
import { buildConfig } from '../services/birdConfig.service';
import birdDeploy from '../services/birdDeploy.service';
import irrdb from '../services/irrdb.service';
import { logAudit } from '../services/audit.service';
import { normalizeCidr } from '../utils/ip.util';
import { pick, str, int, bool, objectId, param, Validator } from '../utils/validate.util';

/**
 * Route-server administration: config generation, deployment, history and the
 * IRRDB cache that feeds the prefix filters.
 *
 * ## Field-level authorisation
 *
 * Route servers carry two very different kinds of setting. Peering policy
 * (max-prefix defaults, RPKI, blackholing) is day-to-day NOC work. The
 * *transport* settings — where config is written, which host to SSH to, whether
 * to use sudo — decide what this backend executes and where, so they are
 * restricted to super-admins even though the rest of the router is open to NOC.
 */

const ok = (res: Response, data: any, status = 200): void => {
  res.status(status).json({ success: true, data });
};
const bad = (res: Response, error: string, status = 400): void => {
  res.status(status).json({ success: false, error });
};

/** Settings a NOC operator may change. */
const RS_POLICY_FIELDS = [
  'name',
  'group',
  'location',
  'order',
  'enabled',
  'backend',
  'apiUrl',
  'birdwatcherType',
  'infrastructure',
  'vlan',
  'family',
  'asn',
  'routerId',
  'ipv4',
  'ipv6',
  'peerGroup',
  'software',
  'rpkiEnabled',
  'rtrServer',
  'rtrPort',
  'irrdbFailOpen',
  'blackholeEnabled',
  'blackholeNextHopV4',
  'blackholeNextHopV6',
  'maxPrefixLengthV4',
  'minPrefixLengthV4',
  'maxPrefixLengthV6',
  'minPrefixLengthV6',
  'defaultMaxPrefixesV4',
  'defaultMaxPrefixesV6',
  'configExtras',
  'configHeaderExtras',
] as const;

/**
 * Settings that determine what gets executed and where. Super-admin only.
 */
const RS_DEPLOY_FIELDS = [
  'deployMethod',
  'configPath',
  'birdSocket',
  'reloadStrategy',
  'systemdUnit',
  'useSudo',
  'sshHost',
  'sshPort',
  'sshUser',
  'sshKeyPath',
  'agentUrl',
  'agentToken',
] as const;

const isSuperAdmin = (req: Request): boolean => req.user?.role === 'super-admin';

/** Reject deploy-transport edits from anyone but a super-admin. */
const guardDeployFields = (req: Request): string | null => {
  const touched = RS_DEPLOY_FIELDS.filter((f) => Object.prototype.hasOwnProperty.call(req.body || {}, f));
  if (!touched.length) return null;
  if (isSuperAdmin(req)) return null;
  return `Changing ${touched.join(', ')} requires a super-admin, because these settings control what the backend runs and on which host.`;
};

// ══════════════════════════════════════════════════════════════════════════════
// Route servers
// ══════════════════════════════════════════════════════════════════════════════

export const listRouteServers = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: any = {};
    const infra = objectId(req.query?.infrastructure);
    if (infra) filter.infrastructure = infra;

    const rows = await RouteServer.find(filter)
      .populate('infrastructure', 'name shortname asn')
      .populate('vlan', 'name number')
      .sort({ order: 1, name: 1 })
      .lean();

    // Never return the agent token, even though it is select:false — a stray
    // .select('+agentToken') elsewhere shouldn't leak through this endpoint.
    ok(
      res,
      rows.map((r: any) => {
        const { agentToken, ...rest } = r;
        return { ...rest, agentTokenSet: !!agentToken };
      })
    );
  } catch {
    bad(res, 'Failed to load route servers.', 500);
  }
};

export const createRouteServer = async (req: Request, res: Response): Promise<void> => {
  try {
    const denied = guardDeployFields(req);
    if (denied) return bad(res, denied, 403);

    const v = new Validator();
    const name = v.require(str(req.body?.name), 'Name');
    const apiUrl = v.require(str(req.body?.apiUrl), 'Looking-glass API URL');
    if (v.failed) return bad(res, v.message);

    const payload = {
      ...pick(req.body, RS_POLICY_FIELDS),
      ...(isSuperAdmin(req) ? pick(req.body, RS_DEPLOY_FIELDS) : {}),
    } as Record<string, any>;
    payload.name = name;
    payload.apiUrl = apiUrl;

    const created = await RouteServer.create(payload);
    await logAudit({
      actor: req.user?.email,
      action: 'bird.routeserver.create',
      resource: 'RouteServer',
      resourceId: String(created._id),
      after: { name: created.name, deployMethod: created.deployMethod },
    });
    ok(res, created, 201);
  } catch {
    bad(res, 'Failed to create the route server.', 500);
  }
};

export const updateRouteServer = async (req: Request, res: Response): Promise<void> => {
  try {
    const denied = guardDeployFields(req);
    if (denied) return bad(res, denied, 403);

    const before = await RouteServer.findById(req.params.id).lean();
    if (!before) return bad(res, 'Route server not found.', 404);

    const payload = {
      ...pick(req.body, RS_POLICY_FIELDS),
      ...(isSuperAdmin(req) ? pick(req.body, RS_DEPLOY_FIELDS) : {}),
    } as Record<string, any>;

    const updated = await RouteServer.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true });

    // Record what changed, minus the token itself.
    const audited = { ...payload };
    if (audited.agentToken) audited.agentToken = '(changed)';
    await logAudit({
      actor: req.user?.email,
      action: 'bird.routeserver.update',
      resource: 'RouteServer',
      resourceId: String(req.params.id),
      before: { name: (before as any).name, deployMethod: (before as any).deployMethod },
      after: audited,
    });
    ok(res, updated);
  } catch {
    bad(res, 'Failed to update the route server.', 500);
  }
};

export const deleteRouteServer = async (req: Request, res: Response): Promise<void> => {
  try {
    await BirdDeployment.deleteMany({ routeServer: req.params.id });
    await RouteServer.findByIdAndDelete(req.params.id);
    await logAudit({
      actor: req.user?.email,
      action: 'bird.routeserver.delete',
      resource: 'RouteServer',
      resourceId: String(req.params.id),
    });
    ok(res, { deleted: true });
  } catch {
    bad(res, 'Failed to delete the route server.', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// Config generation & deployment
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Generate the config without touching anything.
 *
 * Secrets are redacted by default because this response is rendered in a
 * browser. A super-admin can ask for the real thing when they need to install it
 * by hand on a manual route server.
 */
export const previewConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const wantSecrets = bool(req.query?.includeSecrets) === true;
    if (wantSecrets && !isSuperAdmin(req)) {
      return bad(res, 'Only a super-admin may view the config with BGP session passwords included.', 403);
    }

    const build = await buildConfig(param(req.params.id), { redactSecrets: !wantSecrets });
    const rs = await RouteServer.findById(req.params.id).select('deployMethod configPath lastDeployedAt lastDeployHash').lean();

    if (wantSecrets) {
      await logAudit({
        actor: req.user?.email,
        action: 'bird.config.reveal_secrets',
        resource: 'RouteServer',
        resourceId: String(req.params.id),
      });
    }

    ok(res, {
      ...build,
      secretsRedacted: !wantSecrets,
      deployMethod: (rs as any)?.deployMethod || 'manual',
      configPath: (rs as any)?.configPath || null,
      lastDeployedAt: (rs as any)?.lastDeployedAt || null,
      // Lets the UI show "already deployed" without a second request.
      matchesDeployed: !!(rs as any)?.lastDeployHash && (rs as any).lastDeployHash === build.configHash,
    });
  } catch (err: any) {
    bad(res, err?.message || 'Failed to generate the config.', /not found/i.test(err?.message || '') ? 404 : 500);
  }
};

export const deployOne = async (req: Request, res: Response): Promise<void> => {
  try {
    const force = bool(req.body?.force) === true;
    const dryRun = bool(req.body?.dryRun) === true;

    // Forcing past the "no peers" and "identical config" guards can drop every
    // session on the box, so it needs the higher role.
    if (force && !isSuperAdmin(req)) {
      return bad(res, 'Only a super-admin may force a deploy past the safety checks.', 403);
    }

    const result = await birdDeploy.deployRouteServer(param(req.params.id), {
      actor: req.user?.email,
      force,
      dryRun,
    });
    ok(res, result);
  } catch (err: any) {
    bad(res, err?.message || 'Deployment failed.', /not found/i.test(err?.message || '') ? 404 : 500);
  }
};

/** Push to every enabled route server on one infrastructure, one at a time. */
export const deployInfrastructure = async (req: Request, res: Response): Promise<void> => {
  try {
    const force = bool(req.body?.force) === true;
    if (force && !isSuperAdmin(req)) {
      return bad(res, 'Only a super-admin may force a deploy past the safety checks.', 403);
    }
    const results = await birdDeploy.deployInfrastructure(param(req.params.id), { actor: req.user?.email, force });
    ok(res, {
      results,
      applied: results.filter((r) => r.applied).length,
      failed: results.filter((r) => r.error).length,
      skipped: results.filter((r) => r.skipped).length,
    });
  } catch (err: any) {
    bad(res, err?.message || 'Deployment failed.', 500);
  }
};

export const deployAll = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isSuperAdmin(req)) {
      return bad(res, 'Only a super-admin may deploy to every route server at once.', 403);
    }
    const results = await birdDeploy.deployAll({ actor: req.user?.email, force: bool(req.body?.force) === true });
    ok(res, {
      results,
      applied: results.filter((r) => r.applied).length,
      failed: results.filter((r) => r.error).length,
      skipped: results.filter((r) => r.skipped).length,
    });
  } catch (err: any) {
    bad(res, err?.message || 'Deployment failed.', 500);
  }
};

export const deploymentHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = int(req.query?.limit, { min: 1, max: 200 }) ?? 25;
    ok(res, await birdDeploy.getDeploymentHistory(param(req.params.id), limit));
  } catch {
    bad(res, 'Failed to load deployment history.', 500);
  }
};

/** Full config text of a past deployment, for diffing. Secrets are stripped. */
export const getDeployment = async (req: Request, res: Response): Promise<void> => {
  try {
    const deployment = await BirdDeployment.findById(req.params.deploymentId).lean();
    if (!deployment) return bad(res, 'Deployment not found.', 404);

    // Stored configs contain real MD5 passwords, so blank them unless the
    // caller is a super-admin who has asked for them.
    const reveal = bool(req.query?.includeSecrets) === true && isSuperAdmin(req);
    const scrub = (text: string): string =>
      reveal ? text : String(text || '').replace(/^(\s*password\s+).*$/gim, '$1"(redacted)";');

    ok(res, {
      ...deployment,
      config: scrub((deployment as any).config),
      previousConfig: scrub((deployment as any).previousConfig),
      secretsRedacted: !reveal,
    });
  } catch {
    bad(res, 'Failed to load the deployment.', 500);
  }
};

export const rollback = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isSuperAdmin(req)) {
      return bad(res, 'Only a super-admin may roll a route server back.', 403);
    }
    const result = await birdDeploy.rollbackDeployment(param(req.params.deploymentId), { actor: req.user?.email });
    ok(res, result);
  } catch (err: any) {
    bad(res, err?.message || 'Rollback failed.', /not found/i.test(err?.message || '') ? 404 : 500);
  }
};

/** Check the transport works before trusting it with a real deploy. */
export const testConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    ok(res, await birdDeploy.testConnection(param(req.params.id)));
  } catch (err: any) {
    bad(res, err?.message || 'Connection test failed.', 500);
  }
};

/**
 * Fabric-wide status board: which route servers are in sync, which have drifted,
 * and how many peers each would carry.
 */
export const status = async (_req: Request, res: Response): Promise<void> => {
  try {
    const servers = await RouteServer.find({ enabled: true })
      .populate('infrastructure', 'name shortname')
      .populate('vlan', 'name number')
      .sort({ order: 1, name: 1 })
      .lean();

    const rows = await Promise.all(
      servers.map(async (rs: any) => {
        const base = {
          id: String(rs._id),
          name: rs.name,
          infrastructure: rs.infrastructure?.name || null,
          vlan: rs.vlan?.name || null,
          family: rs.family,
          deployMethod: rs.deployMethod,
          lastDeployedAt: rs.lastDeployedAt || null,
        };
        // A build failure here is a configuration problem, not an outage, so it
        // is reported per-row rather than failing the whole board.
        if (!rs.infrastructure || !rs.vlan) {
          return { ...base, ready: false, error: 'Not assigned to an infrastructure and peering VLAN yet.' };
        }
        try {
          const build = await buildConfig(rs._id, { redactSecrets: true });
          return {
            ...base,
            ready: true,
            peerCount: build.stats.totalPeers,
            stats: build.stats,
            warningCount: build.warnings.length,
            warnings: build.warnings.slice(0, 10),
            inSync: rs.lastDeployHash === build.configHash,
          };
        } catch (err: any) {
          return { ...base, ready: false, error: err?.message || 'Config build failed.' };
        }
      })
    );

    ok(res, {
      routeServers: rows,
      totals: {
        total: rows.length,
        ready: rows.filter((r: any) => r.ready).length,
        inSync: rows.filter((r: any) => r.inSync).length,
        withWarnings: rows.filter((r: any) => (r as any).warningCount > 0).length,
      },
    });
  } catch {
    bad(res, 'Failed to build the route-server status.', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// IRRDB cache
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Cache overview. Rows flagged `neverExpanded` are the ones that make route
 * servers reject a member's routes, so the UI should lead with them.
 */
export const irrdbStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    ok(res, await irrdb.getCacheStatus());
  } catch (err: any) {
    bad(res, err?.message || 'Failed to read the IRRDB cache status.', 500);
  }
};

export const irrdbRefreshOne = async (req: Request, res: Response): Promise<void> => {
  try {
    const asn = int(req.params.asn, { min: 1, max: 4294967294 });
    if (asn === undefined) return bad(res, 'Invalid ASN.');

    const asMacro = str(req.body?.asMacro);
    const results = await irrdb.refreshAsn(asn, { asMacro });

    await logAudit({
      actor: req.user?.email,
      action: 'irrdb.refresh',
      resource: 'IrrdbPrefix',
      resourceId: String(asn),
      after: { results: results.map((r) => ({ family: r.family, prefixes: r.prefixCount, ok: r.ok })) },
    });
    ok(res, results);
  } catch (err: any) {
    bad(res, err?.message || 'IRRDB refresh failed.', 500);
  }
};

export const irrdbRefreshAll = async (req: Request, res: Response): Promise<void> => {
  try {
    const onlyStale = bool(req.body?.onlyStale) !== false;
    const vlanId = objectId(req.body?.vlanId);
    const limit = int(req.body?.limit, { min: 1, max: 5000 });

    const result = await irrdb.refreshAll({ onlyStale, vlanId, limit });
    await logAudit({
      actor: req.user?.email,
      action: 'irrdb.refresh_all',
      resource: 'IrrdbPrefix',
      after: { attempted: result.attempted, succeeded: result.succeeded, failed: result.failed, skipped: result.skipped },
    });
    ok(res, result);
  } catch (err: any) {
    bad(res, err?.message || 'IRRDB refresh failed.', 500);
  }
};

/** Cached prefixes for one ASN, so an operator can see exactly what is filtered. */
export const irrdbGetAsn = async (req: Request, res: Response): Promise<void> => {
  try {
    const asn = int(req.params.asn, { min: 1, max: 4294967294 });
    if (asn === undefined) return bad(res, 'Invalid ASN.');
    ok(res, await irrdb.getCached(asn));
  } catch {
    bad(res, 'Failed to load the cached prefixes.', 500);
  }
};

/** Hand-maintained prefix list, for members whose IRR records are wrong. */
export const irrdbSetManual = async (req: Request, res: Response): Promise<void> => {
  try {
    const asn = int(req.params.asn, { min: 1, max: 4294967294 });
    if (asn === undefined) return bad(res, 'Invalid ASN.');

    const family = int(req.body?.family, { min: 4, max: 6 });
    if (family !== 4 && family !== 6) return bad(res, 'Family must be 4 or 6.');

    if (!Array.isArray(req.body?.prefixes)) return bad(res, 'prefixes must be a list.');

    // Validate every prefix before storing — these go straight into a filter.
    const parsed: Array<{ prefix: string; maxLength?: number }> = [];
    for (const entry of req.body.prefixes) {
      const raw = typeof entry === 'string' ? entry : str(entry?.prefix);
      if (!raw) continue;
      let normalised: string;
      try {
        normalised = normalizeCidr(raw);
      } catch (err: any) {
        return bad(res, `Invalid prefix "${raw}": ${err?.message}`);
      }
      const isV6 = normalised.includes(':');
      if ((family === 4 && isV6) || (family === 6 && !isV6)) {
        return bad(res, `Prefix "${normalised}" is not IPv${family}.`);
      }
      const maxLength = int(entry?.maxLength, { min: 1, max: family === 4 ? 32 : 128 });
      parsed.push(maxLength === undefined ? { prefix: normalised } : { prefix: normalised, maxLength });
    }

    await irrdb.setManualPrefixes(asn, family as 4 | 6, parsed);
    await logAudit({
      actor: req.user?.email,
      action: 'irrdb.set_manual',
      resource: 'IrrdbPrefix',
      resourceId: String(asn),
      after: { family, count: parsed.length },
    });
    ok(res, { asn, family, count: parsed.length });
  } catch (err: any) {
    bad(res, err?.message || 'Failed to store the prefixes.', 500);
  }
};

export default {
  listRouteServers,
  createRouteServer,
  updateRouteServer,
  deleteRouteServer,
  previewConfig,
  deployOne,
  deployInfrastructure,
  deployAll,
  deploymentHistory,
  getDeployment,
  rollback,
  testConnection,
  status,
  irrdbStatus,
  irrdbRefreshOne,
  irrdbRefreshAll,
  irrdbGetAsn,
  irrdbSetManual,
};
