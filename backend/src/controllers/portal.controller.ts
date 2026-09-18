import { Request, Response } from 'express';
import { Port, Incident } from '../models';
import config from '../config/environment';

const LG_BASE = config.lgApiUrl.replace(/\/$/, '');

/** Default upstream timeout. Short on purpose: a stalled RS must not stall the page. */
const LG_TIMEOUT_MS = 3000;

/**
 * In-process cache for Alice-LG responses.
 *
 * The route-server list and neighbour tables barely change between polls, yet
 * they were being refetched on every page load, every route-filter switch and
 * every pagination click — each one a remote round trip. Caching them for a few
 * seconds is what takes this page from tens of seconds to sub-second.
 *
 * `inflight` additionally collapses concurrent requests for the same path so a
 * burst of calls costs one upstream fetch, not N.
 */
const LG_TTL_MS = 30_000;
const lgCache = new Map<string, { at: number; payload: any }>();
const lgInflight = new Map<string, Promise<any>>();

/**
 * Fetch JSON from the upstream Alice-LG API with a timeout, served from a short
 * TTL cache when possible.
 */
async function lgFetch<T = any>(
  path: string,
  timeoutMs = LG_TIMEOUT_MS,
  opts: { noCache?: boolean } = {}
): Promise<T | null> {
  if (!opts.noCache) {
    const hit = lgCache.get(path);
    if (hit && Date.now() - hit.at < LG_TTL_MS) return hit.payload as T;

    const pending = lgInflight.get(path);
    if (pending) return (await pending) as T;
  }

  const run = (async (): Promise<T | null> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const r = await fetch(`${LG_BASE}${path}`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!r.ok) return null;
      const payload = (await r.json()) as T;
      // Only successful payloads are cached; a failure should retry immediately.
      lgCache.set(path, { at: Date.now(), payload });
      return payload;
    } catch {
      return null;
    } finally {
      lgInflight.delete(path);
    }
  })();

  lgInflight.set(path, run);
  return run;
}

/** Neighbour list for one route server (cached). */
async function lgNeighbors(rsId: string, timeoutMs = LG_TIMEOUT_MS): Promise<any[]> {
  const resp = await lgFetch<{ neighbors?: any[]; neighbours?: any[] }>(
    `/routeservers/${encodeURIComponent(rsId)}/neighbors`,
    timeoutMs
  );
  return resp?.neighbors || resp?.neighbours || [];
}

/**
 * Collect every neighbor across all route servers whose ASN matches the org.
 * `reachable` is false only when the route-server list itself can't be fetched,
 * so one dead RS degrades to fewer sessions instead of an error state.
 */
async function getScopedNeighbors(asns: number[], timeoutMs = LG_TIMEOUT_MS): Promise<{
  routeservers: any[];
  sessions: any[];
  reachable: boolean;
}> {
  const rsResp = await lgFetch<{ routeservers?: any[] }>('/routeservers', timeoutMs);
  if (!rsResp) return { routeservers: [], sessions: [], reachable: false };

  const routeservers = rsResp.routeservers || [];
  const asnSet = new Set(asns);
  const sessions: any[] = [];

  await Promise.all(
    routeservers.map(async (rs: any) => {
      const neighbors = await lgNeighbors(rs.id, timeoutMs);
      neighbors
        .filter((n: any) => asnSet.has(Number(n.asn)))
        .forEach((n: any) => {
          sessions.push({
            routeserverId: rs.id,
            routeserver: rs.name || rs.id,
            neighborId: n.id,
            address: n.address,
            asn: n.asn,
            state: n.state,
            description: n.description,
            routesReceived: n.routes_received ?? n.routes_accepted ?? 0,
            routesFiltered: n.routes_filtered ?? 0,
            routesExported: n.routes_exported ?? 0,
            uptime: n.uptime,
            lastError: n.last_error,
          });
        });
    })
  );

  return { routeservers, sessions, reachable: true };
}

/**
 * GET /api/portal/overview
 * At-a-glance dashboard data scoped to the authenticated organization.
 */
