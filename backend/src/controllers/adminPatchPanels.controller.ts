import { Request, Response } from 'express';
import { PatchPanel, PatchPanelPort, Facility, SwitchPort, Organization } from '../models';
import { logAudit } from '../services/audit.service';
import { pick, str, int, bool, oneOf, objectId, param, Validator } from '../utils/validate.util';

/**
 * Patch panel & cross-connect management.
 *
 * This is where the NOC tracks LOAs, cross-connect lifecycle and the physical
 * fibre path between a member's router and our switch port:
 *
 *   Member router ──> colo patch panel port ──> our switch port
 *
 * The lifecycle states mirror how a cross-connect actually progresses:
 *   available → reserved → awaiting-loa → awaiting-xconnect → connected
 *   → awaiting-cease → ceased → available (recycled)
 */

const ok = (res: Response, data: any, status = 200): void => {
  res.status(status).json({ success: true, data });
};
const bad = (res: Response, error: string, status = 400): void => {
  res.status(status).json({ success: false, error });
};

const PANEL_FIELDS = [
  'facility', 'cabinet', 'name', 'portCount', 'duplex',
  'connectorType', 'mediaType', 'farEndLocation', 'providerRef',
  'portNamePrefix', 'notes', 'active', 'order',
] as const;

const PORT_FIELDS = [
  'state', 'organization', 'switchPort', 'duplexPartner',
  'loaCode', 'xconnectRef', 'customerRef', 'opticalLossDb',
  'notes', 'memberVisibleNotes',
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// Panels
// ══════════════════════════════════════════════════════════════════════════════

export const listPanels = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: any = {};
    const facility = objectId(req.query?.facility);
    if (facility) filter.facility = facility;

    const rows = await PatchPanel.find(filter)
      .populate('facility', 'name shortname')
      .populate('cabinet', 'name')
      .sort({ order: 1, name: 1 })
      .lean();

    // Port state counts per panel
    const ids = rows.map((r: any) => r._id);
    const portAgg = ids.length
      ? await PatchPanelPort.aggregate([
          { $match: { patchPanel: { $in: ids } } },
          { $group: { _id: { panel: '$patchPanel', state: '$state' }, n: { $sum: 1 } } },
        ])
      : [];

    const countsByPanel = new Map<string, Record<string, number>>();
    for (const row of portAgg as any[]) {
      const key = String(row._id.panel);
      const entry = countsByPanel.get(key) || {};
      entry[row._id.state] = row.n;
      countsByPanel.set(key, entry);
    }

    ok(res, rows.map((r: any) => ({
      ...r,
      portStates: countsByPanel.get(String(r._id)) || {},
      totalPorts: Object.values(countsByPanel.get(String(r._id)) || {}).reduce((a: number, b: any) => a + Number(b), 0),
    })));
  } catch {
    bad(res, 'Failed to load patch panels.', 500);
  }
};

export const createPanel = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = new Validator();
    const facility = v.require(objectId(req.body?.facility), 'Facility');
    const name = v.require(str(req.body?.name), 'Name');
    if (v.failed) return bad(res, v.message);

    if (!(await Facility.exists({ _id: facility }))) return bad(res, 'Facility not found.', 404);

    const payload = pick(req.body, PANEL_FIELDS) as any;
    payload.facility = facility;
    payload.name = name;

    const panel = await PatchPanel.create(payload);

    // Auto-generate port rows
    const portCount = panel.portCount || 24;
    const prefix = panel.portNamePrefix || 'P';
    const docs: any[] = [];
    for (let i = 1; i <= portCount; i++) {
      docs.push({
        patchPanel: panel._id,
        number: i,
        name: `${prefix}${i}`,
        state: 'available',
      });
    }
    await PatchPanelPort.insertMany(docs, { ordered: false }).catch(() => {});

    await logAudit({
      actor: req.user?.email,
      action: 'patchpanel.create',
      resource: 'PatchPanel',
      resourceId: String(panel._id),
      after: { name: panel.name, portCount },
    });
    ok(res, panel, 201);
  } catch (err: any) {
    if (err?.code === 11000) return bad(res, 'A patch panel with that name already exists in this facility.', 409);
    bad(res, 'Failed to create the patch panel.', 500);
  }
};

export const updatePanel = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = pick(req.body, PANEL_FIELDS);
    const updated = await PatchPanel.findByIdAndUpdate(param(req.params.id), { $set: payload }, { new: true });
    if (!updated) return bad(res, 'Patch panel not found.', 404);

    await logAudit({
      actor: req.user?.email,
      action: 'patchpanel.update',
      resource: 'PatchPanel',
      resourceId: String(req.params.id),
      after: payload,
    });
    ok(res, updated);
  } catch (err: any) {
    if (err?.code === 11000) return bad(res, 'A patch panel with that name already exists in this facility.', 409);
    bad(res, 'Failed to update the patch panel.', 500);
  }
};

