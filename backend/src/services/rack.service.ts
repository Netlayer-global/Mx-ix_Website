import { Types } from 'mongoose';
import { Cabinet, Switch, SwitchPort, PatchPanel } from '../models';
import { ICabinet } from '../models/cabinet.model';

/**
 * Rack elevation and placement validation.
 *
 * Rack units are derived, never stored: a device records the lowest unit it
 * occupies (`rackPosition`) and its height (`rackUnits`), and the elevation is
 * computed from that. One row per unit would only give the truth a second place
 * to drift.
 */

export interface RackOccupant {
  id: string;
  kind: 'device' | 'patch-panel';
  name: string;
  deviceType?: string;
  vendor?: string;
  hardwareModel?: string;
  /** Lowest unit occupied. */
  position: number;
  /** Height in units. */
  units: number;
  face: 'front' | 'rear';
  active: boolean;
  /** Ports on this device, for the drill-down view. */
  portCount?: number;
}

export interface RackUnitRow {
  /** Unit number as labelled on the rack. */
  unit: number;
  front?: RackOccupant | null;
  rear?: RackOccupant | null;
  /** True when this unit is the lowest one its occupant covers. */
  isOccupantStartFront: boolean;
  isOccupantStartRear: boolean;
}

export interface RackElevation {
  cabinet: {
    id: string;
    name: string;
    facility: string | null;
    uHeight: number;
    uNumbering: 'bottom-up' | 'top-down';
  };
  /** Ordered top-of-rack first, matching how an elevation is normally drawn. */
  units: RackUnitRow[];
  occupants: RackOccupant[];
  freeUnits: number;
  usedUnits: number;
  /** Contiguous free runs, so "where does a 2U box fit?" is answerable. */
  freeRuns: Array<{ start: number; end: number; size: number }>;
  /** Placement problems found in stored data (overlaps, out-of-range). */
  problems: string[];
}

/** Units covered by an occupant, given its lowest position and height. */
const unitsCovered = (position: number, units: number): number[] => {
  const out: number[] = [];
  for (let u = position; u < position + units; u++) out.push(u);
  return out;
};

/**
 * Build the elevation for one cabinet.
 *
 * Reports data problems rather than throwing, because a rack whose stored
 * positions overlap still needs to be viewable so an operator can fix it.
 */
export const getRackElevation = async (cabinetId: string | Types.ObjectId): Promise<RackElevation> => {
  const cabinet = await Cabinet.findById(cabinetId).lean<ICabinet & { _id: Types.ObjectId }>();
  if (!cabinet) throw new Error('Cabinet not found');

  const [devices, panels] = await Promise.all([
    Switch.find({ cabinet: cabinet._id })
      .select('name deviceType vendor hardwareModel rackPosition rackUnits rackFace active')
      .lean(),
    PatchPanel.find({ cabinet: cabinet._id }).select('name portCount active').lean(),
  ]);

  // Port counts in one grouped query rather than one per device.
  const deviceIds = devices.map((d: any) => d._id);
  const portCounts = deviceIds.length
    ? await SwitchPort.aggregate([
        { $match: { switch: { $in: deviceIds } } },
        { $group: { _id: '$switch', count: { $sum: 1 } } },
      ])
    : [];
  const portCountBySwitch = new Map(portCounts.map((p: any) => [String(p._id), p.count]));

  const problems: string[] = [];
  const occupants: RackOccupant[] = [];

  for (const d of devices as any[]) {
    if (!d.rackPosition) {
      // Mounted in the cabinet but with no position recorded — surfaced so the
      // operator can place it, not treated as an error.
      problems.push(`${d.name} is assigned to this cabinet but has no rack position set.`);
      continue;
    }
    const units = Math.max(1, d.rackUnits || 1);
    if (d.rackPosition + units - 1 > cabinet.uHeight) {
      problems.push(
        `${d.name} at U${d.rackPosition} (${units}U) extends past the cabinet height of ${cabinet.uHeight}U.`
      );
    }
    occupants.push({
      id: String(d._id),
      kind: 'device',
      name: d.name,
      deviceType: d.deviceType,
      vendor: d.vendor,
      hardwareModel: d.hardwareModel,
      position: d.rackPosition,
      units,
      face: d.rackFace || 'front',
      active: d.active !== false,
      portCount: portCountBySwitch.get(String(d._id)) || 0,
    });
  }

  // Patch panels have no position field of their own; they are listed as
  // occupants without a unit so the UI can still show what is in the rack.
  for (const p of panels as any[]) {
    occupants.push({
      id: String(p._id),
      kind: 'patch-panel',
      name: p.name,
      position: 0,
      units: 1,
      face: 'front',
      active: p.active !== false,
      portCount: p.portCount,
    });
  }

  // Lay occupants onto the unit grid, per face.
  const frontMap = new Map<number, RackOccupant>();
  const rearMap = new Map<number, RackOccupant>();
  for (const o of occupants) {
    if (o.position < 1) continue;
    const map = o.face === 'rear' ? rearMap : frontMap;
    for (const u of unitsCovered(o.position, o.units)) {
      const existing = map.get(u);
      if (existing && existing.id !== o.id) {
        problems.push(`U${u} (${o.face}) is claimed by both "${existing.name}" and "${o.name}".`);
      }
      map.set(u, o);
    }
  }

  const units: RackUnitRow[] = [];
  // Drawn top-first. With bottom-up numbering the top of the rack is the
  // highest unit number; with top-down labelling it is U1.
  const descending = cabinet.uNumbering !== 'top-down';
  for (let i = 0; i < cabinet.uHeight; i++) {
    const unit = descending ? cabinet.uHeight - i : i + 1;
    const front = frontMap.get(unit) || null;
    const rear = rearMap.get(unit) || null;
    units.push({
      unit,
      front,
      rear,
      isOccupantStartFront: !!front && front.position === unit,
      isOccupantStartRear: !!rear && rear.position === unit,
    });
  }

  // Free = nothing on either face.
  const occupiedUnits = new Set<number>([...frontMap.keys(), ...rearMap.keys()]);
  const usedUnits = occupiedUnits.size;

  const freeRuns: Array<{ start: number; end: number; size: number }> = [];
  let runStart: number | null = null;
  for (let u = 1; u <= cabinet.uHeight; u++) {
    const free = !occupiedUnits.has(u);
    if (free && runStart === null) runStart = u;
    if ((!free || u === cabinet.uHeight) && runStart !== null) {
      const end = free && u === cabinet.uHeight ? u : u - 1;
      if (end >= runStart) freeRuns.push({ start: runStart, end, size: end - runStart + 1 });
      runStart = null;
    }
  }

  return {
    cabinet: {
      id: String(cabinet._id),
      name: cabinet.name,
      facility: cabinet.facility ? String(cabinet.facility) : null,
      uHeight: cabinet.uHeight,
      uNumbering: cabinet.uNumbering || 'bottom-up',
    },
    units,
    occupants,
    usedUnits,
    freeUnits: cabinet.uHeight - usedUnits,
    freeRuns,
    problems,
  };
};

