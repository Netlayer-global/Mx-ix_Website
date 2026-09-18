import { Request, Response } from 'express';
import {
  Settings,
  getSettingsWithSecrets,
  getEffectiveZohoProfile,
  normaliseSiteVisibility,
  getEffectiveMail,
} from '../models/settings.model';
import ixpManager from '../services/ixpManager.service';
import zohoBooks from '../services/zohoBooks.service';
import { logAudit } from '../services/audit.service';
import { sendEmail, verifyMailConfig, resetMailTransport } from '../services/mailer.service';
import { renderEmail } from '../services/emailLayout';

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
    const effectiveMail = await getEffectiveMail();
    res.json({
      success: true,
      data: {
        siteVisibility: normaliseSiteVisibility(doc.siteVisibility),
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
        flowGraph: {
          enabled: doc.flowGraph?.enabled || false,
          urlTemplate: doc.flowGraph?.urlTemplate || '',
        },
        peeringDb: {
          enabled: (doc as any).peeringDb?.enabled || false,
          baseUrl: (doc as any).peeringDb?.baseUrl || 'https://www.peeringdb.com/api',
          hasApiKey: !!(doc as any).peeringDb?.apiKey,
          apiKeyMask: mask((doc as any).peeringDb?.apiKey || ''),
          cacheTtlMinutes: (doc as any).peeringDb?.cacheTtlMinutes || 1440,
        },
        contactForm: {
          recipientEmail: doc.contactForm?.recipientEmail || '',
          supportEmail: doc.contactForm?.supportEmail || '',
          ccEmails: doc.contactForm?.ccEmails || '',
        },
        mail: {
          enabled: doc.mail?.enabled || false,
          host: doc.mail?.host || '',
          port: doc.mail?.port || 587,
          secure: doc.mail?.secure || false,
          user: doc.mail?.user || '',
          hasPassword: !!doc.mail?.password,
          passwordMask: mask(doc.mail?.password || ''),
          fromName: doc.mail?.fromName || 'MX-IX',
          fromEmail: doc.mail?.fromEmail || '',
          replyTo: doc.mail?.replyTo || '',
          publicUrl: doc.mail?.publicUrl || '',
          // What is actually in use right now, after env fallback.
          effective: {
            from: effectiveMail.from,
            publicUrl: effectiveMail.publicUrl,
            source: effectiveMail.source,
            configured: effectiveMail.configured,
          },
        },
        zohoProfiles: (doc.zohoProfiles || []).map((p) => ({
          key: p.key,
          label: p.label,
          region: p.region,
          organizationId: p.organizationId,
          clientId: p.clientId,
          hasClientSecret: !!p.clientSecret,
          clientSecretMask: mask(p.clientSecret),
          hasRefreshToken: !!p.refreshToken,
          refreshTokenMask: mask(p.refreshToken),
          enabled: p.enabled,
        })),
        updatedAt: doc.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ success: false, error: 'Failed to get settings' });
  }
};

/**
 * GET /api/settings/public
 * Only exposes the public-page availability map. It intentionally contains no
 * integration settings or secrets, and is used by the public website shell.
 */
