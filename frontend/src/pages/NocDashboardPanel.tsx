import React, { useEffect, useState } from 'react';
import { ChevronLeft, Loader2, Radar, AlertTriangle } from 'lucide-react';
import { adminSystemApi, NocDashboard } from '../services/api';

interface Props { embedded?: boolean; onBack?: () => void; }

const fmtGbps = (mbps: number) => (mbps >= 1000 ? `${(mbps / 1000).toFixed(1)}G` : `${mbps}M`);

const NocDashboardPanel: React.FC<Props> = ({ embedded, onBack }) => {
  const [data, setData] = useState<NocDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await adminSystemApi.noc();
      if (res.success && res.data) setData(res.data);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#F20732]" /></div>;

  const maxCap = Math.max(1, ...(data?.capacity || []).map((c) => c.capacityMbps));
  const t = data?.totals;

  return (
    <div className="min-h-screen bg-gray-900 text-white admin-panel">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          {embedded && onBack && <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-lg"><ChevronLeft className="w-5 h-5" /></button>}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#F20732] rounded-lg flex items-center justify-center"><Radar className="w-5 h-5" /></div>
            <div><h1 className="text-xl font-bold">NOC Operations</h1><p className="text-gray-400 text-sm">Fabric health at a glance</p></div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Totals */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Members', value: t?.members ?? 0 },
            { label: 'Active', value: t?.active ?? 0 },
            { label: 'Pending', value: t?.pending ?? 0 },
            { label: 'Suspended', value: t?.suspended ?? 0 },
            { label: 'Ports', value: t?.ports ?? 0 },
            { label: 'Open orders', value: t?.openOrders ?? 0 },
            { label: 'Open tickets', value: t?.openTickets ?? 0 },
          ].map((s) => (
            <div key={s.label} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 font-mono">{s.label}</div>
              <div className="text-2xl font-bold mt-1">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Capacity heatmap */}
        <section className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <h2 className="font-bold mb-4">Capacity by location <span className="text-gray-500 text-sm">· {t?.capacityGbps ?? 0} Gbps total</span></h2>
          {data?.capacity.length ? (
            <div className="space-y-2">
              {data.capacity.map((c) => (
                <div key={c.location} className="flex items-center gap-3">
                  <div className="w-32 truncate text-sm">{c.location}</div>
                  <div className="flex-1 h-6 bg-gray-900 rounded overflow-hidden relative">
                    <div className="h-full bg-gradient-to-r from-[#F20732]/60 to-[#F20732]" style={{ width: `${(c.capacityMbps / maxCap) * 100}%` }} />
                    <span className="absolute inset-0 flex items-center px-2 text-[11px] font-mono">{fmtGbps(c.capacityMbps)} · {c.ports} ports{c.down ? ` · ${c.down} down` : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No ports provisioned yet.</p>
          )}
        </section>

        {/* At-risk members */}
        <section className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <h2 className="font-bold mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" /> At-risk members</h2>
          {data?.atRisk.length ? (
            <div className="space-y-2">
              {data.atRisk.map((m) => (
                <div key={m.id} className="flex items-center gap-3 bg-gray-900 border border-gray-700 rounded p-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{m.name} {m.asn ? <span className="text-gray-400 font-normal">AS{m.asn}</span> : ''}</div>
                    <div className="text-xs text-amber-400">{m.reasons.join(' · ')}</div>
                  </div>
                  <span className="text-[10px] uppercase text-gray-500 font-mono">{m.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-green-400 text-sm">All members healthy.</p>
          )}
        </section>
      </main>
    </div>
  );
};

export default NocDashboardPanel;
