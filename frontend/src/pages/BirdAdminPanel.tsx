import React, { useCallback, useEffect, useState } from 'react';
import {
  Server,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Upload,
  RotateCcw,
  FileCode,
  Copy,
  Check,
  Wifi,
  AlertTriangle,
  Database,
} from 'lucide-react';
import {
  adminBirdApi,
  adminFabricApi,
  BirdRouteServerItem,
  BirdStatusRow,
  BirdConfigPreview,
  BirdDeployResult,
  BirdDeploymentRecord,
  IrrdbStatusRow,
  InfrastructureItem,
} from '../services/api';
import {
  PanelShell,
  Breadcrumb,
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
  fmtNumber,
  fmtRelative,
  fmtDate,
} from './admin/ui';

interface Props {
  embedded?: boolean;
  onBack?: () => void;
}

type View = 'status' | 'servers' | 'irrdb' | 'config' | 'history';

/**
 * Route server admin — BIRD config generation, deployment, history, rollback
 * aur IRRDB cache management.
 *
 * Yeh premium IX ka nerve center hai: yahan se config preview karo, deploy
 * karo, problems dekho aur rollback karo — sab ek jagah se.
 */
const BirdAdminPanel: React.FC<Props> = ({ embedded, onBack }) => {
  const [view, setView] = useState<View>('status');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Status board
  const [statusRows, setStatusRows] = useState<BirdStatusRow[]>([]);
  const [totals, setTotals] = useState({ total: 0, ready: 0, inSync: 0, withWarnings: 0 });

  // Route servers
  const [servers, setServers] = useState<BirdRouteServerItem[]>([]);
  const [infras, setInfras] = useState<InfrastructureItem[]>([]);

  // IRRDB
  const [irrdbRows, setIrrdbRows] = useState<IrrdbStatusRow[]>([]);
  const [bgpq4Ok, setBgpq4Ok] = useState(true);
  const [bgpq4Error, setBgpq4Error] = useState('');

  // Config preview
  const [preview, setPreview] = useState<BirdConfigPreview | null>(null);
  const [previewRs, setPreviewRs] = useState('');

  // History
  const [history, setHistory] = useState<BirdDeploymentRecord[]>([]);
  const [historyRs, setHistoryRs] = useState('');

  // Modals
  const [deployResult, setDeployResult] = useState<BirdDeployResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [editingRs, setEditingRs] = useState<BirdRouteServerItem | null>(null);
  const [creatingRs, setCreatingRs] = useState(false);

  const loadStatus = useCallback(async () => {
    const res = await adminBirdApi.status();
    if (res.success && res.data) {
      setStatusRows(res.data.routeServers);
      setTotals(res.data.totals);
    } else setError(res.error || 'Could not load route server status.');
    setLoading(false);
  }, []);

  const loadServers = useCallback(async () => {
    const [sRes, iRes] = await Promise.all([adminBirdApi.list(), adminFabricApi.listInfrastructures()]);
    if (sRes.success && sRes.data) setServers(sRes.data);
    if (iRes.success && iRes.data) setInfras(iRes.data);
  }, []);

  const loadIrrdb = useCallback(async () => {
    const res = await adminBirdApi.irrdbStatus();
    if (res.success && res.data) {
      setIrrdbRows(res.data.rows);
      setBgpq4Ok(res.data.bgpq4Available);
      setBgpq4Error(res.data.bgpq4Error || '');
    }
  }, []);

  const loadPreview = useCallback(async (rsId: string) => {
    setPreview(null);
    setPreviewRs(rsId);
    const res = await adminBirdApi.config(rsId);
    if (res.success && res.data) setPreview(res.data);
    else setError(res.error || 'Could not generate the config.');
  }, []);

  const loadHistory = useCallback(async (rsId: string) => {
    setHistoryRs(rsId);
    const res = await adminBirdApi.history(rsId);
    if (res.success && res.data) setHistory(res.data);
  }, []);

  useEffect(() => {
    loadStatus();
    loadServers();
  }, [loadStatus, loadServers]);

  useEffect(() => {
    if (view === 'irrdb') loadIrrdb();
  }, [view, loadIrrdb]);

  const deployOne = async (rsId: string) => {
    setError('');
    const res = await adminBirdApi.deploy(rsId);
    if (res.success && res.data) {
      setDeployResult(res.data);
      loadStatus();
    } else setError(res.error || 'Deploy failed.');
  };

  const deployAll = async () => {
    if (!confirm('Deploy to ALL route servers? This pushes config sequentially — rs1 first, then rs2.')) return;
    setError('');
    const res = await adminBirdApi.deployAll();
    if (res.success && res.data) {
      setDeployResult(res.data.results?.[0] || null);
      loadStatus();
    } else setError(res.error || 'Deploy failed.');
  };

  const rollback = async (deploymentId: string) => {
    if (!confirm('Rollback this route server to the previous config?')) return;
    setError('');
    const res = await adminBirdApi.rollback(deploymentId);
    if (res.success && res.data) {
      setDeployResult(res.data);
      loadStatus();
    } else setError(res.error || 'Rollback failed.');
  };

  const testConn = async (rsId: string) => {
    setError('');
    const res = await adminBirdApi.testConnection(rsId);
    if (res.success && res.data) {
      if (res.data.ok) alert('Connection OK:\n' + (res.data.output || 'BIRD is reachable.'));
      else alert('Connection FAILED:\n' + (res.data.error || res.data.output || 'Unknown error.'));
    } else setError(res.error || 'Test failed.');
  };

  const irrdbRefreshAll = async () => {
    setError('');
    const res = await adminBirdApi.irrdbRefreshAll({ onlyStale: true });
    if (res.success && res.data) {
      alert(`Refreshed ${res.data.succeeded} of ${res.data.attempted} ASNs. ${res.data.failed} failed, ${res.data.skipped} already fresh.`);
      loadIrrdb();
    } else setError(res.error || 'Refresh failed.');
  };

  const irrdbRefreshOne = async (asn: number) => {
    setError('');
    const res = await adminBirdApi.irrdbRefreshAsn(asn);
    if (res.success) loadIrrdb();
    else setError(res.error || 'Refresh failed.');
  };

  const copyConfig = async () => {
    if (!preview?.config) return;
    await navigator.clipboard.writeText(preview.config).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const deleteRs = async (rs: BirdRouteServerItem) => {
    if (!confirm(`Delete route server "${rs.name}"? Deployment history goes with it.`)) return;
    const res = await adminBirdApi.remove(rs._id);
    if (!res.success) setError(res.error || 'Delete failed.');
    else loadServers();
  };

  if (loading) return <Spinner label="Loading route server status…" />;

  return (
    <PanelShell
      title="Route Servers"
      subtitle="BIRD config generation, deployment & IRRDB cache"
      icon={Server}
      embedded={embedded}
      onBack={onBack}
      actions={
        <>
          <Btn icon={RefreshCw} size="sm" onClick={() => { loadStatus(); loadServers(); }} />
          <Btn icon={Upload} variant="primary" size="sm" onClick={deployAll}>
            Deploy all
          </Btn>
        </>
      }
    >
      {error && <Note tone="error" onDismiss={() => setError('')}>{error}</Note>}

      {/* Tab bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          ['status', 'Status board'],
          ['servers', 'Route servers'],
          ['irrdb', 'IRRDB cache'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`px-4 py-2 rounded font-mono text-[11px] uppercase tracking-wider transition-colors ${
              view === id ? 'bg-[#F20732] text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Status board ── */}
      {view === 'status' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile label="Route servers" value={totals.total} />
            <StatTile label="Ready" value={totals.ready} tone="green" />
            <StatTile label="In sync" value={totals.inSync} tone={totals.inSync < totals.ready ? 'amber' : 'green'} />
            <StatTile label="With warnings" value={totals.withWarnings} tone={totals.withWarnings ? 'amber' : undefined} />
          </div>

          {!statusRows.length ? (
            <EmptyState
              icon={Server}
              title="No route servers configured"
              hint="Add route servers under the 'Route servers' tab, assign them an infrastructure and VLAN, then deploy."
            />
          ) : (
            <div className="space-y-3">
              {statusRows.map((row) => (
                <Card key={row.id} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold">{row.name}</h3>
                        {row.ready ? (
                          row.inSync ? <Badge tone="green">in sync</Badge> : <Badge tone="amber">drift</Badge>
                        ) : (
                          <Badge tone="red">not ready</Badge>
                        )}
                        <Badge tone="gray">{row.family}</Badge>
                        <Badge tone="gray">{row.deployMethod}</Badge>
                      </div>
                      <p className="font-mono text-[11px] text-gray-500 mt-0.5">
                        {row.infrastructure || '—'} · {row.vlan || '—'} · last deploy {fmtRelative(row.lastDeployedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {row.ready && (
                        <>
                          <Btn icon={FileCode} size="sm" onClick={() => { setView('config'); loadPreview(row.id); }}>
                            Config
                          </Btn>
                          <Btn icon={Upload} variant="primary" size="sm" onClick={() => deployOne(row.id)}>
                            Deploy
                          </Btn>
                        </>
                      )}
                    </div>
                  </div>

                  {row.ready && row.stats && (
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-3 font-mono text-[11px]">
                      <span className="text-gray-400">{row.peerCount} peers</span>
                      <span className="text-gray-400">{row.stats.v4Sessions} v4</span>
                      <span className="text-gray-400">{row.stats.v6Sessions} v6</span>
                      <span className="text-green-500">{row.stats.irrdbFiltered} IRRDB</span>
                      <span className="text-green-500">{row.stats.rpkiFiltered} RPKI</span>
                      {row.stats.irrdbMissing > 0 && (
                        <span className="text-amber-500">{row.stats.irrdbMissing} missing prefixes</span>
                      )}
                    </div>
                  )}

                  {row.error && <Note tone="error">{row.error}</Note>}
                  {row.warnings && row.warnings.length > 0 && (
                    <div className="mt-2">
                      <WarningList warnings={row.warnings} max={2} />
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Route servers CRUD ── */}
      {view === 'servers' && (
        <>
          <Card>
            <CardHeader
              title="Route servers"
              hint="Each entry is one BIRD daemon on one host. Assign it to an infrastructure + peering VLAN, then it can generate config."
              actions={
                <Btn icon={Plus} variant="primary" size="sm" onClick={() => setCreatingRs(true)}>
                  Add route server
                </Btn>
              }
            />
            {!servers.length ? (
              <div className="p-4">
                <EmptyState icon={Server} title="No route servers" />
              </div>
            ) : (
              <Table head={['Name', 'Infrastructure', 'VLAN', 'Family', 'Deploy', 'Last deployed', '']}>
                {servers.map((rs) => (
                  <tr key={rs._id} className="hover:bg-gray-700/20">
                    <Td>
                      <div className="font-bold">{rs.name}</div>
                      <div className="font-mono text-[11px] text-gray-500">
                        {rs.group || '—'} · AS{rs.asn || '?'} · {rs.software}
                      </div>
                    </Td>
                    <Td className="text-xs">{rs.infrastructure?.name || '—'}</Td>
                    <Td className="text-xs">{rs.vlan?.name || '—'}</Td>
                    <Td><Badge tone="blue">{rs.family}</Badge></Td>
                    <Td><Badge tone="gray">{rs.deployMethod}</Badge></Td>
                    <Td className="font-mono text-xs text-gray-400">{fmtRelative(rs.lastDeployedAt)}</Td>
                    <Td>
                      <div className="flex items-center gap-1 justify-end">
                        <Btn icon={Wifi} size="sm" onClick={() => testConn(rs._id)} title="Test connection" />
                        <Btn icon={Pencil} size="sm" onClick={() => setEditingRs(rs)} title="Edit" />
                        <Btn icon={FileCode} size="sm" onClick={() => { setView('config'); loadPreview(rs._id); }} title="Preview config" />
                        <Btn icon={Upload} size="sm" onClick={() => deployOne(rs._id)} title="Deploy" />
                        <Btn icon={RotateCcw} size="sm" onClick={() => { setView('history'); loadHistory(rs._id); }} title="History" />
                        <Btn icon={Trash2} variant="danger" size="sm" onClick={() => deleteRs(rs)} title="Delete" />
                      </div>
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </>
      )}

      {/* ── IRRDB cache ── */}
      {view === 'irrdb' && (
        <>
          {!bgpq4Ok && (
            <Note tone="error">
              bgpq4 is not available on the backend host: {bgpq4Error}. IRRDB filtering cannot work without it.
            </Note>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Btn icon={RefreshCw} variant="primary" size="sm" onClick={irrdbRefreshAll}>
              Refresh stale entries
            </Btn>
            <span className="font-mono text-[11px] text-gray-500">
              {irrdbRows.length} peers with IRRDB filtering ·{' '}
              <span className="text-amber-500">{irrdbRows.filter((r) => r.neverExpanded).length} never expanded</span> ·{' '}
              <span className="text-amber-500">{irrdbRows.filter((r) => r.stale).length} stale</span>
            </span>
          </div>

          {!irrdbRows.length ? (
            <EmptyState icon={Database} title="No peers have IRRDB filtering enabled" hint="Enable it on a peer's policy to start tracking their as-set." />
          ) : (
            <Card>
              <Table head={['ASN', 'as-set', 'IPv4 prefixes', 'IPv6 prefixes', 'Last refresh', 'Status', '']}>
                {irrdbRows.map((r) => (
                  <tr key={r.asn} className="hover:bg-gray-700/20">
                    <Td className="font-mono text-xs font-bold">AS{r.asn}</Td>
                    <Td className="font-mono text-xs text-gray-400">{r.asMacro || `AS${r.asn}`}</Td>
                    <Td className="font-mono text-xs">{fmtNumber(r.v4Prefixes)}</Td>
                    <Td className="font-mono text-xs">{fmtNumber(r.v6Prefixes)}</Td>
                    <Td className="font-mono text-xs text-gray-400">
                      {r.v4RefreshedAt ? fmtRelative(r.v4RefreshedAt) : 'never'}
                    </Td>
                    <Td>
                      {r.neverExpanded ? (
                        <Badge tone="red">never expanded</Badge>
                      ) : r.stale ? (
                        <Badge tone="amber">stale</Badge>
                      ) : r.lastError ? (
                        <Badge tone="amber">error</Badge>
                      ) : (
                        <Badge tone="green">fresh</Badge>
                      )}
                    </Td>
                    <Td>
                      <Btn icon={RefreshCw} size="sm" onClick={() => irrdbRefreshOne(r.asn)} title="Refresh now" />
                    </Td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}
        </>
      )}

      {/* ── Config preview ── */}
      {view === 'config' && (
        <>
          {!preview ? (
            <Spinner label="Generating config…" />
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatTile label="Peers" value={preview.stats.totalPeers} />
                <StatTile label="IPv4 sessions" value={preview.stats.v4Sessions} />
                <StatTile label="IPv6 sessions" value={preview.stats.v6Sessions} />
                <StatTile label="IRRDB filtered" value={preview.stats.irrdbFiltered} tone="green" />
                <StatTile
                  label="Deployed"
                  value={preview.matchesDeployed ? 'in sync' : 'drifted'}
                  tone={preview.matchesDeployed ? 'green' : 'amber'}
                />
              </div>

              <WarningList warnings={preview.warnings} />

              <Card>
                <CardHeader
                  title={`bird.conf — ${preview.routeServer.name}`}
                  hint={`${preview.secretsRedacted ? 'Secrets redacted' : 'Secrets visible'} · hash ${preview.configHash.slice(0, 12)}…`}
                  actions={
                    <>
                      <Btn icon={copied ? Check : Copy} size="sm" onClick={copyConfig}>
                        {copied ? 'Copied' : 'Copy'}
                      </Btn>
                      <Btn icon={Upload} variant="primary" size="sm" onClick={() => deployOne(previewRs)}>
                        Deploy now
                      </Btn>
                    </>
                  }
                />
                <pre className="p-4 text-xs text-gray-300 overflow-x-auto max-h-[60vh] whitespace-pre-wrap font-mono leading-relaxed">
                  {preview.config}
                </pre>
              </Card>
            </>
          )}
          <Btn onClick={() => setView('status')}>← Back to status</Btn>
        </>
      )}

      {/* ── Deployment history ── */}
      {view === 'history' && (
        <>
          <Card>
            <CardHeader title="Deployment history" hint={`Route server: ${servers.find((s) => s._id === historyRs)?.name || historyRs}`} />
            {!history.length ? (
              <div className="p-4"><EmptyState title="No deployments yet" /></div>
            ) : (
              <Table head={['Time', 'Result', 'Peers', 'Method', 'Actor', 'Duration', '']}>
                {history.map((d) => (
                  <tr key={d._id} className="hover:bg-gray-700/20">
                    <Td className="font-mono text-xs text-gray-400">{fmtDate(d.createdAt)}</Td>
                    <Td>
                      <Badge tone={d.result === 'success' ? 'green' : d.result === 'rolled-back' ? 'blue' : 'red'}>
                        {d.result}
                      </Badge>
                    </Td>
                    <Td className="font-mono text-xs">{d.peerCount}</Td>
                    <Td className="font-mono text-xs text-gray-400">{d.method}</Td>
                    <Td className="text-xs text-gray-400">{d.actor || 'system'}</Td>
                    <Td className="font-mono text-xs text-gray-400">{d.durationMs ? `${(d.durationMs / 1000).toFixed(1)}s` : '—'}</Td>
                    <Td>
                      <Btn icon={RotateCcw} variant="danger" size="sm" onClick={() => rollback(d._id)} title="Rollback to the config BEFORE this deploy" />
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
          <Btn onClick={() => setView('status')}>← Back to status</Btn>
        </>
      )}

      {/* Deploy result modal */}
      {deployResult && (
        <Modal
          title={deployResult.applied ? 'Deployed successfully' : deployResult.skipped ? 'Skipped' : 'Deploy failed'}
          onClose={() => setDeployResult(null)}
          footer={<Btn variant="primary" onClick={() => setDeployResult(null)}>OK</Btn>}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile label="Applied" value={deployResult.applied ? 'yes' : 'no'} tone={deployResult.applied ? 'green' : 'gray'} />
            <StatTile label="Peers" value={deployResult.peerCount} />
            <StatTile label="Duration" value={`${(deployResult.durationMs / 1000).toFixed(1)}s`} />
            <StatTile label="Hash" value={deployResult.configHash.slice(0, 10) + '…'} />
          </div>
          {deployResult.error && <Note tone="error">{deployResult.error}</Note>}
          {deployResult.reason && <Note tone="info">{deployResult.reason}</Note>}
          <WarningList warnings={deployResult.warnings} />
          {deployResult.output && (
            <pre className="bg-gray-900 border border-gray-700 rounded p-3 text-xs text-gray-400 max-h-48 overflow-y-auto whitespace-pre-wrap">
              {deployResult.output}
            </pre>
          )}
        </Modal>
      )}

      {/* Route server add/edit form */}
      {(creatingRs || editingRs) && (
        <RouteServerForm
          row={editingRs || undefined}
          infras={infras}
          onClose={() => { setCreatingRs(false); setEditingRs(null); }}
          onSaved={() => { setCreatingRs(false); setEditingRs(null); loadServers(); loadStatus(); }}
        />
      )}
    </PanelShell>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Route Server Add/Edit Form
// ══════════════════════════════════════════════════════════════════════════════

const RouteServerForm: React.FC<{
  row?: BirdRouteServerItem;
  infras: InfrastructureItem[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ row, infras, onClose, onSaved }) => {
  const [vlans, setVlans] = useState<Array<{ _id: string; name: string; number: number }>>([]);

  const [form, setForm] = useState({
    // Identity + Alice-LG
    name: row?.name || '',
    group: row?.group || '',
    location: row?.location || '',
    apiUrl: row?.apiUrl || '',
    backend: row?.backend || 'birdwatcher',
    birdwatcherType: row?.birdwatcherType || 'multi_table',
    enabled: row?.enabled ?? true,
    order: String(row?.order ?? 0),

    // BGP
    infrastructure: row?.infrastructure?._id || row?.infrastructure || '',
    vlan: row?.vlan?._id || row?.vlan || '',
    family: row?.family || 'dual',
    asn: row?.asn ? String(row.asn) : '',
    routerId: row?.routerId || '',
    ipv4: row?.ipv4 || '',
    ipv6: row?.ipv6 || '',
    peerGroup: row?.peerGroup || '',
    software: row?.software || 'bird2',

    // Filtering
    rpkiEnabled: row?.rpkiEnabled ?? false,
    rtrServer: row?.rtrServer || '',
    rtrPort: String(row?.rtrPort ?? 3323),
    irrdbFailOpen: row?.irrdbFailOpen ?? false,
    blackholeEnabled: row?.blackholeEnabled ?? true,
    blackholeNextHopV4: row?.blackholeNextHopV4 || '',
    blackholeNextHopV6: row?.blackholeNextHopV6 || '',
    maxPrefixLengthV4: String(row?.maxPrefixLengthV4 ?? 24),
    minPrefixLengthV4: String(row?.minPrefixLengthV4 ?? 8),
    maxPrefixLengthV6: String(row?.maxPrefixLengthV6 ?? 48),
    minPrefixLengthV6: String(row?.minPrefixLengthV6 ?? 16),
    defaultMaxPrefixesV4: String(row?.defaultMaxPrefixesV4 ?? 200000),
    defaultMaxPrefixesV6: String(row?.defaultMaxPrefixesV6 ?? 50000),
    configExtras: row?.configExtras || '',
    configHeaderExtras: row?.configHeaderExtras || '',

    // Deploy transport (super-admin only)
    deployMethod: row?.deployMethod || 'manual',
    configPath: row?.configPath || '',
    birdSocket: row?.birdSocket || '/run/bird/bird.ctl',
    reloadStrategy: row?.reloadStrategy || 'birdc',
    systemdUnit: row?.systemdUnit || 'bird',
    useSudo: row?.useSudo ?? false,
    sshHost: row?.sshHost || '',
    sshPort: String(row?.sshPort ?? 22),
    sshUser: row?.sshUser || '',
    sshKeyPath: row?.sshKeyPath || '',
    agentUrl: row?.agentUrl || '',
    agentToken: '',
  });

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'identity' | 'bgp' | 'filtering' | 'deploy'>('identity');

  // Load VLANs for selected infrastructure
  useEffect(() => {
    if (!form.infrastructure) { setVlans([]); return; }
    (async () => {
      const { adminVlansApi } = await import('../services/api');
      const res = await adminVlansApi.list(form.infrastructure);
      if (res.success && res.data) setVlans(res.data.map((v: any) => ({ _id: v._id, name: v.name, number: v.number })));
    })();
  }, [form.infrastructure]);

  const save = async () => {
    setErr('');
    const payload: any = {
      name: form.name.trim(),
      group: form.group.trim(),
      location: form.location.trim(),
      apiUrl: form.apiUrl.trim(),
      backend: form.backend,
      birdwatcherType: form.birdwatcherType,
      enabled: form.enabled,
      order: Number(form.order) || 0,
      infrastructure: form.infrastructure || undefined,
      vlan: form.vlan || undefined,
      family: form.family,
      routerId: form.routerId.trim(),
      ipv4: form.ipv4.trim(),
      ipv6: form.ipv6.trim(),
      peerGroup: form.peerGroup.trim(),
      software: form.software,
      rpkiEnabled: form.rpkiEnabled,
      rtrServer: form.rtrServer.trim(),
      rtrPort: Number(form.rtrPort) || 3323,
      irrdbFailOpen: form.irrdbFailOpen,
      blackholeEnabled: form.blackholeEnabled,
      blackholeNextHopV4: form.blackholeNextHopV4.trim(),
      blackholeNextHopV6: form.blackholeNextHopV6.trim(),
      maxPrefixLengthV4: Number(form.maxPrefixLengthV4) || 24,
      minPrefixLengthV4: Number(form.minPrefixLengthV4) || 8,
      maxPrefixLengthV6: Number(form.maxPrefixLengthV6) || 48,
      minPrefixLengthV6: Number(form.minPrefixLengthV6) || 16,
      defaultMaxPrefixesV4: Number(form.defaultMaxPrefixesV4) || 200000,
      defaultMaxPrefixesV6: Number(form.defaultMaxPrefixesV6) || 50000,
      configExtras: form.configExtras,
      configHeaderExtras: form.configHeaderExtras,
      // Deploy transport fields
      deployMethod: form.deployMethod,
      configPath: form.configPath.trim(),
      birdSocket: form.birdSocket.trim(),
      reloadStrategy: form.reloadStrategy,
      systemdUnit: form.systemdUnit.trim(),
      useSudo: form.useSudo,
      sshHost: form.sshHost.trim(),
      sshPort: Number(form.sshPort) || 22,
      sshUser: form.sshUser.trim(),
      sshKeyPath: form.sshKeyPath.trim(),
      agentUrl: form.agentUrl.trim(),
    };
    if (form.asn) payload.asn = Number(form.asn);
    if (form.agentToken) payload.agentToken = form.agentToken;

    setBusy(true);
    const res = row
      ? await adminBirdApi.update(row._id, payload)
      : await adminBirdApi.create(payload);
    setBusy(false);
    if (res.success) onSaved();
    else setErr(res.error || 'Save failed.');
  };

  const tabs = [
    { id: 'identity', label: 'Identity' },
    { id: 'bgp', label: 'BGP' },
    { id: 'filtering', label: 'Filtering' },
    { id: 'deploy', label: 'Deploy transport' },
  ] as const;

  return (
    <Modal
      title={row ? `Edit ${row.name}` : 'New route server'}
      hint="One entry = one BIRD daemon on one host. Each location should have rs1 + rs2 for redundancy."
      onClose={onClose}
      wide
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" busy={busy} onClick={save}>{row ? 'Save changes' : 'Create'}</Btn>
        </>
      }
    >
      {err && <Note tone="error">{err}</Note>}

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-gray-700 pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded font-mono text-[10px] uppercase tracking-wider transition-colors ${
              tab === t.id ? 'bg-[#F20732] text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Identity tab ── */}
      {tab === 'identity' && (
        <div className="space-y-4">
          <Grid>
            <Fld label="Name" hint="Display name in the looking glass, e.g. rs1.mumbai (IPv4)">
              <input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="rs1.mumbai" />
            </Fld>
            <Fld label="Group" hint="Alice-LG group label, e.g. Mumbai">
              <input className={field} value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} placeholder="Mumbai" />
            </Fld>
            <Fld label="Location slug">
              <input className={field} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </Fld>
            <Fld label="Order" hint="Lower = shown first">
              <input className={field} value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} />
            </Fld>
          </Grid>
          <div className="border-t border-gray-700 pt-4">
            <p className="font-mono text-[11px] uppercase tracking-wider text-gray-400 mb-3">Looking Glass (Alice-LG source)</p>
            <Grid>
              <Fld label="API URL" hint="Birdwatcher or GoBGP API endpoint on this host">
                <input className={field} value={form.apiUrl} onChange={(e) => setForm({ ...form, apiUrl: e.target.value })} placeholder="http://rs1.mumbai:29184/" />
              </Fld>
              <Fld label="Backend">
                <select className={field} value={form.backend} onChange={(e) => setForm({ ...form, backend: e.target.value as any })}>
                  <option value="birdwatcher">birdwatcher (BIRD)</option>
                  <option value="gobgp">gobgp</option>
                </select>
              </Fld>
              {form.backend === 'birdwatcher' && (
                <Fld label="Birdwatcher type">
                  <select className={field} value={form.birdwatcherType} onChange={(e) => setForm({ ...form, birdwatcherType: e.target.value })}>
                    <option value="multi_table">multi_table</option>
                    <option value="single_table">single_table</option>
                  </select>
                </Fld>
              )}
            </Grid>
          </div>
          <Toggle checked={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} label="Enabled" hint="Disabled route servers are excluded from the status board and deploy-all." />
        </div>
      )}

      {/* ── BGP tab ── */}
      {tab === 'bgp' && (
        <div className="space-y-4">
          <Grid>
            <Fld label="Infrastructure" hint="Which IXP fabric this RS serves">
              <select className={field} value={form.infrastructure} onChange={(e) => setForm({ ...form, infrastructure: e.target.value, vlan: '' })}>
                <option value="">Not assigned</option>
                {infras.map((i) => <option key={i._id} value={i._id}>{i.name} (AS{i.asn})</option>)}
              </select>
            </Fld>
            <Fld label="Peering VLAN" hint="The VLAN whose peers become BGP sessions in the config">
              <select className={field} value={form.vlan} onChange={(e) => setForm({ ...form, vlan: e.target.value })}>
                <option value="">Not assigned</option>
                {vlans.map((v) => <option key={v._id} value={v._id}>{v.name} (VLAN {v.number})</option>)}
              </select>
            </Fld>
            <Fld label="Address family">
              <select className={field} value={form.family} onChange={(e) => setForm({ ...form, family: e.target.value as any })}>
                <option value="dual">Dual-stack (BIRD 2 default)</option>
                <option value="ipv4">IPv4 only</option>
                <option value="ipv6">IPv6 only</option>
              </select>
            </Fld>
            <Fld label="Software">
              <select className={field} value={form.software} onChange={(e) => setForm({ ...form, software: e.target.value as any })}>
                <option value="bird2">BIRD 2.x</option>
                <option value="bird3">BIRD 3.x</option>
              </select>
            </Fld>
            <Fld label="Local ASN" hint="Overrides the infrastructure ASN if set">
              <input className={field} value={form.asn} onChange={(e) => setForm({ ...form, asn: e.target.value })} placeholder="Use infra ASN" />
            </Fld>
            <Fld label="Router ID" hint="An IPv4 literal, even for IPv6-only daemons">
              <input className={field} value={form.routerId} onChange={(e) => setForm({ ...form, routerId: e.target.value })} placeholder="103.139.191.1" />
            </Fld>
            <Fld label="RS IPv4 address" hint="The RS's own address on the peering LAN">
              <input className={field} value={form.ipv4} onChange={(e) => setForm({ ...form, ipv4: e.target.value })} />
            </Fld>
            <Fld label="RS IPv6 address">
              <input className={field} value={form.ipv6} onChange={(e) => setForm({ ...form, ipv6: e.target.value })} />
            </Fld>
            <Fld label="Peer group" hint="e.g. 'rs1' — groups daemons on the same host for batch deploy">
              <input className={field} value={form.peerGroup} onChange={(e) => setForm({ ...form, peerGroup: e.target.value })} />
            </Fld>
          </Grid>
        </div>
      )}

      {/* ── Filtering tab ── */}
      {tab === 'filtering' && (
        <div className="space-y-4">
          <div className="space-y-3">
            <Toggle checked={form.rpkiEnabled} onChange={(v) => setForm({ ...form, rpkiEnabled: v })} label="RPKI / RTR validation" hint="Rejects RPKI-invalid routes. Requires an RTR server." />
            {form.rpkiEnabled && (
              <Grid>
                <Fld label="RTR server" hint="RPKI validator address (routinator, gortr, etc.)">
                  <input className={field} value={form.rtrServer} onChange={(e) => setForm({ ...form, rtrServer: e.target.value })} placeholder="127.0.0.1" />
                </Fld>
                <Fld label="RTR port">
                  <input className={field} value={form.rtrPort} onChange={(e) => setForm({ ...form, rtrPort: e.target.value })} />
                </Fld>
              </Grid>
            )}
            <Toggle checked={form.irrdbFailOpen} onChange={(v) => setForm({ ...form, irrdbFailOpen: v })} label="IRRDB fail-open" hint="When the IRRDB cache is empty for a peer: false = reject everything (safe), true = skip the check (risky but avoids black-holing a member whose as-set expansion broke)." />
          </div>

          <div className="border-t border-gray-700 pt-4 space-y-3">
            <Toggle checked={form.blackholeEnabled} onChange={(v) => setForm({ ...form, blackholeEnabled: v })} label="RFC 7999 blackholing" hint="Members can ask us to discard traffic to their own /32 or /128." />
            {form.blackholeEnabled && (
              <Grid>
                <Fld label="Blackhole next-hop IPv4" hint="Discard target for v4 blackhole routes">
                  <input className={field} value={form.blackholeNextHopV4} onChange={(e) => setForm({ ...form, blackholeNextHopV4: e.target.value })} placeholder="198.51.100.1" />
                </Fld>
                <Fld label="Blackhole next-hop IPv6">
                  <input className={field} value={form.blackholeNextHopV6} onChange={(e) => setForm({ ...form, blackholeNextHopV6: e.target.value })} placeholder="100::1" />
                </Fld>
              </Grid>
            )}
          </div>

          <div className="border-t border-gray-700 pt-4">
            <p className="font-mono text-[11px] uppercase tracking-wider text-gray-400 mb-3">Prefix length bounds</p>
            <Grid cols={4}>
              <Fld label="Min v4">
                <input className={field} value={form.minPrefixLengthV4} onChange={(e) => setForm({ ...form, minPrefixLengthV4: e.target.value })} />
              </Fld>
              <Fld label="Max v4">
                <input className={field} value={form.maxPrefixLengthV4} onChange={(e) => setForm({ ...form, maxPrefixLengthV4: e.target.value })} />
              </Fld>
              <Fld label="Min v6">
                <input className={field} value={form.minPrefixLengthV6} onChange={(e) => setForm({ ...form, minPrefixLengthV6: e.target.value })} />
              </Fld>
              <Fld label="Max v6">
                <input className={field} value={form.maxPrefixLengthV6} onChange={(e) => setForm({ ...form, maxPrefixLengthV6: e.target.value })} />
              </Fld>
            </Grid>
          </div>

          <div className="border-t border-gray-700 pt-4">
            <p className="font-mono text-[11px] uppercase tracking-wider text-gray-400 mb-3">Default max-prefix limits</p>
            <p className="text-xs text-gray-500 mb-3">Used when a peer has no explicit override and no PeeringDB figure.</p>
            <Grid>
              <Fld label="IPv4 default">
                <input className={field} value={form.defaultMaxPrefixesV4} onChange={(e) => setForm({ ...form, defaultMaxPrefixesV4: e.target.value })} />
              </Fld>
              <Fld label="IPv6 default">
                <input className={field} value={form.defaultMaxPrefixesV6} onChange={(e) => setForm({ ...form, defaultMaxPrefixesV6: e.target.value })} />
              </Fld>
            </Grid>
          </div>

          <div className="border-t border-gray-700 pt-4">
            <Fld label="Config header extras" hint="Injected before the generated content (logging, timeformat overrides).">
              <textarea className={`${field} h-20 font-mono text-xs`} value={form.configHeaderExtras} onChange={(e) => setForm({ ...form, configHeaderExtras: e.target.value })} />
            </Fld>
            <div className="mt-3">
              <Fld label="Config footer extras" hint="Appended at the end of the generated config. Use for anything not modelled.">
                <textarea className={`${field} h-20 font-mono text-xs`} value={form.configExtras} onChange={(e) => setForm({ ...form, configExtras: e.target.value })} />
              </Fld>
            </div>
          </div>
        </div>
      )}

      {/* ── Deploy transport tab (super-admin decisions) ── */}
      {tab === 'deploy' && (
        <div className="space-y-4">
          <Note tone="warning">
            These settings determine what the backend executes and on which host. Only super-admins can change them. If you're a NOC operator, ask your super-admin to set these up.
          </Note>

          <Grid>
            <Fld label="Deploy method" hint="How generated config reaches the BIRD daemon">
              <select className={field} value={form.deployMethod} onChange={(e) => setForm({ ...form, deployMethod: e.target.value as any })}>
                <option value="manual">Manual (generate only, copy by hand)</option>
                <option value="local">Local (BIRD on the same host as this backend)</option>
                <option value="ssh">SSH (push over OpenSSH — normal production choice)</option>
                <option value="agent">Agent (HTTPS service on the BIRD host)</option>
              </select>
            </Fld>
            <Fld label="Config file path" hint="Where bird.conf is written on the target host">
              <input className={field} value={form.configPath} onChange={(e) => setForm({ ...form, configPath: e.target.value })} placeholder="/etc/bird/bird.conf" />
            </Fld>
          </Grid>

          <div className="border-t border-gray-700 pt-4">
            <p className="font-mono text-[11px] uppercase tracking-wider text-gray-400 mb-3">Validate & reload</p>
            <Grid>
              <Fld label="BIRD control socket">
                <input className={field} value={form.birdSocket} onChange={(e) => setForm({ ...form, birdSocket: e.target.value })} placeholder="/run/bird/bird.ctl" />
              </Fld>
              <Fld label="Reload strategy">
                <select className={field} value={form.reloadStrategy} onChange={(e) => setForm({ ...form, reloadStrategy: e.target.value as any })}>
                  <option value="birdc">birdc configure (preferred)</option>
                  <option value="systemctl">systemctl reload</option>
                </select>
              </Fld>
              {form.reloadStrategy === 'systemctl' && (
                <Fld label="systemd unit name">
                  <input className={field} value={form.systemdUnit} onChange={(e) => setForm({ ...form, systemdUnit: e.target.value })} placeholder="bird" />
                </Fld>
              )}
              <Fld label="Use sudo">
                <div className="pt-1">
                  <Toggle checked={form.useSudo} onChange={(v) => setForm({ ...form, useSudo: v })} label="Prefix commands with sudo -n" />
                </div>
              </Fld>
            </Grid>
          </div>

          {form.deployMethod === 'ssh' && (
            <div className="border-t border-gray-700 pt-4">
              <p className="font-mono text-[11px] uppercase tracking-wider text-gray-400 mb-3">SSH transport</p>
              <Grid>
                <Fld label="SSH host">
                  <input className={field} value={form.sshHost} onChange={(e) => setForm({ ...form, sshHost: e.target.value })} placeholder="rs1.mumbai.mx-ix.net" />
                </Fld>
                <Fld label="SSH port">
                  <input className={field} value={form.sshPort} onChange={(e) => setForm({ ...form, sshPort: e.target.value })} />
                </Fld>
                <Fld label="SSH user" hint="Key-based auth only. No passwords.">
                  <input className={field} value={form.sshUser} onChange={(e) => setForm({ ...form, sshUser: e.target.value })} placeholder="mxix" />
                </Fld>
                <Fld label="SSH key path" hint="Absolute path on this backend host">
                  <input className={field} value={form.sshKeyPath} onChange={(e) => setForm({ ...form, sshKeyPath: e.target.value })} placeholder="/home/mxix/.ssh/id_ed25519" />
                </Fld>
              </Grid>
            </div>
          )}

          {form.deployMethod === 'agent' && (
            <div className="border-t border-gray-700 pt-4">
              <p className="font-mono text-[11px] uppercase tracking-wider text-gray-400 mb-3">HTTP agent transport</p>
              <Grid>
                <Fld label="Agent URL" hint="Must be HTTPS (the config carries BGP passwords)">
                  <input className={field} value={form.agentUrl} onChange={(e) => setForm({ ...form, agentUrl: e.target.value })} placeholder="https://rs1.mumbai:8443/deploy" />
                </Fld>
                <Fld label="Bearer token" hint="Write-only. Leave blank to keep the current token.">
                  <input className={field} type="password" value={form.agentToken} onChange={(e) => setForm({ ...form, agentToken: e.target.value })} placeholder="unchanged" />
                </Fld>
              </Grid>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default BirdAdminPanel;
