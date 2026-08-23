import { Types } from 'mongoose';
import {
  Organization,
  Infrastructure,
  Vlan,
  Switch,
  SwitchPort,
  VirtualInterface,
  PhysicalInterface,
  VlanInterface,
  RouteServer,
} from '../models';
import ipam from './ipam.service';
import irrdb from './irrdb.service';
import peeringdb from './peeringdb.service';
import { deployInfrastructure, DeployResult } from './birdDeploy.service';
import { logAudit } from './audit.service';
import { getEffectivePeeringDb } from '../models/settings.model';

/**
 * Provisioning orchestrator — the "create a member and their peer appears on the
 * route servers" path.
 *
 * Walks the whole hierarchy in one transaction-like sequence:
 *
 *   1. claim the switch port(s)                  -> PhysicalInterface
 *   2. create the connection container           -> VirtualInterface
 *   3. create the peer record on the peering VLAN -> VlanInterface
 *   4. allocate IPv4 + IPv6 from the VLAN pool    -> IpAddress
 *   5. pull PeeringDB (max-prefix, as-set)        -> Organization
 *   6. expand the as-set                          -> IrrdbPrefix
 *   7. rebuild and push config to both route servers
 *
 * MongoDB has no cross-collection transaction without a replica set, so instead
 * of assuming one, every step is recorded and `rollback()` undoes them in
 * reverse on failure. That keeps a half-provisioned member from silently
 * occupying a switch port or an IP address.
 */

export interface ProvisionInput {
  organizationId: string;
  infrastructureId: string;
  /** Peering VLAN. Defaults to the infrastructure's non-quarantine VLAN. */
  vlanId?: string;
  /** Switch ports to bundle. More than one creates a LAG. */
  switchPortIds: string[];
  /** Port speed in Mbit/s (1000 / 10000 / 100000 / 400000). */
  speed: number;
  /** Friendly name for the connection. Derived from the ASN when blank. */
  name?: string;
  /** Start the member in the quarantine VLAN instead of the peering LAN. */
  quarantine?: boolean;
  /** LAG framing when bundling more than one port. */
  lagFraming?: 'none' | 'lacp' | 'static';
  channelGroup?: number;
  mtu?: number;

  // Peer policy
  ipv4?: boolean;
  ipv6?: boolean;
  rsClient?: boolean;
  /** New members start passive so the RS doesn't log churn before they're ready. */
  rsMode?: 'normal' | 'passive' | 'disabled';
  irrdbFilter?: boolean;
  rpkiFilter?: boolean;
  maxPrefixesV4?: number;
  maxPrefixesV6?: number;
  /** Specific addresses instead of the next free ones. */
  requestedIpv4?: string;
  requestedIpv6?: string;

  // Workflow
  /** Pull the member's PeeringDB record to fill in limits and as-set. */
  syncPeeringDb?: boolean;
  /** Expand the as-set before deploying, so filters are populated. */
  refreshIrrdb?: boolean;
  /** Build and push route-server config. Off means "stage only". */
  deploy?: boolean;
  actor?: string;
  /** If provisioned from an order, pass the order ID to auto-complete it. */
  orderId?: string;
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
  deployments: DeployResult[];
  warnings: string[];
  error?: string;
}

/** Undo log entry, so a failure can be unwound in reverse order. */
interface Undo {
  label: string;
  run: () => Promise<void>;
}

