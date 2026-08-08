import { AuditLog } from '../models';

/**
 * Record an admin action. Best-effort — never throws into the request flow.
 */
export const logAudit = async (entry: {
  actor?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  before?: any;
  after?: any;
}): Promise<void> => {
  try {
    await AuditLog.create({
      actor: entry.actor || 'system',
      action: entry.action,
      resource: entry.resource || '',
      resourceId: entry.resourceId || '',
      before: entry.before ?? null,
      after: entry.after ?? null,
    });
  } catch (err) {
    console.error('[Audit] Failed to record:', err);
  }
};

export default { logAudit };
