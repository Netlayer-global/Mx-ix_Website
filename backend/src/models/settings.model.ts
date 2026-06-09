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
  },
  { timestamps: true }
);

export const Settings = mongoose.model<ISettingsDocument>('Settings', settingsSchema);

/**
 * Returns the settings doc *including* secret fields (apiKey/apiToken),
 * creating the singleton if it doesn't exist yet.
 */
export const getSettingsWithSecrets = async () => {
  let doc = await Settings.findOne().select('+grafana.apiKey +zabbix.apiToken');
  if (!doc) {
    doc = await Settings.create({});
    doc = await Settings.findOne().select('+grafana.apiKey +zabbix.apiToken');
  }
  return doc!;
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