export const deletePanel = async (req: Request, res: Response): Promise<void> => {
  try {
    const inUse = await PatchPanelPort.countDocuments({
      patchPanel: req.params.id,
      state: { $nin: ['available', 'decommissioned'] },
    });
    if (inUse) return bad(res, `${inUse} port(s) are still in use. Cease them first.`, 409);

    await PatchPanelPort.deleteMany({ patchPanel: req.params.id });
    await PatchPanel.findByIdAndDelete(req.params.id);
    await logAudit({
      actor: req.user?.email,
      action: 'patchpanel.delete',
      resource: 'PatchPanel',
      resourceId: String(req.params.id),
    });
    ok(res, { deleted: true });
  } catch {
    bad(res, 'Failed to delete the patch panel.', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// Ports (cross-connects)
// ══════════════════════════════════════════════════════════════════════════════

export const listPorts = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: any = { patchPanel: req.params.id };
    const state = oneOf(req.query?.state, [
      'available', 'reserved', 'awaiting-loa', 'awaiting-xconnect',
      'connected', 'awaiting-cease', 'ceased', 'broken', 'decommissioned',
    ] as const);
    if (state) filter.state = state;

    const rows = await PatchPanelPort.find(filter)
      .populate('organization', 'name asn')
      .populate('switchPort', 'name')
      .populate('duplexPartner', 'number name')
      .sort({ number: 1 })
      .lean();

    ok(res, rows);
  } catch {
    bad(res, 'Failed to load ports.', 500);
  }
};

export const updatePort = async (req: Request, res: Response): Promise<void> => {
  try {
    const port = await PatchPanelPort.findOne({ _id: req.params.portId, patchPanel: req.params.id });
    if (!port) return bad(res, 'Port not found.', 404);

    const payload: any = {};

    // State transitions with automatic date tracking
    const newState = oneOf(req.body?.state, [
      'available', 'reserved', 'awaiting-loa', 'awaiting-xconnect',
      'connected', 'awaiting-cease', 'ceased', 'broken', 'decommissioned',
    ] as const);
    if (newState && newState !== port.state) {
      payload.state = newState;
      const now = new Date();
      if (newState === 'reserved' || newState === 'awaiting-loa') payload.assignedAt = now;
      if (newState === 'awaiting-xconnect') payload.loaIssuedAt = now;
      if (newState === 'connected') payload.connectedAt = now;
      if (newState === 'awaiting-cease') payload.ceaseRequestedAt = now;
      if (newState === 'ceased') payload.ceasedAt = now;
      // Recycling a ceased port back to available clears all tracking
      if (newState === 'available') {
        payload.organization = null;
        payload.switchPort = null;
        payload.loaCode = '';
        payload.xconnectRef = '';
        payload.customerRef = '';
        payload.assignedAt = null;
        payload.loaIssuedAt = null;
        payload.connectedAt = null;
        payload.ceaseRequestedAt = null;
        payload.ceasedAt = null;
        payload.opticalLossDb = null;
        payload.notes = '';
        payload.memberVisibleNotes = '';
      }
    }

    // Direct field updates
    const org = objectId(req.body?.organization);
    if (org !== undefined) payload.organization = org || null;
    const sp = objectId(req.body?.switchPort);
    if (sp !== undefined) payload.switchPort = sp || null;
    const dp = objectId(req.body?.duplexPartner);
    if (dp !== undefined) payload.duplexPartner = dp || null;

    const loaCode = str(req.body?.loaCode);
    if (loaCode !== undefined) payload.loaCode = loaCode;
    const xconnectRef = str(req.body?.xconnectRef);
    if (xconnectRef !== undefined) payload.xconnectRef = xconnectRef;
    const customerRef = str(req.body?.customerRef);
    if (customerRef !== undefined) payload.customerRef = customerRef;
    const optical = req.body?.opticalLossDb;
    if (optical !== undefined) payload.opticalLossDb = optical === null ? null : Number(optical);
    const notes = str(req.body?.notes);
    if (notes !== undefined) payload.notes = notes;
    const memberNotes = str(req.body?.memberVisibleNotes);
    if (memberNotes !== undefined) payload.memberVisibleNotes = memberNotes;

    const updated = await PatchPanelPort.findByIdAndUpdate(port._id, { $set: payload }, { new: true })
      .populate('organization', 'name asn')
      .populate('switchPort', 'name')
      .populate('duplexPartner', 'number name');

    await logAudit({
      actor: req.user?.email,
      action: 'patchpanel.port.update',
      resource: 'PatchPanelPort',
      resourceId: String(port._id),
      before: { state: port.state },
      after: payload,
    });
    ok(res, updated);
  } catch (err: any) {
    if (err?.code === 11000) {
      if (/loaCode/.test(String(err?.message || ''))) return bad(res, 'That LOA code is already in use.', 409);
      if (/switchPort/.test(String(err?.message || ''))) return bad(res, 'That switch port is already assigned to another patch panel port.', 409);
      return bad(res, 'Duplicate value.', 409);
    }
    bad(res, 'Failed to update the port.', 500);
  }
};

/**
 * Assign a port to a member + generate LOA code.
 *
 * Convenience endpoint that does the whole "allocate a cross-connect" flow:
 * picks the next available port (or a specific one), sets the member, generates
 * a unique LOA code, and moves to 'awaiting-loa' state.
 */
export const assignPort = async (req: Request, res: Response): Promise<void> => {
  try {
    const panelId = param(req.params.id);
    const orgId = objectId(req.body?.organizationId);
    const portId = objectId(req.body?.portId); // optional — picks next free if blank
    const switchPortId = objectId(req.body?.switchPortId);

    if (!orgId) return bad(res, 'Organization is required.');
    if (!(await Organization.exists({ _id: orgId }))) return bad(res, 'Organization not found.', 404);

    let port;
    if (portId) {
      port = await PatchPanelPort.findOne({ _id: portId, patchPanel: panelId, state: 'available' });
      if (!port) return bad(res, 'That port is not available.');
    } else {
      port = await PatchPanelPort.findOne({ patchPanel: panelId, state: 'available' }).sort({ number: 1 });
      if (!port) return bad(res, 'No available ports on this panel.');
    }

    // Generate a human-readable LOA code: <panel-shortish>-<port-number>-<random>
    const panel = await PatchPanel.findById(panelId).select('name').lean();
    const panelSlug = (panel as any)?.name?.replace(/[^A-Za-z0-9]/g, '').slice(0, 8) || 'PP';
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    const loaCode = `${panelSlug}-${port.number}-${random}`;

    const update: any = {
      state: 'awaiting-loa',
      organization: orgId,
      loaCode,
      assignedAt: new Date(),
    };
    if (switchPortId) update.switchPort = switchPortId;

    // Handle duplex pairing — if the panel is duplex, auto-pair with the next port
    const panelDoc = await PatchPanel.findById(panelId).lean();
    if ((panelDoc as any)?.duplex && !port.duplexPartner) {
      const partnerNum = port.number % 2 === 1 ? port.number + 1 : port.number - 1;
      const partner = await PatchPanelPort.findOne({ patchPanel: panelId, number: partnerNum, state: 'available' });
      if (partner) {
        update.duplexPartner = partner._id;
        await PatchPanelPort.updateOne({ _id: partner._id }, {
          $set: { duplexPartner: port._id, state: 'awaiting-loa', organization: orgId, assignedAt: new Date() },
        });
      }
    }

    const updated = await PatchPanelPort.findByIdAndUpdate(port._id, { $set: update }, { new: true })
      .populate('organization', 'name asn')
      .populate('switchPort', 'name')
      .populate('duplexPartner', 'number name');

    await logAudit({
      actor: req.user?.email,
      action: 'patchpanel.port.assign',
      resource: 'PatchPanelPort',
      resourceId: String(port._id),
      after: { organization: orgId, loaCode, portNumber: port.number },
    });
    ok(res, updated, 201);
  } catch (err: any) {
    if (err?.code === 11000) return bad(res, 'LOA code conflict — please retry.', 409);
    bad(res, 'Failed to assign the port.', 500);
  }
};

/** Summary stats across all panels for the dashboard. */
export const stats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const agg = await PatchPanelPort.aggregate([
      { $group: { _id: '$state', count: { $sum: 1 } } },
    ]);
    const byState: Record<string, number> = {};
    for (const row of agg) byState[row._id] = row.count;
    const total = Object.values(byState).reduce((a, b) => a + b, 0);
    ok(res, { total, byState });
  } catch {
    bad(res, 'Failed to load stats.', 500);
  }
};

export default {
  listPanels,
  createPanel,
  updatePanel,
  deletePanel,
  listPorts,
  updatePort,
  assignPort,
  stats,
};