export const provisionConnection = async (input: ProvisionInput): Promise<ProvisionResult> => {
  const steps: ProvisionStep[] = [];
  const warnings: string[] = [];
  const undo: Undo[] = [];
  const physicalInterfaceIds: string[] = [];

  const fail = async (message: string): Promise<ProvisionResult> => {
    // Unwind in reverse so a port is freed before the interface that claimed it
    // disappears.
    for (const entry of [...undo].reverse()) {
      try {
        await entry.run();
      } catch (err: any) {
        warnings.push(`Rollback of "${entry.label}" failed: ${err?.message}. Check it by hand.`);
      }
    }
    return {
      ok: false,
      organization: { id: input.organizationId, name: '' },
      physicalInterfaceIds: [],
      steps,
      deployments: [],
      warnings,
      error: message,
    };
  };

  // ── Validate inputs ──

  const org = await Organization.findById(input.organizationId);
  if (!org) return fail('Customer not found.');

  const infra = await Infrastructure.findById(input.infrastructureId);
  if (!infra) return fail('Infrastructure not found.');

  if (!org.asn) {
    return fail(
      `${org.name} has no ASN set. A peer cannot be built without one — add the ASN to the customer first.`
    );
  }

  if (!Array.isArray(input.switchPortIds) || input.switchPortIds.length === 0) {
    return fail('Select at least one switch port.');
  }

  const speed = Number(input.speed);
  if (!Number.isInteger(speed) || speed <= 0) return fail('Port speed must be a positive whole number of Mbit/s.');

  // Resolve the VLAN: explicit, else quarantine or peering LAN on this fabric.
  let vlan;
  if (input.vlanId) {
    vlan = await Vlan.findOne({ _id: input.vlanId, infrastructure: infra._id });
    if (!vlan) return fail('The selected VLAN does not belong to this infrastructure.');
  } else {
    vlan = await Vlan.findOne({
      infrastructure: infra._id,
      enabled: true,
      isPrivate: false,
      isQuarantine: !!input.quarantine,
    }).sort({ order: 1, number: 1 });
    if (!vlan) {
      return fail(
        input.quarantine
          ? 'No quarantine VLAN is configured on this infrastructure.'
          : 'No peering VLAN is configured on this infrastructure.'
      );
    }
  }

  // Ports must exist, be free, and live on a switch in this fabric.
  const ports = await SwitchPort.find({ _id: { $in: input.switchPortIds } });
  if (ports.length !== input.switchPortIds.length) {
    return fail('One or more of the selected switch ports no longer exists.');
  }
  const switches = await Switch.find({ _id: { $in: ports.map((p) => p.switch) } })
    .select('infrastructure name')
    .lean();
  const switchById = new Map(switches.map((s: any) => [String(s._id), s]));
  for (const p of ports) {
    const sw = switchById.get(String(p.switch));
    if (!sw) return fail(`Switch port ${p.name} has no switch.`);
    if (String(sw.infrastructure) !== String(infra._id)) {
      return fail(`Switch port ${p.name} is on ${sw.name}, which is not part of ${infra.name}.`);
    }
    if (p.status !== 'free' && p.status !== 'reserved') {
      return fail(`Switch port ${sw.name} ${p.name} is ${p.status}, not free.`);
    }
  }

  steps.push({ step: 'validate', ok: true, detail: `${ports.length} port(s), VLAN ${vlan.number} (${vlan.name})` });

  // ── 1. Virtual interface (the LAG container) ──

  let vi;
  try {
    vi = await VirtualInterface.create({
      organization: org._id,
      infrastructure: infra._id,
      name: input.name?.trim() || `AS${org.asn} ${infra.name}`,
      channelGroup: input.channelGroup,
      lagFraming: input.lagFraming || (ports.length > 1 ? 'lacp' : 'none'),
      mtu: input.mtu || infra.mtu,
      billingSpeed: speed * ports.length,
    });
    undo.push({ label: 'virtual interface', run: async () => VirtualInterface.deleteOne({ _id: vi!._id }).then(() => undefined) });
    steps.push({ step: 'virtual-interface', ok: true, detail: String(vi._id) });
  } catch (err: any) {
    steps.push({ step: 'virtual-interface', ok: false, error: err?.message });
    return fail(`Could not create the connection: ${err?.message}`);
  }

  // ── 2. Physical interfaces (claim the switch ports) ──

  for (const port of ports) {
    try {
      const pi = await PhysicalInterface.create({
        virtualInterface: vi._id,
        switchPort: port._id,
        speed,
        status: 'awaiting-xconnect',
      });
      physicalInterfaceIds.push(String(pi._id));
      undo.push({
        label: `physical interface on ${port.name}`,
        run: async () => PhysicalInterface.deleteOne({ _id: pi._id }).then(() => undefined),
      });

      const previousStatus = port.status;
      await SwitchPort.updateOne({ _id: port._id }, { $set: { status: 'assigned' } });
      undo.push({
        label: `switch port ${port.name} status`,
        run: async () => SwitchPort.updateOne({ _id: port._id }, { $set: { status: previousStatus } }).then(() => undefined),
      });
    } catch (err: any) {
      // The unique index on PhysicalInterface.switchPort is what catches a
      // concurrent provisioning run trying to take the same port.
      const message =
        err?.code === 11000
          ? `Switch port ${port.name} was claimed by another connection while this one was being set up.`
          : err?.message;
      steps.push({ step: 'physical-interface', ok: false, error: message });
      return fail(`Could not claim switch port ${port.name}: ${message}`);
    }
  }
  steps.push({ step: 'physical-interfaces', ok: true, detail: `${physicalInterfaceIds.length} claimed` });

  // ── 3. VLAN interface (the peer record) ──

  const wantV4 = input.ipv4 !== false;
  const wantV6 = input.ipv6 !== false;

  let vli;
  try {
    vli = await VlanInterface.create({
      virtualInterface: vi._id,
      vlan: vlan._id,
      ipv4Enabled: wantV4,
      ipv6Enabled: wantV6,
      rsClient: input.rsClient !== false,
      // Passive by default: the route server waits for the member to connect,
      // which avoids logging failed attempts while they finish their side.
      rsMode: input.rsMode || 'passive',
      irrdbFilter: input.irrdbFilter !== false,
      rpkiFilter: input.rpkiFilter !== false,
      maxPrefixesV4: input.maxPrefixesV4 || 0,
      maxPrefixesV6: input.maxPrefixesV6 || 0,
      asMacro: org.irrAsSet || '',
      enabled: true,
    });
    undo.push({ label: 'vlan interface', run: async () => VlanInterface.deleteOne({ _id: vli!._id }).then(() => undefined) });
    steps.push({ step: 'vlan-interface', ok: true, detail: String(vli._id) });
  } catch (err: any) {
    steps.push({ step: 'vlan-interface', ok: false, error: err?.message });
    return fail(`Could not create the peer record: ${err?.message}`);
  }

  // ── 4. Address allocation ──

  let ipv4Address: string | undefined;
  let ipv6Address: string | undefined;

  try {
    if (wantV4) {
      const claimed = input.requestedIpv4
        ? await ipam.allocateSpecific(vlan._id as Types.ObjectId, input.requestedIpv4, vli._id as Types.ObjectId)
        : await ipam.allocate(vlan._id as Types.ObjectId, 4, vli._id as Types.ObjectId);
      if (!claimed) {
        return fail(`No free IPv4 address left in VLAN ${vlan.name}. Seed or widen the pool, then try again.`);
      }
      ipv4Address = claimed.address;
      vli.ipv4Address = claimed.id;
    }

    if (wantV6) {
      const claimed = input.requestedIpv6
        ? await ipam.allocateSpecific(vlan._id as Types.ObjectId, input.requestedIpv6, vli._id as Types.ObjectId)
        : (
            await ipam.allocateForInterface(vlan._id as Types.ObjectId, vli._id as Types.ObjectId, {
              wantV4: false,
              wantV6: true,
              asn: org.asn,
            })
          ).ipv6;
      if (!claimed) {
        return fail(`No free IPv6 address left in VLAN ${vlan.name}. Seed or widen the pool, then try again.`);
      }
      ipv6Address = claimed.address;
      vli.ipv6Address = claimed.id;
    }

    await vli.save();
    undo.push({
      label: 'IP allocations',
      run: async () => {
        await ipam.releaseForInterface(vli!._id as Types.ObjectId);
      },
    });
    steps.push({
      step: 'addressing',
      ok: true,
      detail: [ipv4Address, ipv6Address].filter(Boolean).join(', ') || 'none requested',
    });
  } catch (err: any) {
    steps.push({ step: 'addressing', ok: false, error: err?.message });
    return fail(`Address allocation failed: ${err?.message}`);
  }

  // From here on the connection exists and is usable. Later steps enrich and
  // publish it, so a failure is reported as a warning rather than unwinding a
  // working provision.

  // ── 5. PeeringDB enrichment ──

  if (input.syncPeeringDb) {
    try {
      const cfg = await getEffectivePeeringDb();
      if (!cfg.enabled) {
        warnings.push('PeeringDB sync was requested but PeeringDB is not enabled in Settings.');
      } else {
        const net = await peeringdb.getNetByAsn(org.asn);
        if (net.ok && net.data) {
          const patch = peeringdb.mapNetToOrganization(net.data, {
            syncMaxPrefixes: cfg.syncMaxPrefixes,
            syncIrrAsSet: cfg.syncIrrAsSet,
          });
          // Don't let PeeringDB rename a customer an operator already named.
          delete patch.name;
          await Organization.updateOne({ _id: org._id }, { $set: patch });

          if (patch.irrAsSet && !vli.asMacro) {
            vli.asMacro = patch.irrAsSet;
            await vli.save();
          }
          steps.push({
            step: 'peeringdb',
            ok: true,
            detail: `as-set ${patch.irrAsSet || 'none'}, prefixes v4 ${patch.infoPrefixes4 ?? '—'} / v6 ${patch.infoPrefixes6 ?? '—'}`,
          });
        } else {
          warnings.push(`PeeringDB had no usable record for AS${org.asn}${net.error ? ` (${net.error})` : ''}.`);
          steps.push({ step: 'peeringdb', ok: false, error: net.error });
        }
      }
    } catch (err: any) {
      warnings.push(`PeeringDB sync failed: ${err?.message}`);
      steps.push({ step: 'peeringdb', ok: false, error: err?.message });
    }
  }

  // ── 6. IRRDB expansion ──

  if (input.refreshIrrdb && vli.rsClient && vli.irrdbFilter) {
    try {
      const refreshed = await Organization.findById(org._id).select('irrAsSet').lean();
      const results = await irrdb.refreshAsn(org.asn, {
        asMacro: vli.asMacro || (refreshed as any)?.irrAsSet || '',
      });
      const total = results.reduce((n, r) => n + r.prefixCount, 0);
      const failures = results.filter((r) => !r.ok);
      if (failures.length) {
        warnings.push(
          `IRRDB expansion had problems: ${failures.map((f) => f.error).filter(Boolean).join('; ')}`
        );
      }
      if (total === 0) {
        warnings.push(
          `No prefixes were found for AS${org.asn}. With IRRDB filtering on, the route servers will reject this member's routes until the cache is populated.`
        );
      }
      steps.push({ step: 'irrdb', ok: failures.length === 0, detail: `${total} prefixes cached` });
    } catch (err: any) {
      warnings.push(`IRRDB expansion failed: ${err?.message}`);
      steps.push({ step: 'irrdb', ok: false, error: err?.message });
    }
  }

  // ── 7. Push to the route servers ──

  let deployments: DeployResult[] = [];
  if (input.deploy) {
    try {
      deployments = await deployInfrastructure(infra._id as Types.ObjectId, { actor: input.actor });
      const failed = deployments.filter((d) => d.error);
      if (failed.length) {
        warnings.push(
          `Route server deploy reported problems: ${failed.map((f) => `${f.name}: ${f.error}`).join('; ')}`
        );
      }
      const applied = deployments.filter((d) => d.applied).length;
      steps.push({
        step: 'deploy',
        ok: failed.length === 0,
        detail: `${applied} of ${deployments.length} route server(s) updated`,
      });
      // Every route server carries all peers, so nothing being applied means the
      // new peer is not live anywhere.
      if (applied === 0 && deployments.length > 0) {
        warnings.push('No route server actually applied the new config — the peer is provisioned but not live yet.');
      }
    } catch (err: any) {
      warnings.push(`Route server deploy failed: ${err?.message}`);
      steps.push({ step: 'deploy', ok: false, error: err?.message });
    }
  } else {
    const rsCount = await RouteServer.countDocuments({ infrastructure: infra._id, enabled: true });
    steps.push({
      step: 'deploy',
      ok: true,
      detail: `skipped — ${rsCount} route server(s) will pick this up on the next deploy`,
    });
  }

  await logAudit({
    actor: input.actor,
    action: 'provision.connection',
    resource: 'Organization',
    resourceId: String(org._id),
    after: {
      infrastructure: infra.name,
      vlan: vlan.number,
      ports: ports.map((p) => p.name),
      speed,
      ipv4: ipv4Address,
      ipv6: ipv6Address,
      virtualInterface: String(vi._id),
      vlanInterface: String(vli._id),
      deployed: deployments.filter((d) => d.applied).length,
    },
  });

  // ── Post-provision hooks (best-effort — never block the result) ──

  // 1. Auto-create Zabbix host for monitoring
  try {
    const { provisionZabbixHost } = await import('./zabbixProvision.service');
    const switchName = ports[0]?.name || `port-${vi._id}`;
    const hostid = await provisionZabbixHost({
      hostname: switchName,
      displayName: `${org.name} — ${switchName}`,
      groupName: 'MX-IX Members',
    });
    if (hostid) {
      const { Port: PortModel } = await import('../models');
      await PortModel.findOneAndUpdate(
        { organization: org._id, name: { $regex: new RegExp(switchName, 'i') } },
        { zabbixHostId: hostid }
      );
      steps.push({ step: 'zabbix', ok: true, detail: `Host ${hostid} created` });
    }
  } catch (err: any) {
    warnings.push(`Zabbix host auto-provision skipped: ${err?.message}`);
  }

  // 2. Auto-complete the linked order (if provisioned from an order)
  if (input.orderId) {
    try {
      const { default: Order } = await import('../models/order.model');
      await Order.findByIdAndUpdate(input.orderId, {
        $set: { status: 'completed' },
        $push: { updates: { status: 'completed', message: 'Auto-completed after successful provisioning', at: new Date() } },
      });
      steps.push({ step: 'order-complete', ok: true, detail: `Order ${input.orderId} → completed` });
    } catch (err: any) {
      warnings.push(`Order auto-complete failed: ${err?.message}`);
    }
  }

  return {
    ok: true,
    organization: { id: String(org._id), name: org.name, asn: org.asn },
    virtualInterfaceId: String(vi._id),
    vlanInterfaceId: String(vli._id),
    physicalInterfaceIds,
    ipv4: ipv4Address,
    ipv6: ipv6Address,
    steps,
    deployments,
    warnings,
  };
};

