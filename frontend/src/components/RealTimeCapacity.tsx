import React, { useEffect, useState, useCallback, useRef } from "react";
import { grafanaApi } from "../services/api";

const WINDOW = 60;       // points kept in the live rolling window (fallback)
const MAX_POINTS = 240;  // max points drawn for a fetched range series
const POLL_MS = 5000;    // refresh cadence
const VW = 1000;         // svg viewBox width
const VH = 300;          // svg viewBox height

// Evenly-spaced indices across a series (keeps first & last), for downsampling
const sampleIndices = (len: number, max: number): number[] => {
  if (len <= max) return Array.from({ length: len }, (_, i) => i);
  const out: number[] = [];
  for (let i = 0; i < max; i++) out.push(Math.round((i / (max - 1)) * (len - 1)));
  return Array.from(new Set(out));
};

const RANGES: { id: string; label: string }[] = [
  { id: "1h", label: "1H" },
  { id: "24h", label: "24H" },
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
];

interface TrafficData {
  currentTraffic: number;
  unit: string;
  peakTraffic: number;
  avgTraffic: number;
  source: string;
  series?: number[];
  seriesIn?: number[];
  seriesOut?: number[];
  seriesT?: number[];
  details?: { inbound: number; outbound: number };
}

const fmt = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(2)} Tbps` : `${v.toFixed(1)} Gbps`);
const labelFor = (ms: number, range: string) =>
  range === "7d" || range === "30d"
    ? new Date(ms).toLocaleDateString([], { day: "2-digit", month: "short" })
    : new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const RealTimeCapacity = () => {
  const [data, setData] = useState<TrafficData | null>(null);
  const [histIn, setHistIn] = useState<number[]>([]);
  const [histOut, setHistOut] = useState<number[]>([]);
  const [times, setTimes] = useState<number[]>([]);
  const [range, setRange] = useState<string>("1h");
  const [isLive, setIsLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const seeded = useRef(false);

  const fetchTraffic = useCallback(async () => {
    try {
      const res = await grafanaApi.getTraffic(range);
      if (!res.success || !res.data) return;
      const d = res.data as TrafficData;
      setData(d);
      setIsLive(d.source === "grafana");
      setLastUpdate(new Date());

      const inb = Number(d.details?.inbound) || 0;
      const out = Number(d.details?.outbound) || 0;

      if (Array.isArray(d.seriesIn) && d.seriesIn.length > 1) {
        // Real time-series from the backend (preferred) — show the WHOLE range,
        // downsampled only if it's very large (keeps the full window in view).
        seeded.current = true;
        const fullIn = d.seriesIn;
        const fullOut =
          d.seriesOut && d.seriesOut.length === fullIn.length ? d.seriesOut : fullIn.map(() => 0);
        const fullT =
          d.seriesT && d.seriesT.length === fullIn.length
            ? d.seriesT
            : fullIn.map((_, i) => Date.now() - (fullIn.length - 1 - i) * 60000);
        const idxs = sampleIndices(fullIn.length, MAX_POINTS);
        setHistIn(idxs.map((i) => fullIn[i]));
        setHistOut(idxs.map((i) => fullOut[i]));
        setTimes(idxs.map((i) => fullT[i]));
      } else {
        // Fallback: roll the latest reading through a moving window.
        const stamp = Date.now();
        setHistIn((prev) => {
          if (!seeded.current) return Array.from({ length: WINDOW }, () => inb);
          return [...prev.slice(1), inb];
        });
        setHistOut((prev) => {
          if (!seeded.current) return Array.from({ length: WINDOW }, () => out);
          return [...prev.slice(1), out];
        });
        setTimes((prev) => {
          if (!seeded.current)
            return Array.from({ length: WINDOW }, (_, i) => stamp - (WINDOW - 1 - i) * POLL_MS);
          return [...prev.slice(1), stamp];
        });
        seeded.current = true;
      }
    } catch (e) {
      console.error("Failed to fetch traffic data:", e);
    }
  }, [range]);

  useEffect(() => {
    // Reset the window when the range changes so old points don't linger.
    seeded.current = false;
    setHistIn([]);
    setHistOut([]);
    setTimes([]);
    fetchTraffic();
    const pollMs = range === "1h" ? POLL_MS : 60000;
    const t = setInterval(fetchTraffic, pollMs);
    return () => clearInterval(t);
  }, [fetchTraffic]);

  const n = Math.min(histIn.length, histOut.length);
  const max = Math.max(1, ...histIn.slice(0, n), ...histOut.slice(0, n)) * 1.15;
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * VW);
  const y = (v: number) => VH - (v / max) * VH;
  const toLine = (arr: number[]) =>
    arr.slice(0, n).map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const inLine = toLine(histIn);
  const outLine = toLine(histOut);
  const inArea = n > 0 ? `${inLine} L ${x(n - 1).toFixed(1)} ${VH} L 0 ${VH} Z` : "";

  const displayValue = data?.currentTraffic || 0;
  const displayUnit = displayValue >= 1000 ? "Tbps" : "Gbps";
  const fmtBig = (v: number) => (v >= 1000 ? (v / 1000).toFixed(2) : v.toFixed(1));

  // X-axis time ticks (4 evenly spaced)
  const ticks = n > 1 ? [0, Math.floor((n - 1) / 3), Math.floor((2 * (n - 1)) / 3), n - 1] : [];

  return (
    <section className="bg-white py-16 md:py-24 border-b border-gray-200 relative z-10">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        {/* Headline */}
        <div className="text-center mb-12">
          <span className="text-[#F20732] font-mono text-xs tracking-[0.25em] uppercase">• REAL-TIME TRAFFIC •</span>
          {/* Fluid so the figure + unit never exceed narrow viewports */}
          <h2 className="mt-6 text-[clamp(2.5rem,12vw,8rem)] font-black leading-none tracking-tighter tabular-nums text-black">
            {fmtBig(displayValue)}
            <span className="text-gray-300">{displayUnit}</span>
          </h2>
          <p className="text-gray-500 text-sm mt-4 max-w-xl mx-auto">
            Total live traffic exchanged across the MX-IX fabric right now.
          </p>
        </div>

        {/* Stat cards */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {[
              { label: "Inbound", value: data.details?.inbound, note: "↓ Traffic received", dot: "#F20732" },
              { label: "Outbound", value: data.details?.outbound, note: "↑ Traffic sent", dot: "#0A0A0B" },
              { label: "Peak (24h)", value: data.peakTraffic, note: "Highest in last 24h", dot: "#F59E0B" },
            ].map((s) => (
              <div key={s.label} className="bg-white border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.dot }} />
                  <span className="font-mono text-xs uppercase tracking-widest text-gray-500 font-bold">{s.label}</span>
                </div>
                <div className="text-4xl md:text-5xl font-light tracking-tighter text-black tabular-nums">
                  {(s.value ?? 0).toFixed(2)}
                  <span className="text-lg text-gray-400 ml-2">Gbps</span>
                </div>
                <div className="mt-2 text-xs text-gray-500 font-mono">{s.note}</div>
              </div>
            ))}
          </div>
        )}

        {/* Chart */}
        <div className="bg-white border border-gray-200 shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3 px-5 py-4 border-b border-gray-100">
            <div>
              <h3 className="font-mono text-xs tracking-[0.15em] uppercase text-ink font-bold">Aggregate Throughput</h3>
              <p className="text-xs text-gray-400 font-mono mt-0.5">
                {{ "1h": "Last 60 minutes", "24h": "Last 24 hours", "7d": "Last 7 days", "30d": "Last 30 days" }[range]}
                {" · inbound vs outbound"}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Range filter */}
              <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded">
                {RANGES.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setRange(r.id)}
                    className={`px-3 py-1.5 font-mono text-[11px] font-bold tracking-mono uppercase rounded transition-colors hover-trigger ${
                      range === r.id ? "bg-ink text-white" : "text-gray-500 hover:text-ink"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <span className="inline-flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isLive ? "bg-[#F20732] animate-pulse" : "bg-yellow-500"}`} />
                <span className={`font-mono text-xs font-bold ${isLive ? "text-[#F20732]" : "text-yellow-600"}`}>
                  {isLive ? "LIVE" : "SIMULATED"}
                </span>
              </span>
            </div>
          </div>

          {/* Plot */}
          <div className="relative px-5 pt-5 pb-2">
            <div className="relative" style={{ height: 300 }} onMouseLeave={() => setHover(null)}>
              {/* Y axis labels */}
              <span className="absolute left-0 -top-1 font-mono text-[10px] text-gray-400">{fmt(max)}</span>
              <span className="absolute left-0 top-1/2 -translate-y-1/2 font-mono text-[10px] text-gray-400">{fmt(max / 2)}</span>
              <span className="absolute left-0 bottom-0 font-mono text-[10px] text-gray-400">0</span>

              <svg
                viewBox={`0 0 ${VW} ${VH}`}
                preserveAspectRatio="none"
                className="w-full h-full"
                onMouseMove={(e) => {
                  const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
                  const idx = Math.round(((e.clientX - r.left) / r.width) * (n - 1));
                  if (idx >= 0 && idx < n) setHover(idx);
                }}
              >
                {[0.25, 0.5, 0.75].map((g) => (
                  <line key={g} x1={0} x2={VW} y1={VH * g} y2={VH * g} stroke="#f1f1f1" strokeWidth={1} />
                ))}
                {inArea && <path d={inArea} fill="#F20732" fillOpacity={0.1} />}
                {inLine && <path d={inLine} fill="none" stroke="#F20732" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />}
                {outLine && (
                  <path d={outLine} fill="none" stroke="#0A0A0B" strokeWidth={1.5} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
                )}
                {hover !== null && (
                  <line x1={x(hover)} x2={x(hover)} y1={0} y2={VH} stroke="#9ca3af" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                )}
              </svg>

              {/* live dot */}
              {n > 0 && (
                <span
                  className="absolute w-3 h-3 -ml-1.5 -mt-1.5 pointer-events-none"
                  style={{ left: "100%", top: `${(y(histIn[n - 1]) / VH) * 100}%` }}
                >
                  <span className="absolute inset-0 rounded-full bg-[#F20732] animate-ping" />
                  <span className="absolute inset-0 rounded-full bg-[#F20732]" />
                </span>
              )}

              {/* tooltip */}
              {hover !== null && times[hover] !== undefined && (
                <div
                  className="absolute -top-2 z-20 pointer-events-none bg-ink text-white px-3 py-2 font-mono text-[10px] whitespace-nowrap"
                  style={{ left: `${(hover / Math.max(1, n - 1)) * 100}%`, transform: "translateX(-50%)" }}
                >
                  <div className="text-gray-400 mb-1">{labelFor(times[hover], range)}</div>
                  <div className="text-[#F20732]">↓ In&nbsp; {fmt(histIn[hover] ?? 0)}</div>
                  <div className="text-gray-200">↑ Out {fmt(histOut[hover] ?? 0)}</div>
                </div>
              )}
            </div>

            {/* X axis time labels */}
            <div className="relative h-5 mt-1">
              {ticks.map((i) => (
                <span
                  key={i}
                  className="absolute font-mono text-[10px] text-gray-400 -translate-x-1/2"
                  style={{ left: `${(i / Math.max(1, n - 1)) * 100}%` }}
                >
                  {times[i] ? labelFor(times[i], range) : ""}
                </span>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 pb-3 font-mono text-[11px]">
              <span className="flex items-center gap-2 text-gray-600">
                <span className="w-4 h-0.5 bg-[#F20732]" /> Inbound
              </span>
              <span className="flex items-center gap-2 text-gray-600">
                <span className="w-4 border-t-2 border-dashed border-ink" /> Outbound
              </span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default RealTimeCapacity;
