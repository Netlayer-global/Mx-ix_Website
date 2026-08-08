import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { locationsApi, servicesApi, networkStatsApi, globalFabricStatsApi, continentsApi, Continent, PricingTier } from '../services/api';

// Re-export types from API to ensure consistency
export type { Continent, PricingTier };

// Types
export interface NetworkStats {
  globalLatency: { value: number; unit: string };
  activeNodes: number;
  throughput: number;
  locationsCount?: number;
}

export interface GlobalFabricStats {
  totalCapacity: string;
  activeRoutes: string;
  avgLatency: string;
  globalCoverage: string;
}

export interface ServiceItem {
  name: string;
  icon: any;
  description: string;
  benefits: string[];
  features: string[];
  stats?: Array<{ label: string; value: string; period: string }>;
}

export interface Service {
  id: string;
  category: string;
  tagline: string;
  description: string;
  image: string;
  items: ServiceItem[];
}

export interface ASN {
  asnNumber: number;
  name: string;
  macro: string;
  peeringPolicy: 'Open' | 'Selective' | 'Restrictive' | 'No Policy';
  status: 'ACTIVE' | 'CONNECTING' | 'INACTIVE';
}

export interface EnabledSite {
  id: string;
  name: string;
  provider: string;
  address: string;
  status: 'available' | 'coming-soon';
}

export interface Location {
  id: string;
  name: string;
  coordinates: [number, number];
  code: string;
  region: string;
  asns: number;
  sites: number;
  asnList: ASN[];
  enabledSites: EnabledSite[];
  status: 'current' | 'upcoming';
  // Extended fields for detailed location info
  country?: string;
  continentId?: string;
  latency?: string;
  datacenter?: string;
  address?: string;
  ixName?: string;
  peers?: number;
  capacity?: string;
  uptime?: string; // Uptime percentage (e.g., "99.99%")
  ipv4Routes?: string;
  ipv6Routes?: string;
  portSpeeds?: string[];
  protocols?: string[];
  features?: string[];
  description?: string;
  established?: string;
  cityImage?: string;
  pricing?: PricingTier[];
  routeServers?: {
    name: string;
    asn: string;
    ipv4: string;
    ipv6: string;
  }[];
}

interface AdminContextType {
  networkStats: NetworkStats;
  globalFabricStats: GlobalFabricStats;
  services: Service[];
  locations: Location[];
  continents: Continent[];
  loading: boolean;
  updateNetworkStats: (stats: NetworkStats) => void;
  updateGlobalFabricStats: (stats: GlobalFabricStats) => void;
  updateServices: (services: Service[]) => void;
  addService: (service: Service) => void;
  removeService: (serviceId: string) => void;
  updateService: (serviceId: string, service: Service) => void;
  updateLocations: (locations: Location[]) => void;
  addLocation: (location: Location) => void;
  removeLocation: (locationId: string) => void;
  updateLocation: (locationId: string, location: Location) => void;
  updateContinents: (continents: Continent[]) => void;
  addContinent: (continent: Continent) => void;
  removeContinent: (continentId: string) => void;
  updateContinent: (continentId: string, continent: Continent) => void;
  resetToDefaults: () => void;
  refreshData: () => Promise<void>;
}

// Default values (fallback if API fails)
const defaultNetworkStats: NetworkStats = {
  globalLatency: { value: 0.4, unit: 'ms' },
  activeNodes: 4921,
  throughput: 124,
  locationsCount: 14,
};

const defaultGlobalFabricStats: GlobalFabricStats = {
  totalCapacity: '5.2 Tbps',
  activeRoutes: '10,000+',
  avgLatency: '<5ms',
  globalCoverage: '100%'
};

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [networkStats, setNetworkStats] = useState<NetworkStats>(defaultNetworkStats);
  const [globalFabricStats, setGlobalFabricStats] = useState<GlobalFabricStats>(defaultGlobalFabricStats);
  const [services, setServices] = useState<Service[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [continents, setContinents] = useState<Continent[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch data from API on mount
  const refreshData = async () => {
    setLoading(true);
    try {
      // Fetch all data in parallel
      const [locationsRes, servicesRes, networkRes, fabricRes, continentsRes] = await Promise.all([
        locationsApi.getAll(),
        servicesApi.getAll(),
        networkStatsApi.get(),
        globalFabricStatsApi.get(),
        continentsApi.getAll(),
      ]);

      if (locationsRes.success && locationsRes.data) {
        setLocations(locationsRes.data);
      }
      if (servicesRes.success && servicesRes.data) {
        setServices(servicesRes.data);
      }
      if (networkRes.success && networkRes.data) {
        setNetworkStats(networkRes.data);
      }
      if (fabricRes.success && fabricRes.data) {
        setGlobalFabricStats(fabricRes.data);
      }
      if (continentsRes.success && continentsRes.data) {
        setContinents(continentsRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    refreshData();
  }, []);

  const updateNetworkStats = (stats: NetworkStats) => setNetworkStats(stats);
  const updateGlobalFabricStats = (stats: GlobalFabricStats) => setGlobalFabricStats(stats);
  const updateServices = (newServices: Service[]) => setServices(newServices);

  const addService = (service: Service) => setServices(prev => [...prev, service]);
  const removeService = (serviceId: string) => setServices(prev => prev.filter(s => s.id !== serviceId));
  const updateService = (serviceId: string, service: Service) => {
    setServices(prev => prev.map(s => s.id === serviceId ? service : s));
  };

  const updateLocations = (newLocations: Location[]) => setLocations(newLocations);
  const addLocation = (location: Location) => setLocations(prev => [...prev, location]);
  const removeLocation = (locationId: string) => setLocations(prev => prev.filter(l => l.id !== locationId));
  const updateLocation = (locationId: string, location: Location) => {
    setLocations(prev => prev.map(l => l.id === locationId ? location : l));
  };

  const updateContinents = (newContinents: Continent[]) => setContinents(newContinents);
  const addContinent = (continent: Continent) => setContinents(prev => [...prev, continent]);
  const removeContinent = (continentId: string) => setContinents(prev => prev.filter(c => c.id !== continentId));
  const updateContinent = (continentId: string, continent: Continent) => {
    setContinents(prev => prev.map(c => c.id === continentId ? continent : c));
  };

  const resetToDefaults = () => {
    setNetworkStats(defaultNetworkStats);
    setGlobalFabricStats(defaultGlobalFabricStats);
    setServices([]);
    setLocations([]);
    setContinents([]);
  };

  return (
    <AdminContext.Provider
      value={{
        networkStats,
        globalFabricStats,
        services,
        locations,
        continents,
        loading,
        updateNetworkStats,
        updateGlobalFabricStats,
        updateServices,
        addService,
        removeService,
        updateService,
        updateLocations,
        addLocation,
        removeLocation,
        updateLocation,
        updateContinents,
        addContinent,
        removeContinent,
        updateContinent,
        resetToDefaults,
        refreshData
      }}
    >

      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return context;
};
