import React, { useEffect, useState } from 'react';
import { Loader2, Network, Copy, Check } from 'lucide-react';
import { portalApi, PortItem } from '../../services/api';
import { copyText } from '../../shared/lg';
import { PageHeading, Badge, portStatusTone, EmptyState } from './ui';

const PortalPorts: React.FC = () => {
  const [ports, setPorts] = useState<PortItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await portalApi.getPorts();
      if (active && res.success && res.data) setPorts(res.data);
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const copy = async (value: string, key: string) => {
    if (!value) return;
    if (await copyText(value)) {
      setCopied(key);
      setTimeout(() => setCopied(''), 1500);
    }
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
      <PageHeading
        eyebrow="// Connections"
        title="My Connections"
        subtitle="Your physical and logical ports on the MX-IX fabric. Provisioning is handled by the MX-IX operations team."
      />

      {ports.length ? (
        <div className="space-y-4">
          {ports.map((p) => {
            const st = portStatusTone(p.status);
            const rows: { label: string; value?: string; copyable?: boolean }[] = [
              { label: 'Location', value: p.location || '—' },
              { label: 'Speed', value: p.speed },
              { label: 'VLAN', value: p.vlan || '—' },
              { label: 'IPv4', value: p.ipv4 || '—', copyable: !!p.ipv4 },
              { label: 'IPv6', value: p.ipv6 || '—', copyable: !!p.ipv6 },
              { label: 'MAC', value: p.macAddress || '—', copyable: !!p.macAddress },
            ];
            return (
              <div key={p._id} className="group relative bg-white border border-gray-200 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732] -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-ink text-white flex items-center justify-center flex-shrink-0">
                      <Network className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold truncate">{p.name}</h3>
                      <p className="font-mono text-xs text-gray-400 mt-0.5">
                        {p.ixpManagerPortId ? `Ref ${p.ixpManagerPortId}` : 'MX-IX fabric port'}
                      </p>
                    </div>
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-y md:divide-y-0 divide-gray-100">
                  {rows.map((r) => {
                    const key = `${p._id}-${r.label}`;
                    return (
                      <div key={r.label} className="px-5 py-4">
                        <span className="block font-mono text-label-sm tracking-label uppercase text-gray-400 mb-1.5">
                          {r.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-ink font-mono break-all">{r.value}</span>
                          {r.copyable && r.value && (
                            <button
                              onClick={() => copy(r.value!, key)}
                              className="text-gray-300 hover:text-[#F20732] transition-colors hover-trigger flex-shrink-0"
                              aria-label={`Copy ${r.label}`}
                            >
                              {copied === key ? (
                                <Check className="w-3.5 h-3.5 text-green-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Network className="w-10 h-10" />}
          title="No connections yet"
          hint="Once your port is provisioned by MX-IX operations it will appear here with its configuration and live status."
        />
      )}
    </div>
  );
};

export default PortalPorts;