/**
 * Tear a connection down: release addresses, free the switch ports, remove the
 * interface records, then rebuild the route servers so the peer disappears.
 */
export const deprovisionConnection = async (
  virtualInterfaceId: string | Types.ObjectId,
  opts: { actor?: string; deploy?: boolean } = {}
): Promise<{ ok: boolean; freedPorts: string[]; releasedAddresses: number; deployments: DeployResult[]; error?: string }> => {
  const vi = await VirtualInterface.findById(virtualInterfaceId);
  if (!vi) return { ok: false, freedPorts: [], releasedAddresses: 0, deployments: [], error: 'Connection not found.' };

  const infraId = vi.infrastructure;
  const vlis = await VlanInterface.find({ virtualInterface: vi._id }).select('_id').lean();

  let releasedAddresses = 0;
  for (const vli of vlis as any[]) {
    releasedAddresses += await ipam.releaseForInterface(vli._id);
  }
  await VlanInterface.deleteMany({ virtualInterface: vi._id });

  const pis = await PhysicalInterface.find({ virtualInterface: vi._id }).select('switchPort').lean();
  const portIds = pis.map((p: any) => p.switchPort);
  const freedPortDocs = await SwitchPort.find({ _id: { $in: portIds } }).select('name').lean();
  await SwitchPort.updateMany({ _id: { $in: portIds } }, { $set: { status: 'free' } });
  await PhysicalInterface.deleteMany({ virtualInterface: vi._id });

  const organization = vi.organization;
  await VirtualInterface.deleteOne({ _id: vi._id });

  let deployments: DeployResult[] = [];
  if (opts.deploy !== false) {
    deployments = await deployInfrastructure(infraId as Types.ObjectId, { actor: opts.actor });
  }

  await logAudit({
    actor: opts.actor,
    action: 'provision.deprovision',
    resource: 'Organization',
    resourceId: String(organization),
    before: {
      virtualInterface: String(vi._id),
      ports: freedPortDocs.map((p: any) => p.name),
      releasedAddresses,
    },
  });

  return {
    ok: true,
    freedPorts: freedPortDocs.map((p: any) => p.name),
    releasedAddresses,
    deployments,
  };
};

