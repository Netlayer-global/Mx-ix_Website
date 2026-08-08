import { Request, Response } from 'express';
import { Order, Port, Location } from '../models';
import { OrderType } from '../models/order.model';

export const PORT_SPEEDS = ['1G', '10G', '25G', '100G', '400G'];
export const ADDONS = [
  { id: 'cloud_connect', name: 'Cloud Connect', description: 'Private connectivity to cloud on-ramps' },
  { id: 'ddos', name: 'DDoS Protection', description: 'Volumetric attack mitigation & scrubbing' },
  { id: 'blackholing', name: 'Blackholing', description: 'RTBH community-triggered blackhole' },
  { id: 'vlan', name: 'Additional VLAN', description: 'Extra tagged VLAN on an existing port' },
];

/**
 * GET /api/portal/orders/catalog
 * Options the member can order: locations, port speeds, add-ons.
 */
export const getCatalog = async (_req: Request, res: Response): Promise<void> => {
  try {
    const locations = await Location.find().select('id name region').sort({ name: 1 }).lean();
    res.json({
      success: true,
      data: {
        locations: locations.map((l: any) => ({ id: l.id, name: l.name, region: l.region })),
        speeds: PORT_SPEEDS,
        addons: ADDONS,
      },
    });
  } catch (error) {
    console.error('Order catalog error:', error);
    res.status(500).json({ success: false, error: 'Failed to load catalog.' });
  }
};

/**
 * GET /api/portal/orders
 */
export const listOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const orders = await Order.find({ organization: req.organization!._id }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('List orders error:', error);
    res.status(500).json({ success: false, error: 'Failed to load orders.' });
  }
};

/**
 * POST /api/portal/orders
 */
export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, location, speed, addon, portId, quantity, notes } = req.body as {
      type: OrderType;
      location?: string;
      speed?: string;
      addon?: string;
      portId?: string;
      quantity?: number;
      notes?: string;
    };

    if (!['new_port', 'upgrade', 'addon'].includes(type)) {
      res.status(400).json({ success: false, error: 'Invalid order type.' });
      return;
    }
    if (type === 'new_port' && (!location || !speed)) {
      res.status(400).json({ success: false, error: 'Location and speed are required for a new port.' });
      return;
    }
    if (type === 'upgrade' && (!portId || !speed)) {
      res.status(400).json({ success: false, error: 'Select a port and target speed to upgrade.' });
      return;
    }
    if (type === 'addon' && !addon) {
      res.status(400).json({ success: false, error: 'Select an add-on.' });
      return;
    }

    // Validate port ownership when referenced
    let port = null;
    if (portId) {
      port = await Port.findOne({ _id: portId, organization: req.organization!._id });
      if (!port) {
        res.status(400).json({ success: false, error: 'Port not found.' });
        return;
      }
    }

    const order = await Order.create({
      organization: req.organization!._id,
      type,
      location: location || (port?.location ?? ''),
      speed: speed || '',
      addon: addon || '',
      portId: port?._id || null,
      quantity: quantity || 1,
      notes: String(notes || '').trim(),
      status: 'submitted',
      createdBy: req.portalAuth!.email,
      updates: [{ status: 'submitted', message: 'Order submitted', by: req.portalAuth!.email, at: new Date() }],
    });

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, error: 'Failed to create order.' });
  }
};

/**
 * POST /api/portal/orders/:id/cancel
 */
export const cancelOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await Order.findOne({ _id: req.params.id, organization: req.organization!._id });
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found.' });
      return;
    }
    if (['completed', 'rejected', 'cancelled'].includes(order.status)) {
      res.status(400).json({ success: false, error: 'This order can no longer be cancelled.' });
      return;
    }
    order.status = 'cancelled';
    order.updates.push({ status: 'cancelled', message: 'Cancelled by member', by: req.portalAuth!.email, at: new Date() });
    await order.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel order.' });
  }
};

export default { getCatalog, listOrders, createOrder, cancelOrder };
