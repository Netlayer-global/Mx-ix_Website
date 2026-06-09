// MX-IX Network Statistics Configuration
// Update these values when client provides real-time data

export interface NetworkStat {
  id: string;
  label: string;
  value: number | string;
  unit: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  format?: 'number' | 'decimal' | 'percentage';
  category: 'traffic' | 'network' | 'performance' | 'geographic';
}

export interface TrafficDataPoint {
  timestamp: string;
  value: number;
}

export interface LocationStats {
  locationId: string;
  locationName: string;
  locationCode: string;
  stats: NetworkStat[];
  trafficData: TrafficDataPoint[];
}

// Mock data - replace with real API data
export const networkStats: NetworkStat[] = [
  // Essential Stats Only
  {
    id: 'total_capacity',
    label: 'Total Capacity',
    value: 450,
    unit: 'Tbps',
    format: 'number',
    category: 'network'
  },
  {
    id: 'peak_traffic',
    label: 'Peak Traffic (24h)',
    value: 156.2,
    unit: 'Tbps',
    trend: 'up',
    trendValue: '+8.1%',
    format: 'decimal',
    category: 'traffic'
  },
  {
    id: 'total_peers',
    label: 'Connected Networks',
    value: 4921,
    unit: 'Peers',
    trend: 'up',
    trendValue: '+47',
    format: 'number',
    category: 'network'
  },
  {
    id: 'ipv4_prefixes',
    label: 'IPv4 Prefixes',
    value: 892345,
    unit: 'Routes',
    trend: 'stable',
    format: 'number',
    category: 'network'
  }
];

// Mock traffic data for chart - replace with real API data
export const generateMockTrafficData = (): TrafficDataPoint[] => {
  const data: TrafficDataPoint[] = [];
  const now = new Date();
  
  for (let i = 23; i >= 0; i--) {
    const timestamp =new Date(now.getTime() - i * 60 * 60 * 1000);
    const baseValue = 100;
    const variation = Math.random() * 40 - 20; // ±20 Tbps variation
    
    data.push({
      timestamp: timestamp.toISOString(),
      value: Math.max(80, baseValue + variation)
    });
  }
  
  return data;
};

export const trafficData = generateMockTrafficData();

// Configuration for real-time updates
export const statsConfig = {
  // API endpoint - now using grafanaApi
  apiEndpoint: '/api/grafana/realtime' as string | null,
  
  // Update interval in milliseconds
  updateInterval: 5000, // 5 seconds for real-time feel
  
  // WebSocket URL when available
  websocketUrl: null as string | null, // 'wss://api.mx-ix.com/realtime' when ready
  
  // Enable/disable real-time updates
  enableRealTimeUpdates: true, // Now enabled with grafanaApi
  
  // Enable/disable mock data animation
  enableMockAnimation: true // Fallback animation
};

// Import grafanaApi for real-time data
import { grafanaApi } from '../services/api';

// Function to fetch stats from API
export const fetchNetworkStats = async (): Promise<NetworkStat[]> => {
  try {
    // Fetch real-time metrics from Grafana proxy
    const response = await grafanaApi.getRealTimeMetrics();
    
    if (response.success && response.data) {
      const metrics = response.data;
      
      // Update the network stats with real-time data
      return networkStats.map(stat => {
        switch (stat.id) {
          case 'total_traffic':
            return { ...stat, value: metrics.traffic.current };
          case 'peak_traffic':
            return { ...stat, value: metrics.traffic.peak };
          case 'active_as':
            return { ...stat, value: metrics.connections.active };
          case 'avg_latency':
            return { ...stat, value: metrics.latency.global };
          case 'uptime':
            // Ensure uptime is always between 99% and 100%
            const rawUptime = metrics.uptime || 99.9;
            // If it's already in range, keep it, otherwise generate a logical value naturally
            // But user specifically asked for "anything 99 to 100%"
            // So we'll force it just to be safe if the API returns something weird
            // or just ensure we display what we get if it's good, but for "random" request:
            const uptimeVal = rawUptime < 99 ? 99 + Math.random() : Math.min(rawUptime, 100);
            return { ...stat, value: parseFloat(uptimeVal.toFixed(3)) };
          default:
            // Add slight variation for other stats
            return {
              ...stat,
              value: typeof stat.value === 'number' 
                ? stat.value + (Math.random() * 2 - 1)
                : stat.value
            };
        }
      });
    }
  } catch (error) {
    console.error('Error fetching network stats from grafanaApi:', error);
  }
  
  // Fallback to mock data with slight variations
  if (statsConfig.enableMockAnimation) {
    return networkStats.map(stat => ({
      ...stat,
      value: typeof stat.value === 'number' 
        ? stat.value + (Math.random() * 2 - 1) // ±1 variation
        : stat.value
    }));
  }
  
  return networkStats;
};

