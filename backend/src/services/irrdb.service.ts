import { execFile } from 'child_process';
import { Types } from 'mongoose';
import { IrrdbPrefix, VlanInterface, VirtualInterface, Organization } from '../models';
import config from '../config/environment';

/**
 * IRRDB (as-set) expansion.
 *
 * Turns a member's registered as-set / as-macro into the concrete prefix list
 * that birdConfig.service.ts drops into each peer's import filter. Expansion is
 * slow (recursive IRR queries), so results are cached in `IrrdbPrefix` — one row
 * per (ASN, address family) — and refreshed on a schedule or on demand.
 *
 * Uses the `bgpq4` binary. Its path, the trusted IRR sources and the IRRD host
 * all come from environment variables rather than the database: they end up on a
 * command line, and nothing an admin can type in a web form should get there.
 *
 * ## Failure behaviour
 *
 * A failed refresh records `lastError` and leaves any previously cached prefixes
 * in place, so a transient IRR outage does not empty a member's filter. When
 * there has never been a successful expansion, the row stays empty and
 * birdConfig fails closed for that peer (unless the route server has
 * `irrdbFailOpen` set) — the config build reports this by name.
 */

const execFileAsync = (
  file: string,
  args: string[],
  timeout: number
): Promise<{ stdout: string; stderr: string; code: number }> =>
  new Promise((resolve) => {
    execFile(
      file,
      args,
      // as-set expansions can be tens of megabytes of JSON.
      { timeout, maxBuffer: 64 * 1024 * 1024 },
      (err: any, stdout, stderr) => {
        resolve({
          stdout: String(stdout || ''),
          stderr: String(stderr || err?.message || ''),
          code: err ? (typeof err.code === 'number' ? err.code : 1) : 0,
        });
      }
    );
  });

/**
 * IRR object names: `AS64500`, `AS-EXAMPLE`, `RIPE::AS-EXAMPLE`,
 * `AS64500:AS-CUSTOMERS`, `RS-SOMETHING`.
 */
const IRR_OBJECT = /^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/;

/**
 * Validate an IRR object before it reaches a command line.
 *
 * Even though execFile takes an argv array (so there is no shell to escape
 * into), a value starting with `-` would be read by bgpq4 as an option — hence
 * the explicit leading-dash rejection.
 */
export const assertIrrObject = (value: string): string => {
  const v = String(value || '').trim();
  if (!v) throw new Error('IRR object name is empty.');
  if (v.startsWith('-')) throw new Error(`IRR object name must not start with "-": ${v}`);
  if (!IRR_OBJECT.test(v)) throw new Error(`IRR object name contains characters that are not allowed: ${v}`);
  return v;
};

/** Sanity-check the operator-provided source list the same way. */
const sourcesArg = (): string | null => {
  const raw = String(config.irrdbSources || '').trim();
  if (!raw) return null;
  if (!/^[A-Za-z0-9_,.-]+$/.test(raw)) {
    console.warn('[IRRDB] IRRDB_SOURCES contains unexpected characters and was ignored.');
    return null;
  }
  return raw;
};

const hostArg = (): string | null => {
  const raw = String(config.irrdbHost || '').trim();
  if (!raw) return null;
  if (!/^[A-Za-z0-9_.:-]+$/.test(raw)) {
    console.warn('[IRRDB] IRRDB_HOST contains unexpected characters and was ignored.');
    return null;
  }
  return raw;
};

// ── bgpq4 output parsing ──

export interface ParsedPrefix {
  prefix: string;
  maxLength?: number;
}

/**
 * Parse `bgpq4 -j` output.
 *
 * The payload is `{ "<name>": [ … ] }`. Entries are objects carrying a prefix
 * plus optional `exact` / `greater-equal` / `less-equal` range hints. Key
 * spellings are matched defensively because they have varied between releases.
 */
