import React, { useCallback, useEffect, useState } from 'react';
import { GitBranch, Plus, Pencil, Trash2, RefreshCw, Zap, Link2 } from 'lucide-react';
import {
  adminCoreBundlesApi,
  adminFabricApi,
  CoreBundleItem,
  CoreLinkItem,
  CapacitySummaryRow,
  InfrastructureItem,
  DeviceItem,
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
  Spinner,
  EmptyState,
  field,
  fmtSpeed,
  fmtNumber,
  Tone,
} from './admin/ui';

interface Props {
  embedded?: boolean;
  onBack?: () => void;
}

const STATE_TONE: Record<string, Tone> = {
  up: 'green',
  down: 'red',
  maintenance: 'amber',
  planned: 'gray',
  decommissioned: 'gray',
};

/**
 * Core bundles — inter-switch links (ISLs / trunks).
 *
 * Shows fabric backbone capacity at a glance: how many strands per trunk,
 * which are active, total throughput. Essential for upgrade planning.
 */
const CoreBundlesAdminPanel: React.FC<Props> = ({ embedded, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bundles, setBundles] = useState<CoreBundleItem[]>([]);
  const [capacity, setCapacity] = useState<CapacitySummaryRow[]>([]);
  const [infras, setInfras] = useState<InfrastructureItem[]>([]);
  const [devices, setDevices] = useState<DeviceItem[]>([]);

  const [selected, setSelected] = useState<CoreBundleItem | null>(null);
  const [links, setLinks] = useState<CoreLinkItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CoreBundleItem | null>(null);
  const [addingLink, setAddingLink] = useState(false);

  const load = useCallback(async () => {
    const [bRes, cRes, iRes, dRes] = await Promise.all([
      adminCoreBundlesApi.list(),
      adminCoreBundlesApi.capacity(),
      adminFabricApi.listInfrastructures(),
      adminFabricApi.listDevices({ deviceType: 'switch' }),
    ]);
    if (bRes.success && bRes.data) setBundles(bRes.data);
    else setError(bRes.error || 'Could not load bundles.');
    if (cRes.success && cRes.data) setCapacity(cRes.data);
    if (iRes.success && iRes.data) setInfras(iRes.data);
    if (dRes.success && dRes.data) setDevices(dRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadLinks = useCallback(async (bundleId: string) => {
    const res = await adminCoreBundlesApi.listLinks(bundleId);
    if (res.success && res.data) setLinks(res.data);
  }, []);

  useEffect(() => {
    if (selected) loadLinks(selected._id);
  }, [selected, loadLinks]);

  const removeBundle = async (b: CoreBundleItem) => {
    if (!confirm(`Delete bundle "${b.name}"?`)) return;
    const res = await adminCoreBundlesApi.remove(b._id);
    if (!res.success) setError(res.error || 'Delete failed.');
    else { setSelected(null); load(); }
  };

  const removeLink = async (l: CoreLinkItem) => {
    if (!confirm('Remove this link? The switch ports will be freed.')) return;
    if (!selected) return;
    const res = await adminCoreBundlesApi.deleteLink(selected._id, l._id);
    if (!res.success) setError(res.error || 'Delete failed.');
    else loadLinks(selected._id);
  };

  if (loading) return <Spinner label="Loading core bundles…" />;

  const totalCap = capacity.reduce((n, r) => n + r.enabledCapacityGbps, 0);

  return (
    <PanelShell
      title="Core Links"
      subtitle="Inter-switch trunks & fabric backbone capacity"
      icon={GitBranch}
      embedded={embedded}
      onBack={onBack}
      actions={
        <>
          <Btn icon={RefreshCw} size="sm" onClick={load} />
          <Btn icon={Plus} variant="primary" size="sm" onClick={() => setCreating(true)}>Add bundle</Btn>
        </>
      }
    >
      {error && <Note tone="error" onDismiss={() => setError('')}>{error}</Note>}

      {/* Capacity summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Total backbone" value={`${totalCap}G`} tone="blue" />
        <StatTile label="Bundles" value={bundles.length} />
        <StatTile label="Links" value={bundles.reduce((n, b) => n + (b.links || 0), 0)} />
        <StatTile label="Infrastructures" value={capacity.length} />
      </div>

      {capacity.length > 0 && (
        <Card>
          <CardHeader title="Capacity per infrastructure" hint="Total backbone throughput from inter-switch trunks" />
          <Table head={['Infrastructure', 'Links', 'Total capacity', 'Active capacity', 'Redundancy']}>
            {capacity.map((r, i) => (
              <tr key={i}>
                <Td className="font-bold text-sm">{r.infrastructure.name}</Td>
                <Td className="font-mono text-xs">{r.enabledLinks}/{r.totalLinks}</Td>
                <Td className="font-mono text-xs">{r.totalCapacityGbps}G</Td>
                <Td className="font-mono text-xs text-green-500">{r.enabledCapacityGbps}G</Td>
                <Td><Badge tone={r.enabledLinks >= 2 ? 'green' : 'red'}>{r.redundancy}</Badge></Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {/* Bundle list + link detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader title="Bundles" />
          {!bundles.length ? (
            <div className="p-4"><EmptyState icon={GitBranch} title="No core bundles" hint="Add a trunk between two of your switches." /></div>
          ) : (
            <div className="divide-y divide-gray-700/60 max-h-[55vh] overflow-y-auto">
              {bundles.map((b) => (
                <button
                  key={b._id}
                  onClick={() => setSelected(b)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-700/30 transition-colors ${
                    selected?._id === b._id ? 'bg-[#F20732]/10 border-l-2 border-[#F20732]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">{b.name}</div>
                      <div className="font-mono text-[11px] text-gray-500">
                        {b.switchA?.name || '?'} ↔ {b.switchB?.name || '?'} · {b.type}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Badge tone={STATE_TONE[b.state] || 'gray'}>{b.state}</Badge>
                      {b.enabledCapacityMbps ? (
                        <Badge tone="blue">{fmtSpeed(b.enabledCapacityMbps)}</Badge>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2">
          {!selected ? (
            <div className="p-8"><EmptyState icon={Link2} title="Select a bundle" hint="Click a bundle to see its individual links (strands)." /></div>
          ) : (
            <>
              <CardHeader
                title={selected.name}
                hint={`${selected.switchA?.name || '?'} ↔ ${selected.switchB?.name || '?'} · ${selected.type} · ${selected.links || 0} link(s)`}
                actions={
                  <>
                    <Btn icon={Plus} size="sm" onClick={() => setAddingLink(true)}>Add link</Btn>
                    <Btn icon={Pencil} size="sm" onClick={() => setEditing(selected)} title="Edit bundle" />
                    <Btn icon={Trash2} variant="danger" size="sm" onClick={() => removeBundle(selected)} title="Delete" />
                  </>
                }
              />
              <div className="grid grid-cols-3 gap-3 p-4 border-b border-gray-700">
                <StatTile label="Total" value={fmtSpeed(selected.totalCapacityMbps)} />
                <StatTile label="Active" value={fmtSpeed(selected.enabledCapacityMbps)} tone="green" />
                <StatTile label="State" value={selected.state} tone={STATE_TONE[selected.state]} />
              </div>

              {!links.length ? (
                <div className="p-4"><EmptyState icon={Link2} title="No links in this bundle" hint="A bundle needs at least one physical link between two switch ports." /></div>
              ) : (
                <Table head={['Port A', 'Port B', 'Speed', 'Enabled', 'BFD', '']} dense>
                  {links.map((l) => (
                    <tr key={l._id} className="hover:bg-gray-700/20">
                      <Td className="font-mono text-xs">{l.switchPortA?.name || '?'}</Td>
                      <Td className="font-mono text-xs">{l.switchPortB?.name || '?'}</Td>
                      <Td className="font-mono text-xs">{fmtSpeed(l.speed)}</Td>
                      <Td>{l.enabled ? <Badge tone="green">yes</Badge> : <Badge tone="gray">no</Badge>}</Td>
                      <Td>{l.bfdEnabled ? <Badge tone="blue">BFD</Badge> : '—'}</Td>
                      <Td>
                        <Btn icon={Trash2} variant="danger" size="sm" onClick={() => removeLink(l)} title="Remove link" />
                      </Td>
                    </tr>
                  ))}
                </Table>
              )}

              {selected.drained && <Note tone="warning">This bundle is DRAINED — traffic is being shifted away for maintenance.</Note>}
              {selected.notes && <div className="px-4 py-3 text-xs text-gray-400 border-t border-gray-700">{selected.notes}</div>}
            </>
          )}
        </Card>
      </div>

      {/* Create/Edit bundle modal */}
      {(creating || editing) && (
        <BundleForm
          row={editing || undefined}
          infras={infras}
          devices={devices}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); load(); }}
        />
      )}

      {/* Add link modal */}
      {addingLink && selected && (
        <AddLinkModal
          bundle={selected}
          devices={devices}
          onClose={() => setAddingLink(false)}
          onSaved={() => { setAddingLink(false); loadLinks(selected._id); load(); }}
        />
      )}
    </PanelShell>
  );
};

