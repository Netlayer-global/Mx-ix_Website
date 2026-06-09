import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { CheckCircle2, AlertTriangle, AlertOctagon, Wrench, Loader2, RefreshCw, Activity, Plus, Minus, Search } from 'lucide-react';
import { statusApi, SystemStatus, ComponentStatus, StatusComponentItem, IncidentItem } from '../services/api';

const STATUS_META: Record<ComponentStatus, { label: string; bar: string; text: string; band: string; Icon: React.ElementType }> = {
  operational: { label: 'Operational', bar: 'bg-green-500', text: 'text-green-600', band: 'bg-green-500', Icon: CheckCircle2 },
  degraded: { label: 'Degraded', bar: 'bg-amber-400', text: 'text-amber-600', band: 'bg-amber-500', Icon: AlertTriangle },
  partial_outage: { label: 'Partial Outage', bar: 'bg-orange-500', text: 'text-orange-600', band: 'bg-orange-500', Icon: AlertTriangle },
  major_outage: { label: 'Major Outage', bar: 'bg-[#F20732]', text: 'text-[#F20732]', band: 'bg-[#F20732]', Icon: AlertOctagon },
  maintenance: { label: 'Maintenance', bar: 'bg-blue-400', text: 'text-blue-600', band: 'bg-blue-500', Icon: Wrench },
};

const IMPACT_TEXT: Record<string, string> = {
  minor: 'text-amber-600 border-amber-300',
  major: 'text-orange-600 border-orange-300',
  critical: 'text-[#F20732] border-[#F20732]/40',
  maintenance: 'text-blue-600 border-blue-300',
};
const INCIDENT_STATUS_TEXT: Record<string, string> = {
  investigating: 'text-[#F20732]', identified: 'text-orange-600', monitoring: 'text-amber-600', resolved: 'text-green-600',
};

const rank: Record<ComponentStatus, number> = { operational: 0, maintenance: 1, degraded: 2, partial_outage: 3, major_outage: 4 };
const worse = (a: ComponentStatus, b: ComponentStatus): ComponentStatus => (rank[a] >= rank[b] ? a : b);
const impactToStatus = (impact: string): ComponentStatus =>
  impact === 'critical' ? 'major_outage' : impact === 'major' ? 'partial_outage' : impact === 'maintenance' ? 'maintenance' : 'degraded';

