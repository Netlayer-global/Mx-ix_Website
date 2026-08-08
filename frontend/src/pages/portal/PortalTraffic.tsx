import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Loader2, BarChart3, Download, FileText, Database, Network as NetIcon } from 'lucide-react';
import { portalTrafficApi, AggregateTraffic, SflowTraffic, PortHealth, TrafficRange, PortalOrgInfo } from '../../services/api';
import { downloadCSV } from '../../shared/lg';
import { PageHeading, EmptyState, Badge } from './ui';
import TrafficChart from './TrafficChart';
import { MultiLineChart, StackedAreaChart, SERIES_COLORS, NamedSeries } from './TrafficCharts';

interface Props {
  org: PortalOrgInfo;
}

const RANGES: { id: TrafficRange; label: string }[] = [
  { id: '1h', label: '1H' },
  { id: '24h', label: '24H' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '1y', label: '1Y' },
];

const fmt = (mbps: number): string => (mbps >= 1000 ? `${(mbps / 1000).toFixed(2)} Gbps` : `${mbps.toFixed(0)} Mbps`);

const PortalTraffic: React.FC<Props> = ({ org }) => {
  const [range, setRange] = useState<TrafficRange>('24h');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState<AggregateTraffic | null>(null);
  const [sflow, setSflow] = useState<SflowTraffic | null>(null);
  const [health, setHealth] = useState<Record<string, PortHealth>>({});
  const [breakdown, setBreakdown] = useState<'port' | 'location'>('port');
  const [loading, setLoading] = useState(true);

  /** Map a custom date window to the nearest backend-supported range. */
  const applyCustomRange = () => {
    if (!customFrom || !customTo) return;
    const diffDays = Math.ceil(
      (new Date(customTo).getTime() - new Date(customFrom).getTime()) / (1000 * 60 * 60 * 24)
    );
    let best: TrafficRange = '24h';
    if (diffDays <= 0) best = '1h';
    else if (diffDays <= 1) best = '24h';
    else if (diffDays <= 7) best = '7d';
    else if (diffDays <= 30) best = '30d';
    else best = '1y';
    setRange(best);
  };

  const load = useCallback(async (r: TrafficRange) => {
    setLoading(true);
    const [agg, sf] = await Promise.all([portalTrafficApi.getAggregate(r), portalTrafficApi.getSflow(r)]);
    if (agg.success && agg.data) {
      setData(agg.data);
      // Per-port operational health (status/latency/loss/availability), best-effort
      const entries = await Promise.all(
        agg.data.ports.map(async (p) => {
          const h = await portalTrafficApi.getPortHealth(p.id);
          return [p.id, h.success && h.data ? h.data : null] as const;
        })
      );
      setHealth(Object.fromEntries(entries.filter(([, v]) => v)) as Record<string, PortHealth>);
    }
    if (sf.success && sf.data) setSflow(sf.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  // Per-port and per-location line series (inbound Mbps), derived from the
  // per-port time-series the API now returns.
  const { breakdownT, breakdownSeries } = useMemo(() => {
    const withSeries = (data?.ports || []).filter((p) => p.series && p.series.t.length);
    if (!withSeries.length) return { breakdownT: [] as number[], breakdownSeries: [] as NamedSeries[] };
    const t = withSeries[0].series!.t;

    if (breakdown === 'port') {
      const series: NamedSeries[] = withSeries.map((p, i) => ({
        name: p.name,
        color: SERIES_COLORS[i % SERIES_COLORS.length],
        values: p.series!.inbound,
      }));
      return { breakdownT: t, breakdownSeries: series };
    }

    // Group by location → sum inbound across ports sharing a location
    const byLoc = new Map<string, number[]>();
    withSeries.forEach((p) => {
      const loc = p.location || 'Unspecified';
      const acc = byLoc.get(loc) || new Array(t.length).fill(0);
      p.series!.inbound.forEach((v, i) => (acc[i] += v || 0));
      byLoc.set(loc, acc);
    });
    const series: NamedSeries[] = Array.from(byLoc.entries()).map(([name, values], i) => ({
      name,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
      values,
    }));
    return { breakdownT: t, breakdownSeries: series };
  }, [data, breakdown]);

  const sflowLayers: NamedSeries[] = useMemo(
    () =>
      (sflow?.peers || []).map((p, i) => ({
        name: p.asn ? `${p.name} (AS${p.asn})` : p.name,
        color: SERIES_COLORS[i % SERIES_COLORS.length],
        values: p.values,
      })),
    [sflow]
  );

  // Per-location rollup: sum each location's ports and derive peak/95th.
  const locationSummary = useMemo(() => {
    const withSeries = (data?.ports || []).filter((p) => p.series && p.series.t.length);
    const byLoc = new Map<string, { ports: number; inbound: number[]; outbound: number[] }>();
    withSeries.forEach((p) => {
      const loc = p.location || 'Unspecified';
      const cur = byLoc.get(loc) || { ports: 0, inbound: [], outbound: [] };
      cur.ports += 1;
      p.series!.inbound.forEach((v, i) => (cur.inbound[i] = (cur.inbound[i] || 0) + (v || 0)));
      p.series!.outbound.forEach((v, i) => (cur.outbound[i] = (cur.outbound[i] || 0) + (v || 0)));
      byLoc.set(loc, cur);
    });
    const pct = (arr: number[], p: number) => {
      if (!arr.length) return 0;
      const s = [...arr].sort((a, b) => a - b);
      return s[Math.max(0, Math.ceil((p / 100) * s.length) - 1)] || 0;
    };
    return Array.from(byLoc.entries()).map(([location, v]) => ({
      location,
      ports: v.ports,
      peakIn: v.inbound.length ? Math.max(...v.inbound) : 0,
      peakOut: v.outbound.length ? Math.max(...v.outbound) : 0,
      p95: pct([...v.inbound, ...v.outbound], 95),
    }));
  }, [data]);

  const exportCsv = () => {
    if (!data) return;
    downloadCSV(
      `mx-ix-traffic-${range}.csv`,
      ['Timestamp', 'Inbound (Mbps)', 'Outbound (Mbps)'],
      data.series.t.map((t, i) => [
        new Date(t).toISOString(),
        data.series.inbound[i] ?? 0,
        data.series.outbound[i] ?? 0,
      ])
    );
  };

  const downloadReport = () => {
    if (!data) return;
    const s = data.stats;
    const win = window.open('', '_blank');
    if (!win) return;
    const rows = data.ports
      .map(
        (p) =>
          `<tr><td>${p.name}</td><td>${p.speed}</td><td>${p.location || '—'}</td><td>${fmt(p.stats.p95)}</td><td>${fmt(
            p.stats.peakIn
          )}</td><td>${fmt(p.stats.peakOut)}</td></tr>`
      )
      .join('');
    win.document.write(`<!doctype html><html><head><title>MX-IX Traffic Report — ${org.name}</title>
      <style>
        *{font-family:Arial,Helvetica,sans-serif;color:#0A0A0B}
        body{padding:40px;max-width:900px;margin:0 auto}
        .bar{height:4px;background:#F20732;width:100%;margin-bottom:24px}
        h1{font-size:28px;margin:0 0 4px} .sub{color:#666;font-size:13px;margin-bottom:24px}
        .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0}
        .card{border:1px solid #e5e7eb;padding:16px}
        .label{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#888}
        .val{font-size:22px;margin-top:6px}
        table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}
        th,td{border:1px solid #e5e7eb;padding:8px;text-align:left}
        th{background:#f9fafb;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#666}
        .foot{margin-top:32px;color:#999;font-size:11px}
      </style></head><body>
      <div class="bar"></div>
      <h1>MX-IX Traffic Report</h1>
      <div class="sub">${org.name}${org.asn ? ` · AS${org.asn}` : ''} · Range: ${range.toUpperCase()} · Generated ${new Date().toLocaleString()}</div>
      <div class="grid">
        <div class="card"><div class="label">95th Percentile</div><div class="val">${fmt(s.p95)}</div></div>
        <div class="card"><div class="label">Peak Inbound</div><div class="val">${fmt(s.peakIn)}</div></div>
        <div class="card"><div class="label">Peak Outbound</div><div class="val">${fmt(s.peakOut)}</div></div>
        <div class="card"><div class="label">Avg Inbound</div><div class="val">${fmt(s.avgIn)}</div></div>
        <div class="card"><div class="label">Avg Outbound</div><div class="val">${fmt(s.avgOut)}</div></div>
        <div class="card"><div class="label">Data Source</div><div class="val" style="text-transform:capitalize">${data.source}</div></div>
      </div>
      <h3>Per-port summary</h3>
      <table><thead><tr><th>Port</th><th>Speed</th><th>Location</th><th>95th</th><th>Peak In</th><th>Peak Out</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">No ports</td></tr>'}</tbody></table>
      <div class="foot">MX-IX — Carrier-Neutral Internet Exchange. This report is generated from monitoring data and provided for informational purposes.</div>
      <script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
      </body></html>`);
    win.document.close();
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeading
          eyebrow="// Analytics"
          title="Traffic & Analytics"
          subtitle="Aggregate and per-port traffic across your MX-IX connections, with 95th-percentile billing reference."
        />
        <div className="flex items-center gap-2 flex-wrap">
          {data && (
            <span className="inline-flex items-center gap-1.5">
              <Badge tone={data.source === 'zabbix' ? 'green' : data.source === 'mixed' ? 'amber' : 'gray'}>
                <Database className="w-3 h-3" /> {data.source}
              </Badge>
            </span>
          )}
          <button
            onClick={exportCsv}
            disabled={!data}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 font-mono text-label-sm tracking-mono uppercase text-ink hover:border-ink transition-colors hover-trigger disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={downloadReport}
            disabled={!data}
            className="flex items-center gap-2 px-4 py-2.5 bg-ink text-white font-mono text-label-sm tracking-mono uppercase hover:bg-[#F20732] transition-colors hover-trigger disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5" /> Report
          </button>
        </div>
      </div>

      {/* Range selector + custom date picker */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => { setRange(r.id); setCustomFrom(''); setCustomTo(''); }}
              className={`cursor-pointer px-4 py-2 font-mono text-label-sm tracking-mono uppercase transition-colors duration-200 hover-trigger ${
                range === r.id && !customFrom ? 'bg-ink text-white' : 'text-gray-500 hover:text-ink border border-transparent'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <span className="hidden sm:block h-5 w-px bg-gray-200" aria-hidden="true" />

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500">From</span>
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="border border-gray-300 px-2.5 py-1.5 text-xs font-mono text-ink focus:border-ink focus:outline-none transition-colors"
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500">To</span>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setCustomTo(e.target.value)}
              className="border border-gray-300 px-2.5 py-1.5 text-xs font-mono text-ink focus:border-ink focus:outline-none transition-colors"
            />
          </label>
          {customFrom && customTo && (
            <button
              onClick={applyCustomRange}
              className="cursor-pointer bg-ink px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-white transition-colors duration-200 hover:bg-[#F20732]"
            >
              Apply
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-[#F20732]" />
        </div>
      ) : !data ? (
        <EmptyState icon={<BarChart3 className="w-10 h-10" />} title="No traffic data" />
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200 border border-gray-200 mb-6">
            {[
              { label: '95th Percentile', value: data.stats.p95 },
              { label: 'Peak Inbound', value: data.stats.peakIn },
              { label: 'Peak Outbound', value: data.stats.peakOut },
              { label: 'Avg Inbound', value: data.stats.avgIn },
            ].map((m) => (
              <div key={m.label} className="bg-white p-5">
                <span className="font-mono text-label-sm tracking-label uppercase text-gray-500">{m.label}</span>
                <div className="text-2xl font-light tracking-tighter text-ink mt-2 tabular-nums">{fmt(m.value)}</div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <section className="bg-white border border-gray-200 p-5 sm:p-7 mb-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="eyebrow text-ink">Aggregate Throughput</h3>
              <span className="font-mono text-[9px] uppercase tracking-label text-gray-400">
                {data.source === 'zabbix' ? 'Live' : 'Simulated'} · {data.series.t.length} samples
              </span>
            </div>
            <TrafficChart series={data.series} unit={data.stats.unit} p95={data.stats.p95} height={300} />
          </section>

          {/* Graph 1: Port-wise / Location-wise breakdown */}
          <section className="bg-white border border-gray-200 p-5 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <h3 className="font-mono text-label tracking-label uppercase text-ink">
                Inbound by {breakdown === 'port' ? 'Port' : 'Location'}
              </h3>
              <div className="flex items-center gap-1">
                {(['port', 'location'] as const).map((b) => (
                  <button
                    key={b}
                    onClick={() => setBreakdown(b)}
                    className={`px-3 py-1.5 font-mono text-label-sm tracking-mono uppercase transition-colors hover-trigger ${
                      breakdown === b ? 'bg-ink text-white' : 'text-gray-500 hover:text-ink border border-gray-200'
                    }`}
                  >
                    By {b}
                  </button>
                ))}
              </div>
            </div>
            {breakdownSeries.length ? (
              <MultiLineChart t={breakdownT} series={breakdownSeries} unit={data.stats.unit} height={260} />
            ) : (
              <div className="py-10">
                <EmptyState icon={<NetIcon className="w-8 h-8" />} title="No per-port data yet" hint="Per-port graphs appear once your ports are linked to a metrics source." />
              </div>
            )}
          </section>

          {/* Graph 2: Per-ASN content traffic (sFlow) */}
          <section className="bg-white border border-gray-200 p-5 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <h3 className="font-mono text-label tracking-label uppercase text-ink">Traffic by Network (sFlow)</h3>
              {sflow && (
                <Badge tone={sflow.source === 'embed' || sflow.source === 'sflow' ? 'green' : 'gray'}>
                  <Database className="w-3 h-3" /> {sflow.source}
                </Badge>
              )}
            </div>
            {sflow?.embedUrl ? (
              <iframe
                src={sflow.embedUrl}
                title="Per-ASN sFlow traffic"
                className="w-full border border-gray-200 rounded"
                style={{ height: 320 }}
              />
            ) : sflowLayers.length ? (
              <StackedAreaChart t={sflow!.t} layers={sflowLayers} height={300} />
            ) : (
              <div className="py-10">
                <EmptyState icon={<BarChart3 className="w-8 h-8" />} title="No flow data" />
              </div>
            )}
            <p className="text-xs text-gray-500 mt-3 font-mono">
              Per-ASN breakdown of which content networks you exchange the most traffic with. Requires sFlow/IPFIX
              data; shows representative figures until a flow collector is connected.
            </p>
          </section>

          {/* Graph 3: Peer-to-Peer traffic (sFlow embed per-ASN) */}
          {sflow?.embedUrl && org?.asn && (
            <section className="bg-white border border-gray-200 p-5 mb-6">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <h3 className="font-mono text-label tracking-label uppercase text-ink">Peer-to-Peer Traffic</h3>
                <Badge tone="green">
                  <NetIcon className="w-3 h-3" /> sFlow P2P
                </Badge>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Per-peer traffic breakdown showing which networks you exchange the most traffic with on this IX.
                This view is powered by sFlow/IPFIX collection and shows your ASN's traffic split by peer ASN.
              </p>
              <iframe
                src={sflow.embedUrl.replace('{asn}', String(org.asn))}
                title="Peer-to-peer sFlow traffic"
                className="w-full border border-gray-200 rounded"
                style={{ height: 400 }}
                loading="lazy"
              />
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 font-mono">
                <span>Your ASN: AS{org.asn}</span>
                <span>Range: {range}</span>
                <span>Source: sFlow/IPFIX via Akvorado/pmacct</span>
              </div>
            </section>
          )}

          {/* Port health: status, latency, packet loss, availability */}
          {data.ports.length > 0 && (
            <section className="bg-white border border-gray-200 mb-6">
              <div className="px-5 py-4 border-b border-gray-200">
                <h3 className="font-mono text-label tracking-label uppercase text-ink">Port Health</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {data.ports.map((p) => {
                  const h = health[p.id];
                  const up = h?.status === 'up';
                  const down = h?.status === 'down';
                  return (
                    <div key={p.id} className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <div className="font-bold text-sm truncate">{p.name}</div>
                        <div className="font-mono text-xs text-gray-500">{p.location || '—'} · {p.speed}</div>
                      </div>
                      <div className="flex items-center gap-5 flex-wrap">
                        <HealthStat label="Status" value={h ? (up ? 'Up' : down ? 'Down' : 'Unknown') : '—'} tone={up ? 'green' : down ? 'red' : 'gray'} />
                        <HealthStat label="Latency" value={h?.latencyMs != null ? `${h.latencyMs} ms` : '—'} />
                        <HealthStat label="Packet Loss" value={h?.lossPct != null ? `${h.lossPct}%` : '—'} tone={h && h.lossPct! > 1 ? 'amber' : 'ink'} />
                        <HealthStat label="Availability" value={h?.availabilityPct != null ? `${h.availabilityPct}%` : '—'} />
                        {h && (
                          <Badge tone={h.source === 'zabbix' ? 'green' : 'gray'}>
                            <Database className="w-3 h-3" /> {h.source}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Per-location summary (useful for one ASN across multiple sites) */}
          {locationSummary.length > 0 && (
            <section className="bg-white border border-gray-200 mb-6">
              <div className="px-5 py-4 border-b border-gray-200">
                <h3 className="font-mono text-label tracking-label uppercase text-ink">Per-location summary</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      {['Location', 'Ports', '95th', 'Peak In', 'Peak Out'].map((h) => (
                        <th key={h} className="px-5 py-3 font-mono text-label-sm tracking-label uppercase text-gray-500 font-normal">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {locationSummary.map((l) => (
                      <tr key={l.location} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-bold text-ink">{l.location}</td>
                        <td className="px-5 py-3 font-mono tabular-nums text-gray-600">{l.ports}</td>
                        <td className="px-5 py-3 font-mono tabular-nums">{fmt(l.p95)}</td>
                        <td className="px-5 py-3 font-mono tabular-nums text-[#F20732]">{fmt(l.peakIn)}</td>
                        <td className="px-5 py-3 font-mono tabular-nums">{fmt(l.peakOut)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Per-port */}
          {data.ports.length > 0 && (
            <section className="bg-white border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-200">
                <h3 className="font-mono text-label tracking-label uppercase text-ink">Per-port breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      {['Port', 'Speed', 'Location', '95th', 'Peak In', 'Peak Out', 'Avg In'].map((h) => (
                        <th key={h} className="px-5 py-3 font-mono text-label-sm tracking-label uppercase text-gray-500 font-normal">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.ports.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-bold text-ink">{p.name}</td>
                        <td className="px-5 py-3 font-mono text-gray-600">{p.speed}</td>
                        <td className="px-5 py-3 text-gray-600">{p.location || '—'}</td>
                        <td className="px-5 py-3 font-mono tabular-nums">{fmt(p.stats.p95)}</td>
                        <td className="px-5 py-3 font-mono tabular-nums text-[#F20732]">{fmt(p.stats.peakIn)}</td>
                        <td className="px-5 py-3 font-mono tabular-nums">{fmt(p.stats.peakOut)}</td>
                        <td className="px-5 py-3 font-mono tabular-nums text-gray-600">{fmt(p.stats.avgIn)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default PortalTraffic;

const HEALTH_TONE: Record<string, string> = {
  green: 'text-green-600',
  red: 'text-[#F20732]',
  amber: 'text-amber-600',
  gray: 'text-gray-400',
  ink: 'text-ink',
};

const HealthStat: React.FC<{ label: string; value: string; tone?: 'green' | 'red' | 'amber' | 'gray' | 'ink' }> = ({
  label,
  value,
  tone = 'ink',
}) => (
  <div className="text-right">
    <div className="font-mono text-[10px] tracking-label uppercase text-gray-500">{label}</div>
    <div className={`text-sm font-bold tabular-nums ${HEALTH_TONE[tone]}`}>{value}</div>
  </div>
);
