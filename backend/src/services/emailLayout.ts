/**
 * Branded HTML wrapper for transactional email.
 *
 * Styling is deliberately inline and table-based: Gmail, Outlook and Apple Mail
 * strip <style> blocks and ignore most modern CSS. The palette mirrors the
 * website — ink (#0A0A0B) headings, the MX-IX red (#F20732) accent, generous
 * whitespace and a mono eyebrow label.
 */

const INK = '#0A0A0B';
const RED = '#F20732';
const MUTED = '#475569';
const BORDER = '#E5E7EB';
const CANVAS = '#F5F6F7';

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

export interface EmailLayoutOptions {
  /** Small mono label above the headline, e.g. "Member Portal". */
  eyebrow?: string;
  /** Large headline. */
  heading: string;
  /** Main body — already-escaped HTML. */
  body: string;
  /** Optional primary action button. */
  cta?: { label: string; url: string };
  /** Small print under the body, e.g. "link expires in one hour". */
  footnote?: string;
  /** Public site URL, used for the footer link. */
  publicUrl?: string;
}

/** Escape text for safe interpolation into HTML. */
export const escapeHtml = (value: string): string =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** The MX-IX wordmark, rendered with a centred dash bar like the site header. */
const lockup = (): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="font-family:${FONT};font-size:22px;font-weight:800;letter-spacing:-0.04em;color:${INK};line-height:1;">MX</td>
      <td style="padding:0 3px;" valign="middle">
        <div style="width:9px;height:3px;background:${RED};border-radius:1px;"></div>
      </td>
      <td style="font-family:${FONT};font-size:22px;font-weight:800;letter-spacing:-0.04em;color:${INK};line-height:1;">IX</td>
    </tr>
  </table>`;

/**
 * Wrap body content in the MX-IX email shell.
 */
export const renderEmail = (opts: EmailLayoutOptions): string => {
  const site = (opts.publicUrl || 'https://mx-ix.com').replace(/\/+$/, '');
  const siteLabel = site.replace(/^https?:\/\//, '');

  const cta = opts.cta
    ? `
      <tr>
        <td style="padding:28px 0 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background:${RED};">
                <a href="${opts.cta.url}" style="display:inline-block;padding:14px 28px;font-family:${MONO};font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#FFFFFF;text-decoration:none;">${escapeHtml(
        opts.cta.label
      )}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 0 0;font-family:${FONT};font-size:13px;line-height:20px;color:${MUTED};">
          If the button doesn't work, copy this link into your browser:<br />
          <a href="${opts.cta.url}" style="color:${RED};text-decoration:underline;word-break:break-all;">${opts.cta.url}</a>
        </td>
      </tr>`
    : '';

  const footnote = opts.footnote
    ? `
      <tr>
        <td style="padding:28px 0 0;">
          <div style="height:1px;background:${BORDER};line-height:1px;">&nbsp;</div>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 0 0;font-family:${FONT};font-size:12px;line-height:19px;color:${MUTED};">${opts.footnote}</td>
      </tr>`
    : '';

  const eyebrow = opts.eyebrow
    ? `<tr>
         <td style="padding:0 0 14px;font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${RED};">${escapeHtml(
        opts.eyebrow
      )}</td>
       </tr>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(opts.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${CANVAS};-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CANVAS};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFFFF;border:1px solid ${BORDER};">
          <!-- brand bar -->
          <tr><td style="height:4px;background:${RED};line-height:4px;">&nbsp;</td></tr>

          <!-- header -->
          <tr>
            <td style="padding:28px 32px 0;">${lockup()}</td>
          </tr>

          <!-- content -->
          <tr>
            <td style="padding:28px 32px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${eyebrow}
                <tr>
                  <td style="font-family:${FONT};font-size:26px;font-weight:800;letter-spacing:-0.03em;line-height:1.15;color:${INK};">${escapeHtml(
    opts.heading
  )}</td>
                </tr>
                <tr>
                  <td style="padding:18px 0 0;font-family:${FONT};font-size:15px;line-height:24px;color:${MUTED};">${opts.body}</td>
                </tr>
                ${cta}
                ${footnote}
              </table>
            </td>
          </tr>

          <!-- footer -->
          <tr>
            <td style="padding:20px 32px 26px;background:#FAFAFA;border-top:1px solid ${BORDER};">
              <p style="margin:0;font-family:${MONO};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#94A3B8;">
                MX-IX &middot; Neutral Internet Exchange &amp; Peering
              </p>
              <p style="margin:8px 0 0;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">
                <a href="${site}" style="color:${MUTED};text-decoration:none;">${escapeHtml(siteLabel)}</a>
              </p>
            </td>
          </tr>
        </table>

        <p style="margin:16px 0 0;font-family:${FONT};font-size:11px;line-height:17px;color:#94A3B8;max-width:560px;">
          This is an automated message from MX-IX. Please do not reply to this address.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/** True when the HTML is already a complete document (so it must not be wrapped). */
export const isFullDocument = (html: string): boolean => /<!doctype|<html[\s>]/i.test(html);

/**
 * Ensure any HTML we send is wrapped in the MX-IX shell.
 *
 * Flows that build a full document (and admin-authored templates that do the
 * same) pass through untouched. Everything else — alert bodies, notification
 * snippets, simple `<p>` templates edited in the admin panel — is wrapped, so a
 * member never receives an unstyled email.
 */
export const wrapEmailHtml = (html: string, subject: string, publicUrl?: string): string => {
  if (isFullDocument(html)) return html;
  return renderEmail({
    heading: subject,
    body: html,
    publicUrl,
  });
};

export default { renderEmail, escapeHtml, wrapEmailHtml, isFullDocument };
