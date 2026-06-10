// API Service for MX-IX Backend
// This file handles all API calls to the backend

const API_BASE = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL || 'http://localhost:5000/api');

// Helper function for API calls
async function apiCall<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string; message?: string }> {
  try {
    const token = localStorage.getItem('mx-ix-admin-token');
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const result = await response.json();
    
    if (!response.ok) {
      // Handle token expiration (401 Unauthorized)
      if (response.status === 401) {
        // Clear tokens
        localStorage.removeItem('mx-ix-admin-token');
        localStorage.removeItem('mx-ix-admin-auth');
        
        // Redirect to login by reloading the page
        // This will force the auth check to fail and show login screen
        window.location.reload();
        
        return { success: false, error: 'Session expired. Please login again.' };
      }
      
      return { success: false, error: result.error || 'Request failed' };
    }

    return result;
  } catch (error) {
    console.error('API call failed:', error);
    return { success: false, error: 'Network error. Please check your connection.' };
  }
}

// ============================================
// Authentication
// ============================================
export const authApi = {
  login: async (email: string, password: string) => {
    const result = await apiCall<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (result.success && result.data?.token) {
      localStorage.setItem('mx-ix-admin-token', result.data.token);
    }
    
    return result;
  },

  logout: () => {
    localStorage.removeItem('mx-ix-admin-token');
  },

  getMe: () => apiCall<any>('/auth/me'),

  isLoggedIn: () => !!localStorage.getItem('mx-ix-admin-token'),
};

// ============================================
// Services
// ============================================
export interface ServiceItem {
  name: string;
  icon: string;
  description: string;
  benefits: string[];
  features: string[];
  stats?: Array<{ label: string; value: string; period: string }>;
  order: number;
}

export interface Service {
  id: string;
  category: string;
  tagline: string;
  description: string;
  image: string;
  items: ServiceItem[];
  order: number;
  isActive: boolean;
}

