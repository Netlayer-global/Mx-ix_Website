import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  Server,
  Cable,
  Network,
  Globe2,
  Router,
  ChevronRight,
  Check,
  Loader2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import {
  adminFabricApi,
  adminVlansApi,
  adminBirdApi,
  adminPeeringDbApi,
  InfrastructureItem,
  FacilityItem,
  CabinetItem,
  DeviceItem,
  VlanItem,
} from '../services/api';
import { PanelShell, Card, field, Note, Spinner } from './admin/ui';

interface Props {
  embedded?: boolean;
  onBack?: () => void;
  /** Navigate to another admin section after setup completes. */
  onNavigateSection?: (section: string) => void;
}

type Step = 'infra' | 'facility' | 'cabinet' | 'device' | 'vlan' | 'routeserver' | 'done';

const STEPS: { id: Step; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'infra', label: 'Infrastructure', icon: Globe2, desc: 'Create the IXP — your exchange identity' },
  { id: 'facility', label: 'Data Center', icon: Building2, desc: 'Add a facility (PeeringDB auto-search)' },
  { id: 'cabinet', label: 'Rack / Cabinet', icon: Server, desc: 'Place a rack inside the facility' },
  { id: 'device', label: 'Device', icon: Router, desc: 'Mount a switch, router or patch panel' },
  { id: 'vlan', label: 'Peering LAN', icon: Network, desc: 'Create the VLAN and IP ranges' },
  { id: 'routeserver', label: 'Route Server', icon: Cable, desc: 'Register your BIRD route server' },
  { id: 'done', label: 'Ready', icon: Check, desc: 'The fabric is live — start provisioning' },
];

