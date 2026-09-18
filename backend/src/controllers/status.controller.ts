import { Request, Response } from 'express';
import { StatusComponent, Incident, Subscriber, Organization } from '../models';
import { MaintenanceWindow } from '../models/maintenanceWindow.model';
import { newSubscriberToken } from '../models/subscriber.model';
import { sendBulkEmail } from '../services/mailer.service';
import { renderEmail, escapeHtml } from '../services/emailLayout';
import { getPublicUrl } from '../models/settings.model';
import { notify } from '../services/notification.service';

const todayKey = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

const DEFAULT_COMPONENTS = [
  { name: 'Route Servers', group: 'Core Services', order: 1 },
  { name: 'Peering Fabric (Switching)', group: 'Core Services', order: 2 },
  { name: 'Public Website & Portal', group: 'Core Services', order: 3 },
  { name: 'Looking Glass', group: 'Core Services', order: 4 },
  { name: 'DNS Resolvers', group: 'Core Services', order: 5 },
  { name: 'MX-IX Mumbai', group: 'Locations', order: 6 },
  { name: 'MX-IX Delhi', group: 'Locations', order: 7 },
  { name: 'MX-IX Chennai', group: 'Locations', order: 8 },
  { name: 'MX-IX UAE', group: 'Locations', order: 9 },
];

/**
 * Ensure a default component set exists.
 *
 * Runs from the scheduled snapshot job, not from the public read path — a GET
 * must never write.
 */
export const ensureSeeded = async (): Promise<void> => {
  const count = await StatusComponent.countDocuments();
  if (count === 0) {
    await StatusComponent.insertMany(
      DEFAULT_COMPONENTS.map((c) => ({ ...c, status: 'operational', uptime: 100, isActive: true }))
    );
  }
};

const rank: Record<string, number> = {
  operational: 0,
  maintenance: 1,
  degraded: 2,
  partial_outage: 3,
  major_outage: 4,
};

/** How many days of daily history each component retains. */
export const HISTORY_DAYS = 90;

// Map an incident impact to a component status.
const impactToStatus = (impact: string): string =>
  impact === 'critical'
    ? 'major_outage'
    : impact === 'major'
    ? 'partial_outage'
    : impact === 'maintenance'
    ? 'maintenance'
    : 'degraded';

/** Stamp today's entry on a component, keeping the worst status seen today. */
const stampToday = (c: any): void => {
  const key = todayKey();
  const idx = c.history.findIndex((h: any) => h.date === key);
  if (idx === -1) c.history.push({ date: key, status: c.status });
  else if ((rank[c.status] ?? 0) > (rank[c.history[idx].status] ?? 0)) c.history[idx].status = c.status;
};

/** Uptime % over the days actually recorded. Returns null when nothing is recorded. */
const uptimeFromHistory = (history: { status: string }[]): number | null => {
  if (!history.length) return null;
  const opDays = history.filter((h) => h.status === 'operational').length;
  return Math.round((opDays / history.length) * 10000) / 100;
};

/**
 * Recompute the status of the given components from the currently ACTIVE
 * (non-resolved) incidents. A component with no active incident returns to
 * 'operational'. Called whenever incidents change so resolving an incident
 * clears the affected components' outage state automatically.
 */
const reconcileComponentsFor = async (names: string[]) => {
  const unique = Array.from(new Set((names || []).filter(Boolean)));
  if (!unique.length) return;
  const active = await Incident.find({ status: { $ne: 'resolved' } });
  for (const name of unique) {
    const c = await StatusComponent.findOne({ name });
    if (!c) continue;
    let target = 'operational';
    for (const inc of active) {
      if (inc.affectedComponents?.includes(name)) {
        const s = impactToStatus(inc.impact);
        if ((rank[s] ?? 0) > (rank[target] ?? 0)) target = s;
      }
    }
    if (c.status !== target) {
      c.status = target as any;
      stampToday(c);
      c.uptime = uptimeFromHistory(c.history) ?? 100;
      await c.save();
    }
  }
};