export const servicesApi = {
  getAll: () => apiCall<Service[]>('/services'),
  
  get: (id: string) => apiCall<Service>(`/services/${id}`),
  
  create: (service: Partial<Service>) => 
    apiCall<Service>('/services', {
      method: 'POST',
      body: JSON.stringify(service),
    }),
  
  update: (id: string, updates: Partial<Service>) => 
    apiCall<Service>(`/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  
  delete: (id: string) => 
    apiCall<void>(`/services/${id}`, { method: 'DELETE' }),

  // Service Items
  addItem: (serviceId: string, item: Partial<ServiceItem>) =>
    apiCall<ServiceItem[]>(`/services/${serviceId}/items`, {
      method: 'POST',
      body: JSON.stringify(item),
    }),

  updateItem: (serviceId: string, itemIndex: number, updates: Partial<ServiceItem>) =>
    apiCall<ServiceItem[]>(`/services/${serviceId}/items/${itemIndex}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  deleteItem: (serviceId: string, itemIndex: number) =>
    apiCall<ServiceItem[]>(`/services/${serviceId}/items/${itemIndex}`, {
      method: 'DELETE',
    }),
};

// ============================================
// Continents
// ============================================
export interface Continent {
  id: string;
  name: string;
  description: string;
  order: number;
  isActive: boolean;
}

export const continentsApi = {
  getAll: (isActive?: boolean) => {
    const query = isActive !== undefined ? `?isActive=${isActive}` : '';
    return apiCall<Continent[]>(`/continents${query}`);
  },
  
  get: (id: string) => apiCall<Continent>(`/continents/${id}`),
  
  create: (continent: Partial<Continent>) => 
    apiCall<Continent>('/continents', {
      method: 'POST',
      body: JSON.stringify(continent),
    }),
  
  update: (id: string, updates: Partial<Continent>) => 
    apiCall<Continent>(`/continents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  
  delete: (id: string) => 
    apiCall<void>(`/continents/${id}`, { method: 'DELETE' }),
};

// ============================================
// Locations
// ============================================
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

export interface PricingTier {
  portSpeed: string;
  monthlyPrice: number;
  setupFee: number;
  currency: string;
}

export interface RouteServer {
  name: string;
  asn: string;
  ipv4: string;
  ipv6: string;
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
  uptime?: string;
  ipv4Routes?: string;
  ipv6Routes?: string;
  portSpeeds?: string[];
  protocols?: string[];
  features?: string[];
  description?: string;
  established?: string;
  cityImage?: string;
  pricing?: PricingTier[];
  routeServers?: RouteServer[];
}

export const locationsApi = {
  getAll: () => apiCall<Location[]>('/locations'),
  get: (id: string) => apiCall<Location>(`/locations/${id}`),
  create: (location: Partial<Location>) => 
    apiCall<Location>('/locations', {
      method: 'POST',
      body: JSON.stringify(location),
    }),
  update: (id: string, updates: Partial<Location>) => 
    apiCall<Location>(`/locations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  delete: (id: string) => 
    apiCall<void>(`/locations/${id}`, { method: 'DELETE' }),

  // ASN Management
  addAsn: (locationId: string, asn: Partial<ASN>) =>
    apiCall<Location>(`/locations/${locationId}/asns`, {
      method: 'POST',
      body: JSON.stringify(asn),
    }),
  deleteAsn: (locationId: string, asnNumber: number) =>
    apiCall<Location>(`/locations/${locationId}/asns/${asnNumber}`, {
      method: 'DELETE',
    }),

  // Site Management
  addSite: (locationId: string, site: Partial<EnabledSite>) =>
    apiCall<Location>(`/locations/${locationId}/sites`, {
      method: 'POST',
      body: JSON.stringify(site),
    }),
  deleteSite: (locationId: string, siteId: string) =>
    apiCall<Location>(`/locations/${locationId}/sites/${siteId}`, {
      method: 'DELETE',
    }),
};

// ============================================
// Network Stats
// ============================================
export interface NetworkStats {
  globalLatency: { value: number; unit: string };
  activeNodes: number;
  throughput: number;
  locationsCount?: number;
}

export const networkStatsApi = {
  get: () => apiCall<NetworkStats>('/network-stats'),
  update: (stats: Partial<NetworkStats>) => 
    apiCall<NetworkStats>('/network-stats', {
      method: 'PUT',
      body: JSON.stringify(stats),
    }),
};

// ============================================
// Global Fabric Stats
// ============================================
export interface GlobalFabricStats {
  totalCapacity: string;
  activeRoutes: string;
  avgLatency: string;
  globalCoverage: string;
}

export const globalFabricStatsApi = {
  get: () => apiCall<GlobalFabricStats>('/global-fabric-stats'),
  update: (stats: Partial<GlobalFabricStats>) => 
    apiCall<GlobalFabricStats>('/global-fabric-stats', {
      method: 'PUT',
      body: JSON.stringify(stats),
    }),
};

// ============================================
// Grafana - Real-time Traffic Data
// ============================================
export interface TrafficData {
  currentTraffic: number;
  unit: string;
  peakTraffic: number;
  peakTime: string;
  avgTraffic: number;
  timestamp: string;
  source: string;
}

export interface RealTimeMetrics {
  traffic: {
    current: number;
    peak: number;
    average: number;
    unit: string;
  };
  connections: {
    active: number;
    peak: number;
    total: number;
  };
  latency: {
    global: number;
    unit: string;
  };
  uptime: number;
  timestamp: string;
}

export const grafanaApi = {
  getTraffic: () => apiCall<TrafficData>('/grafana/traffic'),
  getRealTimeMetrics: () => apiCall<RealTimeMetrics>('/grafana/realtime'),
  getStatus: () => apiCall<{ connected: boolean; message: string }>('/grafana/status'),
};

// ============================================
// Contacts
// ============================================
export interface Contact {
  department: string;
  locationId: string;
  phone: string;
  email: string;
}

export const contactsApi = {
  getAll: (params?: { department?: string; locationId?: string }) => {
    const query = new URLSearchParams();
    if (params?.department) query.append('department', params.department);
    if (params?.locationId) query.append('locationId', params.locationId);
    const queryString = query.toString();
    return apiCall<Contact[]>(`/contacts${queryString ? `?${queryString}` : ''}`);
  },
  
  get: (department: string, locationId: string) => 
    apiCall<Contact>(`/contacts/${department}/${locationId}`),
  
  upsert: (department: string, locationId: string, data: { phone: string; email: string }) => 
    apiCall<Contact>(`/contacts/${department}/${locationId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  delete: (department: string, locationId: string) => 
    apiCall<void>(`/contacts/${department}/${locationId}`, {
      method: 'DELETE',
    }),
};

export const statsApi = {
  get: () => apiCall<any>('/stats'),
  update: (data: any) => apiCall<any>('/stats', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
};

// ============================================
// Integration Settings (Grafana / Zabbix)
// ============================================
export interface IntegrationSettings {
  grafana: {
    enabled: boolean;
    url: string;
    zabbixDatasourceUid: string;
    hasApiKey: boolean;
    apiKeyMask: string;
  };
  zabbix: {
    enabled: boolean;
    url: string;
    hasApiToken: boolean;
    apiTokenMask: string;
  };
  updatedAt?: string;
}

export interface SettingsUpdate {
  grafana?: {
    enabled?: boolean;
    url?: string;
    apiKey?: string;
    zabbixDatasourceUid?: string;
  };
  zabbix?: {
    enabled?: boolean;
    url?: string;
    apiToken?: string;
  };
}

export const settingsApi = {
  get: () => apiCall<IntegrationSettings>('/settings'),
  update: (data: SettingsUpdate) =>
    apiCall<void>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  testGrafana: (data: { url?: string; apiKey?: string }) =>
    apiCall<{ connected: boolean; version?: string; database?: string; status?: number }>(
      '/settings/test/grafana',
      { method: 'POST', body: JSON.stringify(data) }
    ),
  testZabbix: (data: { url?: string; apiToken?: string }) =>
    apiCall<{ connected: boolean; version?: string }>('/settings/test/zabbix', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ============================================
// Looking Glass (Alice-LG proxy)
// ============================================
export interface LgRouteServer {
  id: string;
  name: string;
  group?: string;
  type?: string;
  status?: { message?: string; backend?: string; version?: string };
}

export interface LgNeighbor {
  id: string;
  address: string;
  asn: number;
  state: string;
  description: string;
  routes_received?: number;
  routes_filtered?: number;
  routes_exported?: number;
  routes_accepted?: number;
  routes_preferred?: number;
  uptime?: number | string;
  last_error?: string;
  details?: { bgp_state?: string; [k: string]: any };
}

export interface LgRoute {
  network: string;
  gateway: string;
  interface?: string;
  age?: string;
  bgp?: {
    as_path?: number[];
    next_hop?: string;
    communities?: number[][];
    large_communities?: number[][];
    local_pref?: number;
    med?: number;
  };
}

export const lookingGlassApi = {
  getRouteservers: () => apiCall<{ routeservers?: LgRouteServer[] }>('/lg/routeservers'),
  getStatus: (rsId: string) =>
    apiCall<{ status?: { version?: string; message?: string; last_reboot?: string; last_reconfig?: string; router_id?: string } }>(
      `/lg/routeservers/${encodeURIComponent(rsId)}/status`
    ),
  getNeighbors: (rsId: string) =>
    apiCall<{ neighbors?: LgNeighbor[]; neighbours?: LgNeighbor[] }>(
      `/lg/routeservers/${encodeURIComponent(rsId)}/neighbors`
    ),
  getRoutes: (rsId: string, neighborId: string, filter: 'received' | 'filtered' | 'not-exported' = 'received') =>
    apiCall<{ imported?: LgRoute[]; filtered?: LgRoute[]; routes?: LgRoute[] }>(
      `/lg/routeservers/${encodeURIComponent(rsId)}/neighbors/${encodeURIComponent(neighborId)}/routes/${filter}`
    ),
  lookup: (query: string) =>
    apiCall<{ imported?: LgRoute[]; filtered?: LgRoute[]; routes?: LgRoute[] }>(
      `/lg/lookup?q=${encodeURIComponent(query)}`
    ),
  lookupNeighbors: (query: string) =>
    apiCall<{ neighbors?: LgNeighbor[]; neighbours?: LgNeighbor[] }>(
      `/lg/lookup/neighbors?q=${encodeURIComponent(query)}`
    ),
};

// ============================================
// System Status (status page)
// ============================================
export type ComponentStatus = 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance';
export type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved';
export type IncidentImpact = 'minor' | 'major' | 'critical' | 'maintenance';

export interface StatusComponentItem {
  _id: string;
  name: string;
  group: string;
  status: ComponentStatus;
  description?: string;
  uptime?: number;
  order: number;
  isActive: boolean;
  history?: { date: string; status: ComponentStatus }[];
}

export interface IncidentUpdate {
  status: IncidentStatus;
  message: string;
  timestamp: string;
}

export interface IncidentItem {
  _id: string;
  title: string;
  status: IncidentStatus;
  impact: IncidentImpact;
  affectedComponents: string[];
  updates: IncidentUpdate[];
  startedAt?: string;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SystemStatus {
  overall: { status: ComponentStatus; label: string };
  components: StatusComponentItem[];
  incidents: IncidentItem[];
}

// ============================================
// Members (public directory, admin-managed)
// ============================================
export type MemberType = 'ISP' | 'Content' | 'Cloud' | 'CDN' | 'Enterprise' | 'Academic' | 'Other';
export type MemberPolicy = 'Open' | 'Selective' | 'Restrictive';

export interface MemberItem {
  _id: string;
  name: string;
  asn?: number;
  logo?: string;
  website?: string;
  type: MemberType;
  peeringPolicy: MemberPolicy;
  capacity?: string;
  locations: string[];
  joinedDate?: string | null;
  featured: boolean;
  order: number;
  isActive: boolean;
}

export const membersApi = {
  getAll: () => apiCall<MemberItem[]>('/members'),
  adminGetAll: () => apiCall<MemberItem[]>('/members/all'),
  create: (data: Partial<MemberItem>) => apiCall<MemberItem>('/members', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<MemberItem>) => apiCall<MemberItem>(`/members/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiCall<void>(`/members/${id}`, { method: 'DELETE' }),
};

export const statusApi = {
  get: () => apiCall<SystemStatus>('/status'),
  subscribe: (email: string) =>
    apiCall<void>('/status/subscribe', { method: 'POST', body: JSON.stringify({ email }) }),
  getSubscribers: () => apiCall<{ count: number; subscribers: string[] }>('/status/subscribers'),
  createComponent: (data: Partial<StatusComponentItem>) =>
    apiCall<StatusComponentItem>('/status/components', { method: 'POST', body: JSON.stringify(data) }),
  updateComponent: (id: string, data: Partial<StatusComponentItem>) =>
    apiCall<StatusComponentItem>(`/status/components/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteComponent: (id: string) =>
    apiCall<void>(`/status/components/${id}`, { method: 'DELETE' }),
  createIncident: (data: { title: string; status?: IncidentStatus; impact?: IncidentImpact; affectedComponents?: string[]; message?: string; startedAt?: string; resolvedAt?: string | null }) =>
    apiCall<IncidentItem>('/status/incidents', { method: 'POST', body: JSON.stringify(data) }),
  updateIncident: (id: string, data: { title?: string; status?: IncidentStatus; impact?: IncidentImpact; message?: string; startedAt?: string; resolvedAt?: string | null }) =>
    apiCall<IncidentItem>(`/status/incidents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteIncident: (id: string) =>
    apiCall<void>(`/status/incidents/${id}`, { method: 'DELETE' }),
};

export default {
  auth: authApi,
  services: servicesApi,
  continents: continentsApi,
  locations: locationsApi,
  networkStats: networkStatsApi,
  globalFabricStats: globalFabricStatsApi,
  grafana: grafanaApi,
  contacts: contactsApi,
  stats: statsApi,
  settings: settingsApi,
  lookingGlass: lookingGlassApi,
  status: statusApi,
  members: membersApi,
};

