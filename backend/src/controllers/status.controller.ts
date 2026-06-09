import { Request, Response } from 'express';
import { StatusComponent, Incident, Subscriber } from '../models';
import { sendBulkEmail } from '../services/mailer.service';

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

// Ensure there is at least a default set of components
const ensureSeeded = async () => {
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

// Record today's snapshot for every component (worst status seen today).
// Computes uptime % over the retained history window (90 days).
export const recordSnapshot = async () => {
  const key = todayKey();
  const components = await StatusComponent.find();
  for (const c of components) {
    const idx = c.history.findIndex((h) => h.date === key);
    if (idx === -1) {
      c.history.push({ date: key, status: c.status });
    } else if ((rank[c.status] ?? 0) > (rank[c.history[idx].status] ?? 0)) {
      c.history[idx].status = c.status; // keep worst of the day
    }
    // keep last 90 days
    if (c.history.length > 90) c.history = c.history.slice(c.history.length - 90);
    // recompute uptime from history (operational days ratio)
    const opDays = c.history.filter((h) => h.status === 'operational').length;
    c.uptime = c.history.length ? Math.round((opDays / c.history.length) * 10000) / 100 : 100;
    await c.save();
  }
};

// Notify subscribers about an incident (email if SMTP configured, else logged)
const notifySubscribers = async (subject: string, bodyLines: string[]) => {
  try {
    const subs = await Subscriber.find({ active: true }).select('email');
    const emails = subs.map((s) => s.email);
    const html = `<div style="font-family:sans-serif"><h2>${subject}</h2>${bodyLines.map((l) => `<p>${l}</p>`).join('')}<hr/><p style="color:#888;font-size:12px">MX-IX Status — you are receiving this because you subscribed to updates.</p></div>`;
    await sendBulkEmail(emails, subject, html);
  } catch (err) {
    console.error('[Status] notify failed:', err);
  }
};

// GET /api/status  (public)
export const getStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    await ensureSeeded();
    await recordSnapshot();
    const components = await StatusComponent.find({ isActive: true }).sort({ order: 1, name: 1 });
    const incidents = await Incident.find().sort({ createdAt: -1 }).limit(20);
    const overall = overallFromComponents(components);
    res.json({ success: true, data: { overall, components, incidents } });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
};

// ── Components (admin) ──
export const createComponent = async (req: Request, res: Response): Promise<void> => {
  try {
    const c = await StatusComponent.create(req.body);
    res.json({ success: true, data: c });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create component' });
  }
};

export const updateComponent = async (req: Request, res: Response): Promise<void> => {
  try {
    const c = await StatusComponent.findById(req.params.id);
    if (!c) { res.status(404).json({ success: false, error: 'Component not found' }); return; }
    const prevStatus = c.status;
    Object.assign(c, req.body);
    // If status changed, reflect it in today's history snapshot immediately
    if (req.body.status && req.body.status !== prevStatus) {
      const key = todayKey();
      const idx = c.history.findIndex((h) => h.date === key);
      if (idx === -1) c.history.push({ date: key, status: c.status });
      else if ((rank[c.status] ?? 0) > (rank[c.history[idx].status] ?? 0)) c.history[idx].status = c.status;
    }
    await c.save();
    res.json({ success: true, data: c });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update component' });
  }
};

export const deleteComponent = async (req: Request, res: Response): Promise<void> => {
  try {
    await StatusComponent.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete component' });
  }
};

// ── Incidents (admin) ──
export const createIncident = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, status, impact, affectedComponents, message, startedAt, resolvedAt } = req.body;
    const incident = await Incident.create({
      title,
      status: status || 'investigating',
      impact: impact || 'minor',
      affectedComponents: affectedComponents || [],
      startedAt: startedAt ? new Date(startedAt) : new Date(),
      updates: message ? [{ status: status || 'investigating', message, timestamp: new Date() }] : [],
      resolvedAt: resolvedAt ? new Date(resolvedAt) : status === 'resolved' ? new Date() : null,
    });
    notifySubscribers(
      `[${incident.impact}] ${incident.title}`,
      [
        `A new incident has been reported affecting: ${incident.affectedComponents.join(', ') || 'the exchange'}.`,
        message ? `Update: ${message}` : '',
        `Status: ${incident.status}`,
      ].filter(Boolean)
    );
    res.json({ success: true, data: incident });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create incident' });
  }
};

// Add an update / change status of an incident
export const updateIncident = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, message, title, impact, startedAt, resolvedAt } = req.body;
    const incident = await Incident.findById(req.params.id);
    if (!incident) { res.status(404).json({ success: false, error: 'Incident not found' }); return; }
    if (title !== undefined) incident.title = title;
    if (impact !== undefined) incident.impact = impact;
    if (startedAt !== undefined) incident.startedAt = new Date(startedAt);
    if (resolvedAt !== undefined) incident.resolvedAt = resolvedAt ? new Date(resolvedAt) : null;
    if (status !== undefined) {
      incident.status = status;
      if (status === 'resolved' && !incident.resolvedAt) incident.resolvedAt = new Date();
    }
    if (message) {
      incident.updates.push({ status: status || incident.status, message, timestamp: new Date() });
      notifySubscribers(
        `Update: ${incident.title}`,
        [`[${status || incident.status}] ${message}`]
      );
    }
    await incident.save();
    res.json({ success: true, data: incident });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update incident' });
  }
};

export const deleteIncident = async (req: Request, res: Response): Promise<void> => {
  try {
    await Incident.findByIdAndDelete(req.params.id);
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
    await Subscriber.updateOne({ email }, { $set: { email, active: true } }, { upsert: true });
    res.json({ success: true, message: 'Subscribed to status updates' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to subscribe' });
  }
};

// GET /api/status/subscribers (admin) — count + list
export const getSubscribers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const subs = await Subscriber.find({ active: true }).sort({ createdAt: -1 });
    res.json({ success: true, data: { count: subs.length, subscribers: subs.map((s) => s.email) } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get subscribers' });
  }
};

export default {
  getStatus,
  createComponent,
  updateComponent,
  deleteComponent,
  createIncident,
  updateIncident,
  deleteIncident,
  subscribe,
  getSubscribers,
};