const overallFromComponents = (components: any[]) => {
  const worst = components.reduce((acc, c) => Math.max(acc, rank[c.status] ?? 0), 0);
  switch (worst) {
    case 4: return { status: 'major_outage', label: 'Major System Outage' };
    case 3: return { status: 'partial_outage', label: 'Partial System Outage' };
    case 2: return { status: 'degraded', label: 'Degraded Performance' };
    case 1: return { status: 'maintenance', label: 'Under Maintenance' };
    default: return { status: 'operational', label: 'All Systems Operational' };
  }
};

/**
 * Record today's snapshot for every component and recompute uptime.
 *
 * This is driven by a scheduled job (see app.ts) rather than by page views, so
 * the history is a continuous daily record instead of "whenever somebody
 * happened to open the status page".
 */
export const recordSnapshot = async (): Promise<void> => {
  const components = await StatusComponent.find();
  for (const c of components) {
    stampToday(c);
    if (c.history.length > HISTORY_DAYS) c.history = c.history.slice(c.history.length - HISTORY_DAYS);
    c.uptime = uptimeFromHistory(c.history) ?? 100;
    await c.save();
  }
};

/** Seed if needed, then snapshot. Entry point for the scheduled job. */
export const runStatusSnapshot = async (): Promise<void> => {
  await ensureSeeded();
  await recordSnapshot();
};

// ── Subscriber notifications ────────────────────────────────────────────────

/**
 * Email active subscribers about an incident. Every message carries a
 * one-click unsubscribe link built from the subscriber's token.
 *
 * Sent per-subscriber (not BCC) because the unsubscribe link is unique to each
 * recipient. Kept sequential with a small batch size to avoid hammering SMTP.
 */
const notifySubscribers = async (subject: string, bodyLines: string[], heading?: string) => {
  try {
    const [subs, publicUrl] = await Promise.all([
      Subscriber.find({ active: true }).select('email token'),
      getPublicUrl(),
    ]);
    if (!subs.length) return;

    const body = bodyLines
      .filter(Boolean)
      .map((l) => `<p style="margin:0 0 12px;">${escapeHtml(l)}</p>`)
      .join('');

    // Group by token so each recipient gets their own unsubscribe URL.
    for (const s of subs) {
      const unsubscribe = `${publicUrl}/api/status/unsubscribe?token=${encodeURIComponent(s.token || '')}`;
      const html = renderEmail({
        eyebrow: 'Status Update',
        heading: heading || subject,
        publicUrl,
        body,
        cta: { label: 'View status page', url: `${publicUrl}/status` },
        footnote: `You are receiving this because you subscribed to MX-IX status updates. <a href="${unsubscribe}" style="color:#475569;">Unsubscribe</a>.`,
      });
      await sendBulkEmail([s.email], subject, html);
    }
  } catch (err) {
    console.error('[Status] notify failed:', err);
  }
};

/**
 * Push an in-app notification to every member so a logged-in portal user sees
 * the incident without having to visit the public status page.
 */
const notifyMembersOfIncident = async (
  incident: { _id: any; title: string; status: string; impact: string; affectedComponents?: string[] },
  message: string
) => {
  try {
    const orgs = await Organization.find({ status: { $ne: 'pending' } }).select('_id').lean();
    const affected = (incident.affectedComponents || []).join(', ');
    const body = [message, affected ? `Affected: ${affected}` : ''].filter(Boolean).join(' · ');
    await Promise.all(
      orgs.map((o: any) =>
        notify(String(o._id), {
          type: 'system',
          title: `${incident.status === 'resolved' ? 'Resolved' : 'Incident'}: ${incident.title}`,
          body,
          link: 'overview',
        })
      )
    );
  } catch (err) {
    console.error('[Status] member notify failed:', err);
  }
};

// ── Public ──────────────────────────────────────────────────────────────────

