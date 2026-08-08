import { getEffectivePeeringDb, EffectivePeeringDb } from '../models/settings.model';
import { OrgType, OrgPeeringPolicy } from '../models/organization.model';

/**
 * PeeringDB API v2 client.
 *
 * Mirrors the shape of ixpManager.service.ts (native fetch + AbortController,
 * `{ ok, status, data, error }`) so controllers handle both the same way.
 *
 * PeeringDB serves reads anonymously but rate-limits hard; an API key raises the
 * limit and unlocks contact (poc) details. Responses are cached in-process
 * because a route-server config rebuild touches every member's `net` record and
 * would otherwise trip the limiter.
 *
 * Docs: https://www.peeringdb.com/apidocs/
 */

export interface PdbResult<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  /** True when the payload came from the in-process cache. */
  cached?: boolean;
}

// ── Response shapes (only the fields we actually consume) ──

export interface PdbNet {
  id: number;
  org_id: number;
  name: string;
  aka?: string;
  name_long?: string;
  website?: string;
  asn: number;
  looking_glass?: string;
  route_server?: string;
  irr_as_set?: string;
  info_type?: string;
  info_prefixes4?: number;
  info_prefixes6?: number;
  info_traffic?: string;
  info_ratio?: string;
  info_scope?: string;
  info_ipv6?: boolean;
  info_never_via_route_servers?: boolean;
  policy_url?: string;
  policy_general?: string;
  policy_locations?: string;
  policy_ratio?: boolean;
  policy_contracts?: string;
  netixlan_set?: PdbNetIxLan[];
  netfac_set?: PdbNetFac[];
  poc_set?: PdbPoc[];
}

export interface PdbNetIxLan {
  id: number;
  net_id: number;
  ix_id: number;
  ixlan_id: number;
  name?: string;
  asn: number;
  ipaddr4?: string | null;
  ipaddr6?: string | null;
  speed?: number;
  is_rs_peer?: boolean;
  operational?: boolean;
  status?: string;
}

export interface PdbNetFac {
  id: number;
  net_id: number;
  fac_id: number;
  name?: string;
  city?: string;
  country?: string;
}

export interface PdbPoc {
  id: number;
  net_id: number;
  role?: string;
  name?: string;
  email?: string;
  phone?: string;
  visible?: string;
}

export interface PdbIx {
  id: number;
  org_id: number;
  name: string;
  name_long?: string;
  city?: string;
  country?: string;
  region_continent?: string;
  website?: string;
  tech_email?: string;
  policy_email?: string;
  net_count?: number;
  ixlan_set?: Array<{ id: number; name?: string; mtu?: number }>;
}

export interface PdbFac {
  id: number;
  org_id: number;
  name: string;
  address1?: string;
  city?: string;
  country?: string;
  clli?: string;
  npanxx?: string;
  latitude?: number;
  longitude?: number;
  net_count?: number;
}

// ── In-process response cache ──

interface CacheEntry {
  at: number;
  status: number;
  payload: any;
}
const cache = new Map<string, CacheEntry>();
/** Hard ceiling so a long-running process can't grow the cache without bound. */
const MAX_CACHE_ENTRIES = 2000;

export const clearCache = (): void => {
  cache.clear();
};

const cacheGet = (key: string, ttlMs: number): CacheEntry | undefined => {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > ttlMs) {
    cache.delete(key);
    return undefined;
  }
  return hit;
};

const cacheSet = (key: string, entry: CacheEntry): void => {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    // Evict the oldest insertion — Map preserves insertion order.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, entry);
};

// ── Core request ──

const REQUEST_TIMEOUT_MS = 20000;

