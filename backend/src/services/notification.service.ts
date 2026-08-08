import { Response } from 'express';
import { Notification } from '../models';
import { NotificationType } from '../models/notification.model';

/**
 * In-memory SSE client registry keyed by organization id. Each connected
 * portal session registers its response stream so we can push live events
 * (new notifications, session/traffic ticks) without polling.
 */
const clients = new Map<string, Set<Response>>();

export const registerClient = (orgId: string, res: Response): void => {
  if (!clients.has(orgId)) clients.set(orgId, new Set());
  clients.get(orgId)!.add(res);
};

export const removeClient = (orgId: string, res: Response): void => {
  const set = clients.get(orgId);
  if (set) {
    set.delete(res);
    if (!set.size) clients.delete(orgId);
  }
};

/** Push a raw SSE event to every connected client for an org. */
export const pushEvent = (orgId: string, event: string, data: any): void => {
  const set = clients.get(orgId);
  if (!set || !set.size) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
    } catch {
      set.delete(res);
    }
  }
};

/**
 * Create a notification for an org and push it live over SSE.
 */
export const notify = async (
  orgId: string,
  data: { type: NotificationType; title: string; body?: string; link?: string }
): Promise<void> => {
  try {
    const doc = await Notification.create({
      organization: orgId,
      type: data.type,
      title: data.title,
      body: data.body || '',
      link: data.link || '',
    });
    pushEvent(orgId, 'notification', {
      id: doc._id,
      type: doc.type,
      title: doc.title,
      body: doc.body,
      link: doc.link,
      read: false,
      createdAt: doc.createdAt,
    });
  } catch (err) {
    console.error('[Notify] Failed to create notification:', err);
  }
};

export default { registerClient, removeClient, pushEvent, notify };
