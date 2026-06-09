import { Request, Response } from 'express';
import { Settings, getSettingsWithSecrets } from '../models/settings.model';

// Mask a secret, revealing only the last 4 chars
const mask = (secret?: string): string =>
  secret ? `${'•'.repeat(Math.max(4, secret.length - 4))}${secret.slice(-4)}` : '';

// A value is "masked" (unchanged) if empty or contains the bullet char
const isMasked = (val?: string): boolean => !val || val.includes('•');

/**
 * GET /api/settings  (admin)
 * Returns integration settings with secrets masked.
 */
export const getSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const doc = await getSettingsWithSecrets();
    res.json({
      success: true,
      data: {
        grafana: {
          enabled: doc.grafana.enabled,
          url: doc.grafana.url,
          zabbixDatasourceUid: doc.grafana.zabbixDatasourceUid,
          hasApiKey: !!doc.grafana.apiKey,
          apiKeyMask: mask(doc.grafana.apiKey),
        },
        zabbix: {
          enabled: doc.zabbix.enabled,
          url: doc.zabbix.url,
          hasApiToken: !!doc.zabbix.apiToken,
          apiTokenMask: mask(doc.zabbix.apiToken),
        },
        updatedAt: doc.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ success: false, error: 'Failed to get settings' });
  }
};

/**
 * PUT /api/settings  (admin)
 * Updates integration settings. Secret fields are only overwritten when a
 * new (non-masked) value is supplied, so the UI can submit masked values safely.
 */
export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { grafana, zabbix } = req.body;
    const doc = await getSettingsWithSecrets();

    if (grafana) {
      if (grafana.enabled !== undefined) doc.grafana.enabled = !!grafana.enabled;
      if (grafana.url !== undefined) doc.grafana.url = String(grafana.url).trim().replace(/\/$/, '');
      if (grafana.zabbixDatasourceUid !== undefined)
        doc.grafana.zabbixDatasourceUid = String(grafana.zabbixDatasourceUid).trim();
      if (grafana.apiKey !== undefined && !isMasked(grafana.apiKey))
        doc.grafana.apiKey = String(grafana.apiKey).trim();
    }

    if (zabbix) {
      if (zabbix.enabled !== undefined) doc.zabbix.enabled = !!zabbix.enabled;
      if (zabbix.url !== undefined) doc.zabbix.url = String(zabbix.url).trim().replace(/\/$/, '');
      if (zabbix.apiToken !== undefined && !isMasked(zabbix.apiToken))
        doc.zabbix.apiToken = String(zabbix.apiToken).trim();
    }

    await doc.save();

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
};

/**
 * POST /api/settings/test/grafana  (admin)
 * Pings Grafana's health endpoint. Uses provided url/apiKey if present
 * (to test before saving), otherwise the stored values.
 */
export const testGrafana = async (req: Request, res: Response): Promise<void> => {
  try {
    let { url, apiKey } = req.body as { url?: string; apiKey?: string };

    if (!url || isMasked(apiKey)) {
      const doc = await getSettingsWithSecrets();
      url = url || doc.grafana.url;
      if (isMasked(apiKey)) apiKey = doc.grafana.apiKey;
    }

    if (!url || !apiKey) {
      res.json({ success: false, error: 'Grafana URL and API key are required' });
      return;
    }

    const cleanUrl = url.replace(/\/$/, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${cleanUrl}/api/health`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const health = (await response.json().catch(() => ({}))) as any;

    res.json({
      success: response.ok,
      data: {
        connected: response.ok,
        status: response.status,
        version: health?.version || 'unknown',
        database: health?.database || 'unknown',
      },
      message: response.ok ? 'Connected to Grafana successfully' : `Grafana returned ${response.status}`,
    });
  } catch (error: any) {
    console.error('Test Grafana error:', error);
    res.json({
      success: false,
      error: error?.name === 'AbortError' ? 'Connection timed out' : 'Failed to reach Grafana',
    });
  }
};

/**
 * POST /api/settings/test/zabbix  (admin)
 * Validates the Zabbix API URL (apiinfo.version) and, if a token is provided,
 * verifies it with an authenticated call.
 */
export const testZabbix = async (req: Request, res: Response): Promise<void> => {
  try {
    let { url, apiToken } = req.body as { url?: string; apiToken?: string };

    if (!url || isMasked(apiToken)) {
      const doc = await getSettingsWithSecrets();
      url = url || doc.zabbix.url;
      if (isMasked(apiToken)) apiToken = doc.zabbix.apiToken;
    }

    if (!url) {
      res.json({ success: false, error: 'Zabbix URL is required' });
      return;
    }

    // Normalize to the JSON-RPC endpoint
    const base = url.replace(/\/$/, '');
    const endpoint = base.endsWith('api_jsonrpc.php') ? base : `${base}/api_jsonrpc.php`;

    const rpc = async (method: string, params: any, auth?: string) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const body: any = { jsonrpc: '2.0', method, params, id: 1 };
      const headers: Record<string, string> = { 'Content-Type': 'application/json-rpc' };
      // Zabbix 6.4+ prefers bearer header; older uses "auth" field
      if (auth) {
        headers.Authorization = `Bearer ${auth}`;
        body.auth = auth;
      }
      const r = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return (await r.json().catch(() => ({}))) as any;
    };

    // 1) connectivity + version (no auth required)
    const versionRes = await rpc('apiinfo.version', {});
    if (!versionRes?.result) {
      res.json({ success: false, error: 'Could not reach Zabbix API at that URL' });
      return;
    }

    // 2) token validation (if provided)
    if (apiToken) {
      const authRes = await rpc('host.get', { countOutput: true, limit: 1 }, apiToken);
      if (authRes?.error) {
        res.json({
          success: false,
          error: 'Reached Zabbix, but the API token is invalid',
          data: { version: versionRes.result },
        });
        return;
      }
    }

    res.json({
      success: true,
      data: { connected: true, version: versionRes.result },
      message: `Connected to Zabbix ${versionRes.result}`,
    });
  } catch (error: any) {
    console.error('Test Zabbix error:', error);
    res.json({
      success: false,
      error: error?.name === 'AbortError' ? 'Connection timed out' : 'Failed to reach Zabbix',
    });
  }
};

export default { getSettings, updateSettings, testGrafana, testZabbix };