// ── Bundle form ──

const BundleForm: React.FC<{
  row?: CoreBundleItem;
  infras: InfrastructureItem[];
  devices: DeviceItem[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ row, infras, devices, onClose, onSaved }) => {
  const [form, setForm] = useState({
    infrastructure: row?.infrastructure?._id || row?.infrastructure || infras[0]?._id || '',
    name: row?.name || '',
    type: row?.type || 'lacp',
    switchA: row?.switchA?._id || row?.switchA || '',
    switchB: row?.switchB?._id || row?.switchB || '',
    bundleNameA: row?.bundleNameA || '',
    bundleNameB: row?.bundleNameB || '',
    state: row?.state || 'planned',
    enabled: row?.enabled ?? true,
    drained: row?.drained ?? false,
    notes: row?.notes || '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const infraDevices = devices.filter((d) =>
    String(d.infrastructure) === form.infrastructure || (d.infrastructure as any)?._id === form.infrastructure
  );

  const save = async () => {
    setErr('');
    const payload: any = {
      infrastructure: form.infrastructure,
      name: form.name.trim(),
      type: form.type,
      switchA: form.switchA,
      switchB: form.switchB,
      bundleNameA: form.bundleNameA.trim(),
      bundleNameB: form.bundleNameB.trim(),
      state: form.state,
      enabled: form.enabled,
      drained: form.drained,
      notes: form.notes,
    };
    setBusy(true);
    const res = row ? await adminCoreBundlesApi.update(row._id, payload) : await adminCoreBundlesApi.create(payload);
    setBusy(false);
    if (res.success) onSaved();
    else setErr(res.error || 'Save failed.');
  };

  return (
    <Modal
      title={row ? `Edit ${row.name}` : 'New core bundle'}
      hint="A trunk/ISL between two of your own switches. Add individual link strands after creating the bundle."
      onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" busy={busy} onClick={save}>{row ? 'Save' : 'Create'}</Btn></>}
    >
      {err && <Note tone="error">{err}</Note>}
      <Grid>
        <Fld label="Infrastructure">
          <select className={field} value={form.infrastructure} onChange={(e) => setForm({ ...form, infrastructure: e.target.value, switchA: '', switchB: '' })}>
            {infras.map((i) => <option key={i._id} value={i._id}>{i.name}</option>)}
          </select>
        </Fld>
        <Fld label="Bundle name" hint="e.g. MB2-SW01 ↔ LVSB-SW01">
          <input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Fld>
        <Fld label="Switch A">
          <select className={field} value={form.switchA} onChange={(e) => setForm({ ...form, switchA: e.target.value })}>
            <option value="">Select…</option>
            {infraDevices.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        </Fld>
        <Fld label="Switch B">
          <select className={field} value={form.switchB} onChange={(e) => setForm({ ...form, switchB: e.target.value })}>
            <option value="">Select…</option>
            {infraDevices.filter((d) => d._id !== form.switchA).map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        </Fld>
        <Fld label="Bundle type">
          <select className={field} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })}>
            <option value="lacp">LACP</option>
            <option value="ecmp">ECMP</option>
            <option value="l2-lag">L2 LAG (static)</option>
            <option value="l3-lag">L3 LAG</option>
          </select>
        </Fld>
        <Fld label="State">
          <select className={field} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value as any })}>
            <option value="planned">Planned</option>
            <option value="up">Up</option>
            <option value="down">Down</option>
            <option value="maintenance">Maintenance</option>
            <option value="decommissioned">Decommissioned</option>
          </select>
        </Fld>
        <Fld label="LAG name on A" hint="e.g. Eth-Trunk1">
          <input className={field} value={form.bundleNameA} onChange={(e) => setForm({ ...form, bundleNameA: e.target.value })} />
        </Fld>
        <Fld label="LAG name on B">
          <input className={field} value={form.bundleNameB} onChange={(e) => setForm({ ...form, bundleNameB: e.target.value })} />
        </Fld>
      </Grid>
      <Toggle checked={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} label="Enabled" />
      <Toggle checked={form.drained} onChange={(v) => setForm({ ...form, drained: v })} label="Drained" hint="Traffic is being shifted away — shows a warning in the UI." />
      <Fld label="Notes"><textarea className={`${field} h-20`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Fld>
    </Modal>
  );
};

