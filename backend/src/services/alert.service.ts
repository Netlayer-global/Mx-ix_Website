import { AlertRule, Port } from '../models';
import { IAlertRule } from '../models/alertRule.model';
import { notify } from './notification.service';
import { sendEmail } from './mailer.service';
import { portCurrentMbps, portsCurrentMbps } from './portMetrics.service';

const SPEED_MBPS: Record<string, number> = {
  '1G': 1000,
  '10G': 10000,
  '25G': 25000,
  '100G': 100000,
  '400G': 400000,
};

const speedToMbps = (speed?: string): number => SPEED_MBPS[String(speed || '').toUpperCase()] || 10000;

/**
 * Traffic samples come exclusively from Zabbix (via Grafana). When monitoring is
 * unavailable for the rule's scope the rule is skipped rather than evaluated —
 * these alerts send real email/Slack/webhook notifications, so firing on an
 * estimated value would be worse than not firing at all.
 */

async function dispatchChannels(rule: IAlertRule, message: string): Promise<void> {
  const tasks: Promise<any>[] = [];

  (rule.channels.email || []).forEach((to) => {
    if (to) tasks.push(sendEmail(to, `MX-IX alert: ${rule.name}`, `<p>${message}</p>`));
  });

  if (rule.channels.slackWebhook) {
    tasks.push(
      fetch(rule.channels.slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `:rotating_light: MX-IX alert — ${rule.name}\n${message}` }),
      }).catch(() => {})
    );
  }

  if (rule.channels.webhook) {
    tasks.push(
      fetch(rule.channels.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert: rule.name, message, at: new Date().toISOString() }),
      }).catch(() => {})
    );
  }

  await Promise.all(tasks);
}

/**
 * Evaluate a single rule; trigger if breached and past cooldown.
 * Returns the triggered message (or null).
 */
export async function evaluateRule(rule: IAlertRule, force = false): Promise<string | null> {
  if (!rule.enabled && !force) return null;

  // cooldown
  if (!force && rule.lastTriggeredAt) {
    const elapsedMin = (Date.now() - new Date(rule.lastTriggeredAt).getTime()) / 60000;
    if (elapsedMin < (rule.cooldownMinutes || 60)) return null;
  }

  let capacityMbps = 0;
  let sample: { inbound: number; outbound: number } | null = null;

  if (rule.scope === 'port' && rule.portId) {
    const port = await Port.findById(rule.portId);
    if (!port) return null;
    capacityMbps = speedToMbps(port.speed);
    sample = await portCurrentMbps(port);
  } else {
    const ports = await Port.find({ organization: rule.organization });
    if (!ports.length) return null;
    capacityMbps = ports.reduce((s, p) => s + speedToMbps(p.speed), 0);
    sample = await portsCurrentMbps(ports);
  }

  if (!sample) {
    // No measurable traffic for this scope — skip quietly, don't guess.
    // A manual "test" still fires so members can verify their channels.
    if (!force) return null;
    sample = { inbound: 0, outbound: 0 };
  }
  if (!capacityMbps) capacityMbps = 10000;

  let value = 0;
  let unit = 'Mbps';
  let threshold = 0;

  if (rule.metric === 'traffic_in') {
    value = sample.inbound;
    threshold = rule.thresholdMbps || 0;
  } else if (rule.metric === 'traffic_out') {
    value = sample.outbound;
    threshold = rule.thresholdMbps || 0;
  } else {
    // utilization %
    value = Math.round((Math.max(sample.inbound, sample.outbound) / capacityMbps) * 100);
    threshold = rule.thresholdPercent || 0;
    unit = '%';
  }

  const breached = force || (threshold > 0 && value >= threshold);
  if (!breached) return null;

  const message = force
    ? `${rule.name}: test notification — ${rule.metric.replace('_', ' ')} currently ${value}${unit} (threshold ${threshold}${unit}).`
    : `${rule.name}: ${rule.metric.replace('_', ' ')} is ${value}${unit} (threshold ${threshold}${unit}).`;

  rule.lastTriggeredAt = new Date();
  await rule.save();

  await notify(String(rule.organization), {
    type: 'alert',
    title: `Alert: ${rule.name}`,
    body: message,
    link: 'alerts',
  });
  await dispatchChannels(rule, message);

  return message;
}

/** Periodic sweep across all enabled rules. */
export async function evaluateAllAlerts(): Promise<void> {
  try {
    const rules = await AlertRule.find({ enabled: true });
    for (const rule of rules) {
      await evaluateRule(rule);
    }
  } catch (err) {
    console.error('[Alerts] Sweep failed:', err);
  }
}

export default { evaluateRule, evaluateAllAlerts };
