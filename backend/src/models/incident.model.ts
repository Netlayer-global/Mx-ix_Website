import mongoose, { Document, Schema } from 'mongoose';

export type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved';
export type IncidentImpact = 'minor' | 'major' | 'critical' | 'maintenance';

export interface IIncidentUpdate {
  status: IncidentStatus;
  message: string;
  timestamp: Date;
}

export interface IIncident extends Document {
  title: string;
  status: IncidentStatus;
  impact: IncidentImpact;
  affectedComponents: string[];
  updates: IIncidentUpdate[];
  startedAt: Date;
  resolvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const incidentSchema = new Schema<IIncident>(
  {
    title: { type: String, required: true },
    status: {
      type: String,
      enum: ['investigating', 'identified', 'monitoring', 'resolved'],
      default: 'investigating',
    },
    impact: {
      type: String,
      enum: ['minor', 'major', 'critical', 'maintenance'],
      default: 'minor',
    },
    affectedComponents: { type: [String], default: [] },
    startedAt: { type: Date, default: Date.now },
    updates: {
      type: [
        {
          status: { type: String, required: true },
          message: { type: String, required: true },
          timestamp: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Incident = mongoose.model<IIncident>('Incident', incidentSchema);
export default Incident;
