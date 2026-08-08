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

  // Normalize: strip trailing slash and a trailing "/api" (the endpoints below
  // already include the full "/api/v4/..." path, so a base ending in /api would
  // otherwise produce a duplicated "/api/api/v4" path → 404).
  const base = url.replace(/\/+$/, '').replace(/\/api$/i, '');
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
      const snippet =
        typeof data === 'string'
          ? data.slice(0, 120)
          : data?.message || data?.error || '';
      return {
        ok: false,
        status: r.status,
        error: `IXP Manager returned ${r.status} for ${target}${snippet ? ` — ${snippet}` : ''}`,
        data,
      };
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

/** Test connectivity + key by hitting the documented test endpoint. */
export async function testConnection(url?: string, apiKey?: string): Promise<IxpResult> {
  // /api/v4/test?format=json returns { authenticated: true/false } — this is the
  // canonical way to verify an API key is accepted by IXP Manager.
  const res = await call('/api/v4/test?format=json', { url, apiKey });
  if (!res.ok) return res;

  const authed =
    res.data && typeof res.data === 'object'
      ? res.data.authenticated === true
      : /authenticated["\s:]+(true|yes)/i.test(String(res.data));

  if (!authed) {
    return {
      ok: false,
      status: 401,
      error: 'IXP Manager reachable, but API key not accepted (authenticated: false). Check the key and its privileges.',
    };
  }

  // Enrich with a member count from the IX-F export (best-effort).
  const exp = await ixfExport(url, apiKey);
  const count = exp.ok && Array.isArray(exp.data?.member_list) ? exp.data.member_list.length : undefined;
  return { ok: true, status: res.status, data: { connected: true, customers: count } };
}

/**
 * Raw IX-F Member List export (members + their connections/ports).
 *
 * IX-F schema >= v0.7 requires an "IX-F ID" to be configured on each
 * Infrastructure in IXP Manager. When that isn't set, the export returns
 * HTTP 500 with that message. We prefer the current schema (1.0) but
 * transparently fall back to 0.6 (which has no such requirement and still
 * carries the fields we read: asnum, name, connection_list, if_speed).
 */
async function ixfExport(url?: string, apiKey?: string): Promise<IxpResult<any>> {
  const primary = await call<any>('/api/v4/member-export/ixf/1.0', { url, apiKey });
  if (primary.ok) return primary;

  const needsIxfId =
    primary.status === 500 && /IX-F ID/i.test(String(primary.error || JSON.stringify(primary.data || '')));
  if (needsIxfId) {
    console.warn('[IXP Manager] IX-F ID not set on Infrastructure — falling back to IX-F schema v0.6');
    return call<any>('/api/v4/member-export/ixf/0.6', { url, apiKey });
  }
  return primary;
}

/**
 * Fetch members from the IX-F export, normalized to { id, asn, name } so the
 * existing controller field-readers keep working (id is the ASN since the
 * IX-F schema has no internal customer id).
 */
export async function fetchMembers(): Promise<IxpResult<any[]>> {
  const res = await ixfExport();
  if (!res.ok) return { ok: false, status: res.status, error: res.error };
  const list = Array.isArray(res.data?.member_list) ? res.data.member_list : [];
  const members = list.map((m: any) => ({
    id: String(m.asnum ?? ''),
    asn: Number(m.asnum) || undefined,
    name: m.name || (m.asnum ? `AS${m.asnum}` : 'Unknown'),
  }));
  return { ok: true, status: res.status, data: members };
}

/**
 * Fetch ports (physical interfaces) derived from the IX-F export connections,
 * normalized to { id, custid, speed, locationname } for the import controller.
 * `custid` is the ASN to match how members are linked (ixpManagerId = ASN).
 */
export async function fetchPorts(): Promise<IxpResult<any[]>> {
  const res = await ixfExport();
  if (!res.ok) return { ok: false, status: res.status, error: res.error };
  const list = Array.isArray(res.data?.member_list) ? res.data.member_list : [];

  // Build switch_id -> { name, location } from the infrastructure metadata so
  // we can auto-fill the Zabbix host (= switch name) on import.
  const switchMap = new Map<string, { name: string; location: string }>();
  const ixpList = Array.isArray(res.data?.ixp_list) ? res.data.ixp_list : [];
  for (const ixp of ixpList) {
    for (const sw of ixp.switch || []) {
      if (sw.id !== undefined) {
        switchMap.set(String(sw.id), { name: sw.name || '', location: sw.colo || sw.city || '' });
      }
    }
  }

  const ports: any[] = [];
  for (const m of list) {
    const asnum = String(m.asnum ?? '');
    if (!asnum) continue;
    const conns = Array.isArray(m.connection_list) ? m.connection_list : [];
    conns.forEach((c: any, ci: number) => {
      const ifs = Array.isArray(c.if_list) ? c.if_list : [];
      if (ifs.length === 0) {
        ports.push({ id: `${asnum}-${ci}`, custid: asnum, speed: undefined, locationname: '', switchName: '' });
        return;
      }
      ifs.forEach((ifc: any, ii: number) => {
        const sw = switchMap.get(String(ifc.switch_id ?? ''));
        ports.push({
          id: `${asnum}-${ci}-${ii}`,
          custid: asnum,
          speed: ifc.if_speed, // IX-F if_speed is in Mbit/s (10000 → 10G)
          locationname: sw?.location || '',
          switchName: sw?.name || '',
        });
      });
    });
  }
  return { ok: true, status: res.status, data: ports };
}

/**
 * Best-effort provisioning hook: IXP Manager has no single "provision"
 * endpoint, so we just confirm the API key is still valid as an ack trail.
 */
export async function notifyProvision(payload: Record<string, any>): Promise<IxpResult> {
  const cfg = await getEffectiveIxpManager();
  if (!cfg.enabled) return { ok: false, status: 0, error: 'IXP Manager not configured' };
  const r = await call('/api/v4/test?format=json', { method: 'GET' });
  return r.ok ? { ok: true, status: r.status, data: { acknowledged: true, payload } } : r;
}

export default { testConnection, fetchMembers, fetchPorts, notifyProvision };
