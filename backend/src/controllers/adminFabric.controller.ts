import { Request, Response } from 'express';
import {
  Infrastructure,
  Facility,
  Cabinet,
  Switch,
  SwitchPort,
  PhysicalInterface,
  CoreLink,
  PatchPanel,
  Vlan,
  RouteServer,
} from '../models';
import { getRackElevation, checkPlacement, syncDeviceFacility } from '../services/rack.service';
import { logAudit } from '../services/audit.service';
import { pick, str, int, oneOf, objectId, param, Validator } from '../utils/validate.util';

/**
 * Physical fabric administration: the Org → Facility → Cabinet → Unit → Device →
 * Port hierarchy, plus the Infrastructure that ties a metro fabric together.
 *
 * Every write names its allowed fields explicitly rather than spreading
 * `req.body`, because these records drive switch and route-server config.
 */

const ok = (res: Response, data: any, status = 200): void => {
  res.status(status).json({ success: true, data });
};
const bad = (res: Response, error: string, status = 400): void => {
  res.status(status).json({ success: false, error });
};

// ══════════════════════════════════════════════════════════════════════════════
// Infrastructures
// ══════════════════════════════════════════════════════════════════════════════

export const listInfrastructures = async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await Infrastructure.find().sort({ order: 1, name: 1 }).lean();

    // Counts make the list useful on its own instead of forcing a drill-down.
    const ids = rows.map((r: any) => r._id);
    const [switchCounts, vlanCounts, rsCounts] = await Promise.all([
      Switch.aggregate([{ $match: { infrastructure: { $in: ids } } }, { $group: { _id: '$infrastructure', n: { $sum: 1 } } }]),
      Vlan.aggregate([{ $match: { infrastructure: { $in: ids } } }, { $group: { _id: '$infrastructure', n: { $sum: 1 } } }]),
      RouteServer.aggregate([{ $match: { infrastructure: { $in: ids } } }, { $group: { _id: '$infrastructure', n: { $sum: 1 } } }]),
    ]);
    const asMap = (rowsIn: any[]) => new Map(rowsIn.map((r) => [String(r._id), r.n]));
    const sw = asMap(switchCounts);
    const vl = asMap(vlanCounts);
    const rs = asMap(rsCounts);

    ok(
      res,
      rows.map((r: any) => ({
        ...r,
        switchCount: sw.get(String(r._id)) || 0,
        vlanCount: vl.get(String(r._id)) || 0,
        routeServerCount: rs.get(String(r._id)) || 0,
      }))
    );
  } catch {
    bad(res, 'Failed to load infrastructures.', 500);
  }
};

const INFRA_FIELDS = [
  'name',
  'shortname',
  'asn',
  'peeringLanName',
  'location',
  'additionalLocations',
  'ixfId',
  'peeringdbIxId',
  'peeringdbIxLanId',
  'mtu',
  'isPrimary',
  'nocEmail',
  'nocPhone',
  'nocWebsite',
  'notes',
  'enabled',
  'order',
] as const;

export const createInfrastructure = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = new Validator();
    const name = v.require(str(req.body?.name), 'Name');
    const shortname = v.require(str(req.body?.shortname), 'Short name');
    const asn = v.require(int(req.body?.asn, { min: 1, max: 4294967294 }), 'ASN');
    if (shortname && !/^[a-z0-9_-]+$/.test(shortname)) {
      v.add('Short name may only contain lowercase letters, digits, - and _.');
    }
    if (v.failed) return bad(res, v.message);

    const payload = pick(req.body, INFRA_FIELDS);
    payload.name = name;
    payload.shortname = shortname!.toLowerCase();
    payload.asn = asn;

    const created = await Infrastructure.create(payload);
    await logAudit({
      actor: req.user?.email,
      action: 'fabric.infrastructure.create',
      resource: 'Infrastructure',
      resourceId: String(created._id),
      after: { name: created.name, asn: created.asn },
    });
    ok(res, created, 201);
  } catch (err: any) {
    if (err?.code === 11000) return bad(res, 'An infrastructure with that short name already exists.', 409);
    bad(res, 'Failed to create the infrastructure.', 500);
  }
};

