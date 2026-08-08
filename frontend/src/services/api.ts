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
  getTraffic: (range?: string) => apiCall<TrafficData>(`/grafana/traffic${range ? `?range=${range}` : ''}`),
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

  // Public: submit the contact / port-request form
  submit: (data: Record<string, any>) =>
    apiCall<void>('/contacts/submit', { method: 'POST', body: JSON.stringify(data) }),

  // Admin: list submissions
  submissions: () => apiCall<any[]>('/contacts/submissions'),
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
  flowGraph: {
    enabled: boolean;
    urlTemplate: string;
  };
  contactForm: {
    recipientEmail: string;
    supportEmail: string;
    ccEmails: string;
  };
  zohoProfiles?: Array<{
    key: string;
    label: string;
    region: string;
    organizationId: string;
    clientId: string;
    hasClientSecret: boolean;
    clientSecretMask: string;
    hasRefreshToken: boolean;
    refreshTokenMask: string;
    enabled: boolean;
  }>;
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
  flowGraph?: {
    enabled?: boolean;
    urlTemplate?: string;
  };
  contactForm?: {
    recipientEmail?: string;
    supportEmail?: string;
    ccEmails?: string;
  };
  zohoProfiles?: Array<{
    key: string;
    label?: string;
    region?: string;
    organizationId?: string;
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
    enabled?: boolean;
  }>;
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
  testZoho: (data: { region?: string; organizationId?: string; clientId?: string; clientSecret?: string; refreshToken?: string; profileKey?: string }) =>
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

