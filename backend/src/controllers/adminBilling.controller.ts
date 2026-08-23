import { Request, Response } from 'express';
import { Organization, Port } from '../models';
import { VirtualInterface } from '../models/virtualInterface.model';
import { getEffectiveGrafana } from '../models/settings.model';
import { logAudit } from '../services/audit.service';

/**
 * 95th-percentile billing run.
 *
 * Iterates active organisations, queries their aggregate traffic for the
 * billing period, computes the 95th-percentile, and returns a table ready to
 * be pushed into Zoho Books (or downloaded as CSV).
 *
 * The actual Zoho invoice creation is a separate explicit action — this
 * endpoint only *generates* the billing data.
 */

const percentile = (arr: number[], p: number): number => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return Math.round(sorted[idx] * 100) / 100;
};

/** Query Zabbix for bits-in + bits-out time-series for a port over a month. */
async function monthlySeriesForPort(
  g: { url: string; apiKey: string; zabbixUid: string },
  port: any,
  from: string
): Promise<number[]> {
  if (!g.url || !g.apiKey || !port.zabbixHostId) return [];
  try {
    const iface = (port.zabbixInterface || '').trim();
    const escRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rxFilter = iface ? `/${escRx(iface)}.*[Bb]its received/` : 'Bits received';
    const txFilter = iface ? `/${escRx(iface)}.*[Bb]its sent/` : 'Bits sent';

    const query = async (itemFilter: string): Promise<number[]> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const r = await fetch(`${g.url}/api/ds/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${g.apiKey}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          queries: [
            {
              refId: 'A',
              datasource: { type: 'alexanderzobnin-zabbix-datasource', uid: g.zabbixUid },
              queryType: '0',
              group: { filter: '/.*/' },
              host: { filter: port.zabbixHostId },
              item: { filter: itemFilter },
              options: { showDisabledItems: false, skipEmptyValues: false, useTrends: 'default' },
            },
          ],
          from,
          to: 'now',
        }),
      });
      clearTimeout(timeout);
      if (!r.ok) return [];
      const data = (await r.json()) as any;
      const values = data.results?.A?.frames?.[0]?.data?.values;
      if (!values || !values[1]) return [];
      return (values[1] as number[]).map((v: any) => Math.abs(Number(v) || 0) / 1_000_000); // bits → Mbps
    };

    const [rx, tx] = await Promise.all([query(rxFilter), query(txFilter)]);
    // Total = max(in, out) at each sample (standard IX billing methodology)
    const len = Math.max(rx.length, tx.length);
    const total: number[] = [];
    for (let i = 0; i < len; i++) {
      total.push(Math.max(rx[i] || 0, tx[i] || 0));
    }
    return total;
  } catch {
    return [];
  }
}

export interface BillingLineItem {
  orgId: string;
  orgName: string;
  asn?: number;
  portCount: number;
  sampleCount: number;
  p95Mbps: number;
  peakMbps: number;
  avgMbps: number;
  source: 'zabbix' | 'none';
}

/**
 * GET /api/admin/billing/p95-run?month=2026-07
 *
 * Calculates the 95th-percentile for the given month across all active orgs.
 */
export const p95BillingRun = async (req: Request, res: Response): Promise<void> => {
  try {
    const month = String(req.query.month || '').trim();
    // Default to previous month
    const now = new Date();
    const target = month.match(/^\d{4}-\d{2}$/)
      ? new Date(`${month}-01T00:00:00Z`)
      : new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const from = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-01`;
    const grafanaFrom = `${from}T00:00:00Z`;

    const g = await getEffectiveGrafana();
    const orgs = await Organization.find({ status: 'active' }).lean();
    const allPorts = await Port.find().lean();

    const lines: BillingLineItem[] = [];

    for (const org of orgs) {
      const orgPorts = allPorts.filter((p) => String(p.organization) === String(org._id));
      if (!orgPorts.length) continue;

      // Aggregate monthly traffic across all ports
      let allSamples: number[] = [];
      let source: 'zabbix' | 'none' = 'none';

      if (g.enabled) {
        const portSeries = await Promise.all(
          orgPorts.map((p) => monthlySeriesForPort(g, p, grafanaFrom))
        );
        // Sum across ports at each time index
        const maxLen = Math.max(0, ...portSeries.map((s) => s.length));
        for (let i = 0; i < maxLen; i++) {
          let total = 0;
          for (const s of portSeries) total += s[i] || 0;
          allSamples.push(total);
        }
        if (allSamples.length > 0) source = 'zabbix';
      }

      const p95 = percentile(allSamples, 95);
      const peak = allSamples.length ? Math.max(...allSamples) : 0;
      const avg = allSamples.length
        ? Math.round((allSamples.reduce((a, b) => a + b, 0) / allSamples.length) * 100) / 100
        : 0;

      lines.push({
        orgId: String(org._id),
        orgName: org.name,
        asn: org.asn,
        portCount: orgPorts.length,
        sampleCount: allSamples.length,
        p95Mbps: p95,
        peakMbps: Math.round(peak * 100) / 100,
        avgMbps: avg,
        source,
      });
    }

    // Sort by p95 descending
    lines.sort((a, b) => b.p95Mbps - a.p95Mbps);

    await logAudit({
      actor: req.user?.email,
      action: 'billing.p95Run',
      resource: 'Billing',
      after: { month: from, orgs: lines.length, totalP95: lines.reduce((s, l) => s + l.p95Mbps, 0) },
    });

    res.json({
      success: true,
      data: {
        month: from,
        generatedAt: new Date().toISOString(),
        source: g.enabled ? 'zabbix' : 'none',
        lines,
        totals: {
          orgs: lines.length,
          totalP95Mbps: Math.round(lines.reduce((s, l) => s + l.p95Mbps, 0) * 100) / 100,
          totalPeakMbps: Math.round(Math.max(0, ...lines.map((l) => l.peakMbps)) * 100) / 100,
        },
      },
    });
  } catch (error) {
    console.error('P95 billing run error:', error);
    res.status(500).json({ success: false, error: 'Billing run failed.' });
  }
};

/**
 * GET /api/admin/billing/customer/:orgId/invoices
 * Fetch Zoho invoices for a specific customer (admin view).
 */
export const customerInvoices = async (req: Request, res: Response): Promise<void> => {
  try {
    const org = await Organization.findById(req.params.orgId).select('zohoContactId zohoProfileKey name').lean();
    if (!org) {
      res.status(404).json({ success: false, error: 'Customer not found.' });
      return;
    }
    if (!org.zohoContactId) {
      res.json({ success: true, data: { linked: false, invoices: [] } });
      return;
    }
    const { listInvoices } = await import('../services/zohoBooks.service');
    const result = await listInvoices(org.zohoContactId, (org as any).zohoProfileKey || undefined);
    if (!result.ok) {
      res.json({ success: false, error: result.error });
      return;
    }
    res.json({ success: true, data: { linked: true, invoices: result.invoices || [] } });
  } catch (error) {
    console.error('Customer invoices error:', error);
    res.status(500).json({ success: false, error: 'Failed to load invoices.' });
  }
};

export default { p95BillingRun, customerInvoices };
