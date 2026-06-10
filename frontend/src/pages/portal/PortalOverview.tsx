import React, { useEffect, useState } from 'react';
import { Loader2, Network, Share2, AlertTriangle, Hash, ArrowRight, Activity } from 'lucide-react';
import { portalApi, PortalOrgInfo, PortalOverview as Overview } from '../../services/api';
import { PageHeading, StatCard, Badge, portStatusTone, impactTone, EmptyState } from './ui';

interface Props {
  org: PortalOrgInfo;
  onGoToSection?: (section: string) => void;
}

const PortalOverview: React.FC<Props> = ({ org, onGoToSection }) => {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await portalApi.getOverview();
      if (active && res.success && res.data) setData(res.data);
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-[#F20732]" />
      </div>
    );
  }

  const c = data?.cards;

  return (
    <div>
      <PageHeading
        eyebrow="// Dashboard"
        title={`Welcome, ${org.name}`}
        subtitle="A live snapshot of your connection to the MX-IX fabric — ports, peering and anything affecting your service."
      />

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200 border border-gray-200 mb-10">
        <StatCard label="My Ports" value={c?.ports ?? 0} hint={`${c?.activePorts ?? 0} active`} />
        <StatCard label="My ASNs" value={c?.asns ?? 0} hint={org.asn ? `Primary AS${org.asn}` : 'None set'} />
        <StatCard
          label="Peering Sessions"
          value={c?.peeringSessions ?? 0}
          hint={`${c?.sessionsUp ?? 0} up`}
        />
        <StatCard label="Open Incidents" value={c?.openIncidents ?? 0} hint="Affecting the fabric" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connection status */}
        <section className="bg-white border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-[#F20732]" />
              <h3 className="font-mono text-label tracking-label uppercase text-ink">Connection Status</h3>
            </div>
            <button
              onClick={() => onGoToSection?.('ports')}
              className="font-mono text-label-sm tracking-mono uppercase text-gray-400 hover:text-[#F20732] transition-colors inline-flex items-center gap-1 hover-trigger"
            >
              All ports <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {data?.ports?.length ? (
              data.ports.map((p) => {
                const st = portStatusTone(p.status);
                return (
                  <div key={p.id} className="px-5 py-4 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{p.name}</p>
                      <p className="font-mono text-xs text-gray-400 mt-0.5">
                        {p.location || '—'} · {p.speed}
                      </p>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                );
              })
            ) : (
              <div className="p-5">
                <EmptyState
                  icon={<Network className="w-8 h-8" />}
                  title="No ports yet"
                  hint="Once your connection is provisioned it will appear here."
                />
              </div>
            )}
          </div>
        </section>

        {/* Incidents */}
        <section className="bg-white border border-gray-200">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-200">
            <AlertTriangle className="w-4 h-4 text-[#F20732]" />
            <h3 className="font-mono text-label tracking-label uppercase text-ink">Incidents Affecting Me</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {data?.incidents?.length ? (
              data.incidents.map((i) => (
                <div key={i.id} className="px-5 py-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{i.title}</p>
                    <p className="font-mono text-xs text-gray-400 mt-0.5 capitalize">{i.status}</p>
                  </div>
                  <Badge tone={impactTone(i.impact)}>{i.impact}</Badge>
                </div>
              ))
            ) : (
              <div className="px-5 py-10 flex items-center gap-3 text-green-600">
                <Activity className="w-5 h-5" />
                <span className="font-mono text-label-sm tracking-mono uppercase">
                  No active incidents
                </span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
        <button
          onClick={() => onGoToSection?.('peering')}
          className="group bg-ink text-white p-6 text-left relative overflow-hidden hover-trigger"
        >
          <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-[#F20732]/15 blur-[80px]" />
          <Share2 className="w-5 h-5 text-[#F20732] mb-4" />
          <h3 className="text-lg font-black tracking-tight mb-1">Peering Sessions</h3>
          <p className="text-gray-400 text-sm">
            Route-server session status and advertised prefixes for {org.asn ? `AS${org.asn}` : 'your ASN'}.
          </p>
          <span className="inline-flex items-center gap-1 mt-4 font-mono text-label-sm tracking-mono uppercase text-white group-hover:text-[#F20732] transition-colors">
            View peering <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </button>

        <button
          onClick={() => onGoToSection?.('ports')}
          className="group bg-white border border-gray-200 p-6 text-left hover:border-gray-300 transition-colors hover-trigger relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732] -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
          <Hash className="w-5 h-5 text-[#F20732] mb-4" />
          <h3 className="text-lg font-black tracking-tight mb-1 text-ink">My Connections</h3>
          <p className="text-gray-500 text-sm">Ports, speeds, VLANs and provisioning status across all locations.</p>
          <span className="inline-flex items-center gap-1 mt-4 font-mono text-label-sm tracking-mono uppercase text-ink group-hover:text-[#F20732] transition-colors">
            View ports <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </button>
      </div>
    </div>
  );
};

export default PortalOverview;
