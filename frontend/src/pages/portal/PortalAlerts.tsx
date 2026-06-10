import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, Bell, Plus, Trash2, X, Zap, CheckCircle2 } from 'lucide-react';
import { portalAlertsApi, portalApi, AlertRuleItem, AlertMetric, AlertScope, PortItem } from '../../services/api';
import { PageHeading, Badge, EmptyState } from './ui';

const METRICS: { id: AlertMetric; label: string }[] = [
  { id: 'traffic_in', label: 'Inbound traffic' },
  { id: 'traffic_out', label: 'Outbound traffic' },
  { id: 'utilization', label: 'Utilization %' },
];

const PortalAlerts: React.FC = () => {
  const [rules, setRules] = useState<AlertRuleItem[]>([]);
  const [ports, setPorts] = useState<PortItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [testResult, setTestResult] = useState<{ id: string; msg: string } | null>(null);

  const [form, setForm] = useState({
    name: '',
    scope: 'aggregate' as AlertScope,
    portId: '',
    metric: 'traffic_in' as AlertMetric,
    thresholdMbps: 1000,
    thresholdPercent: 80,
    email: '',
    slackWebhook: '',
    webhook: '',
    cooldownMinutes: 60,
  });

  const load = useCallback(async () => {
    const [a, p] = await Promise.all([portalAlertsApi.list(), portalApi.getPorts()]);
    if (a.success && a.data) setRules(a.data);
    if (p.success && p.data) {
      setPorts(p.data);
      setForm((f) => ({ ...f, portId: p.data![0]?._id || '' }));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    setError('');
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    setBusy(true);
    const res = await portalAlertsApi.create({
      name: form.name.trim(),
      scope: form.scope,
      portId: form.scope === 'port' ? form.portId : null,
      metric: form.metric,
      thresholdMbps: form.metric === 'utilization' ? 0 : Number(form.thresholdMbps),
      thresholdPercent: form.metric === 'utilization' ? Number(form.thresholdPercent) : 0,
      channels: {
        email: form.email.split(',').map((s) => s.trim()).filter(Boolean),
        slackWebhook: form.slackWebhook.trim(),
        webhook: form.webhook.trim(),
      },
      cooldownMinutes: Number(form.cooldownMinutes) || 60,
      enabled: true,
    } as Partial<AlertRuleItem>);
    setBusy(false);
    if (res.success) {
      setShowNew(false);
      setForm((f) => ({ ...f, name: '', email: '', slackWebhook: '', webhook: '' }));
      load();
    } else {
      setError(res.error || 'Failed to create alert.');
    }
  };

  const toggle = async (r: AlertRuleItem) => {
    await portalAlertsApi.update(r._id, { enabled: !r.enabled });
    load();
  };
  const remove = async (id: string) => {
    if (!confirm('Delete this alert?')) return;
    await portalAlertsApi.remove(id);
    load();
  };
  const test = async (id: string) => {
    const res = await portalAlertsApi.test(id);
    if (res.success) setTestResult({ id, msg: res.data?.message || 'Triggered — check notifications & channels.' });
    setTimeout(() => setTestResult(null), 6000);
    load();
  };

  const inputClass =
    'w-full bg-white border border-gray-300 text-ink px-4 py-3 font-mono text-sm focus:outline-none focus:border-[#F20732] transition-colors';

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-[#F20732]" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeading
          eyebrow="// Alerts"
          title="Threshold Alerts"
          subtitle="Get notified by email, Slack or webhook when traffic or utilization crosses a threshold."
        />
        <button
          onClick={() => setShowNew((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#F20732] text-white font-mono text-label-sm tracking-mono uppercase hover:bg-ink transition-colors hover-trigger"
        >
          <Plus className="w-4 h-4" /> New Alert
        </button>
      </div>

      {showNew && (
        <section className="bg-white border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-mono text-label tracking-label uppercase text-ink">New alert rule</h3>
            <button onClick={() => setShowNew(false)} className="text-gray-400 hover:text-ink"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Alert name" className={inputClass} />
            <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as AlertScope })} className={inputClass}>
              <option value="aggregate">Aggregate (all ports)</option>
              <option value="port">Specific port</option>
            </select>
            {form.scope === 'port' && (
              <select value={form.portId} onChange={(e) => setForm({ ...form, portId: e.target.value })} className={inputClass}>
                {ports.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} — {p.location} ({p.speed})
                  </option>
                ))}
              </select>
            )}
            <select value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value as AlertMetric })} className={inputClass}>
              {METRICS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            {form.metric === 'utilization' ? (
              <input type="number" value={form.thresholdPercent} onChange={(e) => setForm({ ...form, thresholdPercent: Number(e.target.value) })} placeholder="Threshold %" className={inputClass} />
            ) : (
              <input type="number" value={form.thresholdMbps} onChange={(e) => setForm({ ...form, thresholdMbps: Number(e.target.value) })} placeholder="Threshold (Mbps)" className={inputClass} />
            )}
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email recipients (comma separated)" className={inputClass} />
            <input value={form.slackWebhook} onChange={(e) => setForm({ ...form, slackWebhook: e.target.value })} placeholder="Slack webhook URL (optional)" className={inputClass} />
            <input value={form.webhook} onChange={(e) => setForm({ ...form, webhook: e.target.value })} placeholder="Generic webhook URL (optional)" className={inputClass} />
            <input type="number" value={form.cooldownMinutes} onChange={(e) => setForm({ ...form, cooldownMinutes: Number(e.target.value) })} placeholder="Cooldown (minutes)" className={inputClass} />
          </div>
          {error && <p className="text-[#F20732] font-mono text-xs mt-3">{error}</p>}
          <div className="flex justify-end mt-4">
            <button onClick={submit} disabled={busy} className="flex items-center gap-2 px-5 py-2.5 bg-[#F20732] text-white font-mono text-label-sm tracking-mono uppercase hover:bg-ink transition-colors disabled:opacity-50 hover-trigger">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create
            </button>
          </div>
        </section>
      )}

      {rules.length ? (
        <div className="space-y-3">
          {rules.map((r) => (
            <div key={r._id} className="bg-white border border-gray-200 p-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm truncate">{r.name}</span>
                    <Badge tone={r.enabled ? 'green' : 'gray'}>{r.enabled ? 'on' : 'off'}</Badge>
                  </div>
                  <p className="font-mono text-xs text-gray-400 mt-0.5">
                    {r.scope} · {r.metric.replace('_', ' ')} ≥{' '}
                    {r.metric === 'utilization' ? `${r.thresholdPercent}%` : `${r.thresholdMbps} Mbps`}
                    {r.lastTriggeredAt ? ` · last fired ${new Date(r.lastTriggeredAt).toLocaleString()}` : ''}
                  </p>
                  {(r.channels.email?.length || r.channels.slackWebhook || r.channels.webhook) && (
                    <p className="font-mono text-[10px] text-gray-400 mt-1">
                      → {[r.channels.email?.length ? `${r.channels.email.length} email` : '', r.channels.slackWebhook ? 'Slack' : '', r.channels.webhook ? 'webhook' : ''].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
                <button onClick={() => test(r._id)} className="flex items-center gap-1 font-mono text-label-sm uppercase tracking-mono text-gray-400 hover:text-[#F20732] transition-colors hover-trigger">
                  <Zap className="w-3.5 h-3.5" /> Test
                </button>
                <button onClick={() => toggle(r)} className="font-mono text-label-sm uppercase tracking-mono text-gray-400 hover:text-ink transition-colors hover-trigger">
                  {r.enabled ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => remove(r._id)} className="p-1.5 text-gray-400 hover:text-[#F20732] transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {testResult?.id === r._id && (
                <p className="mt-3 text-green-600 font-mono text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> {testResult.msg}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Bell className="w-10 h-10" />} title="No alerts yet" hint="Create a threshold alert to be notified of traffic spikes." />
      )}
    </div>
  );
};

export default PortalAlerts;
