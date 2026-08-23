import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Grid as GridIcon, Loader2, Search } from 'lucide-react';
import { peeringMatrixApi, PeeringMatrixData, PeeringMatrixMember } from '../services/api';
import { PanelShell, Card, StatTile, Spinner, EmptyState, field } from './admin/ui';

interface Props {
  embedded?: boolean;
  onBack?: () => void;
}

/**
 * Peering Matrix — visualizes which members peer with each other.
 * The heatmap cell color encodes whether both are route-server clients
 * (guaranteed to peer) or only bilateral.
 */
const PeeringMatrixPanel: React.FC<Props> = ({ embedded, onBack }) => {
  const [data, setData] = useState<PeeringMatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    const res = await peeringMatrixApi.get();
    if (res.success && res.data) setData(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = filter.toLowerCase();
    return data.members.filter(
      (m) => !q || m.name.toLowerCase().includes(q) || String(m.asn).includes(q)
    );
  }, [data, filter]);

  // Build a quick lookup: memberIndex → set of other member indices they peer with
  const peerMap = useMemo(() => {
    if (!data) return new Map<number, Set<number>>();
    const map = new Map<number, Set<number>>();
    // All RS clients peer with each other through the RS
    const rsClientIndices = data.members
      .map((m, i) => (m.rsClient ? i : -1))
      .filter((i) => i >= 0);
    for (const i of rsClientIndices) {
      if (!map.has(i)) map.set(i, new Set());
      for (const j of rsClientIndices) {
        if (i !== j) map.get(i)!.add(j);
      }
    }
    return map;
  }, [data]);

  if (loading) return <PanelShell title="Peering Matrix" subtitle="Member-to-member connectivity" icon={GridIcon} embedded={embedded} onBack={onBack}><Spinner /></PanelShell>;
  if (!data || !data.members.length) return <PanelShell title="Peering Matrix" subtitle="Member-to-member connectivity" icon={GridIcon} embedded={embedded} onBack={onBack}><EmptyState icon={GridIcon} title="No members provisioned yet" /></PanelShell>;

  return (
    <PanelShell
      title="Peering Matrix"
      subtitle="Who peers with whom across the fabric"
      icon={GridIcon}
      embedded={embedded}
      onBack={onBack}
    >
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label="Members" value={data.stats.totalMembers} />
        <StatTile label="RS Clients" value={data.stats.totalRsClients} />
        <StatTile label="Peering Sessions" value={data.stats.totalPeeringSessions} />
        <StatTile label="Bilateral Only" value={data.stats.bilateralOnly} />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name or ASN…"
            className={`${field} pl-9`}
          />
        </div>
        <span className="text-xs text-gray-500 font-mono">
          Showing {filtered.length} of {data.members.length} members
        </span>
      </div>

      {/* Matrix */}
      <Card>
        <div className="overflow-auto max-h-[70vh]">
          <table className="text-[10px] border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 bg-gray-800 p-1 border border-gray-700 min-w-[120px]" />
                {filtered.map((m, j) => (
                  <th
                    key={m.id}
                    className="sticky top-0 z-10 bg-gray-800 border border-gray-700 p-1 font-normal text-gray-400 whitespace-nowrap"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', maxWidth: 28 }}
                    title={`${m.name} (AS${m.asn})`}
                  >
                    {m.asn}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const rowIdx = data.members.findIndex((m) => m.id === row.id);
                const rowPeers = peerMap.get(rowIdx) || new Set();
                return (
                  <tr key={row.id}>
                    <td
                      className="sticky left-0 z-10 bg-gray-800 border border-gray-700 p-1 font-bold text-white whitespace-nowrap max-w-[140px] truncate"
                      title={`${row.name} (AS${row.asn})`}
                    >
                      <span className="text-gray-400 mr-1">AS{row.asn}</span>
                      {row.name}
                    </td>
                    {filtered.map((col) => {
                      const colIdx = data.members.findIndex((m) => m.id === col.id);
                      const self = row.id === col.id;
                      const peers = rowPeers.has(colIdx);
                      const bothRs = row.rsClient && col.rsClient;

                      let cls = 'bg-gray-900'; // no peering
                      if (self) cls = 'bg-gray-700';
                      else if (peers && bothRs) cls = 'bg-green-600';
                      else if (peers) cls = 'bg-green-800';

                      return (
                        <td
                          key={col.id}
                          className={`border border-gray-700/50 w-6 h-6 ${cls}`}
                          title={
                            self
                              ? row.name
                              : peers
                                ? `${row.name} ↔ ${col.name} (${bothRs ? 'via RS' : 'bilateral'})`
                                : `${row.name} ✗ ${col.name}`
                          }
                        />
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 px-5 py-3 border-t border-gray-700 text-[11px] text-gray-400">
          <span className="flex items-center gap-2"><span className="w-4 h-4 bg-green-600 rounded-sm" /> Peering (via RS)</span>
          <span className="flex items-center gap-2"><span className="w-4 h-4 bg-green-800 rounded-sm" /> Peering (bilateral)</span>
          <span className="flex items-center gap-2"><span className="w-4 h-4 bg-gray-900 border border-gray-700 rounded-sm" /> No session</span>
        </div>
      </Card>
    </PanelShell>
  );
};

export default PeeringMatrixPanel;
