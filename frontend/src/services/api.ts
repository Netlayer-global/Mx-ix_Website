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
  ixpManager: {
    enabled: boolean;
    url: string;
    hasApiKey: boolean;
    apiKeyMask: string;
  };
  zohoBooks: {
    enabled: boolean;
    region: string;
    organizationId: string;
    clientId: string;
    hasClientSecret: boolean;
    clientSecretMask: string;
    hasRefreshToken: boolean;
    refreshTokenMask: string;
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
  ixpManager?: {
    enabled?: boolean;
    url?: string;
    apiKey?: string;
  };
  zohoBooks?: {
    enabled?: boolean;
    region?: string;
    organizationId?: string;
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
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
  testIxpManager: (data: { url?: string; apiKey?: string }) =>
    apiCall<{ connected: boolean; customers?: number }>('/settings/test/ixpmanager', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  testZoho: (data: { region?: string; organizationId?: string; clientId?: string; clientSecret?: string; refreshToken?: string }) =>
    apiCall<{ connected: boolean; orgName?: string }>('/settings/test/zoho', {
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


// ============================================
// Customer Portal (separate auth from admin)
// ============================================
export const PORTAL_TOKEN_KEY = 'mx-ix-portal-token';

// Portal API helper — uses the customer token, never the admin token.
async function portalApiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string; message?: string }> {
  try {
    const token = localStorage.getItem(PORTAL_TOKEN_KEY);
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      // 401 = expired/invalid session. Clear and notify the portal shell.
      if (response.status === 401) {
        localStorage.removeItem(PORTAL_TOKEN_KEY);
        window.dispatchEvent(new CustomEvent('portal-unauthorized'));
      }
      return { success: false, error: result.error || 'Request failed', ...result };
    }
    return result;
  } catch (error) {
    console.error('Portal API call failed:', error);
    return { success: false, error: 'Network error. Please check your connection.' };
  }
}

export type PortalRole = 'admin' | 'viewer' | 'billing';
export type OrgStatus = 'pending' | 'active' | 'suspended';
export type PortStatus = 'active' | 'provisioning' | 'down' | 'maintenance';

export interface PortalUserInfo {
  id: string;
  email: string;
  name: string;
  role: PortalRole;
  twoFactorEnabled?: boolean;
}

export interface PortalOrgInfo {
  id: string;
  name: string;
  asn?: number;
  additionalAsns?: number[];
  type: string;
  status: OrgStatus;
  peeringPolicy: string;
  locations?: string[];
  website?: string;
  nocEmail?: string;
  nocPhone?: string;
}

export interface PortItem {
  _id: string;
  organization: string;
  name: string;
  location: string;
  speed: string;
  vlan?: string;
  ipv4?: string;
  ipv6?: string;
  macAddress?: string;
  status: PortStatus;
  zabbixHostId?: string;
  ixpManagerPortId?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface PortalOverview {
  organization: { name: string; asn?: number; additionalAsns?: number[]; status: OrgStatus; peeringPolicy: string };
  cards: {
    ports: number;
    activePorts: number;
    asns: number;
    peeringSessions: number;
    sessionsUp: number;
    openIncidents: number;
  };
  ports: Array<{ id: string; name: string; location: string; speed: string; status: PortStatus }>;
  incidents: Array<{ id: string; title: string; status: string; impact: string; startedAt?: string }>;
}

export interface PortalSession {
  routeserverId: string;
  routeserver: string;
  neighborId: string;
  address: string;
  asn: number;
  state: string;
  description: string;
  routesReceived: number;
  routesFiltered: number;
  routesExported: number;
  uptime?: number | string;
  lastError?: string;
}

export const portalApi = {
  // Auth
  signup: (data: {
    companyName: string;
    asn?: string | number;
    website?: string;
    type?: string;
    contactName: string;
    email: string;
    password: string;
    phone?: string;
    peeringPolicy?: string;
    additionalAsns?: number[];
    locations?: string[];
    desiredSpeed?: string;
    notes?: string;
  }) => portalApiCall<void>('/portal/auth/signup', { method: 'POST', body: JSON.stringify(data) }),

  login: async (email: string, password: string, token?: string) => {
    const result = await portalApiCall<{ token: string; user: PortalUserInfo; organization: PortalOrgInfo }>(
      '/portal/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password, token }) }
    );
    if (result.success && result.data?.token) {
      localStorage.setItem(PORTAL_TOKEN_KEY, result.data.token);
    }
    return result as typeof result & { twoFactorRequired?: boolean };
  },

  logout: () => localStorage.removeItem(PORTAL_TOKEN_KEY),
  isLoggedIn: () => !!localStorage.getItem(PORTAL_TOKEN_KEY),

  me: () => portalApiCall<{ user: PortalUserInfo; organization: PortalOrgInfo }>('/portal/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    portalApiCall<void>('/portal/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  setup2fa: () => portalApiCall<{ secret: string; otpauth: string; qr: string }>('/portal/auth/2fa/setup', { method: 'POST' }),
  enable2fa: (token: string) =>
    portalApiCall<void>('/portal/auth/2fa/enable', { method: 'POST', body: JSON.stringify({ token }) }),
  disable2fa: (password: string) =>
    portalApiCall<void>('/portal/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ password }) }),

  forgotPassword: (email: string) =>
    portalApiCall<void>('/portal/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

  resetPassword: (token: string, newPassword: string) =>
    portalApiCall<void>('/portal/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),

  // Data
  getOverview: () => portalApiCall<PortalOverview>('/portal/overview'),
  getPorts: () => portalApiCall<PortItem[]>('/portal/ports'),
  getPeeringSessions: () =>
    portalApiCall<{ asns: number[]; sessions: PortalSession[]; lgReachable: boolean }>('/portal/peering/sessions'),
  getPeeringRoutes: (rsId: string, neighborId: string, filter: 'received' | 'filtered' | 'not-exported' = 'received') =>
    portalApiCall<any>(
      `/portal/peering/routes/${encodeURIComponent(rsId)}/${encodeURIComponent(neighborId)}/${filter}`
    ),
};

// ── Portal: traffic & analytics ──
export type TrafficRange = '1h' | '24h' | '7d' | '30d' | '1y';

export interface TrafficSeries {
  t: number[];
  inbound: number[];
  outbound: number[];
}

export interface TrafficStats {
  peakIn: number;
  peakOut: number;
  avgIn: number;
  avgOut: number;
  p95In: number;
  p95Out: number;
  p95: number;
  unit: string;
}

export interface AggregateTraffic {
  range: TrafficRange;
  source: string;
  series: TrafficSeries;
  stats: TrafficStats;
  ports: Array<{ id: string; name: string; speed: string; location: string; stats: TrafficStats }>;
}

export interface PortTraffic {
  port: { id: string; name: string; speed: string; location: string };
  range: TrafficRange;
  source: string;
  series: TrafficSeries;
  stats: TrafficStats;
}

export const portalTrafficApi = {
  getAggregate: (range: TrafficRange = '24h') =>
    portalApiCall<AggregateTraffic>(`/portal/traffic?range=${range}`),
  getPort: (portId: string, range: TrafficRange = '24h') =>
    portalApiCall<PortTraffic>(`/portal/ports/${encodeURIComponent(portId)}/traffic?range=${range}`),
};

// ── Portal: team management ──
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: PortalRole;
  isActive: boolean;
  lastLogin?: string | null;
  createdAt?: string;
}

export const portalTeamApi = {
  list: () => portalApiCall<TeamMember[]>('/portal/team'),
  add: (data: { name: string; email: string; password: string; role: PortalRole }) =>
    portalApiCall<TeamMember>('/portal/team', { method: 'POST', body: JSON.stringify(data) }),
  update: (userId: string, data: { role?: PortalRole; isActive?: boolean }) =>
    portalApiCall<TeamMember>(`/portal/team/${userId}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (userId: string) => portalApiCall<void>(`/portal/team/${userId}`, { method: 'DELETE' }),
};

// ── Portal: bilateral peering & policy ──
export interface PeeringPolicyInfo {
  peeringPolicy: string;
  peeringPolicyUrl: string;
  peeringNotes: string;
  asn?: number;
  additionalAsns?: number[];
}

export interface PeerNetwork {
  id: string;
  name: string;
  asn: number;
  type: string;
  peeringPolicy: string;
  locations?: string[];
  website?: string;
}

export interface PeeringRequestItem {
  id: string;
  direction: 'incoming' | 'outgoing';
  fromAsn?: number;
  toAsn: number;
  toName: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  message?: string;
  responseMessage?: string;
  locations?: string[];
  respondedAt?: string | null;
  createdAt: string;
}

export const portalPeeringApi = {
  getPolicy: () => portalApiCall<PeeringPolicyInfo>('/portal/peering/policy'),
  updatePolicy: (data: { peeringPolicy?: string; peeringPolicyUrl?: string; peeringNotes?: string }) =>
    portalApiCall<PeeringPolicyInfo>('/portal/peering/policy', { method: 'PUT', body: JSON.stringify(data) }),
  getNetworks: () => portalApiCall<PeerNetwork[]>('/portal/peering/networks'),
  getMarketplace: () => portalApiCall<MarketplaceNetwork[]>('/portal/peering/marketplace'),
  listRequests: () => portalApiCall<PeeringRequestItem[]>('/portal/peering/requests'),
  createRequest: (data: { toAsn: number; toName?: string; message?: string; locations?: string[] }) =>
    portalApiCall<{ id: string; linkedToMember: boolean }>('/portal/peering/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  respondRequest: (id: string, action: 'accept' | 'reject', responseMessage?: string) =>
    portalApiCall<{ status: string }>(`/portal/peering/requests/${id}/respond`, {
      method: 'POST',
      body: JSON.stringify({ action, responseMessage }),
    }),
  cancelRequest: (id: string) =>
    portalApiCall<void>(`/portal/peering/requests/${id}/cancel`, { method: 'POST' }),
};

export interface MarketplaceNetwork extends PeerNetwork {
  sharedLocations: string[];
  recommended: boolean;
  requestStatus: string | null;
  score: number;
}

// ── Portal: notifications + live stream ──
export interface NotificationItem {
  _id: string;
  type: 'order' | 'ticket' | 'peering' | 'alert' | 'billing' | 'system';
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export const portalNotificationsApi = {
  list: () => portalApiCall<{ notifications: NotificationItem[]; unread: number }>('/portal/notifications'),
  markRead: (id: string) => portalApiCall<void>(`/portal/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => portalApiCall<void>('/portal/notifications/read-all', { method: 'POST' }),
  streamUrl: () => {
    const token = localStorage.getItem(PORTAL_TOKEN_KEY) || '';
    return `${API_BASE}/portal/stream?token=${encodeURIComponent(token)}`;
  },
};

// ── Portal: threshold alerts ──
export type AlertScope = 'aggregate' | 'port';
export type AlertMetric = 'traffic_in' | 'traffic_out' | 'utilization';

export interface AlertChannels {
  email: string[];
  slackWebhook?: string;
  webhook?: string;
}

export interface AlertRuleItem {
  _id: string;
  name: string;
  scope: AlertScope;
  portId?: string | null;
  metric: AlertMetric;
  thresholdMbps?: number;
  thresholdPercent?: number;
  channels: AlertChannels;
  enabled: boolean;
  cooldownMinutes: number;
  lastTriggeredAt?: string | null;
  createdAt: string;
}

export const portalAlertsApi = {
  list: () => portalApiCall<AlertRuleItem[]>('/portal/alerts'),
  create: (data: Partial<AlertRuleItem>) => portalApiCall<AlertRuleItem>('/portal/alerts', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<AlertRuleItem>) =>
    portalApiCall<AlertRuleItem>(`/portal/alerts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => portalApiCall<void>(`/portal/alerts/${id}`, { method: 'DELETE' }),
  test: (id: string) => portalApiCall<{ triggered: boolean; message?: string }>(`/portal/alerts/${id}/test`, { method: 'POST' }),
};

// ── Portal: self-service blackholing ──
export interface BlackholeItem {
  _id: string;
  prefix: string;
  description?: string;
  active: boolean;
  expiresAt?: string | null;
  createdBy?: string;
  createdAt: string;
}

export const portalBlackholeApi = {
  list: () => portalApiCall<BlackholeItem[]>('/portal/blackholes'),
  create: (data: { prefix: string; description?: string; expiresAt?: string }) =>
    portalApiCall<BlackholeItem>('/portal/blackholes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { active?: boolean; description?: string; expiresAt?: string | null }) =>
    portalApiCall<BlackholeItem>(`/portal/blackholes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => portalApiCall<void>(`/portal/blackholes/${id}`, { method: 'DELETE' }),
};

// ============================================
// Admin: Customer (Organization) management
// ============================================
export interface CustomerOrg {
  _id: string;
  name: string;
  legalName?: string;
  asn?: number;
  additionalAsns?: number[];
  website?: string;
  type: string;
  peeringPolicy: string;
  status: OrgStatus;
  locations?: string[];
  nocEmail?: string;
  nocPhone?: string;
  ixpManagerId?: string;
  zohoContactId?: string;
  notes?: string;
  approvedAt?: string | null;
  approvedBy?: string | null;
  userCount?: number;
  portCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerUser {
  _id: string;
  email: string;
  name: string;
  role: PortalRole;
  isActive: boolean;
  lastLogin?: string | null;
}

export const adminCustomersApi = {
  list: () => apiCall<CustomerOrg[]>('/admin/customers'),
  get: (id: string) =>
    apiCall<{ organization: CustomerOrg; users: CustomerUser[]; ports: PortItem[] }>(`/admin/customers/${id}`),
  create: (data: Partial<CustomerOrg> & { user?: { email: string; password: string; name?: string; role?: PortalRole } }) =>
    apiCall<CustomerOrg>('/admin/customers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<CustomerOrg>) =>
    apiCall<CustomerOrg>(`/admin/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  setStatus: (id: string, status: OrgStatus) =>
    apiCall<CustomerOrg>(`/admin/customers/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  remove: (id: string) => apiCall<void>(`/admin/customers/${id}`, { method: 'DELETE' }),
  // Ports
  createPort: (id: string, data: Partial<PortItem>) =>
    apiCall<PortItem>(`/admin/customers/${id}/ports`, { method: 'POST', body: JSON.stringify(data) }),
  updatePort: (id: string, portId: string, data: Partial<PortItem>) =>
    apiCall<PortItem>(`/admin/customers/${id}/ports/${portId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePort: (id: string, portId: string) =>
    apiCall<void>(`/admin/customers/${id}/ports/${portId}`, { method: 'DELETE' }),
  // Users
  createUser: (id: string, data: { email: string; password: string; name: string; role?: PortalRole }) =>
    apiCall<CustomerUser>(`/admin/customers/${id}/users`, { method: 'POST', body: JSON.stringify(data) }),
  deleteUser: (id: string, userId: string) =>
    apiCall<void>(`/admin/customers/${id}/users/${userId}`, { method: 'DELETE' }),
  // Impersonate (support/admin) — returns a portal session token
  impersonate: (id: string) =>
    apiCall<{ token: string; as: { email: string; name: string }; organization: string }>(
      `/admin/customers/${id}/impersonate`,
      { method: 'POST' }
    ),
};

// ── Admin: IXP Manager sync ──
export interface IxpSyncResult {
  fetched: number;
  linked: number;
  unmatched: Array<{ ixpManagerId: string; name: string; asn?: number }>;
}

export const adminIxpApi = {
  status: () => apiCall<{ configured: boolean; connected: boolean; error?: string }>('/admin/ixp/status'),
  sync: () => apiCall<IxpSyncResult>('/admin/ixp/sync', { method: 'POST' }),
  importPorts: (orgId: string) =>
    apiCall<{ imported: number; total: number }>(`/admin/ixp/import-ports/${orgId}`, { method: 'POST' }),
};

// ── Admin: Alice-LG route servers (Option A) ──
export interface RouteServerItem {
  _id: string;
  name: string;
  group: string;
  backend: 'birdwatcher' | 'gobgp';
  apiUrl: string;
  birdwatcherType: string;
  asn?: number;
  ipv4?: string;
  ipv6?: string;
  location?: string;
  order: number;
  enabled: boolean;
}

export const adminRouteServersApi = {
  list: () => apiCall<RouteServerItem[]>('/admin/route-servers'),
  create: (data: Partial<RouteServerItem>) =>
    apiCall<RouteServerItem>('/admin/route-servers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<RouteServerItem>) =>
    apiCall<RouteServerItem>(`/admin/route-servers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => apiCall<void>(`/admin/route-servers/${id}`, { method: 'DELETE' }),
  config: () => apiCall<{ config: string; applyConfigured: boolean; path: string | null }>('/admin/route-servers/config'),
  apply: () => apiCall<{ applied?: boolean; output?: string; config?: string }>('/admin/route-servers/apply', { method: 'POST' }),
};

// ============================================
// Orders (Services & provisioning)
// ============================================
export type OrderType = 'new_port' | 'upgrade' | 'addon';
export type OrderStatus =
  | 'submitted'
  | 'reviewing'
  | 'approved'
  | 'provisioning'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export interface OrderUpdate {
  status: OrderStatus;
  message: string;
  by: string;
  at: string;
}

export interface OrderItem {
  _id: string;
  organization: string;
  type: OrderType;
  location?: string;
  speed?: string;
  addon?: string;
  portId?: string | null;
  quantity?: number;
  notes?: string;
  status: OrderStatus;
  adminNotes?: string;
  ixpManagerRef?: string;
  updates: OrderUpdate[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  // admin-enriched
  orgName?: string;
  orgAsn?: number;
}

export interface OrderCatalog {
  locations: Array<{ id: string; name: string; region: string }>;
  speeds: string[];
  addons: Array<{ id: string; name: string; description: string }>;
}

export const portalOrdersApi = {
  getCatalog: () => portalApiCall<OrderCatalog>('/portal/orders/catalog'),
  list: () => portalApiCall<OrderItem[]>('/portal/orders'),
  create: (data: {
    type: OrderType;
    location?: string;
    speed?: string;
    addon?: string;
    portId?: string;
    quantity?: number;
    notes?: string;
  }) => portalApiCall<OrderItem>('/portal/orders', { method: 'POST', body: JSON.stringify(data) }),
  cancel: (id: string) => portalApiCall<void>(`/portal/orders/${id}/cancel`, { method: 'POST' }),
};

export const adminOrdersApi = {
  list: (status?: OrderStatus) =>
    apiCall<OrderItem[]>(`/admin/orders${status ? `?status=${status}` : ''}`),
  update: (id: string, data: { status?: OrderStatus; adminNotes?: string; message?: string }) =>
    apiCall<OrderItem>(`/admin/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  ixpMembers: () => apiCall<any[]>('/admin/orders/ixpmanager/members'),
};

// ============================================
// Portal Billing (Zoho Books, read-only)
// ============================================
export interface InvoiceItem {
  invoiceId: string;
  number: string;
  status: string;
  date: string;
  dueDate: string;
  total: number;
  balance: number;
  currency: string;
}

export const portalBillingApi = {
  listInvoices: () =>
    portalApiCall<{ configured: boolean; linked: boolean; invoices: InvoiceItem[] }>('/portal/billing/invoices'),
  // Fetches the PDF with the portal token and opens it in a new tab.
  openInvoicePdf: async (invoiceId: string): Promise<boolean> => {
    const token = localStorage.getItem(PORTAL_TOKEN_KEY);
    const r = await fetch(`${API_BASE}/portal/billing/invoices/${encodeURIComponent(invoiceId)}/pdf`, {
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
    });
    if (!r.ok) return false;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return true;
  },
};

// ============================================
// Support Tickets
// ============================================
export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketCategory = 'technical' | 'billing' | 'peering' | 'provisioning' | 'general';

export interface TicketMessage {
  from: 'member' | 'staff';
  authorName: string;
  body: string;
  at: string;
}

export interface TicketItem {
  _id: string;
  organization: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  messages: TicketMessage[];
  assignedTo?: string;
  createdBy?: string;
  lastReplyAt: string;
  createdAt: string;
  updatedAt: string;
  // admin-enriched
  orgName?: string;
  orgAsn?: number;
  messageCount?: number;
}

export const portalTicketsApi = {
  list: () => portalApiCall<TicketItem[]>('/portal/tickets'),
  get: (id: string) => portalApiCall<TicketItem>(`/portal/tickets/${id}`),
  create: (data: { subject: string; category: TicketCategory; priority: TicketPriority; body: string }) =>
    portalApiCall<TicketItem>('/portal/tickets', { method: 'POST', body: JSON.stringify(data) }),
  reply: (id: string, body: string) =>
    portalApiCall<TicketItem>(`/portal/tickets/${id}/reply`, { method: 'POST', body: JSON.stringify({ body }) }),
  close: (id: string) => portalApiCall<TicketItem>(`/portal/tickets/${id}/close`, { method: 'POST' }),
};

export const adminTicketsApi = {
  list: (status?: TicketStatus) => apiCall<TicketItem[]>(`/admin/tickets${status ? `?status=${status}` : ''}`),
  get: (id: string) => apiCall<TicketItem>(`/admin/tickets/${id}`),
  reply: (id: string, body: string) =>
    apiCall<TicketItem>(`/admin/tickets/${id}/reply`, { method: 'POST', body: JSON.stringify({ body }) }),
  update: (id: string, data: { status?: TicketStatus; assignedTo?: string; priority?: TicketPriority }) =>
    apiCall<TicketItem>(`/admin/tickets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// ============================================
// Admin: roles, audit, announcements, templates, NOC (Phase 6)
// ============================================
export type AdminRole = 'super-admin' | 'admin' | 'noc' | 'billing' | 'support' | 'editor';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  isActive: boolean;
  createdAt?: string;
}

export const adminUsersApi = {
  list: () => apiCall<AdminUser[]>('/admin/users'),
  create: (data: { email: string; password: string; name: string; role: AdminRole }) =>
    apiCall<AdminUser>('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { role?: AdminRole; isActive?: boolean; password?: string }) =>
    apiCall<AdminUser>(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => apiCall<void>(`/admin/users/${id}`, { method: 'DELETE' }),
};

export interface AuditEntry {
  _id: string;
  actor: string;
  action: string;
  resource: string;
  resourceId?: string;
  before?: any;
  after?: any;
  createdAt: string;
}

export interface AnnouncementItem {
  _id: string;
  title: string;
  body: string;
  type: 'info' | 'maintenance' | 'incident';
  channels: { inApp: boolean; email: boolean };
  audience: 'all' | 'active';
  sentBy?: string;
  recipients: number;
  createdAt: string;
}

export interface EmailTemplateItem {
  _id: string;
  key: string;
  name: string;
  subject: string;
  body: string;
  enabled: boolean;
  variables: string[];
}

export interface NocDashboard {
  totals: {
    members: number;
    ports: number;
    capacityGbps: number;
    openOrders: number;
    openTickets: number;
    active: number;
    pending: number;
    suspended: number;
  };
  capacity: Array<{ location: string; ports: number; capacityMbps: number; down: number }>;
  atRisk: Array<{ id: string; name: string; asn?: number; status: string; reasons: string[] }>;
}

export const adminSystemApi = {
  getAudit: (limit = 100) => apiCall<AuditEntry[]>(`/admin/system/audit?limit=${limit}`),
  listAnnouncements: () => apiCall<AnnouncementItem[]>('/admin/system/announcements'),
  createAnnouncement: (data: {
    title: string;
    body: string;
    type: 'info' | 'maintenance' | 'incident';
    channels: { inApp: boolean; email: boolean };
    audience: 'all' | 'active';
  }) => apiCall<AnnouncementItem>('/admin/system/announcements', { method: 'POST', body: JSON.stringify(data) }),
  listTemplates: () => apiCall<EmailTemplateItem[]>('/admin/system/email-templates'),
  upsertTemplate: (data: Partial<EmailTemplateItem>) =>
    apiCall<EmailTemplateItem>('/admin/system/email-templates', { method: 'PUT', body: JSON.stringify(data) }),
  deleteTemplate: (id: string) => apiCall<void>(`/admin/system/email-templates/${id}`, { method: 'DELETE' }),
  noc: () => apiCall<NocDashboard>('/admin/system/noc'),
};
