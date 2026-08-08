import config from '../config/environment';

/**
 * Mailman 3 REST API integration for peering mailing list management.
 *
 * Members can subscribe/unsubscribe from IXP mailing lists through the portal.
 * Admin can configure which lists are available.
 *
 * Mailman 3 REST API docs: https://mailman.readthedocs.io/en/latest/src/mailman/rest/docs/
 *
 * Config via env vars:
 *   MAILMAN_API_URL     — e.g. http://localhost:8001/3.1
 *   MAILMAN_API_USER    — REST API admin user
 *   MAILMAN_API_PASSWORD — REST API admin password
 *   MAILMAN_LISTS       — comma-separated list IDs to offer, e.g. "peering@lists.mx-ix.net,noc@lists.mx-ix.net"
 */

const getConfig = () => ({
  apiUrl: (process.env.MAILMAN_API_URL || '').replace(/\/+$/, ''),
  user: process.env.MAILMAN_API_USER || 'restadmin',
  password: process.env.MAILMAN_API_PASSWORD || '',
  lists: (process.env.MAILMAN_LISTS || '').split(',').map((s) => s.trim()).filter(Boolean),
});

const authHeader = (): string => {
  const { user, password } = getConfig();
  return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
};

const callMailman = async (
  path: string,
  opts: { method?: string; body?: any } = {}
): Promise<{ ok: boolean; status: number; data?: any; error?: string }> => {
  const { apiUrl } = getConfig();
  if (!apiUrl) return { ok: false, status: 0, error: 'Mailman API URL is not configured.' };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    const headers: Record<string, string> = {
      Authorization: authHeader(),
      Accept: 'application/json',
    };
    if (opts.body) headers['Content-Type'] = 'application/x-www-form-urlencoded';

    const r = await fetch(`${apiUrl}${path}`, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? new URLSearchParams(opts.body).toString() : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const text = await r.text();
    let data: any;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }

    if (!r.ok) {
      return { ok: false, status: r.status, error: `Mailman returned ${r.status}`, data };
    }
    return { ok: true, status: r.status, data };
  } catch (err: any) {
    return { ok: false, status: 0, error: err?.name === 'AbortError' ? 'Mailman request timed out' : err?.message || 'Mailman unreachable' };
  }
};

/** Check if the Mailman integration is configured and reachable. */
export const isConfigured = (): boolean => {
  const { apiUrl, lists } = getConfig();
  return !!(apiUrl && lists.length);
};

export const testConnection = async (): Promise<{ ok: boolean; version?: string; error?: string }> => {
  const res = await callMailman('/system/versions');
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, version: res.data?.mailman_version };
};

/** Get the available mailing lists that members can subscribe to. */
export const getAvailableLists = (): string[] => getConfig().lists;

/** Check if an email is subscribed to a list. */
export const isSubscribed = async (listId: string, email: string): Promise<boolean> => {
  const res = await callMailman(`/lists/${encodeURIComponent(listId)}/member/${encodeURIComponent(email)}`);
  return res.ok;
};

/** Get subscription status for an email across all configured lists. */
export const getSubscriptions = async (email: string): Promise<Record<string, boolean>> => {
  const lists = getConfig().lists;
  const result: Record<string, boolean> = {};
  for (const listId of lists) {
    result[listId] = await isSubscribed(listId, email);
  }
  return result;
};

/** Subscribe an email to a list. */
export const subscribe = async (listId: string, email: string, name?: string): Promise<{ ok: boolean; error?: string }> => {
  const lists = getConfig().lists;
  if (!lists.includes(listId)) return { ok: false, error: 'This list is not available for subscription.' };

  const body: any = {
    list_id: listId,
    subscriber: email,
    pre_verified: 'true',
    pre_confirmed: 'true',
    pre_approved: 'true',
  };
  if (name) body.display_name = name;

  const res = await callMailman('/members', { method: 'POST', body });
  if (res.ok) return { ok: true };
  if (res.status === 409) return { ok: true }; // Already subscribed
  return { ok: false, error: res.error || 'Subscribe failed.' };
};

/** Unsubscribe an email from a list. */
export const unsubscribe = async (listId: string, email: string): Promise<{ ok: boolean; error?: string }> => {
  const lists = getConfig().lists;
  if (!lists.includes(listId)) return { ok: false, error: 'This list is not available.' };

  const res = await callMailman(
    `/lists/${encodeURIComponent(listId)}/member/${encodeURIComponent(email)}`,
    { method: 'DELETE' }
  );
  if (res.ok) return { ok: true };
  if (res.status === 404) return { ok: true }; // Already not subscribed
  return { ok: false, error: res.error || 'Unsubscribe failed.' };
};

export default {
  isConfigured,
  testConnection,
  getAvailableLists,
  isSubscribed,
  getSubscriptions,
  subscribe,
  unsubscribe,
};
