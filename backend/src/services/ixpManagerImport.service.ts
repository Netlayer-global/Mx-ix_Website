import {
  Infrastructure,
  Organization,
  Vlan,
  VlanInterface,
  VirtualInterface,
  IpAddress,
  Switch,
  SwitchPort,
} from '../models';
import ixpManager from './ixpManager.service';
import { getEffectiveIxpManager } from '../models/settings.model';
import ipam from './ipam.service';
import { logAudit } from './audit.service';

/**
 * One-time IXP Manager import tool.
 *
 * Reads the IX-F member export from the configured IXP Manager instance and
 * creates native Infrastructure, Organization, VirtualInterface, VlanInterface
 * and IpAddress records from it. After a successful import, the IXP Manager
 * integration can be disabled — we ARE the source of truth now.
 *
 * Idempotent: re-running skips records that already exist (matched by ASN or
 * ixpManagerId). Safe to run multiple times during a migration.
 */

export interface ImportResult {
  ok: boolean;
  error?: string;
  stats: {
    membersProcessed: number;
    orgsCreated: number;
    orgsLinked: number;
    orgsSkipped: number;
    connectionsCreated: number;
    peersCreated: number;
    addressesAllocated: number;
    errors: string[];
  };
}

export const runImport = async (opts: {
  actor?: string;
  /** Infrastructure to assign connections to. If not set, uses the first enabled one. */
  infrastructureId?: string;
  /** VLAN to create peers on. If not set, uses the first peering VLAN on the infrastructure. */
  vlanId?: string;
  /** Create orgs that don't exist yet. Default true. */
  autoCreateOrgs?: boolean;
  /** Dry run — report what would happen without writing anything. */
  dryRun?: boolean;
}): Promise<ImportResult> => {
  const stats: ImportResult['stats'] = {
    membersProcessed: 0,
    orgsCreated: 0,
    orgsLinked: 0,
    orgsSkipped: 0,
    connectionsCreated: 0,
    peersCreated: 0,
    addressesAllocated: 0,
    errors: [],
  };

  // Verify IXP Manager is configured
  const cfg = await getEffectiveIxpManager();
  if (!cfg.enabled) {
    return { ok: false, error: 'IXP Manager is not configured in Settings.', stats };
  }

  // Fetch the IX-F export
  const ixfResult = await ixpManager.fetchMembers();
  if (!ixfResult.ok) {
    return { ok: false, error: `Could not fetch members from IXP Manager: ${ixfResult.error}`, stats };
  }

  const members = Array.isArray(ixfResult.data) ? ixfResult.data : [];
  if (!members.length) {
    return { ok: false, error: 'IXP Manager returned no members.', stats };
  }

  // Resolve infrastructure
  let infra: any;
  if (opts.infrastructureId) {
    infra = await Infrastructure.findById(opts.infrastructureId).lean();
  } else {
    infra = await Infrastructure.findOne({ enabled: true }).sort({ isPrimary: -1, order: 1 }).lean();
  }
  if (!infra) {
    return { ok: false, error: 'No infrastructure found. Create one first, then run the import.', stats };
  }

  // Resolve VLAN
  let vlan: any;
  if (opts.vlanId) {
    vlan = await Vlan.findById(opts.vlanId).lean();
  } else {
    vlan = await Vlan.findOne({ infrastructure: infra._id, enabled: true, isPrivate: false, isQuarantine: false })
      .sort({ order: 1, number: 1 })
      .lean();
  }
  if (!vlan) {
    return { ok: false, error: 'No peering VLAN found on this infrastructure. Create one first.', stats };
  }

  // Fetch ports from IXP Manager for connection details
  const portsResult = await ixpManager.fetchPorts();
  const allPorts = portsResult.ok && Array.isArray(portsResult.data) ? portsResult.data : [];

  // Process each member
  for (const member of members) {
    stats.membersProcessed++;
    const asn = Number(member.asn || member.id || 0);
    const name = String(member.name || `AS${asn}`);

    if (!asn) {
      stats.errors.push(`Skipped member "${name}" — no ASN.`);
      stats.orgsSkipped++;
      continue;
    }

    // Match or create Organization
    let org = await Organization.findOne({
      $or: [{ ixpManagerId: String(asn) }, { asn }, { additionalAsns: asn }],
    });

    if (org) {
      // Already exists — just link if not linked yet
      if (!org.ixpManagerId) {
        if (!opts.dryRun) {
          org.ixpManagerId = String(asn);
          await org.save();
        }
        stats.orgsLinked++;
      } else {
        stats.orgsSkipped++;
      }
    } else if (opts.autoCreateOrgs !== false) {
      // Create new organization
      if (!opts.dryRun) {
        org = await Organization.create({
          name,
          asn,
          ixpManagerId: String(asn),
          type: 'ISP',
          peeringPolicy: 'Open',
          status: 'active',
          notes: 'Imported from IXP Manager',
        });
      }
      stats.orgsCreated++;
    } else {
      stats.errors.push(`AS${asn} ${name} — no matching org and autoCreate is off.`);
      stats.orgsSkipped++;
      continue;
    }

    if (!org || opts.dryRun) continue;

    // Check if this member already has a connection on this infrastructure
    const existingVi = await VirtualInterface.findOne({
      organization: org._id,
      infrastructure: infra._id,
    });
    if (existingVi) {
      // Already provisioned — skip
      continue;
    }

    // Create VirtualInterface (connection)
    const vi = await VirtualInterface.create({
      organization: org._id,
      infrastructure: infra._id,
      name: `AS${asn} ${name} (imported)`,
      lagFraming: 'none',
    });
    stats.connectionsCreated++;

    // Create VlanInterface (peer)
    const vli = await VlanInterface.create({
      virtualInterface: vi._id,
      vlan: vlan._id,
      ipv4Enabled: true,
      ipv6Enabled: !!vlan.ipv6Prefix,
      rsClient: true,
      rsMode: 'passive',
      irrdbFilter: true,
      rpkiFilter: true,
      enabled: true,
    });
    stats.peersCreated++;

    // Try to allocate IP addresses from the pool
    try {
      const allocation = await ipam.allocateForInterface(vlan._id, vli._id, {
        wantV4: !!vlan.ipv4Prefix,
        wantV6: !!vlan.ipv6Prefix,
        asn,
      });
      if (allocation.ipv4) {
        vli.ipv4Address = allocation.ipv4.id;
        stats.addressesAllocated++;
      }
      if (allocation.ipv6) {
        vli.ipv6Address = allocation.ipv6.id;
        stats.addressesAllocated++;
      }
      await vli.save();
    } catch (err: any) {
      stats.errors.push(`AS${asn}: IP allocation failed — ${err?.message}. Peer created but has no addresses.`);
    }
  }

  // Log the import
  if (!opts.dryRun) {
    await logAudit({
      actor: opts.actor || 'system',
      action: 'ixpmanager.import',
      resource: 'Infrastructure',
      resourceId: String(infra._id),
      after: stats,
    });
  }

  return { ok: true, stats };
};

/**
 * After a successful import, mark the IXP Manager integration as retired.
 * The data is now native, so the sync endpoints should not be used anymore.
 */
export const retireIntegration = async (actor?: string): Promise<void> => {
  const { Settings } = await import('../models/settings.model');
  await Settings.updateOne({}, { $set: { 'ixpManager.enabled': false } });
  await logAudit({
    actor: actor || 'system',
    action: 'ixpmanager.retire',
    resource: 'Settings',
    after: { ixpManager: { enabled: false } },
  });
};

export default { runImport, retireIntegration };