// Function to format stat values
export const formatStatValue = (stat: NetworkStat): string => {
  if (typeof stat.value === 'string') return stat.value;
  
  switch (stat.format) {
    case 'decimal':
      return stat.value.toFixed(stat.value < 10 ? 1 : 0);
    case 'percentage':
      return stat.value.toFixed(2);
    case 'number':
    default:
      return stat.value >= 1000 
        ? stat.value.toLocaleString()
        : stat.value.toString();
  }
};

// City-specific statistics (mock data for demo)
const cityStatsMultipliers: Record<string, { traffic: number; peers: number; latency: number }> = {
  'nyc': { traffic: 1.2, peers: 1.1, latency: 0.9 },
  'sin': { traffic: 1.0, peers: 0.95, latency: 0.85 }, // Changed sgp to sin to match ID
  'ams': { traffic: 1.5, peers: 1.4, latency: 0.8 },
  'frk': { traffic: 1.6, peers: 1.5, latency: 0.7 },
  'bom': { traffic: 0.8, peers: 0.7, latency: 1.2 },
  'tyo': { traffic: 0.9, peers: 0.85, latency: 1.0 },
  'maa': { traffic: 0.75, peers: 0.65, latency: 1.1 },
  'del': { traffic: 0.85, peers: 0.75, latency: 1.1 },
  'dxb': { traffic: 0.95, peers: 0.8, latency: 1.0 }
};

// Generate city-specific stats
export const getCityStats = (locationId: string, locationName: string, locationCode: string): LocationStats => {
  const multipliers = cityStatsMultipliers[locationId] || { traffic: 1, peers: 1, latency: 1 };
  
  const cityStats: NetworkStat[] = [
    {
      id: 'total_capacity',
      label: 'Total Capacity',
      value: Math.floor(450 * multipliers.traffic),
      unit: 'Tbps',
      format: 'number',
      category: 'network'
    },
    {
      id: 'peak_traffic',
      label: 'Peak Traffic (24h)',
      value: parseFloat((156.2 * multipliers.traffic).toFixed(1)),
      unit: 'Tbps',
      trend: 'up',
      trendValue: '+8.1%',
      format: 'decimal',
      category: 'traffic'
    },
    {
      id: 'total_peers',
      label: 'Connected Networks',
      value: Math.floor(4921 * multipliers.peers),
      unit: 'Peers',
      trend: 'up',
      trendValue: '+47',
      format: 'number',
      category: 'network'
    },
    {
      id: 'ipv4_prefixes',
      label: 'IPv4 Prefixes',
      value: Math.floor(892345 * multipliers.peers),
      unit: 'Routes',
      trend: 'stable',
      format: 'number',
      category: 'network'
    }
  ];

  return {
    locationId,
    locationName,
    locationCode,
    stats: cityStats,
    trafficData: generateCityTrafficData(multipliers.traffic)
  };
};

// Generate city-specific traffic data
const generateCityTrafficData = (multiplier: number): TrafficDataPoint[] => {
  const data: TrafficDataPoint[] = [];
  const now = new Date();
  
  for (let i = 23; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
    const baseValue = 100 * multiplier;
    const variation = Math.random() * 40 - 20; // ±20 Tbps variation
    
    data.push({
      timestamp: timestamp.toISOString(),
      value: Math.max(80 * multiplier, baseValue + variation)
    });
  }
  
  return data;
};

