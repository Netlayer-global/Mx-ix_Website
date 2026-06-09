import React, { useEffect, useState, useCallback, useRef } from "react";
import { grafanaApi } from "../services/api";

const BAR_COUNT = 72;
const POLL_MS = 2000;

interface TrafficData {
  currentTraffic: number;
  unit: string;
  peakTraffic: number;
  avgTraffic: number;
  source: string;
  details?: {
    inbound: number;
    outbound: number;
  };
}

const RealTimeCapacity = () => {
  // Rolling history of real traffic readings (Gbps). Each poll pushes one point.
  const [history, setHistory] = useState<number[]>([]);
  const [trafficData, setTrafficData] = useState<TrafficData | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const seeded = useRef(false);

  const fetchTrafficData = useCallback(async () => {
    try {
      const result = await grafanaApi.getTraffic();
      if (result.success && result.data) {
        const data = result.data as TrafficData;
        setTrafficData(data);
        setIsLive(data.source === "grafana");
        setLastUpdate(new Date());

        const value = Number(data.currentTraffic) || 0;
        setHistory((prev) => {
          // Seed the window with the first reading so the chart starts full
          if (!seeded.current) {
            seeded.current = true;
            return Array.from({ length: BAR_COUNT }, () => value);
          }
          return [...prev.slice(1), value];
        });
      }
    } catch (error) {
      console.error("Failed to fetch traffic data:", error);
    }
  }, []);

  useEffect(() => {
    fetchTrafficData();
    const interval = setInterval(fetchTrafficData, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchTrafficData]);

  const formatTraffic = (value: number | undefined) => {
    if (!value) return "0";
    return value >= 1000 ? (value / 1000).toFixed(2) : value.toFixed(1);
  };
  const getTrafficUnit = (value: number | undefined) => (value && value >= 1000 ? "Tbps" : "Gbps");

  const displayValue = trafficData?.currentTraffic || 0;
  const displayUnit = getTrafficUnit(displayValue);

  // Scale bars relative to the largest value in view (and the peak)
  const scaleMax = Math.max(trafficData?.peakTraffic || 0, ...history, 1);

  return (
    <section className="bg-white py-16 md:py-24 border-b border-gray-200 relative z-10">
      <div className="max-w-7xl mx-auto px-6 md:px-10">

        {/* Capacity Display */}
        <div className="text-center mb-12">
          <span className="text-[#F20732] font-mono text-xs tracking-[0.25em] uppercase">
            • REAL-TIME TRAFFIC •
          </span>
          <h2 className="text-7xl md:text-9xl font-black text-black mt-6 leading-none tracking-tighter tabular-nums">
            {formatTraffic(displayValue)}
            <span className="text-gray-300">{displayUnit}</span>
          </h2>
        </div>

        {/* Traffic Stats Cards */}
        {trafficData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {[
              { label: "Inbound", value: trafficData.details?.inbound, note: "↓ Bits Received" },
              { label: "Outbound", value: trafficData.details?.outbound, note: "↑ Bits Sent" },
              { label: "Peak (24h)", value: trafficData.peakTraffic, note: "Maximum observed" },
            ].map((stat) => (
              <div key={stat.label} className="relative group bg-gradient-to-br from-[#F20732]/5 to-white border-2 border-[#F20732]/20 p-8 hover:border-[#F20732] transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 bg-[#F20732] rounded-full animate-pulse"></div>
                  <span className="font-mono text-xs text-[#F20732] uppercase tracking-widest font-bold">{stat.label}</span>
                </div>
                <div className="text-5xl md:text-6xl font-light tracking-tighter text-black tabular-nums">
                  {(stat.value ?? 0).toFixed(2)}
                  <span className="text-xl text-gray-400 ml-2">Gbps</span>
                </div>
                <div className="mt-3 text-xs text-gray-500 font-mono">{stat.note}</div>
              </div>
            ))}
          </div>
        )}

        {/* Live bars chart */}
        <div className="bg-white border border-gray-200 p-2 md:p-4 relative overflow-hidden shadow-sm">
          {/* LIVE badge */}
          <div className="absolute top-6 left-6 z-20 bg-white/80 backdrop-blur px-4 py-2 border border-gray-100 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isLive ? "bg-[#F20732] animate-pulse" : "bg-yellow-500"}`}></div>
            <span className={`font-mono text-xs font-bold ${isLive ? "text-[#F20732]" : "text-yellow-600"}`}>
              {isLive ? "LIVE FEED" : "SIMULATED FEED"}
            </span>
          </div>

          {/* Updated timestamp */}
          <div className="absolute top-6 right-6 z-20 bg-white/80 backdrop-blur px-4 py-2 border border-gray-100">
            <span className="text-gray-500 font-mono text-[10px]">
              {lastUpdate ? `Updated: ${lastUpdate.toLocaleTimeString()}` : "Connecting…"}
            </span>
          </div>

          {/* Bars driven by real readings */}
          <div className="relative flex items-end gap-[2px] bg-white" style={{ height: 320 }}>
            {(history.length ? history : Array(BAR_COUNT).fill(0)).map((value, idx) => {
              const pct = Math.max(2, (value / scaleMax) * 100);
              return (
                <div key={idx} style={{ flex: "1 1 0%", minWidth: "3px", display: "flex", alignItems: "flex-end" }}>
                  <div
                    style={{
                      width: "100%",
                      height: `${(pct / 100) * 300}px`,
                      background: "linear-gradient(to top, rgba(255,255,255,0.9), #FFB3C1, #FF6B88, #F20732, #E01030)",
                      transition: "height 0.9s cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </section>
  );
};

export default RealTimeCapacity;
