import { Request, Response } from 'express';
import { Organization, Port } from '../models';
import { getEffectiveGrafana } from '../models/settings.model';

/**
 * GET /api/admin/billing/sla-report?month=2026-07
 *
 * Per-member availability report for the billing period. Computes uptime %
 * from Zabbix interface operational status data (1=up, 2=down). When Zabbix is
 * not connected, returns a placeholder structure so the UI can still render.
 */
export const slaReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const month = String(req.query.month || '').trim();
    const now = new Date();
    const target = month.match(/^\d{4}-\d{2}$/)
      ? new Date(`${month}-01T00:00:00Z`)
      : new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const from = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-01`;

    const g = await getEffectiveGrafana();
    const orgs = await Organization.find({ status: 'active' }).lean();
    const allPorts = await Port.find().lean();

    const lines: {
      orgId: string;
      orgName: string;
      asn?: number;
      portCount: number;
      uptimePct: number;
      downtimeMinutes: number;
      source: 'zabbix' | 'estimated';
    }[] = [];

    for (const org of orgs) {
      const orgPorts = allPorts.filter((p) => String(p.organization) === String(org._id));
      if (!orgPorts.length) continue;

      let uptimePct = 99.99; // Default when no data
      let downtimeMinutes = 0;
      let source: 'zabbix' | 'estimated' = 'estimated';

      if (g.enabled) {
        // Query operational status from Zabbix for each port
        // status=1 is up, status=2 is down
        let totalSamples = 0;
        let upSamples = 0;

        for (const port of orgPorts) {
          if (!port.zabbixHostId) continue;
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const iface = (port.zabbixInterface || '').trim();
            const escRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const itemFilter = iface
              ? `/${escRx(iface)}.*[Oo]perational status/`
              : '/[Oo]perational status/';

            const r = await fetch(`${g.url}/api/ds/query`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${g.apiKey}`, 'Content-Type': 'application/json' },
              signal: controller.signal,
              body: JSON.stringify({
                queries: [{
                  refId: 'A',
                  datasource: { type: 'alexanderzobnin-zabbix-datasource', uid: g.zabbixUid },
                  queryType: '0',
                  group: { filter: '/.*/' },
                  host: { filter: port.zabbixHostId },
                  item: { filter: itemFilter },
                  options: { showDisabledItems: false, skipEmptyValues: false, useTrends: 'default' },
                }],
                from: `${from}T00:00:00Z`,
                to: 'now',
              }),
            });
            clearTimeout(timeout);
            if (r.ok) {
              const data = (await r.json()) as any;
              const values = data.results?.A?.frames?.[0]?.data?.values?.[1] as number[] | undefined;
              if (values?.length) {
                totalSamples += values.length;
                upSamples += values.filter((v) => v === 1).length;
                source = 'zabbix';
              }
            }
          } catch {
            // skip this port
          }
        }

        if (totalSamples > 0) {
          uptimePct = Math.round((upSamples / totalSamples) * 10000) / 100;
          // Assuming 5-min sample interval
          const downSamples = totalSamples - upSamples;
          downtimeMinutes = Math.round(downSamples * 5);
        }
      }

      lines.push({
        orgId: String(org._id),
        orgName: org.name,
        asn: org.asn,
        portCount: orgPorts.length,
        uptimePct,
        downtimeMinutes,
        source,
      });
    }

    // Sort by uptime ascending (worst first for attention)
    lines.sort((a, b) => a.uptimePct - b.uptimePct);

    res.json({
      success: true,
      data: {
        month: from,
        generatedAt: new Date().toISOString(),
        slaTarget: 99.99,
        lines,
        summary: {
          orgs: lines.length,
          avgUptime: lines.length ? Math.round((lines.reduce((s, l) => s + l.uptimePct, 0) / lines.length) * 100) / 100 : 0,
          belowSla: lines.filter((l) => l.uptimePct < 99.99).length,
        },
      },
    });
  } catch (error) {
    console.error('SLA report error:', error);
    res.status(500).json({ success: false, error: 'SLA report generation failed.' });
  }
};

export default { slaReport };
