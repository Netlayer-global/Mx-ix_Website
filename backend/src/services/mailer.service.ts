import nodemailer from 'nodemailer';
import { EmailTemplate } from '../models';
import { getEffectiveMail, EffectiveMailConfig } from '../models/settings.model';
import { wrapEmailHtml, renderEmail, isFullDocument, EmailLayoutOptions } from './emailLayout';

/**
 * Outgoing mail.
 *
 * The transport is built from the effective config (admin Settings first, then
 * environment). It is cached against a fingerprint of that config, so saving new
 * mail settings in the admin panel takes effect on the next send — no restart.
 */
let transporter: nodemailer.Transporter | null = null;
let transporterKey = '';

const fingerprint = (m: EffectiveMailConfig): string =>
  [m.host, m.port, m.secure, m.user, m.password ? 'set' : 'none'].join('|');

const getTransporter = async (): Promise<{ tx: nodemailer.Transporter | null; mail: EffectiveMailConfig }> => {
  const mail = await getEffectiveMail();
  if (!mail.configured || !mail.host) return { tx: null, mail };

  const key = fingerprint(mail);
  if (!transporter || transporterKey !== key) {
    transporter = nodemailer.createTransport({
      host: mail.host,
      port: mail.port,
      secure: mail.secure,
      ...(mail.user ? { auth: { user: mail.user, pass: mail.password } } : {}),
    });
    transporterKey = key;
  }
  return { tx: transporter, mail };
};

/** Drop the cached transport, e.g. right after mail settings are saved. */
export const resetMailTransport = (): void => {
  transporter = null;
  transporterKey = '';
};

/** Verify the current mail config by opening an SMTP connection. */
export const verifyMailConfig = async (): Promise<{ ok: boolean; error?: string; from?: string; source?: string }> => {
  const { tx, mail } = await getTransporter();
  if (!tx) {
    return { ok: false, error: 'SMTP is not configured. Set a host, username and sender address.' };
  }
  try {
    await tx.verify();
    return { ok: true, from: mail.from, source: mail.source };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'SMTP connection failed.', from: mail.from, source: mail.source };
  }
};

/**
 * Send an email to a list of recipients (BCC). No-op (logs) when SMTP is not configured.
 */
export const sendBulkEmail = async (recipients: string[], subject: string, html: string): Promise<void> => {
  if (!recipients.length) return;
  const { tx, mail } = await getTransporter();
  if (!tx) {
    console.log(`[Mailer] SMTP not configured — would email ${recipients.length} subscriber(s): "${subject}"`);
    return;
  }
  try {
    await tx.sendMail({
      from: mail.from,
      ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
      bcc: recipients,
      subject,
      html: wrapEmailHtml(html, subject, mail.publicUrl),
    });
    console.log(`[Mailer] Sent "${subject}" to ${recipients.length} subscriber(s)`);
  } catch (err) {
    console.error('[Mailer] Failed to send:', err);
  }
};

/**
 * Send an email to a single recipient. Returns false (and logs the body) when
 * SMTP isn't configured, so flows like password reset still work in dev.
 */
export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  opts?: { replyTo?: string; cc?: string[] }
): Promise<boolean> => {
  const { tx, mail } = await getTransporter();
  if (!tx) {
    console.log(`[Mailer] SMTP not configured — would email ${to}: "${subject}"`);
    console.log(`[Mailer] (dev) body:\n${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`);
    return false;
  }
  const replyTo = opts?.replyTo || mail.replyTo;
  try {
    await tx.sendMail({
      from: mail.from,
      to,
      subject,
      // Anything that isn't already a full document gets the branded shell.
      html: wrapEmailHtml(html, subject, mail.publicUrl),
      ...(replyTo ? { replyTo } : {}),
      ...(opts?.cc && opts.cc.length ? { cc: opts.cc } : {}),
    });
    console.log(`[Mailer] Sent "${subject}" to ${to}`);
    return true;
  } catch (err) {
    console.error('[Mailer] Failed to send:', err);
    return false;
  }
};

/**
 * Fill {{placeholder}} variables in a string.
 */
const fillVars = (text: string, vars: Record<string, string | number>): string =>
  text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : ''));

/**
 * Resolve an editable EmailTemplate by key and fill its {{placeholders}}.
 * Falls back to the provided default subject/html when the template is
 * missing, disabled or empty — so every flow keeps working even before an
 * admin has customised the copy.
 */
export const renderTemplate = async (
  key: string,
  vars: Record<string, string | number>,
  fallback: { subject: string; html: string },
  /**
   * Presentation applied when the stored template body is plain HTML rather
   * than a full document — so admin-edited copy still gets the heading, CTA
   * button and footer of the branded shell.
   */
  layout?: Omit<EmailLayoutOptions, 'body' | 'heading'> & { heading?: string }
): Promise<{ subject: string; html: string }> => {
  try {
    const tpl = await EmailTemplate.findOne({ key }).lean();
    if (tpl && tpl.enabled && (tpl.subject || tpl.body)) {
      const subject = fillVars(tpl.subject || fallback.subject, vars);
      const body = fillVars(tpl.body || fallback.html, vars);

      if (isFullDocument(body)) return { subject, html: body };

      return {
        subject,
        html: renderEmail({ ...layout, heading: layout?.heading || subject, body }),
      };
    }
  } catch (err) {
    console.error(`[Mailer] template "${key}" lookup failed, using fallback:`, err);
  }
  return fallback;
};

export default { sendBulkEmail, sendEmail, renderTemplate, verifyMailConfig, resetMailTransport };