const DAYS = 60;
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const fmtDate = (d: string) => new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const StatusPage: React.FC = () => {
  const [data, setData] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [popup, setPopup] = useState<{ x: number; y: number; date: Date; status: ComponentStatus; component: string; incidents: IncidentItem[] } | null>(null);
  const [pinned, setPinned] = useState(false);
  const [email, setEmail] = useState('');
  const [subState, setSubState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [subMsg, setSubMsg] = useState('');

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubState('loading');
    const res = await statusApi.subscribe(email.trim());
    if (res.success) { setSubState('done'); setSubMsg('Subscribed! You\'ll be notified of incidents.'); setEmail(''); }
    else { setSubState('error'); setSubMsg(res.error || 'Could not subscribe'); }
  };

  const load = useCallback(async () => {
    const res = await statusApi.get();
    if (res.success && res.data) { setData(res.data); setError(''); setUpdatedAt(new Date()); }
    else setError(res.error || 'Unable to load status');
    setLoading(false);
  }, []);

  useEffect(() => {
    document.body.classList.add('dark-nav');
    load();
    const t = setInterval(load, 30000);
    return () => { document.body.classList.remove('dark-nav'); clearInterval(t); };
  }, [load]);

  const incidents = data?.incidents || [];

  // Build a 60-day status history: real daily snapshots + incident overlay
  const buildBars = useCallback((c: StatusComponentItem) => {
    const today = startOfDay(new Date());
    const histMap = new Map((c.history || []).map((h) => [h.date, h.status]));
    const bars: { date: Date; status: ComponentStatus; incidents: IncidentItem[] }[] = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      let status: ComponentStatus = (histMap.get(key) as ComponentStatus) || 'operational';
      const dayIncidents: IncidentItem[] = [];
      incidents.forEach((inc) => {
        if (!inc.affectedComponents?.includes(c.name)) return;
        const start = startOfDay(new Date(inc.startedAt || inc.createdAt));
        const end = startOfDay(inc.resolvedAt ? new Date(inc.resolvedAt) : new Date());
        if (date >= start && date <= end) {
          dayIncidents.push(inc);
          status = worse(status, impactToStatus(inc.impact));
        }
      });
      if (i === 0 && c.status !== 'operational') status = worse(status, c.status);
      bars.push({ date, status, incidents: dayIncidents });
    }
    return bars;
  }, [incidents]);

  const groups = useMemo(() => {
    const map: Record<string, StatusComponentItem[]> = {};
    const q = search.trim().toLowerCase();
    (data?.components || []).forEach((c) => {
      if (q && q.length >= 2 && !c.name.toLowerCase().includes(q) && !c.group.toLowerCase().includes(q)) return;
      (map[c.group] ||= []).push(c);
    });
    return Object.entries(map);
  }, [data, search]);

  const groupStatus = (items: StatusComponentItem[]): ComponentStatus =>
    items.reduce<ComponentStatus>((acc, c) => worse(acc, c.status), 'operational');

  const overall = data?.overall;
  const overallMeta = overall ? STATUS_META[overall.status] : STATUS_META.operational;
  const activeIncidents = incidents.filter((i) => i.status !== 'resolved');
  const pastIncidents = incidents.filter((i) => i.status === 'resolved');

  return (
    <div className="min-h-screen bg-white">
      {/* HERO */}
      <section className="relative pt-36 md:pt-44 pb-12 bg-ink text-white overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#F20732]/15 blur-[120px]"></div>
        <div className="relative max-w-[1100px] mx-auto px-6 md:px-12">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-4 h-4 text-[#F20732]" />
            <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// System Status</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black leading-[0.9] tracking-tighter mb-3">MX-IX STATUS</h1>
          <p className="text-gray-400 text-sm md:text-base font-light max-w-2xl">
            Live status and incident history for the MX-IX fabric. Issues to report?{' '}
            <span className="text-white">support@mx-ix.com</span>
          </p>

          {/* Subscribe to updates */}
          <form onSubmit={handleSubscribe} className="mt-6 flex flex-col sm:flex-row gap-3 max-w-md">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setSubState('idle'); }}
              placeholder="you@network.com"
              className="flex-1 bg-white/5 border border-white/15 text-white placeholder-gray-500 px-4 py-3 font-mono text-sm focus:outline-none focus:border-[#F20732] transition-colors"
            />
            <button type="submit" disabled={subState === 'loading'} className="bg-[#F20732] text-white px-6 py-3 font-mono text-label-sm font-bold tracking-mono uppercase hover:bg-white hover:text-ink transition-colors disabled:opacity-50 whitespace-nowrap">
              {subState === 'loading' ? 'Subscribing…' : 'Subscribe to Updates'}
            </button>
          </form>
          {subState === 'done' && <p className="mt-2 font-mono text-label-sm text-green-400">{subMsg}</p>}
          {subState === 'error' && <p className="mt-2 font-mono text-label-sm text-[#F20732]">{subMsg}</p>}
        </div>
      </section>

      <section className="relative bg-white py-10 min-h-[55vh]">
        <div className="max-w-[1100px] mx-auto px-6 md:px-12">
          {loading ? (
            <div className="flex items-center justify-center py-24 border border-gray-200"><Loader2 className="w-6 h-6 animate-spin text-[#F20732]" /></div>
          ) : error ? (
            <div className="flex items-center gap-3 p-6 border border-[#F20732]/30 bg-[#F20732]/5">
              <AlertTriangle className="w-5 h-5 text-[#F20732]" /><span className="text-sm text-gray-600">{error}</span>
            </div>
          ) : (
            <>
              {/* Overall banner */}
              <div className={`relative overflow-hidden ${overallMeta.band} text-white px-6 py-5 mb-6 flex items-center gap-4`}>
                <overallMeta.Icon className="w-7 h-7 flex-shrink-0" />
                <div className="text-xl md:text-2xl font-black tracking-tight">
                  {activeIncidents.length > 0 ? 'There are ongoing incidents' : overall?.label}
                </div>
                <div className="ml-auto flex items-center gap-3">
                  <span className="font-mono text-label-sm tracking-label uppercase opacity-80 hidden sm:inline">
                    {updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : ''}
                  </span>
                  <button onClick={load} className="p-2 hover:bg-white/20 rounded transition-colors" title="Refresh"><RefreshCw className="w-5 h-5" /></button>
                </div>
              </div>

              {/* Search */}
              <div className="relative mb-6 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search services (min 2 characters)…" className="w-full border border-gray-200 pl-10 pr-3 py-2.5 font-mono text-xs focus:outline-none focus:border-[#F20732] transition-colors" />
              </div>

              {/* Groups */}
              <div className="space-y-3">
                {groups.map(([group, items]) => {
                  const gs = groupStatus(items);
                  const gm = STATUS_META[gs];
                  const isCollapsed = collapsed[group];
                  return (
                    <div key={group} className="border border-gray-200">
                      <button onClick={() => setCollapsed((p) => ({ ...p, [group]: !p[group] }))} className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors hover-trigger">
                        <span className="flex items-center gap-3">
                          {isCollapsed ? <Plus className="w-4 h-4 text-gray-400" /> : <Minus className="w-4 h-4 text-gray-400" />}
                          <span className="font-black text-black tracking-tight">{group}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className={`font-mono text-xs font-bold uppercase tracking-wider ${gm.text}`}>{gm.label}</span>
                          <span className={`w-2.5 h-2.5 rounded-full ${gm.bar}`}></span>
                        </span>
                      </button>

                      {!isCollapsed && (
                        <div className="px-5 pb-5 pt-1 space-y-6 border-t border-gray-100">
                          {items.map((c) => {
                            const bars = buildBars(c);
                            const m = STATUS_META[c.status];
                            return (
                              <div key={c._id}>
                                <div className="flex items-center justify-between mb-2 mt-4">
                                  <div className="font-bold text-black text-sm">{c.name}</div>
                                  <span className={`font-mono text-[10px] font-bold uppercase tracking-wider ${m.text}`}>{m.label}</span>
                                </div>
                                {/* 60-day uptime bars */}
                                <div className="flex items-end gap-[2px] h-9">
                                  {bars.map((b, i) => (
                                    <div
                                      key={i}
                                      onMouseEnter={(e) => { if (!pinned) setPopup({ x: e.clientX, y: e.clientY, date: b.date, status: b.status, component: c.name, incidents: b.incidents }); }}
                                      onMouseLeave={() => { if (!pinned) setPopup(null); }}
                                      onClick={(e) => { setPinned(true); setPopup({ x: e.clientX, y: e.clientY, date: b.date, status: b.status, component: c.name, incidents: b.incidents }); }}
                                      className={`flex-1 h-full cursor-pointer ${STATUS_META[b.status].bar} ${b.status === 'operational' ? 'opacity-70' : ''} hover:opacity-100 hover:ring-1 hover:ring-black/20 transition-all`}
                                    />
                                  ))}
                                </div>
                                <div className="flex items-center justify-between mt-1.5 font-mono text-[10px] text-gray-400 uppercase tracking-label">
                                  <span>{DAYS} days ago</span>
                                  <span>{typeof c.uptime === 'number' ? `${c.uptime}% uptime` : ''}</span>
                                  <span>Today</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {!groups.length && (
                  <div className="py-12 text-center border border-gray-200 border-dashed font-mono text-xs text-gray-400 uppercase tracking-label">No services match your search.</div>
                )}
              </div>

              {/* Current incidents */}
              {activeIncidents.length > 0 && (
                <div className="mt-12">
                  <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-2">
                    <h2 className="font-mono text-label-sm font-bold tracking-label uppercase text-black">Current Incidents</h2>
                    <span className="font-mono text-[10px] text-gray-400">Times shown in your local timezone</span>
                  </div>
                  <div className="space-y-4">{activeIncidents.map((inc) => <IncidentCard key={inc._id} inc={inc} />)}</div>
                </div>
              )}

              {/* Past incidents */}
              {pastIncidents.length > 0 && (
                <div className="mt-12">
                  <h2 className="font-mono text-label-sm font-bold tracking-label uppercase text-gray-400 mb-4 border-b border-gray-200 pb-2">Incident History</h2>
                  <div className="space-y-4">{pastIncidents.map((inc) => <IncidentCard key={inc._id} inc={inc} resolved />)}</div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Hover / click popup (Extreme-style) */}
      {popup && (
        <>
          {pinned && <div className="fixed inset-0 z-[90]" onClick={() => { setPinned(false); setPopup(null); }} />}
          <div
            className="fixed z-[100] w-64 bg-white border border-gray-200 shadow-elevated p-4 pointer-events-none"
            style={{ left: popup.x, top: popup.y, transform: 'translate(-50%, calc(-100% - 14px))' }}
          >
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
              <span className="font-bold text-black text-sm">
                {popup.date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <span className={`w-2.5 h-2.5 rounded-full ${STATUS_META[popup.status].bar}`}></span>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-label text-gray-400 mb-2">{popup.component}</div>
            {popup.incidents.length ? (
              <div className="space-y-2.5">
                {popup.incidents.map((inc) => (
                  <div key={inc._id}>
                    <div className={`text-xs font-bold ${IMPACT_TEXT[inc.impact]?.split(' ')[0] || 'text-gray-700'}`}>
                      [{inc.impact}] {inc.title}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {inc.resolvedAt ? `Resolved ${fmtDate(inc.resolvedAt)}` : `Ongoing — ${inc.status}`}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-green-600">
                <CheckCircle2 className="w-4 h-4" /> No incidents reported
              </div>
            )}
            {/* arrow */}
            <div className="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-3 h-3 bg-white border-r border-b border-gray-200 rotate-45"></div>
          </div>
        </>
      )}
    </div>
  );
};

const IncidentCard: React.FC<{ inc: IncidentItem; resolved?: boolean }> = ({ inc, resolved }) => (
  <div className={`border-l-4 border border-gray-200 p-5 ${resolved ? 'border-l-green-500' : 'border-l-[#F20732] bg-[#F20732]/[0.02]'}`}>
    <div className="flex items-start gap-3 mb-2 flex-wrap">
      <span className={`font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-1 border ${IMPACT_TEXT[inc.impact] || 'text-gray-500 border-gray-300'}`}>
        {inc.impact} incident
      </span>
      <h3 className="font-bold text-black flex-1">{inc.title}</h3>
    </div>
    <div className="space-y-2 mt-3 mb-3">
      {inc.updates.map((u, i) => (
        <div key={i} className="flex gap-3 text-sm">
          <span className="font-mono text-[10px] text-gray-400 whitespace-nowrap pt-0.5 w-28 flex-shrink-0">{fmtDate(u.timestamp)}</span>
          <div>
            <span className={`font-mono text-[10px] font-bold uppercase mr-2 ${INCIDENT_STATUS_TEXT[u.status]}`}>[{u.status}]</span>
            <span className="text-gray-700">{u.message}</span>
          </div>
        </div>
      ))}
    </div>
    {inc.affectedComponents.length > 0 && (
      <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
        {inc.affectedComponents.map((c) => (
          <span key={c} className="font-mono text-[10px] text-gray-500 border border-gray-200 rounded-full px-2.5 py-0.5">{c}</span>
        ))}
      </div>
    )}
  </div>
);

export default StatusPage;
