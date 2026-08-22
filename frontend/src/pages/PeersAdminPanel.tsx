import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Share2,
  Plus,
  Trash2,
  RefreshCw,
  Cable,
  Zap,
  ArrowRight,
  Search,
  Check,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import {
  adminPeersApi,
  adminCustomersApi,
  ConnectionItem,
  PeerItem,
  ProvisioningOption,
  ProvisionResult,
  CustomerOrg,
  MacItem,
} from '../services/api';
import {
  PanelShell,
  Btn,
  Card,
  CardHeader,
  Table,
  Td,
  Modal,
  Fld,
  Grid,
  Toggle,
  Badge,
  StatTile,
  Note,
  WarningList,
  Spinner,
  EmptyState,
  field,
  fmtSpeed,
  fmtNumber,
  rsModeTone,
} from './admin/ui';

interface Props {
  embedded?: boolean;
  onBack?: () => void;
  /** Pre-fill the provisioning wizard from an approved order. */
  provisionContext?: {
    orderId?: string;
    orgId?: string;
    orgName?: string;
    location?: string;
    speed?: string;
    type?: string;
  } | null;
  onProvisionDone?: () => void;
}

type Tab = 'connections' | 'peers';

/**
 * Member connections and peers.
 *
 * The provisioning wizard is the centre of this screen: it claims switch ports,
 * builds the connection and peer, allocates addresses, pulls PeeringDB, expands
 * the as-set and pushes config to both route servers in one action.
 */
