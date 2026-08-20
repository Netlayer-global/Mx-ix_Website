import mongoose, { Document, Schema } from 'mongoose';
import config from '../config/environment';

/**
 * Integration settings (Grafana / Zabbix) — managed from the Admin panel.
 * Stored as a singleton document so the whole app shares one config.
 * Secrets (apiKey / apiToken) are stored here but masked before being
 * sent to the client.
 */
export interface ISettingsDocument extends Document {
  /** Public website pages that are available to visitors. */
  siteVisibility: Record<string, boolean>;
  grafana: {
    enabled: boolean;
    url: string;
    apiKey: string;
    zabbixDatasourceUid: string;
  };
  zabbix: {
    enabled: boolean;
    url: string;
    apiToken: string;
  };
  ixpManager: {
    enabled: boolean;
    url: string;
    apiKey: string;
  };
  peeringDb: {
    enabled: boolean;
    /** API base, normally https://www.peeringdb.com/api */
    baseUrl: string;
    /** Server API key — sent as `Authorization: Api-Key <key>`. */
    apiKey: string;
    /** Legacy basic-auth fallback for accounts without an API key. */
    username: string;
    password: string;
    /** How long a fetched `net` record stays fresh before we re-query. */
    cacheTtlMinutes: number;
    /** Pull max-prefix limits from info_prefixes4/6 during sync. */
    syncMaxPrefixes: boolean;
    /** Pull the member's registered as-set (irr_as_set) during sync. */
    syncIrrAsSet: boolean;
  };
  zohoBooks: {
    enabled: boolean;
    region: string;
    organizationId: string;
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  };
  flowGraph: {
    enabled: boolean;
    urlTemplate: string;
  };
  contactForm: {
    recipientEmail: string;
    supportEmail: string;
    ccEmails: string;
  };
  zohoProfiles: Array<{
    key: string;
    label: string;
    region: string;
    organizationId: string;
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    enabled: boolean;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const settingsSchema = new Schema<ISettingsDocument>(
  {
    siteVisibility: {
      type: Map,
      of: Boolean,
      default: {},
    },
    grafana: {
      enabled: { type: Boolean, default: false },
      url: { type: String, default: '' },
      apiKey: { type: String, default: '', select: false },
      zabbixDatasourceUid: { type: String, default: 'bezy0nzf8ykg0c' },
    },
    zabbix: {
      enabled: { type: Boolean, default: false },
      url: { type: String, default: '' },
      apiToken: { type: String, default: '', select: false },
    },
    ixpManager: {
      enabled: { type: Boolean, default: false },
      url: { type: String, default: '' },
      apiKey: { type: String, default: '', select: false },
    },
    peeringDb: {
      enabled: { type: Boolean, default: false },
      baseUrl: { type: String, default: 'https://www.peeringdb.com/api' },
      apiKey: { type: String, default: '', select: false },
      username: { type: String, default: '' },
      password: { type: String, default: '', select: false },
      cacheTtlMinutes: { type: Number, default: 1440 },
      syncMaxPrefixes: { type: Boolean, default: true },
      syncIrrAsSet: { type: Boolean, default: true },
    },
    zohoBooks: {
      enabled: { type: Boolean, default: false },
      region: { type: String, default: 'com' },
      organizationId: { type: String, default: '' },
      clientId: { type: String, default: '' },
      clientSecret: { type: String, default: '', select: false },
      refreshToken: { type: String, default: '', select: false },
    },
    flowGraph: {
      enabled: { type: Boolean, default: false },
      urlTemplate: { type: String, default: '' },
    },
    contactForm: {
      recipientEmail: { type: String, default: '' },
      supportEmail: { type: String, default: '' },
      ccEmails: { type: String, default: '' },
    },
    zohoProfiles: {
      type: [
        new Schema(
          {
            key: { type: String, required: true },
            label: { type: String, default: '' },
            region: { type: String, default: 'com' },
            organizationId: { type: String, default: '' },
            clientId: { type: String, default: '' },
            clientSecret: { type: String, default: '' },
            refreshToken: { type: String, default: '' },
            enabled: { type: Boolean, default: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export const Settings = mongoose.model<ISettingsDocument>('Settings', settingsSchema);

/** Pages that are safe to control from the CMS. Admin and portal routes stay available. */
export const PUBLIC_PAGE_IDS = [
  'home',
  'about',
  'services',
  'locations',
  'networks',
  'members',
  'stats',
  'pricing',
  'contact',
  'technical',
  'lg',
  'status',
  'google-vpp',
  'content-fabric',
  'onboarding',
  'privacy',
  'terms',
] as const;

/**
 * Old Settings documents do not have this field. Always return a complete,
 * predictable visibility map and ignore unrecognised page ids from requests.
 */
export const normaliseSiteVisibility = (value?: unknown): Record<string, boolean> => {
  const source = value instanceof Map ? Object.fromEntries(value) : (value as Record<string, unknown> | undefined);
  return PUBLIC_PAGE_IDS.reduce<Record<string, boolean>>((visibility, pageId) => {
    visibility[pageId] = source?.[pageId] !== false;
    return visibility;
  }, {});
};

/**
 * Returns the settings doc *including* secret fields, creating the singleton
 * if it doesn't exist yet.
 */
const SECRET_FIELDS =
  '+grafana.apiKey +zabbix.apiToken +ixpManager.apiKey +zohoBooks.clientSecret +zohoBooks.refreshToken +peeringDb.apiKey +peeringDb.password';

export const getSettingsWithSecrets = async () => {
  let doc = await Settings.findOne().select(SECRET_FIELDS);
  if (!doc) {
    doc = await Settings.create({});
    doc = await Settings.findOne().select(SECRET_FIELDS);
  }
  return doc!;
};

/**
 * Resolves the effective IXP Manager config (DB only — no env fallback).
 */
export const getEffectiveIxpManager = async (): Promise<{ url: string; apiKey: string; enabled: boolean }> => {
  try {
    const doc = await Settings.findOne().select('+ixpManager.apiKey');
    if (doc && doc.ixpManager?.enabled && doc.ixpManager.url && doc.ixpManager.apiKey) {
      return { url: doc.ixpManager.url, apiKey: doc.ixpManager.apiKey, enabled: true };
    }
  } catch (err) {
    console.error('[Settings] Failed to read IXP Manager config from DB:', err);
  }
  return { url: '', apiKey: '', enabled: false };
};

export interface EffectivePeeringDb {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  username: string;
  password: string;
  cacheTtlMinutes: number;
  syncMaxPrefixes: boolean;
  syncIrrAsSet: boolean;
}

/**
 * Resolves the effective PeeringDB config (DB only — no env fallback).
 *
 * PeeringDB serves read-only data anonymously, so `enabled` only requires the
 * toggle. Credentials raise the rate limit and unlock contact (poc) details;
 * without them a sync still works, just with less data.
 */
export const getEffectivePeeringDb = async (): Promise<EffectivePeeringDb> => {
  const fallback: EffectivePeeringDb = {
    enabled: false,
    baseUrl: 'https://www.peeringdb.com/api',
    apiKey: '',
    username: '',
    password: '',
    cacheTtlMinutes: 1440,
    syncMaxPrefixes: true,
    syncIrrAsSet: true,
  };
  try {
    const doc = await Settings.findOne().select('+peeringDb.apiKey +peeringDb.password');
    if (doc && doc.peeringDb?.enabled) {
      return {
        enabled: true,
        baseUrl: (doc.peeringDb.baseUrl || fallback.baseUrl).replace(/\/+$/, ''),
        apiKey: doc.peeringDb.apiKey || '',
        username: doc.peeringDb.username || '',
        password: doc.peeringDb.password || '',
        cacheTtlMinutes: doc.peeringDb.cacheTtlMinutes ?? fallback.cacheTtlMinutes,
        syncMaxPrefixes: doc.peeringDb.syncMaxPrefixes !== false,
        syncIrrAsSet: doc.peeringDb.syncIrrAsSet !== false,
      };
    }
  } catch (err) {
    console.error('[Settings] Failed to read PeeringDB config from DB:', err);
  }
  return fallback;
};

/**
 * Resolves the effective Zoho Books config (DB only).
 */
export const getEffectiveZohoBooks = async (): Promise<{
  enabled: boolean;
  region: string;
  organizationId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}> => {
  try {
    const doc = await Settings.findOne().select('+zohoBooks.clientSecret +zohoBooks.refreshToken');
    if (
      doc &&
      doc.zohoBooks?.enabled &&
      doc.zohoBooks.organizationId &&
      doc.zohoBooks.clientId &&
      doc.zohoBooks.clientSecret &&
      doc.zohoBooks.refreshToken
    ) {
      return {
        enabled: true,
        region: doc.zohoBooks.region || 'com',
        organizationId: doc.zohoBooks.organizationId,
        clientId: doc.zohoBooks.clientId,
        clientSecret: doc.zohoBooks.clientSecret,
        refreshToken: doc.zohoBooks.refreshToken,
      };
    }
  } catch (err) {
    console.error('[Settings] Failed to read Zoho Books config from DB:', err);
  }
  return { enabled: false, region: 'com', organizationId: '', clientId: '', clientSecret: '', refreshToken: '' };
};

/**
 * Resolves the Zoho config for a given profile key (multi-country). Falls back
 * to the legacy single zohoBooks config when no profile matches.
 */
export const getEffectiveZohoProfile = async (
  profileKey?: string
): Promise<{
  enabled: boolean;
  region: string;
  organizationId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}> => {
  try {
    if (profileKey) {
      const doc = await Settings.findOne();
      const p = (doc?.zohoProfiles || []).find((x) => x.key === profileKey);
      if (p && p.enabled && p.organizationId && p.clientId && p.clientSecret && p.refreshToken) {
        return {
          enabled: true,
          region: p.region || 'com',
          organizationId: p.organizationId,
          clientId: p.clientId,
          clientSecret: p.clientSecret,
          refreshToken: p.refreshToken,
        };
      }
    }
  } catch (err) {
    console.error('[Settings] Failed to read Zoho profile from DB:', err);
  }
  // Fallback to the legacy single config.
  return getEffectiveZohoBooks();
};

/**
 * Resolves the *effective* Grafana/Zabbix config used by the data layer.
 * Priority: DB settings (when enabled + filled) → environment variables.
 */
export const getEffectiveGrafana = async (): Promise<{
  url: string;
  apiKey: string;
  zabbixUid: string;
  enabled: boolean;
}> => {
  try {
    const doc = await Settings.findOne().select('+grafana.apiKey');
    if (doc && doc.grafana?.enabled && doc.grafana.url && doc.grafana.apiKey) {
      return {
        url: doc.grafana.url,
        apiKey: doc.grafana.apiKey,
        zabbixUid: doc.grafana.zabbixDatasourceUid || config.grafanaZabbixUid,
        enabled: true,
      };
    }
  } catch (err) {
    console.error('[Settings] Failed to read Grafana config from DB:', err);
  }

  // Fallback to environment variables
  return {
    url: config.grafanaUrl,
    apiKey: config.grafanaApiKey,
    zabbixUid: config.grafanaZabbixUid,
    enabled: !!(config.grafanaUrl && config.grafanaApiKey),
  };
};

/**
 * Resolves the flow-graph (sFlow) embed config — a URL template containing an
 * `{asn}` placeholder, used to embed a per-member sFlow graph (Grafana/Akvorado)
 * keyed by the customer's ASN.
 */
export const getEffectiveFlowGraph = async (): Promise<{ enabled: boolean; urlTemplate: string }> => {
  try {
    const doc = await Settings.findOne();
    if (doc && doc.flowGraph?.enabled && doc.flowGraph.urlTemplate) {
      return { enabled: true, urlTemplate: doc.flowGraph.urlTemplate };
    }
  } catch (err) {
    console.error('[Settings] Failed to read flow-graph config from DB:', err);
  }
  return { enabled: false, urlTemplate: '' };
};

/**
 * Resolves the contact-form recipient config (where "Contact Us" submissions
 * are emailed). Falls back to the admin email when no recipient is set.
 */
export const getEffectiveContactForm = async (): Promise<{
  recipientEmail: string;
  supportEmail: string;
  ccEmails: string[];
}> => {
  try {
    const doc = await Settings.findOne();
    const recipient = doc?.contactForm?.recipientEmail?.trim();
    const support = doc?.contactForm?.supportEmail?.trim();
    const cc = (doc?.contactForm?.ccEmails || '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    if (recipient || support) {
      return {
        recipientEmail: recipient || support || config.adminEmail,
        supportEmail: support || recipient || config.adminEmail,
        ccEmails: cc,
      };
    }
  } catch (err) {
    console.error('[Settings] Failed to read contact-form config from DB:', err);
  }
  return { recipientEmail: config.adminEmail, supportEmail: config.adminEmail, ccEmails: [] };
};

export default Settings;