export const parseBgpq4Prefixes = (stdout: string, name: string): ParsedPrefix[] => {
  const trimmed = String(stdout || '').trim();
  if (!trimmed) return [];

  let payload: any;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    throw new Error('bgpq4 did not return valid JSON.');
  }

  const list = Array.isArray(payload?.[name])
    ? payload[name]
    : Array.isArray(payload)
      ? payload
      : Array.isArray(Object.values(payload || {})[0])
        ? (Object.values(payload)[0] as any[])
        : [];

  const out: ParsedPrefix[] = [];
  for (const entry of list) {
    if (typeof entry === 'string') {
      out.push({ prefix: entry });
      continue;
    }
    const prefix = entry?.prefix ?? entry?.network ?? entry?.net;
    if (!prefix || typeof prefix !== 'string') continue;

    const lessEqual =
      entry['less-equal'] ?? entry.lessEqual ?? entry['le'] ?? entry['max-length'] ?? entry.maxLength;
    const parsed: ParsedPrefix = { prefix };
    const le = Number(lessEqual);
    if (Number.isInteger(le) && le > 0) parsed.maxLength = le;
    out.push(parsed);
  }
  return out;
};

/** Parse `bgpq4 -j -t` output into a list of origin ASNs. */
export const parseBgpq4Asns = (stdout: string, name: string): number[] => {
  const trimmed = String(stdout || '').trim();
  if (!trimmed) return [];

  let payload: any;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    return [];
  }

  const list = Array.isArray(payload?.[name])
    ? payload[name]
    : Array.isArray(Object.values(payload || {})[0])
      ? (Object.values(payload)[0] as any[])
      : [];

  const out = new Set<number>();
  for (const entry of list) {
    const n =
      typeof entry === 'number'
        ? entry
        : Number(String(entry ?? '').replace(/^AS/i, '').trim());
    if (Number.isInteger(n) && n > 0) out.add(n);
  }
  return Array.from(out);
};

// ── Availability ──

/**
 * Confirm bgpq4 is installed, so the UI can say so plainly.
 *
 * Runs it with no arguments: bgpq4 prints usage and exits non-zero, which proves
 * the binary exists without making any IRR query. This gets called from the
 * status screen, so it must stay cheap and offline.
 */
export const isAvailable = async (): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await execFileAsync(config.bgpq4Path, [], 10000);
    const combined = `${res.stderr}${res.stdout}`;
    if (/ENOENT|not found|is not recognized|No such file/i.test(combined)) {
      return {
        ok: false,
        error: `bgpq4 was not found at "${config.bgpq4Path}". Install it on the backend host or set BGPQ4_PATH.`,
      };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Could not run bgpq4.' };
  }
};

// ── Expansion ──

export interface ExpandOptions {
  /** Allow more specifics up to this length (bgpq4 -R). Off by default. */
  allowMoreSpecificTo?: number;
  /** Reject anything longer than this (bgpq4 -m). */
  maxPrefixLength?: number;
  /** Also expand origin ASNs (a second bgpq4 run). */
  withOriginAsns?: boolean;
}

/**
 * Run bgpq4 for one IRR object and one address family.
 *
 * Returns the parsed prefixes without touching the database, so callers can
 * decide what to do with a partial or empty result.
 */
