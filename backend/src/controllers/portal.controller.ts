import { Request, Response } from 'express';
import { Port, Incident } from '../models';
import config from '../config/environment';

const LG_BASE = config.lgApiUrl.replace(/\/$/, '');

/** Fetch JSON from the upstream Alice-LG API with a timeout. */
async function lgFetch<T = any>(path: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const r = await fetch(`${LG_BASE}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/** Collect every neighbor across all route servers whose ASN matches the org. */
async function getScopedNeighbors(asns: number[]): Promise<{
  routeservers: any[];
  sessions: any[];
}> {
  const rsResp = await lgFetch<{ routeservers?: any[] }>('/routeservers');
  const routeservers = rsResp?.routeservers || [];
  const asnSet = new Set(asns);
  const sessions: any[] = [];

  await Promise.all(
    routeservers.map(async (rs: any) => {
      const nResp = await lgFetch<{ neighbors?: any[]; neighbours?: any[] }>(
        `/routeservers/${encodeURIComponent(rs.id)}/neighbors`
      );
      const neighbors = nResp?.neighbors || nResp?.neighbours || [];
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

  return { routeservers, sessions };
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

    // Scoped peering sessions (best-effort; LG may be unreachable)
    let sessions: any[] = [];
    if (asns.length) {
      try {
        const scoped = await getScopedNeighbors(asns);
        sessions = scoped.sessions;
      } catch {
        sessions = [];
      }
    }
    const upSessions = sessions.filter((s) => String(s.state).toLowerCase() === 'up').length;

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
          peeringSessions: sessions.length,
          sessionsUp: upSessions,
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

    const rsResp = await lgFetch<{ routeservers?: any[] }>('/routeservers');
    if (!rsResp) {
      res.json({ success: true, data: { asns, sessions: [], lgReachable: false } });
      return;
    }

    const scoped = await getScopedNeighbors(asns);
    res.json({ success: true, data: { asns, sessions: scoped.sessions, lgReachable: true } });
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

    // Ownership check: the neighbor must belong to this org's ASN
    const nResp = await lgFetch<{ neighbors?: any[]; neighbours?: any[] }>(
      `/routeservers/${encodeURIComponent(rsIdStr)}/neighbors`
    );
    const neighbors = nResp?.neighbors || nResp?.neighbours || [];
    const neighbor = neighbors.find((n: any) => String(n.id) === neighborIdStr);
    if (!neighbor || !asns.has(Number(neighbor.asn))) {
      res.status(403).json({ success: false, error: 'This session does not belong to your network.' });
      return;
    }

    const routes = await lgFetch(
      `/routeservers/${encodeURIComponent(rsIdStr)}/neighbors/${encodeURIComponent(neighborIdStr)}/routes/${filter}`
    );
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
