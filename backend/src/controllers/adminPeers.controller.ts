import { Request, Response } from 'express';
import {
  Organization,
  Infrastructure,
  Vlan,
  Switch,
  SwitchPort,
  VirtualInterface,
  PhysicalInterface,
  VlanInterface,
  IpAddress,
  MacAddress,
} from '../models';
import provision from '../services/provision.service';
import ipam from '../services/ipam.service';
import { logAudit } from '../services/audit.service';
import { normalizeMac } from '../utils/mac.util';
import { pick, str, int, bool, oneOf, objectId, objectIds, param, Validator } from '../utils/validate.util';

/**
 * Member connections and peers.
 *
 * The provisioning endpoint is the one that matters: it walks the whole chain
 * (switch port → connection → peer → addresses → filters → route servers) so
 * creating a member puts them on the fabric in one action.
 */

const ok = (res: Response, data: any, status = 200): void => {
  res.status(status).json({ success: true, data });
};
const bad = (res: Response, error: string, status = 400): void => {
  res.status(status).json({ success: false, error });
};

// ══════════════════════════════════════════════════════════════════════════════
// Provisioning
// ══════════════════════════════════════════════════════════════════════════════

/** Free peering ports on one infrastructure, for the provisioning form. */
export const availablePorts = async (req: Request, res: Response): Promise<void> => {
  try {
    const infra = objectId(req.params.infrastructureId);
    if (!infra) return bad(res, 'Invalid infrastructure id.');
    const speed = int(req.query?.speed, { min: 1 });
    ok(res, await provision.listAvailablePorts(infra, { speed }));
  } catch {
    bad(res, 'Failed to load available ports.', 500);
  }
};

/**
 * Everything the provisioning form needs in one request: fabrics, their VLANs
 * and free ports, plus the speeds actually available.
 */
export const provisioningOptions = async (_req: Request, res: Response): Promise<void> => {
  try {
    const infrastructures = await Infrastructure.find({ enabled: true }).sort({ order: 1, name: 1 }).lean();

    const options = await Promise.all(
      infrastructures.map(async (infra: any) => {
        const [vlans, ports] = await Promise.all([
          Vlan.find({ infrastructure: infra._id, enabled: true }).sort({ order: 1, number: 1 }).lean(),
          provision.listAvailablePorts(infra._id),
        ]);
        return {
          id: String(infra._id),
          name: infra.name,
          shortname: infra.shortname,
          asn: infra.asn,
          mtu: infra.mtu,
          vlans: vlans.map((v: any) => ({
            id: String(v._id),
            name: v.name,
            number: v.number,
            isQuarantine: v.isQuarantine,
            isPrivate: v.isPrivate,
            ipv4Prefix: v.ipv4Prefix,
            ipv6Prefix: v.ipv6Prefix,
          })),
          freePorts: ports,
          // Distinct speeds among free ports, so the form only offers real options.
          speeds: Array.from(new Set(ports.map((p) => p.speed).filter(Boolean))).sort(
            (a, b) => Number(a) - Number(b)
          ),
        };
      })
    );

    ok(res, options);
  } catch {
    bad(res, 'Failed to load provisioning options.', 500);
  }
};

/**
 * Provision a connection end to end.
 *
 * Returns the per-step outcome even on success, because the later steps
 * (PeeringDB, IRRDB, deploy) can partly fail while the connection itself is
 * fine — the operator needs to see which.
 */
