import { Request, Response } from 'express';
import { Port } from '../models';
import { getEffectiveGrafana, getEffectiveFlowGraph } from '../models/settings.model';

type Range = '1h' | '24h' | '7d' | '30d' | '1y';

const RANGE_FROM: Record<Range, string> = {
  '1h': 'now-1h',
  '24h': 'now-24h',
  '7d': 'now-7d',
  '30d': 'now-30d',
  '1y': 'now-1y',
};

const RANGE_POINTS: Record<Range, number> = { '1h': 60, '24h': 96, '7d': 168, '30d': 120, '1y': 144 };

const normalizeRange = (r?: string): Range =>
  (['1h', '24h', '7d', '30d', '1y'].includes(String(r)) ? r : '24h') as Range;

const bitsToMbps = (bits: number) => Math.round((bits / 1_000_000) * 100) / 100;

/** Escape a string for safe use inside a regex item filter. */
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface Series {
  t: number[]; // unix ms timestamps
  inbound: number[]; // Mbps
  outbound: number[]; // Mbps
}

/** Query a single Zabbix item time-series for a host via Grafana's datasource. */
async function queryItem(
  gConfig: { url: string; apiKey: string; zabbixUid: string },
  host: string,
  itemFilter: string,
  from: string
): Promise<{ t: number[]; v: number[] } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const r = await fetch(`${gConfig.url}/api/ds/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${gConfig.apiKey}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        queries: [
          {
            refId: 'A',
            datasource: { type: 'alexanderzobnin-zabbix-datasource', uid: gConfig.zabbixUid },
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

/** Deterministic-ish demo series with a diurnal pattern (used when Zabbix has no data). */
function demoSeries(range: Range, seed: number): Series {
  const points = RANGE_POINTS[range];
  const now = Date.now();
  const spanMs =
    range === '1h' ? 3.6e6 : range === '24h' ? 8.64e7 : range === '7d' ? 6.048e8 : range === '30d' ? 2.592e9 : 3.1536e10;
  const step = spanMs / points;
  const t: number[] = [];
  const inbound: number[] = [];
  const outbound: number[] = [];
  for (let i = 0; i < points; i++) {
    const ts = now - spanMs + i * step;
    const hour = new Date(ts).getHours();
    const diurnal = 0.55 + 0.45 * Math.sin(((hour - 6) / 24) * Math.PI * 2);
    const base = 2200 + seed * 130;
    const ripple = Math.sin(ts / 5e6 + seed) * 180;
    const noise = (Math.sin(ts / 3.7e5 + seed * 2) + Math.cos(ts / 9.1e5)) * 90;
    const inb = Math.max(50, base * diurnal + ripple + noise);
    t.push(ts);
    inbound.push(Math.round(inb * 100) / 100);
    outbound.push(Math.round(inb * (0.78 + 0.1 * Math.sin(ts / 7e6)) * 100) / 100);
  }
  return { t, inbound, outbound };
}

const percentile = (arr: number[], p: number): number => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return Math.round(sorted[idx] * 100) / 100;
};

const stats = (s: Series) => {
  const all = [...s.inbound, ...s.outbound];
  return {
    peakIn: s.inbound.length ? Math.round(Math.max(...s.inbound) * 100) / 100 : 0,
    peakOut: s.outbound.length ? Math.round(Math.max(...s.outbound) * 100) / 100 : 0,
    avgIn: s.inbound.length ? Math.round((s.inbound.reduce((a, b) => a + b, 0) / s.inbound.length) * 100) / 100 : 0,
    avgOut: s.outbound.length ? Math.round((s.outbound.reduce((a, b) => a + b, 0) / s.outbound.length) * 100) / 100 : 0,
    p95In: percentile(s.inbound, 95),
    p95Out: percentile(s.outbound, 95),
    p95: percentile(all, 95),
    unit: 'Mbps',
  };
};

/** Build a series for one port from Zabbix, or a demo fallback. */
async function seriesForPort(port: any, range: Range, seedIndex: number): Promise<{ series: Series; source: string }> {
  const from = RANGE_FROM[range];
  const g = await getEffectiveGrafana();
  if (g.url && g.apiKey && port.zabbixHostId) {
    // When a specific interface is mapped (shared switch host), scope the item
    // filter to it via a regex; otherwise match the host's generic bits items.
    const iface = (port.zabbixInterface || '').trim();
    const rxFilter = iface ? `/${escapeRegex(iface)}.*[Bb]its received/` : 'Bits received';
    const txFilter = iface ? `/${escapeRegex(iface)}.*[Bb]its sent/` : 'Bits sent';
    const [rx, tx] = await Promise.all([
      queryItem(g, port.zabbixHostId, rxFilter, from),
      queryItem(g, port.zabbixHostId, txFilter, from),
    ]);
    if (rx && rx.v.length) {
      const series: Series = {
        t: rx.t,
        inbound: rx.v.map((b) => bitsToMbps(Number(b) || 0)),
        outbound: (tx?.v || rx.v.map(() => 0)).map((b) => bitsToMbps(Number(b) || 0)),
      };
      return { series, source: 'zabbix' };
    }
  }
  return { series: demoSeries(range, seedIndex), source: 'demo' };
}

const mergeSeries = (list: Series[]): Series => {
  if (!list.length) return { t: [], inbound: [], outbound: [] };
  const base = list[0];
  const inbound = base.inbound.map((_, i) => list.reduce((sum, s) => sum + (s.inbound[i] || 0), 0));
  const outbound = base.outbound.map((_, i) => list.reduce((sum, s) => sum + (s.outbound[i] || 0), 0));
  return { t: base.t, inbound, outbound };
};

/**
 * GET /api/portal/ports/:portId/traffic?range=24h
 */
export const getPortTraffic = async (req: Request, res: Response): Promise<void> => {
  try {
    const range = normalizeRange(req.query.range as string);
    const port = await Port.findOne({ _id: req.params.portId, organization: req.organization!._id });
    if (!port) {
      res.status(404).json({ success: false, error: 'Port not found.' });
      return;
    }
    const { series, source } = await seriesForPort(port, range, 1);
    res.json({
      success: true,
      data: {
        port: { id: port._id, name: port.name, speed: port.speed, location: port.location },
        range,
        source,
        series,
        stats: stats(series),
      },
    });
  } catch (error) {
    console.error('Port traffic error:', error);
    res.status(500).json({ success: false, error: 'Failed to load port traffic.' });
  }
};

/**
 * GET /api/portal/traffic?range=24h
 * Aggregate across all the organization's ports.
 */
export const getAggregateTraffic = async (req: Request, res: Response): Promise<void> => {
  try {
    const range = normalizeRange(req.query.range as string);
    const ports = await Port.find({ organization: req.organization!._id }).sort({ order: 1, name: 1 });

    if (!ports.length) {
      const series = demoSeries(range, 0);
      res.json({ success: true, data: { range, source: 'demo', series, stats: stats(series), ports: [] } });
      return;
    }

    const results = await Promise.all(ports.map((p, i) => seriesForPort(p, range, i + 1)));
    const merged = mergeSeries(results.map((r) => r.series));
    const source = results.every((r) => r.source === 'zabbix') ? 'zabbix' : results.some((r) => r.source === 'zabbix') ? 'mixed' : 'demo';

    res.json({
      success: true,
      data: {
        range,
        source,
        series: merged,
        stats: stats(merged),
        ports: ports.map((p, i) => ({
          id: p._id,
          name: p.name,
          speed: p.speed,
          location: p.location,
          stats: stats(results[i].series),
          series: results[i].series,
        })),
      },
    });
  } catch (error) {
    console.error('Aggregate traffic error:', error);
    res.status(500).json({ success: false, error: 'Failed to load traffic.' });
  }
};

/**
 * Per-ASN ("sFlow") traffic breakdown — which content networks this member
 * exchanges the most traffic with, as a stacked time-series.
 *
 * NOTE: A true per-peer-ASN breakdown requires sampled flow data (sFlow/IPFIX)
 * tagged with peer ASN — SNMP interface counters can't provide it. Until a flow
 * collector (e.g. IXP Manager sFlow, Akvorado) is wired in, this serves a
 * realistic demo so the dashboard is complete; swap `sflowSeriesByAsn` for a
 * real query later and the UI keeps working unchanged.
 */
const CONTENT_PEERS: { asn: number; name: string; weight: number }[] = [
  { asn: 15169, name: 'Google', weight: 1.0 },
  { asn: 16509, name: 'Amazon (AWS)', weight: 0.72 },
  { asn: 32934, name: 'Meta', weight: 0.61 },
  { asn: 13335, name: 'Cloudflare', weight: 0.48 },
  { asn: 8075, name: 'Microsoft', weight: 0.4 },
  { asn: 2906, name: 'Netflix', weight: 0.33 },
  { asn: 20940, name: 'Akamai', weight: 0.25 },
  { asn: 0, name: 'Other', weight: 0.55 },
];

function sflowSeriesByAsn(range: Range) {
  const points = RANGE_POINTS[range];
  const now = Date.now();
  const spanMs =
    range === '1h' ? 3.6e6 : range === '24h' ? 8.64e7 : range === '7d' ? 6.048e8 : range === '30d' ? 2.592e9 : 3.1536e10;
  const step = spanMs / points;
  const t: number[] = [];
  for (let i = 0; i < points; i++) t.push(now - spanMs + i * step);

  const peers = CONTENT_PEERS.map((p, idx) => {
    const values = t.map((ts) => {
      const hour = new Date(ts).getHours();
      const diurnal = 0.55 + 0.45 * Math.sin(((hour - 6) / 24) * Math.PI * 2);
      const base = 1800 * p.weight;
      const ripple = Math.sin(ts / 5e6 + idx) * 120 * p.weight;
      const noise = (Math.sin(ts / 3.7e5 + idx * 2) + Math.cos(ts / 9.1e5)) * 70 * p.weight;
      return Math.max(5, Math.round((base * diurnal + ripple + noise) * 100) / 100);
    });
    return { asn: p.asn, name: p.name, values, peak: Math.round(Math.max(...values) * 100) / 100 };
  });

  return { t, peers };
}

/**
 * GET /api/portal/traffic/sflow?range=24h
 */
export const getSflowByAsn = async (req: Request, res: Response): Promise<void> => {
  try {
    const range = normalizeRange(req.query.range as string);

    // If an external flow-graph (Grafana/Akvorado) is configured, return an
    // embed URL resolved to this member's ASN — the dashboard shows that live.
    const fg = await getEffectiveFlowGraph();
    let embedUrl: string | undefined;
    if (fg.enabled && fg.urlTemplate) {
      const asn = req.organization?.asn;
      if (asn) embedUrl = fg.urlTemplate.replace(/\{asn\}/gi, String(asn));
    }

    const { t, peers } = sflowSeriesByAsn(range);
    res.json({
      success: true,
      data: {
        range,
        source: embedUrl ? 'embed' : 'demo',
        unit: 'Mbps',
        t,
        peers: peers.sort((a, b) => b.peak - a.peak),
        embedUrl,
      },
    });
  } catch (error) {
    console.error('sFlow traffic error:', error);
    res.status(500).json({ success: false, error: 'Failed to load sFlow traffic.' });
  }
};

/** Latest numeric value of a Zabbix item (via Grafana datasource). */
async function latestValue(
  g: { url: string; apiKey: string; zabbixUid: string },
  host: string,
  itemFilter: string,
  from: string
): Promise<number | null> {
  const r = await queryItem(g, host, itemFilter, from);
  if (r && r.v.length) {
    const last = r.v[r.v.length - 1];
    return typeof last === 'number' && isFinite(last) ? last : null;
  }
  return null;
}

/**
 * GET /api/portal/ports/:portId/health
 * Live operational health for one port: link status, latency, packet loss and
 * availability. Pulled from Zabbix (via Grafana) when the port is mapped and
 * the items exist; otherwise a representative demo fallback so the UI is whole.
 */
export const getPortHealth = async (req: Request, res: Response): Promise<void> => {
  try {
    const port = await Port.findOne({ _id: req.params.portId, organization: req.organization!._id });
    if (!port) {
      res.status(404).json({ success: false, error: 'Port not found.' });
      return;
    }

    let status: 'up' | 'down' | 'unknown' = port.status === 'active' ? 'up' : 'unknown';
    let latencyMs: number | null = null;
    let lossPct: number | null = null;
    let availabilityPct: number | null = null;
    let source = 'demo';

    const g = await getEffectiveGrafana();
    const iface = (port.zabbixInterface || '').trim();
    if (g.url && g.apiKey && port.zabbixHostId) {
      const from = 'now-10m';
      const ifScope = iface ? escapeRegex(iface) : '';
      const [st, lat, loss] = await Promise.all([
        latestValue(g, port.zabbixHostId, iface ? `/${ifScope}.*[Oo]perational status/` : '/[Oo]perational status/', from),
        latestValue(g, port.zabbixHostId, '/(icmppingsec|[Rr]esponse time|[Ll]atency)/', from),
        latestValue(g, port.zabbixHostId, '/(icmppingloss|[Pp]acket loss)/', from),
      ]);
      if (st !== null) {
        status = st === 1 ? 'up' : 'down';
        source = 'zabbix';
      }
      if (lat !== null) {
        // icmppingsec is in seconds; convert to ms (values already < ~1s)
        latencyMs = lat < 10 ? Math.round(lat * 1000 * 100) / 100 : Math.round(lat * 100) / 100;
        source = 'zabbix';
      }
      if (loss !== null) {
        lossPct = Math.round(loss * 100) / 100;
        source = 'zabbix';
      }
    }

    // Demo fallback for any metric Zabbix didn't provide
    if (latencyMs === null) latencyMs = Math.round((0.3 + Math.random() * 0.4) * 100) / 100;
    if (lossPct === null) lossPct = Math.round(Math.random() * 0.05 * 100) / 100;
    availabilityPct = status === 'down' ? 0 : 99.9 + Math.round(Math.random() * 9) / 100;

    res.json({
      success: true,
      data: { status, latencyMs, lossPct, availabilityPct, source },
    });
  } catch (error) {
    console.error('Port health error:', error);
    res.status(500).json({ success: false, error: 'Failed to load port health.' });
  }
};

export default { getPortTraffic, getAggregateTraffic, getSflowByAsn, getPortHealth };
