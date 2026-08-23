import { Organization, VirtualInterface } from '../models';
import { deployInfrastructure, DeployResult } from './birdDeploy.service';
import { notify } from './notification.service';
import { logAudit } from './audit.service';
import { listInvoices } from './zohoBooks.service';
import { getEffectiveZohoProfile } from '../models/settings.model';

/**
 * Member Suspend / Activate service.
 *
 * Suspend = set org.status to 'suspended' + redeploy affected infrastructures
 *           (Bird config excludes suspended orgs, so their BGP sessions drop).
 *
 * Activate = set org.status to 'active' + redeploy (BGP sessions come back).
 *
 * Also provides the daily Zoho overdue invoice checker for auto-suspend.
 */

export interface SuspendResult {
  ok: boolean;
  orgId: string;
  orgName: string;
  previousStatus: string;
  newStatus: string;
  infrastructuresRedeployed: string[];
  deployResults: DeployResult[];
  error?: string;
}

/**
 * Suspend a member: mark suspended + redeploy route servers.
 */
export async function suspendMember(
  orgId: string,
  opts: { reason?: string; actor?: string; notifyMember?: boolean } = {}
): Promise<SuspendResult> {
  const org = await Organization.findById(orgId);
  if (!org) return { ok: false, orgId, orgName: '', previousStatus: '', newStatus: '', infrastructuresRedeployed: [], deployResults: [], error: 'Organization not found.' };

  const previousStatus = org.status;
  if (previousStatus === 'suspended') {
    return { ok: true, orgId, orgName: org.name, previousStatus, newStatus: 'suspended', infrastructuresRedeployed: [], deployResults: [] };
  }

  // Update status
  org.status = 'suspended';
  await org.save();

  // Find all infrastructures this member is connected to
  const vis = await VirtualInterface.find({ organization: org._id }).select('infrastructure').lean();
  const infraIds = [...new Set(vis.map((v: any) => String(v.infrastructure)))];

  // Redeploy each infrastructure (removes the member from Bird config)
  const deployResults: DeployResult[] = [];
  for (const infraId of infraIds) {
    try {
      const results = await deployInfrastructure(infraId, { actor: opts.actor || 'system' });
      deployResults.push(...results);
    } catch (err: any) {
      console.error(`[Suspend] Deploy failed for infrastructure ${infraId}:`, err?.message);
    }
  }

  // Audit log
  await logAudit({
    actor: opts.actor || 'system',
    action: 'customer.suspend',
    resource: 'Organization',
    resourceId: orgId,
    before: { status: previousStatus },
    after: { status: 'suspended', reason: opts.reason },
  });

  // Notify member via portal
  if (opts.notifyMember !== false) {
    await notify(orgId, {
      type: 'billing',
      title: 'Account Suspended',
      body: opts.reason || 'Your account has been suspended. Please contact support or clear outstanding invoices to restore service.',
    });
  }

  return {
    ok: true,
    orgId,
    orgName: org.name,
    previousStatus,
    newStatus: 'suspended',
    infrastructuresRedeployed: infraIds,
    deployResults,
  };
}

/**
 * Activate a member: mark active + redeploy route servers.
 */
