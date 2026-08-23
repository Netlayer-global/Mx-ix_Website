import React, { useCallback, useEffect, useMemo, useState, lazy } from 'react';
import {
  Network,
  Building2,
  Server,
  Plus,
  Pencil,
  Trash2,
  Cable,
  LayoutGrid,
  Wand2,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  adminFabricApi,
  adminPeeringDbApi,
  InfrastructureItem,
  FacilityItem,
  CabinetItem,
  DeviceItem,
  SwitchPortItem,
  RackElevation,
} from '../services/api';

const Rack3D = lazy(() => import('../components/Rack3D'));
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
  UtilBar,
  Note,
  WarningList,
  Spinner,
  EmptyState,
  field,
  fmtSpeed,
  fmtNumber,
  portStatusTone,
} from './admin/ui';

interface Props {
  embedded?: boolean;
  onBack?: () => void;
}

/**
 * Physical fabric administration, walked in the order an operator actually
 * thinks about it:
 *
 *   Infrastructure (IXP) → Facility (data centre) → Cabinet (rack)
 *      → rack elevation → Device → Port
 *
 * One panel with a breadcrumb rather than five separate screens, so the
 * relationship between the levels stays visible while you work.
 */
const FabricAdminPanel: React.FC<Props> = ({ embedded, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [infras, setInfras] = useState<InfrastructureItem[]>([]);
  const [facilities, setFacilities] = useState<FacilityItem[]>([]);
  const [cabinets, setCabinets] = useState<CabinetItem[]>([]);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [elevation, setElevation] = useState<RackElevation | null>(null);
  const [deviceDetail, setDeviceDetail] = useState<{ device: DeviceItem; ports: SwitchPortItem[] } | null>(null);

  // Selection defines which level is on screen.
  const [infra, setInfra] = useState<InfrastructureItem | null>(null);
  const [facility, setFacility] = useState<FacilityItem | null>(null);
  const [cabinet, setCabinet] = useState<CabinetItem | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  type ModalKind =
    | { kind: 'infra'; row?: InfrastructureItem }
    | { kind: 'facility'; row?: FacilityItem }
    | { kind: 'cabinet'; row?: CabinetItem }
    | { kind: 'device'; row?: DeviceItem }
    | { kind: 'ports'; device: DeviceItem }
    | null;
  const [modal, setModal] = useState<ModalKind>(null);

  const level: 'infras' | 'facilities' | 'cabinets' | 'device' = deviceId
    ? 'device'
    : cabinet
      ? 'cabinets'
      : facility
        ? 'cabinets'
        : infra
          ? 'facilities'
          : 'infras';

  // ── Loaders ──

  const loadInfras = useCallback(async () => {
    const res = await adminFabricApi.listInfrastructures();
    if (res.success && res.data) setInfras(res.data);
    else setError(res.error || 'Could not load infrastructures.');
    setLoading(false);
  }, []);

  useEffect(() => {
    loadInfras();
  }, [loadInfras]);

  const loadFacilities = useCallback(async (infraId: string) => {
    const res = await adminFabricApi.listFacilities(infraId);
    if (res.success && res.data) setFacilities(res.data);
  }, []);

  const loadCabinets = useCallback(async (facilityId: string) => {
    const res = await adminFabricApi.listCabinets(facilityId);
    if (res.success && res.data) setCabinets(res.data);
  }, []);

  const loadDevices = useCallback(async (params: { infrastructure?: string; facility?: string; cabinet?: string }) => {
    const res = await adminFabricApi.listDevices(params);
    if (res.success && res.data) setDevices(res.data);
  }, []);

  const loadElevation = useCallback(async (cabinetId: string) => {
    const res = await adminFabricApi.elevation(cabinetId);
    if (res.success && res.data) setElevation(res.data);
    else setElevation(null);
  }, []);

  const loadDeviceDetail = useCallback(async (id: string) => {
    const res = await adminFabricApi.getDevice(id);
    if (res.success && res.data) setDeviceDetail(res.data);
    else setError(res.error || 'Could not load the device.');
  }, []);

  // Fetch whatever the current selection needs.
  useEffect(() => {
    if (deviceId) {
      loadDeviceDetail(deviceId);
      return;
    }
    if (cabinet) {
      loadElevation(cabinet._id);
      loadDevices({ cabinet: cabinet._id });
      return;
    }
    if (facility) {
      loadCabinets(facility._id);
      loadDevices({ facility: facility._id });
      return;
    }
    if (infra) {
      loadFacilities(infra._id);
      loadDevices({ infrastructure: infra._id });
    }
  }, [infra, facility, cabinet, deviceId, loadFacilities, loadCabinets, loadDevices, loadElevation, loadDeviceDetail]);

  const refresh = useCallback(() => {
    setError('');
    loadInfras();
    if (infra) loadFacilities(infra._id);
    if (facility) loadCabinets(facility._id);
    if (cabinet) loadElevation(cabinet._id);
    if (deviceId) loadDeviceDetail(deviceId);
    if (cabinet) loadDevices({ cabinet: cabinet._id });
    else if (facility) loadDevices({ facility: facility._id });
    else if (infra) loadDevices({ infrastructure: infra._id });
  }, [infra, facility, cabinet, deviceId, loadInfras, loadFacilities, loadCabinets, loadElevation, loadDeviceDetail, loadDevices]);

  // ── Navigation ──

  const goInfras = () => {
    setInfra(null);
    setFacility(null);
    setCabinet(null);
    setDeviceId(null);
  };
  const goInfra = (i: InfrastructureItem) => {
    setInfra(i);
    setFacility(null);
    setCabinet(null);
    setDeviceId(null);
  };
  const goFacility = (f: FacilityItem) => {
    setFacility(f);
    setCabinet(null);
    setDeviceId(null);
  };
  const goCabinet = (c: CabinetItem) => {
    setCabinet(c);
    setDeviceId(null);
  };

  const crumbs = useMemo(() => {
    const items: Array<{ label: string; onClick?: () => void }> = [{ label: 'Infrastructures', onClick: goInfras }];
    if (infra) items.push({ label: infra.name, onClick: () => goInfra(infra) });
    if (facility) items.push({ label: facility.name, onClick: () => goFacility(facility) });
    if (cabinet) items.push({ label: cabinet.name, onClick: () => goCabinet(cabinet) });
    if (deviceId && deviceDetail) items.push({ label: deviceDetail.device.name });
    return items;
  }, [infra, facility, cabinet, deviceId, deviceDetail]);

  // ── Mutations ──

  const remove = async (label: string, fn: () => Promise<{ success: boolean; error?: string }>) => {
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    setBusy(true);
    setError('');
    const res = await fn();
    setBusy(false);
    if (!res.success) setError(res.error || 'Delete failed.');
    else refresh();
  };

  if (loading) return <Spinner label="Loading fabric…" />;

  const headerActions = (
    <>
      <Btn icon={RefreshCw} onClick={refresh} size="sm" />
      {level === 'infras' && (
        <Btn icon={Plus} variant="primary" size="sm" onClick={() => setModal({ kind: 'infra' })}>
          Add IXP
        </Btn>
      )}
      {level === 'facilities' && (
        <Btn icon={Plus} variant="primary" size="sm" onClick={() => setModal({ kind: 'facility' })}>
          Add data centre
        </Btn>
      )}
      {level === 'cabinets' && !cabinet && facility && (
        <Btn icon={Plus} variant="primary" size="sm" onClick={() => setModal({ kind: 'cabinet' })}>
          Add rack
        </Btn>
      )}
      {level === 'cabinets' && cabinet && (
        <Btn icon={Plus} variant="primary" size="sm" onClick={() => setModal({ kind: 'device' })}>
          Add device
        </Btn>
      )}
    </>
  );

  return (
    <PanelShell
      title="Infrastructure"
      subtitle="IXPs, data centres, racks, devices and ports"
      icon={Network}
      embedded={embedded}
      onBack={onBack}
      actions={headerActions}
      breadcrumb={<Breadcrumb items={crumbs} />}
    >
      {error && (
        <Note tone="error" onDismiss={() => setError('')}>
          {error}
        </Note>
      )}

      {level === 'infras' && (
        <InfrastructureList
          rows={infras}
          onOpen={goInfra}
          onEdit={(row) => setModal({ kind: 'infra', row })}
          onDelete={(row) =>
            remove(`infrastructure "${row.name}"`, () => adminFabricApi.deleteInfrastructure(row._id))
          }
          onCreate={() => setModal({ kind: 'infra' })}
        />
      )}

      {level === 'facilities' && infra && (
        <FacilityList
          infra={infra}
          rows={facilities}
          devices={devices}
          onOpen={goFacility}
          onEdit={(row) => setModal({ kind: 'facility', row })}
          onDelete={(row) => remove(`data centre "${row.name}"`, () => adminFabricApi.deleteFacility(row._id))}
          onCreate={() => setModal({ kind: 'facility' })}
        />
      )}

      {level === 'cabinets' && facility && !cabinet && (
        <CabinetList
          rows={cabinets}
          onOpen={goCabinet}
          onEdit={(row) => setModal({ kind: 'cabinet', row })}
          onDelete={(row) => remove(`rack "${row.name}"`, () => adminFabricApi.deleteCabinet(row._id))}
          onCreate={() => setModal({ kind: 'cabinet' })}
        />
      )}

      {level === 'cabinets' && cabinet && (
        <>
          <RackView
            cabinet={cabinet}
            elevation={elevation}
            devices={devices}
            onOpenDevice={(id) => setDeviceId(id)}
            onEditCabinet={() => setModal({ kind: 'cabinet', row: cabinet })}
            onAddDevice={() => setModal({ kind: 'device' })}
          />
          {elevation && (
            <React.Suspense fallback={<div className="h-[500px] bg-gray-950 rounded-lg flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#F20732] border-t-transparent rounded-full animate-spin" /></div>}>
              <Card className="mt-4">
                <div className="px-5 py-3 border-b border-gray-700 flex items-center justify-between">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-[#F20732]" /> 3D Rack View
                  </h3>
                  <span className="text-[10px] uppercase font-mono text-gray-500">
                    {elevation.usedUnits}/{elevation.cabinet.uHeight}U occupied · {elevation.occupants.length} devices
                  </span>
                </div>
                <div className="p-3">
                  <Rack3D
                    elevation={elevation}
                    height={520}
                    onDeviceClick={(occ) => setDeviceId(occ.id)}
                  />
                </div>
              </Card>
            </React.Suspense>
          )}
        </>
      )}

      {level === 'device' && deviceDetail && (
        <DeviceView
          detail={deviceDetail}
          onEdit={() => setModal({ kind: 'device', row: deviceDetail.device })}
          onGeneratePorts={() => setModal({ kind: 'ports', device: deviceDetail.device })}
          onRefresh={() => loadDeviceDetail(deviceDetail.device._id)}
          onError={setError}
        />
      )}

      {/* ── Modals ── */}
      {modal?.kind === 'infra' && (
        <InfrastructureForm
          row={modal.row}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            refresh();
          }}
        />
      )}
      {modal?.kind === 'facility' && infra && (
        <FacilityForm
          row={modal.row}
          infraId={infra._id}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            refresh();
          }}
        />
      )}
      {modal?.kind === 'cabinet' && facility && (
        <CabinetForm
          row={modal.row}
          facilityId={facility._id}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            refresh();
          }}
        />
      )}
      {modal?.kind === 'device' && infra && (
        <DeviceForm
          row={modal.row}
          infraId={infra._id}
          cabinetId={cabinet?._id}
          cabinets={cabinets}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            refresh();
          }}
        />
      )}
      {modal?.kind === 'ports' && (
        <PortGenerator
          device={modal.device}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            if (deviceId) loadDeviceDetail(deviceId);
          }}
        />
      )}
    </PanelShell>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Level 1 — Infrastructures
