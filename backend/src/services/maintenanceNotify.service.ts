import { Organization } from '../models';
import { MaintenanceWindow, IMaintenanceWindow } from '../models/maintenanceWindow.model';
import { notify } from './notification.service';
import { sendEmail } from './mailer.service';
import { renderEmail, escapeHtml } from './emailLayout';
import { getPublicUrl } from '../models/settings.model';

/**
 * Maintenance window notifications.
 *
 * The model has always declared `notified` / `notifiedAt`, but nothing wrote
 * them — scheduling a window sent nothing to anyone. This service is the missing
 * piece: it pushes an in-app notification to each affected member and emails
 * their NOC address, then records that it did.
 */

const fmt = (d: Date | string): string =>
  new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';

/** Members in scope: the explicit list, or every non-pending member. */
const resolveRecipients = async (window: IMaintenanceWindow) => {
  const filter =
    window.affectedMembers?.length
      ? { _id: { $in: window.affectedMembers } }
      : { status: { $ne: 'pending' } };
  return Organization.find(filter).select('_id name nocEmail').lean();
};

type Kind = 'scheduled' | 'updated' | 'started' | 'completed' | 'cancelled';

const HEADINGS: Record<Kind, string> = {
  scheduled: 'Planned maintenance scheduled',
  updated: 'Planned maintenance updated',
  started: 'Maintenance has started',
  completed: 'Maintenance completed',
  cancelled: 'Maintenance cancelled',
};

/**
 * Notify members about a maintenance window.
 *
 * `markNotified` is only set for the initial announcement, so later state
 * changes still notify without the flag blocking them.
 */
export async function notifyMaintenance(
  window: IMaintenanceWindow,
  kind: Kind,
  opts: { markNotified?: boolean } = {}
): Promise<{ members: number; emailed: number }> {
  const [orgs, publicUrl] = await Promise.all([resolveRecipients(window), getPublicUrl().catch(() => '')]);

  const heading = HEADINGS[kind];
  const affected = (window.affectedComponents || []).join(', ');
  const windowText = `${fmt(window.scheduledStart)} → ${fmt(window.scheduledEnd)}`;
  const bodyLines = [
    window.description ? escapeHtml(window.description) : '',
    `<strong style="color:#0A0A0B;">Window:</strong> ${escapeHtml(windowText)}`,
    affected ? `<strong style="color:#0A0A0B;">Affected:</strong> ${escapeHtml(affected)}` : '',
  ].filter(Boolean);

  const html = renderEmail({
    eyebrow: 'Planned Maintenance',
    heading,
    publicUrl,
    body: `<p style="margin:0 0 14px;">${escapeHtml(window.title)}</p>${bodyLines
      .map((l) => `<p style="margin:0 0 10px;">${l}</p>`)
      .join('')}`,
    ...(publicUrl ? { cta: { label: 'View status page', url: `${publicUrl}/status` } } : {}),
    footnote:
      kind === 'cancelled'
        ? 'No action is required — this window will not go ahead.'
        : 'Times are shown in UTC. Reply to your usual NOC contact if this window is a problem for your network.',
  });

  let emailed = 0;
  await Promise.all(
    orgs.map(async (o: any) => {
      await notify(String(o._id), {
        type: 'system',
        title: `${heading}: ${window.title}`,
        body: [windowText, affected ? `Affects: ${affected}` : ''].filter(Boolean).join(' · '),
        link: 'overview',
      });
      if (o.nocEmail) {
        const ok = await sendEmail(o.nocEmail, `MX-IX ${heading.toLowerCase()}: ${window.title}`, html);
        if (ok) emailed++;
      }
    })
  );

  if (opts.markNotified) {
    await MaintenanceWindow.updateOne(
      { _id: window._id },
      { $set: { notified: true, notifiedAt: new Date() } }
    );
  }

  console.log(
    `[Maintenance] ${kind} "${window.title}": notified ${orgs.length} member(s), emailed ${emailed} NOC address(es).`
  );
  return { members: orgs.length, emailed };
}

export default { notifyMaintenance };
