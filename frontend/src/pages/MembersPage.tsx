import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Search, Loader2, Users, ArrowRight, ExternalLink, ArrowUpDown } from 'lucide-react';
import { membersApi, MemberItem, MemberType } from '../services/api';

interface MembersPageProps {
  onNavigate?: (page: string) => void;
}

const TYPES: (MemberType | 'All')[] = ['All', 'ISP', 'Content', 'Cloud', 'CDN', 'Enterprise', 'Academic', 'Other'];
type SortKey = 'name' | 'asn' | 'type';

const POLICY_CLS: Record<string, string> = {
  Open: 'text-green-600 border-green-200 bg-green-50',
  Selective: 'text-amber-600 border-amber-200 bg-amber-50',
  Restrictive: 'text-[#F20732] border-[#F20732]/30 bg-[#F20732]/5',
};

const MembersPage: React.FC<MembersPageProps> = ({ onNavigate }) => {
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState<MemberType | 'All'>('All');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await membersApi.getAll();
    if (res.success && res.data) setMembers(res.data);
    else setError(res.error || 'Unable to load members');
    setLoading(false);
  }, []);

  useEffect(() => {
    document.body.classList.add('dark-nav');
    load();
    return () => document.body.classList.remove('dark-nav');
  }, [load]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = members.filter((m) => {
      if (type !== 'All' && m.type !== type) return false;
      if (q && !m.name.toLowerCase().includes(q) && !String(m.asn || '').includes(q)) return false;
      return true;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      let av: any, bv: any;
      if (sortKey === 'asn') { av = a.asn || 0; bv = b.asn || 0; }
      else if (sortKey === 'type') { av = a.type; bv = b.type; }
      else { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      return av < bv ? -dir : av > bv ? dir : 0;
    });
    return list;
  }, [members, search, type, sortKey, sortDir]);

  // counts by type for quick stats
  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    members.forEach((m) => { byType[m.type] = (byType[m.type] || 0) + 1; });
    return byType;
  }, [members]);

  return (
    <div className="min-h-screen bg-white">
      {/* HERO */}
      <section className="relative pt-36 md:pt-44 pb-12 bg-ink text-white overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#F20732]/15 blur-[120px]"></div>
        <div className="relative max-w-[1400px] mx-auto px-6 md:px-12">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-4 h-4 text-[#F20732]" />
            <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Members</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black leading-[0.9] tracking-tighter mb-4">
            OUR <span className="text-[#F20732]">MEMBERS</span>
          </h1>
          <p className="max-w-2xl text-gray-400 text-sm md:text-base font-light leading-relaxed">
            The networks that make MX-IX. Connect once and peer directly with every ISP, content,
            cloud and enterprise network on the exchange.
          </p>

          {/* quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px mt-8 bg-white/10 border border-white/10 max-w-3xl">
            <HeroStat value={members.length} label="Total Members" />
            <HeroStat value={stats['ISP'] || 0} label="ISPs" />
            <HeroStat value={(stats['Content'] || 0) + (stats['CDN'] || 0)} label="Content / CDN" />
            <HeroStat value={stats['Cloud'] || 0} label="Cloud" />
          </div>
        </div>
      </section>

      <section className="relative bg-white py-12 min-h-[55vh]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          {/* controls */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <button key={t} onClick={() => setType(t)} className={`font-mono text-label-sm font-bold tracking-label uppercase px-3 py-1.5 border transition-colors hover-trigger ${type === t ? 'border-[#F20732] text-[#F20732] bg-[#F20732]/5' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or ASN" className="w-full border border-gray-200 pl-9 pr-3 py-2 font-mono text-xs focus:outline-none focus:border-[#F20732] transition-colors" />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24 border border-gray-200"><Loader2 className="w-6 h-6 animate-spin text-[#F20732]" /></div>
          ) : error ? (
            <div className="py-16 text-center border border-gray-200 border-dashed font-mono text-xs text-gray-400 uppercase tracking-label">{error}</div>
          ) : !members.length ? (
            <div className="py-20 text-center border border-gray-200 border-dashed">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-4" />
              <p className="font-mono text-xs text-gray-400 uppercase tracking-label">Member directory coming soon.</p>
            </div>
          ) : (
            <div className="border border-gray-200 overflow-x-auto">
              <table className="w-full text-left min-w-[920px]">
                <thead className="bg-ink text-white">
                  <tr>
                    <SortTh label="Network" k="name" sortKey={sortKey} onSort={toggleSort} />
                    <SortTh label="ASN" k="asn" sortKey={sortKey} onSort={toggleSort} />
                    <SortTh label="Type" k="type" sortKey={sortKey} onSort={toggleSort} />
                    <th className="px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-label text-gray-300">Capacity</th>
                    <th className="px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-label text-gray-300">Peering Policy</th>
                    <th className="px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-label text-gray-300">Locations</th>
                    <th className="px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-label text-gray-300">Since</th>
                    <th className="px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-label text-gray-300 text-right">Site</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr key={m._id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-black">{m.name}</td>
                      <td className="px-5 py-3.5 font-mono text-sm text-gray-600 whitespace-nowrap">{m.asn ? `AS${m.asn}` : '—'}</td>
                      <td className="px-5 py-3.5 font-mono text-xs uppercase tracking-wider text-gray-500">{m.type}</td>
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-700 whitespace-nowrap">{m.capacity || '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className={`font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-1 border ${POLICY_CLS[m.peeringPolicy] || 'text-gray-500 border-gray-200'}`}>{m.peeringPolicy}</span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[11px] text-gray-500">{m.locations?.length ? m.locations.join(' · ') : '—'}</td>
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-500 whitespace-nowrap">{m.joinedDate ? new Date(m.joinedDate).getFullYear() : '—'}</td>
                      <td className="px-5 py-3.5 text-right">
                        {m.website ? (
                          <a href={m.website} target="_blank" rel="noopener noreferrer" className="inline-flex text-gray-400 hover:text-[#F20732] transition-colors" title="Website"><ExternalLink className="w-4 h-4" /></a>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                  {!filtered.length && (
                    <tr><td colSpan={8} className="px-5 py-16 text-center font-mono text-xs text-gray-400 uppercase tracking-label">No members match your filter.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* count + CTA */}
          {!loading && members.length > 0 && (
            <div className="font-mono text-label-sm tracking-label uppercase text-gray-400 mt-3">
              Showing {filtered.length} of {members.length} members
            </div>
          )}
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 border border-gray-200 p-6">
            <p className="text-gray-600 text-sm">Want your network listed here?</p>
            <button onClick={() => onNavigate?.('contact')} className="hover-trigger bg-[#F20732] text-white px-6 py-3 font-mono text-label-sm font-bold tracking-mono uppercase hover:bg-ink transition-colors flex items-center gap-2 group">
              Join MX-IX <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

const HeroStat: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <div className="bg-ink px-5 py-4">
    <div className="text-2xl font-light tracking-tighter text-white tabular-nums">{value}</div>
    <div className="font-mono text-[9px] tracking-label uppercase text-gray-500 mt-1">{label}</div>
  </div>
);

const SortTh: React.FC<{ label: string; k: SortKey; sortKey: SortKey; onSort: (k: SortKey) => void }> = ({ label, k, sortKey, onSort }) => (
  <th className="px-5 py-3 text-left">
    <button onClick={() => onSort(k)} className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-label hover:text-[#F20732] transition-colors ${sortKey === k ? 'text-[#F20732]' : 'text-gray-300'}`}>
      {label} <ArrowUpDown className="w-3 h-3" />
    </button>
  </th>
);

export default MembersPage;
