import { Request, Response } from 'express';
import config from '../config/environment';

/**
 * Alice-LG Looking Glass proxy.
 * Forwards read-only requests to the upstream Alice-LG API so the browser
 * avoids CORS issues and the upstream URL stays configurable server-side.
 */

const LG_BASE = config.lgApiUrl.replace(/\/$/, '');

async function proxy(path: string, req: Request, res: Response, label: string) {
  const qs = req.originalUrl.includes('?') ? `?${req.originalUrl.split('?')[1]}` : '';
  const target = `${LG_BASE}${path}${qs}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const upstream = await fetch(target, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await upstream.text();

    if (!upstream.ok) {
      console.warn(`[LG] ${label} -> ${upstream.status} (${target})`);
      return res.status(502).json({
        success: false,
        error: `Looking Glass backend returned ${upstream.status}`,
        upstreamStatus: upstream.status,
      });
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({ success: false, error: 'Invalid response from Looking Glass backend' });
    }

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error(`[LG] ${label} failed:`, error?.message || error);
    return res.status(502).json({
      success: false,
      error:
        error?.name === 'AbortError'
          ? 'Looking Glass request timed out'
          : 'Could not reach the Looking Glass backend',
    });
  }
}

export const getConfig = (req: Request, res: Response) => proxy('/config', req, res, 'config');

export const getRouteservers = (req: Request, res: Response) =>
  proxy('/routeservers', req, res, 'routeservers');

export const getStatus = (req: Request, res: Response) =>
  proxy(`/routeservers/${encodeURIComponent(req.params.id)}/status`, req, res, 'status');

export const getNeighbors = (req: Request, res: Response) =>
  proxy(`/routeservers/${encodeURIComponent(req.params.id)}/neighbors`, req, res, 'neighbors');

export const getRoutes = (req: Request, res: Response) => {
  const { id, neighborId } = req.params;
  // filter: received | filtered | not-exported (default: received)
  const filter = ['received', 'filtered', 'not-exported'].includes(req.params.filter || '')
    ? req.params.filter
    : 'received';
  return proxy(
    `/routeservers/${encodeURIComponent(id)}/neighbors/${encodeURIComponent(neighborId)}/routes/${filter}`,
    req,
    res,
    'routes'
  );
};

export const lookup = (req: Request, res: Response) =>
  proxy('/lookup/prefix', req, res, 'lookup');

export const lookupNeighbors = (req: Request, res: Response) =>
  proxy('/lookup/neighbors', req, res, 'lookup-neighbors');

export default { getConfig, getRouteservers, getStatus, getNeighbors, getRoutes, lookup, lookupNeighbors };