export const provisionConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = new Validator();
    const organizationId = v.require(objectId(req.body?.organizationId), 'Customer');
    const infrastructureId = v.require(objectId(req.body?.infrastructureId), 'Infrastructure');
    const speed = v.require(int(req.body?.speed, { min: 1 }), 'Port speed in Mbit/s');

    const switchPortIds = objectIds(req.body?.switchPortIds);
    if (!switchPortIds.length) v.add('Select at least one switch port.');
    if (switchPortIds.length > 16) v.add('A LAG of more than 16 ports is not supported.');

    if (v.failed) return bad(res, v.message);

    const result = await provision.provisionConnection({
      organizationId: organizationId!,
      infrastructureId: infrastructureId!,
      vlanId: objectId(req.body?.vlanId),
      switchPortIds,
      speed: speed!,
      name: str(req.body?.name),
      quarantine: bool(req.body?.quarantine),
      lagFraming: oneOf(req.body?.lagFraming, ['none', 'lacp', 'static'] as const),
      channelGroup: int(req.body?.channelGroup, { min: 1 }),
      mtu: int(req.body?.mtu, { min: 1280, max: 9216 }),
      ipv4: bool(req.body?.ipv4),
      ipv6: bool(req.body?.ipv6),
      rsClient: bool(req.body?.rsClient),
      rsMode: oneOf(req.body?.rsMode, ['normal', 'passive', 'disabled'] as const),
      irrdbFilter: bool(req.body?.irrdbFilter),
      rpkiFilter: bool(req.body?.rpkiFilter),
      maxPrefixesV4: int(req.body?.maxPrefixesV4, { min: 0 }),
      maxPrefixesV6: int(req.body?.maxPrefixesV6, { min: 0 }),
      requestedIpv4: str(req.body?.requestedIpv4),
      requestedIpv6: str(req.body?.requestedIpv6),
      syncPeeringDb: bool(req.body?.syncPeeringDb) !== false,
      refreshIrrdb: bool(req.body?.refreshIrrdb) !== false,
      deploy: bool(req.body?.deploy) !== false,
      actor: req.user?.email,
    });

    if (!result.ok) return bad(res, result.error || 'Provisioning failed.');
    ok(res, result, 201);
  } catch (err: any) {
    bad(res, err?.message || 'Provisioning failed.', 500);
  }
};

export const deprovisionConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await provision.deprovisionConnection(param(req.params.id), {
      actor: req.user?.email,
      deploy: bool(req.body?.deploy) !== false,
    });
    if (!result.ok) return bad(res, result.error || 'Deprovisioning failed.', 404);
    ok(res, result);
  } catch (err: any) {
    bad(res, err?.message || 'Deprovisioning failed.', 500);
  }
};

/** Move a peer between VLANs — normally quarantine to the production LAN. */
export const movePeerVlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetVlanId = objectId(req.body?.vlanId);
    if (!targetVlanId) return bad(res, 'Target VLAN is required.');

    const result = await provision.moveToVlan(param(req.params.vlanInterfaceId), targetVlanId, {
      actor: req.user?.email,
      deploy: bool(req.body?.deploy) !== false,
      promote: bool(req.body?.promote) === true,
    });
    if (!result.ok) return bad(res, result.error || 'Move failed.');
    ok(res, result);
  } catch (err: any) {
    bad(res, err?.message || 'Move failed.', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// Connections (virtual interfaces)
// ══════════════════════════════════════════════════════════════════════════════

export const listConnections = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: any = {};
    const org = objectId(req.query?.organization);
    const infra = objectId(req.query?.infrastructure);
    if (org) filter.organization = org;
    if (infra) filter.infrastructure = infra;

    const rows = await VirtualInterface.find(filter)
      .populate('organization', 'name asn status')
      .populate('infrastructure', 'name shortname')
      .sort({ createdAt: -1 })
      .lean();

    const ids = rows.map((r: any) => r._id);
    const [pis, vlis] = await Promise.all([
      PhysicalInterface.find({ virtualInterface: { $in: ids } })
        .populate({ path: 'switchPort', select: 'name switch speed', populate: { path: 'switch', select: 'name cabinet facility', populate: [{ path: 'cabinet', select: 'name' }, { path: 'facility', select: 'name' }] } })
        .lean(),
      VlanInterface.find({ virtualInterface: { $in: ids } })
        .populate('vlan', 'name number isQuarantine')
        .lean(),
    ]);

    // Resolve allocated addresses for display.
    const addrIds = vlis.flatMap((v: any) => [v.ipv4Address, v.ipv6Address]).filter(Boolean);
    const addrs = addrIds.length ? await IpAddress.find({ _id: { $in: addrIds } }).select('address family').lean() : [];
    const addrById = new Map(addrs.map((a: any) => [String(a._id), a.address]));

    const pisByVi = new Map<string, any[]>();
    for (const p of pis as any[]) {
      const key = String(p.virtualInterface);
      pisByVi.set(key, [...(pisByVi.get(key) || []), p]);
    }
    const vlisByVi = new Map<string, any[]>();
    for (const v of vlis as any[]) {
      const key = String(v.virtualInterface);
      vlisByVi.set(key, [...(vlisByVi.get(key) || []), v]);
    }

    ok(
      res,
      rows.map((r: any) => {
        const ports = pisByVi.get(String(r._id)) || [];
        const peers = vlisByVi.get(String(r._id)) || [];
        return {
          ...r,
          ports: ports.map((p: any) => ({
            id: String(p._id),
            speed: p.speed,
            status: p.status,
            portName: p.switchPort?.name || '',
            switchName: p.switchPort?.switch?.name || '',
            cabinetName: p.switchPort?.switch?.cabinet?.name || '',
            facilityName: p.switchPort?.switch?.facility?.name || '',
            xconnectRef: p.xconnectRef,
          })),
          // Total capacity across the LAG, which is what upgrade decisions use.
          capacityMbps: ports.reduce((n: number, p: any) => n + (p.speed || 0), 0),
          peers: peers.map((p: any) => ({
            id: String(p._id),
            vlan: p.vlan ? { id: String(p.vlan._id), name: p.vlan.name, number: p.vlan.number, isQuarantine: p.vlan.isQuarantine } : null,
            ipv4: p.ipv4Address ? addrById.get(String(p.ipv4Address)) : null,
            ipv6: p.ipv6Address ? addrById.get(String(p.ipv6Address)) : null,
            rsClient: p.rsClient,
            rsMode: p.rsMode,
            enabled: p.enabled,
          })),
        };
      })
    );
  } catch {
    bad(res, 'Failed to load connections.', 500);
  }
};