/**
 * Move a connection from the quarantine VLAN onto the production peering LAN.
 *
 * New addresses are allocated from the target VLAN and the old ones released,
 * because addressing is per-VLAN. `rsMode` is promoted to `normal` at the same
 * time, since the member has by then proven the session works.
 */
export const moveToVlan = async (
  vlanInterfaceId: string | Types.ObjectId,
  targetVlanId: string | Types.ObjectId,
  opts: { actor?: string; deploy?: boolean; promote?: boolean } = {}
): Promise<{ ok: boolean; ipv4?: string; ipv6?: string; deployments: DeployResult[]; warnings: string[]; error?: string }> => {
  const warnings: string[] = [];
  const vli = await VlanInterface.findById(vlanInterfaceId);
  if (!vli) return { ok: false, deployments: [], warnings, error: 'Peer record not found.' };

  const target = await Vlan.findById(targetVlanId);
  if (!target) return { ok: false, deployments: [], warnings, error: 'Target VLAN not found.' };

  const vi = await VirtualInterface.findById(vli.virtualInterface);
  if (!vi) return { ok: false, deployments: [], warnings, error: 'The peer record has no connection.' };
  if (String(target.infrastructure) !== String(vi.infrastructure)) {
    return { ok: false, deployments: [], warnings, error: 'The target VLAN is on a different infrastructure.' };
  }
  if (String(vli.vlan) === String(target._id)) {
    return { ok: false, deployments: [], warnings, error: 'The peer is already on that VLAN.' };
  }

  const org = await Organization.findById(vi.organization).select('asn name').lean();

  // Allocate on the target VLAN *before* releasing the old addresses, so a full
  // pool leaves the member where they are rather than stranded.
  const allocation = await ipam.allocateForInterface(target._id as Types.ObjectId, vli._id as Types.ObjectId, {
    wantV4: vli.ipv4Enabled,
    wantV6: vli.ipv6Enabled,
    asn: (org as any)?.asn,
  });

  if (vli.ipv4Enabled && !allocation.ipv4) {
    return { ok: false, deployments: [], warnings, error: `No free IPv4 address in ${target.name}.` };
  }
  if (vli.ipv6Enabled && !allocation.ipv6) {
    // Give back the v4 we just took so the move is all-or-nothing.
    if (allocation.ipv4) await ipam.release(allocation.ipv4.id);
    return { ok: false, deployments: [], warnings, error: `No free IPv6 address in ${target.name}.` };
  }
  warnings.push(...allocation.errors);

  const oldV4 = vli.ipv4Address;
  const oldV6 = vli.ipv6Address;

  vli.vlan = target._id as Types.ObjectId;
  if (allocation.ipv4) vli.ipv4Address = allocation.ipv4.id;
  if (allocation.ipv6) vli.ipv6Address = allocation.ipv6.id;
  if (opts.promote) vli.rsMode = 'normal';
  await vli.save();

  if (oldV4) await ipam.release(oldV4);
  if (oldV6) await ipam.release(oldV6);

  let deployments: DeployResult[] = [];
  if (opts.deploy !== false) {
    deployments = await deployInfrastructure(vi.infrastructure as Types.ObjectId, { actor: opts.actor });
  }

  await logAudit({
    actor: opts.actor,
    action: 'provision.move_vlan',
    resource: 'VlanInterface',
    resourceId: String(vli._id),
    after: { vlan: target.number, ipv4: allocation.ipv4?.address, ipv6: allocation.ipv6?.address, promoted: !!opts.promote },
  });

  return {
    ok: true,
    ipv4: allocation.ipv4?.address,
    ipv6: allocation.ipv6?.address,
    deployments,
    warnings,
  };
};

