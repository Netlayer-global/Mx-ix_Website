import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Search, Loader2, AlertTriangle, RefreshCw, Network, ArrowRight } from 'lucide-react';
import { lookingGlassApi, LgRouteServer, LgNeighbor } from '../services/api';

interface NetworksPageProps {
  onNavigate?: (page: string) => void;
}

interface NetworkRow {
  asn: number;
  name: string;
  locations: Set<string>;
  sessions: number;
  established: number;
}

const cityOf = (group: string) => group.replace(/^MX-?IX\s*/i, '').trim() || group;
const isUp = (n: LgNeighbor) => /up|established/i.test(n.details?.bgp_state || n.state || '');
const pickNeighbors = (data: any): LgNeighbor[] => (data?.neighbors || data?.neighbours || []) as LgNeighbor[];

const withTimeout = <T,>(p: Promise<T>, ms: number, fb: T) =>
  Promise.race([p, new Promise<T>((res) => setTimeout(() => res(fb), ms))]);

const NetworksPage: React.FC<NetworksPageProps> = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<NetworkRow[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    document.body.classList.add('dark-nav');
    return () => document.body.classList.remove('dark-nav');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const rsRes = await lookingGlassApi.getRouteservers();
    if (!rsRes.success || !rsRes.data?.routeservers) {
      setError(rsRes.error || 'Looking Glass backend is currently unreachable');
      setLoading(false);
      return;
    }
    const routeservers: LgRouteServer[] = rsRes.data.routeservers;
    const settled = await Promise.all(
      routeservers.map(async (rs) => {
        const res = await withTimeout(lookingGlassApi.getNeighbors(rs.id), 9000, { success: false } as any);
        return { rs, neighbors: res.success && res.data ? pickNeighbors(res.data) : [] };
      })
    );

    const map = new Map<number, NetworkRow>();
    settled.forEach(({ rs, neighbors }) => {
      neighbors.forEach((n) => {
        if (!n.asn) return;
        const row = map.get(n.asn) || { asn: n.asn, name: n.description || '', locations: new Set(), sessions: 0, established: 0 };
        row.sessions += 1;
        if (isUp(n)) row.established += 1;
        if (rs.group) row.locations.add(cityOf(rs.group));
        if (!row.name && n.description) row.name = n.description;
        map.set(n.asn, row);
      });
    });
    setRows(Array.from(map.values()).sort((a, b) => a.asn - b.asn));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => String(r.asn).includes(q) || r.name.toLowerCase().includes(q));
  }, [rows, filter]);

  const totalSessions = rows.reduce((a, r) => a + r.sessions, 0);

  return (
    <div className="min-h-screen bg-white">
      {/* HERO */}
      <section className="relative pt-36 md:pt-44 pb-12 bg-ink text-white overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#F20732]/15 blur-[120px]"></div>
        <div className="relative max-w-[1400px] mx-auto px-6 md:px-12">
          <div className="flex items-center gap-3 mb-4">
            <Network className="w-4 h-4 text-[#F20732]" />
            <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Connected Networks</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black leading-[0.9] tracking-tighter mb-4">
            THE <span className="text-[#F20732]">NETWORKS</span>
          </h1>
          <p className="max-w-2xl text-gray-400 text-sm md:text-base font-light leading-relaxed">
            Every network peering across the MX-IX fabric — discovered live from our route servers.
            Connect once and reach all of them.
          </p>
        </div>
      </section>

      {/* BODY */}
      <section className="relative bg-white py-12 min-h-[50vh]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          {error ? (
            <div className="flex items-start gap-4 p-6 border-2 border-[#F20732]/30 bg-[#F20732]/5">
              <AlertTriangle className="w-6 h-6 text-[#F20732] flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-black mb-1">Network List Unavailable</h3>
                <p className="text-sm text-gray-600 mb-3">{error}</p>
                <button onClick={load} className="inline-flex items-center gap-2 font-mono text-label-sm font-bold tracking-mono uppercase text-[#F20732] hover:text-black transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div className="flex gap-3">
                  <div className="px-4 py-2 border border-gray-200">
                    <div className="text-xl font-light tracking-tighter tabular-nums text-black">{loading ? '—' : rows.length.toLocaleString()}</div>
                    <div className="font-mono text-[9px] tracking-label uppercase text-gray-400">Networks</div>
                  </div>
                  <div className="px-4 py-2 border border-[#F20732]/30 bg-[#F20732]/5">
                    <div className="text-xl font-light tracking-tighter tabular-nums text-[#F20732]">{loading ? '—' : totalSessions.toLocaleString()}</div>
                    <div className="font-mono text-[9px] tracking-label uppercase text-gray-400">Total Sessions</div>
                  </div>
                </div>
                <div className="relative max-w-sm w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by ASN or name" className="w-full border border-gray-200 pl-9 pr-3 py-2 font-mono text-xs focus:outline-none focus:border-[#F20732] transition-colors" />
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-24 border border-gray-200"><Loader2 className="w-6 h-6 animate-spin text-[#F20732]" /></div>
              ) : (
                <div className="border border-gray-200 overflow-x-auto">
                  <table className="w-full text-left min-w-[720px]">
                    <thead className="bg-ink text-white">
                      <tr>
                        <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-label">ASN</th>
                        <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-label">Network</th>
                        <th className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-label">Locations</th>
                        <th className="px-4 py-3 text-right font-mono text-[10px] font-bold uppercase tracking-label">Sessions</th>
                        <th className="px-4 py-3 text-right font-mono text-[10px] font-bold uppercase tracking-label">Established</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r) => (
                        <tr key={r.asn} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs font-bold text-black whitespace-nowrap">AS{r.asn}</td>
                          <td className="px-4 py-3 text-xs text-gray-700 max-w-[280px] truncate">{r.name || '—'}</td>
                          <td className="px-4 py-3 font-mono text-[11px] text-gray-500">{Array.from(r.locations).join(', ') || '—'}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-gray-700 tabular-nums">{r.sessions}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs font-bold tabular-nums">
                            <span className={r.established ? 'text-green-600' : 'text-gray-400'}>{r.established}</span>
                          </td>
                        </tr>
                      ))}
                      {!filtered.length && (
                        <tr><td colSpan={5} className="px-4 py-16 text-center font-mono text-xs text-gray-400 uppercase tracking-label">No networks match your filter.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* CTA */}
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 border border-gray-200 p-6">
                <p className="text-gray-600 text-sm">Want your network on this list?</p>
                <button onClick={() => onNavigate?.('contact')} className="hover-trigger bg-[#F20732] text-white px-6 py-3 font-mono text-label-sm font-bold tracking-mono uppercase hover:bg-ink transition-colors flex items-center gap-2 group">
                  Join MX-IX <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default NetworksPage;
