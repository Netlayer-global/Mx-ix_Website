import { Request, Response } from 'express';
import {
  AuditLog,
  Announcement,
  EmailTemplate,
  Organization,
  Port,
  Order,
  Ticket,
  Subscriber,
} from '../models';
import { notify } from '../services/notification.service';
import { sendBulkEmail } from '../services/mailer.service';
import { logAudit } from '../services/audit.service';

const SPEED_MBPS: Record<string, number> = { '1G': 1000, '10G': 10000, '25G': 25000, '100G': 100000, '400G': 400000 };
const toMbps = (s?: string) => SPEED_MBPS[String(s || '').toUpperCase()] || 0;

// ── Audit log ──
export const listAudit = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load audit log.' });
  }
};

// ── Announcements ──
export const listAnnouncements = async (_req: Request, res: Response): Promise<void> => {
  try {
    const items = await Announcement.find().sort({ createdAt: -1 }).limit(50).lean();
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load announcements.' });
  }
};

/**
 * POST /api/admin/announcements — broadcast in-app (+ optional email).
 */
export const createAnnouncement = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, body, type, channels, audience } = req.body;
    if (!title || !body) {
      res.status(400).json({ success: false, error: 'Title and body are required.' });
      return;
    }
    const inApp = channels?.inApp !== false;
    const email = !!channels?.email;
    const orgFilter = audience === 'all' ? {} : { status: 'active' };
    const orgs = await Organization.find(orgFilter).select('_id');

    let recipients = 0;
    if (inApp) {
      for (const org of orgs) {
        await notify(String(org._id), {
          type: 'system',
          title,
          body,
          link: 'overview',
        });
        recipients++;
      }
    }

    if (email) {
      const subs = await Subscriber.find().select('email').lean().catch(() => []);
      const emails = (subs as any[]).map((s) => s.email).filter(Boolean);
      if (emails.length) {
        await sendBulkEmail(emails, `MX-IX: ${title}`, `<h2>${title}</h2><p>${body}</p>`);
      }
    }

    const doc = await Announcement.create({
      title,
      body,
      type: ['info', 'maintenance', 'incident'].includes(type) ? type : 'info',
      channels: { inApp, email },
      audience: audience === 'all' ? 'all' : 'active',
      sentBy: req.user?.email || 'admin',
      recipients,
    });
    await logAudit({ actor: req.user?.email, action: 'announcement.broadcast', resource: 'Announcement', resourceId: String(doc._id), after: { title, recipients } });

    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ success: false, error: 'Failed to broadcast announcement.' });
  }
};

// ── Email templates ──
export const listTemplates = async (_req: Request, res: Response): Promise<void> => {
  try {
    const items = await EmailTemplate.find().sort({ key: 1 }).lean();
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load templates.' });
  }
};

export const upsertTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key, name, subject, body, enabled, variables } = req.body;
    if (!key || !name) {
      res.status(400).json({ success: false, error: 'Key and name are required.' });
      return;
    }
    const doc = await EmailTemplate.findOneAndUpdate(
      { key: String(key).trim() },
      {
        key: String(key).trim(),
        name,
        subject: subject || '',
        body: body || '',
        enabled: enabled !== false,
        variables: Array.isArray(variables) ? variables : [],
      },
      { new: true, upsert: true }
    );
    await logAudit({ actor: req.user?.email, action: 'email_template.update', resource: 'EmailTemplate', resourceId: doc.key });
    res.json({ success: true, data: doc });
  } catch (error) {
    console.error('Upsert template error:', error);
    res.status(500).json({ success: false, error: 'Failed to save template.' });
  }
};

export const deleteTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    await EmailTemplate.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete template.' });
  }
};

// ── NOC operations dashboard ──
export const nocDashboard = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [orgs, ports, openOrders, openTickets, urgentTickets] = await Promise.all([
      Organization.find().select('name asn status locations').lean(),
      Port.find().select('location speed status organization').lean(),
      Order.countDocuments({ status: { $in: ['submitted', 'reviewing', 'approved', 'provisioning'] } }),
      Ticket.countDocuments({ status: { $in: ['open', 'pending'] } }),
      Ticket.find({ status: { $in: ['open', 'pending'] }, priority: 'urgent' })
        .select('organization subject')
        .lean(),
    ]);

    // Capacity heatmap by location
    const byLocation = new Map<string, { ports: number; capacityMbps: number; down: number }>();
    ports.forEach((p: any) => {
      const loc = p.location || 'Unassigned';
      const entry = byLocation.get(loc) || { ports: 0, capacityMbps: 0, down: 0 };
      entry.ports += 1;
      entry.capacityMbps += toMbps(p.speed);
      if (p.status === 'down') entry.down += 1;
      byLocation.set(loc, entry);
    });
    const capacity = Array.from(byLocation.entries())
      .map(([location, v]) => ({ location, ...v }))
      .sort((a, b) => b.capacityMbps - a.capacityMbps);

    // Member health summary
    const statusCounts = { active: 0, pending: 0, suspended: 0 };
    orgs.forEach((o: any) => {
      if (o.status in statusCounts) (statusCounts as any)[o.status] += 1;
    });

    // Ports per org for at-risk evaluation
    const portsByOrg = new Map<string, number>();
    ports.forEach((p: any) => portsByOrg.set(String(p.organization), (portsByOrg.get(String(p.organization)) || 0) + 1));
    const urgentByOrg = new Map<string, number>();
    urgentTickets.forEach((t: any) => urgentByOrg.set(String(t.organization), (urgentByOrg.get(String(t.organization)) || 0) + 1));

    const atRisk = orgs
      .map((o: any) => {
        const reasons: string[] = [];
        if (o.status === 'suspended') reasons.push('Suspended');
        if (o.status === 'pending') reasons.push('Awaiting approval');
        if (urgentByOrg.get(String(o._id))) reasons.push('Urgent ticket open');
        if (o.status === 'active' && !portsByOrg.get(String(o._id))) reasons.push('No active ports');
        return reasons.length ? { id: o._id, name: o.name, asn: o.asn, status: o.status, reasons } : null;
      })
      .filter(Boolean);

    res.json({
      success: true,
      data: {
        totals: {
          members: orgs.length,
          ports: ports.length,
          capacityGbps: Math.round((ports.reduce((s: number, p: any) => s + toMbps(p.speed), 0) / 1000) * 10) / 10,
          openOrders,
          openTickets,
          ...statusCounts,
        },
        capacity,
        atRisk,
      },
    });
  } catch (error) {
    console.error('NOC dashboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to load NOC dashboard.' });
  }
};

export default {
  listAudit,
  listAnnouncements,
  createAnnouncement,
  listTemplates,
  upsertTemplate,
  deleteTemplate,
  nocDashboard,
};