async function call<T = any>(
  path: string,
  opts: { cfg?: EffectivePeeringDb; noCache?: boolean } = {}
): Promise<PdbResult<T>> {
  const cfg = opts.cfg || (await getEffectivePeeringDb());
  if (!cfg.enabled) {
    return { ok: false, status: 0, error: 'PeeringDB is not enabled in Settings.' };
  }

  const target = `${cfg.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const ttlMs = Math.max(0, cfg.cacheTtlMinutes) * 60_000;

  if (!opts.noCache && ttlMs > 0) {
    const hit = cacheGet(target, ttlMs);
    if (hit) return { ok: true, status: hit.status, data: hit.payload, cached: true };
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (cfg.apiKey) {
    headers.Authorization = `Api-Key ${cfg.apiKey}`;
  } else if (cfg.username && cfg.password) {
    headers.Authorization = `Basic ${Buffer.from(`${cfg.username}:${cfg.password}`).toString('base64')}`;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const r = await fetch(target, { headers, signal: controller.signal });
    clearTimeout(timer);

    const text = await r.text();
    let payload: any;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }

    if (!r.ok) {
      // PeeringDB returns 429 with a Retry-After when the limiter kicks in —
      // surface that distinctly so the caller can back off instead of retrying.
      if (r.status === 429) {
        const retryAfter = r.headers.get('retry-after');
        return {
          ok: false,
          status: 429,
          error: `PeeringDB rate limit hit${retryAfter ? ` — retry after ${retryAfter}s` : ''}. Add an API key in Settings to raise the limit.`,
        };
      }
      const detail =
        typeof payload === 'string'
          ? payload.slice(0, 160)
          : payload?.meta?.error || payload?.detail || payload?.message || '';
      return {
        ok: false,
        status: r.status,
        error: `PeeringDB returned ${r.status} for ${path}${detail ? ` — ${detail}` : ''}`,
      };
    }

    if (ttlMs > 0) cacheSet(target, { at: Date.now(), status: r.status, payload });
    return { ok: true, status: r.status, data: payload };
  } catch (error: any) {
    return {
      ok: false,
      status: 0,
      error:
        error?.name === 'AbortError'
          ? 'PeeringDB request timed out'
          : `Could not reach PeeringDB (${error?.message || 'network error'})`,
    };
  }
}

/** PeeringDB wraps every list response in `{ data: [...] }`. */
const unwrap = <T>(res: PdbResult<any>): PdbResult<T[]> => {
  if (!res.ok) return { ok: false, status: res.status, error: res.error };
  const list = Array.isArray(res.data?.data) ? res.data.data : [];
  return { ok: true, status: res.status, data: list as T[], cached: res.cached };
};

const unwrapOne = <T>(res: PdbResult<any>): PdbResult<T | null> => {
  const list = unwrap<T>(res);
  if (!list.ok) return { ok: false, status: list.status, error: list.error };
  return { ok: true, status: list.status, data: list.data?.[0] ?? null, cached: list.cached };
};

// ── Public API ──

/** Verify configuration + reachability by fetching a tiny known record. */
export const testConnection = async (): Promise<PdbResult<{ connected: boolean; authenticated: boolean }>> => {
  const cfg = await getEffectivePeeringDb();
  if (!cfg.enabled) return { ok: false, status: 0, error: 'PeeringDB is not enabled in Settings.' };

  const res = await call<any>('/net?limit=1', { cfg, noCache: true });
  if (!res.ok) return { ok: false, status: res.status, error: res.error };
  return {
    ok: true,
    status: res.status,
    data: { connected: true, authenticated: !!(cfg.apiKey || (cfg.username && cfg.password)) },
  };
};

/**
 * Look up a network by ASN. `depth=2` pulls netixlan_set/netfac_set/poc_set in
 * the same round trip, which is what makes a one-click member import possible.
 */
export const getNetByAsn = async (asn: number, opts: { noCache?: boolean } = {}): Promise<PdbResult<PdbNet | null>> => {
  if (!Number.isInteger(asn) || asn <= 0) {
    return { ok: false, status: 400, error: 'Invalid ASN.' };
  }
  return unwrapOne<PdbNet>(await call<any>(`/net?asn=${asn}&depth=2`, { noCache: opts.noCache }));
};

export const getNet = async (netId: number): Promise<PdbResult<PdbNet | null>> =>
  unwrapOne<PdbNet>(await call<any>(`/net/${netId}?depth=2`));

export const getIx = async (ixId: number): Promise<PdbResult<PdbIx | null>> =>
  unwrapOne<PdbIx>(await call<any>(`/ix/${ixId}?depth=2`));

export const searchIx = async (query: string): Promise<PdbResult<PdbIx[]>> =>
  unwrap<PdbIx>(await call<any>(`/ix?name__contains=${encodeURIComponent(query)}&limit=50`));

export const getFacility = async (facId: number): Promise<PdbResult<PdbFac | null>> =>
  unwrapOne<PdbFac>(await call<any>(`/fac/${facId}`));

export const searchFacilities = async (query: string): Promise<PdbResult<PdbFac[]>> =>
  unwrap<PdbFac>(await call<any>(`/fac?name__contains=${encodeURIComponent(query)}&limit=50`));

/** Facilities a given network is present in — useful for cross-connect planning. */
export const getNetFacilities = async (netId: number): Promise<PdbResult<PdbNetFac[]>> =>
  unwrap<PdbNetFac>(await call<any>(`/netfac?net_id=${netId}`));

/** Every IX presence a network declares. */
export const getNetIxLansByAsn = async (asn: number): Promise<PdbResult<PdbNetIxLan[]>> =>
  unwrap<PdbNetIxLan>(await call<any>(`/netixlan?asn=${asn}`));

/**
 * Every participant on one of *our* ixlans, as declared in PeeringDB.
 *
 * Comparing this against our own VlanInterface records is how you find members
 * whose PeeringDB entry disagrees with reality (wrong IP, stale speed, or a
 * network claiming a presence it never provisioned).
 */
export const getIxLanParticipants = async (ixLanId: number): Promise<PdbResult<PdbNetIxLan[]>> =>
  unwrap<PdbNetIxLan>(await call<any>(`/netixlan?ixlan_id=${ixLanId}&limit=1000`));

/** Network contacts. Emails are only returned when authenticated. */
export const getNetContacts = async (netId: number): Promise<PdbResult<PdbPoc[]>> =>
  unwrap<PdbPoc>(await call<any>(`/poc?net_id=${netId}`));

// ── Mapping into our own domain ──

/**
 * PeeringDB `info_type` -> our OrgType enum.
 * PeeringDB has a longer taxonomy, so several values collapse onto one of ours.
 */
export const mapInfoTypeToOrgType = (infoType?: string): OrgType => {
  switch ((infoType || '').trim()) {
    case 'Cable/DSL/ISP':
    case 'NSP':
      return 'ISP';
    case 'Content':
      return 'Content';
    case 'Enterprise':
      return 'Enterprise';
    case 'Educational/Research':
      return 'Academic';
    case 'Network Services':
      return 'Cloud';
    default:
      return 'Other';
  }
};

/**
 * PeeringDB `policy_general` -> our OrgPeeringPolicy enum.
 * PeeringDB's "No" (does not peer) has no equivalent, so it maps to the most
 * restrictive value we model.
 */
export const mapPolicyGeneral = (policy?: string): OrgPeeringPolicy => {
  switch ((policy || '').trim()) {
    case 'Open':
      return 'Open';
    case 'Selective':
      return 'Selective';
    case 'Restrictive':
    case 'No':
      return 'Restrictive';
    default:
      return 'Open';
  }
};

/**
 * Fields to write onto an Organization from a PeeringDB `net` record.
 *
 * Returns only what PeeringDB actually supplied, so a partial record never
 * blanks out data an operator entered by hand.
 */
export const mapNetToOrganization = (
  net: PdbNet,
  opts: { syncMaxPrefixes?: boolean; syncIrrAsSet?: boolean } = {}
): Record<string, any> => {
  const patch: Record<string, any> = {
    peeringdbNetId: net.id,
    peeringdbOrgId: net.org_id,
    peeringdbSyncedAt: new Date(),
  };

  if (net.name) patch.name = net.name;
  if (net.name_long) patch.legalName = net.name_long;
  if (net.website) patch.website = net.website;
  if (net.asn) patch.asn = net.asn;
  if (net.info_type) patch.type = mapInfoTypeToOrgType(net.info_type);
  if (net.policy_general) patch.peeringPolicy = mapPolicyGeneral(net.policy_general);
  if (net.policy_url) patch.peeringPolicyUrl = net.policy_url;
  if (net.info_traffic) patch.infoTraffic = net.info_traffic;
  if (net.info_ratio) patch.infoRatio = net.info_ratio;
  if (net.info_scope) patch.infoScope = net.info_scope;
  if (typeof net.info_never_via_route_servers === 'boolean') {
    patch.neverViaRouteServers = net.info_never_via_route_servers;
  }

  if (opts.syncMaxPrefixes !== false) {
    if (typeof net.info_prefixes4 === 'number' && net.info_prefixes4 > 0) {
      patch.infoPrefixes4 = net.info_prefixes4;
    }
    if (typeof net.info_prefixes6 === 'number' && net.info_prefixes6 > 0) {
      patch.infoPrefixes6 = net.info_prefixes6;
    }
  }

  if (opts.syncIrrAsSet !== false && net.irr_as_set) {
    patch.irrAsSet = net.irr_as_set.trim();
  }

  // NOC contact, when PeeringDB exposes it (requires an authenticated request).
  const noc = (net.poc_set || []).find((p) => (p.role || '').toLowerCase() === 'noc');
  if (noc?.email) patch.nocEmail = noc.email;
  if (noc?.phone) patch.nocPhone = noc.phone;

  return patch;
};

export default {
  testConnection,
  getNetByAsn,
  getNet,
  getIx,
  searchIx,
  getFacility,
  searchFacilities,
  getNetFacilities,
  getNetIxLansByAsn,
  getIxLanParticipants,
  getNetContacts,
  mapNetToOrganization,
  mapInfoTypeToOrgType,
  mapPolicyGeneral,
  clearCache,
};