export const updateInfrastructure = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = pick(req.body, INFRA_FIELDS);
    if (payload.shortname) {
      const s = String(payload.shortname).toLowerCase();
      if (!/^[a-z0-9_-]+$/.test(s)) return bad(res, 'Short name may only contain lowercase letters, digits, - and _.');
      payload.shortname = s;
    }
    const before = await Infrastructure.findById(req.params.id).lean();
    if (!before) return bad(res, 'Infrastructure not found.', 404);

    const updated = await Infrastructure.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true });
    await logAudit({
      actor: req.user?.email,
      action: 'fabric.infrastructure.update',
      resource: 'Infrastructure',
      resourceId: String(req.params.id),
      before,
      after: payload,
    });
    ok(res, updated);
  } catch (err: any) {
    if (err?.code === 11000) return bad(res, 'An infrastructure with that short name already exists.', 409);
    bad(res, 'Failed to update the infrastructure.', 500);
  }
};

export const deleteInfrastructure = async (req: Request, res: Response): Promise<void> => {
  try {
    // Refuse while anything still hangs off it — a cascade here would silently
    // delete switches, VLANs and allocated addresses.
    const [switches, vlans, routeServers] = await Promise.all([
      Switch.countDocuments({ infrastructure: req.params.id }),
      Vlan.countDocuments({ infrastructure: req.params.id }),
      RouteServer.countDocuments({ infrastructure: req.params.id }),
    ]);
    if (switches || vlans || routeServers) {
      return bad(
        res,
        `This infrastructure still has ${switches} switch(es), ${vlans} VLAN(s) and ${routeServers} route server(s). Remove or reassign those first.`,
        409
      );
    }
    await Infrastructure.findByIdAndDelete(req.params.id);
    await logAudit({
      actor: req.user?.email,
      action: 'fabric.infrastructure.delete',
      resource: 'Infrastructure',
      resourceId: String(req.params.id),
    });
    ok(res, { deleted: true });
  } catch {
    bad(res, 'Failed to delete the infrastructure.', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// Facilities (data centres)
// ══════════════════════════════════════════════════════════════════════════════

const FACILITY_FIELDS = [
  'name',
  'shortname',
  'infrastructure',
  'provider',
  'address1',
  'address2',
  'city',
  'state',
  'postcode',
  'country',
  'latitude',
  'longitude',
  'peeringdbFacId',
  'clli',
  'npanxx',
  'supportEmail',
  'supportPhone',
  'ticketUrl',
  'cageRef',
  'notes',
  'active',
  'order',
] as const;

export const listFacilities = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: any = {};
    const infra = objectId(req.query?.infrastructure);
    if (infra) filter.infrastructure = infra;

    const rows = await Facility.find(filter).sort({ order: 1, name: 1 }).lean();
    const ids = rows.map((r: any) => r._id);
    const [cabinetCounts, deviceCounts] = await Promise.all([
      Cabinet.aggregate([{ $match: { facility: { $in: ids } } }, { $group: { _id: '$facility', n: { $sum: 1 } } }]),
      Switch.aggregate([{ $match: { facility: { $in: ids } } }, { $group: { _id: '$facility', n: { $sum: 1 } } }]),
    ]);
    const cab = new Map(cabinetCounts.map((r: any) => [String(r._id), r.n]));
    const dev = new Map(deviceCounts.map((r: any) => [String(r._id), r.n]));

    ok(
      res,
      rows.map((r: any) => ({
        ...r,
        cabinetCount: cab.get(String(r._id)) || 0,
        deviceCount: dev.get(String(r._id)) || 0,
      }))
    );
  } catch {
    bad(res, 'Failed to load facilities.', 500);
  }
};

export const createFacility = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = new Validator();
    const name = v.require(str(req.body?.name), 'Name');
    const shortname = v.require(str(req.body?.shortname), 'Short name');
    if (shortname && !/^[a-z0-9_-]+$/.test(shortname.toLowerCase())) {
      v.add('Short name may only contain lowercase letters, digits, - and _.');
    }
    if (v.failed) return bad(res, v.message);

    const payload = pick(req.body, FACILITY_FIELDS);
    payload.name = name;
    payload.shortname = shortname!.toLowerCase();

    const created = await Facility.create(payload);
    await logAudit({
      actor: req.user?.email,
      action: 'fabric.facility.create',
      resource: 'Facility',
      resourceId: String(created._id),
      after: { name: created.name },
    });
    ok(res, created, 201);
  } catch (err: any) {
    if (err?.code === 11000) return bad(res, 'A facility with that short name already exists.', 409);
    bad(res, 'Failed to create the facility.', 500);
  }
};

