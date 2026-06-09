import nodemailer from 'nodemailer';
import config from '../config/environment';

let transporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
  if (!config.smtpHost || !config.smtpUser) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: { user: config.smtpUser, pass: config.smtpPass },
    });
  }
  return transporter;
};

/**
 * Send an email to a list of recipients (BCC). No-op (logs) when SMTP is not configured.
 */
export const sendBulkEmail = async (recipients: string[], subject: string, html: string): Promise<void> => {
  if (!recipients.length) return;
  const tx = getTransporter();
  if (!tx) {
    console.log(`[Mailer] SMTP not configured — would email ${recipients.length} subscriber(s): "${subject}"`);
    return;
  }
  try {
    await tx.sendMail({
      from: config.smtpFrom,
      bcc: recipients,
      subject,
      html,
    });
    console.log(`[Mailer] Sent "${subject}" to ${recipients.length} subscriber(s)`);
  } catch (err) {
    console.error('[Mailer] Failed to send:', err);
  }
};

export default { sendBulkEmail };
