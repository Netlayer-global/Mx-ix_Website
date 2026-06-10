import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, BarChart3, Download, FileText, Database } from 'lucide-react';
import { portalTrafficApi, AggregateTraffic, TrafficRange, PortalOrgInfo } from '../../services/api';
import { downloadCSV } from '../../shared/lg';
import { PageHeading, EmptyState, Badge } from './ui';
import TrafficChart from './TrafficChart';

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
  const [data, setData] = useState<AggregateTraffic | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (r: TrafficRange) => {
    setLoading(true);
    const res = await portalTrafficApi.getAggregate(r);
    if (res.success && res.data) setData(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

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

      {/* Range selector */}
      <div className="flex items-center gap-1 mb-6">
        {RANGES.map((r) => (
          <button
            key={r.id}
            onClick={() => setRange(r.id)}
            className={`px-4 py-2 font-mono text-label-sm tracking-mono uppercase transition-colors hover-trigger ${
              range === r.id ? 'bg-ink text-white' : 'text-gray-500 hover:text-ink border border-transparent'
            }`}
          >
            {r.label}
          </button>
        ))}
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
                <span className="font-mono text-label-sm tracking-label uppercase text-gray-400">{m.label}</span>
                <div className="text-2xl font-light tracking-tighter text-ink mt-2 tabular-nums">{fmt(m.value)}</div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <section className="bg-white border border-gray-200 p-5 mb-6">
            <h3 className="font-mono text-label tracking-label uppercase text-ink mb-4">Aggregate Throughput</h3>
            <TrafficChart series={data.series} unit={data.stats.unit} p95={data.stats.p95} height={260} />
          </section>

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
                        <th key={h} className="px-5 py-3 font-mono text-label-sm tracking-label uppercase text-gray-400 font-normal">
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