export const updateFacility = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = pick(req.body, FACILITY_FIELDS);
    if (payload.shortname) payload.shortname = String(payload.shortname).toLowerCase();

    const updated = await Facility.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true });
    if (!updated) return bad(res, 'Facility not found.', 404);

    // Cabinets may have moved facility, so keep the denormalised device link right.
    const cabinets = await Cabinet.find({ facility: updated._id }).select('_id').lean();
    if (cabinets.length) {
      await Switch.updateMany(
        { cabinet: { $in: cabinets.map((c: any) => c._id) } },
        { $set: { facility: updated._id } }
      );
    }

    await logAudit({
      actor: req.user?.email,
      action: 'fabric.facility.update',
      resource: 'Facility',
      resourceId: String(req.params.id),
      after: payload,
    });
    ok(res, updated);
  } catch (err: any) {
    if (err?.code === 11000) return bad(res, 'A facility with that short name already exists.', 409);
    bad(res, 'Failed to update the facility.', 500);
  }
};

export const deleteFacility = async (req: Request, res: Response): Promise<void> => {
  try {
    const [cabinets, panels] = await Promise.all([
      Cabinet.countDocuments({ facility: req.params.id }),
      PatchPanel.countDocuments({ facility: req.params.id }),
    ]);
    if (cabinets || panels) {
      return bad(res, `This facility still has ${cabinets} cabinet(s) and ${panels} patch panel(s).`, 409);
    }
    await Facility.findByIdAndDelete(req.params.id);
    await logAudit({
      actor: req.user?.email,
      action: 'fabric.facility.delete',
      resource: 'Facility',
      resourceId: String(req.params.id),
    });
    ok(res, { deleted: true });
  } catch {
    bad(res, 'Failed to delete the facility.', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// Cabinets (racks)
// ══════════════════════════════════════════════════════════════════════════════

const CABINET_FIELDS = [
  'facility',
  'name',
  'uHeight',
  'uNumbering',
  'cageRef',
  'rowRef',
  'providerRef',
  'powerFeedA',
  'powerFeedB',
  'powerBudgetWatts',
  'notes',
  'active',
  'order',
] as const;

export const listCabinets = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: any = {};
    const facility = objectId(req.query?.facility);
    if (facility) filter.facility = facility;

    const rows = await Cabinet.find(filter).sort({ order: 1, name: 1 }).lean();
    const ids = rows.map((r: any) => r._id);
    const deviceRows = ids.length
      ? await Switch.find({ cabinet: { $in: ids } }).select('cabinet rackUnits rackPosition').lean()
      : [];

    // Used units per cabinet, so the list can show utilisation without pulling a
    // full elevation for each rack.
    const usedByCabinet = new Map<string, number>();
    for (const d of deviceRows as any[]) {
      if (!d.rackPosition) continue;
      const key = String(d.cabinet);
      usedByCabinet.set(key, (usedByCabinet.get(key) || 0) + Math.max(1, d.rackUnits || 1));
    }

    ok(
      res,
      rows.map((r: any) => {
        const used = usedByCabinet.get(String(r._id)) || 0;
        return {
          ...r,
          usedUnits: used,
          freeUnits: Math.max(0, r.uHeight - used),
          utilization: r.uHeight ? Math.round((used / r.uHeight) * 1000) / 10 : 0,
        };
      })
    );
  } catch {
    bad(res, 'Failed to load cabinets.', 500);
  }
};

export const createCabinet = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = new Validator();
    const facility = v.require(objectId(req.body?.facility), 'Facility');
    const name = v.require(str(req.body?.name), 'Name');
    if (v.failed) return bad(res, v.message);

    if (!(await Facility.exists({ _id: facility }))) return bad(res, 'Facility not found.', 404);

    const payload = pick(req.body, CABINET_FIELDS);
    payload.facility = facility;
    payload.name = name;

    const created = await Cabinet.create(payload);
    await logAudit({
      actor: req.user?.email,
      action: 'fabric.cabinet.create',
      resource: 'Cabinet',
      resourceId: String(created._id),
      after: { name: created.name },
    });
    ok(res, created, 201);
  } catch (err: any) {
    if (err?.code === 11000) return bad(res, 'A cabinet with that name already exists in this facility.', 409);
    bad(res, 'Failed to create the cabinet.', 500);
  }
};

