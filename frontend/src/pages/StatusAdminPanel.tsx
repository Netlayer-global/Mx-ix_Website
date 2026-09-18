import React, { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, Loader2, Plus, Trash2, Activity, AlertTriangle, Save, Mail, Eye, EyeOff } from 'lucide-react';
import {
  statusApi,
  StatusComponentItem,
  IncidentItem,
  StatusSubscriber,
  ComponentStatus,
  IncidentStatus,
  IncidentImpact,
} from '../services/api';

interface Props { embedded?: boolean; onBack?: () => void; }

const COMPONENT_STATUSES: ComponentStatus[] = ['operational', 'degraded', 'partial_outage', 'major_outage', 'maintenance'];
const INCIDENT_STATUSES: IncidentStatus[] = ['investigating', 'identified', 'monitoring', 'resolved'];
const IMPACTS: IncidentImpact[] = ['minor', 'major', 'critical', 'maintenance'];

const StatusAdminPanel: React.FC<Props> = ({ embedded, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [components, setComponents] = useState<StatusComponentItem[]>([]);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);

  // new component form
  const [newComp, setNewComp] = useState({ name: '', group: 'Core Services', status: 'operational' as ComponentStatus, description: '' });
  // new incident form
  const [newInc, setNewInc] = useState({ title: '', impact: 'minor' as IncidentImpact, status: 'investigating' as IncidentStatus, message: '', affectedComponents: [] as string[], startedAt: '', resolvedAt: '' });
  const [subCount, setSubCount] = useState<number | null>(null);
  const [subscribers, setSubscribers] = useState<StatusSubscriber[]>([]);
  const [showSubs, setShowSubs] = useState(false);
  const [error, setError] = useState('');
  // per-incident update drafts
  const [draft, setDraft] = useState<Record<string, { status: IncidentStatus; message: string }>>({});

  const load = useCallback(async () => {
    // The admin component list includes components hidden from the public page.
    const [comps, res, subs] = await Promise.all([
      statusApi.listComponents(),
      statusApi.get(),
      statusApi.getSubscribers(),
    ]);
    if (comps.success && comps.data) setComponents(comps.data);
    if (res.success && res.data) setIncidents(res.data.incidents);
    if (subs.success && subs.data) {
      setSubCount(subs.data.count);
      setSubscribers(subs.data.all || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveComp = async (c: StatusComponentItem, patch: Partial<StatusComponentItem>) => {
    setError('');
    setComponents((prev) => prev.map((x) => (x._id === c._id ? { ...x, ...patch } : x)));
    const res = await statusApi.updateComponent(c._id, patch);
    if (!res.success) {
      setError(res.error || 'Could not save the component.');
      load();
    } else if (patch.name) {
      // A rename cascades to incidents and maintenance windows server-side.
      load();
    }
  };
  const setCompStatus = async (c: StatusComponentItem, status: ComponentStatus) => saveComp(c, { status });
  const addComponent = async () => {
    if (!newComp.name.trim()) return;
    setError('');
    const order = components.length + 1;
    const res = await statusApi.createComponent({ ...newComp, order });
    if (res.success) { setNewComp({ name: '', group: 'Core Services', status: 'operational', description: '' }); load(); }
    else setError(res.error || 'Could not create the component.');
  };
  const removeComponent = async (id: string) => {
    if (!confirm('Delete this component? It will also be removed from any incident or maintenance window that references it.')) return;
    await statusApi.deleteComponent(id); load();
  };
  const removeSubscriber = async (id: string, email: string) => {
    if (!confirm(`Remove ${email} from status updates?`)) return;
    await statusApi.removeSubscriber(id); load();
  };

  const addIncident = async () => {
    if (!newInc.title.trim()) return;
    const payload: any = { ...newInc };
    if (newInc.startedAt) payload.startedAt = new Date(newInc.startedAt).toISOString();
    if (newInc.resolvedAt) payload.resolvedAt = new Date(newInc.resolvedAt).toISOString();
    const res = await statusApi.createIncident(payload);
    if (res.success) { setNewInc({ title: '', impact: 'minor', status: 'investigating', message: '', affectedComponents: [], startedAt: '', resolvedAt: '' }); load(); }
  };
  const postUpdate = async (inc: IncidentItem) => {
    const d = draft[inc._id];
    if (!d || !d.message.trim()) return;
    await statusApi.updateIncident(inc._id, { status: d.status, message: d.message });
    setDraft((p) => ({ ...p, [inc._id]: { status: d.status, message: '' } }));
    load();
  };
  const removeIncident = async (id: string) => {
    if (!confirm('Delete this incident?')) return;
    await statusApi.deleteIncident(id); load();
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#F20732]" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white admin-panel">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          {embedded && onBack && (
            <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5" /></button>
          )}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#F20732] rounded-lg flex items-center justify-center"><Activity className="w-5 h-5" /></div>
            <div>
              <h1 className="text-xl font-bold">System Status</h1>
              <p className="text-gray-500 text-sm">Manage components &amp; incidents</p>
            </div>
          </div>
          {subCount !== null && (
            <div className="ml-auto text-right">
              <div className="text-lg font-bold">{subCount}</div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-mono">Subscribers</div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-10">
        {error && (
          <p className="rounded border border-[#F20732]/40 bg-[#F20732]/10 px-4 py-3 font-mono text-xs text-[#F20732]">{error}</p>
        )}

        {/* COMPONENTS */}
        <section>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">Components</h2>
            <p className="text-xs text-gray-500">
              Uptime % is computed from the daily snapshot history — it is read-only. Renaming a component updates every
              incident and maintenance window that references it.
            </p>
          </div>
          <div className="space-y-2">
            {components.map((c) => (
              <div key={c._id} className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <input defaultValue={c.name} onBlur={(e) => saveComp(c, { name: e.target.value })} className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm font-bold" placeholder="Name" />
                  <input defaultValue={c.group} onBlur={(e) => saveComp(c, { group: e.target.value })} className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm w-40" placeholder="Group" />
                  <select value={c.status} onChange={(e) => setCompStatus(c, e.target.value as ComponentStatus)} className="cursor-pointer bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm">
                    {COMPONENT_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                  <div
                    className="w-24 rounded border border-gray-700 bg-gray-900 px-3 py-2 text-center text-sm tabular-nums text-gray-300"
                    title="Uptime is computed from the recorded daily history and cannot be edited"
                  >
                    {typeof c.uptime === 'number' ? `${c.uptime}%` : '—'}
                  </div>
                  <button
                    onClick={() => saveComp(c, { isActive: !c.isActive })}
                    title={c.isActive ? 'Visible on the public status page' : 'Hidden from the public status page'}
                    className={`cursor-pointer rounded border p-2 transition-colors ${
                      c.isActive ? 'border-gray-600 text-gray-300 hover:border-gray-400' : 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                    }`}
                  >
                    {c.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button onClick={() => removeComponent(c._id)} className="cursor-pointer p-2 text-gray-500 hover:text-[#F20732] transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
                <input defaultValue={c.description || ''} onBlur={(e) => saveComp(c, { description: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-xs text-gray-300" placeholder="Description (shown on public status page, optional)" />
              </div>
            ))}
          </div>

          {/* add component */}
          <div className="bg-gray-800/50 border border-gray-700 border-dashed rounded-lg p-4 mt-3 space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              <input value={newComp.name} onChange={(e) => setNewComp({ ...newComp, name: e.target.value })} placeholder="Component name" className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm" />
              <input value={newComp.group} onChange={(e) => setNewComp({ ...newComp, group: e.target.value })} placeholder="Group" className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm" />
              <button onClick={addComponent} className="flex items-center gap-2 px-4 py-2 bg-[#F20732] rounded font-bold text-sm hover:bg-[#C00628] transition-colors whitespace-nowrap"><Plus className="w-4 h-4" /> Add</button>
            </div>
            <input value={newComp.description} onChange={(e) => setNewComp({ ...newComp, description: e.target.value })} placeholder="Description (optional)" className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-xs" />
          </div>
        </section>

        {/* INCIDENTS */}
        <section>
          <h2 className="text-lg font-bold mb-4">Incidents</h2>

          {/* create incident */}
          <div className="bg-gray-800/50 border border-gray-700 border-dashed rounded-lg p-4 mb-5 space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-300 font-medium"><AlertTriangle className="w-4 h-4 text-[#F20732]" /> Report a new incident</div>
            <input value={newInc.title} onChange={(e) => setNewInc({ ...newInc, title: e.target.value })} placeholder="Incident title" className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm" />
            <div className="flex flex-wrap gap-3">
              <select value={newInc.impact} onChange={(e) => setNewInc({ ...newInc, impact: e.target.value as IncidentImpact })} className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm">
                {IMPACTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={newInc.status} onChange={(e) => setNewInc({ ...newInc, status: e.target.value as IncidentStatus })} className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm">
                {INCIDENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-mono mb-1">Started at (optional)</label>
                <input type="datetime-local" value={newInc.startedAt} onChange={(e) => setNewInc({ ...newInc, startedAt: e.target.value })} className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-mono mb-1">Resolved at (optional)</label>
                <input type="datetime-local" value={newInc.resolvedAt} onChange={(e) => setNewInc({ ...newInc, resolvedAt: e.target.value })} className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <textarea value={newInc.message} onChange={(e) => setNewInc({ ...newInc, message: e.target.value })} placeholder="First update message…" rows={2} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm" />
            <div>
              <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-mono">Affected components</div>
              <div className="flex flex-wrap gap-2">
                {components.map((c) => {
                  const on = newInc.affectedComponents.includes(c.name);
                  return (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => setNewInc((p) => ({ ...p, affectedComponents: on ? p.affectedComponents.filter((n) => n !== c.name) : [...p.affectedComponents, c.name] }))}
                      className={`text-xs px-2.5 py-1 rounded border transition-colors ${on ? 'bg-[#F20732] border-[#F20732] text-white' : 'border-gray-600 text-gray-300 hover:border-gray-400'}`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <button onClick={addIncident} className="flex items-center gap-2 px-4 py-2 bg-[#F20732] rounded font-bold text-sm hover:bg-[#C00628] transition-colors"><Plus className="w-4 h-4" /> Create Incident</button>
          </div>

          {/* list incidents */}
          <div className="space-y-4">
            {incidents.map((inc) => (
              <div key={inc._id} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1">
                    <input
                      defaultValue={inc.title}
                      onBlur={(e) => { if (e.target.value !== inc.title) statusApi.updateIncident(inc._id, { title: e.target.value }).then(load); }}
                      className="w-full bg-transparent border-b border-transparent hover:border-gray-600 focus:border-[#F20732] focus:outline-none font-bold text-sm pb-1"
                    />
                    <div className="flex items-center gap-2 mt-1.5">
                      <select
                        value={inc.impact}
                        onChange={(e) => statusApi.updateIncident(inc._id, { impact: e.target.value as IncidentImpact }).then(load)}
                        className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-[10px] uppercase tracking-wider"
                      >
                        {IMPACTS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-gray-500">{inc.status}</span>
                    </div>
                  </div>
                  <button onClick={() => removeIncident(inc._id)} className="p-1.5 text-gray-500 hover:text-[#F20732]"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="space-y-1.5 mb-3 border-l-2 border-gray-700 pl-3">
                  {inc.updates.map((u, i) => (
                    <div key={i} className="text-xs"><span className="font-mono text-[9px] uppercase text-[#F20732] mr-2">{u.status}</span><span className="text-gray-300">{u.message}</span></div>
                  ))}
                </div>
                {/* post update */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={draft[inc._id]?.status || inc.status}
                    onChange={(e) => setDraft((p) => ({ ...p, [inc._id]: { status: e.target.value as IncidentStatus, message: p[inc._id]?.message || '' } }))}
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                  >
                    {INCIDENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input
                    value={draft[inc._id]?.message || ''}
                    onChange={(e) => setDraft((p) => ({ ...p, [inc._id]: { status: p[inc._id]?.status || inc.status, message: e.target.value } }))}
                    placeholder="Add an update…"
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                  />
                  <button onClick={() => postUpdate(inc)} className="flex items-center gap-2 px-4 py-2 bg-gray-700 rounded font-bold text-sm hover:bg-gray-600 transition-colors"><Save className="w-4 h-4" /> Post</button>
                </div>
              </div>
            ))}
            {!incidents.length && <p className="text-gray-500 text-sm">No incidents reported.</p>}
          </div>
        </section>

        {/* SUBSCRIBERS */}
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Mail className="h-4 w-4 text-[#F20732]" /> Status Subscribers
            </h2>
            <button
              onClick={() => setShowSubs((v) => !v)}
              className="cursor-pointer rounded border border-gray-600 px-3 py-1.5 text-xs font-bold transition-colors hover:border-gray-400"
            >
              {showSubs ? 'Hide list' : `Show list (${subscribers.length})`}
            </button>
          </div>
          <p className="mb-3 text-xs text-gray-500">
            These addresses receive incident emails. Every message includes a one-click unsubscribe link, so members can
            opt out themselves — remove an address here only on request.
          </p>

          {showSubs && (
            <div className="space-y-2">
              {subscribers.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3"
                >
                  <div className="min-w-0">
                    <span className="truncate text-sm">{s.email}</span>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-gray-500">
                      {s.active ? 'Subscribed' : 'Unsubscribed'} · joined {new Date(s.createdAt).toLocaleDateString()}
                      {s.unsubscribedAt ? ` · opted out ${new Date(s.unsubscribedAt).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => removeSubscriber(s.id, s.email)}
                    className="cursor-pointer p-1.5 text-gray-500 transition-colors hover:text-[#F20732]"
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {!subscribers.length && <p className="text-sm text-gray-500">No subscribers yet.</p>}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default StatusAdminPanel;