const VI_FIELDS = ['name', 'channelGroup', 'lagFraming', 'mtu', 'billingSpeed', 'isReseller', 'reseller', 'notes'] as const;

export const updateConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = pick(req.body, VI_FIELDS);
    const updated = await VirtualInterface.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true });
    if (!updated) return bad(res, 'Connection not found.', 404);

    await logAudit({
      actor: req.user?.email,
      action: 'peers.connection.update',
      resource: 'VirtualInterface',
      resourceId: String(req.params.id),
      after: payload,
    });
    ok(res, updated);
  } catch {
    bad(res, 'Failed to update the connection.', 500);
  }
};

// ── Physical interfaces (cross-connects on the LAG) ──

const PI_FIELDS = [
  'speed',
  'duplex',
  'status',
  'autoNegotiation',
  'xconnectRef',
  'patchPanelPort',
  'fanoutParent',
  'notes',
] as const;

export const addConnectionPort = async (req: Request, res: Response): Promise<void> => {
  try {
    const switchPortId = objectId(req.body?.switchPortId);
    if (!switchPortId) return bad(res, 'Switch port is required.');

    const vi = await VirtualInterface.findById(req.params.id);
    if (!vi) return bad(res, 'Connection not found.', 404);

    const port = await SwitchPort.findById(switchPortId);
    if (!port) return bad(res, 'Switch port not found.', 404);
    if (port.status !== 'free' && port.status !== 'reserved') {
      return bad(res, `That switch port is ${port.status}, not free.`);
    }

    // The port has to be on the same fabric as the connection.
    const sw = await Switch.findById(port.switch).select('infrastructure name').lean();
    if (!sw || String((sw as any).infrastructure) !== String(vi.infrastructure)) {
      return bad(res, 'That switch port is not on the same infrastructure as this connection.');
    }

    const payload = pick(req.body, PI_FIELDS) as Record<string, any>;
    payload.virtualInterface = vi._id;
    payload.switchPort = port._id;
    if (payload.speed === undefined) payload.speed = port.speed || 10000;

    const created = await PhysicalInterface.create(payload);
    await SwitchPort.updateOne({ _id: port._id }, { $set: { status: 'assigned' } });

    await logAudit({
      actor: req.user?.email,
      action: 'peers.port.add',
      resource: 'VirtualInterface',
      resourceId: String(vi._id),
      after: { switchPort: port.name, switch: (sw as any).name, speed: payload.speed },
    });
    ok(res, created, 201);
  } catch (err: any) {
    if (err?.code === 11000) {
      return bad(res, 'That switch port is already claimed by another connection.', 409);
    }
    bad(res, 'Failed to add the port.', 500);
  }
};