export const getOverview = async (req: Request, res: Response): Promise<void> => {
  try {
    const org = req.organization!;
    const asns = org.asn || org.additionalAsns?.length
      ? [org.asn, ...(org.additionalAsns || [])].filter(Boolean) as number[]
      : [];

    const ports = await Port.find({ organization: org._id }).sort({ order: 1, name: 1 });
    const activePorts = ports.filter((p) => p.status === 'active').length;

    // Incidents affecting the member (open incidents)
    const openIncidents = await Incident.find({ status: { $ne: 'resolved' } })
      .sort({ createdAt: -1 })
      .limit(5);

    // Peering session counts are loaded lazily by the client (separate call to
    // /portal/peering/sessions) so the dashboard never blocks on Alice-LG.
    res.json({
      success: true,
      data: {
        organization: {
          name: org.name,
          asn: org.asn,
          additionalAsns: org.additionalAsns,
          status: org.status,
          peeringPolicy: org.peeringPolicy,
        },
        cards: {
          ports: ports.length,
          activePorts,
          asns: asns.length,
          peeringSessions: null,
          sessionsUp: null,
          openIncidents: openIncidents.length,
        },
        ports: ports.map((p) => ({
          id: p._id,
          name: p.name,
          location: p.location,
          speed: p.speed,
          status: p.status,
        })),
        incidents: openIncidents.map((i) => ({
          id: i._id,
          title: i.title,
          status: i.status,
          impact: i.impact,
          startedAt: i.startedAt,
        })),
      },
    });
  } catch (error) {
    console.error('Portal overview error:', error);
    res.status(500).json({ success: false, error: 'Failed to load overview.' });
  }
};

/**
 * GET /api/portal/ports
 * The organization's ports.
 */
export const getPorts = async (req: Request, res: Response): Promise<void> => {
  try {
    const ports = await Port.find({ organization: req.organization!._id }).sort({ order: 1, name: 1 });
    res.json({ success: true, data: ports });
  } catch (error) {
    console.error('Portal ports error:', error);
    res.status(500).json({ success: false, error: 'Failed to load ports.' });
  }
};

/**
 * GET /api/portal/peering/sessions
 * Route-server session status scoped to the org's ASN(s), from our Alice-LG.
 */
export const getPeeringSessions = async (req: Request, res: Response): Promise<void> => {
  try {
    const org = req.organization!;
    const asns = [org.asn, ...(org.additionalAsns || [])].filter(Boolean) as number[];

    if (!asns.length) {
      res.json({ success: true, data: { asns: [], sessions: [], lgReachable: true } });
      return;
    }

    // Single pass: the route-server list doubles as the reachability probe.
    const scoped = await getScopedNeighbors(asns);
    res.json({
      success: true,
      data: { asns, sessions: scoped.sessions, lgReachable: scoped.reachable },
    });
  } catch (error) {
    console.error('Portal peering error:', error);
    res.status(500).json({ success: false, error: 'Failed to load peering sessions.' });
  }
};

/**
 * GET /api/portal/peering/routes/:rsId/:neighborId/:filter?
 * Prefixes (received | filtered | not-exported) for one of the member's sessions.
 * Verifies the neighbor belongs to the org's ASN before returning data.
 */
export const getPeeringRoutes = async (req: Request, res: Response): Promise<void> => {
  try {
    const org = req.organization!;
    const asns = new Set([org.asn, ...(org.additionalAsns || [])].filter(Boolean) as number[]);
    const { rsId, neighborId } = req.params;
    const rsIdStr = String(rsId);
    const neighborIdStr = String(neighborId);
    const rawFilter = String(req.params.filter || 'received');
    const filter = ['received', 'filtered', 'not-exported'].includes(rawFilter) ? rawFilter : 'received';

    // Ownership check: the neighbor must belong to this org's ASN.
    // Served from the neighbour cache, so paging/filtering doesn't re-fetch the
    // whole table on every click.
    const neighbors = await lgNeighbors(rsIdStr);
    const neighbor = neighbors.find((n: any) => String(n.id) === neighborIdStr);
    if (!neighbor || !asns.has(Number(neighbor.asn))) {
      res.status(403).json({ success: false, error: 'This session does not belong to your network.' });
      return;
    }

    // Forward pagination + prefix filter to Alice-LG.
    const page = Math.max(0, parseInt(String(req.query.page || '0'), 10) || 0);
    const q = String(req.query.q || '').trim();
    const routesPath =
      `/routeservers/${encodeURIComponent(rsIdStr)}/neighbors/${encodeURIComponent(neighborIdStr)}/routes/${filter}` +
      `?page=${page}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
    const routes = await lgFetch(routesPath);
    if (!routes) {
      res.status(502).json({ success: false, error: 'Could not reach the Looking Glass backend.' });
      return;
    }
    res.json({ success: true, data: routes });
  } catch (error) {
    console.error('Portal peering routes error:', error);
    res.status(500).json({ success: false, error: 'Failed to load routes.' });
  }
};

export default { getOverview, getPorts, getPeeringSessions, getPeeringRoutes };
