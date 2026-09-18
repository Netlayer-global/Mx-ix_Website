import { Request, Response } from 'express';
import { MaintenanceWindow, MaintenanceState } from '../models/maintenanceWindow.model';
import { logAudit } from '../services/audit.service';
import { notifyMaintenance } from '../services/maintenanceNotify.service';

/** Notifications run in the background so the admin response is never delayed. */
const fireNotify = (
  window: any,
  kind: 'scheduled' | 'updated' | 'started' | 'completed' | 'cancelled',
  markNotified = false
): void => {
  setImmediate(() => {
    notifyMaintenance(window, kind, { markNotified }).catch((err) =>
      console.error('[Maintenance] notify failed:', err)
    );
  });
};

/** GET /api/admin/maintenance/windows — list all, newest first. */
export const listWindows = async (_req: Request, res: Response): Promise<void> => {
  const windows = await MaintenanceWindow.find().sort({ scheduledStart: -1 }).lean();
  res.json({ success: true, data: windows });
};

/**
 * POST /api/admin/maintenance/windows — create a new window.
 *
 * Pass `notify: false` to schedule quietly; by default members are told, which
 * is the whole point of announcing a window in advance.
 */
export const createWindow = async (req: Request, res: Response): Promise<void> => {
  const { title, description, affectedComponents, affectedMembers, scheduledStart, scheduledEnd, notes } = req.body || {};
  if (!title || !scheduledStart || !scheduledEnd) {
    res.status(400).json({ success: false, error: 'title, scheduledStart and scheduledEnd are required.' });
    return;
  }
  const start = new Date(scheduledStart);
  const end = new Date(scheduledEnd);
  if (!(start.getTime() < end.getTime())) {
    res.status(400).json({ success: false, error: 'The end time must be after the start time.' });
    return;
  }

  const window = await MaintenanceWindow.create({
    title,
    description: description || '',
    affectedComponents: affectedComponents || [],
    affectedMembers: affectedMembers || [],
    scheduledStart: start,
    scheduledEnd: end,
    notes: notes || '',
    createdBy: (req.user?.email as string || '') || '',
  });

  await logAudit({ actor: (req.user?.email as string || ''), action: 'maintenance.create', resource: 'MaintenanceWindow', resourceId: String(window._id), after: { title } });

  if (req.body?.notify !== false) fireNotify(window, 'scheduled', true);

  res.status(201).json({ success: true, data: window });
};

/** PUT /api/admin/maintenance/windows/:id — update state or details. */
export const updateWindow = async (req: Request, res: Response): Promise<void> => {
  const { title, description, affectedComponents, affectedMembers, scheduledStart, scheduledEnd, state, notes, actualStart, actualEnd } = req.body || {};
  const existing = await MaintenanceWindow.findById(req.params.id);
  if (!existing) { res.status(404).json({ success: false, error: 'Window not found.' }); return; }

  const update: any = {};
  if (title !== undefined) update.title = title;
  if (description !== undefined) update.description = description;
  if (affectedComponents !== undefined) update.affectedComponents = affectedComponents;
  if (affectedMembers !== undefined) update.affectedMembers = affectedMembers;
  if (scheduledStart !== undefined) update.scheduledStart = new Date(scheduledStart);
  if (scheduledEnd !== undefined) update.scheduledEnd = new Date(scheduledEnd);
  if (state !== undefined) update.state = state;
  if (notes !== undefined) update.notes = notes;
  if (actualStart !== undefined) update.actualStart = new Date(actualStart);
  if (actualEnd !== undefined) update.actualEnd = new Date(actualEnd);

  const nextStart = update.scheduledStart || existing.scheduledStart;
  const nextEnd = update.scheduledEnd || existing.scheduledEnd;
  if (!(new Date(nextStart).getTime() < new Date(nextEnd).getTime())) {
    res.status(400).json({ success: false, error: 'The end time must be after the start time.' });
    return;
  }

  // Auto-set actual times on state transitions
  if (state === 'in-progress' && !update.actualStart) update.actualStart = new Date();
  if (state === 'completed' && !update.actualEnd) update.actualEnd = new Date();

  const window = await MaintenanceWindow.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
  if (!window) { res.status(404).json({ success: false, error: 'Window not found.' }); return; }

  await logAudit({ actor: (req.user?.email as string || ''), action: 'maintenance.update', resource: 'MaintenanceWindow', resourceId: String(window._id), after: update });

  if (req.body?.notify !== false) {
    const stateChanged = state !== undefined && state !== existing.state;
    const timesChanged =
      (update.scheduledStart && update.scheduledStart.getTime() !== existing.scheduledStart.getTime()) ||
      (update.scheduledEnd && update.scheduledEnd.getTime() !== existing.scheduledEnd.getTime());

    if (stateChanged) {
      const kind =
        state === 'in-progress' ? 'started' : state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'updated';
      fireNotify(window, kind as any);
    } else if (timesChanged) {
      fireNotify(window, 'updated');
    }
  }

  res.json({ success: true, data: window });
};

/** DELETE /api/admin/maintenance/windows/:id */
export const deleteWindow = async (req: Request, res: Response): Promise<void> => {
  const window = await MaintenanceWindow.findByIdAndDelete(req.params.id);
  if (!window) { res.status(404).json({ success: false, error: 'Window not found.' }); return; }
  await logAudit({ actor: (req.user?.email as string || ''), action: 'maintenance.delete', resource: 'MaintenanceWindow', resourceId: String(req.params.id) });
  res.json({ success: true });
};

/**
 * POST /api/admin/maintenance/windows/:id/notify — re-send the announcement.
 * Useful when a window was created quietly, or as a reminder before it starts.
 */
export const renotifyWindow = async (req: Request, res: Response): Promise<void> => {
  const window = await MaintenanceWindow.findById(req.params.id);
  if (!window) { res.status(404).json({ success: false, error: 'Window not found.' }); return; }
  const result = await notifyMaintenance(window, 'scheduled', { markNotified: true });
  await logAudit({ actor: (req.user?.email as string || ''), action: 'maintenance.notify', resource: 'MaintenanceWindow', resourceId: String(window._id), after: result });
  res.json({ success: true, data: result });
};

/** GET /api/admin/maintenance/windows/upcoming — public-facing, next 30 days. */
export const upcomingWindows = async (_req: Request, res: Response): Promise<void> => {
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const windows = await MaintenanceWindow.find({
    state: { $in: ['scheduled', 'in-progress'] },
    scheduledStart: { $lte: thirtyDays },
    scheduledEnd: { $gte: now },
  }).sort({ scheduledStart: 1 }).lean();
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ success: true, data: windows });
};

export default { listWindows, createWindow, updateWindow, deleteWindow, renotifyWindow, upcomingWindows };
