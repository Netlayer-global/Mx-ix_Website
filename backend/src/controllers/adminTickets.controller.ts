import { Request, Response } from 'express';
import { Ticket } from '../models';
import { TicketStatus } from '../models/ticket.model';
import { notify } from '../services/notification.service';

const STATUSES: TicketStatus[] = ['open', 'pending', 'resolved', 'closed'];

/**
 * GET /api/admin/tickets?status=
 */
export const listTickets = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: any = {};
    if (req.query.status && STATUSES.includes(req.query.status as TicketStatus)) {
      filter.status = req.query.status;
    }
    const tickets = await Ticket.find(filter)
      .sort({ lastReplyAt: -1 })
      .populate('organization', 'name asn')
      .lean();
    res.json({
      success: true,
      data: tickets.map((t: any) => ({
        ...t,
        orgName: t.organization?.name || '—',
        orgAsn: t.organization?.asn,
        organization: t.organization?._id || t.organization,
        messageCount: t.messages?.length || 0,
      })),
    });
  } catch (error) {
    console.error('Admin list tickets error:', error);
    res.status(500).json({ success: false, error: 'Failed to load tickets.' });
  }
};

/**
 * GET /api/admin/tickets/:id
 */
export const getTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const ticket = await Ticket.findById(req.params.id).populate('organization', 'name asn');
    if (!ticket) {
      res.status(404).json({ success: false, error: 'Ticket not found.' });
      return;
    }
    res.json({ success: true, data: ticket });
  } catch (error) {
    console.error('Admin get ticket error:', error);
    res.status(500).json({ success: false, error: 'Failed to load ticket.' });
  }
};

/**
 * POST /api/admin/tickets/:id/reply   { body }
 */
export const replyTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const { body } = req.body;
    if (!body) {
      res.status(400).json({ success: false, error: 'Message is required.' });
      return;
    }
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      res.status(404).json({ success: false, error: 'Ticket not found.' });
      return;
    }
    ticket.messages.push({
      from: 'staff',
      authorName: req.user?.email || 'MX-IX Support',
      body: String(body).trim(),
      at: new Date(),
    });
    ticket.status = 'pending';
    ticket.lastReplyAt = new Date();
    await ticket.save();
    await notify(String(ticket.organization), {
      type: 'ticket',
      title: 'New support reply',
      body: `MX-IX replied to "${ticket.subject}".`,
      link: 'support',
    });
    res.json({ success: true, data: ticket });
  } catch (error) {
    console.error('Admin reply ticket error:', error);
    res.status(500).json({ success: false, error: 'Failed to reply.' });
  }
};

/**
 * PUT /api/admin/tickets/:id   { status?, assignedTo?, priority? }
 */
export const updateTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, assignedTo, priority } = req.body;
    const update: any = {};
    if (status && STATUSES.includes(status)) update.status = status;
    if (assignedTo !== undefined) update.assignedTo = String(assignedTo);
    if (priority) update.priority = priority;
    const ticket = await Ticket.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!ticket) {
      res.status(404).json({ success: false, error: 'Ticket not found.' });
      return;
    }
    res.json({ success: true, data: ticket });
  } catch (error) {
    console.error('Admin update ticket error:', error);
    res.status(500).json({ success: false, error: 'Failed to update ticket.' });
  }
};

export default { listTickets, getTicket, replyTicket, updateTicket };
