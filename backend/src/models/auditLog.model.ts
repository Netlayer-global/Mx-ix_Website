import mongoose, { Document, Schema } from 'mongoose';

export interface IAuditLog extends Document {
  actor: string; // admin email
  action: string; // e.g. 'customer.suspend', 'order.update'
  resource: string; // e.g. 'Organization'
  resourceId?: string;
  before?: any;
  after?: any;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actor: { type: String, default: 'system', index: true },
    action: { type: String, required: true, index: true },
    resource: { type: String, default: '' },
    resourceId: { type: String, default: '' },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
export default AuditLog;