export const getPublicSiteSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const doc = await Settings.findOne().select('siteVisibility');
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: { pageVisibility: normaliseSiteVisibility(doc?.siteVisibility) } });
  } catch (error) {
    console.error('Get public site settings error:', error);
    res.status(500).json({ success: false, error: 'Failed to get public site settings' });
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

    const { flowGraph } = req.body;
    if (flowGraph) {
      if (!doc.flowGraph) doc.flowGraph = { enabled: false, urlTemplate: '' } as any;
      if (flowGraph.enabled !== undefined) doc.flowGraph.enabled = !!flowGraph.enabled;
      if (flowGraph.urlTemplate !== undefined) doc.flowGraph.urlTemplate = String(flowGraph.urlTemplate).trim();
    }

    const { contactForm } = req.body;
    if (contactForm) {
      if (!doc.contactForm) doc.contactForm = { recipientEmail: '', supportEmail: '', ccEmails: '' } as any;
      if (contactForm.recipientEmail !== undefined)
        doc.contactForm.recipientEmail = String(contactForm.recipientEmail).trim();
      if (contactForm.supportEmail !== undefined)
        doc.contactForm.supportEmail = String(contactForm.supportEmail).trim();
      if (contactForm.ccEmails !== undefined) doc.contactForm.ccEmails = String(contactForm.ccEmails).trim();
    }

    const { mail } = req.body;
    if (mail) {
      if (!doc.mail) {
        (doc as any).mail = {
          enabled: false,
          host: '',
          port: 587,
          secure: false,
          user: '',
          password: '',
          fromName: 'MX-IX',
          fromEmail: '',
          replyTo: '',
          publicUrl: '',
        };
      }
      if (mail.enabled !== undefined) doc.mail.enabled = !!mail.enabled;
      if (mail.host !== undefined) doc.mail.host = String(mail.host).trim();
      if (mail.port !== undefined) doc.mail.port = Number(mail.port) || 587;
      if (mail.secure !== undefined) doc.mail.secure = !!mail.secure;
      if (mail.user !== undefined) doc.mail.user = String(mail.user).trim();
      if (mail.password !== undefined && !isMasked(mail.password)) doc.mail.password = String(mail.password);
      if (mail.fromName !== undefined) doc.mail.fromName = String(mail.fromName).trim() || 'MX-IX';
      if (mail.fromEmail !== undefined) doc.mail.fromEmail = String(mail.fromEmail).trim();
      if (mail.replyTo !== undefined) doc.mail.replyTo = String(mail.replyTo).trim();
      if (mail.publicUrl !== undefined) doc.mail.publicUrl = String(mail.publicUrl).trim().replace(/\/+$/, '');
      // Nested subdocument changes need an explicit mark to persist.
      doc.markModified('mail');
      // Credentials may have changed — drop the cached SMTP transport.
      resetMailTransport();
    }

    const { peeringDb } = req.body;
    if (peeringDb) {
      if (!doc.peeringDb) (doc as any).peeringDb = { enabled: false, baseUrl: 'https://www.peeringdb.com/api', apiKey: '', cacheTtlMinutes: 1440, syncMaxPrefixes: true, syncIrrAsSet: true };
      if (peeringDb.enabled !== undefined) doc.peeringDb.enabled = !!peeringDb.enabled;
      if (peeringDb.baseUrl !== undefined) doc.peeringDb.baseUrl = String(peeringDb.baseUrl).trim() || 'https://www.peeringdb.com/api';
      if (peeringDb.apiKey && !isMasked(peeringDb.apiKey)) doc.peeringDb.apiKey = String(peeringDb.apiKey).trim();
      if (peeringDb.cacheTtlMinutes !== undefined) doc.peeringDb.cacheTtlMinutes = Number(peeringDb.cacheTtlMinutes) || 1440;
      doc.markModified('peeringDb');
    }

    if (req.body.siteVisibility && typeof req.body.siteVisibility === 'object' && !Array.isArray(req.body.siteVisibility)) {
      doc.siteVisibility = normaliseSiteVisibility(req.body.siteVisibility);
    }

    const { zohoProfiles } = req.body;
    if (Array.isArray(zohoProfiles)) {
      const prevByKey = new Map((doc.zohoProfiles || []).map((p) => [p.key, p]));
      doc.zohoProfiles = zohoProfiles
        .map((p: any) => {
          const prev = prevByKey.get(String(p.key || '').trim());
          return {
            key: String(p.key || '').trim(),
            label: String(p.label || '').trim(),
            region: String(p.region || 'com').trim() || 'com',
            organizationId: String(p.organizationId || '').trim(),
            clientId: String(p.clientId || '').trim(),
            clientSecret: p.clientSecret && !isMasked(p.clientSecret) ? String(p.clientSecret).trim() : prev?.clientSecret || '',
            refreshToken: p.refreshToken && !isMasked(p.refreshToken) ? String(p.refreshToken).trim() : prev?.refreshToken || '',
            enabled: p.enabled !== false,
          };
        })
        .filter((p: any) => p.key) as any;
    }

    await doc.save();
    await logAudit({
      actor: req.user?.email,
      action: 'settings.update',
      resource: 'Settings',
      after: req.body.siteVisibility ? { siteVisibility: normaliseSiteVisibility(doc.siteVisibility) } : undefined,
    });

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

    const rpc = async (method: string, params: any, auth?: { token: string; mode: 'bearer' | 'body' }) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const body: any = { jsonrpc: '2.0', method, params, id: 1 };
      const headers: Record<string, string> = { 'Content-Type': 'application/json-rpc' };
      // Zabbix 6.4+ authenticates API tokens via the "Authorization: Bearer"
      // header; older versions use the JSON-RPC "auth" body param. Sending BOTH
      // makes modern Zabbix reject the request ("token invalid"), so we send
      // exactly one and let the caller fall back to the other.
      if (auth?.mode === 'bearer') headers.Authorization = `Bearer ${auth.token}`;
      if (auth?.mode === 'body') body.auth = auth.token;
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

    // 2) token validation (if provided) — try bearer header, then body param
    if (apiToken) {
      let authRes = await rpc('host.get', { countOutput: true, limit: 1 }, { token: apiToken, mode: 'bearer' });
      if (authRes?.error) {
        authRes = await rpc('host.get', { countOutput: true, limit: 1 }, { token: apiToken, mode: 'body' });
      }
      if (authRes?.error) {
        const detail = authRes.error?.data || authRes.error?.message || '';
        res.json({
          success: false,
          error: `Reached Zabbix, but the API token is invalid${detail ? ` — ${detail}` : ''}`,
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
    const { region, organizationId, clientId, clientSecret, refreshToken, profileKey } = req.body as any;
    const base = await getEffectiveZohoProfile(profileKey);
    const override: any = {
      region: region || base.region,
      organizationId: organizationId || base.organizationId,
      clientId: clientId || base.clientId,
      clientSecret: isMasked(clientSecret) ? base.clientSecret : clientSecret,
      refreshToken: isMasked(refreshToken) ? base.refreshToken : refreshToken,
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

/**
 * POST /api/settings/test/mail  (admin)   { to?: string }
 *
 * Verifies the SMTP connection and, when `to` is given, sends a branded test
 * email so the admin can confirm the sender address and template rendering.
 */
export const testMail = async (req: Request, res: Response): Promise<void> => {
  try {
    const verify = await verifyMailConfig();
    if (!verify.ok) {
      res.json({ success: false, error: verify.error, data: { from: verify.from, source: verify.source } });
      return;
    }

    const to = String(req.body?.to || '').trim();
    if (!to) {
      res.json({
        success: true,
        data: { connected: true, from: verify.from, source: verify.source, sent: false },
        message: `SMTP connection verified. Mail will be sent from ${verify.from}.`,
      });
      return;
    }

    const publicUrl = (await getEffectiveMail()).publicUrl;
    const sent = await sendEmail(
      to,
      'MX-IX mail configuration test',
      renderEmail({
        eyebrow: 'System',
        heading: 'Mail configuration works',
        publicUrl,
        body: `<p style="margin:0 0 14px;">This is a test message from the MX-IX admin panel.</p>
          <p style="margin:0;">If you can read this, outgoing mail is configured correctly. Member emails such as
          password resets will be sent from <strong style="color:#0A0A0B;">${verify.from}</strong> and will link to
          <strong style="color:#0A0A0B;">${publicUrl}</strong>.</p>`,
        footnote: 'Sent from Admin → Integrations → Email. No action is needed.',
      })
    );

    res.json({
      success: sent,
      data: { connected: true, from: verify.from, source: verify.source, sent },
      message: sent ? `Test email sent to ${to}.` : 'SMTP verified but the test email could not be sent.',
    });
  } catch (error: any) {
    console.error('Test mail error:', error);
    res.json({ success: false, error: error?.message || 'Failed to test mail configuration.' });
  }
};

export default { getSettings, updateSettings, testGrafana, testZabbix, testIxpManager, testZoho, testMail };