const IxSetupWizard: React.FC<Props> = ({ embedded, onBack, onNavigateSection }) => {
  const [step, setStep] = useState<Step>('infra');
  const [loading, setLoading] = useState(true);

  // Progress tracking: what already exists
  const [infras, setInfras] = useState<InfrastructureItem[]>([]);
  const [facilities, setFacilities] = useState<FacilityItem[]>([]);
  const [cabinets, setCabinets] = useState<CabinetItem[]>([]);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [vlans, setVlans] = useState<VlanItem[]>([]);
  const [routeServers, setRouteServers] = useState<any[]>([]);

  const loadProgress = useCallback(async () => {
    setLoading(true);
    const [iRes, fRes, cRes, dRes, vRes, rsRes] = await Promise.all([
      adminFabricApi.listInfrastructures(),
      adminFabricApi.listFacilities(),
      adminFabricApi.listCabinets(),
      adminFabricApi.listDevices({}),
      adminVlansApi.list(),
      adminBirdApi.list(),
    ]);
    if (iRes.success && iRes.data) setInfras(iRes.data);
    if (fRes.success && fRes.data) setFacilities(fRes.data);
    if (cRes.success && cRes.data) setCabinets(cRes.data);
    if (dRes.success && dRes.data) setDevices(dRes.data);
    if (vRes.success && vRes.data) setVlans(vRes.data);
    if (rsRes.success && rsRes.data) setRouteServers(rsRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  // Determine the first incomplete step
  useEffect(() => {
    if (loading) return;
    if (!infras.length) { setStep('infra'); return; }
    if (!facilities.length) { setStep('facility'); return; }
    if (!cabinets.length) { setStep('cabinet'); return; }
    if (!devices.length) { setStep('device'); return; }
    if (!vlans.length) { setStep('vlan'); return; }
    if (!routeServers.length) { setStep('routeserver'); return; }
    setStep('done');
  }, [loading, infras, facilities, cabinets, devices, vlans, routeServers]);

  const stepIdx = STEPS.findIndex((s) => s.id === step);
  const completed = (id: Step) => {
    switch (id) {
      case 'infra': return infras.length > 0;
      case 'facility': return facilities.length > 0;
      case 'cabinet': return cabinets.length > 0;
      case 'device': return devices.length > 0;
      case 'vlan': return vlans.length > 0;
      case 'routeserver': return routeServers.length > 0;
      case 'done': return false;
    }
  };

  const goFabric = () => onNavigateSection?.('fabric');
  const goVlans = () => onNavigateSection?.('vlans');
  const goBird = () => onNavigateSection?.('bird');
  const goPeers = () => onNavigateSection?.('peers');

  if (loading) return <PanelShell title="IX Setup" subtitle="Loading your progress…" icon={Sparkles} embedded={embedded} onBack={onBack}><Spinner /></PanelShell>;

  return (
    <PanelShell
      title="IX Setup Wizard"
      subtitle="Step-by-step guide to bring your exchange fabric online"
      icon={Sparkles}
      embedded={embedded}
      onBack={onBack}
    >
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Progress sidebar */}
        <aside className="lg:col-span-3">
          <nav className="space-y-1">
            {STEPS.map((s, i) => {
              const done = completed(s.id);
              const current = step === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setStep(s.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    current
                      ? 'bg-[#F20732]/10 border border-[#F20732]/30 text-white'
                      : done
                        ? 'bg-gray-800 text-green-400 hover:bg-gray-750'
                        : 'bg-gray-800/50 text-gray-500 hover:bg-gray-800'
                  }`}
                >
                  <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                    done ? 'bg-green-500/20 text-green-400' : current ? 'bg-[#F20732] text-white' : 'bg-gray-700 text-gray-500'
                  }`}>
                    {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </span>
                  <span className="text-sm font-bold">{s.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-6 bg-gray-800 border border-gray-700 rounded-lg p-4">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-mono mb-2">Progress</p>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#F20732] transition-all duration-500"
                style={{ width: `${Math.round((STEPS.filter((s) => completed(s.id)).length / (STEPS.length - 1)) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {STEPS.filter((s) => completed(s.id)).length} / {STEPS.length - 1} steps complete
            </p>
          </div>
        </aside>

        {/* Main content */}
        <main className="lg:col-span-9 space-y-6">
          <Card>
            <div className="px-5 pt-5 pb-3 flex items-center gap-3 border-b border-gray-700">
              {React.createElement(STEPS[stepIdx].icon, { className: 'w-5 h-5 text-[#F20732]' })}
              <div>
                <h3 className="font-bold text-lg">{STEPS[stepIdx].label}</h3>
                <p className="text-gray-500 text-xs">{STEPS[stepIdx].desc}</p>
              </div>
            </div>

            <div className="p-5">
              {step === 'infra' && (
                <StepContent
                  done={!!infras.length}
                  doneLabel={`${infras.length} infrastructure(s) configured`}
                  action="Go to Fabric panel to create"
                  onAction={goFabric}
                  hint="Create your IXP identity — name, short name, PeeringDB IX ID. This groups all your facilities, VLANs and route servers under one exchange."
                />
              )}
              {step === 'facility' && (
                <StepContent
                  done={!!facilities.length}
                  doneLabel={`${facilities.length} facility/ies configured`}
                  action="Go to Fabric panel to add a facility"
                  onAction={goFabric}
                  hint="Add a data center. You can search PeeringDB by name or city and auto-fill address, coordinates and capacity."
                />
              )}
              {step === 'cabinet' && (
                <StepContent
                  done={!!cabinets.length}
                  doneLabel={`${cabinets.length} rack(s) configured`}
                  action="Go to Fabric panel to add a rack"
                  onAction={goFabric}
                  hint="Create racks inside your facilities. Set the U height (default 42U), power capacity and weight limit. The rack elevation view will show occupied positions."
                />
              )}
              {step === 'device' && (
                <StepContent
                  done={!!devices.length}
                  doneLabel={`${devices.length} device(s) configured`}
                  action="Go to Fabric panel to mount a device"
                  onAction={goFabric}
                  hint="Mount your switches, routers and patch panels into rack positions. Define ports on switches so they can be allocated to members during provisioning."
                />
              )}
              {step === 'vlan' && (
                <StepContent
                  done={!!vlans.length}
                  doneLabel={`${vlans.length} VLAN(s) configured`}
                  action="Go to VLANs panel to create"
                  onAction={goVlans}
                  hint="Create your peering LAN — the VLAN tag, IPv4 subnet and IPv6 subnet that members will be addressed from. The IPAM engine allocates addresses atomically when connections are provisioned."
                />
              )}
              {step === 'routeserver' && (
                <StepContent
                  done={!!routeServers.length}
                  doneLabel={`${routeServers.length} route server(s) configured`}
                  action="Go to BIRD panel to register"
                  onAction={goBird}
                  hint="Register each route server instance — its ASN, peering IPs, the VLAN it serves, and the agent endpoint for config deployment. Bird config is generated per-member and deployed with approval."
                />
              )}
              {step === 'done' && (
                <div className="text-center py-10 space-y-4">
                  <div className="w-16 h-16 bg-green-500/15 text-green-400 rounded-full flex items-center justify-center mx-auto">
                    <Check className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-bold">Exchange fabric is ready</h3>
                  <p className="text-gray-400 max-w-lg mx-auto">
                    Infrastructure, data center, racks, devices, peering LAN and route servers are all configured.
                    You can now provision member connections.
                  </p>
                  <div className="flex justify-center gap-3 pt-4">
                    <button
                      onClick={goPeers}
                      className="flex items-center gap-2 px-6 py-3 bg-[#F20732] rounded-lg font-bold hover:bg-[#C00628] transition-colors"
                    >
                      <Network className="w-4 h-4" /> Provision a member <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={goFabric}
                      className="flex items-center gap-2 px-6 py-3 bg-gray-700 rounded-lg font-bold hover:bg-gray-600 transition-colors"
                    >
                      <Building2 className="w-4 h-4" /> View fabric
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Quick stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <MiniStat label="Infrastructures" value={infras.length} />
            <MiniStat label="Facilities" value={facilities.length} />
            <MiniStat label="Racks" value={cabinets.length} />
            <MiniStat label="Devices" value={devices.length} />
            <MiniStat label="VLANs" value={vlans.length} />
            <MiniStat label="Route Servers" value={routeServers.length} />
          </div>
        </main>
      </div>
    </PanelShell>
  );
};

const StepContent: React.FC<{
  done: boolean;
  doneLabel: string;
  action: string;
  onAction: () => void;
  hint: string;
}> = ({ done, doneLabel, action, onAction, hint }) => (
  <div className="space-y-4">
    {done ? (
      <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-lg p-4">
        <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
        <span className="text-green-400 font-bold">{doneLabel}</span>
      </div>
    ) : (
      <Note tone="info">{hint}</Note>
    )}
    <button
      onClick={onAction}
      className="flex items-center gap-2 px-5 py-3 bg-[#F20732] rounded-lg font-bold text-sm hover:bg-[#C00628] transition-colors"
    >
      {done ? 'Manage' : action} <ArrowRight className="w-4 h-4" />
    </button>
  </div>
);

const MiniStat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-center">
    <div className="text-2xl font-bold text-white">{value}</div>
    <div className="text-[9px] uppercase tracking-wider text-gray-500 font-mono mt-1">{label}</div>
  </div>
);

export default IxSetupWizard;