export const updateCabinet = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = pick(req.body, CABINET_FIELDS);

    // Shrinking a rack below what is already installed would hide devices from
    // the elevation, so check before allowing it.
    const newHeight = int(payload.uHeight, { min: 1, max: 100 });
    if (newHeight !== undefined) {
      const devices = await Switch.find({ cabinet: req.params.id, rackPosition: { $ne: null } })
        .select('name rackPosition rackUnits')
        .lean();
      const tallest = devices.reduce((max: number, d: any) => {
        const top = (d.rackPosition || 0) + Math.max(1, d.rackUnits || 1) - 1;
        return top > max ? top : max;
      }, 0);
      if (tallest > newHeight) {
        return bad(
          res,
          `A device already occupies U${tallest}, so the cabinet cannot be shrunk to ${newHeight}U. Move it first.`
        );
      }
    }

    const updated = await Cabinet.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true });
    if (!updated) return bad(res, 'Cabinet not found.', 404);

    if (payload.facility) {
      await Switch.updateMany({ cabinet: updated._id }, { $set: { facility: updated.facility } });
    }

    await logAudit({
      actor: req.user?.email,
      action: 'fabric.cabinet.update',
      resource: 'Cabinet',
      resourceId: String(req.params.id),
      after: payload,
    });
    ok(res, updated);
  } catch (err: any) {
    if (err?.code === 11000) return bad(res, 'A cabinet with that name already exists in this facility.', 409);
    bad(res, 'Failed to update the cabinet.', 500);
  }
};

export const deleteCabinet = async (req: Request, res: Response): Promise<void> => {
  try {
    const devices = await Switch.countDocuments({ cabinet: req.params.id });
    if (devices) return bad(res, `This cabinet still holds ${devices} device(s).`, 409);

    await Cabinet.findByIdAndDelete(req.params.id);
    await logAudit({
      actor: req.user?.email,
      action: 'fabric.cabinet.delete',
      resource: 'Cabinet',
      resourceId: String(req.params.id),
    });
    ok(res, { deleted: true });
  } catch {
    bad(res, 'Failed to delete the cabinet.', 500);
  }
};