const PeersAdminPanel: React.FC<Props> = ({ embedded, onBack, provisionContext, onProvisionDone }) => {
  const [tab, setTab] = useState<Tab>('connections');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [peers, setPeers] = useState<PeerItem[]>([]);
  const [options, setOptions] = useState<ProvisioningOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOrg[]>([]);

  const [wizard, setWizard] = useState(false);
  const [editingPeer, setEditingPeer] = useState<PeerItem | null>(null);
  const [macsFor, setMacsFor] = useState<PeerItem | null>(null);
  const [macSearch, setMacSearch] = useState(false);

  // Auto-open the provisioning wizard when navigated from Orders with context.
  useEffect(() => {
    if (provisionContext?.orgId && !wizard) {
      setWizard(true);
    }
  }, [provisionContext]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    const [cRes, pRes, oRes, custRes] = await Promise.all([
      adminPeersApi.listConnections(),
      adminPeersApi.listPeers(),
      adminPeersApi.options(),
      adminCustomersApi.list(),
    ]);
    if (cRes.success && cRes.data) setConnections(cRes.data);
    else setError(cRes.error || 'Could not load connections.');
    if (pRes.success && pRes.data) setPeers(pRes.data);
    if (oRes.success && oRes.data) setOptions(oRes.data);
    if (custRes.success && custRes.data) setCustomers(custRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const deprovision = async (c: ConnectionItem) => {
    const name = c.organization?.name || c.name;
    if (
      !confirm(
        `Deprovision ${name}?\n\nThis releases their IP addresses, frees the switch ports and removes the peer from both route servers.`
      )
    )
      return;
    setError('');
    const res = await adminPeersApi.deprovision(c._id, true);
    if (!res.success) setError(res.error || 'Deprovisioning failed.');
    else load();
  };

  const totalCapacity = useMemo(
    () => connections.reduce((n, c) => n + (c.capacityMbps || 0), 0),
    [connections]
  );

  if (loading) return <Spinner label="Loading connections…" />;

  const rsClients = peers.filter((p) => p.rsClient).length;
  const passive = peers.filter((p) => p.rsMode === 'passive').length;

  return (
    <PanelShell
      title="Connections & Peers"
      subtitle="Member LAGs, BGP peers and end-to-end provisioning"
      icon={Share2}
      embedded={embedded}
      onBack={onBack}
      actions={
        <>
          <Btn icon={Search} size="sm" onClick={() => setMacSearch(true)}>
            MAC lookup
          </Btn>
          <Btn icon={RefreshCw} size="sm" onClick={load} />
          <Btn icon={Zap} variant="primary" size="sm" onClick={() => setWizard(true)}>
            Provision connection
          </Btn>
        </>
      }
    >
      {error && (
        <Note tone="error" onDismiss={() => setError('')}>
          {error}
        </Note>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatTile label="Connections" value={connections.length} />
        <StatTile label="Peers" value={peers.length} />
        <StatTile label="RS clients" value={rsClients} tone="blue" />
        <StatTile label="Passive" value={passive} tone={passive ? 'amber' : undefined} hint="Waiting on the member" />
        <StatTile label="Fabric capacity" value={fmtSpeed(totalCapacity)} />
      </div>

      <div className="flex items-center gap-2">
        {(['connections', 'peers'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded font-mono text-[11px] uppercase tracking-wider transition-colors ${
              tab === t ? 'bg-[#F20732] text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'connections' &&
        (!connections.length ? (
          <EmptyState
            icon={Cable}
            title="No member connections yet"
            hint="Provisioning claims a switch port, allocates addresses, builds the peer and pushes config to the route servers in one step."
            action={
              <Btn icon={Zap} variant="primary" onClick={() => setWizard(true)}>
                Provision the first connection
              </Btn>
            }
          />
        ) : (
          <div className="space-y-4">
            {connections.map((c) => (
              <Card key={c._id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold">{c.organization?.name || 'Unknown member'}</h3>
                      {c.organization?.asn && <Badge tone="blue">AS{c.organization.asn}</Badge>}
                      {c.organization?.status === 'suspended' && <Badge tone="red">suspended</Badge>}
                      {c.isReseller && <Badge tone="gray">reseller</Badge>}
                    </div>
                    <p className="font-mono text-xs text-gray-500">
                      {c.infrastructure?.name || '—'} · {c.name} · {c.lagFraming.toUpperCase()} ·{' '}
                      {fmtSpeed(c.capacityMbps)}
                    </p>
                  </div>
                  <Btn icon={Trash2} variant="danger" size="sm" onClick={() => deprovision(c)}>
                    Deprovision
                  </Btn>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-gray-500 mb-2">
                      Physical ports ({c.ports.length})
                    </p>
                    {!c.ports.length ? (
                      <p className="text-sm text-gray-500">No ports</p>
                    ) : (
                      <div className="space-y-1.5">
                        {c.ports.map((p) => (
                          <div key={p.id} className="flex items-center gap-2 font-mono text-xs">
                            <span className="text-gray-400 truncate">
                              {p.switchName} {p.portName}
                            </span>
                            <span className="text-gray-600">{fmtSpeed(p.speed)}</span>
                            <span className="ml-auto flex-shrink-0">
                              <Badge tone={p.status === 'connected' ? 'green' : 'amber'}>{p.status}</Badge>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-gray-500 mb-2">
                      Peers ({c.peers.length})
                    </p>
                    {!c.peers.length ? (
                      <p className="text-sm text-gray-500">No peers</p>
                    ) : (
                      <div className="space-y-2">
                        {c.peers.map((p) => (
                          <div key={p.id} className="font-mono text-xs">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-gray-400">
                                VLAN {p.vlan?.number ?? '—'} {p.vlan?.isQuarantine ? '(quarantine)' : ''}
                              </span>
                              {p.rsClient ? (
                                <Badge tone={rsModeTone(p.rsMode)}>RS {p.rsMode}</Badge>
                              ) : (
                                <Badge tone="gray">bilateral only</Badge>
                              )}
                            </div>
                            <div className="text-gray-500 mt-0.5">
                              {p.ipv4 || '—'} · {p.ipv6 || '—'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ))}

      {tab === 'peers' &&
        (!peers.length ? (
          <EmptyState icon={Share2} title="No peers yet" />
        ) : (
          <Card>
            <CardHeader
              title="Peers"
              hint="Policy changes here take effect on the route servers after the next deploy."
            />
            <Table head={['Member', 'VLAN', 'IPv4', 'IPv6', 'Route server', 'Filters', 'Max prefixes', '']}>
              {peers.map((p) => {
                const org = p.virtualInterface?.organization;
                return (
                  <tr key={p._id} className="hover:bg-gray-700/20">
                    <Td>
                      <div className="font-bold text-sm">{org?.name || '—'}</div>
                      <div className="font-mono text-[11px] text-gray-500">
                        {p.peerAsn ? `AS${p.peerAsn}` : org?.asn ? `AS${org.asn}` : 'no ASN'}
                      </div>
                    </Td>
                    <Td className="font-mono text-xs">
                      {p.vlan?.number ?? '—'}
                      {p.vlan?.isQuarantine && (
                        <span className="ml-1">
                          <Badge tone="amber">Q</Badge>
                        </span>
                      )}
                    </Td>
                    <Td className="font-mono text-xs">{p.ipv4Address?.address || (p.ipv4Enabled ? '⚠ none' : '—')}</Td>
                    <Td className="font-mono text-xs">{p.ipv6Address?.address || (p.ipv6Enabled ? '⚠ none' : '—')}</Td>
                    <Td>
                      {p.rsClient ? <Badge tone={rsModeTone(p.rsMode)}>{p.rsMode}</Badge> : <Badge tone="gray">no</Badge>}
                    </Td>
                    <Td>
                      <div className="flex gap-1 flex-wrap">
                        {p.irrdbFilter && <Badge tone="green">IRRDB</Badge>}
                        {p.rpkiFilter && <Badge tone="green">RPKI</Badge>}
                        {!p.irrdbFilter && !p.rpkiFilter && <Badge tone="red">none</Badge>}
                      </div>
                    </Td>
                    <Td className="font-mono text-[11px] text-gray-400">
                      {fmtNumber(p.maxPrefixesV4 || undefined)} / {fmtNumber(p.maxPrefixesV6 || undefined)}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1 justify-end">
                        <Btn icon={Wifi} size="sm" onClick={() => setMacsFor(p)} title="MAC addresses">
                          {p.macCount || 0}
                        </Btn>
                        <Btn icon={ShieldCheck} size="sm" onClick={() => setEditingPeer(p)}>
                          Policy
                        </Btn>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </Table>
          </Card>
        ))}

      {wizard && (
        <ProvisionWizard
          options={options}
          customers={customers}
          onClose={() => setWizard(false)}
          onDone={() => {
            setWizard(false);
            load();
          }}
        />
      )}

      {editingPeer && (
        <PeerPolicyForm
          peer={editingPeer}
          onClose={() => setEditingPeer(null)}
          onSaved={() => {
            setEditingPeer(null);
            load();
          }}
        />
      )}

      {macsFor && (
        <MacManager
          peer={macsFor}
          onClose={() => {
            setMacsFor(null);
            load();
          }}
        />
      )}

      {macSearch && <MacLookup onClose={() => setMacSearch(false)} />}
    </PanelShell>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Provisioning wizard
// ══════════════════════════════════════════════════════════════════════════════

const ProvisionWizard: React.FC<{
  options: ProvisioningOption[];
  customers: CustomerOrg[];
  onClose: () => void;
  onDone: () => void;
}> = ({ options, customers, onClose, onDone }) => {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<ProvisionResult | null>(null);

  const [organizationId, setOrganizationId] = useState('');
  const [infraId, setInfraId] = useState(options[0]?.id || '');
  const [vlanId, setVlanId] = useState('');
  const [selectedPorts, setSelectedPorts] = useState<string[]>([]);
  const [speed, setSpeed] = useState('');
  const [name, setName] = useState('');
  const [ipv4, setIpv4] = useState(true);
  const [ipv6, setIpv6] = useState(true);
  const [rsClient, setRsClient] = useState(true);
  const [rsMode, setRsMode] = useState<'normal' | 'passive' | 'disabled'>('passive');
  const [irrdbFilter, setIrrdbFilter] = useState(true);
  const [rpkiFilter, setRpkiFilter] = useState(true);
  const [syncPeeringDb, setSyncPeeringDb] = useState(true);
  const [refreshIrrdb, setRefreshIrrdb] = useState(true);
  const [deploy, setDeploy] = useState(true);
  const [quarantine, setQuarantine] = useState(false);

  const infra = options.find((o) => o.id === infraId);
  const org = customers.find((c) => c._id === organizationId);

  // Ports offered are narrowed by the chosen speed so a LAG can't mix rates.
  const ports = useMemo(() => {
    if (!infra) return [];
    return speed ? infra.freePorts.filter((p) => String(p.speed) === speed) : infra.freePorts;
  }, [infra, speed]);

  const vlans = useMemo(() => {
    if (!infra) return [];
    return infra.vlans.filter((v) => !v.isPrivate && (quarantine ? v.isQuarantine : !v.isQuarantine));
  }, [infra, quarantine]);

  useEffect(() => {
    // Reset dependent choices whenever the fabric changes.
    setSelectedPorts([]);
    setVlanId('');
    setSpeed('');
  }, [infraId]);

  useEffect(() => {
    setVlanId(vlans[0]?.id || '');
  }, [quarantine, infraId, vlans.length]);

  const togglePort = (id: string) =>
    setSelectedPorts((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const canSubmit = organizationId && infraId && speed && selectedPorts.length > 0;

  const submit = async () => {
    setErr('');
    setBusy(true);
    const res = await adminPeersApi.provision({
      organizationId,
      infrastructureId: infraId,
      vlanId: vlanId || undefined,
      switchPortIds: selectedPorts,
      speed: Number(speed),
      name: name.trim() || undefined,
      quarantine,
      ipv4,
      ipv6,
      rsClient,
      rsMode,
      irrdbFilter,
      rpkiFilter,
      syncPeeringDb,
      refreshIrrdb,
      deploy,
    });
    setBusy(false);
    if (res.success && res.data) setResult(res.data);
    else setErr(res.error || 'Provisioning failed.');
  };

  // ── Result view ──
  if (result) {
    return (
      <Modal
        title="Connection provisioned"
        hint={`${result.organization.name}${result.organization.asn ? ` · AS${result.organization.asn}` : ''}`}
        onClose={onDone}
        wide
        footer={
          <Btn variant="primary" onClick={onDone}>
            Done
          </Btn>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatTile label="IPv4 assigned" value={result.ipv4 || '—'} tone={result.ipv4 ? 'green' : undefined} />
          <StatTile label="IPv6 assigned" value={result.ipv6 || '—'} tone={result.ipv6 ? 'green' : undefined} />
          <StatTile label="Ports claimed" value={result.physicalInterfaceIds.length} />
        </div>

        <Card>
          <CardHeader title="What happened" />
          <Table head={['Step', 'Result', 'Detail']} dense>
            {result.steps.map((s, i) => (
              <tr key={i}>
                <Td className="font-mono text-xs">{s.step}</Td>
                <Td>{s.ok ? <Badge tone="green">ok</Badge> : <Badge tone="amber">issue</Badge>}</Td>
                <Td className="text-xs text-gray-400">{s.detail || s.error || '—'}</Td>
              </tr>
            ))}
          </Table>
        </Card>

        {result.deployments?.length > 0 && (
          <Card>
            <CardHeader title="Route server deployment" />
            <Table head={['Route server', 'Applied', 'Peers', 'Note']} dense>
              {result.deployments.map((d) => (
                <tr key={d.routeServer}>
                  <Td className="text-sm">{d.name || d.routeServer}</Td>
                  <Td>
                    {d.applied ? (
                      <Badge tone="green">applied</Badge>
                    ) : d.skipped ? (
                      <Badge tone="gray">skipped</Badge>
                    ) : (
                      <Badge tone="red">failed</Badge>
                    )}
                  </Td>
                  <Td className="font-mono text-xs">{d.peerCount}</Td>
                  <Td className="text-xs text-gray-400">{d.error || d.reason || '—'}</Td>
                </tr>
              ))}
            </Table>
          </Card>
        )}

        <WarningList warnings={result.warnings} />
      </Modal>
    );
  }

  const stepTitles = ['Member & fabric', 'Ports', 'Peering policy', 'Review'];

  return (
    <Modal
      title="Provision a connection"
      hint={`Step ${step} of 4 — ${stepTitles[step - 1]}`}
      onClose={onClose}
      wide
      footer={
        <>
          {step > 1 && <Btn onClick={() => setStep(step - 1)}>Back</Btn>}
          <Btn onClick={onClose}>Cancel</Btn>
          {step < 4 ? (
            <Btn
              variant="primary"
              icon={ArrowRight}
              onClick={() => setStep(step + 1)}
              disabled={step === 1 ? !organizationId || !infraId : step === 2 ? !speed || !selectedPorts.length : false}
            >
              Next
            </Btn>
          ) : (
            <Btn variant="primary" icon={Zap} busy={busy} onClick={submit} disabled={!canSubmit}>
              Provision
            </Btn>
          )}
        </>
      }
    >
      {err && <Note tone="error">{err}</Note>}

      {/* Progress */}
      <div className="flex items-center gap-1">
        {stepTitles.map((t, i) => (
          <React.Fragment key={t}>
            <div
              className={`flex-1 h-1 rounded-full ${i + 1 <= step ? 'bg-[#F20732]' : 'bg-gray-700'}`}
              title={t}
            />
          </React.Fragment>
        ))}
      </div>

      {step === 1 && (
        <>
          <Grid>
            <Fld label="Member" hint="Must already exist as a customer with an ASN set.">
              <select className={field} value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}>
                <option value="">Select a member…</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                    {c.asn ? ` (AS${c.asn})` : ' — no ASN'}
                  </option>
                ))}
              </select>
            </Fld>
            <Fld label="Infrastructure">
              <select className={field} value={infraId} onChange={(e) => setInfraId(e.target.value)}>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} (AS{o.asn})
                  </option>
                ))}
              </select>
            </Fld>
          </Grid>

          {org && !org.asn && (
            <Note tone="error">
              {org.name} has no ASN. A BGP peer cannot be built without one — set the ASN on the customer first.
            </Note>
          )}

          <Toggle
            checked={quarantine}
            onChange={setQuarantine}
            label="Start in the quarantine VLAN"
            hint="Recommended for a new member: they can test before joining the production peering LAN."
          />

          <Fld label="Peering VLAN">
            <select className={field} value={vlanId} onChange={(e) => setVlanId(e.target.value)}>
              <option value="">Default for this fabric</option>
              {vlans.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} (VLAN {v.number})
                </option>
              ))}
            </select>
          </Fld>

          {!vlans.length && infra && (
            <Note tone="warning">
              {quarantine
                ? 'This fabric has no quarantine VLAN configured. Create one, or provision straight onto the peering LAN.'
                : 'This fabric has no peering VLAN configured. Create one under VLANs & IP addressing first.'}
            </Note>
          )}

          <Fld label="Connection name" hint="Left blank, it is derived from the ASN and fabric name.">
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="AS64500 Mumbai LAG" />
          </Fld>
        </>
      )}

      {step === 2 && (
        <>
          <Fld label="Port speed" hint="Only free ports at this speed are offered, so a LAG cannot mix rates.">
            <select className={field} value={speed} onChange={(e) => setSpeed(e.target.value)}>
              <option value="">Select a speed…</option>
              {(infra?.speeds || []).map((s) => (
                <option key={s} value={String(s)}>
                  {fmtSpeed(s)}
                </option>
              ))}
              {!infra?.speeds?.length && <option value="10000">10G</option>}
            </select>
          </Fld>

          {!infra?.freePorts.length ? (
            <Note tone="warning">
              No free peering ports on this fabric. Add a device and generate its ports under Infrastructure, or free up
              an existing port.
            </Note>
          ) : (
            <>
              <p className="font-mono text-[11px] uppercase tracking-wider text-gray-400">
                Select ports · {selectedPorts.length} chosen
                {selectedPorts.length > 1 && ' (LACP LAG)'}
              </p>
              <div className="max-h-64 overflow-y-auto border border-gray-700 rounded-lg divide-y divide-gray-700/60">
                {ports.map((p) => {
                  const on = selectedPorts.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePort(p.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        on ? 'bg-[#F20732]/15' : 'hover:bg-gray-700/30'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          on ? 'bg-[#F20732] border-[#F20732]' : 'border-gray-600'
                        }`}
                      >
                        {on && <Check className="w-3 h-3 text-white" />}
                      </span>
                      <span className="font-mono text-xs text-gray-300 truncate">{p.switchName}</span>
                      <span className="font-mono text-xs font-bold truncate">{p.name}</span>
                      <span className="ml-auto font-mono text-[11px] text-gray-500 flex-shrink-0">
                        {fmtSpeed(p.speed)} {p.media ? `· ${p.media}` : ''}
                      </span>
                    </button>
                  );
                })}
                {!ports.length && speed && (
                  <p className="px-4 py-6 text-sm text-gray-500 text-center">No free ports at {fmtSpeed(Number(speed))}.</p>
                )}
              </div>
            </>
          )}
        </>
      )}

      {step === 3 && (
        <>
          <Grid>
            <Fld label="Address families">
              <div className="space-y-2 pt-1">
                <Toggle checked={ipv4} onChange={setIpv4} label="IPv4" />
                <Toggle checked={ipv6} onChange={setIpv6} label="IPv6" />
              </div>
            </Fld>
            <Fld label="Route server session">
              <div className="space-y-2 pt-1">
                <Toggle
                  checked={rsClient}
                  onChange={setRsClient}
                  label="Route server client"
                  hint="Off means bilateral peering only — no RS session is generated."
                />
              </div>
              {rsClient && (
                <select className={`${field} mt-3`} value={rsMode} onChange={(e) => setRsMode(e.target.value as any)}>
                  <option value="passive">Passive — RS waits for the member (recommended for new members)</option>
                  <option value="normal">Normal — RS initiates and accepts</option>
                  <option value="disabled">Disabled — config emitted but shut down</option>
                </select>
              )}
            </Fld>
          </Grid>

          <div className="border-t border-gray-700 pt-4 space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-wider text-gray-400">Prefix filtering</p>
            <Toggle
              checked={irrdbFilter}
              onChange={setIrrdbFilter}
              label="IRRDB prefix filtering"
              hint="Only prefixes in the member's registered as-set are accepted. Until the as-set is expanded, everything is rejected."
            />
            <Toggle
              checked={rpkiFilter}
              onChange={setRpkiFilter}
              label="RPKI origin validation"
              hint="RPKI-invalid routes are rejected. Requires an RTR server on the route server."
            />
          </div>

          <div className="border-t border-gray-700 pt-4 space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-wider text-gray-400">Automation</p>
            <Toggle
              checked={syncPeeringDb}
              onChange={setSyncPeeringDb}
              label="Pull the member's PeeringDB record"
              hint="Fills in max-prefix limits and the registered as-set."
            />
            <Toggle
              checked={refreshIrrdb}
              onChange={setRefreshIrrdb}
              label="Expand their as-set now"
              hint="Populates the prefix filter so the session works immediately. Can take a minute."
            />
            <Toggle
              checked={deploy}
              onChange={setDeploy}
              label="Deploy to the route servers"
              hint="Pushes the new config to every route server on this fabric, one at a time."
            />
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <Card>
            <CardHeader title="Review" hint="Nothing is changed until you press Provision." />
            <div className="divide-y divide-gray-700/60">
              {[
                ['Member', org ? `${org.name}${org.asn ? ` (AS${org.asn})` : ''}` : '—'],
                ['Infrastructure', infra?.name || '—'],
                ['VLAN', vlans.find((v) => v.id === vlanId)?.name || `Default${quarantine ? ' quarantine' : ''} VLAN`],
                [
                  'Ports',
                  selectedPorts
                    .map((id) => {
                      const p = infra?.freePorts.find((x) => x.id === id);
                      return p ? `${p.switchName} ${p.name}` : id;
                    })
                    .join(', ') || '—',
                ],
                ['Capacity', speed ? `${selectedPorts.length} x ${fmtSpeed(Number(speed))}` : '—'],
                ['Families', [ipv4 && 'IPv4', ipv6 && 'IPv6'].filter(Boolean).join(' + ') || 'none'],
                ['Route server', rsClient ? `client (${rsMode})` : 'bilateral only'],
                ['Filters', [irrdbFilter && 'IRRDB', rpkiFilter && 'RPKI'].filter(Boolean).join(' + ') || 'none'],
                [
                  'Automation',
                  [syncPeeringDb && 'PeeringDB sync', refreshIrrdb && 'as-set expansion', deploy && 'RS deploy']
                    .filter(Boolean)
                    .join(', ') || 'none',
                ],
              ].map(([k, v]) => (
                <div key={k as string} className="flex gap-4 px-5 py-3">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-gray-500 w-40 flex-shrink-0 pt-0.5">
                    {k}
                  </span>
                  <span className="text-sm min-w-0">{v as string}</span>
                </div>
              ))}
            </div>
          </Card>

          {!irrdbFilter && !rpkiFilter && (
            <Note tone="warning">
              No prefix filtering is enabled for this peer. They will be able to announce anything that passes the basic
              bogon and origin checks.
            </Note>
          )}
          {irrdbFilter && !refreshIrrdb && (
            <Note tone="warning">
              IRRDB filtering is on but the as-set will not be expanded now. Until it is, the route servers reject every
              route from this member.
            </Note>
          )}
        </>
      )}
    </Modal>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Peer policy
// ══════════════════════════════════════════════════════════════════════════════

const PeerPolicyForm: React.FC<{ peer: PeerItem; onClose: () => void; onSaved: () => void }> = ({
  peer,
  onClose,
  onSaved,
}) => {
  const [form, setForm] = useState({
    ipv4Enabled: peer.ipv4Enabled,
    ipv6Enabled: peer.ipv6Enabled,
    rsClient: peer.rsClient,
    rsMode: peer.rsMode,
    irrdbFilter: peer.irrdbFilter,
    rpkiFilter: peer.rpkiFilter,
    asMacro: peer.asMacro || '',
    maxPrefixesV4: peer.maxPrefixesV4 ? String(peer.maxPrefixesV4) : '',
    maxPrefixesV6: peer.maxPrefixesV6 ? String(peer.maxPrefixesV6) : '',
    peerAsn: peer.peerAsn ? String(peer.peerAsn) : '',
    as112Client: peer.as112Client,
    ipv4Hostname: peer.ipv4Hostname || '',
    ipv6Hostname: peer.ipv6Hostname || '',
    enabled: peer.enabled,
    notes: peer.notes || '',
  });
  const [md5v4, setMd5v4] = useState('');
  const [md5v6, setMd5v6] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');

  const save = async () => {
    setErr('');
    const payload: any = {
      ipv4Enabled: form.ipv4Enabled,
      ipv6Enabled: form.ipv6Enabled,
      rsClient: form.rsClient,
      rsMode: form.rsMode,
      irrdbFilter: form.irrdbFilter,
      rpkiFilter: form.rpkiFilter,
      asMacro: form.asMacro.trim(),
      as112Client: form.as112Client,
      ipv4Hostname: form.ipv4Hostname.trim(),
      ipv6Hostname: form.ipv6Hostname.trim(),
      enabled: form.enabled,
      notes: form.notes,
      maxPrefixesV4: form.maxPrefixesV4 ? Number(form.maxPrefixesV4) : 0,
      maxPrefixesV6: form.maxPrefixesV6 ? Number(form.maxPrefixesV6) : 0,
    };
    if (form.peerAsn) payload.peerAsn = Number(form.peerAsn);
    // Only send secrets when the operator actually typed something.
    if (md5v4) payload.ipv4BgpMd5 = md5v4;
    if (md5v6) payload.ipv6BgpMd5 = md5v6;

    setBusy(true);
    const res = await adminPeersApi.updatePeer(peer._id, payload);
    setBusy(false);
    if (res.success) {
      setNote(res.data?.note || 'Saved.');
      setTimeout(onSaved, 900);
    } else setErr(res.error || 'Save failed.');
  };

  const org = peer.virtualInterface?.organization;

  return (
    <Modal
      title={`Peer policy — ${org?.name || 'peer'}`}
      hint="Changes apply to the route servers on the next deploy."
      onClose={onClose}
      wide
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" busy={busy} onClick={save}>
            Save
          </Btn>
        </>
      }
    >
      {err && <Note tone="error">{err}</Note>}
      {note && <Note tone="success">{note}</Note>}

      <div className="grid grid-cols-2 gap-3">
        <StatTile label="IPv4" value={peer.ipv4Address?.address || '—'} />
        <StatTile label="IPv6" value={peer.ipv6Address?.address || '—'} />
      </div>

      <Grid>
        <Fld label="Address families">
          <div className="space-y-2 pt-1">
            <Toggle checked={form.ipv4Enabled} onChange={(v) => setForm({ ...form, ipv4Enabled: v })} label="IPv4" />
            <Toggle checked={form.ipv6Enabled} onChange={(v) => setForm({ ...form, ipv6Enabled: v })} label="IPv6" />
          </div>
        </Fld>
        <Fld label="Route server mode">
          <div className="pt-1 space-y-3">
            <Toggle checked={form.rsClient} onChange={(v) => setForm({ ...form, rsClient: v })} label="RS client" />
            <select
              className={field}
              value={form.rsMode}
              onChange={(e) => setForm({ ...form, rsMode: e.target.value as any })}
              disabled={!form.rsClient}
            >
              <option value="passive">passive</option>
              <option value="normal">normal</option>
              <option value="disabled">disabled</option>
            </select>
          </div>
        </Fld>
      </Grid>

      <div className="border-t border-gray-700 pt-4 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-wider text-gray-400">Filtering</p>
        <Toggle
          checked={form.irrdbFilter}
          onChange={(v) => setForm({ ...form, irrdbFilter: v })}
          label="IRRDB prefix filter"
        />
        <Toggle checked={form.rpkiFilter} onChange={(v) => setForm({ ...form, rpkiFilter: v })} label="RPKI validation" />
        <Grid cols={3}>
          <Fld label="as-set override" hint="Blank uses the PeeringDB value.">
            <input className={field} value={form.asMacro} onChange={(e) => setForm({ ...form, asMacro: e.target.value })} placeholder="AS-EXAMPLE" />
          </Fld>
          <Fld label="Max prefixes IPv4" hint="0 = PeeringDB, then RS default.">
            <input
              className={field}
              value={form.maxPrefixesV4}
              onChange={(e) => setForm({ ...form, maxPrefixesV4: e.target.value })}
            />
          </Fld>
          <Fld label="Max prefixes IPv6">
            <input
              className={field}
              value={form.maxPrefixesV6}
              onChange={(e) => setForm({ ...form, maxPrefixesV6: e.target.value })}
            />
          </Fld>
        </Grid>
      </div>

      <div className="border-t border-gray-700 pt-4">
        <p className="font-mono text-[11px] uppercase tracking-wider text-gray-400 mb-3">Session details</p>
        <Grid>
          <Fld label="Peer ASN override" hint="For a member peering with a secondary ASN.">
            <input className={field} value={form.peerAsn} onChange={(e) => setForm({ ...form, peerAsn: e.target.value })} />
          </Fld>
          <Fld label="AS112">
            <div className="pt-1">
              <Toggle
                checked={form.as112Client}
                onChange={(v) => setForm({ ...form, as112Client: v })}
                label="AS112 client"
              />
            </div>
          </Fld>
          <Fld label="IPv4 BGP MD5" hint="Write-only. Leave blank to keep the current secret.">
            <input className={field} type="password" value={md5v4} onChange={(e) => setMd5v4(e.target.value)} placeholder="unchanged" />
          </Fld>
          <Fld label="IPv6 BGP MD5" hint="Write-only.">
            <input className={field} type="password" value={md5v6} onChange={(e) => setMd5v6(e.target.value)} placeholder="unchanged" />
          </Fld>
          <Fld label="IPv4 hostname">
            <input
              className={field}
              value={form.ipv4Hostname}
              onChange={(e) => setForm({ ...form, ipv4Hostname: e.target.value })}
            />
          </Fld>
          <Fld label="IPv6 hostname">
            <input
              className={field}
              value={form.ipv6Hostname}
              onChange={(e) => setForm({ ...form, ipv6Hostname: e.target.value })}
            />
          </Fld>
        </Grid>
        <div className="mt-4 space-y-3">
          <Toggle
            checked={form.enabled}
            onChange={(v) => setForm({ ...form, enabled: v })}
            label="Peer enabled"
            hint="Disabling removes them from the generated config entirely."
          />
          <Fld label="Notes">
            <textarea className={`${field} h-20`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Fld>
        </div>
      </div>
    </Modal>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MAC addresses
// ══════════════════════════════════════════════════════════════════════════════

const MacManager: React.FC<{ peer: PeerItem; onClose: () => void }> = ({ peer, onClose }) => {
  const [rows, setRows] = useState<MacItem[]>([]);
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const res = await adminPeersApi.listMacs(peer._id);
    if (res.success && res.data) setRows(res.data);
  }, [peer._id]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    setErr('');
    if (!address.trim()) return;
    setBusy(true);
    const res = await adminPeersApi.addMac(peer._id, { address: address.trim(), approved: true });
    setBusy(false);
    if (res.success) {
      setAddress('');
      load();
    } else setErr(res.error || 'Could not add the address.');
  };

  const del = async (m: MacItem) => {
    const res = await adminPeersApi.deleteMac(peer._id, m._id);
    if (!res.success) setErr(res.error || 'Delete failed.');
    else load();
  };

  const org = peer.virtualInterface?.organization;

  return (
    <Modal
      title={`MAC addresses — ${org?.name || 'peer'}`}
      hint="Declared addresses can drive switch port security and let the NOC spot undeclared hardware."
      onClose={onClose}
      footer={<Btn onClick={onClose}>Close</Btn>}
    >
      {err && <Note tone="error">{err}</Note>}
      <div className="flex gap-2">
        <input
          className={field}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="aa:bb:cc:dd:ee:ff"
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <Btn icon={Plus} variant="primary" busy={busy} onClick={add}>
          Add
        </Btn>
      </div>

      {!rows.length ? (
        <EmptyState title="No MAC addresses recorded" />
      ) : (
        <Table head={['Address', 'Source', 'Approved', '']} dense>
          {rows.map((m) => (
            <tr key={m._id}>
              <Td className="font-mono text-xs">{(m.address.match(/.{2}/g) || []).join(':')}</Td>
              <Td>
                <Badge tone={m.source === 'declared' ? 'blue' : 'gray'}>{m.source}</Badge>
              </Td>
              <Td>{m.approved ? <Badge tone="green">yes</Badge> : <Badge tone="amber">pending</Badge>}</Td>
              <Td>
                <div className="flex justify-end">
                  <Btn icon={Trash2} variant="danger" size="sm" onClick={() => del(m)} />
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </Modal>
  );
};

const MacLookup: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [matches, setMatches] = useState<any[] | null>(null);

  const search = async () => {
    setErr('');
    setMatches(null);
    if (!address.trim()) return;
    setBusy(true);
    const res = await adminPeersApi.findMac(address.trim());
    setBusy(false);
    if (res.success && res.data) setMatches(res.data.matches);
    else setErr(res.error || 'Lookup failed.');
  };

  return (
    <Modal
      title="MAC address lookup"
      hint="Answers the question asked during layer-2 troubleshooting: whose is this?"
      onClose={onClose}
      footer={<Btn onClick={onClose}>Close</Btn>}
    >
      {err && <Note tone="error">{err}</Note>}
      <div className="flex gap-2">
        <input
          className={field}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="aa:bb:cc:dd:ee:ff or aabb.ccdd.eeff"
          onKeyDown={(e) => e.key === 'Enter' && search()}
        />
        <Btn icon={Search} variant="primary" busy={busy} onClick={search}>
          Find
        </Btn>
      </div>

      {matches !== null &&
        (matches.length === 0 ? (
          <Note tone="info">No peer has that MAC address recorded.</Note>
        ) : (
          <Table head={['Member', 'VLAN']} dense>
            {matches.map((m, i) => (
              <tr key={i}>
                <Td className="text-sm">
                  {m.vlanInterface?.virtualInterface?.organization?.name || '—'}
                  {m.vlanInterface?.virtualInterface?.organization?.asn && (
                    <span className="font-mono text-[11px] text-gray-500">
                      {' '}
                      AS{m.vlanInterface.virtualInterface.organization.asn}
                    </span>
                  )}
                </Td>
                <Td className="font-mono text-xs">
                  {m.vlanInterface?.vlan?.name} ({m.vlanInterface?.vlan?.number})
                </Td>
              </tr>
            ))}
          </Table>
        ))}
    </Modal>
  );
};

export default PeersAdminPanel;
