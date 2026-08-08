import { getEffectiveZohoBooks, getEffectiveZohoProfile } from '../models/settings.model';

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

// Maps Zoho's raw OAuth error codes to a human-friendly hint.
function explainTokenError(code: string): string {
  switch (code) {
    case 'invalid_client':
      return 'invalid_client — Client ID/Secret galat hai, ya wrong Data Center Region (e.g. India account ko .com pe try kar rahe ho).';
    case 'invalid_code':
    case 'invalid_grant':
      return 'invalid_code — Refresh Token galat/expire/revoked hai. Naya refresh token generate karo.';
    case 'invalid_client_secret':
      return 'invalid_client_secret — Client Secret galat hai.';
    case 'access_denied':
      return 'access_denied — Scope ya app permission ka issue.';
    default:
      return code;
  }
}

async function getAccessToken(cfg: ZohoConfig): Promise<{ token: string | null; error?: string }> {
  const key = `${cfg.clientId}:${cfg.refreshToken}`;
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 30_000) return { token: cached.token };

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
    if (!r.ok || !data.access_token) {
      const code = data?.error || data?.message || `HTTP ${r.status}`;
      return { token: null, error: `Zoho token error: ${explainTokenError(String(code))}` };
    }
    tokenCache.set(key, {
      token: data.access_token,
      expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    });
    return { token: data.access_token };
  } catch (e: any) {
    return {
      token: null,
      error:
        e?.name === 'AbortError'
          ? 'Zoho accounts server timed out — region galat ho sakta hai.'
          : `Could not reach accounts.zoho.${cfg.region || 'com'} — region/network check karo.`,
    };
  }
}

async function zohoGet<T = any>(
  cfg: ZohoConfig,
  path: string,
  query: Record<string, string> = {}
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  const { token, error: tokenErr } = await getAccessToken(cfg);
  if (!token) return { ok: false, status: 401, error: tokenErr || 'Could not obtain Zoho access token' };

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
export async function testConnection(
  override?: Partial<ZohoConfig>,
  profileKey?: string
): Promise<{ ok: boolean; error?: string; orgName?: string }> {
  const base = await getEffectiveZohoProfile(profileKey);
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
export async function listInvoices(
  contactId: string,
  profileKey?: string
): Promise<{ ok: boolean; error?: string; invoices?: any[] }> {
  const cfg = (await getEffectiveZohoProfile(profileKey)) as ZohoConfig & { enabled: boolean };
  if (!('enabled' in cfg) || !(cfg as any).enabled) return { ok: false, error: 'Zoho Books not configured.' };
  if (!contactId) return { ok: false, error: 'No Zoho contact linked to this account.' };

  const res = await zohoGet<any>(cfg, '/invoices', {
    customer_id: contactId,
    per_page: '200',
    sort_column: 'date',
    sort_order: 'D',
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, invoices: res.data?.invoices || [] };
}

/**
 * Search Zoho Books contacts (admin helper for linking a customer to its Zoho
 * contact without leaving the panel). Empty query returns recent contacts.
 */
export async function searchContacts(
  query: string,
  profileKey?: string
): Promise<{ ok: boolean; error?: string; contacts?: Array<{ id: string; name: string; email?: string; companyName?: string }> }> {
  const cfg = (await getEffectiveZohoProfile(profileKey)) as ZohoConfig & { enabled: boolean };
  if (!('enabled' in cfg) || !(cfg as any).enabled) return { ok: false, error: 'Zoho Books not configured.' };

  const res = await zohoGet<any>(cfg, '/contacts', {
    per_page: '20',
    ...(query ? { search_text: query } : {}),
  });
  if (!res.ok) return { ok: false, error: res.error };
  const contacts = (res.data?.contacts || []).map((c: any) => ({
    id: String(c.contact_id),
    name: c.contact_name,
    email: c.email || '',
    companyName: c.company_name || '',
  }));
  return { ok: true, contacts };
}

/** Fetch a single invoice's PDF as a Buffer (verifying it belongs to the contact). */
export async function getInvoicePdf(
  contactId: string,
  invoiceId: string,
  profileKey?: string
): Promise<{ ok: boolean; error?: string; pdf?: Buffer }> {
  const cfg = (await getEffectiveZohoProfile(profileKey)) as ZohoConfig & { enabled: boolean };
  if (!(cfg as any).enabled) return { ok: false, error: 'Zoho Books not configured.' };

  const { token, error: tokenErr } = await getAccessToken(cfg);
  if (!token) return { ok: false, error: tokenErr || 'Could not obtain Zoho access token' };

  // Verify ownership first
  const detail = await zohoGet<any>(cfg, `/invoices/${encodeURIComponent(invoiceId)}`);
  if (!detail.ok) return { ok: false, error: detail.error };
  if (String(detail.data?.invoice?.customer_id) !== String(contactId)) {
    return { ok: false, error: 'This invoice does not belong to your account.' };
  }

  try {
    const qs = new URLSearchParams({ organization_id: cfg.organizationId, accept: 'pdf' }).toString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const r = await fetch(`${apiHost(cfg.region)}/books/v3/invoices/${encodeURIComponent(invoiceId)}?${qs}`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}`, Accept: 'application/pdf' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!r.ok) return { ok: false, error: `Zoho returned ${r.status}` };
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length) return { ok: false, error: 'Zoho returned an empty PDF' };
    return { ok: true, pdf: buf };
  } catch (e: any) {
    return { ok: false, error: e?.name === 'AbortError' ? 'Invoice PDF download timed out' : 'Could not download invoice PDF' };
  }
}

export default { testConnection, listInvoices, getInvoicePdf, searchContacts };