/** Unit-by-unit elevation for one rack, with free runs and any data problems. */
export const cabinetElevation = async (req: Request, res: Response): Promise<void> => {
  try {
    ok(res, await getRackElevation(param(req.params.id)));
  } catch (err: any) {
    bad(res, err?.message || 'Failed to build the rack elevation.', err?.message === 'Cabinet not found' ? 404 : 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// Devices (switches)
// ══════════════════════════════════════════════════════════════════════════════

const DEVICE_FIELDS = [
  'infrastructure',
  'cabinet',
  'name',
  'hostname',
  'deviceType',
  'vendor',
  'hardwareModel',
  'os',
  'osVersion',
  'serialNumber',
  'assetTag',
  'rackPosition',
  'rackUnits',
  'rackFace',
  'managementIpv4',
  'managementIpv6',
  'loopbackIpv4',
  'zabbixHostName',
  'consoleServer',
  'consolePort',
  'powerWatts',
  'notes',
  'active',
  'order',
] as const;

export const listDevices = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: any = {};
    const infra = objectId(req.query?.infrastructure);
    const facility = objectId(req.query?.facility);
    const cabinet = objectId(req.query?.cabinet);
    if (infra) filter.infrastructure = infra;
    if (facility) filter.facility = facility;
    if (cabinet) filter.cabinet = cabinet;
    const type = oneOf(req.query?.deviceType, [
      'switch',
      'router',
      'route-server',
      'console-server',
      'pdu',
      'server',
      'patch-panel',
      'other',
    ] as const);
    if (type) filter.deviceType = type;

    const rows = await Switch.find(filter)
      .populate('cabinet', 'name uHeight')
      .populate('facility', 'name shortname')
      .sort({ order: 1, name: 1 })
      .lean();

    const ids = rows.map((r: any) => r._id);
    const portAgg = ids.length
      ? await SwitchPort.aggregate([
          { $match: { switch: { $in: ids } } },
          { $group: { _id: { s: '$switch', st: '$status' }, n: { $sum: 1 } } },
        ])
      : [];

    const totals = new Map<string, { total: number; free: number; assigned: number }>();
    for (const row of portAgg as any[]) {
      const key = String(row._id.s);
      const entry = totals.get(key) || { total: 0, free: 0, assigned: 0 };
      entry.total += row.n;
      if (row._id.st === 'free') entry.free += row.n;
      if (row._id.st === 'assigned') entry.assigned += row.n;
      totals.set(key, entry);
    }

    ok(
      res,
      rows.map((r: any) => ({ ...r, ports: totals.get(String(r._id)) || { total: 0, free: 0, assigned: 0 } }))
    );
  } catch {
    bad(res, 'Failed to load devices.', 500);
  }
};

export const getDevice = async (req: Request, res: Response): Promise<void> => {
  try {
    const device = await Switch.findById(req.params.id)
      .populate('cabinet', 'name uHeight uNumbering facility')
      .populate('facility', 'name shortname')
      .lean();
    if (!device) return bad(res, 'Device not found.', 404);

    const ports = await SwitchPort.find({ switch: req.params.id }).sort({ name: 1 }).lean();

    // Which ports are actually in use, and by what.
    const portIds = ports.map((p: any) => p._id);
    const [memberUse, coreUse] = await Promise.all([
      PhysicalInterface.find({ switchPort: { $in: portIds } })
        .select('switchPort virtualInterface status speed')
        .lean(),
      CoreLink.find({ $or: [{ switchPortA: { $in: portIds } }, { switchPortB: { $in: portIds } }] })
        .select('switchPortA switchPortB coreBundle')
        .lean(),
    ]);
    const memberByPort = new Map(memberUse.map((m: any) => [String(m.switchPort), m]));
    const coreByPort = new Map<string, any>();
    for (const c of coreUse as any[]) {
      coreByPort.set(String(c.switchPortA), c);
      coreByPort.set(String(c.switchPortB), c);
    }

    ok(res, {
      device,
      ports: ports.map((p: any) => ({
        ...p,
        memberUse: memberByPort.get(String(p._id)) || null,
        coreUse: coreByPort.get(String(p._id)) || null,
      })),
    });
  } catch {
    bad(res, 'Failed to load the device.', 500);
  }
};

export const createDevice = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = new Validator();
    const infrastructure = v.require(objectId(req.body?.infrastructure), 'Infrastructure');
    const name = v.require(str(req.body?.name), 'Name');
    if (v.failed) return bad(res, v.message);

    if (!(await Infrastructure.exists({ _id: infrastructure }))) return bad(res, 'Infrastructure not found.', 404);

    const payload = pick(req.body, DEVICE_FIELDS);
    payload.infrastructure = infrastructure;
    payload.name = name;

    const cabinet = objectId(req.body?.cabinet);
    const position = int(req.body?.rackPosition, { min: 1, max: 100 });
    const units = int(req.body?.rackUnits, { min: 1, max: 60 }) ?? 1;
    const face = oneOf(req.body?.rackFace, ['front', 'rear'] as const) ?? 'front';

    if (cabinet && position !== undefined) {
      const placement = await checkPlacement(cabinet, position, units, face);
      if (!placement.ok) return bad(res, placement.error || 'That rack position is not available.');
    }

    const created = await Switch.create(payload);
    if (created.cabinet) await syncDeviceFacility(created._id as any);

    await logAudit({
      actor: req.user?.email,
      action: 'fabric.device.create',
      resource: 'Switch',
      resourceId: String(created._id),
      after: { name: created.name, deviceType: created.deviceType },
    });
    ok(res, await Switch.findById(created._id).lean(), 201);
  } catch (err: any) {
    if (err?.code === 11000) return bad(res, 'A device with that name already exists on this infrastructure.', 409);
    bad(res, 'Failed to create the device.', 500);
  }
};

