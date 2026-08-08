import { Router } from 'express';
import {
  signup,
  login,
  me,
  changePassword,
  forgotPassword,
  resetPassword,
} from '../controllers/portalAuth.controller';
import {
  getOverview,
  getPorts,
  getPeeringSessions,
  getPeeringRoutes,
} from '../controllers/portal.controller';
import { listTeam, addMember, updateMember, removeMember } from '../controllers/portalTeam.controller';
import { setup2fa, enable2fa, disable2fa } from '../controllers/portal2fa.controller';
import { getCatalog, listOrders, createOrder, cancelOrder } from '../controllers/portalOrders.controller';
import { listInvoices, invoicePdf } from '../controllers/portalBilling.controller';
import {
  listTickets,
  getTicket,
  createTicket,
  replyTicket,
  closeTicket,
} from '../controllers/portalTickets.controller';
import { getPortTraffic, getAggregateTraffic, getSflowByAsn, getPortHealth } from '../controllers/portalTraffic.controller';
import {
  getPolicy,
  updatePolicy,
  getNetworks,
  listRequests,
  createRequest,
  respondRequest,
  cancelRequest,
  getMarketplace,
} from '../controllers/portalPeeringExtra.controller';
import {
  listNotifications,
  markRead,
  markAllRead,
  stream,
} from '../controllers/portalNotifications.controller';
import {
  listAlerts,
  createAlert,
  updateAlert,
  deleteAlert,
  testAlert,
} from '../controllers/portalAlerts.controller';
import {
  listBlackholes,
  createBlackhole,
  updateBlackhole,
  deleteBlackhole,
} from '../controllers/portalBlackhole.controller';
import { portalAuthMiddleware, portalRoleMiddleware } from '../middleware';
import { authLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// ── Customer auth ──
router.post('/auth/signup', authLimiter, signup);
router.post('/auth/login', authLimiter, login);
router.post('/auth/forgot-password', authLimiter, forgotPassword);
router.post('/auth/reset-password', authLimiter, resetPassword);

// PeeringDB OAuth
import pdbAuth from '../controllers/portalPeeringDbAuth.controller';
router.get('/auth/peeringdb', pdbAuth.getAuthUrl);
router.post('/auth/peeringdb/callback', pdbAuth.callback);

router.get('/auth/me', portalAuthMiddleware, me);
router.post('/auth/change-password', portalAuthMiddleware, changePassword);
router.post('/auth/2fa/setup', portalAuthMiddleware, setup2fa);
router.post('/auth/2fa/enable', portalAuthMiddleware, enable2fa);
router.post('/auth/2fa/disable', portalAuthMiddleware, disable2fa);

// ── Scoped data (require an active customer account) ──
router.get('/overview', portalAuthMiddleware, getOverview);
router.get('/ports', portalAuthMiddleware, getPorts);
router.get('/peering/sessions', portalAuthMiddleware, getPeeringSessions);
router.get('/peering/routes/:rsId/:neighborId', portalAuthMiddleware, getPeeringRoutes);
router.get('/peering/routes/:rsId/:neighborId/:filter', portalAuthMiddleware, getPeeringRoutes);

// ── Bilateral peering + policy ──
router.get('/peering/policy', portalAuthMiddleware, getPolicy);
router.put('/peering/policy', portalAuthMiddleware, portalRoleMiddleware('admin'), updatePolicy);
router.get('/peering/networks', portalAuthMiddleware, getNetworks);
router.get('/peering/marketplace', portalAuthMiddleware, getMarketplace);
router.get('/peering/requests', portalAuthMiddleware, listRequests);
router.post('/peering/requests', portalAuthMiddleware, createRequest);
router.post('/peering/requests/:id/respond', portalAuthMiddleware, respondRequest);
router.post('/peering/requests/:id/cancel', portalAuthMiddleware, cancelRequest);

// ── Traffic & analytics ──
router.get('/traffic', portalAuthMiddleware, getAggregateTraffic);
router.get('/traffic/sflow', portalAuthMiddleware, getSflowByAsn);
router.get('/ports/:portId/traffic', portalAuthMiddleware, getPortTraffic);
router.get('/ports/:portId/health', portalAuthMiddleware, getPortHealth);

// ── Team management (portal admins only) ──
router.get('/team', portalAuthMiddleware, listTeam);
router.post('/team', portalAuthMiddleware, portalRoleMiddleware('admin'), addMember);
router.put('/team/:userId', portalAuthMiddleware, portalRoleMiddleware('admin'), updateMember);
router.delete('/team/:userId', portalAuthMiddleware, portalRoleMiddleware('admin'), removeMember);

// ── Services & orders ──
router.get('/orders/catalog', portalAuthMiddleware, getCatalog);
router.get('/orders', portalAuthMiddleware, listOrders);
router.post('/orders', portalAuthMiddleware, createOrder);
router.post('/orders/:id/cancel', portalAuthMiddleware, cancelOrder);

// ── Billing (Zoho Books, read-only; admin + billing roles) ──
router.get('/billing/invoices', portalAuthMiddleware, portalRoleMiddleware('admin', 'billing'), listInvoices);
router.get('/billing/invoices/:id/pdf', portalAuthMiddleware, portalRoleMiddleware('admin', 'billing'), invoicePdf);

// ── Support tickets ──
router.get('/tickets', portalAuthMiddleware, listTickets);
router.post('/tickets', portalAuthMiddleware, createTicket);
router.get('/tickets/:id', portalAuthMiddleware, getTicket);
router.post('/tickets/:id/reply', portalAuthMiddleware, replyTicket);
router.post('/tickets/:id/close', portalAuthMiddleware, closeTicket);

// ── Notifications + live stream ──
router.get('/stream', stream); // auth via ?token= (EventSource can't set headers)
router.get('/notifications', portalAuthMiddleware, listNotifications);
router.post('/notifications/read-all', portalAuthMiddleware, markAllRead);
router.post('/notifications/:id/read', portalAuthMiddleware, markRead);

// ── Threshold alerts ──
router.get('/alerts', portalAuthMiddleware, listAlerts);
router.post('/alerts', portalAuthMiddleware, portalRoleMiddleware('admin'), createAlert);
router.put('/alerts/:id', portalAuthMiddleware, portalRoleMiddleware('admin'), updateAlert);
router.delete('/alerts/:id', portalAuthMiddleware, portalRoleMiddleware('admin'), deleteAlert);
router.post('/alerts/:id/test', portalAuthMiddleware, portalRoleMiddleware('admin'), testAlert);

// ── Self-service blackholing ──
router.get('/blackholes', portalAuthMiddleware, listBlackholes);
router.post('/blackholes', portalAuthMiddleware, portalRoleMiddleware('admin'), createBlackhole);
router.put('/blackholes/:id', portalAuthMiddleware, portalRoleMiddleware('admin'), updateBlackhole);
router.delete('/blackholes/:id', portalAuthMiddleware, portalRoleMiddleware('admin'), deleteBlackhole);

// ── Mailing lists (Mailman integration) ──
import mailingListService from '../services/mailingList.service';

router.get('/mailing-lists', portalAuthMiddleware, async (req: any, res: any) => {
  try {
    if (!mailingListService.isConfigured()) {
      return res.json({ success: true, data: { configured: false, lists: [] } });
    }
    const lists = mailingListService.getAvailableLists();
    const subscriptions = await mailingListService.getSubscriptions(req.portalAuth.email);
    res.json({
      success: true,
      data: {
        configured: true,
        lists: lists.map((id) => ({ id, subscribed: subscriptions[id] || false })),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to load mailing list status.' });
  }
});

router.post('/mailing-lists/:listId/subscribe', portalAuthMiddleware, async (req: any, res: any) => {
  try {
    const result = await mailingListService.subscribe(
      req.params.listId,
      req.portalAuth.email,
      req.portalAuth.name
    );
    if (!result.ok) return res.status(400).json({ success: false, error: result.error });
    res.json({ success: true, data: { subscribed: true } });
  } catch {
    res.status(500).json({ success: false, error: 'Subscribe failed.' });
  }
});

router.post('/mailing-lists/:listId/unsubscribe', portalAuthMiddleware, async (req: any, res: any) => {
  try {
    const result = await mailingListService.unsubscribe(req.params.listId, req.portalAuth.email);
    if (!result.ok) return res.status(400).json({ success: false, error: result.error });
    res.json({ success: true, data: { subscribed: false } });
  } catch {
    res.status(500).json({ success: false, error: 'Unsubscribe failed.' });
  }
});

export default router;
