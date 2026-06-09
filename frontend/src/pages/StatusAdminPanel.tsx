import React, { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, Loader2, Plus, Trash2, Activity, AlertTriangle, Save } from 'lucide-react';
import {
  statusApi,
  StatusComponentItem,
  IncidentItem,
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
  // per-incident update drafts
  const [draft, setDraft] = useState<Record<string, { status: IncidentStatus; message: string }>>({});

  const load = useCallback(async () => {
    const res = await statusApi.get();
    if (res.success && res.data) { setComponents(res.data.components); setIncidents(res.data.incidents); }
    const subs = await statusApi.getSubscribers();
    if (subs.success && subs.data) setSubCount(subs.data.count);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveComp = async (c: StatusComponentItem, patch: Partial<StatusComponentItem>) => {
    setComponents((prev) => prev.map((x) => (x._id === c._id ? { ...x, ...patch } : x)));
    await statusApi.updateComponent(c._id, patch);
  };
  const setCompStatus = async (c: StatusComponentItem, status: ComponentStatus) => saveComp(c, { status });
  const setCompUptime = async (c: StatusComponentItem, uptime: number) => saveComp(c, { uptime });
  const addComponent = async () => {
    if (!newComp.name.trim()) return;
    const order = components.length + 1;
    const res = await statusApi.createComponent({ ...newComp, order });
    if (res.success) { setNewComp({ name: '', group: 'Core Services', status: 'operational', description: '' }); load(); }
  };
  const removeComponent = async (id: string) => {
    if (!confirm('Delete this component?')) return;
    await statusApi.deleteComponent(id); load();
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
              <p className="text-gray-400 text-sm">Manage components &amp; incidents</p>
            </div>
          </div>
          {subCount !== null && (
            <div className="ml-auto text-right">
              <div className="text-lg font-bold">{subCount}</div>
              <div className="text-[10px] uppercase tracking-wider text-gray-400 font-mono">Subscribers</div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-10">
        {/* COMPONENTS */}
        <section>
          <h2 className="text-lg font-bold mb-4">Components</h2>
          <div className="space-y-2">
            {components.map((c) => (
              <div key={c._id} className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <input defaultValue={c.name} onBlur={(e) => saveComp(c, { name: e.target.value })} className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm font-bold" placeholder="Name" />
                  <input defaultValue={c.group} onBlur={(e) => saveComp(c, { group: e.target.value })} className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm w-40" placeholder="Group" />
                  <select value={c.status} onChange={(e) => setCompStatus(c, e.target.value as ComponentStatus)} className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm">
                    {COMPONENT_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                  <input type="number" min={0} max={100} step={0.01} defaultValue={c.uptime ?? 100} onBlur={(e) => setCompUptime(c, Number(e.target.value))} className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm w-24" title="Uptime %" />
                  <button onClick={() => removeComponent(c._id)} className="p-2 text-gray-400 hover:text-[#F20732] transition-colors"><Trash2 className="w-4 h-4" /></button>
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
                <label className="block text-[10px] uppercase tracking-wider text-gray-400 font-mono mb-1">Started at (optional)</label>
                <input type="datetime-local" value={newInc.startedAt} onChange={(e) => setNewInc({ ...newInc, startedAt: e.target.value })} className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-gray-400 font-mono mb-1">Resolved at (optional)</label>
                <input type="datetime-local" value={newInc.resolvedAt} onChange={(e) => setNewInc({ ...newInc, resolvedAt: e.target.value })} className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <textarea value={newInc.message} onChange={(e) => setNewInc({ ...newInc, message: e.target.value })} placeholder="First update message…" rows={2} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm" />
            <div>
              <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider font-mono">Affected components</div>
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
                      <span className="font-mono text-[10px] uppercase tracking-wider text-gray-400">{inc.status}</span>
                    </div>
                  </div>
                  <button onClick={() => removeIncident(inc._id)} className="p-1.5 text-gray-400 hover:text-[#F20732]"><Trash2 className="w-4 h-4" /></button>
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
      </main>
    </div>
  );
};

export default StatusAdminPanel;
