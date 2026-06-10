import mongoose, { Document, Schema } from 'mongoose';

export type RsBackend = 'birdwatcher' | 'gobgp';

/**
 * A route server source for Alice-LG. These rows generate the `[[sources]]`
 * blocks in alice.conf. Each points to a birdwatcher/GoBGP API for one RS.
 */
export interface IRouteServer extends Document {
  name: string;          // display name in the LG, e.g. "rs1.del (IPv4)"
  group: string;         // location group, e.g. "Delhi"
  backend: RsBackend;
  apiUrl: string;        // birdwatcher/gobgp API endpoint
  birdwatcherType: string; // 'multi_table' | 'single_table'
  asn?: number;
  ipv4?: string;
  ipv6?: string;
  location?: string;
  order: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const routeServerSchema = new Schema<IRouteServer>(
  {
    name: { type: String, required: true, trim: true },
    group: { type: String, default: '' },
    backend: { type: String, enum: ['birdwatcher', 'gobgp'], default: 'birdwatcher' },
    apiUrl: { type: String, required: true, trim: true },
    birdwatcherType: { type: String, default: 'multi_table' },
    asn: { type: Number },
    ipv4: { type: String, default: '' },
    ipv6: { type: String, default: '' },
    location: { type: String, default: '' },
    order: { type: Number, default: 0 },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const RouteServer = mongoose.model<IRouteServer>('RouteServer', routeServerSchema);
export default RouteServer;
