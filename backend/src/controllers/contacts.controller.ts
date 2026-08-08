import { Request, Response } from 'express';
import { ContactInfo, ContactSubmission } from '../models';
import { getEffectiveContactForm } from '../models/settings.model';
import { sendEmail } from '../services/mailer.service';

const esc = (s: any) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** Branded, website-style HTML email for a contact/port-request enquiry. */
const buildEnquiryEmail = (
  department: string,
  rows: Array<[string, any]>,
  message: string
): { subject: string; html: string } => {
  const isSupport = /support|service|tech|noc/i.test(department);
  const kind = isSupport ? 'Tech Support' : 'Sales';
  const accent = '#F20732';
  const ink = '#0A0A0B';

  const rowHtml = rows
    .map(
      ([k, v], i) =>
        `<tr style="background:${i % 2 ? '#fafafa' : '#ffffff'}">` +
        `<td style="padding:10px 16px;border-bottom:1px solid #eee;font:600 11px/1.4 'Courier New',monospace;letter-spacing:.08em;text-transform:uppercase;color:#888;white-space:nowrap;vertical-align:top">${esc(k)}</td>` +
        `<td style="padding:10px 16px;border-bottom:1px solid #eee;font:400 14px/1.5 Arial,sans-serif;color:${ink}">${esc(v)}</td></tr>`
    )
    .join('');

  const html = `<!doctype html><html><body style="margin:0;background:#f3f4f6;padding:24px 0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e5e7eb">
        <!-- header -->
        <tr><td style="background:${ink};padding:28px 32px">
          <div style="font:800 22px/1 Arial,sans-serif;color:#fff;letter-spacing:-0.5px">MX-<span style="color:${accent}">IX</span></div>
          <div style="font:600 11px/1.4 'Courier New',monospace;letter-spacing:.25em;text-transform:uppercase;color:#9ca3af;margin-top:8px">// New ${esc(kind)} Enquiry</div>
        </td></tr>
        <tr><td style="height:4px;background:${accent}"></td></tr>
        <!-- body -->
        <tr><td style="padding:28px 32px">
          <p style="font:400 14px/1.6 Arial,sans-serif;color:#374151;margin:0 0 20px">A new ${esc(kind.toLowerCase())} enquiry was submitted on the MX-IX website. Reply directly to this email to respond to the sender.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-collapse:collapse">${rowHtml}</table>
          ${
            message
              ? `<div style="margin-top:20px"><div style="font:600 11px/1.4 'Courier New',monospace;letter-spacing:.08em;text-transform:uppercase;color:#888;margin-bottom:8px">Message</div>` +
                `<div style="font:400 14px/1.6 Arial,sans-serif;color:${ink};background:#fafafa;border-left:3px solid ${accent};padding:14px 16px">${esc(message).replace(/\n/g, '<br>')}</div></div>`
              : ''
          }
        </td></tr>
        <!-- footer -->
        <tr><td style="padding:20px 32px;background:#fafafa;border-top:1px solid #eee">
          <div style="font:400 12px/1.5 Arial,sans-serif;color:#9ca3af">Submitted ${esc(new Date().toLocaleString())} · MX-IX — Carrier-Neutral Internet Exchange</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject: `New ${kind} enquiry — ${rows[0]?.[1] || 'MX-IX'}`, html };
};

/**
 * POST /api/contacts/submit  (public)
 * Stores a "Contact Us" / "Request a Port" submission and emails it to the
 * admin-configured recipient (reply-to = the submitter).
 */
export const submitContactForm = async (req: Request, res: Response): Promise<void> => {
  try {
    const b = req.body || {};
    const name = String(b.name || '').trim();
    const email = String(b.email || '').trim();
    if (!name || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      res.status(400).json({ success: false, error: 'Name and a valid email are required.' });
      return;
    }

    const department = String(b.department || 'sales').trim();
    const submission = await ContactSubmission.create({
      name,
      email,
      company: String(b.company || '').trim(),
      phone: String(b.phone || '').trim(),
      department,
      location: String(b.location || '').trim(),
      serviceType: String(b.serviceType || '').trim(),
      message: String(b.message || '').trim(),
      meta: {
        portSpeed: b.portSpeed,
        bandwidth: b.bandwidth,
        cloudProvider: b.cloudProvider,
        cloudRegion: b.cloudRegion,
        asn: b.asn,
        marketingConsent: !!b.marketingConsent,
      },
    });

    const { recipientEmail, supportEmail, ccEmails } = await getEffectiveContactForm();
    // Route to the right inbox: Tech Support / Services → support email; else sales.
    const isSupport = /support|service|tech|noc/i.test(department);
    const toEmail = isSupport ? supportEmail : recipientEmail;
    const rows = ([
      ['Name', name],
      ['Email', email],
      ['Company', b.company],
      ['Phone', b.phone],
      ['Department', department],
      ['Location', b.location],
      ['Service', b.serviceType],
      ['Port speed', b.portSpeed],
      ['Bandwidth', b.bandwidth],
      ['ASN', b.asn],
    ] as Array<[string, any]>).filter(([, v]) => v);
    const { subject, html } = buildEnquiryEmail(department, rows, String(b.message || '').trim());

    const emailed = await sendEmail(toEmail, subject, html, {
      replyTo: email,
      cc: ccEmails,
    });
    if (emailed) {
      submission.emailed = true;
      await submission.save();
    }

    res.json({ success: true, message: 'Your request has been submitted. Our team will contact you shortly.' });
  } catch (error) {
    console.error('Contact submit error:', error);
    res.status(500).json({ success: false, error: 'Failed to submit your request.' });
  }
};

/**
 * GET /api/contacts/submissions  (admin)
 * Recent contact-form submissions.
 */
export const listSubmissions = async (_req: Request, res: Response): Promise<void> => {
  try {
    const submissions = await ContactSubmission.find().sort({ createdAt: -1 }).limit(200).lean();
    res.json({ success: true, data: submissions });
  } catch (error) {
    console.error('List submissions error:', error);
    res.status(500).json({ success: false, error: 'Failed to load submissions.' });
  }
};

// Get all contacts
export const getAllContacts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { department, locationId } = req.query;
    
    const filter: any = {};
    if (department) filter.department = department;
    if (locationId) filter.locationId = locationId;

    const contacts = await ContactInfo.find(filter);

    res.json({
      success: true,
      data: contacts.map(c => ({
        department: c.department,
        locationId: c.locationId,
        phone: c.phone,
        email: c.email,
      })),
    });
  } catch (error) {
    console.error('Get all contacts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get contacts',
    });
  }
};

// Get specific contact
export const getContact = async (req: Request, res: Response): Promise<void> => {
  try {
    const { department, locationId } = req.params;

    const contact = await ContactInfo.findOne({ department, locationId });

    if (!contact) {
      res.status(404).json({
        success: false,
        error: 'Contact not found',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        department: contact.department,
        locationId: contact.locationId,
        phone: contact.phone,
        email: contact.email,
      },
    });
  } catch (error) {
    console.error('Get contact error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get contact',
    });
  }
};

// Create or update contact (upsert)
export const upsertContact = async (req: Request, res: Response): Promise<void> => {
  try {
    const { department, locationId } = req.params;
    const { phone, email } = req.body;

    if (!phone || !email) {
      res.status(400).json({
        success: false,
        error: 'phone and email are required',
      });
      return;
    }

    const contact = await ContactInfo.findOneAndUpdate(
      { department, locationId },
      { phone, email },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({
      success: true,
      data: {
        department: contact.department,
        locationId: contact.locationId,
        phone: contact.phone,
        email: contact.email,
      },
      message: 'Contact updated successfully',
    });
  } catch (error) {
    console.error('Upsert contact error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update contact',
    });
  }
};

// Delete contact
export const deleteContact = async (req: Request, res: Response): Promise<void> => {
  try {
    const { department, locationId } = req.params;

    const contact = await ContactInfo.findOneAndDelete({ department, locationId });

    if (!contact) {
      res.status(404).json({
        success: false,
        error: 'Contact not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Contact deleted successfully',
    });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete contact',
    });
  }
};

export default {
  getAllContacts,
  getContact,
  upsertContact,
  deleteContact,
  submitContactForm,
  listSubmissions,
};