export interface LgPagination {
  total_results?: number;
  page?: number;
  per_page?: number;
  total_pages?: number;
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
  getRoutes: (
    rsId: string,
    neighborId: string,
    filter: 'received' | 'filtered' | 'not-exported' = 'received',
    page = 0,
    q = ''
  ) =>
    apiCall<{ imported?: LgRoute[]; filtered?: LgRoute[]; routes?: LgRoute[]; pagination?: LgPagination }>(
      `/lg/routeservers/${encodeURIComponent(rsId)}/neighbors/${encodeURIComponent(neighborId)}/routes/${filter}` +
        `?page=${page}${q ? `&q=${encodeURIComponent(q)}` : ''}`
    ),
  lookup: (query: string, page = 0) =>
    apiCall<{ imported?: LgRoute[]; filtered?: LgRoute[]; routes?: LgRoute[]; pagination?: LgPagination }>(
      `/lg/lookup?q=${encodeURIComponent(query)}&page=${page}`
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
  zabbixInterface?: string;
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
    peeringSessions: number | null;
    sessionsUp: number | null;
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
  getPeeringRoutes: (
    rsId: string,
    neighborId: string,
    filter: 'received' | 'filtered' | 'not-exported' = 'received',
    page = 0,
    q = ''
  ) =>
    portalApiCall<any>(
      `/portal/peering/routes/${encodeURIComponent(rsId)}/${encodeURIComponent(neighborId)}/${filter}` +
        `?page=${page}${q ? `&q=${encodeURIComponent(q)}` : ''}`
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
  ports: Array<{ id: string; name: string; speed: string; location: string; stats: TrafficStats; series?: TrafficSeries }>;
}

export interface SflowPeer {
  asn: number;
  name: string;
  values: number[];
  peak: number;
}

export interface SflowTraffic {
  range: TrafficRange;
  source: string;
  unit: string;
  t: number[];
  peers: SflowPeer[];
  embedUrl?: string;
}

export interface PortTraffic {
  port: { id: string; name: string; speed: string; location: string };
  range: TrafficRange;
  source: string;
  series: TrafficSeries;
  stats: TrafficStats;
}

export interface PortHealth {
  status: 'up' | 'down' | 'unknown';
  latencyMs: number | null;
  lossPct: number | null;
  availabilityPct: number | null;
  source: string;
}

export const portalTrafficApi = {
  getAggregate: (range: TrafficRange = '24h') =>
    portalApiCall<AggregateTraffic>(`/portal/traffic?range=${range}`),
  getPort: (portId: string, range: TrafficRange = '24h') =>
    portalApiCall<PortTraffic>(`/portal/ports/${encodeURIComponent(portId)}/traffic?range=${range}`),
  getSflow: (range: TrafficRange = '24h') =>
    portalApiCall<SflowTraffic>(`/portal/traffic/sflow?range=${range}`),
  getPortHealth: (portId: string) =>
    portalApiCall<PortHealth>(`/portal/ports/${encodeURIComponent(portId)}/health`),
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
  zohoProfileKey?: string;
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
  zohoContacts: (q: string, profile?: string) =>
    apiCall<Array<{ id: string; name: string; email?: string; companyName?: string }>>(
      `/admin/customers/zoho/contacts?q=${encodeURIComponent(q)}${profile ? `&profile=${encodeURIComponent(profile)}` : ''}`
    ),
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
  created?: number;
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

// ============================================================================
// IXP FABRIC — native peering infrastructure management
//
// Flow: Infrastructure → Facility → Cabinet → Rack unit → Device → Port
//       then VLAN + IP → Peer (VLAN interface) → BIRD route servers.
// Backed by /admin/fabric, /admin/vlans, /admin/peers, /admin/bird,
// /admin/peeringdb.
// ============================================================================

// ── Infrastructure (an IXP: one switching fabric, normally one metro) ──
export interface InfrastructureItem {
  _id: string;
  name: string;
  shortname: string;
  asn: number;
  peeringLanName?: string;
  location?: string;
  additionalLocations?: string[];
  ixfId?: number;
  peeringdbIxId?: number;
  peeringdbIxLanId?: number;
  mtu: number;
  isPrimary: boolean;
  nocEmail?: string;
  nocPhone?: string;
  nocWebsite?: string;
  notes?: string;
  enabled: boolean;
  order: number;
  // enriched by the list endpoint
  switchCount?: number;
  vlanCount?: number;
  routeServerCount?: number;
}

// ── Facility (a data centre we have presence in) ──
export interface FacilityItem {
  _id: string;
  name: string;
  shortname: string;
  infrastructure?: string | null;
  provider?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  peeringdbFacId?: number;
  clli?: string;
  npanxx?: string;
  supportEmail?: string;
  supportPhone?: string;
  ticketUrl?: string;
  cageRef?: string;
  notes?: string;
  active: boolean;
  order: number;
  cabinetCount?: number;
  deviceCount?: number;
}

// ── Cabinet (a rack) ──
export interface CabinetItem {
  _id: string;
  facility: string;
  name: string;
  uHeight: number;
  uNumbering: 'bottom-up' | 'top-down';
  cageRef?: string;
  rowRef?: string;
  providerRef?: string;
  powerFeedA?: string;
  powerFeedB?: string;
  powerBudgetWatts?: number;
  notes?: string;
  active: boolean;
  order: number;
  usedUnits?: number;
  freeUnits?: number;
  utilization?: number;
}

export interface RackOccupant {
  id: string;
  kind: 'device' | 'patch-panel';
  name: string;
  deviceType?: string;
  vendor?: string;
  hardwareModel?: string;
  position: number;
  units: number;
  face: 'front' | 'rear';
  active: boolean;
  portCount?: number;
}

export interface RackUnitRow {
  unit: number;
  front?: RackOccupant | null;
  rear?: RackOccupant | null;
  isOccupantStartFront: boolean;
  isOccupantStartRear: boolean;
}

export interface RackElevation {
  cabinet: { id: string; name: string; facility: string | null; uHeight: number; uNumbering: 'bottom-up' | 'top-down' };
  units: RackUnitRow[];
  occupants: RackOccupant[];
  freeUnits: number;
  usedUnits: number;
  freeRuns: Array<{ start: number; end: number; size: number }>;
  problems: string[];
}

// ── Device (a rack-mounted switch/router/console server) ──
export type DeviceType =
  | 'switch'
  | 'router'
  | 'route-server'
  | 'console-server'
  | 'pdu'
  | 'server'
  | 'patch-panel'
  | 'other';

export interface DeviceItem {
  _id: string;
  infrastructure: string;
  cabinet?: any;
  facility?: any;
  name: string;
  hostname?: string;
  deviceType: DeviceType;
  vendor: string;
  hardwareModel?: string;
  os?: string;
  osVersion?: string;
  serialNumber?: string;
  assetTag?: string;
  rackPosition?: number;
  rackUnits: number;
  rackFace: 'front' | 'rear';
  managementIpv4?: string;
  managementIpv6?: string;
  loopbackIpv4?: string;
  zabbixHostName?: string;
  consolePort?: string;
  powerWatts?: number;
  notes?: string;
  active: boolean;
  order: number;
  ports?: { total: number; free: number; assigned: number };
}

export type SwitchPortType = 'peering' | 'core' | 'reseller' | 'management' | 'fanout' | 'other';
export type SwitchPortState = 'free' | 'assigned' | 'reserved' | 'faulty' | 'decommissioned';

export interface SwitchPortItem {
  _id: string;
  switch: string;
  name: string;
  type: SwitchPortType;
  ifIndex?: number;
  zabbixInterface?: string;
  speed?: number;
  media?: string;
  status: SwitchPortState;
  lagName?: string;
  notes?: string;
  memberUse?: any;
  coreUse?: any;
}

export const adminFabricApi = {
  // Infrastructures
  listInfrastructures: () => apiCall<InfrastructureItem[]>('/admin/fabric/infrastructures'),
  createInfrastructure: (data: Partial<InfrastructureItem>) =>
    apiCall<InfrastructureItem>('/admin/fabric/infrastructures', { method: 'POST', body: JSON.stringify(data) }),
  updateInfrastructure: (id: string, data: Partial<InfrastructureItem>) =>
    apiCall<InfrastructureItem>(`/admin/fabric/infrastructures/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteInfrastructure: (id: string) =>
    apiCall<void>(`/admin/fabric/infrastructures/${id}`, { method: 'DELETE' }),

  // Facilities
  listFacilities: (infrastructure?: string) =>
    apiCall<FacilityItem[]>(`/admin/fabric/facilities${infrastructure ? `?infrastructure=${infrastructure}` : ''}`),
  createFacility: (data: Partial<FacilityItem>) =>
    apiCall<FacilityItem>('/admin/fabric/facilities', { method: 'POST', body: JSON.stringify(data) }),
  updateFacility: (id: string, data: Partial<FacilityItem>) =>
    apiCall<FacilityItem>(`/admin/fabric/facilities/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFacility: (id: string) => apiCall<void>(`/admin/fabric/facilities/${id}`, { method: 'DELETE' }),

  // Cabinets
  listCabinets: (facility?: string) =>
    apiCall<CabinetItem[]>(`/admin/fabric/cabinets${facility ? `?facility=${facility}` : ''}`),
  createCabinet: (data: Partial<CabinetItem>) =>
    apiCall<CabinetItem>('/admin/fabric/cabinets', { method: 'POST', body: JSON.stringify(data) }),
  updateCabinet: (id: string, data: Partial<CabinetItem>) =>
    apiCall<CabinetItem>(`/admin/fabric/cabinets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCabinet: (id: string) => apiCall<void>(`/admin/fabric/cabinets/${id}`, { method: 'DELETE' }),
  elevation: (id: string) => apiCall<RackElevation>(`/admin/fabric/cabinets/${id}/elevation`),

  // Devices
  listDevices: (params?: { infrastructure?: string; facility?: string; cabinet?: string; deviceType?: string }) => {
    const q = new URLSearchParams();
    if (params?.infrastructure) q.append('infrastructure', params.infrastructure);
    if (params?.facility) q.append('facility', params.facility);
    if (params?.cabinet) q.append('cabinet', params.cabinet);
    if (params?.deviceType) q.append('deviceType', params.deviceType);
    const qs = q.toString();
    return apiCall<DeviceItem[]>(`/admin/fabric/devices${qs ? `?${qs}` : ''}`);
  },
  getDevice: (id: string) =>
    apiCall<{ device: DeviceItem; ports: SwitchPortItem[] }>(`/admin/fabric/devices/${id}`),
  createDevice: (data: Partial<DeviceItem>) =>
    apiCall<DeviceItem>('/admin/fabric/devices', { method: 'POST', body: JSON.stringify(data) }),
  updateDevice: (id: string, data: Partial<DeviceItem>) =>
    apiCall<DeviceItem>(`/admin/fabric/devices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDevice: (id: string) => apiCall<void>(`/admin/fabric/devices/${id}`, { method: 'DELETE' }),

  // Ports
  createPort: (deviceId: string, data: Partial<SwitchPortItem>) =>
    apiCall<SwitchPortItem>(`/admin/fabric/devices/${deviceId}/ports`, { method: 'POST', body: JSON.stringify(data) }),
  generatePorts: (deviceId: string, data: { pattern: string; type?: string; speed?: number; media?: string }) =>
    apiCall<{ created: number; skipped: number; total: number }>(`/admin/fabric/devices/${deviceId}/ports/generate`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updatePort: (deviceId: string, portId: string, data: Partial<SwitchPortItem>) =>
    apiCall<SwitchPortItem>(`/admin/fabric/devices/${deviceId}/ports/${portId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deletePort: (deviceId: string, portId: string) =>
    apiCall<void>(`/admin/fabric/devices/${deviceId}/ports/${portId}`, { method: 'DELETE' }),
};

// ── VLANs & IP addressing ──
export interface VlanPoolFamily {
  total: number;
  assigned: number;
  reserved: number;
  free: number;
}

export interface VlanItem {
  _id: string;
  infrastructure: any;
  name: string;
  number: number;
  shortname?: string;
  ipv4Prefix?: string;
  ipv6Prefix?: string;
  ipv4Gateway?: string;
  ipv6Gateway?: string;
  ipv4Reserved?: string[];
  ipv6Reserved?: string[];
  ipv6AddressingMode: 'sequential' | 'asn-encoded';
  isQuarantine: boolean;
  isPrivate: boolean;
  peeringMatrix: boolean;
  ixfExport: boolean;
  reverseDnsZoneV4?: string;
  reverseDnsZoneV6?: string;
  notes?: string;
  enabled: boolean;
  order: number;
  pool?: { v4?: VlanPoolFamily; v6?: VlanPoolFamily };
  peerCount?: number;
}

export interface PoolStat {
  family: 4 | 6;
  prefix: string;
  total: number;
  assigned: number;
  reserved: number;
  free: number;
  utilization: number;
}

export interface IpAddressItem {
  _id: string;
  vlan: string;
  family: 4 | 6;
  address: string;
  assignedTo: string | null;
  reserved: boolean;
  label?: string;
  holder?: { id: string; name: string; asn?: number } | null;
}

export interface SeedResult {
  family: 4 | 6;
  prefix: string;
  created: number;
  skipped: number;
  reserved: number;
  total: number;
}

export const adminVlansApi = {
  list: (infrastructure?: string) =>
    apiCall<VlanItem[]>(`/admin/vlans${infrastructure ? `?infrastructure=${infrastructure}` : ''}`),
  create: (data: Partial<VlanItem>) =>
    apiCall<{ vlan: VlanItem; pool: SeedResult[] }>('/admin/vlans', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<VlanItem>) =>
    apiCall<{ vlan: VlanItem; pool: SeedResult[] }>(`/admin/vlans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => apiCall<void>(`/admin/vlans/${id}`, { method: 'DELETE' }),
  poolStats: (id: string) => apiCall<PoolStat[]>(`/admin/vlans/${id}/pool`),
  seedPool: (id: string, data?: { v4Limit?: number; v6Limit?: number }) =>
    apiCall<SeedResult[]>(`/admin/vlans/${id}/pool/seed`, { method: 'POST', body: JSON.stringify(data || {}) }),
  addresses: (id: string, params?: { family?: 4 | 6; state?: 'free' | 'assigned' | 'reserved'; limit?: number; skip?: number }) => {
    const q = new URLSearchParams();
    if (params?.family) q.append('family', String(params.family));
    if (params?.state) q.append('state', params.state);
    if (params?.limit) q.append('limit', String(params.limit));
    if (params?.skip) q.append('skip', String(params.skip));
    const qs = q.toString();
    return apiCall<{ total: number; skip: number; limit: number; addresses: IpAddressItem[] }>(
      `/admin/vlans/${id}/addresses${qs ? `?${qs}` : ''}`
    );
  },
  setReserved: (id: string, addressId: string, reserved: boolean, label?: string) =>
    apiCall<IpAddressItem>(`/admin/vlans/${id}/addresses/${addressId}/reserved`, {
      method: 'POST',
      body: JSON.stringify({ reserved, label }),
    }),
};

// ── Connections & peers ──
export interface ConnectionPortInfo {
  id: string;
  speed: number;
  status: string;
  portName: string;
  switchName: string;
  xconnectRef?: string;
}

export interface ConnectionPeerInfo {
  id: string;
  vlan: { id: string; name: string; number: number; isQuarantine: boolean } | null;
  ipv4: string | null;
  ipv6: string | null;
  rsClient: boolean;
  rsMode: string;
  enabled: boolean;
}

export interface ConnectionItem {
  _id: string;
  organization: any;
  infrastructure: any;
  name: string;
  channelGroup?: number;
  lagFraming: 'none' | 'lacp' | 'static';
  mtu?: number;
  billingSpeed?: number;
  isReseller: boolean;
  notes?: string;
  createdAt: string;
  ports: ConnectionPortInfo[];
  capacityMbps: number;
  peers: ConnectionPeerInfo[];
}

export type RsMode = 'normal' | 'passive' | 'disabled';

export interface PeerItem {
  _id: string;
  virtualInterface: any;
  vlan: any;
  ipv4Address: { id: string; address?: string } | null;
  ipv6Address: { id: string; address?: string } | null;
  ipv4Enabled: boolean;
  ipv6Enabled: boolean;
  ipv4Hostname?: string;
  ipv6Hostname?: string;
  rsClient: boolean;
  rsMode: RsMode;
  irrdbFilter: boolean;
  rpkiFilter: boolean;
  asMacro?: string;
  maxPrefixesV4?: number;
  maxPrefixesV6?: number;
  peerAsn?: number;
  as112Client: boolean;
  busyHost: boolean;
  notes?: string;
  enabled: boolean;
  macCount?: number;
}

export interface MacItem {
  _id: string;
  vlanInterface: string;
  address: string;
  source: 'declared' | 'learned' | 'imported';
  approved: boolean;
  notes?: string;
}

export interface FreePort {
  id: string;
  name: string;
  switchId: string;
  switchName: string;
  speed?: number;
  media?: string;
}

export interface ProvisioningOption {
  id: string;
  name: string;
  shortname: string;
  asn: number;
  mtu: number;
  vlans: Array<{
    id: string;
    name: string;
    number: number;
    isQuarantine: boolean;
    isPrivate: boolean;
    ipv4Prefix?: string;
    ipv6Prefix?: string;
  }>;
  freePorts: FreePort[];
  speeds: number[];
}

export interface ProvisionStep {
  step: string;
  ok: boolean;
  detail?: string;
  error?: string;
}

export interface ProvisionResult {
  ok: boolean;
  organization: { id: string; name: string; asn?: number };
  virtualInterfaceId?: string;
  vlanInterfaceId?: string;
  physicalInterfaceIds: string[];
  ipv4?: string;
  ipv6?: string;
  steps: ProvisionStep[];
  deployments: BirdDeployResult[];
  warnings: string[];
  error?: string;
}

export interface ProvisionRequest {
  organizationId: string;
  infrastructureId: string;
  vlanId?: string;
  switchPortIds: string[];
  speed: number;
  name?: string;
  quarantine?: boolean;
  lagFraming?: 'none' | 'lacp' | 'static';
  channelGroup?: number;
  mtu?: number;
  ipv4?: boolean;
  ipv6?: boolean;
  rsClient?: boolean;
  rsMode?: RsMode;
  irrdbFilter?: boolean;
  rpkiFilter?: boolean;
  maxPrefixesV4?: number;
  maxPrefixesV6?: number;
  requestedIpv4?: string;
  requestedIpv6?: string;
  syncPeeringDb?: boolean;
  refreshIrrdb?: boolean;
  deploy?: boolean;
}

export const adminPeersApi = {
  options: () => apiCall<ProvisioningOption[]>('/admin/peers/options'),
  availablePorts: (infrastructureId: string, speed?: number) =>
    apiCall<FreePort[]>(`/admin/peers/available-ports/${infrastructureId}${speed ? `?speed=${speed}` : ''}`),
  provision: (data: ProvisionRequest) =>
    apiCall<ProvisionResult>('/admin/peers/provision', { method: 'POST', body: JSON.stringify(data) }),

  listConnections: (params?: { organization?: string; infrastructure?: string }) => {
    const q = new URLSearchParams();
    if (params?.organization) q.append('organization', params.organization);
    if (params?.infrastructure) q.append('infrastructure', params.infrastructure);
    const qs = q.toString();
    return apiCall<ConnectionItem[]>(`/admin/peers/connections${qs ? `?${qs}` : ''}`);
  },
  updateConnection: (id: string, data: Partial<ConnectionItem>) =>
    apiCall<ConnectionItem>(`/admin/peers/connections/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deprovision: (id: string, deploy = true) =>
    apiCall<{ ok: boolean; freedPorts: string[]; releasedAddresses: number; deployments: BirdDeployResult[] }>(
      `/admin/peers/connections/${id}`,
      { method: 'DELETE', body: JSON.stringify({ deploy }) }
    ),
  addConnectionPort: (id: string, data: { switchPortId: string; speed?: number; xconnectRef?: string }) =>
    apiCall<any>(`/admin/peers/connections/${id}/ports`, { method: 'POST', body: JSON.stringify(data) }),
  updateConnectionPort: (id: string, portId: string, data: Record<string, any>) =>
    apiCall<any>(`/admin/peers/connections/${id}/ports/${portId}`, { method: 'PUT', body: JSON.stringify(data) }),
  removeConnectionPort: (id: string, portId: string) =>
    apiCall<void>(`/admin/peers/connections/${id}/ports/${portId}`, { method: 'DELETE' }),

  listPeers: (params?: { vlan?: string; virtualInterface?: string; rsClient?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.vlan) q.append('vlan', params.vlan);
    if (params?.virtualInterface) q.append('virtualInterface', params.virtualInterface);
    if (params?.rsClient !== undefined) q.append('rsClient', String(params.rsClient));
    const qs = q.toString();
    return apiCall<PeerItem[]>(`/admin/peers/peers${qs ? `?${qs}` : ''}`);
  },
  updatePeer: (id: string, data: Partial<PeerItem> & { ipv4BgpMd5?: string; ipv6BgpMd5?: string }) =>
    apiCall<{ peer: PeerItem; note: string }>(`/admin/peers/peers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  reassignAddress: (id: string, family: 4 | 6, address?: string) =>
    apiCall<{ family: number; address: string; note: string }>(`/admin/peers/peers/${id}/address`, {
      method: 'POST',
      body: JSON.stringify({ family, address }),
    }),
  moveVlan: (peerId: string, vlanId: string, opts?: { promote?: boolean; deploy?: boolean }) =>
    apiCall<{ ok: boolean; ipv4?: string; ipv6?: string; warnings: string[] }>(
      `/admin/peers/peers/${peerId}/move-vlan`,
      { method: 'POST', body: JSON.stringify({ vlanId, ...opts }) }
    ),

  listMacs: (peerId: string) => apiCall<MacItem[]>(`/admin/peers/peers/${peerId}/macs`),
  addMac: (peerId: string, data: { address: string; approved?: boolean; notes?: string }) =>
    apiCall<MacItem>(`/admin/peers/peers/${peerId}/macs`, { method: 'POST', body: JSON.stringify(data) }),
  updateMac: (peerId: string, macId: string, data: { approved?: boolean; notes?: string }) =>
    apiCall<MacItem>(`/admin/peers/peers/${peerId}/macs/${macId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMac: (peerId: string, macId: string) =>
    apiCall<void>(`/admin/peers/peers/${peerId}/macs/${macId}`, { method: 'DELETE' }),
  findMac: (address: string) =>
    apiCall<{ address: string; matches: any[] }>(`/admin/peers/macs/find?address=${encodeURIComponent(address)}`),
};

// ── Route servers (BIRD config generation & deployment) ──
export type RsFamily = 'ipv4' | 'ipv6' | 'dual';
export type RsDeployMethod = 'manual' | 'local' | 'ssh' | 'agent';

export interface BirdRouteServerItem {
  _id: string;
  name: string;
  group?: string;
  location?: string;
  order: number;
  enabled: boolean;
  backend: 'birdwatcher' | 'gobgp';
  apiUrl: string;
  birdwatcherType?: string;
  infrastructure?: any;
  vlan?: any;
  family: RsFamily;
  asn?: number;
  routerId?: string;
  ipv4?: string;
  ipv6?: string;
  peerGroup?: string;
  software: 'bird2' | 'bird3';
  rpkiEnabled: boolean;
  rtrServer?: string;
  rtrPort?: number;
  irrdbFailOpen: boolean;
  blackholeEnabled: boolean;
  blackholeNextHopV4?: string;
  blackholeNextHopV6?: string;
  maxPrefixLengthV4: number;
  minPrefixLengthV4: number;
  maxPrefixLengthV6: number;
  minPrefixLengthV6: number;
  defaultMaxPrefixesV4: number;
  defaultMaxPrefixesV6: number;
  configExtras?: string;
  configHeaderExtras?: string;
  deployMethod: RsDeployMethod;
  configPath?: string;
  birdSocket?: string;
  reloadStrategy: 'birdc' | 'systemctl';
  systemdUnit?: string;
  useSudo: boolean;
  sshHost?: string;
  sshPort?: number;
  sshUser?: string;
  sshKeyPath?: string;
  agentUrl?: string;
  agentTokenSet?: boolean;
  lastDeployedAt?: string | null;
  lastDeployHash?: string;
}

export interface BirdBuildStats {
  totalPeers: number;
  v4Sessions: number;
  v6Sessions: number;
  passiveSessions: number;
  disabledSessions: number;
  irrdbFiltered: number;
  irrdbMissing: number;
  rpkiFiltered: number;
  blackholePrefixes: number;
}

export interface BirdConfigPreview {
  config: string;
  configHash: string;
  routeServer: { id: string; name: string; family: string; asn: number; routerId: string };
  peers: any[];
  stats: BirdBuildStats;
  warnings: string[];
  secretsRedacted: boolean;
  deployMethod: RsDeployMethod;
  configPath: string | null;
  lastDeployedAt: string | null;
  matchesDeployed: boolean;
}

export interface BirdDeployResult {
  routeServer: string;
  name: string;
  applied: boolean;
  skipped?: boolean;
  reason?: string;
  configHash: string;
  peerCount: number;
  output?: string;
  error?: string;
  warnings: string[];
  deploymentId?: string;
  durationMs: number;
}

export interface BirdDeploymentRecord {
  _id: string;
  routeServer: string;
  configHash: string;
  result: 'success' | 'failed' | 'rolled-back' | 'preview';
  method: string;
  peerCount: number;
  output?: string;
  error?: string;
  actor?: string;
  durationMs?: number;
  createdAt: string;
}

export interface BirdStatusRow {
  id: string;
  name: string;
  infrastructure: string | null;
  vlan: string | null;
  family: string;
  deployMethod: string;
  lastDeployedAt: string | null;
  ready: boolean;
  error?: string;
  peerCount?: number;
  stats?: BirdBuildStats;
  warningCount?: number;
  warnings?: string[];
  inSync?: boolean;
}

export interface IrrdbStatusRow {
  asn: number;
  asMacro: string;
  v4Prefixes: number;
  v6Prefixes: number;
  v4RefreshedAt: string | null;
  v6RefreshedAt: string | null;
  stale: boolean;
  neverExpanded: boolean;
  lastError: string;
}

export const adminBirdApi = {
  status: () =>
    apiCall<{ routeServers: BirdStatusRow[]; totals: { total: number; ready: number; inSync: number; withWarnings: number } }>(
      '/admin/bird/status'
    ),

  list: (infrastructure?: string) =>
    apiCall<BirdRouteServerItem[]>(`/admin/bird/route-servers${infrastructure ? `?infrastructure=${infrastructure}` : ''}`),
  create: (data: Partial<BirdRouteServerItem>) =>
    apiCall<BirdRouteServerItem>('/admin/bird/route-servers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<BirdRouteServerItem> & { agentToken?: string }) =>
    apiCall<BirdRouteServerItem>(`/admin/bird/route-servers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => apiCall<void>(`/admin/bird/route-servers/${id}`, { method: 'DELETE' }),

  config: (id: string, includeSecrets = false) =>
    apiCall<BirdConfigPreview>(`/admin/bird/route-servers/${id}/config${includeSecrets ? '?includeSecrets=true' : ''}`),
  deploy: (id: string, opts?: { force?: boolean; dryRun?: boolean }) =>
    apiCall<BirdDeployResult>(`/admin/bird/route-servers/${id}/deploy`, {
      method: 'POST',
      body: JSON.stringify(opts || {}),
    }),
  testConnection: (id: string) =>
    apiCall<{ ok: boolean; output: string; error?: string }>(`/admin/bird/route-servers/${id}/test`, { method: 'POST' }),
  history: (id: string, limit = 25) =>
    apiCall<BirdDeploymentRecord[]>(`/admin/bird/route-servers/${id}/history?limit=${limit}`),

  deployInfrastructure: (infrastructureId: string, force = false) =>
    apiCall<{ results: BirdDeployResult[]; applied: number; failed: number; skipped: number }>(
      `/admin/bird/infrastructures/${infrastructureId}/deploy`,
      { method: 'POST', body: JSON.stringify({ force }) }
    ),
  deployAll: (force = false) =>
    apiCall<{ results: BirdDeployResult[]; applied: number; failed: number; skipped: number }>('/admin/bird/deploy-all', {
      method: 'POST',
      body: JSON.stringify({ force }),
    }),

  getDeployment: (deploymentId: string) =>
    apiCall<BirdDeploymentRecord & { config: string; previousConfig: string; secretsRedacted: boolean }>(
      `/admin/bird/deployments/${deploymentId}`
    ),
  rollback: (deploymentId: string) =>
    apiCall<BirdDeployResult>(`/admin/bird/deployments/${deploymentId}/rollback`, { method: 'POST' }),

  // IRRDB cache
  irrdbStatus: () =>
    apiCall<{ bgpq4Available: boolean; bgpq4Error?: string; staleMinutes: number; rows: IrrdbStatusRow[] }>(
      '/admin/bird/irrdb'
    ),
  irrdbRefreshAll: (opts?: { onlyStale?: boolean; vlanId?: string; limit?: number }) =>
    apiCall<{ attempted: number; succeeded: number; failed: number; skipped: number; results: any[] }>(
      '/admin/bird/irrdb/refresh',
      { method: 'POST', body: JSON.stringify(opts || {}) }
    ),
  irrdbRefreshAsn: (asn: number, asMacro?: string) =>
    apiCall<any[]>(`/admin/bird/irrdb/${asn}/refresh`, { method: 'POST', body: JSON.stringify({ asMacro }) }),
  irrdbGetAsn: (asn: number) => apiCall<any[]>(`/admin/bird/irrdb/${asn}`),
  irrdbSetManual: (asn: number, family: 4 | 6, prefixes: Array<{ prefix: string; maxLength?: number }>) =>
    apiCall<{ asn: number; family: number; count: number }>(`/admin/bird/irrdb/${asn}/manual`, {
      method: 'POST',
      body: JSON.stringify({ family, prefixes }),
    }),
};

// ── PeeringDB ──
export interface PeeringDbStatus {
  configured: boolean;
  connected: boolean;
  authenticated: boolean;
  baseUrl?: string;
  cacheTtlMinutes?: number;
  error?: string;
}

export interface PdbLookupResult {
  net: any;
  proposedPatch: Record<string, any>;
  existingOrganization: { id: string; name: string; asn?: number; linked: boolean } | null;
  ixPresence: Array<{
    ixId: number;
    ixLanId: number;
    name?: string;
    ipv4?: string | null;
    ipv6?: string | null;
    speed?: number;
    isRsPeer?: boolean;
    operational?: boolean;
  }>;
  facilities: Array<{ facId: number; name?: string; city?: string; country?: string }>;
}

export interface ParticipantDiff {
  ixLanId: number;
  counts: {
    peeringDb: number;
    local: number;
    matched: number;
    mismatched: number;
    notProvisioned: number;
    notInPeeringDb: number;
  };
  mismatched: Array<{ asn: number; name: string; problems: string[] }>;
  notProvisioned: Array<{ asn: number; name?: string; ipv4?: string; ipv6?: string; speed?: number }>;
  notInPeeringDb: Array<{ asn: number; name: string }>;
  matched: Array<{ asn: number; name: string }>;
}

export const adminPeeringDbApi = {
  status: () => apiCall<PeeringDbStatus>('/admin/peeringdb/status'),
  clearCache: () => apiCall<{ cleared: boolean }>('/admin/peeringdb/cache/clear', { method: 'POST' }),
  lookupAsn: (asn: number, refresh = false) =>
    apiCall<PdbLookupResult>(`/admin/peeringdb/net/${asn}${refresh ? '?refresh=true' : ''}`),
  syncOrg: (orgId: string, opts?: { asn?: number; overwriteName?: boolean }) =>
    apiCall<{ organization: any; applied: Record<string, any> }>(`/admin/peeringdb/sync/${orgId}`, {
      method: 'POST',
      body: JSON.stringify(opts || {}),
    }),
  syncAll: () =>
    apiCall<{ attempted: number; succeeded: number; failed: number; total: number; results: any[] }>(
      '/admin/peeringdb/sync-all',
      { method: 'POST' }
    ),
  participants: (infrastructureId: string, ixLanId?: number) =>
    apiCall<ParticipantDiff>(
      `/admin/peeringdb/infrastructures/${infrastructureId}/participants${ixLanId ? `?ixLanId=${ixLanId}` : ''}`
    ),
  searchIx: (q: string) =>
    apiCall<Array<{ id: number; name: string; nameLong?: string; city?: string; country?: string; netCount?: number; ixLans: Array<{ id: number; name?: string; mtu?: number }> }>>(
      `/admin/peeringdb/ix?q=${encodeURIComponent(q)}`
    ),
  searchFacilities: (q: string) =>
    apiCall<Array<{ id: number; name: string; city?: string; country?: string; clli?: string; npanxx?: string; latitude?: number; longitude?: number; netCount?: number }>>(
      `/admin/peeringdb/facilities?q=${encodeURIComponent(q)}`
    ),
};

// ── Patch Panels & Cross-connects ──
export type PatchPanelConnector = 'LC' | 'SC' | 'MPO' | 'MTP' | 'RJ45' | 'ST' | 'Other';
export type PatchPanelMedia = 'SMF' | 'MMF-OM3' | 'MMF-OM4' | 'MMF-OM5' | 'Copper' | 'Other';
export type PatchPortState =
  | 'available'
  | 'reserved'
  | 'awaiting-loa'
  | 'awaiting-xconnect'
  | 'connected'
  | 'awaiting-cease'
  | 'ceased'
  | 'broken'
  | 'decommissioned';

export interface PatchPanelItem {
  _id: string;
  facility: any;
  cabinet?: any;
  name: string;
  portCount: number;
  duplex: boolean;
  connectorType: PatchPanelConnector;
  mediaType: PatchPanelMedia;
  farEndLocation?: string;
  providerRef?: string;
  portNamePrefix?: string;
  notes?: string;
  active: boolean;
  order: number;
  portStates?: Record<string, number>;
  totalPorts?: number;
}

export interface PatchPanelPortItem {
  _id: string;
  patchPanel: string;
  number: number;
  name: string;
  state: PatchPortState;
  organization?: any;
  switchPort?: any;
  duplexPartner?: any;
  loaCode?: string;
  loaIssuedAt?: string | null;
  xconnectRef?: string;
  customerRef?: string;
  assignedAt?: string | null;
  connectedAt?: string | null;
  ceaseRequestedAt?: string | null;
  ceasedAt?: string | null;
  opticalLossDb?: number;
  notes?: string;
  memberVisibleNotes?: string;
}

export const adminPatchPanelsApi = {
  stats: () => apiCall<{ total: number; byState: Record<string, number> }>('/admin/patch-panels/stats'),
  list: (facility?: string) =>
    apiCall<PatchPanelItem[]>(`/admin/patch-panels${facility ? `?facility=${facility}` : ''}`),
  create: (data: Partial<PatchPanelItem>) =>
    apiCall<PatchPanelItem>('/admin/patch-panels', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<PatchPanelItem>) =>
    apiCall<PatchPanelItem>(`/admin/patch-panels/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => apiCall<void>(`/admin/patch-panels/${id}`, { method: 'DELETE' }),
  listPorts: (panelId: string, state?: PatchPortState) =>
    apiCall<PatchPanelPortItem[]>(`/admin/patch-panels/${panelId}/ports${state ? `?state=${state}` : ''}`),
  updatePort: (panelId: string, portId: string, data: Record<string, any>) =>
    apiCall<PatchPanelPortItem>(`/admin/patch-panels/${panelId}/ports/${portId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  assignPort: (panelId: string, data: { organizationId: string; portId?: string; switchPortId?: string }) =>
    apiCall<PatchPanelPortItem>(`/admin/patch-panels/${panelId}/ports/assign`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ── Core Bundles (inter-switch links / trunks) ──
export type CoreBundleType = 'ecmp' | 'lacp' | 'l2-lag' | 'l3-lag';
export type CoreLinkState = 'up' | 'down' | 'maintenance' | 'planned' | 'decommissioned';

export interface CoreBundleItem {
  _id: string;
  infrastructure: any;
  name: string;
  type: CoreBundleType;
  switchA: any;
  switchB: any;
  bundleNameA?: string;
  bundleNameB?: string;
  enabled: boolean;
  state: CoreLinkState;
  drained: boolean;
  notes?: string;
  order: number;
  links?: number;
  enabledLinks?: number;
  totalCapacityMbps?: number;
  enabledCapacityMbps?: number;
}

export interface CoreLinkItem {
  _id: string;
  coreBundle: string;
  switchPortA: any;
  switchPortB: any;
  speed: number;
  enabled: boolean;
  bfdEnabled: boolean;
  notes?: string;
  order: number;
}

export interface CapacitySummaryRow {
  infrastructure: { name: string; shortname?: string };
  totalLinks: number;
  enabledLinks: number;
  totalCapacityGbps: number;
  enabledCapacityGbps: number;
  redundancy: string;
}

export const adminCoreBundlesApi = {
  capacity: () => apiCall<CapacitySummaryRow[]>('/admin/core-bundles/capacity'),
  list: (infrastructure?: string) =>
    apiCall<CoreBundleItem[]>(`/admin/core-bundles${infrastructure ? `?infrastructure=${infrastructure}` : ''}`),
  create: (data: Partial<CoreBundleItem>) =>
    apiCall<CoreBundleItem>('/admin/core-bundles', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<CoreBundleItem>) =>
    apiCall<CoreBundleItem>(`/admin/core-bundles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => apiCall<void>(`/admin/core-bundles/${id}`, { method: 'DELETE' }),
  listLinks: (bundleId: string) => apiCall<CoreLinkItem[]>(`/admin/core-bundles/${bundleId}/links`),
  createLink: (bundleId: string, data: Partial<CoreLinkItem>) =>
    apiCall<CoreLinkItem>(`/admin/core-bundles/${bundleId}/links`, { method: 'POST', body: JSON.stringify(data) }),
  updateLink: (bundleId: string, linkId: string, data: Partial<CoreLinkItem>) =>
    apiCall<CoreLinkItem>(`/admin/core-bundles/${bundleId}/links/${linkId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLink: (bundleId: string, linkId: string) =>
    apiCall<void>(`/admin/core-bundles/${bundleId}/links/${linkId}`, { method: 'DELETE' }),
};

// ── Member Contacts ──
export type ContactRole = 'noc' | 'peering' | 'billing' | 'admin' | 'sales' | 'legal' | 'other';

export interface MemberContactItem {
  _id: string;
  organization: string;
  name: string;
  email: string;
  phone?: string;
  role: ContactRole;
  position?: string;
  source: 'manual' | 'peeringdb' | 'imported';
  receiveNotifications: boolean;
  receiveBilling: boolean;
  isPrimary: boolean;
  lastVerifiedAt?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const adminContactsApi = {
  list: (orgId: string, role?: ContactRole) =>
    apiCall<MemberContactItem[]>(`/admin/customers/${orgId}/contacts${role ? `?role=${role}` : ''}`),
  create: (orgId: string, data: Partial<MemberContactItem>) =>
    apiCall<MemberContactItem>(`/admin/customers/${orgId}/contacts`, { method: 'POST', body: JSON.stringify(data) }),
  update: (orgId: string, contactId: string, data: Partial<MemberContactItem>) =>
    apiCall<MemberContactItem>(`/admin/customers/${orgId}/contacts/${contactId}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (orgId: string, contactId: string) =>
    apiCall<void>(`/admin/customers/${orgId}/contacts/${contactId}`, { method: 'DELETE' }),
  /** All contacts by role — for group mailing / announcements */
  byRole: (role?: ContactRole, opts?: { notifications?: boolean; billing?: boolean }) => {
    const q = new URLSearchParams();
    if (role) q.append('role', role);
    if (opts?.notifications) q.append('notifications', 'true');
    if (opts?.billing) q.append('billing', 'true');
    return apiCall<(MemberContactItem & { organization: any })[]>(`/admin/customers/contacts/by-role?${q.toString()}`);
  },
};

// ── Customer Notes ──
export interface CustomerNoteItem {
  _id: string;
  organization: string;
  author: string;
  body: string;
  visibility: 'staff' | 'shared';
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export const adminNotesApi = {
  list: (orgId: string) => apiCall<CustomerNoteItem[]>(`/admin/customers/${orgId}/notes`),
  create: (orgId: string, data: { body: string; visibility?: 'staff' | 'shared'; pinned?: boolean }) =>
    apiCall<CustomerNoteItem>(`/admin/customers/${orgId}/notes`, { method: 'POST', body: JSON.stringify(data) }),
  update: (orgId: string, noteId: string, data: Partial<CustomerNoteItem>) =>
    apiCall<CustomerNoteItem>(`/admin/customers/${orgId}/notes/${noteId}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (orgId: string, noteId: string) =>
    apiCall<void>(`/admin/customers/${orgId}/notes/${noteId}`, { method: 'DELETE' }),
};

// ── Customer Tags ──
export interface CustomerTagItem {
  _id: string;
  name: string;
  colour: string;
  description?: string;
}

export const adminTagsApi = {
  list: () => apiCall<CustomerTagItem[]>('/admin/customers/tags'),
  create: (data: { name: string; colour?: string; description?: string }) =>
    apiCall<CustomerTagItem>('/admin/customers/tags', { method: 'POST', body: JSON.stringify(data) }),
  update: (tagId: string, data: Partial<CustomerTagItem>) =>
    apiCall<CustomerTagItem>(`/admin/customers/tags/${tagId}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (tagId: string) => apiCall<void>(`/admin/customers/tags/${tagId}`, { method: 'DELETE' }),
  setForCustomer: (orgId: string, tagIds: string[]) =>
    apiCall<{ tags: string[] }>(`/admin/customers/${orgId}/tags`, { method: 'POST', body: JSON.stringify({ tags: tagIds }) }),
};

// ── Customer Documents ──
export type DocCategory = 'loa' | 'invoice' | 'contract' | 'policy' | 'diagram' | 'other';

export interface CustomerDocumentItem {
  _id: string;
  organization: string;
  filename: string;
  storagePath: string;
  mimeType: string;
  size: number;
  category: DocCategory;
  description?: string;
  visibility: 'staff' | 'shared';
  uploadedBy?: string;
  createdAt: string;
}

export const adminDocumentsApi = {
  list: (orgId: string, category?: DocCategory) =>
    apiCall<CustomerDocumentItem[]>(`/admin/customers/${orgId}/documents${category ? `?category=${category}` : ''}`),
  create: (orgId: string, data: {
    filename: string;
    storagePath: string;
    mimeType?: string;
    size?: number;
    category?: DocCategory;
    description?: string;
    visibility?: 'staff' | 'shared';
  }) => apiCall<CustomerDocumentItem>(`/admin/customers/${orgId}/documents`, { method: 'POST', body: JSON.stringify(data) }),
  update: (orgId: string, docId: string, data: { description?: string; category?: DocCategory; visibility?: 'staff' | 'shared' }) =>
    apiCall<CustomerDocumentItem>(`/admin/customers/${orgId}/documents/${docId}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (orgId: string, docId: string) =>
    apiCall<void>(`/admin/customers/${orgId}/documents/${docId}`, { method: 'DELETE' }),
};

// ── Peering Matrix (public) ──
export interface PeeringMatrixMember {
  id: string;
  name: string;
  asn: number;
  type?: string;
  peeringPolicy?: string;
  ipv4?: string;
  ipv6?: string;
  rsClient: boolean;
}

export interface PeeringMatrixVlan {
  id: string;
  name: string;
  number: number;
  infrastructure: string;
  infrastructureName: string;
}

export interface PeeringMatrixData {
  vlans: PeeringMatrixVlan[];
  members: PeeringMatrixMember[];
  matrix: Record<string, { rsClients: number[]; peerCount: number }>;
  stats: {
    totalMembers: number;
    totalRsClients: number;
    totalPeeringSessions: number;
    bilateralOnly: number;
  };
}

export const peeringMatrixApi = {
  get: (infrastructure?: string) =>
    apiCall<PeeringMatrixData>(`/peering-matrix${infrastructure ? `?infrastructure=${infrastructure}` : ''}`),
};

// ── Exports (reverse DNS, Nagios, TACACS, RIR, MANRS) ──
export interface ManrsMember {
  asn: number;
  name: string;
  prefixFiltering: boolean;
  antiSpoofing: string;
  irrRegistered: boolean;
  irrAsSet: string;
  rpkiValidation: boolean;
  score: number;
  maxScore: number;
}

export interface ManrsReport {
  generatedAt: string;
  summary: {
    totalMembers: number;
    fullyCompliant: number;
    fullyCompliantPct: number;
    withPrefixFilter: number;
    withPrefixFilterPct: number;
    withRpki: number;
    withRpkiPct: number;
    withIrr: number;
    withIrrPct: number;
  };
  members: ManrsMember[];
}

export const adminExportsApi = {
  /** Downloads as text/plain file. Use window.open or fetch + blob for download. */
  reverseDnsUrl: (family: 4 | 6, vlan?: string) =>
    `${API_BASE}/admin/exports/reverse-dns?family=${family}${vlan ? `&vlan=${vlan}` : ''}`,
  nagiosUrl: (protocol: 4 | 6, vlan?: string) =>
    `${API_BASE}/admin/exports/nagios?protocol=${protocol}${vlan ? `&vlan=${vlan}` : ''}`,
  tacacsUrl: () => `${API_BASE}/admin/exports/tacacs`,
  rirObjectsUrl: () => `${API_BASE}/admin/exports/rir-objects`,
  manrs: () => apiCall<ManrsReport>('/admin/exports/manrs'),
};

// ── Switch provisioning templates ──
export const adminSwitchConfigApi = {
  /** Get the generated switch CLI config for a connection. */
  get: (connectionId: string, vendor?: 'huawei' | 'cisco' | 'arista') =>
    apiCall<{ config: string; vendor: string; portCount: number }>(
      `/admin/peers/connections/${connectionId}/switch-config${vendor ? `?vendor=${vendor}` : ''}`
    ),
  /** Direct download URL for the config file. */
  downloadUrl: (connectionId: string, vendor?: string) =>
    `${API_BASE}/admin/peers/connections/${connectionId}/switch-config?download=true${vendor ? `&vendor=${vendor}` : ''}`,
};

// ── API Tokens (app passwords) ──
export interface ApiTokenItem {
  _id: string;
  name: string;
  prefix: string;
  scope: 'full' | 'readonly';
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  lastUsedIp?: string;
  revoked: boolean;
  createdAt: string;
  // Only present on create response
  token?: string;
}

export const adminApiTokensApi = {
  list: () => apiCall<ApiTokenItem[]>('/admin/api-tokens'),
  create: (data: { name: string; scope?: 'full' | 'readonly'; expiresAt?: string }) =>
    apiCall<ApiTokenItem & { token: string }>('/admin/api-tokens', { method: 'POST', body: JSON.stringify(data) }),
  revoke: (id: string) => apiCall<{ revoked: boolean }>(`/admin/api-tokens/${id}`, { method: 'DELETE' }),
  /** Super-admin: all tokens across all users */
  listAll: () => apiCall<(ApiTokenItem & { user?: any })[]>('/admin/api-tokens/all'),
  forceRevoke: (id: string) => apiCall<{ revoked: boolean }>(`/admin/api-tokens/force/${id}`, { method: 'DELETE' }),
};

// ── PeeringDB OAuth (member portal) ──
export const portalPeeringDbAuthApi = {
  /** Get the PeeringDB OAuth authorize URL. Frontend redirects the user there. */
  getAuthUrl: () => portalApiCall<{ url: string; configured: boolean }>('/portal/auth/peeringdb'),
  /** Exchange the authorization code for a portal session token. */
  callback: async (code: string) => {
    const result = await portalApiCall<{ token: string; user: PortalUserInfo; organization: PortalOrgInfo }>(
      '/portal/auth/peeringdb/callback',
      { method: 'POST', body: JSON.stringify({ code }) }
    );
    if (result.success && result.data?.token) {
      localStorage.setItem(PORTAL_TOKEN_KEY, result.data.token);
    }
    return result;
  },
};

// ── Mailing Lists (portal) ──
export interface MailingListItem {
  id: string;
  subscribed: boolean;
}

export const portalMailingListsApi = {
  get: () => portalApiCall<{ configured: boolean; lists: MailingListItem[] }>('/portal/mailing-lists'),
  subscribe: (listId: string) =>
    portalApiCall<{ subscribed: boolean }>(`/portal/mailing-lists/${encodeURIComponent(listId)}/subscribe`, { method: 'POST' }),
  unsubscribe: (listId: string) =>
    portalApiCall<{ subscribed: boolean }>(`/portal/mailing-lists/${encodeURIComponent(listId)}/unsubscribe`, { method: 'POST' }),
};

// ── IXP Manager Import Tool (one-time migration) ──
export interface IxpImportStats {
  membersProcessed: number;
  orgsCreated: number;
  orgsLinked: number;
  orgsSkipped: number;
  connectionsCreated: number;
  peersCreated: number;
  addressesAllocated: number;
  errors: string[];
}

export const adminIxpImportApi = {
  run: (data?: { infrastructureId?: string; vlanId?: string; autoCreateOrgs?: boolean; dryRun?: boolean }) =>
    apiCall<IxpImportStats>('/admin/ixp-import/run', { method: 'POST', body: JSON.stringify(data || {}) }),
  retire: () => apiCall<void>('/admin/ixp-import/retire', { method: 'POST' }),
};