export const updateDevice = async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await Switch.findById(req.params.id);
    if (!existing) return bad(res, 'Device not found.', 404);

    const payload = pick(req.body, DEVICE_FIELDS);

    // Validate placement against the values that will apply after the update,
    // not just the ones supplied.
    const cabinet = payload.cabinet !== undefined ? objectId(payload.cabinet) : existing.cabinet ? String(existing.cabinet) : undefined;
    const position =
      payload.rackPosition !== undefined ? int(payload.rackPosition, { min: 1, max: 100 }) : existing.rackPosition;
    const units = payload.rackUnits !== undefined ? int(payload.rackUnits, { min: 1, max: 60 }) ?? 1 : existing.rackUnits || 1;
    const face =
      payload.rackFace !== undefined ? oneOf(payload.rackFace, ['front', 'rear'] as const) ?? 'front' : existing.rackFace || 'front';

    if (cabinet && position !== undefined && position !== null) {
      const placement = await checkPlacement(cabinet, position, units, face, existing._id as any);
      if (!placement.ok) return bad(res, placement.error || 'That rack position is not available.');
    }

    const before = existing.toObject();
    const updated = await Switch.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true });
    await syncDeviceFacility(param(req.params.id));

    await logAudit({
      actor: req.user?.email,
      action: 'fabric.device.update',
      resource: 'Switch',
      resourceId: String(req.params.id),
      before: { name: before.name, cabinet: before.cabinet, rackPosition: before.rackPosition },
      after: payload,
    });
    ok(res, updated);
  } catch (err: any) {
    if (err?.code === 11000) return bad(res, 'A device with that name already exists on this infrastructure.', 409);
    bad(res, 'Failed to update the device.', 500);
  }
};

export const deleteDevice = async (req: Request, res: Response): Promise<void> => {
  try {
    const ports = await SwitchPort.find({ switch: req.params.id }).select('_id').lean();
    const portIds = ports.map((p: any) => p._id);
    const [memberUse, coreUse] = await Promise.all([
      PhysicalInterface.countDocuments({ switchPort: { $in: portIds } }),
      CoreLink.countDocuments({ $or: [{ switchPortA: { $in: portIds } }, { switchPortB: { $in: portIds } }] }),
    ]);
    if (memberUse || coreUse) {
      return bad(
        res,
        `This device has ${memberUse} member connection(s) and ${coreUse} core link(s) on its ports. Deprovision those first.`,
        409
      );
    }

    await SwitchPort.deleteMany({ switch: req.params.id });
    await Switch.findByIdAndDelete(req.params.id);
    await logAudit({
      actor: req.user?.email,
      action: 'fabric.device.delete',
      resource: 'Switch',
      resourceId: String(req.params.id),
      before: { ports: ports.length },
    });
    ok(res, { deleted: true, portsRemoved: ports.length });
  } catch {
    bad(res, 'Failed to delete the device.', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// Switch ports
// ══════════════════════════════════════════════════════════════════════════════

const PORT_FIELDS = ['name', 'type', 'ifIndex', 'zabbixInterface', 'speed', 'media', 'status', 'lagName', 'notes'] as const;

export const createPort = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = new Validator();
    const name = v.require(str(req.body?.name), 'Port name');
    if (v.failed) return bad(res, v.message);

    if (!(await Switch.exists({ _id: req.params.id }))) return bad(res, 'Device not found.', 404);

    const payload = pick(req.body, PORT_FIELDS);
    payload.name = name;
    (payload as any).switch = req.params.id;

    const created = await SwitchPort.create(payload);
    await logAudit({
      actor: req.user?.email,
      action: 'fabric.port.create',
      resource: 'SwitchPort',
      resourceId: String(created._id),
      after: { name: created.name, switch: req.params.id },
    });
    ok(res, created, 201);
  } catch (err: any) {
    if (err?.code === 11000) return bad(res, 'A port with that name already exists on this device.', 409);
    bad(res, 'Failed to create the port.', 500);
  }
};

/**
 * Bulk-create ports from a name pattern, e.g. `100GE1/0/{1-48}`.
 *
 * Populating a 48-port switch one row at a time is the kind of busywork that
 * stops inventory being kept up to date.
 */
export const generatePorts = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = new Validator();
    const pattern = v.require(str(req.body?.pattern), 'Pattern');
    if (v.failed) return bad(res, v.message);

    if (!(await Switch.exists({ _id: req.params.id }))) return bad(res, 'Device not found.', 404);

    const match = /^(.*)\{(\d+)-(\d+)\}(.*)$/.exec(pattern!);
    if (!match) {
      return bad(res, 'Pattern must contain a range, for example "100GE1/0/{1-48}".');
    }
    const [, prefix, fromRaw, toRaw, suffix] = match;
    const from = Number(fromRaw);
    const to = Number(toRaw);
    if (from > to) return bad(res, 'The range start must not be greater than the end.');
    if (to - from + 1 > 512) return bad(res, 'That range would create more than 512 ports.');

    const type = oneOf(req.body?.type, ['peering', 'core', 'reseller', 'management', 'fanout', 'other'] as const) || 'peering';
    const speed = int(req.body?.speed, { min: 1 });
    const media = str(req.body?.media);

    const docs: any[] = [];
    for (let i = from; i <= to; i++) {
      docs.push({
        switch: req.params.id,
        name: `${prefix}${i}${suffix}`,
        type,
        speed,
        media,
        status: 'free',
      });
    }

    // ordered:false so ports that already exist are skipped rather than aborting
    // the whole batch — this makes re-running the generator safe.
    let created = 0;
    try {
      const inserted = await SwitchPort.insertMany(docs, { ordered: false });
      created = inserted.length;
    } catch (err: any) {
      created = typeof err?.result?.nInserted === 'number' ? err.result.nInserted : err?.insertedDocs?.length || 0;
      const nonDuplicate = (err?.writeErrors || []).filter((e: any) => e?.err?.code !== 11000 && e?.code !== 11000);
      if (nonDuplicate.length) throw err;
    }

    await logAudit({
      actor: req.user?.email,
      action: 'fabric.port.generate',
      resource: 'Switch',
      resourceId: String(req.params.id),
      after: { pattern, created, skipped: docs.length - created },
    });
    ok(res, { created, skipped: docs.length - created, total: docs.length }, 201);
  } catch {
    bad(res, 'Failed to generate ports.', 500);
  }
};

