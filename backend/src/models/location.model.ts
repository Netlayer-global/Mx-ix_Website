import mongoose, { Document, Schema } from 'mongoose';
import { IASN, IEnabledSite, LocationStatus } from '../types';

export interface ILocationDocument extends Document {
  id: string;
  name: string;
  coordinates: [number, number];
  code: string;
  region: string;
  asns: number;
  sites: number;
  asnList: IASN[];
  enabledSites: IEnabledSite[];
  status: LocationStatus;
  // New fields for detailed location info
  country: string;
  continentId: string;
  latency: string;
  datacenter: string;
  address: string;
  ixName: string;
  peers: number;
  capacity: string;
  uptime: string; // Uptime percentage (e.g., "99.99%")
  ipv4Routes: string;
  ipv6Routes: string;
  portSpeeds: string[];
  protocols: string[];
  features: string[];
  description: string;
  established: string;
  cityImage: string;
  pricing: Array<{
    portSpeed: string;
    monthlyPrice: number;
    setupFee: number;
    currency: string;
  }>;
  routeServers: Array<{
    name: string;
    asn: string;
    ipv4: string;
    ipv6: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const pricingTierSchema = new Schema(
  {
    portSpeed: { type: String, required: true },
    monthlyPrice: { type: Number, required: true },
    setupFee: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
  },
  { _id: false }
);

const asnSchema = new Schema(
  {
    asnNumber: {
      type: Number,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    macro: {
      type: String,
      default: '',
    },
    peeringPolicy: {
      type: String,
      enum: ['Open', 'Selective', 'Restrictive', 'No Policy'],
      default: 'Open',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'CONNECTING', 'INACTIVE'],
      default: 'ACTIVE',
    },
  },
  { _id: false }
);

const enabledSiteSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    provider: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['available', 'coming-soon'],
      default: 'available',
    },
  },
  { _id: false }
);

const routeServerSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    asn: {
      type: String,
      required: true,
    },
    ipv4: {
      type: String,
      required: true,
    },
    ipv6: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const locationSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: function (v: number[]) {
          return v.length === 2;
        },
        message: 'Coordinates must be [longitude, latitude]',
      },
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
    },
    region: {
      type: String,
      required: true,
      uppercase: true,
    },
    asns: {
      type: Number,
      default: 0,
    },
    sites: {
      type: Number,
      default: 0,
    },
    asnList: [asnSchema],
    enabledSites: [enabledSiteSchema],
    status: {
      type: String,
      enum: ['current', 'upcoming'],
      default: 'current',
    },
    // New detailed location fields
    country: {
      type: String,
      default: '',
    },
    continentId: {
      type: String,
      default: 'asia',
    },
    latency: {
      type: String,
      default: '1.0',
    },
    datacenter: {
      type: String,
      default: '',
    },
    address: {
      type: String,
      default: '',
    },
    ixName: {
      type: String,
      default: '',
    },
    peers: {
      type: Number,
      default: 0,
    },
    capacity: {
      type: String,
      default: '100+',
    },
    uptime: {
      type: String,
      default: '99.99%',
    },
    ipv4Routes: {
      type: String,
      default: '',
    },
    ipv6Routes: {
      type: String,
      default: '',
    },
    portSpeeds: {
      type: [String],
      default: ['1G', '10G', '40G', '100G'],
    },
    protocols: {
      type: [String],
      default: ['BGP-4', 'IPv4', 'IPv6'],
    },
    features: {
      type: [String],
      default: [],
    },
    description: {
      type: String,
      default: '',
    },
    established: {
      type: String,
      default: '',
    },
    cityImage: {
      type: String,
      default: '',
    },
    pricing: {
      type: [pricingTierSchema],
      default: [],
    },
    routeServers: {
      type: [routeServerSchema],
      default: [],
    },

  },
  {
    timestamps: true,
  }
);

// Update counts before saving
locationSchema.pre('save', function () {
  const doc = this as any;
  doc.asns = doc.asnList?.length || 0;
  doc.sites = doc.enabledSites?.length || 0;
});

// Indexes
locationSchema.index({ region: 1 });
locationSchema.index({ status: 1 });
locationSchema.index({ continentId: 1 });
locationSchema.index({ name: 'text' });

export const Location = mongoose.model<ILocationDocument>('Location', locationSchema);
export default Location;