export async function activateMember(
  orgId: string,
  opts: { actor?: string; notifyMember?: boolean } = {}
): Promise<SuspendResult> {
  const org = await Organization.findById(orgId);
  if (!org) return { ok: false, orgId, orgName: '', previousStatus: '', newStatus: '', infrastructuresRedeployed: [], deployResults: [], error: 'Organization not found.' };

  const previousStatus = org.status;
  if (previousStatus === 'active') {
    return { ok: true, orgId, orgName: org.name, previousStatus, newStatus: 'active', infrastructuresRedeployed: [], deployResults: [] };
  }

  // Update status
  org.status = 'active';
  org.approvedAt = new Date();
  await org.save();

  // Find all infrastructures this member is connected to
  const vis = await VirtualInterface.find({ organization: org._id }).select('infrastructure').lean();
  const infraIds = [...new Set(vis.map((v: any) => String(v.infrastructure)))];

  // Redeploy each infrastructure (re-includes the member in Bird config)
  const deployResults: DeployResult[] = [];
  for (const infraId of infraIds) {
    try {
      const results = await deployInfrastructure(infraId, { actor: opts.actor || 'system' });
      deployResults.push(...results);
    } catch (err: any) {
      console.error(`[Activate] Deploy failed for infrastructure ${infraId}:`, err?.message);
    }
  }

  // Audit log
  await logAudit({
    actor: opts.actor || 'system',
    action: 'customer.activate',
    resource: 'Organization',
    resourceId: orgId,
    before: { status: previousStatus },
    after: { status: 'active' },
  });

  // Notify member
  if (opts.notifyMember !== false) {
    await notify(orgId, {
      type: 'billing',
      title: 'Account Activated',
      body: 'Your account has been activated. BGP sessions will be restored shortly.',
    });
  }

  return {
    ok: true,
    orgId,
    orgName: org.name,
    previousStatus,
    newStatus: 'active',
    infrastructuresRedeployed: infraIds,
    deployResults,
  };
}

/**
 * Daily Zoho overdue invoice check.
 * Scans all active orgs with a zohoContactId, pulls their invoices,
 * and auto-suspends if any invoice is overdue.
 * Auto-activates if a previously suspended org has no overdue invoices (payment cleared).
 */
export async function checkZohoOverdueInvoices(): Promise<{
  checked: number;
  suspended: string[];
  reactivated: string[];
  errors: string[];
}> {
  const result = { checked: 0, suspended: [] as string[], reactivated: [] as string[], errors: [] as string[] };

  // Check Zoho is configured
  try {
    const cfg = await getEffectiveZohoProfile();
    if (!cfg || !(cfg as any).enabled) {
      console.log('[BillingCron] Zoho Books not configured, skipping overdue check.');
      return result;
    }
  } catch {
    return result;
  }

  // Get all orgs that have Zoho contact linked (active or suspended)
  const orgs = await Organization.find({
    zohoContactId: { $ne: '', $exists: true },
    status: { $in: ['active', 'suspended'] },
  }).select('_id name status zohoContactId zohoProfileKey').lean();

  for (const org of orgs as any[]) {
    result.checked++;
    try {
      const invoiceResult = await listInvoices(org.zohoContactId, org.zohoProfileKey || undefined);
      if (!invoiceResult.ok) {
        result.errors.push(`${org.name}: ${invoiceResult.error}`);
        continue;
      }

      const invoices = invoiceResult.invoices || [];
      const hasOverdue = invoices.some((inv: any) => inv.status === 'overdue');

      if (hasOverdue && org.status === 'active') {
        // Auto-suspend
        const suspendRes = await suspendMember(String(org._id), {
          reason: 'Auto-suspended: overdue invoice detected by billing system.',
          actor: 'billing-cron',
          notifyMember: true,
        });
        if (suspendRes.ok) {
          result.suspended.push(org.name);
          console.log(`[BillingCron] Auto-suspended: ${org.name} (overdue invoice)`);
        }
      } else if (!hasOverdue && org.status === 'suspended') {
        // Auto-reactivate (payment cleared)
        const activateRes = await activateMember(String(org._id), {
          actor: 'billing-cron',
          notifyMember: true,
        });
        if (activateRes.ok) {
          result.reactivated.push(org.name);
          console.log(`[BillingCron] Auto-reactivated: ${org.name} (no overdue invoices)`);
        }
      }
    } catch (err: any) {
      result.errors.push(`${org.name}: ${err?.message || 'Unknown error'}`);
    }
  }

  console.log(`[BillingCron] Done: checked=${result.checked}, suspended=${result.suspended.length}, reactivated=${result.reactivated.length}, errors=${result.errors.length}`);
  return result;
}

export default { suspendMember, activateMember, checkZohoOverdueInvoices };
