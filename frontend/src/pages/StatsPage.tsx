import React, { useState, useEffect, useRef } from 'react';
import {
  Globe,
  MapPin,
  ChevronDown,
  Wifi,
  WifiOff,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Activity,
} from 'lucide-react';
import {
  networkStats,
  trafficData,
  fetchNetworkStats,
  formatStatValue,
  statsConfig,
  NetworkStat,
  TrafficDataPoint,
  getCityStats,
} from '../config/stats.config';
import { grafanaApi } from '../services/api';
import api from '../services/api';
import { useAdmin } from '../contexts/AdminContext';

interface GrafanaStatus {
  connected: boolean;
  message: string;
  version?: string;
  source?: string;
}

type TrafficRange = '1h' | '24h' | '7d' | '30d';

const RANGES: { id: TrafficRange; label: string }[] = [
  { id: '1h', label: '1H' },
  { id: '24h', label: '24H' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
];

const RANGE_CAPTION: Record<TrafficRange, string> = {
  '1h': 'Last hour',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
};

interface TrafficFeed {
  points: { t: number; value: number }[];
  unit: string;
  current: number;
  peak: number;
  avg: number;
  live: boolean;
}

/** Formats a traffic value, promoting Gbps to Tbps once it crosses 1000. */
const formatTraffic = (value: number, unit: string) => {
  if (unit === 'Gbps' && value >= 1000) {
    return { value: (value / 1000).toFixed(2), unit: 'Tbps' };
  }
  return { value: value.toFixed(value >= 100 ? 1 : 2), unit };
};

const formatAxisTime = (ts: number, range: TrafficRange) => {
  const d = new Date(ts);
  if (range === '7d' || range === '30d') {
    return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
  }
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const StatsPage = () => {
  const { locations } = useAdmin();
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [stats, setStats] = useState<NetworkStat[]>(networkStats);
  const [currentTrafficData, setCurrentTrafficData] = useState<TrafficDataPoint[]>(trafficData);
  const [isLive, setIsLive] = useState(statsConfig.enableRealTimeUpdates);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [grafanaStatus, setGrafanaStatus] = useState<GrafanaStatus>({ connected: false, message: 'Checking...' });
  const [realTraffic, setRealTraffic] = useState<{ current: number; peak: number; inbound: number; outbound: number } | null>(null);
  const [range, setRange] = useState<TrafficRange>('24h');
  const [feed, setFeed] = useState<TrafficFeed | null>(null);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState(false);

  useEffect(() => {
    document.body.classList.add('dark-nav');
    return () => document.body.classList.remove('dark-nav');
  }, []);

  // Fetch Grafana status and real traffic data
  useEffect(() => {
    const fetchGrafanaData = async () => {
      try {
        const statusResult = await grafanaApi.getStatus();
        if (statusResult.success && statusResult.data) {
          setGrafanaStatus({
            connected: statusResult.data.connected,
            message: statusResult.data.message,
            version: (statusResult.data as any).version,
          });
        }

        const trafficResult = await grafanaApi.getTraffic();
        if (trafficResult.success && trafficResult.data) {
          const data = trafficResult.data as any;
          setRealTraffic({
            current: data.currentTraffic || 0,
            peak: data.peakTraffic || 0,
            inbound: data.details?.inbound || 0,
            outbound: data.details?.outbound || 0,
          });
        }
      } catch (error) {
        console.error('Failed to fetch Grafana data:', error);
        setGrafanaStatus({ connected: false, message: 'Connection failed' });
      }
    };

    fetchGrafanaData();
    const interval = setInterval(fetchGrafanaData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Range-driven traffic feed for the Traffic Overview chart
  useEffect(() => {
    let cancelled = false;

    const loadFeed = async (showSpinner: boolean) => {
      if (showSpinner) {
        setFeedLoading(true);
        setFeedError(false);
      }
      try {
        const res = await grafanaApi.getTraffic(range);
        const d = res.data as any;
        if (!res.success || !d) throw new Error('No traffic payload');

        const series: number[] = Array.isArray(d.series) ? d.series : [];
        const stamps: number[] = Array.isArray(d.seriesT) ? d.seriesT : [];
        const points = series.map((value, i) => ({
          t: Number(stamps[i]) || Date.now() - (series.length - 1 - i) * 60000,
          value: Number(value) || 0,
        }));

        if (cancelled) return;
        if (!points.length) throw new Error('Empty series');

        setFeed({
          points,
          unit: d.unit || 'Gbps',
          current: Number(d.currentTraffic) || points[points.length - 1].value,
          peak: Number(d.peakTraffic) || Math.max(...points.map((p) => p.value)),
          avg: Number(d.avgTraffic) || points.reduce((s, p) => s + p.value, 0) / points.length,
          live: d.source === 'grafana',
        });
        setFeedError(false);
      } catch (error) {
        console.error('Failed to load traffic feed:', error);
        if (!cancelled) setFeedError(true);
      } finally {
        if (!cancelled) setFeedLoading(false);
      }
    };

    loadFeed(true);
    const pollMs = range === '1h' ? 15000 : 60000;
    const timer = setInterval(() => loadFeed(false), pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [range]);

  // Handle city selection
  useEffect(() => {
    if (selectedCity === 'all') {
      setStats(networkStats);
      setCurrentTrafficData(trafficData);
    } else {
      const location = locations.find((loc) => loc.id === selectedCity);
      if (location) {
        const cityData = getCityStats(location.id, location.name, location.code);
        setStats(cityData.stats);
        setCurrentTrafficData(cityData.trafficData);
      }
    }
  }, [selectedCity, locations]);

  // Fetch global stats from backend
  useEffect(() => {
    const fetchGlobalStats = async () => {
      try {
        const response = await api.stats.get();
        if (response.success && response.data) {
          const backendStats = response.data;
          const convertedStats: NetworkStat[] = [
            {
              id: 'total_capacity',
              label: 'Total Capacity',
              value: backendStats.totalCapacity.value,
              unit: backendStats.totalCapacity.unit,
              format: 'number',
              category: 'network',
              trend: backendStats.totalCapacity.trend,
              trendValue: backendStats.totalCapacity.trendValue,
            },
            {
              id: 'peak_traffic',
              label: 'Peak Traffic (24h)',
              value: backendStats.peakTraffic.value,
              unit: backendStats.peakTraffic.unit,
              trend: backendStats.peakTraffic.trend,
              trendValue: backendStats.peakTraffic.trendValue,
              format: 'decimal',
              category: 'traffic',
            },
            {
              id: 'total_peers',
              label: 'Connected Networks',
              value: backendStats.connectedNetworks.value,
              unit: backendStats.connectedNetworks.unit,
              trend: backendStats.connectedNetworks.trend,
              trendValue: backendStats.connectedNetworks.trendValue,
              format: 'number',
              category: 'network',
            },
            {
              id: 'ipv4_prefixes',
              label: 'IPv4 Prefixes',
              value: backendStats.ipv4Prefixes.value,
              unit: backendStats.ipv4Prefixes.unit,
              trend: backendStats.ipv4Prefixes.trend,
              trendValue: backendStats.ipv4Prefixes.trendValue,
              format: 'number',
              category: 'network',
            },
          ];
          if (selectedCity === 'all') {
            setStats(convertedStats);
          }
        }
      } catch (error) {
        console.error('Failed to fetch global stats from backend:', error);
      }
    };
    fetchGlobalStats();
  }, [selectedCity]);

  // Real-time updates
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(async () => {
      const newStats = await fetchNetworkStats();
      setStats(newStats);
    }, statsConfig.updateInterval);
    return () => clearInterval(interval);
  }, [isLive]);

  const filteredStats = stats;
  const selectedLoc = locations.find((l) => l.id === selectedCity);

  // Animated Counter
  const AnimatedCounter: React.FC<{ value: string | number; duration?: number }> = ({ value, duration = 2000 }) => {
    const [displayValue, setDisplayValue] = useState('0');
    const elementRef = useRef<HTMLSpanElement>(null);
    const hasAnimated = useRef(false);

    useEffect(() => {
      const numericValue = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
      if (isNaN(numericValue)) {
        setDisplayValue(value.toString());
        return;
      }
      if (hasAnimated.current) {
        setDisplayValue(value.toString());
        return;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true;
            let start = 0;
            const increment = numericValue / (duration / 16);
            const timer = setInterval(() => {
              start += increment;
              if (start >= numericValue) {
                setDisplayValue(value.toString());
                clearInterval(timer);
              } else {
                setDisplayValue(Math.floor(start).toLocaleString());
              }
            }, 16);
          }
        },
        { threshold: 0.3 }
      );
      if (elementRef.current) observer.observe(elementRef.current);
      return () => observer.disconnect();
    }, [value, duration]);

    return <span ref={elementRef}>{displayValue}</span>;
  };

  // Traffic Chart (light theme) — axes, gridlines and hover readout
  const TrafficChart: React.FC<{
    points: { t: number; value: number }[];
    unit: string;
    activeRange: TrafficRange;
  }> = ({ points, unit, activeRange }) => {
    const [hover, setHover] = useState<number | null>(null);
    const width = 900;
    const height = 300;
    const padLeft = 66;
    const padRight = 24;
    const padTop = 24;
    const padBottom = 44;

    if (points.length < 2) {
      return (
        <div className="flex h-56 items-center justify-center font-mono text-label-sm uppercase tracking-mono text-gray-400">
          No traffic samples for this range
        </div>
      );
    }

    const values = points.map((p) => p.value);
    const rawMax = Math.max(...values);
    const rawMin = Math.min(...values);
    const span = rawMax - rawMin || rawMax || 1;
    const yMax = rawMax + span * 0.15;
    const yMin = Math.max(0, rawMin - span * 0.25);

    const xScale = (i: number) => padLeft + (i / (points.length - 1)) * (width - padLeft - padRight);
    const yScale = (v: number) =>
      height - padBottom - ((v - yMin) / (yMax - yMin || 1)) * (height - padTop - padBottom);

    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(2)} ${yScale(p.value).toFixed(2)}`).join(' ');
    const area = `${line} L ${xScale(points.length - 1).toFixed(2)} ${height - padBottom} L ${padLeft} ${height - padBottom} Z`;

    const yTicks = Array.from({ length: 5 }, (_, i) => yMin + ((yMax - yMin) / 4) * i);
    const xTickCount = Math.min(6, points.length);
    const xTickIdx = Array.from({ length: xTickCount }, (_, i) =>
      Math.round((i / (xTickCount - 1)) * (points.length - 1))
    );

    const active = hover !== null ? points[hover] : null;
    const activeFmt = active ? formatTraffic(active.value, unit) : null;

    const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      const x = ratio * width;
      const t = (x - padLeft) / (width - padLeft - padRight);
      const idx = Math.round(t * (points.length - 1));
      setHover(Math.max(0, Math.min(points.length - 1, idx)));
    };

    return (
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          role="img"
          aria-label={`Aggregate exchange traffic over the ${RANGE_CAPTION[activeRange].toLowerCase()}, in ${unit}`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="statsGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F20732" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#F20732" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* horizontal gridlines + value axis */}
          {yTicks.map((v, i) => {
            const y = yScale(v);
            const f = formatTraffic(v, unit);
            return (
              <g key={`y-${i}`}>
                <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke={i === 0 ? '#D9DADD' : '#EDEEF0'} strokeWidth="1" />
                <text x={padLeft - 12} y={y + 3.5} textAnchor="end" fill="#8E9095" fontSize="11" fontFamily="monospace">
                  {f.value}
                </text>
              </g>
            );
          })}
          <text x={padLeft - 12} y={padTop - 8} textAnchor="end" fill="#B9BBBE" fontSize="9" fontFamily="monospace" letterSpacing="1">
            {unit === 'Gbps' && rawMax >= 1000 ? 'TBPS' : unit.toUpperCase()}
          </text>

          {/* series */}
          <path d={area} fill="url(#statsGradient)" />
          <path d={line} fill="none" stroke="#F20732" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />

          {/* time axis */}
          {xTickIdx.map((idx, i) => (
            <text
              key={`x-${i}`}
              x={xScale(idx)}
              y={height - padBottom + 22}
              textAnchor={i === 0 ? 'start' : i === xTickIdx.length - 1 ? 'end' : 'middle'}
              fill="#8E9095"
              fontSize="11"
              fontFamily="monospace"
            >
              {formatAxisTime(points[idx].t, activeRange)}
            </text>
          ))}

          {/* hover readout */}
          {active && hover !== null && (
            <g>
              <line x1={xScale(hover)} y1={padTop} x2={xScale(hover)} y2={height - padBottom} stroke="#C3C5C8" strokeWidth="1" strokeDasharray="3 4" />
              <circle cx={xScale(hover)} cy={yScale(active.value)} r="5" fill="#fff" stroke="#F20732" strokeWidth="2.5" />
            </g>
          )}
        </svg>

        {active && activeFmt && (
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-gray-200 pt-3 font-mono text-[11px] uppercase tracking-label text-gray-500">
            <span>{new Date(active.t).toLocaleString()}</span>
            <span className="font-bold text-ink">
              {activeFmt.value} {activeFmt.unit}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white text-ink">
      {/* Hero */}
      <section className="relative bg-ink text-white pt-36 md:pt-44 pb-16">
        {/* decorative glow is clipped in its own layer so dropdowns can overflow the hero */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-[#F20732]/15 blur-[120px]" />
        </div>
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 relative z-10">
          <span className="eyebrow mb-7 text-white">Real-Time Network Statistics</span>
          <h1 className="text-5xl md:text-7xl font-black tracking-[-0.05em] leading-[0.92] mb-6">
            NETWORK <span className="text-[#F20732]">STATS</span>
          </h1>
          <p className="text-gray-300 text-base md:text-lg leading-8 max-w-2xl border-l border-white/15 pl-6">
            Live performance metrics from our global infrastructure — monitor traffic, capacity and
            network health across every location in real time.
          </p>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3 mt-10">
            {/* City dropdown */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="px-5 py-3 border border-white/20 font-mono text-label-sm font-bold tracking-mono uppercase transition-colors flex items-center gap-3 bg-white/5 hover:border-[#F20732] hover-trigger"
              >
                <Globe size={15} strokeWidth={2.5} />
                {selectedCity === 'all' ? 'All Locations' : selectedLoc?.name.toUpperCase() || 'Select City'}
                <ChevronDown size={15} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {dropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-ink border border-white/20 shadow-2xl z-50 max-h-96 overflow-y-auto scrollbar-hide">
                  <button
                    onClick={() => { setSelectedCity('all'); setDropdownOpen(false); }}
                    className={`w-full px-5 py-3 text-left font-mono text-label-sm font-bold tracking-mono uppercase transition-colors border-b border-white/10 ${
                      selectedCity === 'all' ? 'bg-[#F20732] text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2"><Globe size={13} /><span>Global view</span></div>
                  </button>
                  {locations.map((location) => (
                    <button
                      key={location.id}
                      onClick={() => { setSelectedCity(location.id); setDropdownOpen(false); }}
                      className={`w-full px-5 py-3 text-left transition-colors border-b border-white/10 ${
                        selectedCity === location.id ? 'bg-[#F20732] text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-bold font-mono tracking-mono uppercase">{location.name}</div>
                      <div className="text-[9px] text-white/60 font-mono mt-0.5">{location.code} • {location.region}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Live toggle */}
            <button
              onClick={() => setIsLive(!isLive)}
              className={`px-5 py-3 border font-mono text-label-sm font-bold tracking-mono uppercase transition-colors flex items-center gap-3 hover-trigger ${
                isLive ? 'border-[#F20732] bg-[#F20732]/10 text-[#F20732]' : 'border-white/20 text-white hover:border-white/40'
              }`}
            >
              {isLive && (
                <span className="relative flex items-center">
                  <span className="w-2 h-2 bg-[#F20732] rounded-full" />
                  <span className="w-2 h-2 bg-[#F20732] rounded-full absolute animate-ping" />
                </span>
              )}
              {isLive ? 'Live' : 'Static'}
            </button>

            {/* Grafana status */}
            <div className={`px-5 py-3 border font-mono text-label-sm font-bold tracking-mono uppercase flex items-center gap-3 ${
              grafanaStatus.connected ? 'border-green-500/50 bg-green-500/10 text-green-400' : 'border-amber-500/50 bg-amber-500/10 text-amber-400'
            }`}>
              {grafanaStatus.connected ? <Wifi size={15} /> : <WifiOff size={15} />}
              <span>{grafanaStatus.connected ? 'Grafana connected' : 'Simulated data'}</span>
              {grafanaStatus.version && <span className="text-[10px] opacity-70">v{grafanaStatus.version}</span>}
            </div>

            {/* Selected location badge */}
            {selectedCity !== 'all' && selectedLoc && (
              <div className="inline-flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/20">
                <MapPin size={16} className="text-[#F20732]" strokeWidth={2.5} />
                <div>
                  <div className="text-sm font-bold text-white">{selectedLoc.name}</div>
                  <div className="text-[10px] text-gray-500 font-mono tracking-mono">{selectedLoc.code} • {selectedLoc.region}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Live Grafana traffic cards */}
      {grafanaStatus.connected && realTraffic && (
        <section className="border-b border-gray-200 bg-gray-50">
          <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-10">
            <span className="eyebrow">Live from Grafana / Zabbix</span>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-gray-200 border border-gray-200 mt-4">
              {[
                { l: 'Live Traffic', v: realTraffic.current, note: 'Aggregate now', icon: <Activity className="w-4 h-4 text-[#F20732]" /> },
                { l: 'Inbound', v: realTraffic.inbound, note: 'Bits received', icon: <ArrowDown className="w-4 h-4 text-green-600" /> },
                { l: 'Outbound', v: realTraffic.outbound, note: 'Bits sent', icon: <ArrowUp className="w-4 h-4 text-blue-600" /> },
                { l: `Peak (${RANGE_CAPTION[range].replace('Last ', '')})`, v: realTraffic.peak, note: 'Maximum observed', icon: <Activity className="w-4 h-4 text-ink" /> },
              ].map((c) => {
                const f = formatTraffic(c.v, feed?.unit ?? 'Gbps');
                return (
                  <div key={c.l} className="bg-white p-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-label-sm tracking-label uppercase text-gray-500">{c.l}</span>
                      {c.icon}
                    </div>
                    <div className="text-4xl font-light tracking-tighter text-ink tabular-nums">
                      {f.value}<span className="text-lg text-gray-500 ml-1">{f.unit}</span>
                    </div>
                    <div className="font-mono text-[10px] text-gray-500 mt-1">{c.note}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Traffic chart */}
      <section className="border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-14">
          <div className="border border-gray-200 bg-white p-6 md:p-10">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
              <div>
                <h2 className="mb-2 text-2xl font-black tracking-[-0.04em] md:text-3xl">Traffic Overview</h2>
                <p className="font-mono text-[11px] uppercase tracking-label text-gray-500">
                  {selectedCity === 'all'
                    ? `${RANGE_CAPTION[range]} · ${feed?.live ? 'Live from Grafana / Zabbix' : 'Simulated feed'}`
                    : `${selectedLoc?.name ?? 'Location'} · Last 24 hours (estimated)`}
                </p>
              </div>

              {feed && selectedCity === 'all' && (
                <div className="text-right">
                  {(() => {
                    const f = formatTraffic(feed.current, feed.unit);
                    return (
                      <div className="text-4xl font-light tracking-[-0.04em] tabular-nums text-[#F20732] md:text-5xl">
                        {f.value}
                        <span className="ml-2 text-lg text-gray-500">{f.unit}</span>
                      </div>
                    );
                  })()}
                  <div className="mt-2 flex items-center justify-end gap-1.5 font-mono text-[11px] uppercase tracking-label text-gray-500">
                    <ArrowUp className="h-3.5 w-3.5 text-green-600" />
                    Peak {formatTraffic(feed.peak, feed.unit).value} {formatTraffic(feed.peak, feed.unit).unit}
                    <span className="text-gray-300">/</span>
                    Avg {formatTraffic(feed.avg, feed.unit).value} {formatTraffic(feed.avg, feed.unit).unit}
                  </div>
                </div>
              )}
            </div>

            {/* Range selector — exchange-wide feed only */}
            {selectedCity === 'all' && (
              <div className="mb-8 flex flex-wrap items-center gap-2">
                {RANGES.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setRange(r.id)}
                    aria-pressed={range === r.id}
                    className={`cursor-pointer border px-4 py-2 font-mono text-label-sm font-bold uppercase tracking-mono transition-colors duration-200 ${
                      range === r.id
                        ? 'border-ink bg-ink text-white'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-ink hover:text-ink'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
                <span aria-live="polite" className="ml-1 font-mono text-[10px] uppercase tracking-label text-gray-400">
                  {feedLoading ? 'Loading…' : feedError ? 'Feed unavailable' : `${feed?.points.length ?? 0} samples`}
                </span>
              </div>
            )}

            {feedError && !feed && selectedCity === 'all' ? (
              <div className="flex h-56 flex-col items-center justify-center gap-3 border border-dashed border-gray-200 text-center">
                <p className="font-mono text-label-sm uppercase tracking-mono text-gray-500">Traffic feed unavailable</p>
                <button
                  onClick={() => setRange(range)}
                  className="cursor-pointer border border-gray-200 px-4 py-2 font-mono text-label-sm font-bold uppercase tracking-mono text-ink transition-colors duration-200 hover:border-ink"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className={feedLoading && !feed ? 'animate-pulse opacity-60' : ''}>
                <TrafficChart
                  points={
                    selectedCity === 'all'
                      ? feed?.points ?? []
                      : currentTrafficData.map((p) => ({ t: new Date(p.timestamp).getTime(), value: p.value }))
                  }
                  unit={feed?.unit ?? 'Gbps'}
                  activeRange={selectedCity === 'all' ? range : '24h'}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Stats grid */}
      <section className="border-b border-gray-200 bg-gray-50">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-14">
          <span className="eyebrow mb-6 text-ink">Key Metrics</span>
          <h2 className="mb-10 text-3xl font-black tracking-[-0.045em] md:text-4xl">
            {selectedCity === 'all' ? 'Global fabric at a glance' : `${selectedLoc?.name} at a glance`}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200 border border-gray-200">
            {filteredStats.map((stat) => (
              <div key={stat.id} className="group relative bg-white p-8 overflow-hidden hover:bg-gray-50 transition-colors">
                <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732] -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
                <div className="flex items-start justify-between mb-6">
                  <span className="font-mono text-label-sm tracking-label uppercase text-gray-500">{stat.label}</span>
                  {stat.trend && (
                    <span className={`text-xs font-mono ${
                      stat.trend === 'up' ? 'text-green-600' : stat.trend === 'down' ? 'text-[#F20732]' : 'text-gray-500'
                    }`}>
                      {stat.trend === 'up' && '↗'}{stat.trend === 'down' && '↘'}{stat.trend === 'stable' && '→'}
                    </span>
                  )}
                </div>
                <div className="text-5xl md:text-6xl font-light tracking-tighter text-ink group-hover:text-[#F20732] transition-colors mb-2 tabular-nums">
                  <AnimatedCounter value={formatStatValue(stat)} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg text-gray-500 font-bold">{stat.unit}</span>
                  {stat.trendValue && (
                    <span className={`text-xs font-mono ${
                      stat.trend === 'up' ? 'text-green-600' : stat.trend === 'down' ? 'text-[#F20732]' : 'text-gray-500'
                    }`}>
                      {stat.trendValue}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Network quality */}
      <section className="border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-14">
          <span className="eyebrow mb-6 text-ink">Network Quality</span>
          <h2 className="mb-3 text-3xl font-black tracking-[-0.045em] md:text-4xl">A clean, secure fabric</h2>
          <p className="mb-10 max-w-2xl leading-8 text-gray-600">We filter every prefix and run redundant infrastructure so the routes you receive are correct, secure and resilient.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200 border border-gray-200">
            {[
              { v: 'RPKI', l: 'ROV enforced', d: 'Invalid routes dropped at the route servers.' },
              { v: 'IRR', l: 'Prefix filtering', d: 'Announcements validated against registered objects.' },
              { v: 'Dual', l: 'Route servers', d: 'Redundant servers — no single point of failure.' },
              { v: 'IPv4 + IPv6', l: 'Dual-stack', d: 'Native dual-stack peering on every port.' },
            ].map((q) => (
              <div key={q.l} className="group relative bg-white p-6 overflow-hidden hover:bg-gray-50 transition-colors">
                <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732] -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
                <div className="text-2xl font-black tracking-tighter text-ink mb-1">{q.v}</div>
                <div className="font-mono text-label-sm tracking-label uppercase text-[#F20732] mb-3">{q.l}</div>
                <p className="text-sm text-gray-500 leading-relaxed">{q.d}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-4 font-mono">
            Figures update {isLive ? `every ${statsConfig.updateInterval / 1000}s` : 'on load'} ·
            {grafanaStatus.connected ? ' Traffic sourced live from Grafana/Zabbix' : ' Traffic simulated until Grafana is connected'} ·
            Capacity and network counts reflect provisioned ports across all locations.
          </p>
        </div>
      </section>

      {/* Explore more */}
      <section className="border-b border-gray-200 bg-gray-50">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-14">
          <span className="eyebrow">Explore</span>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter mt-2 mb-10">Go deeper</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-gray-200 border border-gray-200">
            {[
              { t: 'Looking Glass', d: 'Query live BGP routes, paths and prefixes from the route servers.', href: '/looking-glass' },
              { t: 'Locations', d: 'Explore every PoP, its connected networks and port pricing.', href: '/locations' },
              { t: 'Connected Networks', d: 'See who peers on the fabric and their peering policies.', href: '/networks' },
            ].map((c) => (
              <button
                key={c.t}
                onClick={() => { window.history.pushState({}, '', c.href); window.dispatchEvent(new PopStateEvent('popstate')); }}
                className="group relative bg-white p-8 text-left overflow-hidden hover:bg-gray-50 transition-colors hover-trigger"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732] -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
                <h3 className="text-xl font-bold text-ink mb-2">{c.t}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">{c.d}</p>
                <span className="inline-flex items-center gap-1 font-mono text-label-sm tracking-mono uppercase text-ink group-hover:text-[#F20732] transition-colors">
                  Open <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* System status */}
      <section className="border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-14">
          <span className="eyebrow">System Status</span>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter mt-2 mb-10">Network health</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-gray-200 border border-gray-200">
            <div className="bg-white p-8">
              <div className="flex items-center gap-3 mb-3">
                <span className="relative flex items-center">
                  <span className="w-3 h-3 bg-green-500 rounded-full" />
                  <span className="w-3 h-3 bg-green-500 rounded-full absolute animate-ping" />
                </span>
                <span className="font-mono text-label-sm font-bold text-green-600 uppercase tracking-label">Operational</span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">All network services are running normally with optimal performance.</p>
            </div>
            <div className="bg-white p-8">
              <div className="font-mono text-label-sm tracking-label uppercase text-gray-500 mb-2">Last Updated</div>
              <div className="text-2xl font-light tracking-tighter text-ink tabular-nums">{new Date().toLocaleTimeString()}</div>
              <p className="text-sm text-gray-500 mt-2">{isLive ? `Updates every ${statsConfig.updateInterval / 1000}s` : 'Static snapshot'}</p>
            </div>
            <div className="bg-white p-8">
              <div className="font-mono text-label-sm tracking-label uppercase text-[#F20732] mb-2">Network Health</div>
              <div className="text-2xl font-light tracking-tighter text-ink tabular-nums">99.99%</div>
              <p className="text-sm text-gray-500 mt-2">30-day rolling average uptime across all locations.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default StatsPage;
