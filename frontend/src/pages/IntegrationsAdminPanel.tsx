import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  Loader2,
  Save,
  CheckCircle2,
  XCircle,
  Activity,
  Plug,
  AlertTriangle,
  Boxes,
  Receipt,
} from 'lucide-react';
import { settingsApi, IntegrationSettings } from '../services/api';

interface IntegrationsAdminPanelProps {
  embedded?: boolean;
  onBack?: () => void;
}

type TestState = { status: 'idle' | 'testing' | 'ok' | 'fail'; message?: string };

const IntegrationsAdminPanel: React.FC<IntegrationsAdminPanelProps> = ({ embedded, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Grafana form
  const [gEnabled, setGEnabled] = useState(false);
  const [gUrl, setGUrl] = useState('');
  const [gApiKey, setGApiKey] = useState('');
  const [gUid, setGUid] = useState('');
  const [gHasKey, setGHasKey] = useState(false);
  const [gKeyMask, setGKeyMask] = useState('');
  const [gTest, setGTest] = useState<TestState>({ status: 'idle' });

  // Zabbix form
  const [zEnabled, setZEnabled] = useState(false);
  const [zUrl, setZUrl] = useState('');
  const [zToken, setZToken] = useState('');
  const [zHasToken, setZHasToken] = useState(false);
  const [zTokenMask, setZTokenMask] = useState('');
  const [zTest, setZTest] = useState<TestState>({ status: 'idle' });

  // IXP Manager form
  const [iEnabled, setIEnabled] = useState(false);
  const [iUrl, setIUrl] = useState('');
  const [iKey, setIKey] = useState('');
  const [iHasKey, setIHasKey] = useState(false);
  const [iKeyMask, setIKeyMask] = useState('');
  const [iTest, setITest] = useState<TestState>({ status: 'idle' });

  // Zoho Books form
  const [zoEnabled, setZoEnabled] = useState(false);
  const [zoRegion, setZoRegion] = useState('com');
  const [zoOrgId, setZoOrgId] = useState('');
  const [zoClientId, setZoClientId] = useState('');
  const [zoSecret, setZoSecret] = useState('');
  const [zoHasSecret, setZoHasSecret] = useState(false);
  const [zoSecretMask, setZoSecretMask] = useState('');
  const [zoRefresh, setZoRefresh] = useState('');
  const [zoHasRefresh, setZoHasRefresh] = useState(false);
  const [zoRefreshMask, setZoRefreshMask] = useState('');
  const [zoTest, setZoTest] = useState<TestState>({ status: 'idle' });

  // Flow graph (sFlow embed) form
  const [fgEnabled, setFgEnabled] = useState(false);
  const [fgUrl, setFgUrl] = useState('');

  // PeeringDB form
  const [pdbEnabled, setPdbEnabled] = useState(false);
  const [pdbUrl, setPdbUrl] = useState('https://www.peeringdb.com/api');
  const [pdbApiKey, setPdbApiKey] = useState('');
  const [pdbHasKey, setPdbHasKey] = useState(false);
  const [pdbKeyMask, setPdbKeyMask] = useState('');
  const [pdbCacheTtl, setPdbCacheTtl] = useState('1440');

  // Contact form recipient
  const [cfRecipient, setCfRecipient] = useState('');
  const [cfSupport, setCfSupport] = useState('');
  const [cfCc, setCfCc] = useState('');

  // Zoho country profiles (multi-country billing)
  const [zProfiles, setZProfiles] = useState<any[]>([]);
  const [zpTest, setZpTest] = useState<Record<string, TestState>>({});

  const hydrate = (data: IntegrationSettings) => {
    setGEnabled(data.grafana.enabled);
    setGUrl(data.grafana.url);
    setGUid(data.grafana.zabbixDatasourceUid);
    setGHasKey(data.grafana.hasApiKey);
    setGKeyMask(data.grafana.apiKeyMask);
    setGApiKey('');
    setZEnabled(data.zabbix.enabled);
    setZUrl(data.zabbix.url);
    setZHasToken(data.zabbix.hasApiToken);
    setZTokenMask(data.zabbix.apiTokenMask);
    setZToken('');
    setIEnabled(data.ixpManager.enabled);
    setIUrl(data.ixpManager.url);
    setIHasKey(data.ixpManager.hasApiKey);
    setIKeyMask(data.ixpManager.apiKeyMask);
    setIKey('');
    setZoEnabled(data.zohoBooks.enabled);
    setZoRegion(data.zohoBooks.region || 'com');
    setZoOrgId(data.zohoBooks.organizationId);
    setZoClientId(data.zohoBooks.clientId);
    setZoHasSecret(data.zohoBooks.hasClientSecret);
    setZoSecretMask(data.zohoBooks.clientSecretMask);
    setZoSecret('');
    setZoHasRefresh(data.zohoBooks.hasRefreshToken);
    setZoRefreshMask(data.zohoBooks.refreshTokenMask);
    setZoRefresh('');
    setFgEnabled(data.flowGraph?.enabled || false);
    setFgUrl(data.flowGraph?.urlTemplate || '');
    setPdbEnabled((data as any).peeringDb?.enabled || false);
    setPdbUrl((data as any).peeringDb?.baseUrl || 'https://www.peeringdb.com/api');
    setPdbHasKey((data as any).peeringDb?.hasApiKey || false);
    setPdbKeyMask((data as any).peeringDb?.apiKeyMask || '');
    setPdbApiKey('');
    setPdbCacheTtl(String((data as any).peeringDb?.cacheTtlMinutes || 1440));
    setCfRecipient(data.contactForm?.recipientEmail || '');
    setCfSupport(data.contactForm?.supportEmail || '');
    setCfCc(data.contactForm?.ccEmails || '');
    setZProfiles((data.zohoProfiles || []).map((p) => ({ ...p, clientSecret: '', refreshToken: '' })));
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await settingsApi.get();
      if (res.success && res.data) hydrate(res.data);
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError('');
    const res = await settingsApi.update({
      grafana: {
        enabled: gEnabled,
        url: gUrl,
        zabbixDatasourceUid: gUid,
        ...(gApiKey ? { apiKey: gApiKey } : {}),
      },
      zabbix: {
        enabled: zEnabled,
        url: zUrl,
        ...(zToken ? { apiToken: zToken } : {}),
      },
      ixpManager: {
        enabled: iEnabled,
        url: iUrl,
        ...(iKey ? { apiKey: iKey } : {}),
      },
      zohoBooks: {
        enabled: zoEnabled,
        region: zoRegion,
        organizationId: zoOrgId,
        clientId: zoClientId,
        ...(zoSecret ? { clientSecret: zoSecret } : {}),
        ...(zoRefresh ? { refreshToken: zoRefresh } : {}),
      },
      flowGraph: {
        enabled: fgEnabled,
        urlTemplate: fgUrl,
      },
      peeringDb: {
        enabled: pdbEnabled,
        baseUrl: pdbUrl,
        ...(pdbApiKey ? { apiKey: pdbApiKey } : {}),
        cacheTtlMinutes: Number(pdbCacheTtl) || 1440,
      },
      contactForm: {
        recipientEmail: cfRecipient,
        supportEmail: cfSupport,
        ccEmails: cfCc,
      },
      zohoProfiles: zProfiles.map((p) => ({
        key: p.key,
        label: p.label,
        region: p.region,
        organizationId: p.organizationId,
        clientId: p.clientId,
        ...(p.clientSecret ? { clientSecret: p.clientSecret } : {}),
        ...(p.refreshToken ? { refreshToken: p.refreshToken } : {}),
        enabled: p.enabled !== false,
      })),
    });
    setSaving(false);
    if (res.success) {
      setSaved(true);
      const refreshed = await settingsApi.get();
      if (refreshed.success && refreshed.data) hydrate(refreshed.data);
      setTimeout(() => setSaved(false), 2500);
    } else {
      setSaveError(res.error || 'Save failed');
    }
  };

  const handleTestGrafana = async () => {
    setGTest({ status: 'testing' });
    const res = await settingsApi.testGrafana({ url: gUrl, apiKey: gApiKey || undefined });
    if (res.success && res.data?.connected) {
      setGTest({ status: 'ok', message: `Connected — Grafana v${res.data.version || '?'}` });
    } else {
      setGTest({ status: 'fail', message: res.error || 'Connection failed' });
    }
  };

  const handleTestZabbix = async () => {
    setZTest({ status: 'testing' });
    const res = await settingsApi.testZabbix({ url: zUrl, apiToken: zToken || undefined });
    if (res.success && res.data?.connected) {
      setZTest({ status: 'ok', message: `Connected — Zabbix v${res.data.version || '?'}` });
    } else {
      setZTest({ status: 'fail', message: res.error || 'Connection failed' });
    }
  };

  const handleTestIxp = async () => {
    setITest({ status: 'testing' });
    const res = await settingsApi.testIxpManager({ url: iUrl, apiKey: iKey || undefined });
    if (res.success && res.data?.connected) {
      setITest({
        status: 'ok',
        message: `Connected${res.data.customers !== undefined ? ` — ${res.data.customers} customers` : ''}`,
      });
    } else {
      setITest({ status: 'fail', message: res.error || 'Connection failed' });
    }
  };

  const handleTestZoho = async () => {
    setZoTest({ status: 'testing' });
    const res = await settingsApi.testZoho({
      region: zoRegion,
      organizationId: zoOrgId,
      clientId: zoClientId,
      clientSecret: zoSecret || undefined,
      refreshToken: zoRefresh || undefined,
    });
    if (res.success && res.data?.connected) {
      setZoTest({ status: 'ok', message: `Connected${res.data.orgName ? ` — ${res.data.orgName}` : ''}` });
    } else {
      setZoTest({ status: 'fail', message: res.error || 'Connection failed' });
    }
  };

  const addProfile = () =>
    setZProfiles((ps) => [...ps, { key: '', label: '', region: 'in', organizationId: '', clientId: '', clientSecret: '', refreshToken: '', enabled: true }]);
  const updateProfile = (i: number, patch: any) =>
    setZProfiles((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const removeProfile = (i: number) => setZProfiles((ps) => ps.filter((_, idx) => idx !== i));
  const testProfile = async (i: number) => {
    const p = zProfiles[i];
    setZpTest((t) => ({ ...t, [i]: { status: 'testing' } }));
    const res = await settingsApi.testZoho({
      region: p.region,
      organizationId: p.organizationId,
      clientId: p.clientId,
      clientSecret: p.clientSecret || undefined,
      refreshToken: p.refreshToken || undefined,
      profileKey: p.key || undefined,
    });
    setZpTest((t) => ({
      ...t,
      [i]:
        res.success && res.data?.connected
          ? { status: 'ok', message: `Connected${res.data.orgName ? ` — ${res.data.orgName}` : ''}` }
          : { status: 'fail', message: res.error || 'Connection failed' },
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#F20732]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white admin-panel">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {embedded && onBack && (
              <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#F20732] rounded-lg flex items-center justify-center">
                <Plug className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Integrations</h1>
                <p className="text-gray-500 text-sm">Connect Grafana &amp; Zabbix for live metrics</p>
              </div>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#F20732] rounded-lg font-bold hover:bg-[#C00628] transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
        {saveError && (
          <p className="mt-2 text-sm text-[#F20732] font-mono text-right">{saveError}</p>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Info banner */}
        <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-200/90">
            When an integration is disabled or not configured, the public site falls back to
            realistic simulated data. API keys are stored securely and never shown in full.
          </p>
        </div>

        {/* ── GRAFANA ──────────────────────────────────── */}
        <section className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-[#F20732]" />
              <h2 className="text-lg font-bold">Grafana</h2>
            </div>
            <Toggle enabled={gEnabled} onChange={setGEnabled} />
          </div>

          <div className="p-6 space-y-4">
            <Field label="Grafana URL" hint="e.g. https://grafana.mx-ix.com">
              <input
                type="url"
                value={gUrl}
                onChange={(e) => setGUrl(e.target.value)}
                placeholder="https://grafana.example.com"
                className="admin-input"
              />
            </Field>

            <Field
              label="API Key / Service Account Token"
              hint={gHasKey ? `Saved: ${gKeyMask} — leave blank to keep` : 'Bearer token used to query Grafana'}
            >
              <input
                type="password"
                value={gApiKey}
                onChange={(e) => setGApiKey(e.target.value)}
                placeholder={gHasKey ? '•••••••• (unchanged)' : 'Enter API key'}
                className="admin-input"
                autoComplete="new-password"
              />
            </Field>

            <Field label="Zabbix Datasource UID" hint="UID of the Zabbix datasource inside Grafana">
              <input
                type="text"
                value={gUid}
                onChange={(e) => setGUid(e.target.value)}
                placeholder="bezy0nzf8ykg0c"
                className="admin-input"
              />
            </Field>

            <TestRow state={gTest} onTest={handleTestGrafana} onSave={handleSave} saving={saving} saved={saved} />
          </div>
        </section>

        {/* ── ZABBIX ───────────────────────────────────── */}
        <section className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-[#F20732]" />
              <h2 className="text-lg font-bold">Zabbix</h2>
            </div>
            <Toggle enabled={zEnabled} onChange={setZEnabled} />
          </div>

          <div className="p-6 space-y-4">
            <Field label="Zabbix URL" hint="Base URL or full api_jsonrpc.php endpoint">
              <input
                type="url"
                value={zUrl}
                onChange={(e) => setZUrl(e.target.value)}
                placeholder="https://zabbix.example.com"
                className="admin-input"
              />
            </Field>

            <Field
              label="API Token"
              hint={zHasToken ? `Saved: ${zTokenMask} — leave blank to keep` : 'Zabbix API token'}
            >
              <input
                type="password"
                value={zToken}
                onChange={(e) => setZToken(e.target.value)}
                placeholder={zHasToken ? '•••••••• (unchanged)' : 'Enter API token'}
                className="admin-input"
                autoComplete="new-password"
              />
            </Field>

            <TestRow state={zTest} onTest={handleTestZabbix} onSave={handleSave} saving={saving} saved={saved} />
          </div>
        </section>

        {/* ── IXP MANAGER ──────────────────────────────── */}
        <section className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <Boxes className="w-5 h-5 text-[#F20732]" />
              <div>
                <h2 className="text-lg font-bold">IXP Manager</h2>
                <p className="text-xs text-gray-500">Operational source of truth — members, ports & provisioning</p>
              </div>
            </div>
            <Toggle enabled={iEnabled} onChange={setIEnabled} />
          </div>

          <div className="p-6 space-y-4">
            <Field label="IXP Manager URL" hint="Base URL of your IXP Manager instance (e.g. https://ixp.mx-ix.com)">
              <input
                type="url"
                value={iUrl}
                onChange={(e) => setIUrl(e.target.value)}
                placeholder="https://ixp.example.com"
                className="admin-input"
              />
            </Field>

            <Field
              label="API Key"
              hint={iHasKey ? `Saved: ${iKeyMask} — leave blank to keep` : 'Sent as the X-IXP-Manager-API-Key header'}
            >
              <input
                type="password"
                value={iKey}
                onChange={(e) => setIKey(e.target.value)}
                placeholder={iHasKey ? '•••••••• (unchanged)' : 'Enter API key'}
                className="admin-input"
                autoComplete="new-password"
              />
            </Field>

            <TestRow state={iTest} onTest={handleTestIxp} onSave={handleSave} saving={saving} saved={saved} />
          </div>
        </section>

        {/* ── ZOHO BOOKS ───────────────────────────────── */}
        <section className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <Receipt className="w-5 h-5 text-[#F20732]" />
              <div>
                <h2 className="text-lg font-bold">Zoho Books</h2>
                <p className="text-xs text-gray-500">Billing system of record — member invoices (OAuth2)</p>
              </div>
            </div>
            <Toggle enabled={zoEnabled} onChange={setZoEnabled} />
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Data Center Region" hint="Zoho domain suffix">
                <select value={zoRegion} onChange={(e) => setZoRegion(e.target.value)} className="admin-input">
                  {['com', 'eu', 'in', 'com.au', 'jp', 'ca', 'com.cn'].map((r) => (
                    <option key={r} value={r}>
                      .{r}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Organization ID" hint="Zoho Books organization_id">
                <input value={zoOrgId} onChange={(e) => setZoOrgId(e.target.value)} placeholder="e.g. 60012345678" className="admin-input" />
              </Field>
            </div>

            <Field label="Client ID" hint="OAuth2 self-client / app client id">
              <input value={zoClientId} onChange={(e) => setZoClientId(e.target.value)} placeholder="1000.XXXXXXXX" className="admin-input" />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Client Secret" hint={zoHasSecret ? `Saved: ${zoSecretMask} — leave blank to keep` : 'OAuth2 client secret'}>
                <input
                  type="password"
                  value={zoSecret}
                  onChange={(e) => setZoSecret(e.target.value)}
                  placeholder={zoHasSecret ? '•••••••• (unchanged)' : 'Enter client secret'}
                  className="admin-input"
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Refresh Token" hint={zoHasRefresh ? `Saved: ${zoRefreshMask} — leave blank to keep` : 'OAuth2 refresh token'}>
                <input
                  type="password"
                  value={zoRefresh}
                  onChange={(e) => setZoRefresh(e.target.value)}
                  placeholder={zoHasRefresh ? '•••••••• (unchanged)' : 'Enter refresh token'}
                  className="admin-input"
                  autoComplete="new-password"
                />
              </Field>
            </div>

            <TestRow state={zoTest} onTest={handleTestZoho} onSave={handleSave} saving={saving} saved={saved} />
          </div>
        </section>

        {/* ── FLOW GRAPH (sFlow) ────────────────────────── */}
        <section className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-[#F20732]" />
              <div>
                <h2 className="text-lg font-bold">Flow Graph (sFlow)</h2>
                <p className="text-xs text-gray-500">Per-ASN content traffic graph embedded per member by ASN</p>
              </div>
            </div>
            <Toggle enabled={fgEnabled} onChange={setFgEnabled} />
          </div>

          <div className="p-6 space-y-4">
            <Field
              label="Graph URL template"
              hint="Use {asn} where the member's ASN goes. e.g. https://grafana.mx-ix.com/d-solo/UID?panelId=2&var-asn={asn}&kiosk  (Grafana) or your Akvorado graph URL. The member's per-ASN graph is embedded automatically."
            >
              <input
                type="url"
                value={fgUrl}
                onChange={(e) => setFgUrl(e.target.value)}
                placeholder="https://grafana.example.com/d-solo/UID?panelId=2&var-asn={asn}&kiosk"
                className="admin-input"
              />
            </Field>
            <p className="text-xs text-gray-500">
              Tip: the embed target must allow being shown in an iframe (Grafana: set <code>allow_embedding=true</code> and
              anonymous access or a public/shared link). No per-member setup is needed — each customer sees their own ASN.
            </p>
          </div>
        </section>

        {/* ── PEERINGDB ─────────────────────────────────── */}
        <section className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-[#F20732]" />
              <div>
                <h2 className="text-lg font-bold">PeeringDB</h2>
                <p className="text-xs text-gray-500">ASN lookup, facility search &amp; member data sync</p>
              </div>
            </div>
            <Toggle enabled={pdbEnabled} onChange={setPdbEnabled} />
          </div>

          <div className="p-6 space-y-4">
            <p className="text-xs text-gray-400">
              PeeringDB works in anonymous mode (read-only) without any configuration.
              Enabling it and adding an API key raises the rate limit and gives access to contact data.
            </p>
            <Field label="API Base URL" hint="Default: https://www.peeringdb.com/api">
              <input
                type="url"
                value={pdbUrl}
                onChange={(e) => setPdbUrl(e.target.value)}
                placeholder="https://www.peeringdb.com/api"
                className="admin-input"
              />
            </Field>
            <Field
              label="API Key (optional)"
              hint={pdbHasKey ? `Saved: ${pdbKeyMask} — leave blank to keep` : 'Get one from https://www.peeringdb.com/user/keys'}
            >
              <input
                type="password"
                value={pdbApiKey}
                onChange={(e) => setPdbApiKey(e.target.value)}
                placeholder={pdbHasKey ? '••••••••••' : 'API key (optional)'}
                className="admin-input"
              />
            </Field>
            <Field label="Cache TTL (minutes)" hint="How long fetched records stay cached before re-querying">
              <input
                type="number"
                value={pdbCacheTtl}
                onChange={(e) => setPdbCacheTtl(e.target.value)}
                placeholder="1440"
                className="admin-input w-32"
              />
            </Field>
          </div>
        </section>

        {/* ── CONTACT FORM ──────────────────────────────── */}
        <section className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <Plug className="w-5 h-5 text-[#F20732]" />
              <div>
                <h2 className="text-lg font-bold">Contact Form</h2>
                <p className="text-xs text-gray-500">Where "Contact Us / Request a Port" submissions are emailed</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <Field label="Sales recipient email" hint="Submissions from the Sales tab are emailed here (reply-to is the visitor). Defaults to admin email if blank.">
              <input
                type="email"
                value={cfRecipient}
                onChange={(e) => setCfRecipient(e.target.value)}
                placeholder="sales@mx-ix.com"
                className="admin-input"
              />
            </Field>
            <Field label="Tech Support recipient email" hint="Submissions from the Tech Support tab are emailed here. Defaults to the sales/admin email if blank.">
              <input
                type="email"
                value={cfSupport}
                onChange={(e) => setCfSupport(e.target.value)}
                placeholder="support@mx-ix.com"
                className="admin-input"
              />
            </Field>
            <Field label="CC emails (optional)" hint="Comma-separated additional recipients (applied to both).">
              <input
                type="text"
                value={cfCc}
                onChange={(e) => setCfCc(e.target.value)}
                placeholder="noc@mx-ix.com"
                className="admin-input"
              />
            </Field>
            <p className="text-xs text-gray-500">
              Delivery uses SMTP (configured via environment). Every submission is also saved, so leads are never lost
              even if email delivery fails.
            </p>
          </div>
        </section>

        {/* ── ZOHO COUNTRY PROFILES ─────────────────────── */}
        <section className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <Receipt className="w-5 h-5 text-[#F20732]" />
              <div>
                <h2 className="text-lg font-bold">Zoho Books — Country Profiles</h2>
                <p className="text-xs text-gray-500">Per-country billing — each customer is assigned a profile</p>
              </div>
            </div>
            <button
              type="button"
              onClick={addProfile}
              className="px-3 py-1.5 bg-gray-700 rounded text-xs font-bold hover:bg-gray-600 transition-colors cursor-pointer"
            >
              + Add profile
            </button>
          </div>

          <div className="p-6 space-y-5">
            {zProfiles.length === 0 && (
              <p className="text-sm text-gray-500">
                No country profiles yet. Add one per country/entity (e.g. India, UAE) — each with its own data center
                region and Zoho credentials. Customers are mapped to a profile in the Customers panel.
              </p>
            )}
            {zProfiles.map((p, i) => (
              <div key={i} className="border border-gray-700 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      value={p.label}
                      onChange={(e) => updateProfile(i, { label: e.target.value })}
                      placeholder="Label (e.g. MX-IX India)"
                      className="admin-input flex-1"
                    />
                    <input
                      value={p.key}
                      onChange={(e) => updateProfile(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                      placeholder="key (e.g. india)"
                      className="admin-input w-40"
                    />
                  </div>
                  <Toggle enabled={p.enabled !== false} onChange={(v) => updateProfile(i, { enabled: v })} />
                  <button type="button" onClick={() => removeProfile(i)} className="text-gray-500 hover:text-[#F20732] text-xs font-bold px-2 cursor-pointer">
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <select value={p.region || 'in'} onChange={(e) => updateProfile(i, { region: e.target.value })} className="admin-input">
                    {['com', 'eu', 'in', 'com.au', 'jp', 'ca', 'com.cn'].map((r) => (
                      <option key={r} value={r}>.{r}</option>
                    ))}
                  </select>
                  <input value={p.organizationId} onChange={(e) => updateProfile(i, { organizationId: e.target.value })} placeholder="Organization ID" className="admin-input" />
                  <input value={p.clientId} onChange={(e) => updateProfile(i, { clientId: e.target.value })} placeholder="Client ID (1000.xxxx)" className="admin-input" />
                  <input
                    type="password"
                    value={p.clientSecret}
                    onChange={(e) => updateProfile(i, { clientSecret: e.target.value })}
                    placeholder={p.hasClientSecret ? `${p.clientSecretMask} (unchanged)` : 'Client Secret'}
                    className="admin-input"
                    autoComplete="new-password"
                  />
                  <input
                    type="password"
                    value={p.refreshToken}
                    onChange={(e) => updateProfile(i, { refreshToken: e.target.value })}
                    placeholder={p.hasRefreshToken ? `${p.refreshTokenMask} (unchanged)` : 'Refresh Token'}
                    className="admin-input md:col-span-2"
                    autoComplete="new-password"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => testProfile(i)}
                    disabled={zpTest[i]?.status === 'testing'}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-600 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {zpTest[i]?.status === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
                    Test
                  </button>
                  {zpTest[i]?.status === 'ok' && (
                    <span className="flex items-center gap-2 text-sm text-green-400"><CheckCircle2 className="w-4 h-4" /> {zpTest[i]?.message}</span>
                  )}
                  {zpTest[i]?.status === 'fail' && (
                    <span className="flex items-center gap-2 text-sm text-red-400"><XCircle className="w-4 h-4" /> {zpTest[i]?.message}</span>
                  )}
                </div>
              </div>
            ))}
            <p className="text-xs text-gray-500">
              Use this for an IX spanning multiple countries / data centers. Each profile has its own region + Zoho
              credentials. Assign a customer's profile under Customers; their portal invoices come from that profile.
              The single "Zoho Books" config above is the default fallback when a customer has no profile.
            </p>
          </div>
        </section>
      </main>

      <style>{`
        .admin-input {
          width: 100%;
          padding: 0.65rem 0.9rem;
          background: rgb(31 41 55);
          border: 1px solid rgb(75 85 99);
          border-radius: 0.5rem;
          color: white;
          font-size: 0.875rem;
          transition: border-color 0.2s;
        }
        .admin-input:focus { outline: none; border-color: #F20732; }
      `}</style>
    </div>
  );
};

// ── Reusable bits ─────────────────────────────────
const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({
  label,
  hint,
  children,
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>
    {children}
    {hint && <p className="text-xs text-gray-500 mt-1.5">{hint}</p>}
  </div>
);

const Toggle: React.FC<{ enabled: boolean; onChange: (v: boolean) => void }> = ({ enabled, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!enabled)}
    className={`relative w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-[#F20732]' : 'bg-gray-600'}`}
    aria-pressed={enabled}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
        enabled ? 'translate-x-6' : ''
      }`}
    />
  </button>
);

const TestRow: React.FC<{
  state: TestState;
  onTest: () => void;
  onSave?: () => void;
  saving?: boolean;
  saved?: boolean;
}> = ({ state, onTest, onSave, saving, saved }) => (
  <div className="flex items-center flex-wrap gap-4 pt-2">
    <button
      type="button"
      onClick={onTest}
      disabled={state.status === 'testing'}
      className="flex items-center gap-2 px-4 py-2 bg-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-600 transition-colors disabled:opacity-50 cursor-pointer"
    >
      {state.status === 'testing' ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Plug className="w-4 h-4" />
      )}
      Test Connection
    </button>

    {onSave && (
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 bg-[#F20732] rounded-lg text-sm font-semibold hover:bg-[#C00628] transition-colors disabled:opacity-50 cursor-pointer"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saved ? 'Saved!' : 'Save'}
      </button>
    )}

    {state.status === 'ok' && (
      <span className="flex items-center gap-2 text-sm text-green-400">
        <CheckCircle2 className="w-4 h-4" /> {state.message}
      </span>
    )}
    {state.status === 'fail' && (
      <span className="flex items-center gap-2 text-sm text-red-400">
        <XCircle className="w-4 h-4" /> {state.message}
      </span>
    )}
  </div>
);

export default IntegrationsAdminPanel;