export const expand = async (
  irrObject: string,
  family: 4 | 6,
  opts: ExpandOptions = {}
): Promise<{ ok: boolean; prefixes: ParsedPrefix[]; originAsns: number[]; error?: string }> => {
  const object = assertIrrObject(irrObject);
  const name = 'mxix';

  const args: string[] = ['-j', '-l', name, family === 6 ? '-6' : '-4'];

  const host = hostArg();
  if (host) args.push('-h', host);

  const sources = sourcesArg();
  if (sources) args.push('-S', sources);

  if (config.irrdbRecursionLimit && /^\d+$/.test(config.irrdbRecursionLimit)) {
    args.push('-L', config.irrdbRecursionLimit);
  }
  if (opts.maxPrefixLength && Number.isInteger(opts.maxPrefixLength)) {
    args.push('-m', String(opts.maxPrefixLength));
  }
  if (opts.allowMoreSpecificTo && Number.isInteger(opts.allowMoreSpecificTo)) {
    args.push('-R', String(opts.allowMoreSpecificTo));
  }

  args.push(object);

  const res = await execFileAsync(config.bgpq4Path, args, config.irrdbTimeoutMs);

  if (res.code !== 0) {
    if (/not found|ENOENT|is not recognized/i.test(res.stderr)) {
      return {
        ok: false,
        prefixes: [],
        originAsns: [],
        error: `bgpq4 was not found at "${config.bgpq4Path}". Install it or set BGPQ4_PATH.`,
      };
    }
    return {
      ok: false,
      prefixes: [],
      originAsns: [],
      error: `bgpq4 failed for ${object} (IPv${family}): ${res.stderr.slice(0, 300).trim() || `exit ${res.code}`}`,
    };
  }

  let prefixes: ParsedPrefix[];
  try {
    prefixes = parseBgpq4Prefixes(res.stdout, name);
  } catch (err: any) {
    return { ok: false, prefixes: [], originAsns: [], error: err?.message || 'Could not parse bgpq4 output.' };
  }

  let originAsns: number[] = [];
  if (opts.withOriginAsns) {
    // `-t` emits the as-set members rather than prefixes.
    const asnArgs = ['-j', '-t', '-l', name];
    if (host) asnArgs.push('-h', host);
    if (sources) asnArgs.push('-S', sources);
    asnArgs.push(object);
    const asnRes = await execFileAsync(config.bgpq4Path, asnArgs, config.irrdbTimeoutMs);
    if (asnRes.code === 0) originAsns = parseBgpq4Asns(asnRes.stdout, name);
  }

  return { ok: true, prefixes, originAsns };
};

// ── Cache maintenance ──

export interface RefreshResult {
  asn: number;
  family: 4 | 6;
  source: string;
  ok: boolean;
  prefixCount: number;
  originAsnCount: number;
  error?: string;
  durationMs: number;
}

/**
 * Refresh the cached expansion for one ASN.
 *
 * `asMacro` is the object to expand; when omitted we fall back to the ASN
 * itself (`AS64500`), which yields just that ASN's own route objects. On failure
 * the previously cached prefixes are kept and only `lastError` is updated —
 * dropping them would silently black-hole the member.
 */
export const refreshAsn = async (
  asn: number,
  opts: { asMacro?: string; families?: Array<4 | 6> } & ExpandOptions = {}
): Promise<RefreshResult[]> => {
  if (!Number.isInteger(asn) || asn <= 0) throw new Error('Invalid ASN.');

  const families = opts.families?.length ? opts.families : ([4, 6] as Array<4 | 6>);
  const object = (opts.asMacro || '').trim() || `AS${asn}`;
  const results: RefreshResult[] = [];

  for (const family of families) {
    const startedAt = Date.now();
    let outcome: Awaited<ReturnType<typeof expand>>;
    try {
      outcome = await expand(object, family, { ...opts, withOriginAsns: true });
    } catch (err: any) {
      outcome = { ok: false, prefixes: [], originAsns: [], error: err?.message || 'Expansion failed.' };
    }

    const durationMs = Date.now() - startedAt;

    if (outcome.ok) {
      await IrrdbPrefix.updateOne(
        { asn, family },
        {
          $set: {
            source: object,
            prefixes: outcome.prefixes,
            originAsns: outcome.originAsns,
            provider: 'bgpq4',
            lastError: '',
            lastRefreshedAt: new Date(),
          },
        },
        { upsert: true }
      );
    } else {
      // Keep whatever is cached; record why the refresh failed.
      await IrrdbPrefix.updateOne(
        { asn, family },
        {
          $set: { source: object, lastError: outcome.error || 'Unknown error' },
          $setOnInsert: { prefixes: [], originAsns: [], provider: 'bgpq4' },
        },
        { upsert: true }
      );
    }

    results.push({
      asn,
      family,
      source: object,
      ok: outcome.ok,
      prefixCount: outcome.prefixes.length,
      originAsnCount: outcome.originAsns.length,
      error: outcome.error,
      durationMs,
    });
  }

  return results;
};