// ══════════════════════════════════════════════════════════════════════════════

const InfrastructureList: React.FC<{
  rows: InfrastructureItem[];
  onOpen: (r: InfrastructureItem) => void;
  onEdit: (r: InfrastructureItem) => void;
  onDelete: (r: InfrastructureItem) => void;
  onCreate: () => void;
}> = ({ rows, onOpen, onEdit, onDelete, onCreate }) => {
  if (!rows.length) {
    return (
      <EmptyState
        icon={Network}
        title="No infrastructure yet"
        hint="An infrastructure is one switching fabric — normally one per metro. Everything else (data centres, racks, VLANs, route servers) hangs off it, so this is the first thing to create."
        action={
          <Btn icon={Plus} variant="primary" onClick={onCreate}>
            Add your first IXP
          </Btn>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {rows.map((r) => (
        <Card key={r._id} className="p-5 hover:border-gray-500 transition-colors">
          <div className="flex items-start justify-between gap-3 mb-4">
            <button onClick={() => onOpen(r)} className="text-left min-w-0 group">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-lg truncate group-hover:text-[#F20732] transition-colors">{r.name}</h3>
                {r.isPrimary && <Badge tone="blue">primary</Badge>}
                {!r.enabled && <Badge tone="gray">disabled</Badge>}
              </div>
              <p className="font-mono text-xs text-gray-500">
                AS{r.asn} · {r.shortname} · MTU {r.mtu}
              </p>
            </button>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Btn icon={Pencil} variant="danger" size="sm" onClick={() => onEdit(r)} title="Edit" />
              <Btn icon={Trash2} variant="danger" size="sm" onClick={() => onDelete(r)} title="Delete" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Devices" value={fmtNumber(r.switchCount)} />
            <StatTile label="VLANs" value={fmtNumber(r.vlanCount)} />
            <StatTile label="Route servers" value={fmtNumber(r.routeServerCount)} />
          </div>
          <div className="mt-4">
            <Btn icon={Building2} size="sm" onClick={() => onOpen(r)}>
              Open data centres
            </Btn>
          </div>
        </Card>
      ))}
    </div>
  );
};

const InfrastructureForm: React.FC<{
  row?: InfrastructureItem;
  onClose: () => void;
  onSaved: () => void;
}> = ({ row, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name: row?.name || '',
    shortname: row?.shortname || '',
    asn: row?.asn ? String(row.asn) : '',
    peeringLanName: row?.peeringLanName || '',
    location: row?.location || '',
    mtu: String(row?.mtu ?? 1500),
    peeringdbIxId: row?.peeringdbIxId ? String(row.peeringdbIxId) : '',
    peeringdbIxLanId: row?.peeringdbIxLanId ? String(row.peeringdbIxLanId) : '',
    ixfId: row?.ixfId ? String(row.ixfId) : '',
    nocEmail: row?.nocEmail || '',
    nocPhone: row?.nocPhone || '',
    isPrimary: row?.isPrimary ?? false,
    enabled: row?.enabled ?? true,
    notes: row?.notes || '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ixSearch, setIxSearch] = useState('');
  const [ixResults, setIxResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const searchIx = async () => {
    if (!ixSearch.trim()) return;
    setSearching(true);
    const res = await adminPeeringDbApi.searchIx(ixSearch.trim());
    setSearching(false);
    if (res.success && res.data) setIxResults(res.data);
    else setErr(res.error || 'PeeringDB search failed.');
  };

  const save = async () => {
    setErr('');
    const payload: any = {
      name: form.name.trim(),
      shortname: form.shortname.trim().toLowerCase(),
      asn: Number(form.asn),
      peeringLanName: form.peeringLanName.trim(),
      location: form.location.trim(),
      mtu: Number(form.mtu) || 1500,
      nocEmail: form.nocEmail.trim(),
      nocPhone: form.nocPhone.trim(),
      isPrimary: form.isPrimary,
      enabled: form.enabled,
      notes: form.notes,
    };
    if (form.peeringdbIxId) payload.peeringdbIxId = Number(form.peeringdbIxId);
    if (form.peeringdbIxLanId) payload.peeringdbIxLanId = Number(form.peeringdbIxLanId);
    if (form.ixfId) payload.ixfId = Number(form.ixfId);

    setBusy(true);
    const res = row
      ? await adminFabricApi.updateInfrastructure(row._id, payload)
      : await adminFabricApi.createInfrastructure(payload);
    setBusy(false);
    if (res.success) onSaved();
    else setErr(res.error || 'Save failed.');
  };

  return (
    <Modal
      title={row ? `Edit ${row.name}` : 'New infrastructure'}
      hint="One switching fabric, normally one per metro. The ASN here becomes the route servers' local AS."
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
        <Fld label="Name">
          <input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="MX-IX Mumbai" />
        </Fld>
        <Fld label="Short name" hint="Lowercase a-z, 0-9, - and _. Used in generated config filenames.">
          <input
            className={field}
            value={form.shortname}
            onChange={(e) => setForm({ ...form, shortname: e.target.value })}
            placeholder="mumbai"
          />
        </Fld>
        <Fld label="IX ASN" hint="Your own ASN — the route servers peer as this.">
          <input className={field} value={form.asn} onChange={(e) => setForm({ ...form, asn: e.target.value })} placeholder="64500" />
        </Fld>
        <Fld label="MTU">
          <input className={field} value={form.mtu} onChange={(e) => setForm({ ...form, mtu: e.target.value })} placeholder="1500" />
        </Fld>
        <Fld label="Peering LAN name">
          <input
            className={field}
            value={form.peeringLanName}
            onChange={(e) => setForm({ ...form, peeringLanName: e.target.value })}
            placeholder="MX-IX Mumbai Peering LAN"
          />
        </Fld>
        <Fld label="Website location slug" hint="Matches a Locations entry, so the public site can link to it.">
          <input className={field} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="mumbai" />
        </Fld>
        <Fld label="NOC email">
          <input className={field} value={form.nocEmail} onChange={(e) => setForm({ ...form, nocEmail: e.target.value })} />
        </Fld>
        <Fld label="NOC phone">
          <input className={field} value={form.nocPhone} onChange={(e) => setForm({ ...form, nocPhone: e.target.value })} />
        </Fld>
      </Grid>

      <div className="border-t border-gray-700 pt-4">
        <p className="font-mono text-[11px] uppercase tracking-wider text-gray-400 mb-3">PeeringDB linkage</p>
        <div className="flex gap-2 mb-3">
          <input
            className={field}
            value={ixSearch}
            onChange={(e) => setIxSearch(e.target.value)}
            placeholder="Search PeeringDB for your exchange…"
            onKeyDown={(e) => e.key === 'Enter' && searchIx()}
          />
          <Btn icon={Search} busy={searching} onClick={searchIx}>
            Search
          </Btn>
        </div>
        {ixResults.length > 0 && (
          <div className="space-y-1.5 mb-3 max-h-48 overflow-y-auto">
            {ixResults.map((ix) => (
              <div key={ix.id} className="flex items-center gap-3 bg-gray-900 border border-gray-700 rounded px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{ix.name}</p>
                  <p className="font-mono text-[11px] text-gray-500">
                    ix #{ix.id} · {ix.city || '—'}, {ix.country || '—'} · {ix.netCount ?? 0} networks
                  </p>
                </div>
                {(ix.ixLans || []).map((lan: any) => (
                  <Btn
                    key={lan.id}
                    size="sm"
                    onClick={() =>
                      setForm({ ...form, peeringdbIxId: String(ix.id), peeringdbIxLanId: String(lan.id) })
                    }
                  >
                    Use ixlan #{lan.id}
                  </Btn>
                ))}
              </div>
            ))}
          </div>
        )}
        <Grid cols={3}>
          <Fld label="PeeringDB ix id">
            <input className={field} value={form.peeringdbIxId} onChange={(e) => setForm({ ...form, peeringdbIxId: e.target.value })} />
          </Fld>
          <Fld label="PeeringDB ixlan id" hint="Needed to reconcile participants.">
            <input
              className={field}
              value={form.peeringdbIxLanId}
              onChange={(e) => setForm({ ...form, peeringdbIxLanId: e.target.value })}
            />
          </Fld>
          <Fld label="IX-F id" hint="Only if you publish an IX-F member list.">
            <input className={field} value={form.ixfId} onChange={(e) => setForm({ ...form, ixfId: e.target.value })} />
          </Fld>
        </Grid>
      </div>

      <div className="border-t border-gray-700 pt-4 space-y-3">
        <Toggle
          checked={form.isPrimary}
          onChange={(v) => setForm({ ...form, isPrimary: v })}
          label="Primary fabric"
          hint="Pre-selected in provisioning forms."
        />
        <Toggle checked={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} label="Enabled" />
        <Fld label="Notes">
          <textarea
            className={`${field} h-20`}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Fld>
      </div>
    </Modal>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Level 2 — Facilities (data centres)
// ══════════════════════════════════════════════════════════════════════════════

const FacilityList: React.FC<{
  infra: InfrastructureItem;
  rows: FacilityItem[];
  devices: DeviceItem[];
  onOpen: (r: FacilityItem) => void;
  onEdit: (r: FacilityItem) => void;
  onDelete: (r: FacilityItem) => void;
  onCreate: () => void;
}> = ({ infra, rows, devices, onOpen, onEdit, onDelete, onCreate }) => (
  <>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatTile label="Data centres" value={rows.length} />
      <StatTile label="Devices" value={devices.length} />
      <StatTile label="IX ASN" value={`AS${infra.asn}`} />
      <StatTile label="MTU" value={infra.mtu} />
    </div>

    {!rows.length ? (
      <EmptyState
        icon={Building2}
        title="No data centres yet"
        hint="Add the colocation sites where this fabric has presence. Racks, devices and cross-connects live inside them."
        action={
          <Btn icon={Plus} variant="primary" onClick={onCreate}>
            Add a data centre
          </Btn>
        }
      />
    ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {rows.map((f) => (
          <Card key={f._id} className="p-5 hover:border-gray-500 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <button onClick={() => onOpen(f)} className="text-left min-w-0 group">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold truncate group-hover:text-[#F20732] transition-colors">{f.name}</h3>
                  {!f.active && <Badge tone="gray">inactive</Badge>}
                </div>
                <p className="font-mono text-xs text-gray-500 truncate">
                  {[f.provider, f.city, f.country].filter(Boolean).join(' · ') || f.shortname}
                </p>
                {f.cageRef && <p className="font-mono text-[11px] text-gray-600 mt-1">Cage {f.cageRef}</p>}
              </button>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Btn icon={Pencil} variant="danger" size="sm" onClick={() => onEdit(f)} title="Edit" />
                <Btn icon={Trash2} variant="danger" size="sm" onClick={() => onDelete(f)} title="Delete" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <StatTile label="Racks" value={fmtNumber(f.cabinetCount)} />
              <StatTile label="Devices" value={fmtNumber(f.deviceCount)} />
            </div>
            <div className="mt-4">
              <Btn icon={LayoutGrid} size="sm" onClick={() => onOpen(f)}>
                Open racks
              </Btn>
            </div>
          </Card>
        ))}
      </div>
    )}
  </>
);

const FacilityForm: React.FC<{
  row?: FacilityItem;
  infraId: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ row, infraId, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name: row?.name || '',
    shortname: row?.shortname || '',
    provider: row?.provider || '',
    address1: row?.address1 || '',
    city: row?.city || '',
    country: row?.country || '',
    cageRef: row?.cageRef || '',
    supportEmail: row?.supportEmail || '',
    supportPhone: row?.supportPhone || '',
    ticketUrl: row?.ticketUrl || '',
    peeringdbFacId: row?.peeringdbFacId ? String(row.peeringdbFacId) : '',
    active: row?.active ?? true,
    notes: row?.notes || '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [facSearch, setFacSearch] = useState('');
  const [facResults, setFacResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const search = async () => {
    if (!facSearch.trim()) return;
    setSearching(true);
    const res = await adminPeeringDbApi.searchFacilities(facSearch.trim());
    setSearching(false);
    if (res.success && res.data) setFacResults(res.data);
    else setErr(res.error || 'PeeringDB search failed.');
  };

  const save = async () => {
    setErr('');
    const payload: any = {
      infrastructure: infraId,
      name: form.name.trim(),
      shortname: form.shortname.trim().toLowerCase(),
      provider: form.provider.trim(),
      address1: form.address1.trim(),
      city: form.city.trim(),
      country: form.country.trim(),
      cageRef: form.cageRef.trim(),
      supportEmail: form.supportEmail.trim(),
      supportPhone: form.supportPhone.trim(),
      ticketUrl: form.ticketUrl.trim(),
      active: form.active,
      notes: form.notes,
    };
    if (form.peeringdbFacId) payload.peeringdbFacId = Number(form.peeringdbFacId);

    setBusy(true);
    const res = row ? await adminFabricApi.updateFacility(row._id, payload) : await adminFabricApi.createFacility(payload);
    setBusy(false);
    if (res.success) onSaved();
    else setErr(res.error || 'Save failed.');
  };

  return (
    <Modal
      title={row ? `Edit ${row.name}` : 'New data centre'}
      hint="Where cross-connects terminate. The support contacts here are what the NOC uses for remote hands."
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

      <div className="flex gap-2">
        <input
          className={field}
          value={facSearch}
          onChange={(e) => setFacSearch(e.target.value)}
          placeholder="Search PeeringDB facilities to autofill…"
          onKeyDown={(e) => e.key === 'Enter' && search()}
        />
        <Btn icon={Search} busy={searching} onClick={search}>
          Search
        </Btn>
      </div>
      {facResults.length > 0 && (
        <div className="space-y-1.5 max-h-44 overflow-y-auto">
          {facResults.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setForm({
                  ...form,
                  name: form.name || f.name,
                  city: f.city || form.city,
                  country: f.country || form.country,
                  peeringdbFacId: String(f.id),
                });
                setFacResults([]);
              }}
              className="w-full text-left bg-gray-900 border border-gray-700 rounded px-3 py-2 hover:border-gray-500"
            >
              <p className="text-sm">{f.name}</p>
              <p className="font-mono text-[11px] text-gray-500">
                fac #{f.id} · {f.city || '—'}, {f.country || '—'} · {f.netCount ?? 0} networks
              </p>
            </button>
          ))}
        </div>
      )}

      <Grid>
        <Fld label="Name">
          <input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Equinix Mumbai MB2" />
        </Fld>
        <Fld label="Short name" hint="Lowercase a-z, 0-9, - and _.">
          <input className={field} value={form.shortname} onChange={(e) => setForm({ ...form, shortname: e.target.value })} placeholder="mb2" />
        </Fld>
        <Fld label="Provider">
          <input className={field} value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="Equinix" />
        </Fld>
        <Fld label="Our cage / suite">
          <input className={field} value={form.cageRef} onChange={(e) => setForm({ ...form, cageRef: e.target.value })} />
        </Fld>
        <Fld label="Address" span>
          <input className={field} value={form.address1} onChange={(e) => setForm({ ...form, address1: e.target.value })} />
        </Fld>
        <Fld label="City">
          <input className={field} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </Fld>
        <Fld label="Country">
          <input className={field} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
        </Fld>
        <Fld label="Remote-hands email">
          <input className={field} value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} />
        </Fld>
        <Fld label="Remote-hands phone">
          <input className={field} value={form.supportPhone} onChange={(e) => setForm({ ...form, supportPhone: e.target.value })} />
        </Fld>
        <Fld label="Ticket portal URL" span>
          <input className={field} value={form.ticketUrl} onChange={(e) => setForm({ ...form, ticketUrl: e.target.value })} />
        </Fld>
        <Fld label="PeeringDB fac id">
          <input className={field} value={form.peeringdbFacId} onChange={(e) => setForm({ ...form, peeringdbFacId: e.target.value })} />
        </Fld>
      </Grid>
      <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Active" />
      <Fld label="Notes">
        <textarea className={`${field} h-20`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Fld>
    </Modal>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Level 3 — Cabinets (racks)
// ══════════════════════════════════════════════════════════════════════════════

const CabinetList: React.FC<{
  rows: CabinetItem[];
  onOpen: (r: CabinetItem) => void;
  onEdit: (r: CabinetItem) => void;
  onDelete: (r: CabinetItem) => void;
  onCreate: () => void;
}> = ({ rows, onOpen, onEdit, onDelete, onCreate }) => {
  if (!rows.length) {
    return (
      <EmptyState
        icon={LayoutGrid}
        title="No racks in this data centre"
        hint="Add a rack, then place devices at specific rack units. The elevation view is derived from those positions."
        action={
          <Btn icon={Plus} variant="primary" onClick={onCreate}>
            Add a rack
          </Btn>
        }
      />
    );
  }
  return (
    <Card>
      <CardHeader title="Racks" hint="Click a rack to see its elevation and the devices in it." />
      <Table head={['Rack', 'Height', 'Utilisation', 'Cage / row', 'Power', '']}>
        {rows.map((c) => (
          <tr key={c._id} className="hover:bg-gray-700/20">
            <Td>
              <button onClick={() => onOpen(c)} className="font-bold hover:text-[#F20732] transition-colors">
                {c.name}
              </button>
              {!c.active && (
                <span className="ml-2">
                  <Badge tone="gray">inactive</Badge>
                </span>
              )}
            </Td>
            <Td className="font-mono text-xs text-gray-400">{c.uHeight}U</Td>
            <Td>
              <UtilBar percent={c.utilization ?? 0} label={`${c.usedUnits ?? 0}/${c.uHeight}U`} />
            </Td>
            <Td className="font-mono text-xs text-gray-400">
              {[c.cageRef, c.rowRef].filter(Boolean).join(' / ') || '—'}
            </Td>
            <Td className="font-mono text-xs text-gray-400">
              {c.powerBudgetWatts ? `${c.powerBudgetWatts}W` : '—'}
            </Td>
            <Td>
              <div className="flex items-center gap-1 justify-end">
                <Btn icon={Pencil} variant="danger" size="sm" onClick={() => onEdit(c)} title="Edit" />
                <Btn icon={Trash2} variant="danger" size="sm" onClick={() => onDelete(c)} title="Delete" />
              </div>
            </Td>
          </tr>
        ))}
      </Table>
    </Card>
  );
};

const CabinetForm: React.FC<{
  row?: CabinetItem;
  facilityId: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ row, facilityId, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name: row?.name || '',
    uHeight: String(row?.uHeight ?? 42),
    uNumbering: row?.uNumbering || 'bottom-up',
    cageRef: row?.cageRef || '',
    rowRef: row?.rowRef || '',
    providerRef: row?.providerRef || '',
    powerFeedA: row?.powerFeedA || '',
    powerFeedB: row?.powerFeedB || '',
    powerBudgetWatts: row?.powerBudgetWatts ? String(row.powerBudgetWatts) : '',
    active: row?.active ?? true,
    notes: row?.notes || '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setErr('');
    const payload: any = {
      facility: facilityId,
      name: form.name.trim(),
      uHeight: Number(form.uHeight) || 42,
      uNumbering: form.uNumbering,
      cageRef: form.cageRef.trim(),
      rowRef: form.rowRef.trim(),
      providerRef: form.providerRef.trim(),
      powerFeedA: form.powerFeedA.trim(),
      powerFeedB: form.powerFeedB.trim(),
      active: form.active,
      notes: form.notes,
    };
    if (form.powerBudgetWatts) payload.powerBudgetWatts = Number(form.powerBudgetWatts);

    setBusy(true);
    const res = row ? await adminFabricApi.updateCabinet(row._id, payload) : await adminFabricApi.createCabinet(payload);
    setBusy(false);
    if (res.success) onSaved();
    else setErr(res.error || 'Save failed.');
  };

  return (
    <Modal
      title={row ? `Edit rack ${row.name}` : 'New rack'}
      onClose={onClose}
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
        <Fld label="Rack name">
          <input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="R12" />
        </Fld>
        <Fld label="Height (U)">
          <input className={field} value={form.uHeight} onChange={(e) => setForm({ ...form, uHeight: e.target.value })} />
        </Fld>
        <Fld label="Unit numbering" hint="Only affects how the elevation is drawn.">
          <select
            className={field}
            value={form.uNumbering}
            onChange={(e) => setForm({ ...form, uNumbering: e.target.value as any })}
          >
            <option value="bottom-up">Bottom-up (U1 at the bottom)</option>
            <option value="top-down">Top-down (U1 at the top)</option>
          </select>
        </Fld>
        <Fld label="Provider reference" hint="Quoted on remote-hands tickets.">
          <input className={field} value={form.providerRef} onChange={(e) => setForm({ ...form, providerRef: e.target.value })} />
        </Fld>
        <Fld label="Cage">
          <input className={field} value={form.cageRef} onChange={(e) => setForm({ ...form, cageRef: e.target.value })} />
        </Fld>
        <Fld label="Row">
          <input className={field} value={form.rowRef} onChange={(e) => setForm({ ...form, rowRef: e.target.value })} />
        </Fld>
        <Fld label="Power feed A">
          <input className={field} value={form.powerFeedA} onChange={(e) => setForm({ ...form, powerFeedA: e.target.value })} />
        </Fld>
        <Fld label="Power feed B">
          <input className={field} value={form.powerFeedB} onChange={(e) => setForm({ ...form, powerFeedB: e.target.value })} />
        </Fld>
        <Fld label="Power budget (W)">
          <input
            className={field}
            value={form.powerBudgetWatts}
            onChange={(e) => setForm({ ...form, powerBudgetWatts: e.target.value })}
          />
        </Fld>
      </Grid>
      <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Active" />
      <Fld label="Notes">
        <textarea className={`${field} h-20`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Fld>
    </Modal>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Rack elevation
// ══════════════════════════════════════════════════════════════════════════════

const RackView: React.FC<{
  cabinet: CabinetItem;
  elevation: RackElevation | null;
  devices: DeviceItem[];
  onOpenDevice: (id: string) => void;
  onEditCabinet: () => void;
  onAddDevice: () => void;
}> = ({ cabinet, elevation, devices, onOpenDevice, onEditCabinet, onAddDevice }) => {
  const [face, setFace] = useState<'front' | 'rear'>('front');

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Height" value={`${cabinet.uHeight}U`} />
        <StatTile label="Used" value={`${elevation?.usedUnits ?? 0}U`} />
        <StatTile
          label="Free"
          value={`${elevation?.freeUnits ?? cabinet.uHeight}U`}
          tone={(elevation?.freeUnits ?? 1) === 0 ? 'red' : undefined}
        />
        <StatTile label="Devices" value={devices.length} />
      </div>

      {elevation?.problems?.length ? <WarningList warnings={elevation.problems} /> : null}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Elevation */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Rack elevation"
            hint={cabinet.uNumbering === 'top-down' ? 'U1 at the top' : 'U1 at the bottom'}
            actions={
              <div className="flex bg-gray-900 rounded p-0.5">
                {(['front', 'rear'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFace(f)}
                    className={`px-2.5 py-1 rounded font-mono text-[10px] uppercase tracking-wider transition-colors ${
                      face === f ? 'bg-[#F20732] text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            }
          />
          <div className="p-4">
            {!elevation ? (
              <p className="text-sm text-gray-500 text-center py-6">Loading elevation…</p>
            ) : (
              <div className="space-y-0.5">
                {elevation.units.map((row) => {
                  const occ = face === 'front' ? row.front : row.rear;
                  const isStart = face === 'front' ? row.isOccupantStartFront : row.isOccupantStartRear;
                  return (
                    <div key={row.unit} className="flex items-stretch gap-2">
                      <span className="w-8 flex-shrink-0 font-mono text-[10px] text-gray-600 flex items-center justify-end pr-1">
                        {row.unit}
                      </span>
                      {occ ? (
                        <button
                          onClick={() => occ.kind === 'device' && onOpenDevice(occ.id)}
                          className={`flex-1 min-w-0 text-left px-3 py-1.5 rounded border transition-colors ${
                            occ.active
                              ? 'bg-[#F20732]/15 border-[#F20732]/40 hover:border-[#F20732]'
                              : 'bg-gray-700/40 border-gray-600'
                          }`}
                        >
                          {isStart ? (
                            <span className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-bold truncate">{occ.name}</span>
                              <span className="font-mono text-[10px] text-gray-400 flex-shrink-0">
                                {occ.units}U
                                {occ.portCount ? ` · ${occ.portCount}p` : ''}
                              </span>
                            </span>
                          ) : (
                            <span className="font-mono text-[10px] text-gray-500">↑</span>
                          )}
                        </button>
                      ) : (
                        <div className="flex-1 px-3 py-1.5 rounded border border-dashed border-gray-700/60" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {elevation?.freeRuns?.length ? (
              <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-gray-500">
                Free runs:{' '}
                {elevation.freeRuns.map((r) => `U${r.start}${r.size > 1 ? `–U${r.end}` : ''} (${r.size}U)`).join(', ')}
              </p>
            ) : null}
          </div>
        </Card>

        {/* Devices */}
        <Card className="lg:col-span-3">
          <CardHeader
            title="Devices in this rack"
            actions={
              <>
                <Btn icon={Pencil} size="sm" onClick={onEditCabinet}>
                  Edit rack
                </Btn>
                <Btn icon={Plus} variant="primary" size="sm" onClick={onAddDevice}>
                  Add device
                </Btn>
              </>
            }
          />
          {!devices.length ? (
            <div className="p-4">
              <EmptyState icon={Server} title="No devices in this rack" hint="Add a switch and give it a rack position." />
            </div>
          ) : (
            <Table head={['Device', 'Type', 'Position', 'Ports', 'Management', '']}>
              {devices.map((d) => (
                <tr key={d._id} className="hover:bg-gray-700/20">
                  <Td>
                    <button
                      onClick={() => onOpenDevice(d._id)}
                      className="font-bold hover:text-[#F20732] transition-colors text-left"
                    >
                      {d.name}
                    </button>
                    <p className="font-mono text-[11px] text-gray-500">
                      {[d.vendor, d.hardwareModel].filter(Boolean).join(' ') || '—'}
                    </p>
                  </Td>
                  <Td>
                    <Badge tone={d.deviceType === 'switch' ? 'blue' : 'gray'}>{d.deviceType}</Badge>
                  </Td>
                  <Td className="font-mono text-xs text-gray-400">
                    {d.rackPosition ? `U${d.rackPosition} (${d.rackUnits}U ${d.rackFace})` : 'unplaced'}
                  </Td>
                  <Td className="font-mono text-xs">
                    {d.ports ? (
                      <span>
                        <span className="text-green-500">{d.ports.free}</span>
                        <span className="text-gray-600"> free / {d.ports.total}</span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td className="font-mono text-xs text-gray-400">{d.managementIpv4 || '—'}</Td>
                  <Td>
                    <div className="flex justify-end">
                      <Btn icon={Cable} size="sm" onClick={() => onOpenDevice(d._id)}>
                        Ports
                      </Btn>
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Level 4 — Device + ports
// ══════════════════════════════════════════════════════════════════════════════

const DeviceView: React.FC<{
  detail: { device: DeviceItem; ports: SwitchPortItem[] };
  onEdit: () => void;
  onGeneratePorts: () => void;
  onRefresh: () => void;
  onError: (e: string) => void;
}> = ({ detail, onEdit, onGeneratePorts, onRefresh, onError }) => {
  const { device, ports } = detail;
  const [filter, setFilter] = useState<'all' | 'free' | 'assigned'>('all');

  const shown = ports.filter((p) => {
    if (filter === 'free') return p.status === 'free';
    if (filter === 'assigned') return p.status === 'assigned';
    return true;
  });

  const free = ports.filter((p) => p.status === 'free').length;
  const assigned = ports.filter((p) => p.status === 'assigned').length;

  const deletePort = async (p: SwitchPortItem) => {
    if (!confirm(`Delete port ${p.name}?`)) return;
    const res = await adminFabricApi.deletePort(device._id, p._id);
    if (!res.success) onError(res.error || 'Could not delete the port.');
    else onRefresh();
  };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatTile label="Total ports" value={ports.length} />
        <StatTile label="Free" value={free} tone={free === 0 ? 'red' : 'green'} />
        <StatTile label="Assigned" value={assigned} tone="blue" />
        <StatTile label="Rack position" value={device.rackPosition ? `U${device.rackPosition}` : '—'} />
        <StatTile label="Height" value={`${device.rackUnits}U`} />
      </div>

      <Card>
        <CardHeader
          title={device.name}
          hint={[device.vendor, device.hardwareModel, device.os, device.osVersion].filter(Boolean).join(' · ')}
          actions={
            <>
              <Btn icon={Pencil} size="sm" onClick={onEdit}>
                Edit device
              </Btn>
              <Btn icon={Wand2} variant="primary" size="sm" onClick={onGeneratePorts}>
                Generate ports
              </Btn>
            </>
          }
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 border-b border-gray-700">
          {[
            ['Hostname', device.hostname],
            ['Management IPv4', device.managementIpv4],
            ['Loopback', device.loopbackIpv4],
            ['Zabbix host', device.zabbixHostName],
            ['Serial', device.serialNumber],
            ['Asset tag', device.assetTag],
            ['Console port', device.consolePort],
            ['Power', device.powerWatts ? `${device.powerWatts}W` : ''],
          ].map(([label, value]) => (
            <div key={label as string}>
              <div className="font-mono text-[10px] uppercase tracking-wider text-gray-500 mb-1">{label}</div>
              <div className="text-sm font-mono truncate">{(value as string) || '—'}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-700">
          {(['all', 'free', 'assigned'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded font-mono text-[10px] uppercase tracking-wider transition-colors ${
                filter === f ? 'bg-[#F20732] text-white' : 'bg-gray-900 text-gray-400 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
          <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-gray-500">
            {shown.length} of {ports.length}
          </span>
        </div>

        {!ports.length ? (
          <div className="p-4">
            <EmptyState
              icon={Cable}
              title="No ports on this device"
              hint='Use "Generate ports" with a pattern like 100GE1/0/{1-48} to populate the whole switch at once.'
              action={
                <Btn icon={Wand2} variant="primary" onClick={onGeneratePorts}>
                  Generate ports
                </Btn>
              }
            />
          </div>
        ) : (
          <Table head={['Port', 'Type', 'Speed', 'Status', 'Used by', 'Zabbix iface', '']} dense>
            {shown.map((p) => (
              <tr key={p._id} className="hover:bg-gray-700/20">
                <Td className="font-mono text-xs font-bold">{p.name}</Td>
                <Td>
                  <Badge tone={p.type === 'peering' ? 'blue' : 'gray'}>{p.type}</Badge>
                </Td>
                <Td className="font-mono text-xs text-gray-400">{fmtSpeed(p.speed)}</Td>
                <Td>
                  <Badge tone={portStatusTone(p.status)}>{p.status}</Badge>
                </Td>
                <Td className="text-xs text-gray-400">
                  {p.memberUse ? (
                    <Badge tone="blue">member connection</Badge>
                  ) : p.coreUse ? (
                    <Badge tone="amber">core link</Badge>
                  ) : (
                    '—'
                  )}
                </Td>
                <Td className="font-mono text-xs text-gray-500">{p.zabbixInterface || '—'}</Td>
                <Td>
                  <div className="flex justify-end">
                    <Btn icon={Trash2} variant="danger" size="sm" onClick={() => deletePort(p)} title="Delete port" />
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
};

const DeviceForm: React.FC<{
  row?: DeviceItem;
  infraId: string;
  cabinetId?: string;
  cabinets: CabinetItem[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ row, infraId, cabinetId, cabinets, onClose, onSaved }) => {
  const currentCabinet = row?.cabinet?._id || row?.cabinet || cabinetId || '';
  const [form, setForm] = useState({
    name: row?.name || '',
    hostname: row?.hostname || '',
    deviceType: row?.deviceType || 'switch',
    vendor: row?.vendor || 'Other',
    hardwareModel: row?.hardwareModel || '',
    os: row?.os || '',
    osVersion: row?.osVersion || '',
    serialNumber: row?.serialNumber || '',
    assetTag: row?.assetTag || '',
    cabinet: String(currentCabinet),
    rackPosition: row?.rackPosition ? String(row.rackPosition) : '',
    rackUnits: String(row?.rackUnits ?? 1),
    rackFace: row?.rackFace || 'front',
    managementIpv4: row?.managementIpv4 || '',
    loopbackIpv4: row?.loopbackIpv4 || '',
    zabbixHostName: row?.zabbixHostName || '',
    consolePort: row?.consolePort || '',
    powerWatts: row?.powerWatts ? String(row.powerWatts) : '',
    active: row?.active ?? true,
    notes: row?.notes || '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setErr('');
    const payload: any = {
      infrastructure: infraId,
      name: form.name.trim(),
      hostname: form.hostname.trim(),
      deviceType: form.deviceType,
      vendor: form.vendor,
      hardwareModel: form.hardwareModel.trim(),
      os: form.os.trim(),
      osVersion: form.osVersion.trim(),
      serialNumber: form.serialNumber.trim(),
      assetTag: form.assetTag.trim(),
      rackUnits: Number(form.rackUnits) || 1,
      rackFace: form.rackFace,
      managementIpv4: form.managementIpv4.trim(),
      loopbackIpv4: form.loopbackIpv4.trim(),
      zabbixHostName: form.zabbixHostName.trim(),
      consolePort: form.consolePort.trim(),
      active: form.active,
      notes: form.notes,
    };
    payload.cabinet = form.cabinet || null;
    if (form.rackPosition) payload.rackPosition = Number(form.rackPosition);
    if (form.powerWatts) payload.powerWatts = Number(form.powerWatts);

    setBusy(true);
    const res = row ? await adminFabricApi.updateDevice(row._id, payload) : await adminFabricApi.createDevice(payload);
    setBusy(false);
    if (res.success) onSaved();
    else setErr(res.error || 'Save failed.');
  };

  return (
    <Modal
      title={row ? `Edit ${row.name}` : 'New device'}
      hint="Rack position is validated against the rack height and the other devices, so an overlap is refused rather than silently accepted."
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
        <Fld label="Name">
          <input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="MB2 SW-01" />
        </Fld>
        <Fld label="Hostname / FQDN">
          <input className={field} value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })} />
        </Fld>
        <Fld label="Device type">
          <select className={field} value={form.deviceType} onChange={(e) => setForm({ ...form, deviceType: e.target.value as any })}>
            {['switch', 'router', 'route-server', 'console-server', 'pdu', 'server', 'patch-panel', 'other'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Fld>
        <Fld label="Vendor">
          <select className={field} value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })}>
            {['Huawei', 'Cisco', 'Juniper', 'Arista', 'Nokia', 'Extreme', 'MikroTik', 'Edgecore', 'Other'].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Fld>
        <Fld label="Model">
          <input
            className={field}
            value={form.hardwareModel}
            onChange={(e) => setForm({ ...form, hardwareModel: e.target.value })}
            placeholder="CE6881-48S6CQ"
          />
        </Fld>
        <Fld label="OS / version">
          <div className="flex gap-2">
            <input className={field} value={form.os} onChange={(e) => setForm({ ...form, os: e.target.value })} placeholder="VRP" />
            <input className={field} value={form.osVersion} onChange={(e) => setForm({ ...form, osVersion: e.target.value })} placeholder="8.2" />
          </div>
        </Fld>
      </Grid>

      <div className="border-t border-gray-700 pt-4">
        <p className="font-mono text-[11px] uppercase tracking-wider text-gray-400 mb-3">Rack placement</p>
        <Grid cols={4}>
          <Fld label="Rack">
            <select className={field} value={form.cabinet} onChange={(e) => setForm({ ...form, cabinet: e.target.value })}>
              <option value="">Not racked</option>
              {cabinets.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.uHeight}U)
                </option>
              ))}
            </select>
          </Fld>
          <Fld label="Lowest unit">
            <input
              className={field}
              value={form.rackPosition}
              onChange={(e) => setForm({ ...form, rackPosition: e.target.value })}
              placeholder="12"
            />
          </Fld>
          <Fld label="Height (U)">
            <input className={field} value={form.rackUnits} onChange={(e) => setForm({ ...form, rackUnits: e.target.value })} />
          </Fld>
          <Fld label="Face">
            <select className={field} value={form.rackFace} onChange={(e) => setForm({ ...form, rackFace: e.target.value as any })}>
              <option value="front">front</option>
              <option value="rear">rear</option>
            </select>
          </Fld>
        </Grid>
      </div>

      <div className="border-t border-gray-700 pt-4">
        <p className="font-mono text-[11px] uppercase tracking-wider text-gray-400 mb-3">Management & monitoring</p>
        <Grid>
          <Fld label="Management IPv4">
            <input
              className={field}
              value={form.managementIpv4}
              onChange={(e) => setForm({ ...form, managementIpv4: e.target.value })}
            />
          </Fld>
          <Fld label="Loopback IPv4">
            <input className={field} value={form.loopbackIpv4} onChange={(e) => setForm({ ...form, loopbackIpv4: e.target.value })} />
          </Fld>
          <Fld label="Zabbix host name" hint="Must match the host name in the Grafana Zabbix datasource for traffic graphs.">
            <input
              className={field}
              value={form.zabbixHostName}
              onChange={(e) => setForm({ ...form, zabbixHostName: e.target.value })}
              placeholder="MB2 SW-01"
            />
          </Fld>
          <Fld label="Console port">
            <input className={field} value={form.consolePort} onChange={(e) => setForm({ ...form, consolePort: e.target.value })} />
          </Fld>
          <Fld label="Serial number">
            <input className={field} value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
          </Fld>
          <Fld label="Asset tag">
            <input className={field} value={form.assetTag} onChange={(e) => setForm({ ...form, assetTag: e.target.value })} />
          </Fld>
          <Fld label="Power draw (W)">
            <input className={field} value={form.powerWatts} onChange={(e) => setForm({ ...form, powerWatts: e.target.value })} />
          </Fld>
        </Grid>
      </div>

      <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Active" />
      <Fld label="Notes">
        <textarea className={`${field} h-20`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Fld>
    </Modal>
  );
};

const PortGenerator: React.FC<{
  device: DeviceItem;
  onClose: () => void;
  onSaved: () => void;
}> = ({ device, onClose, onSaved }) => {
  const [pattern, setPattern] = useState('100GE1/0/{1-48}');
  const [type, setType] = useState('peering');
  const [speed, setSpeed] = useState('100000');
  const [media, setMedia] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<{ created: number; skipped: number; total: number } | null>(null);

  const run = async () => {
    setErr('');
    setResult(null);
    setBusy(true);
    const res = await adminFabricApi.generatePorts(device._id, {
      pattern: pattern.trim(),
      type,
      speed: Number(speed) || undefined,
      media: media.trim() || undefined,
    });
    setBusy(false);
    if (res.success && res.data) setResult(res.data);
    else setErr(res.error || 'Generation failed.');
  };

  return (
    <Modal
      title={`Generate ports on ${device.name}`}
      hint="Re-running is safe: ports that already exist are skipped rather than duplicated."
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>{result ? 'Close' : 'Cancel'}</Btn>
          {result ? (
            <Btn variant="primary" onClick={onSaved}>
              Done
            </Btn>
          ) : (
            <Btn variant="primary" busy={busy} onClick={run}>
              Generate
            </Btn>
          )}
        </>
      }
    >
      {err && <Note tone="error">{err}</Note>}
      {result && (
        <Note tone="success">
          Created {result.created} port{result.created === 1 ? '' : 's'}
          {result.skipped > 0 && `, skipped ${result.skipped} that already existed`}.
        </Note>
      )}
      <Fld label="Pattern" hint="Must contain one range in braces, e.g. 100GE1/0/{1-48} or Ethernet{1-32}. Max 512 ports.">
        <input className={field} value={pattern} onChange={(e) => setPattern(e.target.value)} />
      </Fld>
      <Grid cols={3}>
        <Fld label="Port type">
          <select className={field} value={type} onChange={(e) => setType(e.target.value)}>
            {['peering', 'core', 'reseller', 'management', 'fanout', 'other'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Fld>
        <Fld label="Speed (Mbit/s)">
          <select className={field} value={speed} onChange={(e) => setSpeed(e.target.value)}>
            <option value="1000">1G</option>
            <option value="10000">10G</option>
            <option value="25000">25G</option>
            <option value="40000">40G</option>
            <option value="100000">100G</option>
            <option value="400000">400G</option>
          </select>
        </Fld>
        <Fld label="Media">
          <input className={field} value={media} onChange={(e) => setMedia(e.target.value)} placeholder="100G-LR4" />
        </Fld>
      </Grid>
    </Modal>
  );
};

export default FabricAdminPanel;
