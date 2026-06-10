import { Request, Response } from 'express';
import { Port } from '../models';
import { getEffectiveGrafana } from '../models/settings.model';

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
    const timeout = setTimeout(() => controller.abort(), 20000);
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
    const [rx, tx] = await Promise.all([
      queryItem(g, port.zabbixHostId, 'Bits received', from),
      queryItem(g, port.zabbixHostId, 'Bits sent', from),
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
        })),
      },
    });
  } catch (error) {
    console.error('Aggregate traffic error:', error);
    res.status(500).json({ success: false, error: 'Failed to load traffic.' });
  }
};

export default { getPortTraffic, getAggregateTraffic };