export const updatePort = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = pick(req.body, PORT_FIELDS);

    // A port carrying a live connection must not be quietly marked free.
    if (payload.status && payload.status !== 'assigned') {
      const inUse = await PhysicalInterface.countDocuments({ switchPort: req.params.portId });
      if (inUse) {
        return bad(
          res,
          'This port carries a member connection, so its status cannot be changed. Deprovision the connection first.'
        );
      }
    }

    const updated = await SwitchPort.findOneAndUpdate(
      { _id: req.params.portId, switch: req.params.id },
      { $set: payload },
      { new: true }
    );
    if (!updated) return bad(res, 'Port not found.', 404);

    await logAudit({
      actor: req.user?.email,
      action: 'fabric.port.update',
      resource: 'SwitchPort',
      resourceId: String(req.params.portId),
      after: payload,
    });
    ok(res, updated);
  } catch (err: any) {
    if (err?.code === 11000) return bad(res, 'A port with that name already exists on this device.', 409);
    bad(res, 'Failed to update the port.', 500);
  }
};

export const deletePort = async (req: Request, res: Response): Promise<void> => {
  try {
    const [memberUse, coreUse] = await Promise.all([
      PhysicalInterface.countDocuments({ switchPort: req.params.portId }),
      CoreLink.countDocuments({ $or: [{ switchPortA: req.params.portId }, { switchPortB: req.params.portId }] }),
    ]);
    if (memberUse || coreUse) {
      return bad(res, 'This port is in use by a member connection or a core link.', 409);
    }
    const deleted = await SwitchPort.findOneAndDelete({ _id: req.params.portId, switch: req.params.id });
    if (!deleted) return bad(res, 'Port not found.', 404);

    await logAudit({
      actor: req.user?.email,
      action: 'fabric.port.delete',
      resource: 'SwitchPort',
      resourceId: String(req.params.portId),
    });
    ok(res, { deleted: true });
  } catch {
    bad(res, 'Failed to delete the port.', 500);
  }
};

export default {
  listInfrastructures,
  createInfrastructure,
  updateInfrastructure,
  deleteInfrastructure,
  listFacilities,
  createFacility,
  updateFacility,
  deleteFacility,
  listCabinets,
  createCabinet,
  updateCabinet,
  deleteCabinet,
  cabinetElevation,
  listDevices,
  getDevice,
  createDevice,
  updateDevice,
  deleteDevice,
  createPort,
  generatePorts,
  updatePort,
  deletePort,
};
