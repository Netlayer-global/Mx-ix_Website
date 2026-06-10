import React, { useMemo, useState } from 'react';
import { TrafficSeries } from '../../services/api';

interface Props {
  series: TrafficSeries;
  unit: string;
  p95?: number;
  height?: number;
}

const W = 1000; // viewBox width
const PAD = 4;

const niceUnit = (mbps: number): string => {
  if (mbps >= 1000) return `${(mbps / 1000).toFixed(2)} Gbps`;
  return `${mbps.toFixed(0)} Mbps`;
};

/**
 * Lightweight dependency-free area + line chart in the brutalist style.
 * Inbound = red fill, Outbound = ink line. Includes a 95th-percentile marker.
 */
const TrafficChart: React.FC<Props> = ({ series, unit, p95, height = 240 }) => {
  const [hover, setHover] = useState<number | null>(null);
  const H = height;

  const { inPath, inArea, outPath, max, points } = useMemo(() => {
    const all = [...series.inbound, ...series.outbound, p95 || 0];
    const max = Math.max(1, ...all) * 1.1;
    const n = series.t.length;
    const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * (W - PAD * 2) + PAD);
    const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);

    const toPath = (arr: number[]) =>
      arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');

    const inPath = toPath(series.inbound);
    const outPath = toPath(series.outbound);
    const inArea =
      n > 0
        ? `${inPath} L ${x(n - 1).toFixed(1)} ${(H - PAD).toFixed(1)} L ${x(0).toFixed(1)} ${(H - PAD).toFixed(1)} Z`
        : '';
    const points = series.t.map((_, i) => ({ x: x(i), i }));
    return { inPath, inArea, outPath, max, points };
  }, [series, p95, H]);

  const p95Y = p95 ? H - PAD - (p95 / (Math.max(1, ...series.inbound, ...series.outbound, p95) * 1.1)) * (H - PAD * 2) : null;

  const hoverData =
    hover !== null && series.t[hover] !== undefined
      ? {
          time: new Date(series.t[hover]),
          inbound: series.inbound[hover] ?? 0,
          outbound: series.outbound[hover] ?? 0,
          xPct: series.t.length <= 1 ? 0 : (hover / (series.t.length - 1)) * 100,
        }
      : null;

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
          const idx = Math.round(ratio * (series.t.length - 1));
          if (idx >= 0 && idx < series.t.length) setHover(idx);
        }}
      >
        {/* gridlines */}
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} stroke="#e5e7eb" strokeWidth={1} />
        ))}

        {/* inbound area + line */}
        {inArea && <path d={inArea} fill="#F20732" fillOpacity={0.08} />}
        {inPath && <path d={inPath} fill="none" stroke="#F20732" strokeWidth={2} vectorEffect="non-scaling-stroke" />}

        {/* outbound line */}
        {outPath && (
          <path
            d={outPath}
            fill="none"
            stroke="#0A0A0B"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* 95th percentile line */}
        {p95Y !== null && (
          <line x1={0} x2={W} y1={p95Y} y2={p95Y} stroke="#f59e0b" strokeWidth={1} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
        )}

        {/* hover marker */}
        {hover !== null && points[hover] && (
          <line
            x1={points[hover].x}
            x2={points[hover].x}
            y1={0}
            y2={H}
            stroke="#9ca3af"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {/* y-axis max label */}
      <span className="absolute top-0 left-1 font-mono text-[10px] text-gray-400">{niceUnit(max)}</span>
      {p95 ? (
        <span className="absolute right-1 font-mono text-[10px] text-amber-600" style={{ top: `${((p95Y || 0) / H) * 100}%` }}>
          95th: {niceUnit(p95)}
        </span>
      ) : null}

      {/* tooltip */}
      {hoverData && (
        <div
          className="absolute -translate-x-1/2 -top-1 pointer-events-none bg-ink text-white px-3 py-2 text-xs font-mono whitespace-nowrap z-10"
          style={{ left: `${hoverData.xPct}%` }}
        >
          <div className="text-gray-400 text-[10px] mb-1">
            {hoverData.time.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-[#F20732]">↓ {niceUnit(hoverData.inbound)}</div>
          <div className="text-gray-300">↑ {niceUnit(hoverData.outbound)}</div>
        </div>
      )}

      {/* legend */}
      <div className="absolute bottom-1 right-2 flex items-center gap-3 font-mono text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-[#F20732]" /> In
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-ink" style={{ borderTop: '1px dashed' }} /> Out
        </span>
      </div>
      <span className="sr-only">Traffic in {unit}</span>
    </div>
  );
};

export default TrafficChart;
