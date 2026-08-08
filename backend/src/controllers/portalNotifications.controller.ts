import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/environment';
import { Notification, PortalUser, Organization } from '../models';
import { registerClient, removeClient } from '../services/notification.service';

/**
 * GET /api/portal/notifications
 */
export const listNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const items = await Notification.find({ organization: req.organization!._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    const unread = await Notification.countDocuments({ organization: req.organization!._id, read: false });
    res.json({ success: true, data: { notifications: items, unread } });
  } catch (error) {
    console.error('List notifications error:', error);
    res.status(500).json({ success: false, error: 'Failed to load notifications.' });
  }
};

/**
 * POST /api/portal/notifications/:id/read
 */
export const markRead = async (req: Request, res: Response): Promise<void> => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, organization: req.organization!._id },
      { read: true }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update.' });
  }
};

/**
 * POST /api/portal/notifications/read-all
 */
export const markAllRead = async (req: Request, res: Response): Promise<void> => {
  try {
    await Notification.updateMany({ organization: req.organization!._id, read: false }, { read: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update.' });
  }
};

/**
 * GET /api/portal/stream?token=<portal jwt>
 * Server-Sent Events stream for live notifications + heartbeat.
 * EventSource can't set headers, so the portal token comes via query param.
 */
export const stream = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = String(req.query.token || '');
    if (!token) {
      res.status(401).end();
      return;
    }
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    if (decoded.kind !== 'portal') {
      res.status(401).end();
      return;
    }
    const user = await PortalUser.findById(decoded.userId);
    if (!user || !user.isActive) {
      res.status(401).end();
      return;
    }
    const org = await Organization.findById(user.organization);
    if (!org || org.status !== 'active') {
      res.status(403).end();
      return;
    }
    const orgId = String(org._id);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    registerClient(orgId, res);

    const heartbeat = setInterval(() => {
      try {
        res.write(`event: ping\ndata: ${Date.now()}\n\n`);
      } catch {
        /* ignore */
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      removeClient(orgId, res);
    });
  } catch {
    res.status(401).end();
  }
};

export default { listNotifications, markRead, markAllRead, stream };