/**
 * Every (ASN, as-set) pair that actually needs filtering, derived from the peers
 * configured on the fabric. Avoids expanding as-sets for members who don't have
 * IRRDB filtering switched on.
 */
export const collectFilteredAsns = async (
  vlanId?: string | Types.ObjectId
): Promise<Array<{ asn: number; asMacro: string }>> => {
  const vliFilter: any = { enabled: true, rsClient: true, irrdbFilter: true };
  if (vlanId) vliFilter.vlan = vlanId;

  const vlis = await VlanInterface.find(vliFilter).select('virtualInterface peerAsn asMacro').lean();
  if (!vlis.length) return [];

  const vis = await VirtualInterface.find({ _id: { $in: vlis.map((v: any) => v.virtualInterface) } })
    .select('organization')
    .lean();
  const viById = new Map(vis.map((v: any) => [String(v._id), v]));

  const orgs = await Organization.find({ _id: { $in: vis.map((v: any) => v.organization) } })
    .select('asn irrAsSet status')
    .lean();
  const orgById = new Map(orgs.map((o: any) => [String(o._id), o]));

  const byAsn = new Map<number, string>();
  for (const vli of vlis as any[]) {
    const vi = viById.get(String(vli.virtualInterface));
    if (!vi) continue;
    const org = orgById.get(String(vi.organization));
    if (!org || org.status === 'suspended') continue;
    const asn = Number(vli.peerAsn || org.asn || 0);
    if (!asn) continue;
    // A per-peer override beats the org's PeeringDB-sourced as-set.
    const macro = (vli.asMacro || org.irrAsSet || '').trim();
    const existing = byAsn.get(asn);
    // First sighting wins, except that a real as-set always beats a blank one
    // (the same ASN can appear on several connections, only one of which
    // carries the override).
    if (existing === undefined || (!existing && macro)) byAsn.set(asn, macro);
  }

  return Array.from(byAsn.entries()).map(([asn, asMacro]) => ({ asn, asMacro }));
};

export interface RefreshAllOptions extends ExpandOptions {
  /** Only refresh entries older than `staleMinutes` (or never fetched). */
  onlyStale?: boolean;
  staleMinutes?: number;
  /** Restrict to the peers on one VLAN. */
  vlanId?: string | Types.ObjectId;
  /** Safety valve for very large fabrics. */
  limit?: number;
}

/**
 * Refresh every peer's as-set expansion.
 *
 * Deliberately sequential: bgpq4 opens a recursive IRR query per run, and firing
 * dozens in parallel gets the IRRD host to rate-limit or drop us.
 */
export const refreshAll = async (opts: RefreshAllOptions = {}): Promise<{
  results: RefreshResult[];
  attempted: number;
  succeeded: number;
  failed: number;
  skipped: number;
}> => {
  const targets = await collectFilteredAsns(opts.vlanId);
  const staleMinutes = opts.staleMinutes ?? config.irrdbStaleMinutes;
  const cutoff = new Date(Date.now() - staleMinutes * 60_000);

  let candidates = targets;
  let skipped = 0;

  if (opts.onlyStale) {
    const cached = await IrrdbPrefix.find({ asn: { $in: targets.map((t) => t.asn) } })
      .select('asn family lastRefreshedAt')
      .lean();
    // An ASN is fresh only when *both* families were refreshed recently.
    const freshByAsn = new Map<number, number>();
    for (const row of cached as any[]) {
      if (row.lastRefreshedAt && new Date(row.lastRefreshedAt) > cutoff) {
        freshByAsn.set(row.asn, (freshByAsn.get(row.asn) || 0) + 1);
      }
    }
    candidates = targets.filter((t) => (freshByAsn.get(t.asn) || 0) < 2);
    skipped = targets.length - candidates.length;
  }

  if (opts.limit && candidates.length > opts.limit) {
    candidates = candidates.slice(0, opts.limit);
  }

  const results: RefreshResult[] = [];
  for (const target of candidates) {
    try {
      results.push(...(await refreshAsn(target.asn, { asMacro: target.asMacro, ...opts })));
    } catch (err: any) {
      results.push({
        asn: target.asn,
        family: 4,
        source: target.asMacro || `AS${target.asn}`,
        ok: false,
        prefixCount: 0,
        originAsnCount: 0,
        error: err?.message || 'Refresh failed.',
        durationMs: 0,
      });
    }
  }

  return {
    results,
    attempted: candidates.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    skipped,
  };
};

