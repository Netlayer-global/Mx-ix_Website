import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Search,
  Server,
  Loader2,
  AlertTriangle,
  Radio,
  Network,
  RefreshCw,
  ArrowUpDown,
  X,
  MapPin,
  ChevronRight,
  ArrowLeft,
  Copy,
  Check,
  Cpu,
} from 'lucide-react';
import {
  lookingGlassApi,
  LgRouteServer,
  LgNeighbor,
  LgRoute,
} from '../services/api';
import { formatAsPath, formatCommunities, copyText } from '../shared/lg';

type View = 'locations' | 'servers' | 'neighbors' | 'neighbor';
type RouteFilter = 'received' | 'filtered';
type SortKey = 'asn' | 'description' | 'state' | 'routes_received';
type SearchMode = 'prefix' | 'asn';

const ROUTES_PER_PAGE = 50;

const pickRoutes = (data: any): LgRoute[] =>
  (data?.imported || data?.routes || data?.filtered || []) as LgRoute[];
const pickNeighbors = (data: any): LgNeighbor[] =>
  (data?.neighbors || data?.neighbours || []) as LgNeighbor[];

const isV6 = (rs: LgRouteServer) => /ipv6|_v6/i.test(`${rs.name} ${rs.id}`);
const cityOf = (group: string) => group.replace(/^MX-?IX\s*/i, '').trim() || group;

