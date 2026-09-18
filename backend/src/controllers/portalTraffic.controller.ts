import { Request, Response } from 'express';
import { Port } from '../models';
import { getEffectiveFlowGraph } from '../models/settings.model';
import {
  MetricSeries,
  GrafanaConfig,
  getMetricsConfig,
  portTrafficSeries,
  latestValue,
  escapeRegex,
  isPortMapped,
} from '../services/portMetrics.service';

/**
 * Member-facing traffic & analytics.
 *
 * Hard rule: this controller never synthesises numbers. Every figure here is
 * either measured (Zabbix via Grafana) or reported as unavailable. Members read
 * these graphs for capacity planning and the 95th-percentile value is used as a
 * billing reference, so an invented value is worse than a blank chart.
 *
 * `source` values:
 *   'zabbix'      — every contributing port returned real samples
 *   'partial'     — some ports returned samples, others are unmapped/silent
 *   'unavailable' — nothing measurable (no ports, no monitoring, or no samples)
 */

type Range = '1h' | '24h' | '7d' | '30d' | '1y';

const RANGE_FROM: Record<Range, string> = {
  '1h': 'now-1h',
  '24h': 'now-24h',
  '7d': 'now-7d',
  '30d': 'now-30d',
  '1y': 'now-1y',
};

const normalizeRange = (r?: string): Range =>
  (['1h', '24h', '7d', '30d', '1y'].includes(String(r)) ? r : '24h') as Range;

const EMPTY_SERIES: MetricSeries = { t: [], inbound: [], outbound: [] };