export const updateConnectionPort = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = pick(req.body, PI_FIELDS);
    const updated = await PhysicalInterface.findOneAndUpdate(
      { _id: req.params.portId, virtualInterface: req.params.id },
      { $set: payload },
      { new: true }
    );
    if (!updated) return bad(res, 'Port not found on this connection.', 404);

    await logAudit({
      actor: req.user?.email,
      action: 'peers.port.update',
      resource: 'PhysicalInterface',
      resourceId: String(req.params.portId),
      after: payload,
    });
    ok(res, updated);
  } catch {
    bad(res, 'Failed to update the port.', 500);
  }
};

export const removeConnectionPort = async (req: Request, res: Response): Promise<void> => {
  try {
    const pi = await PhysicalInterface.findOne({ _id: req.params.portId, virtualInterface: req.params.id });
    if (!pi) return bad(res, 'Port not found on this connection.', 404);

    // Removing the last port would leave a connection with no path to the
    // fabric while its peer stays in the route-server config.
    const remaining = await PhysicalInterface.countDocuments({ virtualInterface: req.params.id });
    if (remaining <= 1) {
      return bad(
        res,
        'This is the only port on the connection. Deprovision the whole connection instead of removing its last port.'
      );
    }

    await PhysicalInterface.deleteOne({ _id: pi._id });
    await SwitchPort.updateOne({ _id: pi.switchPort }, { $set: { status: 'free' } });

    await logAudit({
      actor: req.user?.email,
      action: 'peers.port.remove',
      resource: 'PhysicalInterface',
      resourceId: String(req.params.portId),
    });
    ok(res, { removed: true });
  } catch {
    bad(res, 'Failed to remove the port.', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// Peers (VLAN interfaces)
// ══════════════════════════════════════════════════════════════════════════════

const VLI_FIELDS = [
  'ipv4Enabled',
  'ipv6Enabled',
  'ipv4Hostname',
  'ipv6Hostname',
  'ipv4CanPingMonitor',
  'ipv6CanPingMonitor',
  'ipv4CanBgpMonitor',
  'ipv6CanBgpMonitor',
  'rsClient',
  'rsMode',
  'irrdbFilter',
  'rpkiFilter',
  'asMacro',
  'asMacroV6',
  'maxPrefixesV4',
  'maxPrefixesV6',
  'peerAsn',
  'as112Client',
  'busyHost',
  'configExtrasV4',
  'configExtrasV6',
  'notes',
  'enabled',
] as const;

/** MD5 secrets are write-only through this API and never read back. */
const VLI_SECRET_FIELDS = ['ipv4BgpMd5', 'ipv6BgpMd5'] as const;

export const listPeers = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: any = {};
    const vlan = objectId(req.query?.vlan);
    const vi = objectId(req.query?.virtualInterface);
    if (vlan) filter.vlan = vlan;
    if (vi) filter.virtualInterface = vi;
    if (req.query?.rsClient !== undefined) {
      const rsClient = bool(req.query.rsClient);
      if (rsClient !== undefined) filter.rsClient = rsClient;
    }

    const rows = await VlanInterface.find(filter)
      .populate('vlan', 'name number isQuarantine')
      .populate({
        path: 'virtualInterface',
        select: 'organization infrastructure name',
        populate: [
          { path: 'organization', select: 'name asn status irrAsSet infoPrefixes4 infoPrefixes6' },
          { path: 'infrastructure', select: 'name shortname' },
        ],
      })
      .sort({ createdAt: -1 })
      .lean();

    const addrIds = rows.flatMap((r: any) => [r.ipv4Address, r.ipv6Address]).filter(Boolean);
    const addrs = addrIds.length ? await IpAddress.find({ _id: { $in: addrIds } }).select('address').lean() : [];
    const addrById = new Map(addrs.map((a: any) => [String(a._id), a.address]));

    const macCounts = rows.length
      ? await MacAddress.aggregate([
          { $match: { vlanInterface: { $in: rows.map((r: any) => r._id) } } },
          { $group: { _id: '$vlanInterface', n: { $sum: 1 } } },
        ])
      : [];
    const macs = new Map(macCounts.map((m: any) => [String(m._id), m.n]));

    ok(
      res,
      rows.map((r: any) => ({
        ...r,
        // The stored secrets stay server-side; the UI only needs to know they exist.
        ipv4BgpMd5: undefined,
        ipv6BgpMd5: undefined,
        ipv4Address: r.ipv4Address ? { id: String(r.ipv4Address), address: addrById.get(String(r.ipv4Address)) } : null,
        ipv6Address: r.ipv6Address ? { id: String(r.ipv6Address), address: addrById.get(String(r.ipv6Address)) } : null,
        macCount: macs.get(String(r._id)) || 0,
      }))
    );
  } catch {
    bad(res, 'Failed to load peers.', 500);
  }
};

export const updatePeer = async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await VlanInterface.findById(req.params.id);
    if (!existing) return bad(res, 'Peer not found.', 404);

    const payload = pick(req.body, VLI_FIELDS) as Record<string, any>;

    // MD5 secrets are set-or-clear only; an empty string removes the password.
    for (const field of VLI_SECRET_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
        const value = req.body[field];
        payload[field] = value === null || value === '' ? '' : String(value);
      }
    }

    const before = {
      rsClient: existing.rsClient,
      rsMode: existing.rsMode,
      irrdbFilter: existing.irrdbFilter,
      rpkiFilter: existing.rpkiFilter,
      enabled: existing.enabled,
    };

    const updated = await VlanInterface.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true });

    const audited = { ...payload };
    for (const field of VLI_SECRET_FIELDS) if (audited[field] !== undefined) audited[field] = '(changed)';

    await logAudit({
      actor: req.user?.email,
      action: 'peers.peer.update',
      resource: 'VlanInterface',
      resourceId: String(req.params.id),
      before,
      after: audited,
    });

    // Route servers still carry the old policy until a deploy runs.
    ok(res, { peer: updated, note: 'Deploy the route servers to apply this change.' });
  } catch {
    bad(res, 'Failed to update the peer.', 500);
  }
};