const stateInfo = (n: LgNeighbor) => {
  const raw = (n.details?.bgp_state || n.state || '').toLowerCase();
  if (/up|established/.test(raw)) return { label: 'Established', cls: 'bg-green-100 text-green-700 border-green-200' };
  if (/idle|start|active|connect/.test(raw)) return { label: n.details?.bgp_state || 'Idle', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
  return { label: n.state || 'Down', cls: 'bg-gray-100 text-gray-500 border-gray-200' };
};

const formatUptime = (n: LgNeighbor) => {
  const up = (n.details?.bgp_state || n.state || '').toLowerCase();
  if (!/up|established/.test(up)) return '—';
  const v = Number(n.uptime);
  if (!v || !isFinite(v) || v > 3.15e9) return '—';
  const d = Math.floor(v / 86400), h = Math.floor((v % 86400) / 3600), m = Math.floor((v % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
};

const num = (v?: number) => (typeof v === 'number' ? v.toLocaleString() : '—');

interface RsStatus { version?: string; last_reboot?: string; router_id?: string; message?: string }

const LookingGlassPage: React.FC = () => {
  const [lookupMode, setLookupMode] = useState(false);
  const [view, setView] = useState<View>('locations');

  const [routeservers, setRouteservers] = useState<LgRouteServer[]>([]);
  const [rsLoading, setRsLoading] = useState(true);
  const [rsError, setRsError] = useState('');

  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedRs, setSelectedRs] = useState('');
  const [rsStatus, setRsStatus] = useState<RsStatus | null>(null);
  const [neighbors, setNeighbors] = useState<LgNeighbor[]>([]);
  const [neighborsLoading, setNeighborsLoading] = useState(false);
  const [neighborFilter, setNeighborFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('asn');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [selectedNeighbor, setSelectedNeighbor] = useState<LgNeighbor | null>(null);
  const [routeTab, setRouteTab] = useState<RouteFilter>('received');
  const [routes, setRoutes] = useState<LgRoute[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesError, setRoutesError] = useState('');

  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('prefix');
  const [asnResults, setAsnResults] = useState<{ rs: LgRouteServer; neighbor: LgNeighbor }[]>([]);
  const [lookupKind, setLookupKind] = useState<SearchMode>('prefix');

  const deepLinkDone = useRef(false);
  const pendingNeighborId = useRef<string | null>(null);

  useEffect(() => {
    document.body.classList.add('dark-nav');
    return () => document.body.classList.remove('dark-nav');
  }, []);

  // ── path deep-linking ──
  const updateHash = useCallback((rsId?: string, neighborId?: string) => {
    let path = '/looking-glass';
    if (rsId) path += `/${rsId}`;
    if (rsId && neighborId) path += `/${neighborId}`;
    history.replaceState(null, '', path);
  }, []);

  const loadRouteservers = useCallback(async () => {
    setRsLoading(true);
    setRsError('');
    const res = await lookingGlassApi.getRouteservers();
    if (res.success && res.data) setRouteservers(res.data.routeservers || []);
    else setRsError(res.error || 'Looking Glass backend is currently unreachable');
    setRsLoading(false);
  }, []);

  useEffect(() => { loadRouteservers(); }, [loadRouteservers]);

  const loadStatus = useCallback(async (rsId: string) => {
    setRsStatus(null);
    const res = await lookingGlassApi.getStatus(rsId);
    if (res.success && res.data?.status) setRsStatus(res.data.status as RsStatus);
  }, []);

  const loadNeighbors = useCallback(async (rsId: string) => {
    if (!rsId) return;
    setNeighborsLoading(true);
    const res = await lookingGlassApi.getNeighbors(rsId);
    const list = res.success && res.data ? pickNeighbors(res.data) : [];
    setNeighbors(list);
    setNeighborsLoading(false);
    // resolve a pending deep-linked neighbor
    if (pendingNeighborId.current) {
      const n = list.find((x) => x.id === pendingNeighborId.current);
      pendingNeighborId.current = null;
      if (n) openNeighbor(n, rsId, false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRoutes = useCallback(async (neighbor: LgNeighbor, filter: RouteFilter, rsId: string) => {
    setRoutesLoading(true);
    setRoutesError('');
    const res = await lookingGlassApi.getRoutes(rsId, neighbor.id, filter);
    if (res.success && res.data) setRoutes(pickRoutes(res.data));
    else setRoutesError(res.error || 'Failed to load routes');
    setRoutesLoading(false);
  }, []);

  // ── navigation ──
  const openLocation = (group: string) => { setSelectedGroup(group); setView('servers'); };

  const openServer = useCallback((rs: LgRouteServer, pushHash = true) => {
    setSelectedRs(rs.id);
    setSelectedGroup(rs.group || 'Route Servers');
    setSelectedNeighbor(null);
    setNeighborFilter('');
    setView('neighbors');
    if (pushHash) updateHash(rs.id);
    loadNeighbors(rs.id);
    loadStatus(rs.id);
  }, [loadNeighbors, loadStatus, updateHash]);

  const openNeighbor = useCallback((n: LgNeighbor, rsId: string, pushHash = true) => {
    setSelectedNeighbor(n);
    setRouteTab('received');
    setRoutes([]);
    setView('neighbor');
    if (pushHash) updateHash(rsId, n.id);
    fetchRoutes(n, 'received', rsId);
  }, [fetchRoutes, updateHash]);

  // ── restore from hash once route servers load ──
  useEffect(() => {
    if (deepLinkDone.current || !routeservers.length) return;
    deepLinkDone.current = true;
    const seg = window.location.pathname.replace(/^\//, '').split('/'); // ['looking-glass', rsId?, neighborId?]
    const rsId = seg[1];
    const neighborId = seg[2];
    if (rsId) {
      const rs = routeservers.find((r) => r.id === rsId);
      if (rs) {
        if (neighborId) pendingNeighborId.current = neighborId;
        openServer(rs, false);
      }
    }
  }, [routeservers, openServer]);

  const handleRouteTab = (tab: RouteFilter) => {
    setRouteTab(tab);
    if (selectedNeighbor) fetchRoutes(selectedNeighbor, tab, selectedRs);
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLookupMode(true);
    setLookupKind(searchMode);
    setRoutesLoading(true);
    setRoutesError('');
    setRoutes([]);
    setAsnResults([]);

    if (searchMode === 'asn') {
      // Client-side aggregation across all route servers (works for reachable RSes)
      const q = query.trim().replace(/^as/i, '').toLowerCase();
      const withTimeout = <T,>(p: Promise<T>, ms: number, fb: T) =>
        Promise.race([p, new Promise<T>((res) => setTimeout(() => res(fb), ms))]);

      const settled = await Promise.all(
        routeservers.map(async (rs) => {
          const res = await withTimeout(lookingGlassApi.getNeighbors(rs.id), 9000, { success: false } as any);
          const list = res.success && res.data ? pickNeighbors(res.data) : [];
          return list
            .filter((n) => String(n.asn).includes(q) || n.description?.toLowerCase().includes(q))
            .map((neighbor) => ({ rs, neighbor }));
        })
      );
      const results = settled.flat();
      setAsnResults(results);
      if (!results.length) setRoutesError('No matching BGP sessions found on reachable route servers.');
    } else {
      const res = await lookingGlassApi.lookup(query.trim());
      if (res.success && res.data) {
        const r = pickRoutes(res.data);
        setRoutes(r);
        if (!r.length) setRoutesError('No routes found. The global route store may still be initializing or has no data yet.');
      } else {
        setRoutesError(res.error || 'Lookup failed');
      }
    }
    setRoutesLoading(false);
  };

  const exitLookup = () => { setLookupMode(false); setQuery(''); setRoutes([]); setAsnResults([]); setRoutesError(''); };

  const openFromLookup = (rs: LgRouteServer, n: LgNeighbor) => {
    setSelectedRs(rs.id);
    setSelectedGroup(rs.group || 'Route Servers');
    setLookupMode(false);
    loadNeighbors(rs.id);
    loadStatus(rs.id);
    openNeighbor(n, rs.id);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const goLocations = () => { setView('locations'); updateHash(); };

  // ── derived ──
  const locations = useMemo(() => {
    const map: Record<string, LgRouteServer[]> = {};
    routeservers.forEach((rs) => { (map[rs.group || 'Route Servers'] ||= []).push(rs); });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [routeservers]);

  const serversInGroup = useMemo(
    () => routeservers.filter((rs) => (rs.group || 'Route Servers') === selectedGroup),
    [routeservers, selectedGroup]
  );
  const selectedRsObj = routeservers.find((r) => r.id === selectedRs);

  const filteredNeighbors = useMemo(() => {
    const q = neighborFilter.trim().toLowerCase();
    let list = neighbors;
    if (q) list = list.filter((n) => String(n.asn).includes(q) || n.description?.toLowerCase().includes(q) || n.address?.toLowerCase().includes(q));
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      let av: any, bv: any;
      if (sortKey === 'asn') { av = a.asn; bv = b.asn; }
      else if (sortKey === 'routes_received') { av = a.routes_received || 0; bv = b.routes_received || 0; }
      else if (sortKey === 'state') { av = stateInfo(a).label; bv = stateInfo(b).label; }
      else { av = a.description || ''; bv = b.description || ''; }
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }, [neighbors, neighborFilter, sortKey, sortDir]);

  const summary = useMemo(() => {
    const up = neighbors.filter((n) => /up|established/i.test(n.details?.bgp_state || n.state || '')).length;
    const rx = neighbors.reduce((a, n) => a + (n.routes_received || 0), 0);
    return { total: neighbors.length, up, rx };
  }, [neighbors]);

  // ── breadcrumb ──
  const crumbs: { label: string; onClick?: () => void }[] = [{ label: 'Locations', onClick: goLocations }];
  if (view !== 'locations' && selectedGroup) crumbs.push({ label: cityOf(selectedGroup), onClick: () => setView('servers') });
  if ((view === 'neighbors' || view === 'neighbor') && selectedRsObj)
    crumbs.push({ label: selectedRsObj.name.replace(/\s*\((IPv4|IPv6)\)/i, ''), onClick: () => { setView('neighbors'); updateHash(selectedRs); } });
  if (view === 'neighbor' && selectedNeighbor) crumbs.push({ label: `AS${selectedNeighbor.asn}` });

  return (
    <div className="min-h-screen bg-white">
      {/* ── HERO ── */}
      <section className="relative pt-36 md:pt-44 pb-12 bg-ink text-white overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#F20732]/15 blur-[120px]"></div>
        <div className="relative max-w-[1400px] mx-auto px-6 md:px-12">
          <div className="flex items-center gap-3 mb-4">
            <Radio className="w-4 h-4 text-[#F20732]" />
            <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Looking Glass</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black leading-[0.9] tracking-tighter mb-4">
            LOOKING <span className="text-[#F20732]">GLASS</span>
          </h1>
          <p className="max-w-2xl text-gray-400 text-sm md:text-base font-light leading-relaxed">
            Explore the MX-IX fabric by location — drill into route servers, inspect BGP sessions and trace routes in real time.
          </p>

          {/* search with mode toggle */}
          <form onSubmit={handleLookup} className="mt-6 flex flex-col gap-3 max-w-3xl">
            <div className="flex border border-white/15 w-fit">
              {(['prefix', 'asn'] as SearchMode[]).map((m) => (
                <button key={m} type="button" onClick={() => setSearchMode(m)}
                  className={`px-4 py-1.5 font-mono text-label-sm font-bold tracking-label uppercase transition-colors ${searchMode === m ? 'bg-[#F20732] text-white' : 'text-gray-400 hover:text-white'}`}>
                  {m === 'prefix' ? 'Prefix / IP' : 'ASN'}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchMode === 'prefix' ? 'e.g. 8.8.8.0/24 or 1.1.1.1' : 'e.g. 13335 or AS15169'}
                  className="w-full bg-white/5 border border-white/15 text-white placeholder-gray-500 pl-11 pr-4 py-3 font-mono text-sm focus:outline-none focus:border-[#F20732] transition-colors" />
              </div>
              <button type="submit" className="bg-[#F20732] text-white px-7 py-3 font-mono text-label-sm font-bold tracking-mono uppercase hover:bg-white hover:text-ink transition-colors flex items-center justify-center gap-2 whitespace-nowrap">
                <Search className="w-4 h-4" /> Query
              </button>
              {lookupMode && (
                <button type="button" onClick={exitLookup} className="px-5 py-3 font-mono text-label-sm font-bold tracking-mono uppercase border border-white/15 text-gray-300 hover:text-white transition-colors flex items-center gap-2">
                  <X className="w-4 h-4" /> Clear
                </button>
              )}
            </div>
          </form>
        </div>
      </section>

      {/* ── BODY ── */}
      <section className="relative bg-white py-10 min-h-[55vh]">
        <div className="relative max-w-[1400px] mx-auto px-6 md:px-12">

          {rsError && (
            <div className="flex items-start gap-4 p-6 border-2 border-[#F20732]/30 bg-[#F20732]/5 mb-8">
              <AlertTriangle className="w-6 h-6 text-[#F20732] flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-black mb-1">Looking Glass Unavailable</h3>
                <p className="text-sm text-gray-600 mb-3">{rsError}</p>
                <button onClick={loadRouteservers} className="inline-flex items-center gap-2 font-mono text-label-sm font-bold tracking-mono uppercase text-[#F20732] hover:text-black transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </button>
              </div>
            </div>
          )}

          {!lookupMode && !rsError && (
            <nav className="flex items-center flex-wrap gap-2 mb-6 font-mono text-label-sm uppercase tracking-label">
              {crumbs.map((c, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
                  {c.onClick ? <button onClick={c.onClick} className="text-gray-500 hover:text-[#F20732] transition-colors">{c.label}</button> : <span className="text-[#F20732] font-bold">{c.label}</span>}
                </React.Fragment>
              ))}
            </nav>
          )}

          {/* ── LOOKUP RESULTS ── */}
          {lookupMode ? (
            lookupKind === 'asn' ? (
              <div>
                <SectionLabel icon={Search} text={`BGP sessions matching "${query}"`} />
                {routesLoading ? (
                  <div className="flex items-center justify-center py-20 border border-gray-200"><Loader2 className="w-6 h-6 animate-spin text-[#F20732]" /></div>
                ) : asnResults.length ? (
                  <div className="border border-gray-200 overflow-x-auto">
                    <table className="w-full text-left min-w-[820px]">
                      <thead className="bg-ink text-white">
                        <tr>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-label">Location</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-label">Route Server</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-label">ASN</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-label">Neighbor</th>
                          <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-label">State</th>
                          <th className="px-4 py-3 text-right font-mono text-[10px] font-bold uppercase tracking-label">RX</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {asnResults.map(({ rs, neighbor }, i) => {
                          const st = stateInfo(neighbor);
                          return (
                            <tr key={`${rs.id}-${neighbor.id}-${i}`} onClick={() => openFromLookup(rs, neighbor)} className="border-t border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors hover-trigger group">
                              <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{cityOf(rs.group || '')}</td>
                              <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">{rs.name.replace(/\s*\((IPv4|IPv6)\)/i, '')} <span className="text-gray-400">{isV6(rs) ? 'v6' : 'v4'}</span></td>
                              <td className="px-4 py-3 font-mono text-xs font-bold text-black whitespace-nowrap">AS{neighbor.asn}</td>
                              <td className="px-4 py-3 text-xs text-gray-700 max-w-[200px] truncate">{neighbor.description || '—'}</td>
                              <td className="px-4 py-3"><span className={`font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-1 border ${st.cls}`}>{st.label}</span></td>
                              <td className="px-4 py-3 text-right font-mono text-xs font-bold text-black tabular-nums">{num(neighbor.routes_received)}</td>
                              <td className="px-4 py-3 text-right"><ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#F20732] inline" /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-16 text-center border border-gray-200 border-dashed"><p className="font-mono text-xs text-gray-400 uppercase tracking-label">{routesError || 'No matching sessions.'}</p></div>
                )}
              </div>
            ) : (
              <div>
                <SectionLabel icon={Search} text={`Lookup Results — "${query}"`} />
                <RoutesTable routes={routes} loading={routesLoading} error={routesError} empty="No routes found for this query." />
              </div>
            )
          ) : rsError ? null : (
            <>
              {/* LOCATIONS */}
              {view === 'locations' && (
                <>
                  <SectionLabel icon={MapPin} text="Select a Location" />
                  {rsLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 border border-gray-200 bg-gray-50 animate-pulse" />)}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 corner-marks relative">
                      {locations.map(([group, list]) => {
                        const v4 = list.filter((r) => !isV6(r)).length;
                        const v6 = list.filter((r) => isV6(r)).length;
                        return (
                          <button key={group} onClick={() => openLocation(group)} className="group relative text-left p-7 border border-gray-200 hover:border-[#F20732] hover:bg-gray-50 transition-colors hover-trigger overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732] -translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
                            <div className="flex items-center justify-between mb-6">
                              <MapPin className="w-7 h-7 text-black group-hover:text-[#F20732] transition-colors" strokeWidth={1.75} />
                              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#F20732] group-hover:translate-x-1 transition-all" />
                            </div>
                            <h3 className="text-2xl font-black tracking-tight text-black mb-1">{cityOf(group)}</h3>
                            <p className="font-mono text-label-sm tracking-label uppercase text-gray-400">{list.length} Route Servers · {v4}× v4 · {v6}× v6</p>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* How it works + legend */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-12">
                    <div className="lg:col-span-2 border border-gray-200 p-7">
                      <SectionLabel icon={Radio} text="How to use the Looking Glass" />
                      <ol className="space-y-3 text-sm text-gray-600 leading-relaxed">
                        <li className="flex gap-3"><span className="font-mono font-bold text-[#F20732]">01</span> Pick a <strong className="text-black">location</strong> to see the route servers deployed there.</li>
                        <li className="flex gap-3"><span className="font-mono font-bold text-[#F20732]">02</span> Open a <strong className="text-black">route server</strong> to list every BGP session and its state.</li>
                        <li className="flex gap-3"><span className="font-mono font-bold text-[#F20732]">03</span> Click a <strong className="text-black">neighbor</strong> for full session details and the routes it advertises.</li>
                        <li className="flex gap-3"><span className="font-mono font-bold text-[#F20732]">04</span> Or run a <strong className="text-black">global search</strong> by prefix/IP or ASN from the bar above.</li>
                      </ol>
                    </div>
                    <div className="border border-gray-200 p-7">
                      <SectionLabel icon={Cpu} text="Session States" />
                      <ul className="space-y-3 text-sm">
                        <li className="flex items-center gap-3"><span className="font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-1 border bg-green-100 text-green-700 border-green-200">Established</span><span className="text-gray-600">Peer is up, exchanging routes</span></li>
                        <li className="flex items-center gap-3"><span className="font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-1 border bg-amber-100 text-amber-700 border-amber-200">Idle</span><span className="text-gray-600">Session not yet established</span></li>
                        <li className="flex items-center gap-3"><span className="font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-1 border bg-gray-100 text-gray-500 border-gray-200">Down</span><span className="text-gray-600">Peer offline / disconnected</span></li>
                      </ul>
                      <p className="mt-5 pt-5 border-t border-gray-100 font-mono text-[10px] leading-relaxed text-gray-400">
                        Data is served live from the MX-IX route servers via the BIRD routing daemon and refreshed periodically. Read-only — no configuration is exposed.
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* SERVERS */}
              {view === 'servers' && (
                <>
                  <BackBar label="All Locations" onClick={goLocations} />
                  <SectionLabel icon={Server} text={`${cityOf(selectedGroup)} — Route Servers`} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {serversInGroup.map((rs) => (
                      <button key={rs.id} onClick={() => openServer(rs)} className="group relative text-left p-6 border border-gray-200 hover:border-[#F20732] hover:bg-gray-50 transition-colors hover-trigger overflow-hidden flex items-center justify-between">
                        <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732] -translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Server className="w-4 h-4 text-[#F20732]" />
                            <span className="font-mono text-sm font-bold text-black">{rs.name.replace(/\s*\((IPv4|IPv6)\)/i, '')}</span>
                          </div>
                          <span className={`font-mono text-[9px] font-bold px-1.5 py-0.5 border ${isV6(rs) ? 'border-blue-200 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-500 bg-gray-50'}`}>{isV6(rs) ? 'IPv6' : 'IPv4'} · {rs.type || 'bird'}</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#F20732] group-hover:translate-x-1 transition-all" />
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* NEIGHBORS */}
              {view === 'neighbors' && (
                <>
                  <BackBar label={`${cityOf(selectedGroup)} route servers`} onClick={() => setView('servers')} />
                  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-3">
                    <div>
                      <div className="font-mono text-label-sm tracking-mono uppercase text-gray-400 mb-1">{selectedGroup}</div>
                      <h2 className="text-2xl font-black tracking-tight text-black">{selectedRsObj?.name}</h2>
                      {rsStatus && <RsStatusLine status={rsStatus} />}
                    </div>
                    <div className="flex gap-3">
                      <StatChip label="Sessions" value={summary.total} />
                      <StatChip label="Established" value={summary.up} accent />
                      <StatChip label="Routes RX" value={summary.rx} />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-4 flex-wrap">
                    <div className="flex-1 relative max-w-sm min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input value={neighborFilter} onChange={(e) => setNeighborFilter(e.target.value)} placeholder="Filter by ASN, name or IP" className="w-full border border-gray-200 pl-9 pr-3 py-2 font-mono text-xs focus:outline-none focus:border-[#F20732] transition-colors" />
                    </div>
                    <button onClick={() => { loadNeighbors(selectedRs); loadStatus(selectedRs); }} className="p-2 border border-gray-200 hover:border-[#F20732] hover:text-[#F20732] transition-colors hover-trigger" title="Refresh"><RefreshCw className="w-4 h-4" /></button>
                  </div>

                  <NeighborsTable neighbors={filteredNeighbors} loading={neighborsLoading} sortKey={sortKey} onSort={toggleSort} onSelect={(n) => openNeighbor(n, selectedRs)} />
                </>
              )}

              {/* NEIGHBOR DETAIL */}
              {view === 'neighbor' && selectedNeighbor && (
                <NeighborDetail neighbor={selectedNeighbor} rsName={selectedRsObj?.name || ''} onBack={() => { setView('neighbors'); updateHash(selectedRs); }} routeTab={routeTab} onRouteTab={handleRouteTab} routes={routes} routesLoading={routesLoading} routesError={routesError} />
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
};

// ── Subcomponents ──
const SectionLabel: React.FC<{ icon: React.ElementType; text: string }> = ({ icon: Icon, text }) => (
  <div className="flex items-center gap-2.5 mb-4">
    <Icon className="w-4 h-4 text-[#F20732] flex-shrink-0" />
    <span className="font-mono text-label-sm font-bold tracking-label uppercase text-black truncate">{text}</span>
  </div>
);

const BackBar: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button onClick={onClick} className="inline-flex items-center gap-2 mb-4 font-mono text-label-sm font-bold tracking-label uppercase text-gray-500 hover:text-[#F20732] transition-colors hover-trigger">
    <ArrowLeft className="w-4 h-4" /> Back to {label}
  </button>
);

const StatChip: React.FC<{ label: string; value: number; accent?: boolean }> = ({ label, value, accent }) => (
  <div className={`px-4 py-2 border ${accent ? 'border-[#F20732]/30 bg-[#F20732]/5' : 'border-gray-200'}`}>
    <div className={`text-xl font-light tracking-tighter tabular-nums ${accent ? 'text-[#F20732]' : 'text-black'}`}>{value.toLocaleString()}</div>
    <div className="font-mono text-[9px] tracking-label uppercase text-gray-400">{label}</div>
  </div>
);

const RsStatusLine: React.FC<{ status: RsStatus }> = ({ status }) => (
  <div className="flex items-center gap-2 mt-2 font-mono text-label-sm text-gray-500">
    <Cpu className="w-3.5 h-3.5 text-green-600" />
    <span className="text-green-600 font-bold">ONLINE</span>
    {status.version && status.version !== 'unknown' && <span>· BIRD {status.version}</span>}
  </div>
);

const CopyBtn: React.FC<{ text: string }> = ({ text }) => {
  const [done, setDone] = useState(false);
  return (
    <button onClick={(e) => { e.stopPropagation(); copyText(text).then((ok) => { if (ok) { setDone(true); setTimeout(() => setDone(false), 1200); } }); }} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-[#F20732]" title="Copy">
      {done ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

const SortHeader: React.FC<{ label: string; k: SortKey; sortKey: SortKey; onSort: (k: SortKey) => void; align?: 'left' | 'right' }> = ({ label, k, sortKey, onSort, align = 'left' }) => (
  <th className={`px-4 py-3 ${align === 'right' ? 'text-right' : 'text-left'}`}>
    <button onClick={() => onSort(k)} className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-label hover:text-[#F20732] transition-colors ${sortKey === k ? 'text-[#F20732]' : 'text-gray-300'}`}>{label} <ArrowUpDown className="w-3 h-3" /></button>
  </th>
);

const NeighborsTable: React.FC<{
  neighbors: LgNeighbor[];
  loading: boolean;
  sortKey: SortKey;
  onSort: (k: SortKey) => void;
  onSelect: (n: LgNeighbor) => void;
  hideAction?: boolean;
}> = ({ neighbors, loading, sortKey, onSort, onSelect, hideAction }) => {
  if (loading) return <div className="flex items-center justify-center py-20 border border-gray-200"><Loader2 className="w-6 h-6 animate-spin text-[#F20732]" /></div>;
  if (!neighbors.length) return <div className="py-16 text-center border border-gray-200 border-dashed"><p className="font-mono text-xs text-gray-400 uppercase tracking-label">No BGP sessions found.</p></div>;
  return (
    <div className="border border-gray-200 overflow-x-auto">
      <table className="w-full text-left min-w-[820px]">
        <thead className="bg-ink text-white">
          <tr>
            <SortHeader label="ASN" k="asn" sortKey={sortKey} onSort={onSort} />
            <SortHeader label="Neighbor" k="description" sortKey={sortKey} onSort={onSort} />
            <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-label text-gray-300">IP Address</th>
            <SortHeader label="State" k="state" sortKey={sortKey} onSort={onSort} />
            <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-label text-gray-300">Uptime</th>
            <SortHeader label="RX" k="routes_received" sortKey={sortKey} onSort={onSort} align="right" />
            <th className="px-4 py-3 text-right font-mono text-[10px] font-bold uppercase tracking-label text-gray-300">Filtered</th>
            {!hideAction && <th className="px-4 py-3"></th>}
          </tr>
        </thead>
        <tbody>
          {neighbors.map((n) => {
            const st = stateInfo(n);
            return (
              <tr key={n.id + n.address} onClick={() => onSelect(n)} className={`border-t border-gray-100 transition-colors group ${hideAction ? '' : 'cursor-pointer hover:bg-gray-50 hover-trigger'}`}>
                <td className="px-4 py-3 font-mono text-xs font-bold text-black whitespace-nowrap">AS{n.asn}</td>
                <td className="px-4 py-3 text-xs text-gray-700 max-w-[220px] truncate">{n.description || '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap"><span className="inline-flex items-center gap-2">{n.address}<CopyBtn text={n.address} /></span></td>
                <td className="px-4 py-3"><span className={`font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-1 border ${st.cls}`}>{st.label}</span></td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{formatUptime(n)}</td>
                <td className="px-4 py-3 text-right font-mono text-xs font-bold text-black tabular-nums">{num(n.routes_received)}</td>
                <td className="px-4 py-3 text-right font-mono text-xs text-gray-500 tabular-nums">{num(n.routes_filtered)}</td>
                {!hideAction && <td className="px-4 py-3 text-right"><ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#F20732] inline" /></td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const NeighborDetail: React.FC<{
  neighbor: LgNeighbor; rsName: string; onBack: () => void;
  routeTab: RouteFilter; onRouteTab: (t: RouteFilter) => void;
  routes: LgRoute[]; routesLoading: boolean; routesError: string;
}> = ({ neighbor, rsName, onBack, routeTab, onRouteTab, routes, routesLoading, routesError }) => {
  const st = stateInfo(neighbor);
  const facts: { label: string; value: React.ReactNode }[] = [
    { label: 'IP Address', value: neighbor.address || '—' },
    { label: 'BGP State', value: neighbor.details?.bgp_state || neighbor.state || '—' },
    { label: 'Uptime', value: formatUptime(neighbor) },
    { label: 'Routes Received', value: num(neighbor.routes_received) },
    { label: 'Routes Filtered', value: num(neighbor.routes_filtered) },
    { label: 'Routes Exported', value: num(neighbor.routes_exported) },
    { label: 'Routes Accepted', value: num(neighbor.routes_accepted) },
    { label: 'Routes Preferred', value: num(neighbor.routes_preferred) },
  ];
  return (
    <>
      <BackBar label="neighbors" onClick={onBack} />
      <div className="border border-gray-200 mb-6">
        <div className="bg-ink text-white px-6 py-6 border-b-4 border-[#F20732]">
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-2xl md:text-3xl font-black tracking-tight">AS{neighbor.asn}</span>
            <span className={`font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-1 border ${st.cls}`}>{st.label}</span>
          </div>
          <p className="text-gray-300 text-sm">{neighbor.description || 'BGP Neighbor'}</p>
          <p className="font-mono text-label-sm tracking-label uppercase text-gray-500 mt-1">{rsName}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y divide-gray-100">
          {facts.map((f) => (
            <div key={f.label} className="p-5">
              <div className="font-mono text-[9px] tracking-label uppercase text-gray-400 mb-1.5">{f.label}</div>
              <div className="font-mono text-sm font-bold text-black break-all">{f.value}</div>
            </div>
          ))}
        </div>
        {neighbor.last_error && <div className="px-5 py-3 bg-[#F20732]/5 border-t border-[#F20732]/20 font-mono text-xs text-[#F20732]">Last error: {neighbor.last_error}</div>}
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <SectionLabel icon={Network} text="Advertised Routes" />
        <div className="flex items-center gap-3">
          <div className="flex border border-gray-200">
            {(['received', 'filtered'] as RouteFilter[]).map((t) => (
              <button key={t} onClick={() => onRouteTab(t)} className={`px-4 py-2 font-mono text-label-sm font-bold tracking-label uppercase transition-colors ${routeTab === t ? 'bg-[#F20732] text-white' : 'text-gray-500 hover:text-black'}`}>{t}</button>
            ))}
          </div>
        </div>
      </div>
      <RoutesTable routes={routes} loading={routesLoading} error={routesError} empty={routeTab === 'received' ? 'No routes received from this neighbor.' : 'No filtered routes.'} />
    </>
  );
};

const RoutesTable: React.FC<{ routes: LgRoute[]; loading: boolean; error: string; empty: string }> = ({ routes, loading, error, empty }) => {
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => { setPage(0); setExpanded(null); }, [routes]);

  if (loading) return <div className="flex items-center justify-center py-16 border border-gray-200"><Loader2 className="w-6 h-6 animate-spin text-[#F20732]" /></div>;
  if (error) return <div className="flex items-center gap-3 p-6 border border-[#F20732]/30 bg-[#F20732]/5"><AlertTriangle className="w-5 h-5 text-[#F20732]" /><span className="text-sm text-gray-600">{error}</span></div>;
  if (!routes.length) return <div className="py-16 text-center border border-gray-200 border-dashed"><p className="font-mono text-xs text-gray-400 uppercase tracking-label">{empty}</p></div>;

  const pages = Math.ceil(routes.length / ROUTES_PER_PAGE);
  const start = page * ROUTES_PER_PAGE;
  const slice = routes.slice(start, start + ROUTES_PER_PAGE);

  return (
    <div>
      <div className="border border-gray-200 overflow-x-auto">
        <table className="w-full text-left min-w-[760px]">
          <thead className="bg-ink text-white">
            <tr>
              <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-label">Network</th>
              <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-label">Next Hop</th>
              <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-label">AS Path</th>
              <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-label">Communities</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => {
              const idx = start + i;
              const open = expanded === idx;
              return (
                <React.Fragment key={`${r.network}-${idx}`}>
                  <tr onClick={() => setExpanded(open ? null : idx)} className="border-t border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer group hover-trigger">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-black whitespace-nowrap"><span className="inline-flex items-center gap-2">{r.network}<CopyBtn text={r.network} /></span></td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">{r.bgp?.next_hop || r.gateway || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{formatAsPath(r.bgp?.as_path)}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-gray-400">{formatCommunities(r.bgp?.communities)}</td>
                  </tr>
                  {open && (
                    <tr className="bg-gray-50/60 border-t border-gray-100">
                      <td colSpan={4} className="px-4 py-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-[11px]">
                          <Attr label="Local Pref" value={r.bgp?.local_pref} />
                          <Attr label="MED" value={r.bgp?.med} />
                          <Attr label="Origin" value={(r.bgp as any)?.origin} />
                          <Attr label="Age" value={r.age} />
                          <div className="col-span-2 md:col-span-4">
                            <div className="text-gray-400 uppercase tracking-label mb-1">Large Communities</div>
                            <div className="text-gray-700 break-all">{formatCommunities(r.bgp?.large_communities)}</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* footer: count + pagination */}
      <div className="flex items-center justify-between mt-3 flex-wrap gap-3">
        <span className="font-mono text-label-sm tracking-label uppercase text-gray-400">
          Showing {start + 1}–{Math.min(start + ROUTES_PER_PAGE, routes.length)} of {routes.length.toLocaleString()}
        </span>
        {pages > 1 && (
          <div className="flex items-center gap-2 font-mono text-xs">
            <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="px-3 py-1.5 border border-gray-200 disabled:opacity-40 hover:border-[#F20732] hover:text-[#F20732] transition-colors">Prev</button>
            <span className="text-gray-500">Page {page + 1} / {pages}</span>
            <button disabled={page >= pages - 1} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} className="px-3 py-1.5 border border-gray-200 disabled:opacity-40 hover:border-[#F20732] hover:text-[#F20732] transition-colors">Next</button>
          </div>
        )}
      </div>
    </div>
  );
};

const Attr: React.FC<{ label: string; value: any }> = ({ label, value }) => (
  <div>
    <div className="text-gray-400 uppercase tracking-label mb-1">{label}</div>
    <div className="text-gray-700">{value !== undefined && value !== null && value !== '' ? String(value) : '—'}</div>
  </div>
);

export default LookingGlassPage;
