import { Request, Response } from 'express';
import { CoreBundle, CoreLink, Switch, SwitchPort, Infrastructure } from '../models';
import { logAudit } from '../services/audit.service';
import { pick, str, int, bool, oneOf, objectId, param, Validator } from '../utils/validate.util';

/**
 * Core bundles = our own switch-to-switch trunks (ISLs).
 *
 * Not member connections — these are the links that carry ALL member traffic
 * between switches, so their utilisation is what decides whether an upgrade is
 * needed and where.
 */

const ok = (res: Response, data: any, status = 200): void => {
  res.status(status).json({ success: true, data });
};
const bad = (res: Response, error: string, status = 400): void => {
  res.status(status).json({ success: false, error });
};

const BUNDLE_FIELDS = [
  'infrastructure', 'name', 'type', 'switchA', 'switchB',
  'bundleNameA', 'bundleNameB', 'enabled', 'state', 'drained', 'notes', 'order',
] as const;

const LINK_FIELDS = [
  'switchPortA', 'switchPortB', 'speed', 'enabled', 'bfdEnabled',
  'patchPanelPortA', 'patchPanelPortB', 'notes', 'order',
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// Bundles
// ══════════════════════════════════════════════════════════════════════════════

export const listBundles = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: any = {};
    const infra = objectId(req.query?.infrastructure);
    if (infra) filter.infrastructure = infra;

    const rows = await CoreBundle.find(filter)
      .populate('infrastructure', 'name shortname')
      .populate('switchA', 'name')
      .populate('switchB', 'name')
      .sort({ order: 1, name: 1 })
      .lean();

    // Link counts + total capacity per bundle
    const ids = rows.map((r: any) => r._id);
    const linkAgg = ids.length
      ? await CoreLink.aggregate([
          { $match: { coreBundle: { $in: ids } } },
          {
            $group: {
              _id: '$coreBundle',
              links: { $sum: 1 },
              enabledLinks: { $sum: { $cond: ['$enabled', 1, 0] } },
              totalSpeed: { $sum: '$speed' },
              enabledSpeed: { $sum: { $cond: ['$enabled', '$speed', 0] } },
            },
          },
        ])
      : [];
    const linkStats = new Map(linkAgg.map((r: any) => [String(r._id), r]));

    ok(res, rows.map((r: any) => {
      const ls = linkStats.get(String(r._id));
      return {
        ...r,
        links: ls?.links || 0,
        enabledLinks: ls?.enabledLinks || 0,
        totalCapacityMbps: ls?.totalSpeed || 0,
        enabledCapacityMbps: ls?.enabledSpeed || 0,
      };
    }));
  } catch {
    bad(res, 'Failed to load core bundles.', 500);
  }
};

export const createBundle = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = new Validator();
    const infra = v.require(objectId(req.body?.infrastructure), 'Infrastructure');
    const name = v.require(str(req.body?.name), 'Name');
    const switchA = v.require(objectId(req.body?.switchA), 'Switch A');
    const switchB = v.require(objectId(req.body?.switchB), 'Switch B');
    if (v.failed) return bad(res, v.message);
    if (switchA === switchB) return bad(res, 'Switch A and B must be different.');

    const payload = pick(req.body, BUNDLE_FIELDS) as any;
    payload.infrastructure = infra;
    payload.name = name;
    payload.switchA = switchA;
    payload.switchB = switchB;

    const created = await CoreBundle.create(payload);
    await logAudit({
      actor: req.user?.email,
      action: 'corebundle.create',
      resource: 'CoreBundle',
      resourceId: String(created._id),
      after: { name: created.name },
    });
    ok(res, created, 201);
  } catch {
    bad(res, 'Failed to create the core bundle.', 500);
  }
};

export const updateBundle = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = pick(req.body, BUNDLE_FIELDS);
    if (payload.switchA && payload.switchB && payload.switchA === payload.switchB) {
      return bad(res, 'Switch A and B must be different.');
    }
    const updated = await CoreBundle.findByIdAndUpdate(param(req.params.id), { $set: payload }, { new: true })
      .populate('switchA', 'name')
      .populate('switchB', 'name');
    if (!updated) return bad(res, 'Core bundle not found.', 404);

    await logAudit({
      actor: req.user?.email,
      action: 'corebundle.update',
      resource: 'CoreBundle',
      resourceId: String(req.params.id),
      after: payload,
    });
    ok(res, updated);
  } catch {
    bad(res, 'Failed to update the core bundle.', 500);
  }
};

