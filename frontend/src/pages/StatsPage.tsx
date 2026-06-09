import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart3, 
  Globe, 
  Network, 
  Zap, 
  MapPin,
  ChevronDown,
  Wifi,
  WifiOff
} from 'lucide-react';
import { 
  networkStats, 
  trafficData, 
  fetchNetworkStats, 
  formatStatValue, 
  statsConfig,
  NetworkStat,
  TrafficDataPoint,
  getCityStats 
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

  // Set dark nav class
  useEffect(() => {
    document.body.classList.add('dark-nav');
    return () => {
      document.body.classList.remove('dark-nav');
    };
  }, []);

  // Fetch Grafana status and real traffic data
  useEffect(() => {
    const fetchGrafanaData = async () => {
      try {
        // Fetch status
        const statusResult = await grafanaApi.getStatus();
        if (statusResult.success && statusResult.data) {
          setGrafanaStatus({
            connected: statusResult.data.connected,
            message: statusResult.data.message,
            version: (statusResult.data as any).version,
          });
        }

        // Fetch real traffic
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
    // Refresh every 10 seconds
    const interval = setInterval(fetchGrafanaData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Handle city selection
  useEffect(() => {
    if (selectedCity === 'all') {
      setStats(networkStats);
      setCurrentTrafficData(trafficData);
    } else {
      const location = locations.find(loc => loc.id === selectedCity);
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
          
          // Convert backend stats to NetworkStat format
          const convertedStats: NetworkStat[] = [
            {
              id: 'total_capacity',
              label: 'Total Capacity',
              value: backendStats.totalCapacity.value,
              unit: backendStats.totalCapacity.unit,
              format: 'number',
              category: 'network',
              trend: backendStats.totalCapacity.trend,
              trendValue: backendStats.totalCapacity.trendValue
            },
            {
              id: 'peak_traffic',
              label: 'Peak Traffic (24h)',
              value: backendStats.peakTraffic.value,
              unit: backendStats.peakTraffic.unit,
              trend: backendStats.peakTraffic.trend,
              trendValue: backendStats.peakTraffic.trendValue,
              format: 'decimal',
              category: 'traffic'
            },
            {
              id: 'total_peers',
              label: 'Connected Networks',
              value: backendStats.connectedNetworks.value,
              unit: backendStats.connectedNetworks.unit,
              trend: backendStats.connectedNetworks.trend,
              trendValue: backendStats.connectedNetworks.trendValue,
              format: 'number',
              category: 'network'
            },
            {
              id: 'ipv4_prefixes',
              label: 'IPv4 Prefixes',
              value: backendStats.ipv4Prefixes.value,
              unit: backendStats.ipv4Prefixes.unit,
              trend: backendStats.ipv4Prefixes.trend,
              trendValue: backendStats.ipv4Prefixes.trendValue,
              format: 'number',
              category: 'network'
            }
          ];
          
          // Only update if we're viewing "all" (global stats)
          if (selectedCity === 'all') {
            setStats(convertedStats);
          }
        }
      } catch (error) {
        console.error('Failed to fetch global stats from backend:', error);
        // Keep using the default stats from config if fetch fails
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

  // Show all stats (no category filtering)
  const filteredStats = stats;

  // Animated Counter Component
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

      if (elementRef.current) {
        observer.observe(elementRef.current);
      }

      return () => observer.disconnect();
    }, [value, duration]);

    return <span ref={elementRef}>{displayValue}</span>;
  };

  // Traffic Chart Component (Simple SVG)
  const TrafficChart: React.FC<{ data: TrafficDataPoint[] }> = ({ data }) => {
    const width = 800;
    const height = 200;
    const padding = 40;

    const maxValue = Math.max(...data.map(d => d.value));
    const minValue = Math.min(...data.map(d => d.value));

    const xScale = (index: number) => padding + (index / (data.length - 1)) * (width - 2 * padding);
    const yScale = (value: number) => height - padding - ((value - minValue) / (maxValue - minValue)) * (height - 2 * padding);

    const pathData = data.map((d, i) => {
      const x = xScale(i);
      const y = yScale(d.value);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    const areaData = `${pathData} L ${xScale(data.length - 1)} ${height - padding} L ${padding} ${height - padding} Z`;

    return (
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          {/* Grid lines */}
          {[0, 1, 2, 3, 4].map(i => {
            const y = padding + (i / 4) * (height - 2 * padding);
            return (
              <line
                key={i}
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="#333"
                strokeWidth="0.5"
                opacity="0.2"
              />
            );
          })}

          {/* Area fill */}
          <path
            d={areaData}
            fill="url(#gradient)"
            opacity="0.2"
          />

          {/* Line */}
          <path
            d={pathData}
            fill="none"
            stroke="#F20732"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {data.map((d, i) => (
            <circle
              key={i}
              cx={xScale(i)}
              cy={yScale(d.value)}
              r="3"
              fill="#F20732"
              className="hover:r-5 transition-all cursor-pointer"
            />
          ))}

          {/* Gradient definition */}
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F20732" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#F20732" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 border-b border-white/10">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-[#F20732]/20 via-transparent to-transparent"></div>
        
        <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
          {/* Header - Now stacked for better visibility */}
          <div className="mb-12">
            <div>
              <div className="inline-flex items-center gap-3 mb-6">
                <div className="w-2 h-2 rounded-full bg-[#F20732] animate-pulse"></div>
                <span className="font-mono text-xs font-bold tracking-[0.2em] text-[#F20732] uppercase">
                  Real-Time Network Statistics
                </span>
              </div>
              
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-black leading-tight tracking-tighter mb-6">
                NETWORK <span className="text-[#F20732]">STATS</span>
              </h1>
              
              <p className="max-w-2xl text-gray-300 text-lg md:text-xl leading-relaxed mb-8">
                Live performance metrics from our global infrastructure. Monitor traffic, 
                capacity, and network health in real-time.
              </p>
            </div>

            {/* Controls Row - Location Dropdown & Live Indicator */}
            <div className="flex flex-wrap items-center gap-4">
              {/* City Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="px-6 py-3 border-2 border-white/20 font-mono text-xs font-bold tracking-widest uppercase transition-all duration-300 flex items-center gap-3 bg-white/5 hover:border-[#F20732] hover:bg-white/10 rounded-lg"
                >
                  <Globe size={16} strokeWidth={2.5} />
                  {selectedCity === 'all' ? 'ALL LOCATIONS' : locations.find(l => l.id === selectedCity)?.name.toUpperCase() || 'SELECT CITY'}
                  <ChevronDown size={16} className={`transform transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-64 bg-black border-2 border-white/20 shadow-2xl z-50 max-h-96 overflow-y-auto rounded-lg [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    {/* All Locations Option */}
                    <button
                      onClick={() => {
                        setSelectedCity('all');
                        setDropdownOpen(false);
                      }}
                      className={`w-full px-6 py-3 text-left font-mono text-xs font-bold tracking-wider uppercase transition-all border-b border-white/10 ${
                        selectedCity === 'all'
                          ? 'bg-[#F20732] text-white'
                          : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Globe size={14} />
                        <span>GLOBAL VIEW</span>
                      </div>
                    </button>

                    {/* City Options */}
                    {locations.map((location) => (
                      <button
                        key={location.id}
                        onClick={() => {
                          setSelectedCity(location.id);
                          setDropdownOpen(false);
                        }}
                        className={`w-full px-6 py-3 text-left transition-all border-b border-white/10 ${
                          selectedCity === location.id
                            ? 'bg-[#F20732] text-white'
                            : 'text-white/80 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <div className="text-xs font-bold font-mono tracking-wider uppercase">
                          {location.name}
                        </div>
                        <div className="text-[9px] text-white/60 font-mono mt-0.5">
                          {location.code} • {location.region}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Live Indicator */}
              <button
                onClick={() => setIsLive(!isLive)}
                className={`px-6 py-3 border-2 font-mono text-xs font-bold tracking-widest uppercase transition-all duration-300 flex items-center gap-3 rounded-lg ${
                  isLive 
                    ? 'border-[#F20732] bg-[#F20732]/10 text-[#F20732]' 
                    : 'border-white/20 text-white hover:border-white/40'
                }`}
              >
                {isLive && (
                  <div className="relative flex items-center">
                    <div className="w-2 h-2 bg-[#F20732] rounded-full"></div>
                    <div className="w-2 h-2 bg-[#F20732] rounded-full absolute animate-ping"></div>
                  </div>
                )}
                {isLive ? 'LIVE' : 'STATIC'}
              </button>

              {/* Grafana Connection Status */}
              <div className={`px-6 py-3 border-2 font-mono text-xs font-bold tracking-widest uppercase flex items-center gap-3 rounded-lg ${
                grafanaStatus.connected 
                  ? 'border-green-500/50 bg-green-500/10 text-green-400' 
                  : 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400'
              }`}>
                {grafanaStatus.connected ? <Wifi size={16} /> : <WifiOff size={16} />}
                <span>{grafanaStatus.connected ? 'GRAFANA CONNECTED' : 'SIMULATED DATA'}</span>
                {grafanaStatus.version && (
                  <span className="text-[10px] opacity-70">v{grafanaStatus.version}</span>
                )}
              </div>

              {/* Selected Location Badge */}
              {selectedCity !== 'all' && (
                <div className="inline-flex items-center gap-3 px-5 py-3 bg-white/5 border border-white/20 rounded-lg">
                  <MapPin size={18} className="text-[#F20732]" strokeWidth={2.5} />
                  <div>
                    <div className="text-sm font-bold text-white">
                      {locations.find(l => l.id === selectedCity)?.name}
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono tracking-wider">
                      {locations.find(l => l.id === selectedCity)?.code} • {locations.find(l => l.id === selectedCity)?.region}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Traffic Chart Section */}
      <section className="relative py-16 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          {/* Real-Time Grafana Traffic Cards */}
          {grafanaStatus.connected && realTraffic && (
            <div className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/30 p-6 rounded-lg">
                <div className="text-green-400 font-mono text-xs uppercase tracking-widest mb-2">Live Traffic</div>
                <div className="text-4xl font-light tracking-tighter text-white">
                  {realTraffic.current.toFixed(2)}
                  <span className="text-xl text-gray-400 ml-1">Gbps</span>
                </div>
                <div className="text-xs text-green-400 font-mono mt-1">From Grafana/Zabbix</div>
              </div>
              <div className="bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/30 p-6 rounded-lg">
                <div className="text-blue-400 font-mono text-xs uppercase tracking-widest mb-2">Inbound</div>
                <div className="text-4xl font-light tracking-tighter text-white">
                  {realTraffic.inbound.toFixed(2)}
                  <span className="text-xl text-gray-400 ml-1">Gbps</span>
                </div>
                <div className="text-xs text-blue-400 font-mono mt-1">↓ Bits Received</div>
              </div>
              <div className="bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/30 p-6 rounded-lg">
                <div className="text-purple-400 font-mono text-xs uppercase tracking-widest mb-2">Outbound</div>
                <div className="text-4xl font-light tracking-tighter text-white">
                  {realTraffic.outbound.toFixed(2)}
                  <span className="text-xl text-gray-400 ml-1">Gbps</span>
                </div>
                <div className="text-xs text-purple-400 font-mono mt-1">↑ Bits Sent</div>
              </div>
              <div className="bg-gradient-to-br from-[#F20732]/10 to-transparent border border-[#F20732]/30 p-6 rounded-lg">
                <div className="text-[#F20732] font-mono text-xs uppercase tracking-widest mb-2">Peak (24h)</div>
                <div className="text-4xl font-light tracking-tighter text-white">
                  {realTraffic.peak.toFixed(2)}
                  <span className="text-xl text-gray-400 ml-1">Gbps</span>
                </div>
                <div className="text-xs text-[#F20732] font-mono mt-1">Maximum observed</div>
              </div>
            </div>
          )}

          <div className="bg-gradient-to-br from-white/5 to-transparent border border-white/10 p-8 md:p-12">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl md:text-4xl font-black tracking-tighter mb-2">
                  Traffic Overview
                </h2>
                <p className="text-gray-400 font-mono text-sm">
                  {grafanaStatus.connected ? 'Live from LVSB SW-01 & MB2 SW-01' : 'Last 24 Hours (Simulated)'}
                </p>
              </div>
              <div className="text-right">
                <div className="text-4xl md:text-5xl font-light tracking-tighter text-[#F20732]">
                  {grafanaStatus.connected && realTraffic 
                    ? realTraffic.current.toFixed(1)
                    : currentTrafficData[currentTrafficData.length - 1]?.value.toFixed(1)
                  }
                  <span className="text-xl text-gray-400 ml-2">
                    {grafanaStatus.connected ? 'Gbps' : 'Tbps'}
                  </span>
                </div>
                <div className="text-sm text-green-400 font-mono flex items-center justify-end gap-1 mt-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                  {grafanaStatus.connected ? 'Real-time from Grafana' : '+12.3% from yesterday'}
                </div>
              </div>
            </div>
            
            <TrafficChart data={currentTrafficData} />
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <section className="relative py-16">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredStats.map((stat, index) => (
              <div
                key={stat.id}
                className="group relative bg-gradient-to-br from-white/5 to-transparent border border-white/10 p-8 hover:border-[#F20732] transition-all duration-500 overflow-hidden"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Hover effect */}
                <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
                
                {/* Content */}
                <div className="relative z-10">
                  {/* Label */}
                  <div className="flex items-start justify-between mb-6">
                    <span className="font-mono text-xs text-gray-400 uppercase tracking-widest group-hover:text-white transition-colors">
                      {stat.label}
                    </span>
                    {stat.trend && (
                      <div className={`flex items-center gap-1 text-xs font-mono ${
                        stat.trend === 'up' ? 'text-green-400' : 
                        stat.trend === 'down' ? 'text-red-400' : 
                        'text-gray-400'
                      }`}>
                        {stat.trend === 'up' && '↗'}
                        {stat.trend === 'down' && '↘'}
                        {stat.trend === 'stable' && '→'}
                      </div>
                    )}
                  </div>

                  {/* Value */}
                  <div className="text-5xl md:text-6xl font-light tracking-tighter group-hover:text-[#F20732] transition-colors mb-2">
                    <AnimatedCounter value={formatStatValue(stat)} />
                  </div>

                  {/* Unit & Trend */}
                  <div className="flex items-center justify-between">
                    <span className="text-xl text-gray-500 font-bold group-hover:text-gray-400 transition-colors">
                      {stat.unit}
                    </span>
                    {stat.trendValue && (
                      <span className={`text-xs font-mono ${
                        stat.trend === 'up' ? 'text-green-400' : 
                        stat.trend === 'down' ? 'text-red-400' : 
                        'text-gray-400'
                      }`}>
                        {stat.trendValue}
                      </span>
                    )}
                  </div>
                </div>

                {/* Background decoration */}
                <div className="absolute -bottom-6 -right-6 text-9xl font-black opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                  {formatStatValue(stat).substring(0, 2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* System Status */}
      <section className="relative py-16 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter mb-8">
            System Status
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20 p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="relative flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full absolute animate-ping"></div>
                </div>
                <span className="font-mono text-sm font-bold text-green-400 uppercase tracking-widest">
                  Network Status
                </span>
              </div>
              <p className="text-gray-400 text-sm">
                All network services are running normally with optimal performance.
              </p>
            </div>

            <div className="bg-gradient-to-br from-white/5 to-transparent border border-white/10 p-8">
              <div className="font-mono text-xs text-gray-400 uppercase tracking-widest mb-2">
                Last Updated
              </div>
              <div className="text-2xl font-light tracking-tighter">
                {new Date().toLocaleTimeString()}
              </div>
              <p className="text-gray-400 text-sm mt-2">
                {isLive ? `Updates every ${statsConfig.updateInterval / 1000}s` : 'Static snapshot'}
              </p>
            </div>

            <div className="bg-gradient-to-br from-[#F20732]/10 to-transparent border border-[#F20732]/20 p-8">
              <div className="font-mono text-xs text-[#F20732] uppercase tracking-widest mb-2">
                Network Health
              </div>
              <div className="text-2xl font-light tracking-tighter">
                99.99%
              </div>
              <p className="text-gray-400 text-sm mt-2">
                30-day rolling average uptime across all locations
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default StatsPage;
