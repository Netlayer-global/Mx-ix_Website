import { getEffectiveGrafana } from '../models/settings.model';

/**
 * Single source of truth for port metrics pulled from Zabbix (via the Grafana
 * datasource proxy).
 *
 * Everything here returns `null` when the data genuinely isn't available —
 * there are no synthetic/demo fallbacks. Callers must render an "unavailable"
 * state rather than inventing numbers, because these figures feed member-facing
 * dashboards, 95th-percentile billing references and threshold alerts.
 */

export interface MetricSeries {
  /** unix ms timestamps */
  t: number[];
  /** Mbps */
  inbound: number[];
  /** Mbps */
  outbound: number[];
}

export interface GrafanaConfig {
  url: string;
  apiKey: string;
  zabbixUid: string;
}

const QUERY_TIMEOUT_MS = 6000;

export const bitsToMbps = (bits: number): number => Math.round((bits / 1_000_000) * 100) / 100;

/** Escape a string for safe use inside a Zabbix regex item filter. */
export const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Resolve the effective Grafana/Zabbix config, or null when not usable. */
export async function getMetricsConfig(): Promise<GrafanaConfig | null> {
  const g = await getEffectiveGrafana();
  if (!g.url || !g.apiKey) return null;
  return { url: g.url, apiKey: g.apiKey, zabbixUid: g.zabbixUid };
}

/** Query a single Zabbix item time-series for a host via Grafana's datasource. */
export async function queryItem(
  g: GrafanaConfig,
  host: string,
  itemFilter: string,
  from: string
): Promise<{ t: number[]; v: number[] } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);
    const r = await fetch(`${g.url}/api/ds/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${g.apiKey}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        queries: [
          {
            refId: 'A',
            datasource: { type: 'alexanderzobnin-zabbix-datasource', uid: g.zabbixUid },
            queryType: '0',
            group: { filter: '/.*/' },
            host: { filter: host },
            item: { filter: itemFilter },
            options: { showDisabledItems: false, skipEmptyValues: false, useTrends: 'default' },
          },
        ],
        from,
        to: 'now',
      }),
    });
    clearTimeout(timeout);
    if (!r.ok) return null;
    const data = (await r.json()) as any;
    const values = data.results?.A?.frames?.[0]?.data?.values;
    if (!values || !values[0] || !values[1]) return null;
    return { t: values[0] as number[], v: values[1] as number[] };
  } catch {
    return null;
  }
}

/** Latest numeric value of a Zabbix item, or null. */
export async function latestValue(
  g: GrafanaConfig,
  host: string,
  itemFilter: string,
  from: string
): Promise<number | null> {
  const r = await queryItem(g, host, itemFilter, from);
  if (r && r.v.length) {
    for (let i = r.v.length - 1; i >= 0; i--) {
      const v = r.v[i];
      if (typeof v === 'number' && isFinite(v)) return v;
    }
  }
  return null;
}

/** Item filters for a port's rx/tx counters, scoped to an interface if mapped. */
const bitsFilters = (zabbixInterface?: string): { rx: string; tx: string } => {
  const iface = (zabbixInterface || '').trim();
  if (!iface) return { rx: 'Bits received', tx: 'Bits sent' };
  const scoped = escapeRegex(iface);
  return { rx: `/${scoped}.*[Bb]its received/`, tx: `/${scoped}.*[Bb]its sent/` };
};

/** True when a port is wired up to a monitoring host at all. */
export const isPortMapped = (port: any): boolean => Boolean(port?.zabbixHostId);

/**
 * Traffic time-series for one port. Returns null when the port is unmapped,
 * monitoring is unconfigured, or Zabbix has no samples for the window.
 */
export async function portTrafficSeries(
  port: any,
  from: string,
  config?: GrafanaConfig | null
): Promise<MetricSeries | null> {
  const g = config === undefined ? await getMetricsConfig() : config;
  if (!g || !isPortMapped(port)) return null;

  const { rx, tx } = bitsFilters(port.zabbixInterface);
  const [rxRes, txRes] = await Promise.all([
    queryItem(g, port.zabbixHostId, rx, from),
    queryItem(g, port.zabbixHostId, tx, from),
  ]);
  if (!rxRes || !rxRes.v.length) return null;

  return {
    t: rxRes.t,
    inbound: rxRes.v.map((b) => bitsToMbps(Number(b) || 0)),
    outbound: (txRes?.v || rxRes.v.map(() => 0)).map((b) => bitsToMbps(Number(b) || 0)),
  };
}

/**
 * Current throughput for one port in Mbps, or null when unavailable.
 * Used by the alert engine — never guess here, a wrong value fires real emails.
 */
export async function portCurrentMbps(
  port: any,
  config?: GrafanaConfig | null
): Promise<{ inbound: number; outbound: number } | null> {
  const g = config === undefined ? await getMetricsConfig() : config;
  if (!g || !isPortMapped(port)) return null;

  const { rx, tx } = bitsFilters(port.zabbixInterface);
  const from = 'now-15m';
  const [rxVal, txVal] = await Promise.all([
    latestValue(g, port.zabbixHostId, rx, from),
    latestValue(g, port.zabbixHostId, tx, from),
  ]);
  if (rxVal === null && txVal === null) return null;

  return {
    inbound: rxVal === null ? 0 : bitsToMbps(rxVal),
    outbound: txVal === null ? 0 : bitsToMbps(txVal),
  };
}

/** Aggregate current throughput across many ports; null if none resolved. */
export async function portsCurrentMbps(
  ports: any[]
): Promise<{ inbound: number; outbound: number; resolved: number } | null> {
  const g = await getMetricsConfig();
  if (!g) return null;
  const samples = await Promise.all(ports.map((p) => portCurrentMbps(p, g)));
  const good = samples.filter((s): s is { inbound: number; outbound: number } => s !== null);
  if (!good.length) return null;
  return {
    inbound: Math.round(good.reduce((s, v) => s + v.inbound, 0) * 100) / 100,
    outbound: Math.round(good.reduce((s, v) => s + v.outbound, 0) * 100) / 100,
    resolved: good.length,
  };
}

export default {
  getMetricsConfig,
  queryItem,
  latestValue,
  portTrafficSeries,
  portCurrentMbps,
  portsCurrentMbps,
  isPortMapped,
  bitsToMbps,
  escapeRegex,
};