export const deleteBundle = async (req: Request, res: Response): Promise<void> => {
  try {
    const links = await CoreLink.countDocuments({ coreBundle: req.params.id });
    if (links) return bad(res, `Remove the ${links} link(s) first.`, 409);

    await CoreBundle.findByIdAndDelete(req.params.id);
    await logAudit({
      actor: req.user?.email,
      action: 'corebundle.delete',
      resource: 'CoreBundle',
      resourceId: String(req.params.id),
    });
    ok(res, { deleted: true });
  } catch {
    bad(res, 'Failed to delete the core bundle.', 500);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// Links (individual strands in a bundle)
// ══════════════════════════════════════════════════════════════════════════════

export const listLinks = async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await CoreLink.find({ coreBundle: req.params.id })
      .populate('switchPortA', 'name')
      .populate('switchPortB', 'name')
      .sort({ order: 1 })
      .lean();
    ok(res, rows);
  } catch {
    bad(res, 'Failed to load links.', 500);
  }
};

export const createLink = async (req: Request, res: Response): Promise<void> => {
  try {
    const v = new Validator();
    const portA = v.require(objectId(req.body?.switchPortA), 'Switch port A');
    const portB = v.require(objectId(req.body?.switchPortB), 'Switch port B');
    if (v.failed) return bad(res, v.message);
    if (portA === portB) return bad(res, 'Port A and B must be different.');

    if (!(await CoreBundle.exists({ _id: req.params.id }))) return bad(res, 'Core bundle not found.', 404);

    const payload = pick(req.body, LINK_FIELDS) as any;
    payload.coreBundle = req.params.id;
    payload.switchPortA = portA;
    payload.switchPortB = portB;
    if (!payload.speed) payload.speed = 100000;

    const created = await CoreLink.create(payload);

    // Mark the ports as assigned
    await SwitchPort.updateMany(
      { _id: { $in: [portA, portB] } },
      { $set: { status: 'assigned', type: 'core' } }
    );

    await logAudit({
      actor: req.user?.email,
      action: 'corebundle.link.create',
      resource: 'CoreLink',
      resourceId: String(created._id),
      after: { portA, portB, speed: payload.speed },
    });
    ok(res, created, 201);
  } catch (err: any) {
    if (err?.code === 11000) return bad(res, 'One of those ports is already used by another core link or member connection.', 409);
    bad(res, 'Failed to create the link.', 500);
  }
};

export const updateLink = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = pick(req.body, ['speed', 'enabled', 'bfdEnabled', 'notes', 'order'] as const);
    const updated = await CoreLink.findOneAndUpdate(
      { _id: req.params.linkId, coreBundle: req.params.id },
      { $set: payload },
      { new: true }
    );
    if (!updated) return bad(res, 'Link not found.', 404);
    ok(res, updated);
  } catch {
    bad(res, 'Failed to update the link.', 500);
  }
};

export const deleteLink = async (req: Request, res: Response): Promise<void> => {
  try {
    const link = await CoreLink.findOne({ _id: req.params.linkId, coreBundle: req.params.id });
    if (!link) return bad(res, 'Link not found.', 404);

    await CoreLink.deleteOne({ _id: link._id });

    // Free the switch ports
    await SwitchPort.updateMany(
      { _id: { $in: [link.switchPortA, link.switchPortB] } },
      { $set: { status: 'free' } }
    );

    await logAudit({
      actor: req.user?.email,
      action: 'corebundle.link.delete',
      resource: 'CoreLink',
      resourceId: String(req.params.linkId),
    });
    ok(res, { deleted: true });
  } catch {
    bad(res, 'Failed to delete the link.', 500);
  }
};

/** Fabric capacity summary — total vs enabled across all bundles per infrastructure. */
export const capacitySummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const agg = await CoreLink.aggregate([
      {
        $lookup: {
          from: 'corebundles',
          localField: 'coreBundle',
          foreignField: '_id',
          as: 'bundle',
        },
      },
      { $unwind: '$bundle' },
      {
        $group: {
          _id: '$bundle.infrastructure',
          totalLinks: { $sum: 1 },
          enabledLinks: { $sum: { $cond: ['$enabled', 1, 0] } },
          totalMbps: { $sum: '$speed' },
          enabledMbps: { $sum: { $cond: ['$enabled', '$speed', 0] } },
        },
      },
    ]);

    const infras = await Infrastructure.find({ _id: { $in: agg.map((r: any) => r._id) } })
      .select('name shortname')
      .lean();
    const infraMap = new Map(infras.map((i: any) => [String(i._id), i]));

    ok(res, agg.map((r: any) => ({
      infrastructure: infraMap.get(String(r._id)) || { name: '—' },
      totalLinks: r.totalLinks,
      enabledLinks: r.enabledLinks,
      totalCapacityGbps: Math.round(r.totalMbps / 1000),
      enabledCapacityGbps: Math.round(r.enabledMbps / 1000),
      redundancy: r.totalLinks > 1 ? `${r.enabledLinks}/${r.totalLinks} active` : 'single link',
    })));
  } catch {
    bad(res, 'Failed to compute capacity summary.', 500);
  }
};

export default {
  listBundles,
  createBundle,
  updateBundle,
  deleteBundle,
  listLinks,
  createLink,
  updateLink,
  deleteLink,
  capacitySummary,
};