export interface PlacementCheck {
  ok: boolean;
  error?: string;
  /** Units the device would occupy if placed. */
  units?: number[];
}

/**
 * Check whether a device fits at a position before saving it.
 *
 * Cross-document constraints can't be expressed in a Mongoose schema, so this
 * runs in the controller path. Pass `excludeDeviceId` when moving an existing
 * device so it doesn't collide with itself.
 */
export const checkPlacement = async (
  cabinetId: string | Types.ObjectId,
  position: number,
  rackUnits: number,
  face: 'front' | 'rear' = 'front',
  excludeDeviceId?: string | Types.ObjectId
): Promise<PlacementCheck> => {
  const cabinet = await Cabinet.findById(cabinetId).lean<ICabinet>();
  if (!cabinet) return { ok: false, error: 'Cabinet not found.' };

  if (!Number.isInteger(position) || position < 1) {
    return { ok: false, error: 'Rack position must be a whole number of 1 or more.' };
  }
  if (!Number.isInteger(rackUnits) || rackUnits < 1) {
    return { ok: false, error: 'Rack units must be a whole number of 1 or more.' };
  }
  if (position + rackUnits - 1 > cabinet.uHeight) {
    return {
      ok: false,
      error: `A ${rackUnits}U device at U${position} would extend past the cabinet height of ${cabinet.uHeight}U.`,
    };
  }

  const wanted = unitsCovered(position, rackUnits);

  const others = await Switch.find({
    cabinet: cabinetId,
    rackFace: face,
    rackPosition: { $ne: null },
    ...(excludeDeviceId ? { _id: { $ne: excludeDeviceId } } : {}),
  })
    .select('name rackPosition rackUnits')
    .lean();

  for (const o of others as any[]) {
    const taken = unitsCovered(o.rackPosition, Math.max(1, o.rackUnits || 1));
    const clash = wanted.find((u) => taken.includes(u));
    if (clash !== undefined) {
      return {
        ok: false,
        error: `U${clash} (${face}) is already occupied by "${o.name}" (U${o.rackPosition}, ${o.rackUnits || 1}U).`,
      };
    }
  }

  return { ok: true, units: wanted };
};

/**
 * Keep `Switch.facility` in step with the cabinet it sits in.
 *
 * The facility is denormalised onto the device so "everything in this data
 * centre" is a single query; this is the one place that derives it.
 */
export const syncDeviceFacility = async (deviceId: string | Types.ObjectId): Promise<void> => {
  const device = await Switch.findById(deviceId).select('cabinet facility');
  if (!device) return;
  if (!device.cabinet) {
    if (device.facility) {
      device.facility = null;
      await device.save();
    }
    return;
  }
  const cabinet = await Cabinet.findById(device.cabinet).select('facility').lean<ICabinet>();
  const facilityId = cabinet?.facility ? String(cabinet.facility) : null;
  if (String(device.facility || '') !== String(facilityId || '')) {
    device.facility = (facilityId as any) || null;
    await device.save();
  }
};

export default {
  getRackElevation,
  checkPlacement,
  syncDeviceFacility,
};
