import { Request, Response } from 'express';
import { Order, Organization } from '../models';
import { OrderStatus } from '../models/order.model';
import ixpManager from '../services/ixpManager.service';
import { notify } from '../services/notification.service';
import { logAudit } from '../services/audit.service';

const VALID: OrderStatus[] = [
  'submitted',
  'reviewing',
  'approved',
  'provisioning',
  'completed',
  'rejected',
  'cancelled',
];

/**
 * GET /api/admin/orders?status=
 * All orders, newest first, enriched with org name/asn.
 */
export const listOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: any = {};
    if (req.query.status && VALID.includes(req.query.status as OrderStatus)) {
      filter.status = req.query.status;
    }
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .populate('organization', 'name asn')
      .lean();
    res.json({
      success: true,
      data: orders.map((o: any) => ({
        ...o,
        orgName: o.organization?.name || '—',
        orgAsn: o.organization?.asn,
        organization: o.organization?._id || o.organization,
      })),
    });
  } catch (error) {
    console.error('Admin list orders error:', error);
    res.status(500).json({ success: false, error: 'Failed to load orders.' });
  }
};

/**
 * PUT /api/admin/orders/:id   { status?, adminNotes?, message? }
 * Advances order status, records a timeline entry, and (on provisioning)
 * notifies IXP Manager when configured.
 */
export const updateOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, adminNotes, message } = req.body as {
      status?: OrderStatus;
      adminNotes?: string;
      message?: string;
    };
    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found.' });
      return;
    }
    const prevStatus = order.status;

    if (adminNotes !== undefined) order.adminNotes = String(adminNotes);

    if (status) {
      if (!VALID.includes(status)) {
        res.status(400).json({ success: false, error: 'Invalid status.' });
        return;
      }
      order.status = status;
      order.updates.push({
        status,
        message: String(message || '').trim(),
        by: req.user?.email || 'admin',
        at: new Date(),
      });

      // Best-effort provisioning hook
      if (status === 'provisioning') {
        const org = await Organization.findById(order.organization);
        const result = await ixpManager.notifyProvision({
          orderId: String(order._id),
          type: order.type,
          asn: org?.asn,
          location: order.location,
          speed: order.speed,
          addon: order.addon,
        });
        if (result.ok) order.ixpManagerRef = `ack-${Date.now()}`;
      }
    }

    await order.save();
    if (status) {
      await notify(String(order.organization), {
        type: 'order',
        title: `Order ${status}`,
        body: `Your ${order.type.replace('_', ' ')} order is now ${status}.`,
        link: 'services',
      });
      await logAudit({
        actor: req.user?.email,
        action: 'order.update',
        resource: 'Order',
        resourceId: String(order._id),
        before: { status: prevStatus },
        after: { status },
      });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    console.error('Admin update order error:', error);
    res.status(500).json({ success: false, error: 'Failed to update order.' });
  }
};

/**
 * GET /api/admin/ixpmanager/members  — preview members pulled from IXP Manager.
 */
export const ixpMembers = async (_req: Request, res: Response): Promise<void> => {
  const result = await ixpManager.fetchMembers();
  if (result.ok) {
    res.json({ success: true, data: result.data });
  } else {
    res.json({ success: false, error: result.error || 'Failed to fetch members.' });
  }
};

export default { listOrders, updateOrder, ixpMembers };
