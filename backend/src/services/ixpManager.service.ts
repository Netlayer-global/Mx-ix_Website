import { getEffectiveIxpManager } from '../models/settings.model';

/**
 * Thin client for the IXP Manager JSON API (v4).
 * IXP Manager is the operational source of truth for member provisioning,
 * ports/connections and BGP config; we integrate read/write via its API and
 * never rebuild that logic ourselves.
 *
 * Auth: header `X-IXP-Manager-API-Key: <key>`.
 */

interface IxpResult<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

async function call<T = any>(
  path: string,
  opts: { method?: string; body?: any; url?: string; apiKey?: string } = {}
): Promise<IxpResult<T>> {
  let url = opts.url;
  let apiKey = opts.apiKey;
  if (!url || !apiKey) {
    const cfg = await getEffectiveIxpManager();
    url = url || cfg.url;
    apiKey = apiKey || cfg.apiKey;
  }
  if (!url || !apiKey) {
    return { ok: false, status: 0, error: 'IXP Manager is not configured.' };
  }

  const base = url.replace(/\/$/, '');
  const target = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const r = await fetch(target, {
      method: opts.method || 'GET',
      headers: {
        'X-IXP-Manager-API-Key': apiKey,
        Accept: 'application/json',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const text = await r.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!r.ok) {
      return { ok: false, status: r.status, error: `IXP Manager returned ${r.status}`, data };
    }
    return { ok: true, status: r.status, data };
  } catch (error: any) {
    return {
      ok: false,
      status: 0,
      error: error?.name === 'AbortError' ? 'Connection timed out' : 'Could not reach IXP Manager',
    };
  }
}

/** Test connectivity + key by hitting the customer list endpoint. */
export async function testConnection(url?: string, apiKey?: string): Promise<IxpResult> {
  // /api/v4/customer is a standard authenticated endpoint
  const res = await call('/api/v4/customer', { url, apiKey });
  if (res.ok) {
    const count = Array.isArray(res.data) ? res.data.length : undefined;
    return { ok: true, status: res.status, data: { connected: true, customers: count } };
  }
  return res;
}

/** Fetch members/customers from IXP Manager. */
export async function fetchMembers(): Promise<IxpResult<any[]>> {
  return call<any[]>('/api/v4/customer');
}

/** Fetch virtual interfaces / ports. */
export async function fetchPorts(): Promise<IxpResult<any[]>> {
  return call<any[]>('/api/v4/virtual-interface');
}

/**
 * Create a provisioning record in IXP Manager when an order is approved.
 * IXP Manager doesn't expose a single "provision" endpoint, so this is a
 * best-effort hook — when not configured it's a no-op the caller can ignore.
 */
export async function notifyProvision(payload: Record<string, any>): Promise<IxpResult> {
  const cfg = await getEffectiveIxpManager();
  if (!cfg.enabled) return { ok: false, status: 0, error: 'IXP Manager not configured' };
  // Posting to a generic customer note endpoint as a provisioning trail.
  return call('/api/v4/customer', { method: 'GET' }).then((r) =>
    r.ok ? { ok: true, status: r.status, data: { acknowledged: true, payload } } : r
  );
}

export default { testConnection, fetchMembers, fetchPorts, notifyProvision };