/** Reassign a peer's address, e.g. to give a member a memorable one. */
export const reassignPeerAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const family = int(req.body?.family, { min: 4, max: 6 });
    if (family !== 4 && family !== 6) return bad(res, 'Family must be 4 or 6.');

    const address = str(req.body?.address);
    const vli = await VlanInterface.findById(req.params.id);
    if (!vli) return bad(res, 'Peer not found.', 404);

    const current = family === 4 ? vli.ipv4Address : vli.ipv6Address;

    // Claim the new address before releasing the old one, so a clash leaves the
    // peer on its existing address rather than with none.
    let claimed;
    try {
      claimed = address
        ? await ipam.allocateSpecific(vli.vlan, address, vli._id as any)
        : await ipam.allocate(vli.vlan, family as 4 | 6, vli._id as any);
    } catch (err: any) {
      return bad(res, err?.message || 'Could not claim that address.');
    }
    if (!claimed) return bad(res, `No free IPv${family} address available in this VLAN.`);

    if (family === 4) vli.ipv4Address = claimed.id;
    else vli.ipv6Address = claimed.id;
    await vli.save();

    if (current) await ipam.release(current);

    await logAudit({
      actor: req.user?.email,
      action: 'peers.peer.reassign_address',
      resource: 'VlanInterface',
      resourceId: String(vli._id),
      after: { family, address: claimed.address },
    });
    ok(res, { family, address: claimed.address, note: 'Deploy the route servers to apply this change.' });
  } catch (err: any) {
    bad(res, err?.message || 'Failed to reassign the address.', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// MAC addresses
// ══════════════════════════════════════════════════════════════════════════════

export const listMacs = async (req: Request, res: Response): Promise<void> => {
  try {
    ok(res, await MacAddress.find({ vlanInterface: req.params.id }).sort({ address: 1 }).lean());
  } catch {
    bad(res, 'Failed to load MAC addresses.', 500);
  }
};

export const addMac = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!(await VlanInterface.exists({ _id: req.params.id }))) return bad(res, 'Peer not found.', 404);

    const raw = str(req.body?.address);
    if (!raw) return bad(res, 'MAC address is required.');

    let normalised: string;
    try {
      normalised = normalizeMac(raw);
    } catch {
      return bad(res, `"${raw}" is not a valid MAC address.`);
    }

    // A multicast or broadcast address can never be a peer's own MAC.
    const firstOctet = parseInt(normalised.slice(0, 2), 16);
    if ((firstOctet & 0x01) === 0x01) {
      return bad(res, 'That is a multicast or broadcast address, so it cannot belong to a peer interface.');
    }

    const created = await MacAddress.create({
      vlanInterface: req.params.id,
      address: normalised,
      source: oneOf(req.body?.source, ['declared', 'learned', 'imported'] as const) || 'declared',
      approved: bool(req.body?.approved) === true,
      notes: str(req.body?.notes) || '',
    });

    await logAudit({
      actor: req.user?.email,
      action: 'peers.mac.add',
      resource: 'VlanInterface',
      resourceId: String(req.params.id),
      after: { address: normalised },
    });
    ok(res, created, 201);
  } catch (err: any) {
    if (err?.code === 11000) return bad(res, 'That MAC address is already recorded for this peer.', 409);
    bad(res, 'Failed to add the MAC address.', 500);
  }
};