/**
 * GET /api/status  (public)
 *
 * Read-only: no seeding, no snapshot writes. Cached briefly so the 30s client
 * refresh and any scraping don't turn into per-request database load.
 */
export const getStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const [components, incidents, maintenance] = await Promise.all([
      StatusComponent.find({ isActive: true }).sort({ order: 1, name: 1 }).lean(),
      Incident.find().sort({ createdAt: -1 }).limit(20).lean(),
      MaintenanceWindow.find({
        state: { $in: ['scheduled', 'in-progress'] },
        scheduledStart: { $lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) },
        scheduledEnd: { $gte: now },
      })
        .select('title description affectedComponents state scheduledStart scheduledEnd')
        .sort({ scheduledStart: 1 })
        .lean(),
    ]);

    const overall = overallFromComponents(components);
    res.set('Cache-Control', 'public, max-age=20, stale-while-revalidate=40');
    res.json({
      success: true,
      data: {
        overall,
        components,
        incidents,
        maintenance,
        historyDays: HISTORY_DAYS,
        generatedAt: now.toISOString(),
      },
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
};

// ── Components (admin) ──

/** GET /api/status/components (admin) — includes inactive components. */
export const listComponents = async (_req: Request, res: Response): Promise<void> => {
  try {
    const components = await StatusComponent.find().sort({ order: 1, name: 1 }).lean();
    res.json({ success: true, data: components });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load components' });
  }
};

export const createComponent = async (req: Request, res: Response): Promise<void> => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) {
      res.status(400).json({ success: false, error: 'Component name is required.' });
      return;
    }
    const exists = await StatusComponent.findOne({ name });
    if (exists) {
      res.status(409).json({ success: false, error: 'A component with that name already exists.' });
      return;
    }
    const c = await StatusComponent.create({
      name,
      group: String(req.body?.group || 'Core Services').trim() || 'Core Services',
      status: req.body?.status || 'operational',
      description: String(req.body?.description || '').trim(),
      order: Number(req.body?.order) || 0,
      isActive: req.body?.isActive !== false,
    });
    res.json({ success: true, data: c });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create component' });
  }
};

/**
 * PUT /api/status/components/:id  (admin)
 *
 * Renaming a component cascades to every incident and maintenance window that
 * references it by name — otherwise the old name is silently orphaned and the
 * component's history chart loses its incidents.
 *
 * `uptime` and `history` are computed, never accepted from the client.
 */
export const updateComponent = async (req: Request, res: Response): Promise<void> => {
  try {
    const c = await StatusComponent.findById(req.params.id);
    if (!c) { res.status(404).json({ success: false, error: 'Component not found' }); return; }

    const prevStatus = c.status;
    const prevName = c.name;
    const nextName = req.body?.name !== undefined ? String(req.body.name).trim() : prevName;

    if (!nextName) {
      res.status(400).json({ success: false, error: 'Component name cannot be empty.' });
      return;
    }
    if (nextName !== prevName) {
      const clash = await StatusComponent.findOne({ name: nextName, _id: { $ne: c._id } });
      if (clash) {
        res.status(409).json({ success: false, error: 'Another component already uses that name.' });
        return;
      }
    }

    c.name = nextName;
    if (req.body?.group !== undefined) c.group = String(req.body.group).trim() || 'Core Services';
    if (req.body?.description !== undefined) c.description = String(req.body.description).trim();
    if (req.body?.order !== undefined) c.order = Number(req.body.order) || 0;
    if (req.body?.isActive !== undefined) c.isActive = !!req.body.isActive;
    if (req.body?.status !== undefined) c.status = req.body.status;

    if (req.body?.status && req.body.status !== prevStatus) stampToday(c);
    c.uptime = uptimeFromHistory(c.history) ?? 100;

    await c.save();

    if (nextName !== prevName) {
      await Promise.all([
        Incident.updateMany(
          { affectedComponents: prevName },
          { $set: { 'affectedComponents.$[el]': nextName } },
          { arrayFilters: [{ el: prevName }] }
        ),
        MaintenanceWindow.updateMany(
          { affectedComponents: prevName },
          { $set: { 'affectedComponents.$[el]': nextName } },
          { arrayFilters: [{ el: prevName }] }
        ),
      ]);
    }

    res.json({ success: true, data: c });
  } catch (error) {
    console.error('Update component error:', error);
    res.status(500).json({ success: false, error: 'Failed to update component' });
  }
};

