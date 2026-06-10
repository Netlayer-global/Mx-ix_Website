import React, { useEffect, useState, useCallback } from 'react';
import {
  Loader2,
  Share2,
  ChevronDown,
  Download,
  RefreshCw,
  AlertCircle,
  Send,
  Inbox,
  ArrowUpRight,
  ArrowDownLeft,
  Save,
  Plus,
  X,
  Check,
  Ban,
} from 'lucide-react';
import {
  portalApi,
  portalPeeringApi,
  PortalOrgInfo,
  PortalSession,
  PeeringRequestItem,
  PeerNetwork,
  PeeringPolicyInfo,
  MarketplaceNetwork,
} from '../../services/api';
import { formatAsPath, formatCommunities, formatCommunity, downloadCSV } from '../../shared/lg';
import { PageHeading, Badge, sessionStateTone, EmptyState } from './ui';

interface Props {
  org: PortalOrgInfo;
}

type Tab = 'sessions' | 'bilateral' | 'marketplace' | 'policy';
type RouteFilter = 'received' | 'filtered' | 'not-exported';

interface RouteRow {
  network: string;
  gateway?: string;
  bgp?: { as_path?: number[]; communities?: number[][]; large_communities?: number[][] };
}

/** Decode well-known community labels for a filtered route's reason hint. */
const filterReason = (r: RouteRow): string => {
  const labels: string[] = [];
  (r.bgp?.communities || []).forEach((c) => {
    const f = formatCommunity(c);
    if (f.label) labels.push(f.label);
  });
  if (labels.length) return labels.join(', ');
  if ((r.bgp?.large_communities || []).length) return 'Policy / IRR / RPKI filter';
  return 'Route-server policy';
};

