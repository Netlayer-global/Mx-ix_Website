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

const StatsPage = () => {
  const { locations } = useAdmin();
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [stats, setStats] = useState<NetworkStat[]>(networkStats);
  const [currentTrafficData, setCurrentTrafficData] = useState<TrafficDataPoint[]>(trafficData);
  const [isLive, setIsLive] = useState(statsConfig.enableRealTimeUpdates);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [grafanaStatus, setGrafanaStatus] = useState<GrafanaStatus>({ connected: false, message: 'Checking...' });
  const [realTraffic, setRealTraffic] = useState<{ current: number; peak: number; inbound: number; outbound: number } | null>(null);

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

  // Traffic Chart (light theme)
  const TrafficChart: React.FC<{ data: TrafficDataPoint[] }> = ({ data }) => {
    const width = 800;
    const height = 220;
    const padding = 40;
    const maxValue = Math.max(...data.map((d) => d.value));
    const minValue = Math.min(...data.map((d) => d.value));
    const xScale = (index: number) => padding + (index / (data.length - 1)) * (width - 2 * padding);
    const yScale = (value: number) => height - padding - ((value - minValue) / (maxValue - minValue || 1)) * (height - 2 * padding);
    const pathData = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.value)}`).join(' ');
    const areaData = `${pathData} L ${xScale(data.length - 1)} ${height - padding} L ${padding} ${height - padding} Z`;

    return (
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          {[0, 1, 2, 3, 4].map((i) => {
            const y = padding + (i / 4) * (height - 2 * padding);
            return <line key={i} x1={padding} y1={y} x2={width - padding} y2={y} stroke="#E5E7EB" strokeWidth="1" />;
          })}
          <path d={areaData} fill="url(#statsGradient)" />
          <path d={pathData} fill="none" stroke="#F20732" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {data.map((d, i) => (
            <circle key={i} cx={xScale(i)} cy={yScale(d.value)} r="3" fill="#fff" stroke="#F20732" strokeWidth="2" />
          ))}
          <defs>
            <linearGradient id="statsGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F20732" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#F20732" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white text-ink">
      {/* Hero */}
      <section className="relative bg-ink text-white overflow-hidden pt-36 md:pt-44 pb-16">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#F20732]/15 blur-[120px]" />
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 relative z-10">
          <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Real-Time Network Statistics</span>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.95] mt-4 mb-6">
            NETWORK <span className="text-[#F20732]">STATS</span>
          </h1>
          <p className="text-gray-400 text-base md:text-lg leading-relaxed max-w-2xl border-l-2 border-white/10 pl-6">
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
                  <div className="text-[10px] text-gray-400 font-mono tracking-mono">{selectedLoc.code} • {selectedLoc.region}</div>
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
            <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Live from Grafana / Zabbix</span>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-gray-200 border border-gray-200 mt-4">
              {[
                { l: 'Live Traffic', v: realTraffic.current, note: 'Aggregate now', icon: <Activity className="w-4 h-4 text-[#F20732]" /> },
                { l: 'Inbound', v: realTraffic.inbound, note: 'Bits received', icon: <ArrowDown className="w-4 h-4 text-green-600" /> },
                { l: 'Outbound', v: realTraffic.outbound, note: 'Bits sent', icon: <ArrowUp className="w-4 h-4 text-blue-600" /> },
                { l: 'Peak (24h)', v: realTraffic.peak, note: 'Maximum observed', icon: <Activity className="w-4 h-4 text-ink" /> },
              ].map((c) => (
                <div key={c.l} className="bg-white p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-label-sm tracking-label uppercase text-gray-400">{c.l}</span>
                    {c.icon}
                  </div>
                  <div className="text-4xl font-light tracking-tighter text-ink tabular-nums">
                    {c.v.toFixed(2)}<span className="text-lg text-gray-400 ml-1">Gbps</span>
                  </div>
                  <div className="font-mono text-[10px] text-gray-400 mt-1">{c.note}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Traffic chart */}
      <section className="border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-14">
          <div className="border border-gray-200 p-6 md:p-10">
            <div className="flex flex-wrap items-start justify-between gap-6 mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tighter mb-1">Traffic Overview</h2>
                <p className="text-gray-500 font-mono text-xs tracking-mono">
                  {grafanaStatus.connected ? 'Live from LVSB SW-01 & MB2 SW-01' : 'Last 24 hours (simulated)'}
                </p>
              </div>
              <div className="text-right">
                <div className="text-4xl md:text-5xl font-light tracking-tighter text-[#F20732] tabular-nums">
                  {grafanaStatus.connected && realTraffic
                    ? realTraffic.current.toFixed(1)
                    : currentTrafficData[currentTrafficData.length - 1]?.value.toFixed(1)}
                  <span className="text-lg text-gray-400 ml-2">{grafanaStatus.connected ? 'Gbps' : 'Tbps'}</span>
                </div>
                <div className="text-xs text-green-600 font-mono flex items-center justify-end gap-1 mt-2">
                  <ArrowUp className="w-3.5 h-3.5" />
                  {grafanaStatus.connected ? 'Real-time from Grafana' : '+12.3% from yesterday'}
                </div>
              </div>
            </div>
            <TrafficChart data={currentTrafficData} />
          </div>
        </div>
      </section>

      {/* Stats grid */}
      <section className="border-b border-gray-200 bg-gray-50">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-14">
          <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Key Metrics</span>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter mt-2 mb-10">
            {selectedCity === 'all' ? 'Global fabric at a glance' : `${selectedLoc?.name} at a glance`}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200 border border-gray-200">
            {filteredStats.map((stat) => (
              <div key={stat.id} className="group relative bg-white p-8 overflow-hidden hover:bg-gray-50 transition-colors">
                <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732] -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
                <div className="flex items-start justify-between mb-6">
                  <span className="font-mono text-label-sm tracking-label uppercase text-gray-400">{stat.label}</span>
                  {stat.trend && (
                    <span className={`text-xs font-mono ${
                      stat.trend === 'up' ? 'text-green-600' : stat.trend === 'down' ? 'text-[#F20732]' : 'text-gray-400'
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
                      stat.trend === 'up' ? 'text-green-600' : stat.trend === 'down' ? 'text-[#F20732]' : 'text-gray-400'
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
          <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Network Quality</span>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter mt-2 mb-3">A clean, secure fabric</h2>
          <p className="text-gray-500 max-w-2xl mb-10">We filter every prefix and run redundant infrastructure so the routes you receive are correct, secure and resilient.</p>
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
          <p className="text-xs text-gray-400 mt-4 font-mono">
            Figures update {isLive ? `every ${statsConfig.updateInterval / 1000}s` : 'on load'} ·
            {grafanaStatus.connected ? ' Traffic sourced live from Grafana/Zabbix' : ' Traffic simulated until Grafana is connected'} ·
            Capacity and network counts reflect provisioned ports across all locations.
          </p>
        </div>
      </section>

      {/* Explore more */}
      <section className="border-b border-gray-200 bg-gray-50">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-14">
          <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Explore</span>
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
          <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// System Status</span>
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
              <div className="font-mono text-label-sm tracking-label uppercase text-gray-400 mb-2">Last Updated</div>
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