/**
 * DELETE /api/status/components/:id  (admin)
 * Also drops the name from any incident/maintenance reference so nothing points
 * at a component that no longer exists.
 */
export const deleteComponent = async (req: Request, res: Response): Promise<void> => {
  try {
    const c = await StatusComponent.findByIdAndDelete(req.params.id);
    if (c) {
      await Promise.all([
        Incident.updateMany({ affectedComponents: c.name }, { $pull: { affectedComponents: c.name } }),
        MaintenanceWindow.updateMany({ affectedComponents: c.name }, { $pull: { affectedComponents: c.name } }),
      ]);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete component' });
  }
};

// ── Incidents (admin) ──
export const createIncident = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, status, impact, affectedComponents, message, startedAt, resolvedAt } = req.body;
    if (!String(title || '').trim()) {
      res.status(400).json({ success: false, error: 'Incident title is required.' });
      return;
    }
    const incident = await Incident.create({
      title: String(title).trim(),
      status: status || 'investigating',
      impact: impact || 'minor',
      affectedComponents: affectedComponents || [],
      startedAt: startedAt ? new Date(startedAt) : new Date(),
      updates: message ? [{ status: status || 'investigating', message, timestamp: new Date() }] : [],
      resolvedAt: resolvedAt ? new Date(resolvedAt) : status === 'resolved' ? new Date() : null,
    });
    await reconcileComponentsFor(incident.affectedComponents || []);

    const summary = `A new incident has been reported affecting ${
      incident.affectedComponents.join(', ') || 'the exchange'
    }.`;
    notifySubscribers(
      `[${incident.impact}] ${incident.title}`,
      [summary, message ? `Update: ${message}` : '', `Status: ${incident.status}`],
      incident.title
    );
    notifyMembersOfIncident(incident, message || summary);

    res.json({ success: true, data: incident });
  } catch (error) {
    console.error('Create incident error:', error);
    res.status(500).json({ success: false, error: 'Failed to create incident' });
  }
};

// Add an update / change status of an incident
export const updateIncident = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, message, title, impact, startedAt, resolvedAt, affectedComponents } = req.body;
    const incident = await Incident.findById(req.params.id);
    if (!incident) { res.status(404).json({ success: false, error: 'Incident not found' }); return; }
    const prevComponents = [...(incident.affectedComponents || [])];
    const prevStatus = incident.status;

    if (title !== undefined) incident.title = title;
    if (impact !== undefined) incident.impact = impact;
    if (affectedComponents !== undefined) incident.affectedComponents = affectedComponents;
    if (startedAt !== undefined) incident.startedAt = new Date(startedAt);
    if (resolvedAt !== undefined) incident.resolvedAt = resolvedAt ? new Date(resolvedAt) : null;
    if (status !== undefined) {
      incident.status = status;
      if (status === 'resolved' && !incident.resolvedAt) incident.resolvedAt = new Date();
      if (status !== 'resolved') incident.resolvedAt = null;
    }
    if (message) {
      incident.updates.push({ status: status || incident.status, message, timestamp: new Date() });
    }
    await incident.save();

    // Recompute affected components (old + new) from active incidents — this
    // clears outage colour automatically when the incident is resolved.
    await reconcileComponentsFor([...prevComponents, ...(incident.affectedComponents || [])]);

    // Notify on a posted update, or on a status change even without a message
    // (so "resolved" always reaches subscribers and members).
    const becameResolved = incident.status === 'resolved' && prevStatus !== 'resolved';
    if (message || becameResolved) {
      const text = message || (becameResolved ? 'This incident has been resolved.' : '');
      notifySubscribers(
        `${becameResolved ? 'Resolved' : 'Update'}: ${incident.title}`,
        [`[${incident.status}] ${text}`],
        incident.title
      );
      notifyMembersOfIncident(incident, text);
    }

    res.json({ success: true, data: incident });
  } catch (error) {
    console.error('Update incident error:', error);
    res.status(500).json({ success: false, error: 'Failed to update incident' });
  }
};