/** Cached expansion for one ASN, both families. */
export const getCached = async (asn: number): Promise<any[]> =>
  IrrdbPrefix.find({ asn }).lean();

/**
 * Overview of the cache for the admin screen: which peers have data, which are
 * stale, and which have never expanded successfully. The last group is what
 * makes route servers reject a member's routes, so it needs to be obvious.
 */
export const getCacheStatus = async (): Promise<{
  bgpq4Available: boolean;
  bgpq4Error?: string;
  staleMinutes: number;
  rows: Array<{
    asn: number;
    asMacro: string;
    v4Prefixes: number;
    v6Prefixes: number;
    v4RefreshedAt: Date | null;
    v6RefreshedAt: Date | null;
    stale: boolean;
    neverExpanded: boolean;
    lastError: string;
  }>;
}> => {
  const availability = await isAvailable();
  const targets = await collectFilteredAsns();
  const cached = await IrrdbPrefix.find({ asn: { $in: targets.map((t) => t.asn) } }).lean();

  const byKey = new Map(cached.map((r: any) => [`${r.asn}:${r.family}`, r]));
  const cutoff = Date.now() - config.irrdbStaleMinutes * 60_000;

  const rows = targets.map((t) => {
    const v4 = byKey.get(`${t.asn}:4`) as any;
    const v6 = byKey.get(`${t.asn}:6`) as any;
    const v4Count = v4?.prefixes?.length || 0;
    const v6Count = v6?.prefixes?.length || 0;
    const times = [v4?.lastRefreshedAt, v6?.lastRefreshedAt].filter(Boolean).map((d: any) => new Date(d).getTime());
    return {
      asn: t.asn,
      asMacro: t.asMacro || `AS${t.asn}`,
      v4Prefixes: v4Count,
      v6Prefixes: v6Count,
      v4RefreshedAt: v4?.lastRefreshedAt ? new Date(v4.lastRefreshedAt) : null,
      v6RefreshedAt: v6?.lastRefreshedAt ? new Date(v6.lastRefreshedAt) : null,
      stale: !times.length || Math.max(...times) < cutoff,
      neverExpanded: v4Count === 0 && v6Count === 0,
      lastError: v4?.lastError || v6?.lastError || '',
    };
  });

  return {
    bgpq4Available: availability.ok,
    bgpq4Error: availability.error,
    staleMinutes: config.irrdbStaleMinutes,
    rows: rows.sort((a, b) => Number(b.neverExpanded) - Number(a.neverExpanded) || a.asn - b.asn),
  };
};

/**
 * Store a hand-maintained prefix list.
 *
 * The escape hatch for a member whose IRR records are wrong or missing, and for
 * installations with no bgpq4 available. Marked `provider: 'manual'` so a
 * scheduled refresh does not overwrite it.
 */
export const setManualPrefixes = async (
  asn: number,
  family: 4 | 6,
  prefixes: ParsedPrefix[]
): Promise<void> => {
  if (!Number.isInteger(asn) || asn <= 0) throw new Error('Invalid ASN.');
  await IrrdbPrefix.updateOne(
    { asn, family },
    {
      $set: {
        prefixes,
        provider: 'manual',
        source: `AS${asn} (manual)`,
        lastError: '',
        lastRefreshedAt: new Date(),
      },
    },
    { upsert: true }
  );
};

export default {
  isAvailable,
  expand,
  refreshAsn,
  refreshAll,
  collectFilteredAsns,
  getCached,
  getCacheStatus,
  setManualPrefixes,
  parseBgpq4Prefixes,
  parseBgpq4Asns,
  assertIrrObject,
};
