import { getEffectiveZohoBooks } from '../models/settings.model';

/**
 * Zoho Books client (OAuth2 refresh-token flow).
 * We use Zoho Books as the billing system of record — no custom billing engine.
 * Access tokens are short-lived and cached in-memory.
 */

interface ZohoConfig {
  region: string;
  organizationId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

interface TokenCache {
  token: string;
  expiresAt: number;
}
const tokenCache = new Map<string, TokenCache>();

const accountsHost = (region: string) => `https://accounts.zoho.${region || 'com'}`;
const apiHost = (region: string) => `https://www.zohoapis.${region || 'com'}`;

async function getAccessToken(cfg: ZohoConfig): Promise<string | null> {
  const key = `${cfg.clientId}:${cfg.refreshToken}`;
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;

  const params = new URLSearchParams({
    refresh_token: cfg.refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: 'refresh_token',
  });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const r = await fetch(`${accountsHost(cfg.region)}/oauth/v2/token?${params.toString()}`, {
      method: 'POST',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = (await r.json().catch(() => ({}))) as any;
    if (!r.ok || !data.access_token) return null;
    tokenCache.set(key, {
      token: data.access_token,
      expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    });
    return data.access_token;
  } catch {
    return null;
  }
}

async function zohoGet<T = any>(
  cfg: ZohoConfig,
  path: string,
  query: Record<string, string> = {}
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  const token = await getAccessToken(cfg);
  if (!token) return { ok: false, status: 401, error: 'Could not obtain Zoho access token' };

  const qs = new URLSearchParams({ organization_id: cfg.organizationId, ...query }).toString();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const r = await fetch(`${apiHost(cfg.region)}/books/v3${path}?${qs}`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = (await r.json().catch(() => ({}))) as any;
    if (!r.ok) return { ok: false, status: r.status, error: data?.message || `Zoho returned ${r.status}` };
    return { ok: true, status: r.status, data };
  } catch (error: any) {
    return { ok: false, status: 0, error: error?.name === 'AbortError' ? 'Timed out' : 'Could not reach Zoho Books' };
  }
}

/** Test connection: obtain a token and fetch the organization. */
export async function testConnection(override?: Partial<ZohoConfig>): Promise<{ ok: boolean; error?: string; orgName?: string }> {
  const base = await getEffectiveZohoBooks();
  const cfg: ZohoConfig = { ...base, ...(override || {}) } as ZohoConfig;
  if (!cfg.organizationId || !cfg.clientId || !cfg.clientSecret || !cfg.refreshToken) {
    return { ok: false, error: 'Zoho Books is not fully configured.' };
  }
  const res = await zohoGet<any>(cfg, '/organizations');
  if (!res.ok) return { ok: false, error: res.error };
  const org = (res.data?.organizations || []).find((o: any) => String(o.organization_id) === String(cfg.organizationId));
  return { ok: true, orgName: org?.name };
}

/** List invoices for a Zoho contact (customer). */
export async function listInvoices(contactId: string): Promise<{ ok: boolean; error?: string; invoices?: any[] }> {
  const cfg = (await getEffectiveZohoBooks()) as ZohoConfig & { enabled: boolean };
  if (!('enabled' in cfg) || !(cfg as any).enabled) return { ok: false, error: 'Zoho Books not configured.' };
  if (!contactId) return { ok: false, error: 'No Zoho contact linked to this account.' };

  const res = await zohoGet<any>(cfg, '/invoices', { customer_id: contactId });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, invoices: res.data?.invoices || [] };
}

/** Fetch a single invoice's PDF as a Buffer (verifying it belongs to the contact). */
export async function getInvoicePdf(
  contactId: string,
  invoiceId: string
): Promise<{ ok: boolean; error?: string; pdf?: Buffer }> {
  const cfg = (await getEffectiveZohoBooks()) as ZohoConfig & { enabled: boolean };
  if (!(cfg as any).enabled) return { ok: false, error: 'Zoho Books not configured.' };

  const token = await getAccessToken(cfg);
  if (!token) return { ok: false, error: 'Could not obtain Zoho access token' };

  // Verify ownership first
  const detail = await zohoGet<any>(cfg, `/invoices/${encodeURIComponent(invoiceId)}`);
  if (!detail.ok) return { ok: false, error: detail.error };
  if (String(detail.data?.invoice?.customer_id) !== String(contactId)) {
    return { ok: false, error: 'This invoice does not belong to your account.' };
  }

  try {
    const qs = new URLSearchParams({ organization_id: cfg.organizationId, accept: 'pdf' }).toString();
    const r = await fetch(`${apiHost(cfg.region)}/books/v3/invoices/${encodeURIComponent(invoiceId)}?${qs}`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });
    if (!r.ok) return { ok: false, error: `Zoho returned ${r.status}` };
    const buf = Buffer.from(await r.arrayBuffer());
    return { ok: true, pdf: buf };
  } catch {
    return { ok: false, error: 'Could not download invoice PDF' };
  }
}

export default { testConnection, listInvoices, getInvoicePdf };
