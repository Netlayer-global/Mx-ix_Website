import React, { useCallback, useEffect, useState } from 'react';
import { Layers, Plus, Pencil, Trash2, RefreshCw, Database, Lock, Unlock, Search } from 'lucide-react';
import {
  adminVlansApi,
  adminFabricApi,
  VlanItem,
  InfrastructureItem,
  IpAddressItem,
  SeedResult,
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
  UtilBar,
  Note,
  Spinner,
  EmptyState,
  field,
  fmtNumber,
} from './admin/ui';

interface Props {
  embedded?: boolean;
  onBack?: () => void;
}

/**
 * VLANs and IP addressing.
 *
 * A VLAN owns the peering-LAN prefixes; the address pool is materialised from
 * them and handed out atomically during provisioning. Members never get
 * hand-typed addresses, so this screen is where the pool is sized and audited
 * rather than where individual assignments are made.
 */
const VlansAdminPanel: React.FC<Props> = ({ embedded, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [vlans, setVlans] = useState<VlanItem[]>([]);
  const [infras, setInfras] = useState<InfrastructureItem[]>([]);
  const [infraFilter, setInfraFilter] = useState('');

  const [editing, setEditing] = useState<VlanItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [browsing, setBrowsing] = useState<VlanItem | null>(null);
  const [seeding, setSeeding] = useState<VlanItem | null>(null);

  const load = useCallback(async () => {
    const [vRes, iRes] = await Promise.all([
      adminVlansApi.list(infraFilter || undefined),
      adminFabricApi.listInfrastructures(),
    ]);
    if (vRes.success && vRes.data) setVlans(vRes.data);
    else setError(vRes.error || 'Could not load VLANs.');
    if (iRes.success && iRes.data) setInfras(iRes.data);
    setLoading(false);
  }, [infraFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (v: VlanItem) => {
    if (!confirm(`Delete VLAN ${v.number} (${v.name})? The address pool goes with it.`)) return;
    const res = await adminVlansApi.remove(v._id);
    if (!res.success) setError(res.error || 'Delete failed.');
    else load();
  };

  if (loading) return <Spinner label="Loading VLANs…" />;

  const totalAssigned = vlans.reduce(
    (n, v) => n + (v.pool?.v4?.assigned || 0) + (v.pool?.v6?.assigned || 0),
    0
  );
  const totalFree = vlans.reduce((n, v) => n + (v.pool?.v4?.free || 0) + (v.pool?.v6?.free || 0), 0);

  return (
    <PanelShell
      title="VLANs & IP addressing"
      subtitle="Peering LANs, quarantine VLANs and their address pools"
      icon={Layers}
      embedded={embedded}
      onBack={onBack}
      actions={
        <>
          <select className={`${field} w-auto`} value={infraFilter} onChange={(e) => setInfraFilter(e.target.value)}>
            <option value="">All infrastructures</option>
            {infras.map((i) => (
              <option key={i._id} value={i._id}>
                {i.name}
              </option>
            ))}
          </select>
          <Btn icon={RefreshCw} size="sm" onClick={load} />
          <Btn icon={Plus} variant="primary" size="sm" onClick={() => setCreating(true)}>
            Add VLAN
          </Btn>
        </>
      }
    >
      {error && (
        <Note tone="error" onDismiss={() => setError('')}>
          {error}
        </Note>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="VLANs" value={vlans.length} />
        <StatTile label="Peers" value={fmtNumber(vlans.reduce((n, v) => n + (v.peerCount || 0), 0))} />
        <StatTile label="Addresses assigned" value={fmtNumber(totalAssigned)} tone="blue" />
        <StatTile label="Addresses free" value={fmtNumber(totalFree)} tone={totalFree === 0 ? 'red' : 'green'} />
      </div>

      {!vlans.length ? (
        <EmptyState
          icon={Layers}
          title="No VLANs yet"
          hint="Create a peering LAN with an IPv4 and IPv6 prefix. The address pool is generated automatically, and provisioning takes the next free address from it."
          action={
            <Btn icon={Plus} variant="primary" onClick={() => setCreating(true)}>
              Add your first VLAN
            </Btn>
          }
        />
      ) : (
        <div className="space-y-4">
          {vlans.map((v) => (
            <Card key={v._id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-lg">{v.name}</h3>
                    <Badge tone="blue">VLAN {v.number}</Badge>
                    {v.isQuarantine && <Badge tone="amber">quarantine</Badge>}
                    {v.isPrivate && <Badge tone="gray">private</Badge>}
                    {!v.enabled && <Badge tone="gray">disabled</Badge>}
                    {v.ipv6AddressingMode === 'asn-encoded' && <Badge tone="blue">ASN-encoded v6</Badge>}
                  </div>
                  <p className="font-mono text-xs text-gray-500">
                    {v.infrastructure?.name || '—'}
                    {v.peerCount !== undefined && ` · ${v.peerCount} peer${v.peerCount === 1 ? '' : 's'}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Btn icon={Search} size="sm" onClick={() => setBrowsing(v)}>
                    Addresses
                  </Btn>
                  <Btn icon={Database} size="sm" onClick={() => setSeeding(v)}>
                    Pool
                  </Btn>
                  <Btn icon={Pencil} variant="danger" size="sm" onClick={() => setEditing(v)} title="Edit" />
                  <Btn icon={Trash2} variant="danger" size="sm" onClick={() => remove(v)} title="Delete" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                {([4, 6] as const).map((fam) => {
                  const prefix = fam === 4 ? v.ipv4Prefix : v.ipv6Prefix;
                  const pool = fam === 4 ? v.pool?.v4 : v.pool?.v6;
                  const gateway = fam === 4 ? v.ipv4Gateway : v.ipv6Gateway;
                  if (!prefix) {
                    return (
                      <div key={fam} className="border border-dashed border-gray-700 rounded-lg p-4">
                        <p className="font-mono text-[10px] uppercase tracking-wider text-gray-500 mb-1">IPv{fam}</p>
                        <p className="text-sm text-gray-500">No prefix configured</p>
                      </div>
                    );
                  }
                  const allocatable = pool ? pool.total - pool.reserved : 0;
                  const pct = allocatable > 0 ? Math.round(((pool?.assigned || 0) / allocatable) * 1000) / 10 : 0;
                  return (
                    <div key={fam} className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="min-w-0">
                          <p className="font-mono text-[10px] uppercase tracking-wider text-gray-500">IPv{fam}</p>
                          <p className="font-mono text-sm truncate">{prefix}</p>
                        </div>
                        {gateway && (
                          <span className="font-mono text-[10px] text-gray-500 flex-shrink-0">gw {gateway}</span>
                        )}
                      </div>
                      <UtilBar percent={pct} label={`${pool?.assigned || 0} of ${allocatable} in use`} />
                      <div className="grid grid-cols-3 gap-2 mt-3 font-mono text-[11px]">
                        <span className="text-green-500">{pool?.free ?? 0} free</span>
                        <span className="text-sky-500">{pool?.assigned ?? 0} assigned</span>
                        <span className="text-amber-500">{pool?.reserved ?? 0} reserved</span>
                      </div>
                      {pool && pool.total === 0 && (
                        <p className="text-[11px] text-amber-500 mt-2">
                          Pool not generated yet — open Pool and seed it.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <VlanForm
          row={editing || undefined}
          infras={infras}
          defaultInfra={infraFilter}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            load();
          }}
        />
      )}

      {seeding && (
        <PoolModal
          vlan={seeding}
          onClose={() => setSeeding(null)}
          onSeeded={() => {
            setSeeding(null);
            load();
          }}
        />
      )}

      {browsing && <AddressBrowser vlan={browsing} onClose={() => setBrowsing(null)} />}
    </PanelShell>
  );
};

// ── VLAN form ──

const VlanForm: React.FC<{
  row?: VlanItem;
  infras: InfrastructureItem[];
  defaultInfra?: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ row, infras, defaultInfra, onClose, onSaved }) => {
  const [form, setForm] = useState({
    infrastructure: String(row?.infrastructure?._id || row?.infrastructure || defaultInfra || infras[0]?._id || ''),
    name: row?.name || '',
    number: row?.number ? String(row.number) : '',
    ipv4Prefix: row?.ipv4Prefix || '',
    ipv6Prefix: row?.ipv6Prefix || '',
    ipv4Gateway: row?.ipv4Gateway || '',
    ipv6Gateway: row?.ipv6Gateway || '',
    ipv4Reserved: (row?.ipv4Reserved || []).join(', '),
    ipv6Reserved: (row?.ipv6Reserved || []).join(', '),
    ipv6AddressingMode: row?.ipv6AddressingMode || 'sequential',
    isQuarantine: row?.isQuarantine ?? false,
    isPrivate: row?.isPrivate ?? false,
    peeringMatrix: row?.peeringMatrix ?? true,
    ixfExport: row?.ixfExport ?? true,
    reverseDnsZoneV4: row?.reverseDnsZoneV4 || '',
    reverseDnsZoneV6: row?.reverseDnsZoneV6 || '',
    enabled: row?.enabled ?? true,
    notes: row?.notes || '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [seeded, setSeeded] = useState<SeedResult[] | null>(null);

  const splitList = (s: string) =>
    s
      .split(/[,\s]+/)
      .map((x) => x.trim())
      .filter(Boolean);

  const save = async () => {
    setErr('');
    const payload: any = {
      infrastructure: form.infrastructure,
      name: form.name.trim(),
      number: Number(form.number),
      ipv4Prefix: form.ipv4Prefix.trim(),
      ipv6Prefix: form.ipv6Prefix.trim(),
      ipv4Gateway: form.ipv4Gateway.trim(),
      ipv6Gateway: form.ipv6Gateway.trim(),
      ipv4Reserved: splitList(form.ipv4Reserved),
      ipv6Reserved: splitList(form.ipv6Reserved),
      ipv6AddressingMode: form.ipv6AddressingMode,
      isQuarantine: form.isQuarantine,
      isPrivate: form.isPrivate,
      peeringMatrix: form.peeringMatrix,
      ixfExport: form.ixfExport,
      reverseDnsZoneV4: form.reverseDnsZoneV4.trim(),
      reverseDnsZoneV6: form.reverseDnsZoneV6.trim(),
      enabled: form.enabled,
      notes: form.notes,
    };

    setBusy(true);
    const res = row ? await adminVlansApi.update(row._id, payload) : await adminVlansApi.create(payload);
    setBusy(false);
    if (res.success) {
      // Show what the pool seed produced before closing — it is the part that
      // most often surprises people (a /64 seeds a window, not 2^64 rows).
      if (res.data?.pool?.length) setSeeded(res.data.pool);
      else onSaved();
    } else setErr(res.error || 'Save failed.');
  };

  if (seeded) {
    return (
      <Modal
        title="VLAN saved"
        onClose={onSaved}
        footer={
          <Btn variant="primary" onClick={onSaved}>
            Done
          </Btn>
        }
      >
        <Note tone="success">Address pool generated.</Note>
        <Table head={['Family', 'Prefix', 'Created', 'Reserved', 'Total in pool']}>
          {seeded.map((s) => (
            <tr key={s.family}>
              <Td className="font-mono text-xs">IPv{s.family}</Td>
              <Td className="font-mono text-xs">{s.prefix}</Td>
              <Td className="font-mono text-xs">{s.created}</Td>
              <Td className="font-mono text-xs">{s.reserved}</Td>
              <Td className="font-mono text-xs">{s.total}</Td>
            </tr>
          ))}
        </Table>
        <p className="text-xs text-gray-500">
          IPv6 pools are seeded as a working window from the start of the prefix rather than the whole range. Widen it
          from the Pool screen when you need more.
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      title={row ? `Edit VLAN ${row.number}` : 'New VLAN'}
      hint="Prefixes here become the address pool. A prefix cannot be changed once addresses are assigned to live peers."
      onClose={onClose}
      wide
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" busy={busy} onClick={save}>
            {row ? 'Save changes' : 'Create'}
          </Btn>
        </>
      }
    >
      {err && <Note tone="error">{err}</Note>}
      <Grid>
        <Fld label="Infrastructure">
          <select
            className={field}
            value={form.infrastructure}
            onChange={(e) => setForm({ ...form, infrastructure: e.target.value })}
          >
            <option value="">Select…</option>
            {infras.map((i) => (
              <option key={i._id} value={i._id}>
                {i.name} (AS{i.asn})
              </option>
            ))}
          </select>
        </Fld>
        <Fld label="Name">
          <input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Peering LAN" />
        </Fld>
        <Fld label="802.1Q tag" hint="1–4094, unique per infrastructure.">
          <input className={field} value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="100" />
        </Fld>
        <Fld label="IPv6 addressing">
          <select
            className={field}
            value={form.ipv6AddressingMode}
            onChange={(e) => setForm({ ...form, ipv6AddressingMode: e.target.value as any })}
          >
            <option value="sequential">Sequential (next free)</option>
            <option value="asn-encoded">ASN-encoded (2001:db8:1::6:4500:1 for AS64500)</option>
          </select>
        </Fld>
      </Grid>

      <div className="border-t border-gray-700 pt-4">
        <p className="font-mono text-[11px] uppercase tracking-wider text-gray-400 mb-3">Prefixes</p>
        <Grid>
          <Fld label="IPv4 prefix" hint="e.g. 103.139.191.0/24">
            <input className={field} value={form.ipv4Prefix} onChange={(e) => setForm({ ...form, ipv4Prefix: e.target.value })} />
          </Fld>
          <Fld label="IPv6 prefix" hint="e.g. 2001:db8:1::/64">
            <input className={field} value={form.ipv6Prefix} onChange={(e) => setForm({ ...form, ipv6Prefix: e.target.value })} />
          </Fld>
          <Fld label="IPv4 gateway" hint="Excluded from allocation.">
            <input className={field} value={form.ipv4Gateway} onChange={(e) => setForm({ ...form, ipv4Gateway: e.target.value })} />
          </Fld>
          <Fld label="IPv6 gateway">
            <input className={field} value={form.ipv6Gateway} onChange={(e) => setForm({ ...form, ipv6Gateway: e.target.value })} />
          </Fld>
          <Fld label="IPv4 reserved" hint="Comma separated. Route server and anycast addresses go here.">
            <input
              className={field}
              value={form.ipv4Reserved}
              onChange={(e) => setForm({ ...form, ipv4Reserved: e.target.value })}
              placeholder="103.139.191.1, 103.139.191.2"
            />
          </Fld>
          <Fld label="IPv6 reserved" hint="Comma separated.">
            <input
              className={field}
              value={form.ipv6Reserved}
              onChange={(e) => setForm({ ...form, ipv6Reserved: e.target.value })}
            />
          </Fld>
        </Grid>
      </div>

      <div className="border-t border-gray-700 pt-4">
        <p className="font-mono text-[11px] uppercase tracking-wider text-gray-400 mb-3">Behaviour</p>
        <div className="space-y-3">
          <Toggle
            checked={form.isQuarantine}
            onChange={(v) => setForm({ ...form, isQuarantine: v })}
            label="Quarantine VLAN"
            hint="New members land here before going live on the peering LAN."
          />
          <Toggle
            checked={form.isPrivate}
            onChange={(v) => setForm({ ...form, isPrivate: v })}
            label="Private VLAN"
            hint="Bilateral cross-connect. Excluded from the route servers and the peering matrix."
          />
          <Toggle
            checked={form.peeringMatrix}
            onChange={(v) => setForm({ ...form, peeringMatrix: v })}
            label="Include in the public peering matrix"
          />
          <Toggle
            checked={form.ixfExport}
            onChange={(v) => setForm({ ...form, ixfExport: v })}
            label="Publish in the IX-F member export"
          />
          <Toggle checked={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} label="Enabled" />
        </div>
      </div>

      <div className="border-t border-gray-700 pt-4">
        <Grid>
          <Fld label="Reverse DNS zone (IPv4)">
            <input
              className={field}
              value={form.reverseDnsZoneV4}
              onChange={(e) => setForm({ ...form, reverseDnsZoneV4: e.target.value })}
              placeholder="191.139.103.in-addr.arpa"
            />
          </Fld>
          <Fld label="Reverse DNS zone (IPv6)">
            <input
              className={field}
              value={form.reverseDnsZoneV6}
              onChange={(e) => setForm({ ...form, reverseDnsZoneV6: e.target.value })}
            />
          </Fld>
        </Grid>
        <div className="mt-4">
          <Fld label="Notes">
            <textarea className={`${field} h-20`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Fld>
        </div>
      </div>
    </Modal>
  );
};

// ── Pool management ──

const PoolModal: React.FC<{ vlan: VlanItem; onClose: () => void; onSeeded: () => void }> = ({
  vlan,
  onClose,
  onSeeded,
}) => {
  const [v4Limit, setV4Limit] = useState('');
  const [v6Limit, setV6Limit] = useState('512');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<SeedResult[] | null>(null);

  const seed = async () => {
    setErr('');
    setBusy(true);
    const res = await adminVlansApi.seedPool(vlan._id, {
      v4Limit: v4Limit ? Number(v4Limit) : undefined,
      v6Limit: v6Limit ? Number(v6Limit) : undefined,
    });
    setBusy(false);
    if (res.success && res.data) setResult(res.data);
    else setErr(res.error || 'Seeding failed.');
  };

  return (
    <Modal
      title={`Address pool — ${vlan.name}`}
      hint="Seeding is idempotent: existing rows and assignments are untouched, only missing addresses are added."
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Close</Btn>
          {result ? (
            <Btn variant="primary" onClick={onSeeded}>
              Done
            </Btn>
          ) : (
            <Btn variant="primary" busy={busy} onClick={seed}>
              Seed / extend pool
            </Btn>
          )}
        </>
      }
    >
      {err && <Note tone="error">{err}</Note>}
      {result && (
        <>
          <Note tone="success">Pool updated.</Note>
          <Table head={['Family', 'Prefix', 'Added', 'Reserved', 'Total']}>
            {result.map((s) => (
              <tr key={s.family}>
                <Td className="font-mono text-xs">IPv{s.family}</Td>
                <Td className="font-mono text-xs">{s.prefix}</Td>
                <Td className="font-mono text-xs">{s.created}</Td>
                <Td className="font-mono text-xs">{s.reserved}</Td>
                <Td className="font-mono text-xs">{s.total}</Td>
              </tr>
            ))}
          </Table>
        </>
      )}

      <Note tone="info">
        An IPv6 /64 holds more addresses than can be stored, so the pool is a window taken from the start of the prefix.
        Raise the limit here when the window runs out.
      </Note>

      <Grid>
        <Fld label="IPv4 pool size" hint="Blank uses the whole prefix (capped at 65536).">
          <input className={field} value={v4Limit} onChange={(e) => setV4Limit(e.target.value)} placeholder="whole prefix" />
        </Fld>
        <Fld label="IPv6 window size" hint="Default 512. Max 65536.">
          <input className={field} value={v6Limit} onChange={(e) => setV6Limit(e.target.value)} />
        </Fld>
      </Grid>
    </Modal>
  );
};

// ── Address browser ──

const AddressBrowser: React.FC<{ vlan: VlanItem; onClose: () => void }> = ({ vlan, onClose }) => {
  const [family, setFamily] = useState<4 | 6>(4);
  const [state, setState] = useState<'all' | 'free' | 'assigned' | 'reserved'>('all');
  const [rows, setRows] = useState<IpAddressItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminVlansApi.addresses(vlan._id, {
      family,
      state: state === 'all' ? undefined : state,
      limit: 300,
    });
    setLoading(false);
    if (res.success && res.data) {
      setRows(res.data.addresses);
      setTotal(res.data.total);
    } else setErr(res.error || 'Could not load addresses.');
  }, [vlan._id, family, state]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleReserved = async (a: IpAddressItem) => {
    setErr('');
    const res = await adminVlansApi.setReserved(vlan._id, a._id, !a.reserved, a.reserved ? '' : 'Reserved by operator');
    if (!res.success) setErr(res.error || 'Could not update the address.');
    else load();
  };

  return (
    <Modal title={`Addresses — ${vlan.name}`} onClose={onClose} wide footer={<Btn onClick={onClose}>Close</Btn>}>
      {err && <Note tone="error">{err}</Note>}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex bg-gray-900 rounded p-0.5">
          {([4, 6] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFamily(f)}
              disabled={f === 4 ? !vlan.ipv4Prefix : !vlan.ipv6Prefix}
              className={`px-3 py-1 rounded font-mono text-[10px] uppercase tracking-wider transition-colors disabled:opacity-40 ${
                family === f ? 'bg-[#F20732] text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              IPv{f}
            </button>
          ))}
        </div>
        <div className="flex bg-gray-900 rounded p-0.5">
          {(['all', 'free', 'assigned', 'reserved'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setState(s)}
              className={`px-3 py-1 rounded font-mono text-[10px] uppercase tracking-wider transition-colors ${
                state === s ? 'bg-[#F20732] text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-gray-500">
          {rows.length} of {total}
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 py-8 text-center">Loading…</p>
      ) : !rows.length ? (
        <EmptyState title="No addresses match" hint="Seed the pool if it is empty, or change the filter." />
      ) : (
        <div className="max-h-[55vh] overflow-y-auto border border-gray-700 rounded-lg">
          <Table head={['Address', 'State', 'Held by', '']} dense>
            {rows.map((a) => (
              <tr key={a._id} className="hover:bg-gray-700/20">
                <Td className="font-mono text-xs">{a.address}</Td>
                <Td>
                  {a.assignedTo ? (
                    <Badge tone="blue">assigned</Badge>
                  ) : a.reserved ? (
                    <Badge tone="amber">reserved</Badge>
                  ) : (
                    <Badge tone="green">free</Badge>
                  )}
                </Td>
                <Td className="text-xs">
                  {a.holder ? (
                    <span>
                      {a.holder.name}
                      {a.holder.asn ? <span className="font-mono text-gray-500"> AS{a.holder.asn}</span> : null}
                    </span>
                  ) : (
                    <span className="text-gray-600">{a.label || '—'}</span>
                  )}
                </Td>
                <Td>
                  <div className="flex justify-end">
                    {!a.assignedTo && (
                      <Btn
                        icon={a.reserved ? Unlock : Lock}
                        variant="danger"
                        size="sm"
                        onClick={() => toggleReserved(a)}
                        title={a.reserved ? 'Release reservation' : 'Reserve'}
                      />
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </Modal>
  );
};

export default VlansAdminPanel;
