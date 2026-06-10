import mongoose, { Document, Schema } from 'mongoose';
import config from '../config/environment';

/**
 * Integration settings (Grafana / Zabbix) — managed from the Admin panel.
 * Stored as a singleton document so the whole app shares one config.
 * Secrets (apiKey / apiToken) are stored here but masked before being
 * sent to the client.
 */
export interface ISettingsDocument extends Document {
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
  zohoBooks: {
    enabled: boolean;
    region: string;
    organizationId: string;
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const settingsSchema = new Schema<ISettingsDocument>(
  {
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
    zohoBooks: {
      enabled: { type: Boolean, default: false },
      region: { type: String, default: 'com' },
      organizationId: { type: String, default: '' },
      clientId: { type: String, default: '' },
      clientSecret: { type: String, default: '', select: false },
      refreshToken: { type: String, default: '', select: false },
    },
  },
  { timestamps: true }
);

export const Settings = mongoose.model<ISettingsDocument>('Settings', settingsSchema);

/**
 * Returns the settings doc *including* secret fields, creating the singleton
 * if it doesn't exist yet.
 */
export const getSettingsWithSecrets = async () => {
  let doc = await Settings.findOne().select(
    '+grafana.apiKey +zabbix.apiToken +ixpManager.apiKey +zohoBooks.clientSecret +zohoBooks.refreshToken'
  );
  if (!doc) {
    doc = await Settings.create({});
    doc = await Settings.findOne().select(
      '+grafana.apiKey +zabbix.apiToken +ixpManager.apiKey +zohoBooks.clientSecret +zohoBooks.refreshToken'
    );
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
        zabbixUid: doc.grafana.zabbixDatasourceUid || 'bezy0nzf8ykg0c',
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
    zabbixUid: 'bezy0nzf8ykg0c',
    enabled: !!(config.grafanaUrl && config.grafanaApiKey),
  };
};

export default Settings;
