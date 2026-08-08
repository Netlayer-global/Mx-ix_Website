import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // MongoDB
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/mx-ix-admin',
  
  // JWT
  jwtSecret: process.env.JWT_SECRET || 'default-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  
  // Admin defaults
  adminEmail: process.env.ADMIN_EMAIL || 'admin@mx-ix.com',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  
  // CORS
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  
  // Grafana
  grafanaUrl: process.env.GRAFANA_URL || '',
  grafanaApiKey: process.env.GRAFANA_API_KEY || '',
  grafanaZabbixUid: process.env.GRAFANA_ZABBIX_UID || 'bezy0nzf8ykg0c',
  
  // Zabbix
  zabbixUrl: process.env.ZABBIX_URL || '',
  zabbixApiToken: process.env.ZABBIX_API_TOKEN || '',
  
  // Alice-LG Looking Glass API
  lgApiUrl: process.env.LG_API_URL || 'http://103.139.191.168/api/v1',

  // Alice-LG config management (Option A): when set, admin "Apply" writes the
  // generated alice.conf to this path and runs the reload command.
  aliceConfigPath: process.env.ALICE_CONFIG_PATH || '',
  aliceReloadCmd: process.env.ALICE_RELOAD_CMD || '',

  // ── IRRDB (as-set) expansion via bgpq4 ──
  // Host-level settings on purpose: these end up on a command line, so they are
  // deliberately not editable through the admin API.
  bgpq4Path: process.env.BGPQ4_PATH || 'bgpq4',
  /**
   * IRR sources to trust, most-authoritative first. RIR databases can confirm
   * which address space is actually allocated to an ASN; the others cannot, so
   * limiting sources keeps filters both smaller and more accurate.
   * NONAUTH sources are deliberately excluded.
   */
  irrdbSources: process.env.IRRDB_SOURCES || 'RIPE,APNIC,AFRINIC,LACNIC,ARIN,RADB,NTTCOM',
  /** IRRD host to query. Empty uses the bgpq4 default (rr.ntt.net). */
  irrdbHost: process.env.IRRDB_HOST || '',
  /** Expanding a large as-set is slow; allow plenty of time. */
  irrdbTimeoutMs: parseInt(process.env.IRRDB_TIMEOUT_MS || '180000', 10),
  /** Cap as-set recursion depth. Empty means no limit. */
  irrdbRecursionLimit: process.env.IRRDB_RECURSION_LIMIT || '',
  /** Consider a cached expansion stale after this many minutes. */
  irrdbStaleMinutes: parseInt(process.env.IRRDB_STALE_MINUTES || '1440', 10),

  // SMTP (optional — for status subscriber notifications)
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || 'MX-IX Status <status@mx-ix.com>',
  
  // Helpers
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
};

export default config;
