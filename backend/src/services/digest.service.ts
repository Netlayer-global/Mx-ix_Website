import { Organization, PortalUser, Order, Ticket, Port } from '../models';
import { sendEmail } from './mailer.service';
import { notify } from './notification.service';

/**
 * Build and send the weekly digest to every active organization's
 * admin/billing logins, and drop an in-app notification.
 */
export async function sendWeeklyDigests(): Promise<number> {
  const orgs = await Organization.find({ status: 'active' });
  let sent = 0;

  for (const org of orgs) {
    try {
      const [portCount, openOrders, openTickets, users] = await Promise.all([
        Port.countDocuments({ organization: org._id }),
        Order.countDocuments({
          organization: org._id,
          status: { $in: ['submitted', 'reviewing', 'approved', 'provisioning'] },
        }),
        Ticket.countDocuments({ organization: org._id, status: { $in: ['open', 'pending'] } }),
        PortalUser.find({ organization: org._id, role: { $in: ['admin', 'billing'] }, isActive: true }),
      ]);

      const summary = `Ports: ${portCount} · Open orders: ${openOrders} · Open tickets: ${openTickets}`;
      const html = `
        <h2>MX-IX weekly summary — ${org.name}</h2>
        <ul>
          <li><strong>Ports:</strong> ${portCount}</li>
          <li><strong>Open orders:</strong> ${openOrders}</li>
          <li><strong>Open support tickets:</strong> ${openTickets}</li>
          <li><strong>ASN:</strong> ${org.asn ? `AS${org.asn}` : '—'}</li>
        </ul>
        <p>Sign in to the member portal for full details.</p>
        <p>— MX-IX</p>`;

      const recipients = users.map((u) => u.email).filter(Boolean);
      if (recipients.length) {
        for (const to of recipients) await sendEmail(to, 'Your weekly MX-IX summary', html);
      }
      await notify(String(org._id), {
        type: 'system',
        title: 'Weekly summary',
        body: summary,
        link: 'overview',
      });
      sent++;
    } catch (err) {
      console.error(`[Digest] Failed for org ${org._id}:`, err);
    }
  }
  console.log(`[Digest] Sent weekly digest to ${sent} organization(s).`);
  return sent;
}

export default { sendWeeklyDigests };
