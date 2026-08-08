import { Request, Response } from 'express';
import { Ticket } from '../models';
import { TicketCategory, TicketPriority } from '../models/ticket.model';

const CATEGORIES: TicketCategory[] = ['technical', 'billing', 'peering', 'provisioning', 'general'];
const PRIORITIES: TicketPriority[] = ['low', 'normal', 'high', 'urgent'];

/**
 * GET /api/portal/tickets
 */
export const listTickets = async (req: Request, res: Response): Promise<void> => {
  try {
    const tickets = await Ticket.find({ organization: req.organization!._id })
      .sort({ lastReplyAt: -1 })
      .lean();
    res.json({ success: true, data: tickets });
  } catch (error) {
    console.error('List tickets error:', error);
    res.status(500).json({ success: false, error: 'Failed to load tickets.' });
  }
};

/**
 * GET /api/portal/tickets/:id
 */
export const getTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.id, organization: req.organization!._id });
    if (!ticket) {
      res.status(404).json({ success: false, error: 'Ticket not found.' });
      return;
    }
    res.json({ success: true, data: ticket });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ success: false, error: 'Failed to load ticket.' });
  }
};

/**
 * POST /api/portal/tickets   { subject, category, priority, body }
 */
export const createTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const { subject, category, priority, body } = req.body;
    if (!subject || !body) {
      res.status(400).json({ success: false, error: 'Subject and message are required.' });
      return;
    }
    const ticket = await Ticket.create({
      organization: req.organization!._id,
      subject: String(subject).trim(),
      category: CATEGORIES.includes(category) ? category : 'general',
      priority: PRIORITIES.includes(priority) ? priority : 'normal',
      status: 'open',
      createdBy: req.portalAuth!.email,
      lastReplyAt: new Date(),
      messages: [
        { from: 'member', authorName: req.portalUser!.name, body: String(body).trim(), at: new Date() },
      ],
    });
    res.status(201).json({ success: true, data: ticket });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ success: false, error: 'Failed to create ticket.' });
  }
};

/**
 * POST /api/portal/tickets/:id/reply   { body }
 */
export const replyTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const { body } = req.body;
    if (!body) {
      res.status(400).json({ success: false, error: 'Message is required.' });
      return;
    }
    const ticket = await Ticket.findOne({ _id: req.params.id, organization: req.organization!._id });
    if (!ticket) {
      res.status(404).json({ success: false, error: 'Ticket not found.' });
      return;
    }
    if (ticket.status === 'closed') {
      res.status(400).json({ success: false, error: 'This ticket is closed.' });
      return;
    }
    ticket.messages.push({ from: 'member', authorName: req.portalUser!.name, body: String(body).trim(), at: new Date() });
    ticket.status = 'open';
    ticket.lastReplyAt = new Date();
    await ticket.save();
    res.json({ success: true, data: ticket });
  } catch (error) {
    console.error('Reply ticket error:', error);
    res.status(500).json({ success: false, error: 'Failed to reply.' });
  }
};

/**
 * POST /api/portal/tickets/:id/close
 */
export const closeTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const ticket = await Ticket.findOneAndUpdate(
      { _id: req.params.id, organization: req.organization!._id },
      { status: 'closed' },
      { new: true }
    );
    if (!ticket) {
      res.status(404).json({ success: false, error: 'Ticket not found.' });
      return;
    }
    res.json({ success: true, data: ticket });
  } catch (error) {
    console.error('Close ticket error:', error);
    res.status(500).json({ success: false, error: 'Failed to close ticket.' });
  }
};

export default { listTickets, getTicket, createTicket, replyTicket, closeTicket };