const percentile = (arr: number[], p: number): number | null => {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return Math.round(sorted[idx] * 100) / 100;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Stats for a series. Nulls (not zeros) when there is nothing to measure. */
const stats = (s: MetricSeries) => {
  const all = [...s.inbound, ...s.outbound];
  const has = s.inbound.length > 0;
  return {
    peakIn: has ? round2(Math.max(...s.inbound)) : null,
    peakOut: s.outbound.length ? round2(Math.max(...s.outbound)) : null,
    avgIn: has ? round2(s.inbound.reduce((a, b) => a + b, 0) / s.inbound.length) : null,
    avgOut: s.outbound.length ? round2(s.outbound.reduce((a, b) => a + b, 0) / s.outbound.length) : null,
    p95In: percentile(s.inbound, 95),
    p95Out: percentile(s.outbound, 95),
    p95: percentile(all, 95),
    unit: 'Mbps',
    samples: s.t.length,
  };
};

/** Sum several series onto the timestamps of the longest one. */
const mergeSeries = (list: MetricSeries[]): MetricSeries => {
  const usable = list.filter((s) => s.t.length);
  if (!usable.length) return EMPTY_SERIES;
  const base = usable.reduce((a, b) => (b.t.length > a.t.length ? b : a), usable[0]);
  const inbound = base.t.map((_, i) => round2(usable.reduce((sum, s) => sum + (s.inbound[i] || 0), 0)));
  const outbound = base.t.map((_, i) => round2(usable.reduce((sum, s) => sum + (s.outbound[i] || 0), 0)));
  return { t: base.t, inbound, outbound };
};

/** Why a port has no data — surfaced so members can see what to fix. */
const unavailableReason = (port: any, configured: boolean): string =>
  !configured ? 'monitoring-unconfigured' : !isPortMapped(port) ? 'port-unmapped' : 'no-samples';

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

    const g = await getMetricsConfig();
    const series = (await portTrafficSeries(port, RANGE_FROM[range], g)) || null;

    res.json({
      success: true,
      data: {
        port: { id: port._id, name: port.name, speed: port.speed, location: port.location },
        range,
        source: series ? 'zabbix' : 'unavailable',
        reason: series ? undefined : unavailableReason(port, !!g),
        series: series || EMPTY_SERIES,
        stats: stats(series || EMPTY_SERIES),
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
    const g = await getMetricsConfig();

    const results = await Promise.all(
      ports.map(async (p) => ({ port: p, series: await portTrafficSeries(p, RANGE_FROM[range], g) }))
    );

    const measured = results.filter((r) => r.series);
    const merged = mergeSeries(measured.map((r) => r.series!));
    const source = !measured.length ? 'unavailable' : measured.length === results.length ? 'zabbix' : 'partial';

    res.json({
      success: true,
      data: {
        range,
        source,
        monitoringConfigured: !!g,
        portsMeasured: measured.length,
        portsTotal: results.length,
        series: merged,
        stats: stats(merged),
        ports: results.map((r) => ({
          id: r.port._id,
          name: r.port.name,
          speed: r.port.speed,
          location: r.port.location,
          source: r.series ? 'zabbix' : 'unavailable',
          reason: r.series ? undefined : unavailableReason(r.port, !!g),
          stats: stats(r.series || EMPTY_SERIES),
          series: r.series || EMPTY_SERIES,
        })),
      },
    });
  } catch (error) {
    console.error('Aggregate traffic error:', error);
    res.status(500).json({ success: false, error: 'Failed to load traffic.' });
  }
};

/**
 * GET /api/portal/traffic/sflow?range=24h
 *
 * A per-peer-ASN breakdown can only come from sampled flow data (sFlow/IPFIX)
 * tagged with the peer ASN — SNMP interface counters cannot produce it. There is
 * no flow collector wired into this deployment yet, so this endpoint returns
 * either a configured external flow-graph embed (Grafana/Akvorado) or an honest
 * "unavailable" response. It deliberately does not fabricate a breakdown.
 */
export const getSflowByAsn = async (req: Request, res: Response): Promise<void> => {
  try {
    const range = normalizeRange(req.query.range as string);

    const fg = await getEffectiveFlowGraph();
    let embedUrl: string | undefined;
    if (fg.enabled && fg.urlTemplate) {
      const asn = req.organization?.asn;
      if (asn) embedUrl = fg.urlTemplate.replace(/\{asn\}/gi, String(asn));
    }

    res.json({
      success: true,
      data: {
        range,
        source: embedUrl ? 'embed' : 'unavailable',
        reason: embedUrl ? undefined : fg.enabled ? 'asn-missing' : 'flow-collector-unconfigured',
        unit: 'Mbps',
        t: [],
        peers: [],
        embedUrl,
      },
    });
  } catch (error) {
    console.error('sFlow traffic error:', error);
    res.status(500).json({ success: false, error: 'Failed to load sFlow traffic.' });
  }
};

/** Resolve link status / latency / loss for one port. No invented values. */
async function healthForPort(port: any, g: GrafanaConfig | null) {
  let status: 'up' | 'down' | 'unknown' = 'unknown';
  let statusSource: 'zabbix' | 'provisioning' | 'unavailable' = 'unavailable';
  let latencyMs: number | null = null;
  let lossPct: number | null = null;
  let availabilityPct: number | null = null;

  // Provisioning state is a real fact about the port, just not a live link state.
  if (port.status) {
    status = port.status === 'active' ? 'up' : 'unknown';
    statusSource = 'provisioning';
  }

  if (g && isPortMapped(port)) {
    const from = 'now-10m';
    const iface = (port.zabbixInterface || '').trim();
    const ifScope = iface ? escapeRegex(iface) : '';
    const [st, lat, loss, avail] = await Promise.all([
      latestValue(g, port.zabbixHostId, iface ? `/${ifScope}.*[Oo]perational status/` : '/[Oo]perational status/', from),
      latestValue(g, port.zabbixHostId, '/(icmppingsec|[Rr]esponse time|[Ll]atency)/', from),
      latestValue(g, port.zabbixHostId, '/(icmppingloss|[Pp]acket loss)/', from),
      latestValue(g, port.zabbixHostId, '/([Aa]vailability|[Uu]ptime percent)/', 'now-24h'),
    ]);
    if (st !== null) {
      status = st === 1 ? 'up' : 'down';
      statusSource = 'zabbix';
    }
    if (lat !== null) {
      // icmppingsec is in seconds; anything under 10 is treated as seconds.
      latencyMs = lat < 10 ? Math.round(lat * 1000 * 100) / 100 : Math.round(lat * 100) / 100;
    }
    if (loss !== null) lossPct = Math.round(loss * 100) / 100;
    if (avail !== null) availabilityPct = Math.round(Math.min(100, avail) * 100) / 100;
  }

  const anyLive = statusSource === 'zabbix' || latencyMs !== null || lossPct !== null || availabilityPct !== null;
  const allLive = statusSource === 'zabbix' && latencyMs !== null && lossPct !== null && availabilityPct !== null;

  return {
    status,
    statusSource,
    latencyMs,
    lossPct,
    availabilityPct,
    source: allLive ? 'zabbix' : anyLive ? 'partial' : 'unavailable',
    reason: anyLive ? undefined : unavailableReason(port, !!g),
  };
}

/**
 * GET /api/portal/ports/:portId/health
 */
export const getPortHealth = async (req: Request, res: Response): Promise<void> => {
  try {
    const port = await Port.findOne({ _id: req.params.portId, organization: req.organization!._id });
    if (!port) {
      res.status(404).json({ success: false, error: 'Port not found.' });
      return;
    }
    const g = await getMetricsConfig();
    res.json({ success: true, data: await healthForPort(port, g) });
  } catch (error) {
    console.error('Port health error:', error);
    res.status(500).json({ success: false, error: 'Failed to load port health.' });
  }
};

/**
 * GET /api/portal/ports/health
 * Batch health for every port on the account — one round trip instead of the
 * client firing a request per port.
 */
export const getAllPortsHealth = async (req: Request, res: Response): Promise<void> => {
  try {
    const ports = await Port.find({ organization: req.organization!._id }).sort({ order: 1, name: 1 });
    const g = await getMetricsConfig();
    const entries = await Promise.all(
      ports.map(async (p) => [String(p._id), await healthForPort(p, g)] as const)
    );
    res.json({ success: true, data: Object.fromEntries(entries) });
  } catch (error) {
    console.error('Ports health error:', error);
    res.status(500).json({ success: false, error: 'Failed to load port health.' });
  }
};

export default { getPortTraffic, getAggregateTraffic, getSflowByAsn, getPortHealth, getAllPortsHealth };