export const deleteIncident = async (req: Request, res: Response): Promise<void> => {
  try {
    const incident = await Incident.findById(req.params.id);
    await Incident.findByIdAndDelete(req.params.id);
    if (incident) await reconcileComponentsFor(incident.affectedComponents || []);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete incident' });
  }
};

// ── Subscribers ──
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/status/subscribe (public)
export const subscribe = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      res.status(400).json({ success: false, error: 'Please enter a valid email address' });
      return;
    }
    // Re-subscribing an opted-out address issues a fresh token.
    await Subscriber.updateOne(
      { email },
      {
        $set: { email, active: true, unsubscribedAt: null },
        $setOnInsert: { token: newSubscriberToken() },
      },
      { upsert: true }
    );
    // Legacy rows created before tokens existed.
    const doc = await Subscriber.findOne({ email });
    if (doc && !doc.token) {
      doc.token = newSubscriberToken();
      await doc.save();
    }
    res.json({ success: true, message: 'Subscribed to status updates' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to subscribe' });
  }
};

/**
 * GET|POST /api/status/unsubscribe?token=…  (public)
 *
 * Clicked straight from an email, so a GET must work and the response has to be
 * readable in a browser. Always reports success to avoid confirming whether a
 * token exists.
 */
export const unsubscribe = async (req: Request, res: Response): Promise<void> => {
  const token = String(req.query.token || req.body?.token || '').trim();
  try {
    if (token) {
      await Subscriber.updateOne({ token }, { $set: { active: false, unsubscribedAt: new Date() } });
    }
  } catch (error) {
    console.error('Unsubscribe error:', error);
  }

  const wantsJson = req.method === 'POST' || String(req.headers.accept || '').includes('application/json');
  if (wantsJson) {
    res.json({ success: true, message: 'You have been unsubscribed from MX-IX status updates.' });
    return;
  }

  const publicUrl = await getPublicUrl().catch(() => '');
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(
    renderEmail({
      eyebrow: 'Status Updates',
      heading: 'You have been unsubscribed',
      publicUrl,
      body: '<p style="margin:0;">You will no longer receive MX-IX status update emails. You can subscribe again any time from the status page.</p>',
      cta: publicUrl ? { label: 'Back to status page', url: `${publicUrl}/status` } : undefined,
    })
  );
};

// GET /api/status/subscribers (admin) — count + list
export const getSubscribers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const subs = await Subscriber.find().sort({ createdAt: -1 }).lean();
    const active = subs.filter((s) => s.active);
    res.json({
      success: true,
      data: {
        count: active.length,
        total: subs.length,
        subscribers: active.map((s) => s.email),
        all: subs.map((s) => ({
          id: s._id,
          email: s.email,
          active: s.active,
          createdAt: s.createdAt,
          unsubscribedAt: s.unsubscribedAt || null,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get subscribers' });
  }
};

/** DELETE /api/status/subscribers/:id (admin) */
export const deleteSubscriber = async (req: Request, res: Response): Promise<void> => {
  try {
    const removed = await Subscriber.findByIdAndDelete(req.params.id);
    if (!removed) {
      res.status(404).json({ success: false, error: 'Subscriber not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to remove subscriber' });
  }
};

export default {
  getStatus,
  listComponents,
  createComponent,
  updateComponent,
  deleteComponent,
  createIncident,
  updateIncident,
  deleteIncident,
  subscribe,
  unsubscribe,
  getSubscribers,
  deleteSubscriber,
  recordSnapshot,
  runStatusSnapshot,
  ensureSeeded,
};