const PortalPeering: React.FC<Props> = ({ org }) => {
  const [tab, setTab] = useState<Tab>('sessions');

  return (
    <div>
      <PageHeading
        eyebrow="// Peering"
        title="Peering Management"
        subtitle={`Sessions, bilateral requests and peering policy for ${org.asn ? `AS${org.asn}` : 'your network'}.`}
      />

      <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
        {([
          { id: 'sessions', label: 'Route-server sessions' },
          { id: 'bilateral', label: 'Bilateral peering' },
          { id: 'marketplace', label: 'Marketplace' },
          { id: 'policy', label: 'My policy' },
        ] as { id: Tab; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-3 font-mono text-label-sm tracking-mono uppercase transition-colors hover-trigger relative ${
              tab === t.id ? 'text-ink' : 'text-gray-400 hover:text-ink'
            }`}
          >
            {t.label}
            {tab === t.id && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#F20732]" />}
          </button>
        ))}
      </div>

      {tab === 'sessions' && <SessionsTab org={org} />}
      {tab === 'bilateral' && <BilateralTab org={org} />}
      {tab === 'marketplace' && <MarketplaceTab />}
      {tab === 'policy' && <PolicyTab />}
    </div>
  );
};

// ── Route-server sessions (scoped Looking Glass) ───────────────────────────

const SessionsTab: React.FC<Props> = ({ org }) => {
  const [sessions, setSessions] = useState<PortalSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [lgReachable, setLgReachable] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<RouteFilter>('received');
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await portalApi.getPeeringSessions();
    if (res.success && res.data) {
      setSessions(res.data.sessions);
      setLgReachable(res.data.lgReachable);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadRoutes = useCallback(async (s: PortalSession, f: RouteFilter) => {
    setRoutesLoading(true);
    setRoutes([]);
    const res = await portalApi.getPeeringRoutes(s.routeserverId, s.neighborId, f);
    if (res.success && res.data) {
      const d = res.data as any;
      const list: RouteRow[] = d.imported || d.filtered || d.routes || d.not_exported || [];
      setRoutes(list);
    }
    setRoutesLoading(false);
  }, []);

  const toggle = (s: PortalSession) => {
    const key = `${s.routeserverId}:${s.neighborId}`;
    if (expanded === key) {
      setExpanded(null);
      return;
    }
    setExpanded(key);
    setFilter('received');
    loadRoutes(s, 'received');
  };

  const switchFilter = (s: PortalSession, f: RouteFilter) => {
    setFilter(f);
    loadRoutes(s, f);
  };

  const exportCsv = () => {
    downloadCSV(
      `mx-ix-${filter}-prefixes.csv`,
      ['Prefix', 'AS Path', 'Communities'],
      routes.map((r) => [r.network, formatAsPath(r.bgp?.as_path), formatCommunities(r.bgp?.communities)])
    );
  };

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-[#F20732]" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 font-mono text-label-sm tracking-mono uppercase text-ink hover:border-ink transition-colors hover-trigger"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {!org.asn && (org.additionalAsns?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Share2 className="w-10 h-10" />}
          title="No ASN on file"
          hint="Add your ASN (or contact MX-IX) so we can show your route-server sessions."
        />
      ) : !lgReachable ? (
        <div className="border border-amber-500/30 bg-amber-500/10 p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-mono text-label tracking-label uppercase text-amber-700">Looking Glass unavailable</p>
            <p className="text-sm text-gray-600 mt-1">We couldn't reach the route servers right now. Please try again shortly.</p>
          </div>
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={<Share2 className="w-10 h-10" />}
          title="No active sessions found"
          hint="We didn't find any route-server sessions for your ASN. Sessions appear here once your peering is established."
        />
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => {
            const key = `${s.routeserverId}:${s.neighborId}`;
            const st = sessionStateTone(s.state);
            const isOpen = expanded === key;
            return (
              <div key={key} className="bg-white border border-gray-200">
                <button
                  onClick={() => toggle(s)}
                  className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-gray-50 transition-colors hover-trigger"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{s.routeserver}</p>
                      <p className="font-mono text-xs text-gray-400 mt-0.5 truncate">{s.address}</p>
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-6 font-mono text-xs text-gray-500">
                    <span><span className="text-ink font-bold tabular-nums">{s.routesReceived}</span> received</span>
                    <span><span className="text-ink font-bold tabular-nums">{s.routesFiltered}</span> filtered</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                  <ChevronDown className={`w-4 h-4 md:hidden transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                  <div className="border-t border-gray-200">
                    <div className="px-5 py-3 flex items-center justify-between gap-3 bg-gray-50 flex-wrap">
                      <div className="flex items-center gap-1">
                        {(['received', 'filtered', 'not-exported'] as RouteFilter[]).map((f) => (
                          <button
                            key={f}
                            onClick={() => switchFilter(s, f)}
                            className={`px-3 py-1.5 font-mono text-label-sm tracking-mono uppercase transition-colors hover-trigger ${
                              filter === f ? 'bg-ink text-white' : 'text-gray-500 hover:text-ink'
                            }`}
                          >
                            {f.replace('-', ' ')}
                          </button>
                        ))}
                      </div>
                      {routes.length > 0 && (
                        <button
                          onClick={exportCsv}
                          className="flex items-center gap-1.5 font-mono text-label-sm tracking-mono uppercase text-gray-500 hover:text-[#F20732] transition-colors hover-trigger"
                        >
                          <Download className="w-3.5 h-3.5" /> CSV
                        </button>
                      )}
                    </div>

                    {filter === 'filtered' && (
                      <p className="px-5 pt-3 text-xs text-gray-500">
                        Filtered prefixes were rejected by the route server (RPKI invalid, IRR mismatch, bogon, or
                        max-prefix). The reason column decodes any well-known BGP communities attached.
                      </p>
                    )}

                    {routesLoading ? (
                      <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#F20732]" /></div>
                    ) : routes.length ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 text-left">
                              <th className="px-5 py-3 font-mono text-label-sm tracking-label uppercase text-gray-400 font-normal">Prefix</th>
                              <th className="px-5 py-3 font-mono text-label-sm tracking-label uppercase text-gray-400 font-normal">AS Path</th>
                              {filter === 'filtered' ? (
                                <th className="px-5 py-3 font-mono text-label-sm tracking-label uppercase text-gray-400 font-normal">Reason</th>
                              ) : (
                                <th className="px-5 py-3 font-mono text-label-sm tracking-label uppercase text-gray-400 font-normal">Communities</th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {routes.slice(0, 200).map((r, i) => (
                              <tr key={`${r.network}-${i}`} className="hover:bg-gray-50">
                                <td className="px-5 py-2.5 font-mono text-ink break-all">{r.network}</td>
                                <td className="px-5 py-2.5 font-mono text-gray-600">{formatAsPath(r.bgp?.as_path)}</td>
                                {filter === 'filtered' ? (
                                  <td className="px-5 py-2.5 font-mono text-amber-700 text-xs">{filterReason(r)}</td>
                                ) : (
                                  <td className="px-5 py-2.5 font-mono text-gray-500 text-xs">{formatCommunities(r.bgp?.communities)}</td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {routes.length > 200 && (
                          <p className="px-5 py-3 text-xs text-gray-400 font-mono">
                            Showing first 200 of {routes.length} prefixes — export CSV for the full list.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="px-5 py-10 text-center font-mono text-label-sm tracking-mono uppercase text-gray-400">
                        No {filter.replace('-', ' ')} prefixes
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Bilateral peering requests ─────────────────────────────────────────────

const reqTone = (status: string) =>
  status === 'accepted' ? 'green' : status === 'pending' ? 'amber' : status === 'rejected' ? 'red' : 'gray';

const BilateralTab: React.FC<Props> = ({ org }) => {
  const [requests, setRequests] = useState<PeeringRequestItem[]>([]);
  const [networks, setNetworks] = useState<PeerNetwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [toAsn, setToAsn] = useState('');
  const [toName, setToName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [r, n] = await Promise.all([portalPeeringApi.listRequests(), portalPeeringApi.getNetworks()]);
    if (r.success && r.data) setRequests(r.data);
    if (n.success && n.data) setNetworks(n.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    setError('');
    if (!toAsn) {
      setError('Target ASN is required.');
      return;
    }
    setSaving(true);
    const res = await portalPeeringApi.createRequest({ toAsn: Number(toAsn), toName, message });
    setSaving(false);
    if (res.success) {
      setToAsn('');
      setToName('');
      setMessage('');
      setShowNew(false);
      load();
    } else {
      setError(res.error || 'Failed to send request.');
    }
  };

  const respond = async (id: string, action: 'accept' | 'reject') => {
    await portalPeeringApi.respondRequest(id, action);
    load();
  };
  const cancel = async (id: string) => {
    await portalPeeringApi.cancelRequest(id);
    load();
  };

  const pickNetwork = (asn: number, name: string) => {
    setToAsn(String(asn));
    setToName(name);
    setShowNew(true);
  };

  const inputClass =
    'w-full bg-white border border-gray-300 text-ink placeholder-gray-400 px-4 py-3 font-mono text-sm focus:outline-none focus:border-[#F20732] transition-colors';

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-[#F20732]" />
      </div>
    );
  }

  const incoming = requests.filter((r) => r.direction === 'incoming');
  const outgoing = requests.filter((r) => r.direction === 'outgoing');

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button
          onClick={() => setShowNew((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#F20732] text-white font-mono text-label-sm tracking-mono uppercase hover:bg-ink transition-colors hover-trigger"
        >
          <Plus className="w-4 h-4" /> Request Peering
        </button>
      </div>

      {showNew && (
        <section className="bg-white border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-mono text-label tracking-label uppercase text-ink">New bilateral peering request</h3>
            <button onClick={() => setShowNew(false)} className="text-gray-400 hover:text-ink"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={toAsn} onChange={(e) => setToAsn(e.target.value)} placeholder="Target ASN *" className={inputClass} />
            <input value={toName} onChange={(e) => setToName(e.target.value)} placeholder="Network name (optional)" className={inputClass} />
          </div>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message (optional)" rows={2} className={`${inputClass} mt-3`} />
          {error && <p className="text-[#F20732] font-mono text-xs mt-3">{error}</p>}
          <div className="flex justify-end mt-4">
            <button onClick={submit} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-[#F20732] text-white font-mono text-label-sm tracking-mono uppercase hover:bg-ink transition-colors disabled:opacity-50 hover-trigger">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send Request
            </button>
          </div>
        </section>
      )}

      {/* Incoming */}
      <section>
        <h3 className="font-mono text-label tracking-label uppercase text-ink mb-3 flex items-center gap-2">
          <Inbox className="w-4 h-4 text-[#F20732]" /> Incoming requests
        </h3>
        {incoming.length ? (
          <div className="bg-white border border-gray-200 divide-y divide-gray-100">
            {incoming.map((r) => (
              <div key={r.id} className="px-5 py-4 flex items-center gap-4">
                <ArrowDownLeft className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">AS{r.fromAsn} <span className="text-gray-400 font-normal">wants to peer</span></p>
                  {r.message && <p className="text-xs text-gray-500 mt-0.5 truncate">"{r.message}"</p>}
                </div>
                <Badge tone={reqTone(r.status)}>{r.status}</Badge>
                {r.status === 'pending' && (
                  <>
                    <button onClick={() => respond(r.id, 'accept')} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white font-mono text-label-sm uppercase tracking-mono hover:bg-green-700 transition-colors hover-trigger"><Check className="w-3.5 h-3.5" /> Accept</button>
                    <button onClick={() => respond(r.id, 'reject')} className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 font-mono text-label-sm uppercase tracking-mono hover:border-[#F20732] hover:text-[#F20732] transition-colors hover-trigger"><Ban className="w-3.5 h-3.5" /> Reject</button>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Inbox className="w-8 h-8" />} title="No incoming requests" />
        )}
      </section>

      {/* Outgoing */}
      <section>
        <h3 className="font-mono text-label tracking-label uppercase text-ink mb-3 flex items-center gap-2">
          <Send className="w-4 h-4 text-[#F20732]" /> Sent requests
        </h3>
        {outgoing.length ? (
          <div className="bg-white border border-gray-200 divide-y divide-gray-100">
            {outgoing.map((r) => (
              <div key={r.id} className="px-5 py-4 flex items-center gap-4">
                <ArrowUpRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{r.toName} <span className="text-gray-400 font-normal">AS{r.toAsn}</span></p>
                  {r.responseMessage && <p className="text-xs text-gray-500 mt-0.5 truncate">Reply: "{r.responseMessage}"</p>}
                </div>
                <Badge tone={reqTone(r.status)}>{r.status}</Badge>
                {r.status === 'pending' && (
                  <button onClick={() => cancel(r.id)} className="font-mono text-label-sm uppercase tracking-mono text-gray-400 hover:text-[#F20732] transition-colors hover-trigger">Cancel</button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Send className="w-8 h-8" />} title="No sent requests" hint="Discover networks below and send a peering request." />
        )}
      </section>

      {/* Discover networks */}
      <section>
        <h3 className="font-mono text-label tracking-label uppercase text-ink mb-3 flex items-center gap-2">
          <Share2 className="w-4 h-4 text-[#F20732]" /> Networks at MX-IX
        </h3>
        {networks.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {networks.map((n) => (
              <div key={n.id} className="group bg-white border border-gray-200 p-4 hover:border-gray-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{n.name}</p>
                    <p className="font-mono text-xs text-gray-400 mt-0.5">AS{n.asn} · {n.type}</p>
                  </div>
                  <Badge tone={n.peeringPolicy === 'Open' ? 'green' : 'gray'}>{n.peeringPolicy}</Badge>
                </div>
                <button
                  onClick={() => pickNetwork(n.asn, n.name)}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-200 font-mono text-label-sm uppercase tracking-mono text-ink hover:bg-ink hover:text-white transition-colors hover-trigger"
                >
                  <Send className="w-3.5 h-3.5" /> Request peering
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Share2 className="w-8 h-8" />} title="No other networks listed yet" />
        )}
      </section>
    </div>
  );
};

// ── Peering marketplace (discovery) ────────────────────────────────────────

const MarketplaceTab: React.FC = () => {
  const [networks, setNetworks] = useState<MarketplaceNetwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [sent, setSent] = useState<Record<number, boolean>>({});

  const load = useCallback(async () => {
    const res = await portalPeeringApi.getMarketplace();
    if (res.success && res.data) setNetworks(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const request = async (n: MarketplaceNetwork) => {
    const res = await portalPeeringApi.createRequest({ toAsn: n.asn, toName: n.name });
    if (res.success) setSent((s) => ({ ...s, [n.asn]: true }));
  };

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-[#F20732]" />
      </div>
    );
  }

  const recommended = networks.filter((n) => n.recommended);
  const others = networks.filter((n) => !n.recommended);

  const Card: React.FC<{ n: MarketplaceNetwork }> = ({ n }) => {
    const already = n.requestStatus || sent[n.asn];
    return (
      <div className="group bg-white border border-gray-200 p-4 hover:border-gray-300 transition-colors relative overflow-hidden">
        {n.recommended && <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732]" />}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">{n.name}</p>
            <p className="font-mono text-xs text-gray-400 mt-0.5">AS{n.asn} · {n.type}</p>
          </div>
          <Badge tone={n.peeringPolicy === 'Open' ? 'green' : 'gray'}>{n.peeringPolicy}</Badge>
        </div>
        {n.sharedLocations.length > 0 && (
          <p className="text-xs text-gray-500 mt-2">
            Shared: <span className="text-ink">{n.sharedLocations.join(', ')}</span>
          </p>
        )}
        <button
          onClick={() => request(n)}
          disabled={!!already}
          className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-200 font-mono text-label-sm uppercase tracking-mono text-ink hover:bg-ink hover:text-white transition-colors disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-ink hover-trigger"
        >
          <Send className="w-3.5 h-3.5" /> {already ? (sent[n.asn] ? 'Requested' : n.requestStatus) : 'Request peering'}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {recommended.length > 0 && (
        <section>
          <h3 className="font-mono text-label tracking-label uppercase text-ink mb-3">Recommended for you</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recommended.map((n) => (
              <Card key={n.id} n={n} />
            ))}
          </div>
        </section>
      )}
      <section>
        <h3 className="font-mono text-label tracking-label uppercase text-ink mb-3">All networks</h3>
        {others.length || recommended.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {others.map((n) => (
              <Card key={n.id} n={n} />
            ))}
          </div>
        ) : (
          <EmptyState icon={<Share2 className="w-8 h-8" />} title="No networks listed yet" />
        )}
      </section>
    </div>
  );
};

// ── Peering policy (self-service) ──────────────────────────────────────────

const POLICIES = ['Open', 'Selective', 'Restrictive'];

const PolicyTab: React.FC = () => {
  const [policy, setPolicy] = useState<PeeringPolicyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const res = await portalPeeringApi.getPolicy();
      if (res.success && res.data) setPolicy(res.data);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (!policy) return;
    setSaving(true);
    setError('');
    setDone(false);
    const res = await portalPeeringApi.updatePolicy({
      peeringPolicy: policy.peeringPolicy,
      peeringPolicyUrl: policy.peeringPolicyUrl,
      peeringNotes: policy.peeringNotes,
    });
    setSaving(false);
    if (res.success) setDone(true);
    else setError(res.error || 'Failed to save. Admin role required.');
  };

  const inputClass =
    'w-full bg-white border border-gray-300 text-ink placeholder-gray-400 px-4 py-3 font-mono text-sm focus:outline-none focus:border-[#F20732] transition-colors';

  if (loading || !policy) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-[#F20732]" />
      </div>
    );
  }

  return (
    <section className="bg-white border border-gray-200 p-6 max-w-2xl">
      <h3 className="font-mono text-label tracking-label uppercase text-ink mb-5">Your peering policy</h3>
      <div className="space-y-4">
        <div>
          <label className="block font-mono text-label-sm tracking-label uppercase text-gray-400 mb-2">Policy</label>
          <div className="flex gap-2">
            {POLICIES.map((p) => (
              <button
                key={p}
                onClick={() => setPolicy({ ...policy, peeringPolicy: p })}
                className={`px-4 py-2.5 font-mono text-label-sm uppercase tracking-mono border transition-colors hover-trigger ${
                  policy.peeringPolicy === p ? 'bg-ink text-white border-ink' : 'border-gray-300 text-gray-500 hover:border-ink'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block font-mono text-label-sm tracking-label uppercase text-gray-400 mb-2">Policy URL</label>
          <input
            value={policy.peeringPolicyUrl}
            onChange={(e) => setPolicy({ ...policy, peeringPolicyUrl: e.target.value })}
            placeholder="https://as{asn}.peeringdb.com / your peering policy page"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block font-mono text-label-sm tracking-label uppercase text-gray-400 mb-2">Notes</label>
          <textarea
            value={policy.peeringNotes}
            onChange={(e) => setPolicy({ ...policy, peeringNotes: e.target.value })}
            placeholder="Requirements, preferred locations, contact for peering, etc."
            rows={4}
            className={inputClass}
          />
        </div>

        {error && <p className="text-[#F20732] font-mono text-xs">{error}</p>}
        {done && <p className="text-green-600 font-mono text-xs flex items-center gap-1.5"><Check className="w-4 h-4" /> Policy saved.</p>}

        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-3 bg-[#F20732] text-white font-mono text-label-sm font-bold tracking-mono uppercase hover:bg-ink transition-colors disabled:opacity-60 hover-trigger"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save policy
        </button>
      </div>
    </section>
  );
};

export default PortalPeering;
