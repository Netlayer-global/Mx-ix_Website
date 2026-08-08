import mongoose, { Document, Schema, Types } from 'mongoose';

export type AlertScope = 'aggregate' | 'port';
export type AlertMetric = 'traffic_in' | 'traffic_out' | 'utilization';

export interface IAlertRule extends Document {
  organization: Types.ObjectId;
  name: string;
  scope: AlertScope;
  portId?: Types.ObjectId | null;
  metric: AlertMetric;
  thresholdMbps?: number; // for traffic_* metrics
  thresholdPercent?: number; // for utilization
  channels: {
    email: string[];
    slackWebhook?: string;
    webhook?: string;
  };
  enabled: boolean;
  cooldownMinutes: number;
  lastTriggeredAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const alertRuleSchema = new Schema<IAlertRule>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    scope: { type: String, enum: ['aggregate', 'port'], default: 'aggregate' },
    portId: { type: Schema.Types.ObjectId, ref: 'Port', default: null },
    metric: { type: String, enum: ['traffic_in', 'traffic_out', 'utilization'], default: 'traffic_in' },
    thresholdMbps: { type: Number, default: 0 },
    thresholdPercent: { type: Number, default: 0 },
    channels: {
      email: { type: [String], default: [] },
      slackWebhook: { type: String, default: '' },
      webhook: { type: String, default: '' },
    },
    enabled: { type: Boolean, default: true },
    cooldownMinutes: { type: Number, default: 60 },
    lastTriggeredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const AlertRule = mongoose.model<IAlertRule>('AlertRule', alertRuleSchema);
export default AlertRule;
