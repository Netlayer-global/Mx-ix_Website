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
    });
    setSaving(false);
    if (res.success) {
      setSaved(true);
      const refreshed = await settingsApi.get();
      if (refreshed.success && refreshed.data) hydrate(refreshed.data);
      setTimeout(() => setSaved(false), 2500);
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
                <p className="text-gray-400 text-sm">Connect Grafana &amp; Zabbix for live metrics</p>
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

            <TestRow state={gTest} onTest={handleTestGrafana} />
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

            <TestRow state={zTest} onTest={handleTestZabbix} />
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

const TestRow: React.FC<{ state: TestState; onTest: () => void }> = ({ state, onTest }) => (
  <div className="flex items-center gap-4 pt-2">
    <button
      type="button"
      onClick={onTest}
      disabled={state.status === 'testing'}
      className="flex items-center gap-2 px-4 py-2 bg-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-600 transition-colors disabled:opacity-50"
    >
      {state.status === 'testing' ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Plug className="w-4 h-4" />
      )}
      Test Connection
    </button>

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
