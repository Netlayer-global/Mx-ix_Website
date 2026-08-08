import React, { useMemo, useState } from 'react';

const W = 1000;
const PAD = 4;

export const fmtRate = (mbps: number): string =>
  mbps >= 1000 ? `${(mbps / 1000).toFixed(2)} Gbps` : `${mbps.toFixed(0)} Mbps`;

/** Stable, readable palette for multi-series / stacked charts. */
export const SERIES_COLORS = [
  '#F20732', // brand red
  '#2563EB', // blue
  '#059669', // green
  '#D97706', // amber
  '#7C3AED', // violet
  '#0891B2', // cyan
  '#DB2777', // pink
  '#65A30D', // lime
  '#9CA3AF', // gray (good for "Other")
];

export interface NamedSeries {
  name: string;
  color: string;
  values: number[];
}

/**
 * Dependency-free multi-line chart. Each series is a colored line over a shared
 * time axis. Used for port-wise and location-wise breakdowns.
 */
export const MultiLineChart: React.FC<{
  t: number[];
  series: NamedSeries[];
  unit?: string;
  height?: number;
}> = ({ t, series, height = 260 }) => {
  const [hover, setHover] = useState<number | null>(null);
  const H = height;

  const { paths, max } = useMemo(() => {
    const max = Math.max(1, ...series.flatMap((s) => s.values)) * 1.1;
    const n = t.length;
    const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * (W - PAD * 2) + PAD);
    const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
    const paths = series.map((s) => ({
      ...s,
      d: s.values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' '),
    }));
    return { paths, max };
  }, [t, series, H]);

  const xPctOf = (i: number) => (t.length <= 1 ? 0 : (i / (t.length - 1)) * 100);

  return (
    <div className="relative w-full" style={{ height: H }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-full"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          const idx = Math.round(ratio * (t.length - 1));
          if (idx >= 0 && idx < t.length) setHover(idx);
        }}
      >
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} stroke="#e5e7eb" strokeWidth={1} />
        ))}
        {paths.map((p) => (
          <path key={p.name} d={p.d} fill="none" stroke={p.color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        ))}
        {hover !== null && (
          <line
            x1={(hover / Math.max(1, t.length - 1)) * (W - PAD * 2) + PAD}
            x2={(hover / Math.max(1, t.length - 1)) * (W - PAD * 2) + PAD}
            y1={0}
            y2={H}
            stroke="#9ca3af"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      <span className="absolute top-0 left-1 font-mono text-[10px] text-gray-500">{fmtRate(max)}</span>

      {hover !== null && t[hover] !== undefined && (
        <div
          className="absolute -translate-x-1/2 -top-1 pointer-events-none bg-ink text-white px-3 py-2 text-xs font-mono whitespace-nowrap z-10"
          style={{ left: `${xPctOf(hover)}%` }}
        >
          <div className="text-gray-400 text-[10px] mb-1">
            {new Date(t[hover]).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
          {series.map((s) => (
            <div key={s.name} className="flex items-center gap-2">
              <span className="inline-block w-2 h-2" style={{ background: s.color }} />
              <span className="text-gray-300">{s.name}</span>
              <span className="ml-auto">{fmtRate(s.values[hover] ?? 0)}</span>
            </div>
          ))}
        </div>
      )}

      <Legend series={series} />
    </div>
  );
};

/**
 * Dependency-free stacked-area chart. Layers stack cumulatively — used for the
 * per-ASN ("sFlow") content-traffic breakdown.
 */
export const StackedAreaChart: React.FC<{
  t: number[];
  layers: NamedSeries[];
  height?: number;
}> = ({ t, layers, height = 280 }) => {
  const [hover, setHover] = useState<number | null>(null);
  const H = height;

  const { areas, max } = useMemo(() => {
    const n = t.length;
    // cumulative totals per time index
    const totals = new Array(n).fill(0);
    layers.forEach((l) => l.values.forEach((v, i) => (totals[i] += v)));
    const max = Math.max(1, ...totals) * 1.05;
    const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * (W - PAD * 2) + PAD);
    const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);

    const baseline = new Array(n).fill(0);
    const areas = layers.map((l) => {
      const lower = [...baseline];
      const upper = l.values.map((v, i) => baseline[i] + v);
      // advance baseline for next layer
      upper.forEach((v, i) => (baseline[i] = v));
      const top = upper.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
      const bottom = lower
        .map((v, i) => `L ${x(n - 1 - i).toFixed(1)} ${y(lower[n - 1 - i]).toFixed(1)}`)
        .join(' ');
      return { ...l, d: `${top} ${bottom} Z` };
    });
    return { areas, max };
  }, [t, layers, H]);

  const xPctOf = (i: number) => (t.length <= 1 ? 0 : (i / (t.length - 1)) * 100);
  const totalAt = (i: number) => layers.reduce((sum, l) => sum + (l.values[i] ?? 0), 0);

  return (
    <div className="relative w-full" style={{ height: H }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-full"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          const idx = Math.round(ratio * (t.length - 1));
          if (idx >= 0 && idx < t.length) setHover(idx);
        }}
      >
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} stroke="#e5e7eb" strokeWidth={1} />
        ))}
        {areas.map((a) => (
          <path key={a.name} d={a.d} fill={a.color} fillOpacity={0.85} stroke={a.color} strokeWidth={0.5} />
        ))}
        {hover !== null && (
          <line
            x1={(hover / Math.max(1, t.length - 1)) * (W - PAD * 2) + PAD}
            x2={(hover / Math.max(1, t.length - 1)) * (W - PAD * 2) + PAD}
            y1={0}
            y2={H}
            stroke="#0A0A0B"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      <span className="absolute top-0 left-1 font-mono text-[10px] text-gray-500">{fmtRate(max)}</span>

      {hover !== null && t[hover] !== undefined && (
        <div
          className="absolute -translate-x-1/2 -top-1 pointer-events-none bg-ink text-white px-3 py-2 text-xs font-mono whitespace-nowrap z-10"
          style={{ left: `${xPctOf(hover)}%` }}
        >
          <div className="text-gray-400 text-[10px] mb-1">
            {new Date(t[hover]).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
          {[...layers]
            .map((l) => ({ name: l.name, color: l.color, v: l.values[hover] ?? 0 }))
            .sort((a, b) => b.v - a.v)
            .map((l) => (
              <div key={l.name} className="flex items-center gap-2">
                <span className="inline-block w-2 h-2" style={{ background: l.color }} />
                <span className="text-gray-300">{l.name}</span>
                <span className="ml-auto">{fmtRate(l.v)}</span>
              </div>
            ))}
          <div className="flex items-center gap-2 border-t border-white/20 mt-1 pt-1">
            <span className="text-gray-400">Total</span>
            <span className="ml-auto font-bold">{fmtRate(totalAt(hover))}</span>
          </div>
        </div>
      )}

      <Legend series={layers} />
    </div>
  );
};

const Legend: React.FC<{ series: NamedSeries[] }> = ({ series }) => (
  <div className="absolute bottom-1 right-2 flex items-center flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-gray-600 max-w-[80%] justify-end">
    {series.map((s) => (
      <span key={s.name} className="flex items-center gap-1">
        <span className="w-3 h-1.5" style={{ background: s.color }} /> {s.name}
      </span>
    ))}
  </div>
);