/**
 * Free switch ports on one infrastructure, for the provisioning form's port
 * picker. Ports already claimed by a member connection or a core link are
 * excluded.
 */
export const listAvailablePorts = async (
  infrastructureId: string | Types.ObjectId,
  opts: { speed?: number } = {}
): Promise<Array<{ id: string; name: string; switchName: string; switchId: string; speed?: number; media?: string }>> => {
  const switches = await Switch.find({ infrastructure: infrastructureId, active: true })
    .select('name')
    .lean();
  if (!switches.length) return [];

  const filter: any = {
    switch: { $in: switches.map((s: any) => s._id) },
    status: 'free',
    type: 'peering',
  };
  if (opts.speed) filter.speed = opts.speed;

  const ports = await SwitchPort.find(filter).select('name switch speed media').sort({ name: 1 }).lean();

  // Belt and braces: a port could be marked free while a PhysicalInterface or
  // CoreLink still references it.
  const claimed = await PhysicalInterface.find({ switchPort: { $in: ports.map((p: any) => p._id) } })
    .select('switchPort')
    .lean();
  const claimedIds = new Set(claimed.map((c: any) => String(c.switchPort)));

  const switchName = new Map(switches.map((s: any) => [String(s._id), s.name]));

  return ports
    .filter((p: any) => !claimedIds.has(String(p._id)))
    .map((p: any) => ({
      id: String(p._id),
      name: p.name,
      switchId: String(p.switch),
      switchName: switchName.get(String(p.switch)) || '',
      speed: p.speed,
      media: p.media,
    }));
};

export default {
  provisionConnection,
  deprovisionConnection,
  moveToVlan,
  listAvailablePorts,
};