export const updateMac = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = pick(req.body, ['approved', 'notes', 'source'] as const);
    const updated = await MacAddress.findOneAndUpdate(
      { _id: req.params.macId, vlanInterface: req.params.id },
      { $set: payload },
      { new: true }
    );
    if (!updated) return bad(res, 'MAC address not found.', 404);
    ok(res, updated);
  } catch {
    bad(res, 'Failed to update the MAC address.', 500);
  }
};

export const deleteMac = async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await MacAddress.findOneAndDelete({ _id: req.params.macId, vlanInterface: req.params.id });
    if (!deleted) return bad(res, 'MAC address not found.', 404);
    await logAudit({
      actor: req.user?.email,
      action: 'peers.mac.delete',
      resource: 'MacAddress',
      resourceId: String(req.params.macId),
    });
    ok(res, { deleted: true });
  } catch {
    bad(res, 'Failed to delete the MAC address.', 500);
  }
};

/** Global MAC lookup — the question asked during L2 troubleshooting. */
export const findMac = async (req: Request, res: Response): Promise<void> => {
  try {
    const raw = str(req.query?.address);
    if (!raw) return bad(res, 'An address to search for is required.');

    let normalised: string;
    try {
      normalised = normalizeMac(raw);
    } catch {
      return bad(res, `"${raw}" is not a valid MAC address.`);
    }

    const matches = await MacAddress.find({ address: normalised })
      .populate({
        path: 'vlanInterface',
        select: 'virtualInterface vlan',
        populate: [
          {
            path: 'virtualInterface',
            select: 'organization',
            populate: { path: 'organization', select: 'name asn' },
          },
          { path: 'vlan', select: 'name number' },
        ],
      })
      .lean();

    ok(res, { address: normalised, matches });
  } catch {
    bad(res, 'MAC lookup failed.', 500);
  }
};

/** Generate switch provisioning template for a connection. */
export const switchConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { generateForConnection } = await import('../services/switchTemplate.service');
    const vendor = (req.query?.vendor as any) || undefined;
    const result = await generateForConnection(param(req.params.id), { vendor });

    if (req.query?.download === 'true') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="switch-config-${req.params.id}.txt"`);
      res.send(result.config);
    } else {
      ok(res, result);
    }
  } catch (err: any) {
    bad(res, err?.message || 'Failed to generate switch config.', /not found/i.test(err?.message || '') ? 404 : 500);
  }
};

export default {
  availablePorts,
  provisioningOptions,
  provisionConnection,
  deprovisionConnection,
  movePeerVlan,
  listConnections,
  updateConnection,
  addConnectionPort,
  updateConnectionPort,
  removeConnectionPort,
  listPeers,
  updatePeer,
  reassignPeerAddress,
  listMacs,
  addMac,
  updateMac,
  deleteMac,
  findMac,
  switchConfig,
};
