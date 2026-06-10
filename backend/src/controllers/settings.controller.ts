import { Request, Response } from 'express';
import { Settings, getSettingsWithSecrets } from '../models/settings.model';
import ixpManager from '../services/ixpManager.service';
import zohoBooks from '../services/zohoBooks.service';
import { logAudit } from '../services/audit.service';

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
        ixpManager: {
          enabled: doc.ixpManager.enabled,
          url: doc.ixpManager.url,
          hasApiKey: !!doc.ixpManager.apiKey,
          apiKeyMask: mask(doc.ixpManager.apiKey),
        },
        zohoBooks: {
          enabled: doc.zohoBooks.enabled,
          region: doc.zohoBooks.region,
          organizationId: doc.zohoBooks.organizationId,
          clientId: doc.zohoBooks.clientId,
          hasClientSecret: !!doc.zohoBooks.clientSecret,
          clientSecretMask: mask(doc.zohoBooks.clientSecret),
          hasRefreshToken: !!doc.zohoBooks.refreshToken,
          refreshTokenMask: mask(doc.zohoBooks.refreshToken),
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

    const { ixpManager } = req.body;
    if (ixpManager) {
      if (ixpManager.enabled !== undefined) doc.ixpManager.enabled = !!ixpManager.enabled;
      if (ixpManager.url !== undefined) doc.ixpManager.url = String(ixpManager.url).trim().replace(/\/$/, '');
      if (ixpManager.apiKey !== undefined && !isMasked(ixpManager.apiKey))
        doc.ixpManager.apiKey = String(ixpManager.apiKey).trim();
    }

    const { zohoBooks } = req.body;
    if (zohoBooks) {
      if (zohoBooks.enabled !== undefined) doc.zohoBooks.enabled = !!zohoBooks.enabled;
      if (zohoBooks.region !== undefined) doc.zohoBooks.region = String(zohoBooks.region).trim() || 'com';
      if (zohoBooks.organizationId !== undefined) doc.zohoBooks.organizationId = String(zohoBooks.organizationId).trim();
      if (zohoBooks.clientId !== undefined) doc.zohoBooks.clientId = String(zohoBooks.clientId).trim();
      if (zohoBooks.clientSecret !== undefined && !isMasked(zohoBooks.clientSecret))
        doc.zohoBooks.clientSecret = String(zohoBooks.clientSecret).trim();
      if (zohoBooks.refreshToken !== undefined && !isMasked(zohoBooks.refreshToken))
        doc.zohoBooks.refreshToken = String(zohoBooks.refreshToken).trim();
    }

    await doc.save();
    await logAudit({ actor: req.user?.email, action: 'settings.update', resource: 'Settings' });

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

/**
 * POST /api/settings/test/ixpmanager  (admin)
 */
export const testIxpManager = async (req: Request, res: Response): Promise<void> => {
  try {
    let { url, apiKey } = req.body as { url?: string; apiKey?: string };
    if (!url || isMasked(apiKey)) {
      const doc = await getSettingsWithSecrets();
      url = url || doc.ixpManager.url;
      if (isMasked(apiKey)) apiKey = doc.ixpManager.apiKey;
    }
    if (!url || !apiKey) {
      res.json({ success: false, error: 'IXP Manager URL and API key are required' });
      return;
    }
    const result = await ixpManager.testConnection(url, apiKey);
    if (result.ok) {
      res.json({
        success: true,
        data: { connected: true, customers: result.data?.customers },
        message: 'Connected to IXP Manager successfully',
      });
    } else {
      res.json({ success: false, error: result.error || 'Connection failed' });
    }
  } catch (error: any) {
    console.error('Test IXP Manager error:', error);
    res.json({ success: false, error: 'Failed to reach IXP Manager' });
  }
};

/**
 * POST /api/settings/test/zoho  (admin)
 */
export const testZoho = async (req: Request, res: Response): Promise<void> => {
  try {
    const { region, organizationId, clientId, clientSecret, refreshToken } = req.body as any;
    const doc = await getSettingsWithSecrets();
    const override: any = {
      region: region || doc.zohoBooks.region,
      organizationId: organizationId || doc.zohoBooks.organizationId,
      clientId: clientId || doc.zohoBooks.clientId,
      clientSecret: isMasked(clientSecret) ? doc.zohoBooks.clientSecret : clientSecret,
      refreshToken: isMasked(refreshToken) ? doc.zohoBooks.refreshToken : refreshToken,
    };
    const result = await zohoBooks.testConnection(override);
    if (result.ok) {
      res.json({ success: true, data: { connected: true, orgName: result.orgName }, message: 'Connected to Zoho Books' });
    } else {
      res.json({ success: false, error: result.error || 'Connection failed' });
    }
  } catch (error) {
    console.error('Test Zoho error:', error);
    res.json({ success: false, error: 'Failed to reach Zoho Books' });
  }
};

export default { getSettings, updateSettings, testGrafana, testZabbix, testIxpManager, testZoho };