// ============================================
// MX-IX Admin Panel Backend - Type Definitions
// ============================================
// These types match the frontend AdminContext exactly
// for seamless integration

// ============================================
// Network Stats Types
// ============================================
export interface INetworkStats {
  globalLatency: {
    value: number;
    unit: string;
  };
  activeNodes: number;
  throughput: number;
  locationsCount?: number;
}

// ============================================
// Global Fabric Stats Types
// ============================================
export interface IGlobalFabricStats {
  totalCapacity: string;
  activeRoutes: string;
  avgLatency: string;
  globalCoverage: string;
}

// ============================================
// Service Types
// ============================================
export interface IServiceStat {
  label: string;
  value: string;
  period: string;
}

export interface IServiceItem {
  name: string;
  icon: string;          // SVG content or icon identifier
  description: string;
  benefits: string[];
  features: string[];
  stats?: IServiceStat[];
  order: number;
}

export interface IService {
  id: string;            // URL-friendly identifier (e.g., 'peering', 'cloud')
  category: string;
  tagline: string;
  description: string;
  image: string;
  items: IServiceItem[];
  order: number;
  isActive: boolean;
}

// ============================================
// Location Types (with nested ASNs and Sites)
// ============================================
export type PeeringPolicy = 'Open' | 'Selective' | 'Restrictive' | 'No Policy';
export type ASNStatus = 'ACTIVE' | 'CONNECTING' | 'INACTIVE';
export type SiteStatus = 'available' | 'coming-soon';
export type LocationStatus = 'current' | 'upcoming';

export interface IASN {
  asnNumber: number;
  name: string;
  macro: string;
  peeringPolicy: PeeringPolicy;
  status: ASNStatus;
}

export interface IEnabledSite {
  id: string;
  name: string;
  provider: string;
  address: string;
  status: SiteStatus;
}

export interface ILocation {
  id: string;                      // e.g., 'del', 'bom', 'maa'
  name: string;                    // e.g., 'New Delhi', 'Mumbai'
  coordinates: [number, number];   // [longitude, latitude]
  code: string;                    // e.g., 'DEL_NORTH'
  region: string;                  // e.g., 'ASIA', 'EUROPE'
  asns: number;                    // Count (computed from asnList.length)
  sites: number;                   // Count (computed from enabledSites.length)
  asnList: IASN[];
  enabledSites: IEnabledSite[];
  status: LocationStatus;
}

// ============================================
// Continent Types
// ============================================
export interface IContinent {
  id: string;           // e.g., 'asia', 'europe'
  name: string;         // e.g., 'Asia Pacific', 'Europe'
  description: string;
  order: number;
  isActive: boolean;
}


// ============================================
// Contact Types
// ============================================
export type Department = 'sales' | 'services' | 'support';

export interface IContactInfo {
  department: Department;
  locationId: string;
  phone: string;
  email: string;
}

// ============================================
// User/Auth Types
// ============================================
export interface IUser {
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'editor';
  isActive: boolean;
}

export interface IAuthPayload {
  userId: string;
  email: string;
  role: string;
}

// ============================================
// API Response Types
// ============================================
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
