import { Request, Response } from 'express';
import zohoBooks from '../services/zohoBooks.service';
import { getEffectiveZohoBooks } from '../models/settings.model';

/**
 * GET /api/portal/billing/invoices
 * Read-only invoices for the org's linked Zoho contact.
 */
export const listInvoices = async (req: Request, res: Response): Promise<void> => {
  try {
    const org = req.organization!;
    const cfg = await getEffectiveZohoBooks();
    if (!cfg.enabled) {
      res.json({ success: true, data: { configured: false, linked: !!org.zohoContactId, invoices: [] } });
      return;
    }
    if (!org.zohoContactId) {
      res.json({ success: true, data: { configured: true, linked: false, invoices: [] } });
      return;
    }

    const result = await zohoBooks.listInvoices(org.zohoContactId);
    if (!result.ok) {
      res.json({ success: false, error: result.error });
      return;
    }
    const invoices = (result.invoices || []).map((i: any) => ({
      invoiceId: i.invoice_id,
      number: i.invoice_number,
      status: i.status,
      date: i.date,
      dueDate: i.due_date,
      total: i.total,
      balance: i.balance,
      currency: i.currency_code,
    }));
    res.json({ success: true, data: { configured: true, linked: true, invoices } });
  } catch (error) {
    console.error('Portal billing list error:', error);
    res.status(500).json({ success: false, error: 'Failed to load invoices.' });
  }
};

/**
 * GET /api/portal/billing/invoices/:id/pdf
 * Streams the invoice PDF (ownership verified server-side).
 */
export const invoicePdf = async (req: Request, res: Response): Promise<void> => {
  try {
    const org = req.organization!;
    if (!org.zohoContactId) {
      res.status(400).json({ success: false, error: 'No Zoho contact linked.' });
      return;
    }
    const result = await zohoBooks.getInvoicePdf(org.zohoContactId, String(req.params.id));
    if (!result.ok || !result.pdf) {
      res.status(502).json({ success: false, error: result.error || 'Could not fetch PDF.' });
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${req.params.id}.pdf"`);
    res.send(result.pdf);
  } catch (error) {
    console.error('Portal billing pdf error:', error);
    res.status(500).json({ success: false, error: 'Failed to load PDF.' });
  }
};

export default { listInvoices, invoicePdf };