// ── Add link modal ──

const AddLinkModal: React.FC<{
  bundle: CoreBundleItem;
  devices: DeviceItem[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ bundle, devices, onClose, onSaved }) => {
  const [portA, setPortA] = useState('');
  const [portB, setPortB] = useState('');
  const [speed, setSpeed] = useState('100000');
  const [bfd, setBfd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Load free core-type ports for each switch
  const [portsA, setPortsA] = useState<Array<{ _id: string; name: string }>>([]);
  const [portsB, setPortsB] = useState<Array<{ _id: string; name: string }>>([]);

  useEffect(() => {
    const swAId = bundle.switchA?._id || bundle.switchA;
    const swBId = bundle.switchB?._id || bundle.switchB;
    if (swAId) {
      adminFabricApi.getDevice(swAId).then((res) => {
        if (res.success && res.data) setPortsA(res.data.ports.filter((p: any) => p.status === 'free' && (p.type === 'core' || p.type === 'peering')));
      });
    }
    if (swBId) {
      adminFabricApi.getDevice(swBId).then((res) => {
        if (res.success && res.data) setPortsB(res.data.ports.filter((p: any) => p.status === 'free' && (p.type === 'core' || p.type === 'peering')));
      });
    }
  }, [bundle]);

  const save = async () => {
    setErr('');
    if (!portA || !portB) return setErr('Select a port on each side.');
    setBusy(true);
    const res = await adminCoreBundlesApi.createLink(bundle._id, {
      switchPortA: portA,
      switchPortB: portB,
      speed: Number(speed) || 100000,
      bfdEnabled: bfd,
      enabled: true,
    } as any);
    setBusy(false);
    if (res.success) onSaved();
    else setErr(res.error || 'Failed to add the link.');
  };

  return (
    <Modal
      title="Add link strand"
      hint={`${bundle.switchA?.name || '?'} ↔ ${bundle.switchB?.name || '?'}`}
      onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" icon={Link2} busy={busy} onClick={save}>Add link</Btn></>}
    >
      {err && <Note tone="error">{err}</Note>}
      <Grid>
        <Fld label={`Port on ${bundle.switchA?.name || 'Switch A'}`}>
          <select className={field} value={portA} onChange={(e) => setPortA(e.target.value)}>
            <option value="">Select free port…</option>
            {portsA.map((p: any) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </Fld>
        <Fld label={`Port on ${bundle.switchB?.name || 'Switch B'}`}>
          <select className={field} value={portB} onChange={(e) => setPortB(e.target.value)}>
            <option value="">Select free port…</option>
            {portsB.map((p: any) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </Fld>
        <Fld label="Speed (Mbit/s)">
          <select className={field} value={speed} onChange={(e) => setSpeed(e.target.value)}>
            <option value="10000">10G</option>
            <option value="25000">25G</option>
            <option value="40000">40G</option>
            <option value="100000">100G</option>
            <option value="400000">400G</option>
          </select>
        </Fld>
      </Grid>
      <Toggle checked={bfd} onChange={setBfd} label="BFD enabled" hint="Bidirectional Forwarding Detection on this strand." />
    </Modal>
  );
};

export default CoreBundlesAdminPanel;
