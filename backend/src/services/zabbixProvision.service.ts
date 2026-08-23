import { getEffectiveGrafana } from '../models/settings.model';
import { Settings } from '../models/settings.model';

/**
 * Zabbix host auto-provisioning service.
 *
 * When a new member port is provisioned, this creates a Zabbix host for it
 * so monitoring begins immediately rather than relying on manual mapping.
 *
 * Uses Zabbix JSON-RPC API directly (not via Grafana) because host creation
 * is a write operation and Grafana's datasource proxy is read-only.
 */

interface ZabbixConfig {
  url: string;
  apiToken: string;
  enabled: boolean;
}

async function getZabbixConfig(): Promise<ZabbixConfig> {
  try {
    const doc = await Settings.findOne().select('+zabbix.apiToken');
    if (doc?.zabbix?.enabled && doc.zabbix.url && doc.zabbix.apiToken) {
      return { url: doc.zabbix.url, apiToken: doc.zabbix.apiToken, enabled: true };
    }
  } catch (err) {
    console.error('[Zabbix] Failed to read config:', err);
  }
  return { url: '', apiToken: '', enabled: false };
}

async function rpc(cfg: ZabbixConfig, method: string, params: any): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const r = await fetch(`${cfg.url.replace(/\/+$/, '')}/api_jsonrpc.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiToken}` },
      signal: controller.signal,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    clearTimeout(timeout);
    const data = await r.json();
    if (data.error) throw new Error(data.error.data || data.error.message || 'RPC error');
    return data.result;
  } catch (err: any) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * Create or find a Zabbix host for a member port.
 *
 * @returns The Zabbix hostid (string), or null if Zabbix is not configured.
 */
export async function provisionZabbixHost(opts: {
  hostname: string;
  displayName: string;
  ip?: string;
  groupName?: string;
  templateName?: string;
}): Promise<string | null> {
  const cfg = await getZabbixConfig();
  if (!cfg.enabled) return null;

  try {
    // Check if host already exists
    const existing = await rpc(cfg, 'host.get', {
      filter: { host: [opts.hostname] },
      limit: 1,
    });
    if (existing?.length) return existing[0].hostid;

    // Get or create the host group
    const groupName = opts.groupName || 'MX-IX Members';
    let groups = await rpc(cfg, 'hostgroup.get', { filter: { name: [groupName] } });
    let groupId: string;
    if (groups?.length) {
      groupId = groups[0].groupid;
    } else {
      const created = await rpc(cfg, 'hostgroup.create', { name: groupName });
      groupId = created?.groupids?.[0];
      if (!groupId) throw new Error('Failed to create host group');
    }

    // Find template if specified
    let templateIds: string[] = [];
    if (opts.templateName) {
      const templates = await rpc(cfg, 'template.get', {
        filter: { host: [opts.templateName] },
        limit: 1,
      });
      if (templates?.length) templateIds = [templates[0].templateid];
    }

    // Create the host
    const hostParams: any = {
      host: opts.hostname,
      name: opts.displayName,
      groups: [{ groupid: groupId }],
      interfaces: [
        {
          type: 2, // SNMP
          main: 1,
          useip: 1,
          ip: opts.ip || '0.0.0.0',
          dns: '',
          port: '161',
          details: { version: 2, community: '{$SNMP_COMMUNITY}' },
        },
      ],
    };
    if (templateIds.length) {
      hostParams.templates = templateIds.map((id) => ({ templateid: id }));
    }

    const result = await rpc(cfg, 'host.create', hostParams);
    const hostid = result?.hostids?.[0];
    console.log(`[Zabbix] Host created: ${opts.hostname} → hostid ${hostid}`);
    return hostid || null;
  } catch (err: any) {
    console.error(`[Zabbix] Host provision failed for ${opts.hostname}:`, err.message);
    return null;
  }
}

/**
 * Remove a Zabbix host by hostid. Best-effort: errors are logged but not thrown.
 */
export async function removeZabbixHost(hostid: string): Promise<void> {
  const cfg = await getZabbixConfig();
  if (!cfg.enabled || !hostid) return;
  try {
    await rpc(cfg, 'host.delete', [hostid]);
    console.log(`[Zabbix] Host deleted: ${hostid}`);
  } catch (err: any) {
    console.error(`[Zabbix] Host delete failed for ${hostid}:`, err.message);
  }
}

export default { provisionZabbixHost, removeZabbixHost };
