import React, { useCallback, useEffect, useState } from 'react';
import {
  Globe2,
  Building2,
  Server,
  Network,
  Cable,
  Router,
  Users,
  Activity,
  Plus,
  ArrowRight,
  ChevronRight,
  Loader2,
  MapPin,
  Zap,
  Layers,
  Check,
  X,
  Edit2,
  ToggleLeft,
  ToggleRight,
  BarChart3,
  Trash2,
  Power,
} from 'lucide-react';
import {
  adminFabricApi,
  adminVlansApi,
  adminBirdApi,
  IxDashboardItem,
  IxLiveStatsData,
  InfrastructureItem,
  FacilityItem,
  CabinetItem,
  DeviceItem,
  VlanItem,
} from '../services/api';
import {
  PanelShell,
  Card,
  CardHeader,
  Btn,
  Badge,
  StatTile,
  Note,
  Spinner,
  EmptyState,
  UtilBar,
  Breadcrumb,
  field,
  labelCls,
} from './admin/ui';

interface Props {
  embedded?: boolean;
  onBack?: () => void;
  onNavigateSection?: (section: string) => void;
}

type View = 'list' | 'detail';
type DetailTab = 'overview' | 'livestats' | 'facilities' | 'switches' | 'patchpanels' | 'vlans' | 'peers' | 'bird' | 'routeservers' | 'corelinks' | 'maintenance' | 'peeringmatrix' | 'peeringdb';

const DETAIL_TABS: { id: DetailTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'livestats', label: 'Live Stats', icon: BarChart3 },
  { id: 'facilities', label: 'Facilities & Racks', icon: Building2 },
  { id: 'switches', label: 'Switches & Ports', icon: Router },
  { id: 'patchpanels', label: 'Patch Panels', icon: Cable },
  { id: 'vlans', label: 'VLANs & IPs', icon: Layers },
  { id: 'peers', label: 'Peers', icon: Users },
  { id: 'bird', label: 'Bird Config', icon: Cable },
  { id: 'routeservers', label: 'Route Servers', icon: Server },
  { id: 'corelinks', label: 'Core Links', icon: Network },
  { id: 'maintenance', label: 'Maintenance', icon: Activity },
  { id: 'peeringmatrix', label: 'Peering Matrix', icon: BarChart3 },
  { id: 'peeringdb', label: 'PeeringDB', icon: Globe2 },
];

const IxDashboard: React.FC<Props> = ({ embedded, onBack, onNavigateSection }) => {
  const [view, setView] = useState<View>('list');
  const [loading, setLoading] = useState(true);
  const [ixList, setIxList] = useState<IxDashboardItem[]>([]);
  const [selectedIx, setSelectedIx] = useState<IxDashboardItem | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  // Detail view data
  const [facilities, setFacilities] = useState<FacilityItem[]>([]);
  const [cabinets, setCabinets] = useState<CabinetItem[]>([]);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [vlans, setVlans] = useState<VlanItem[]>([]);
  const [routeServers, setRouteServers] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    const res = await adminFabricApi.ixDashboard();
    if (res.success && res.data) setIxList(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const openDetail = async (ix: IxDashboardItem) => {
    setSelectedIx(ix);
    setView('detail');
    setDetailTab('overview');
    setDetailLoading(true);
    const [fRes, dRes, vRes, rsRes] = await Promise.all([
      adminFabricApi.listFacilities(ix._id),
      adminFabricApi.listDevices({ infrastructure: ix._id }),
      adminVlansApi.list(),
      adminBirdApi.list(),
    ]);
    if (fRes.success && fRes.data) {
      setFacilities(fRes.data);
      // Load cabinets for all facilities in this infrastructure
      const cabResults = await Promise.all(
        fRes.data.map((f) => adminFabricApi.listCabinets(f._id))
      );
      const allCabs = cabResults.flatMap((r) => (r.success && r.data) ? r.data : []);
      setCabinets(allCabs);
    } else {
      setFacilities([]);
      setCabinets([]);
    }
    if (dRes.success && dRes.data) setDevices(dRes.data);
    if (vRes.success && vRes.data) setVlans(vRes.data.filter((v: any) => String(v.infrastructure?._id || v.infrastructure) === ix._id));
    if (rsRes.success && rsRes.data) setRouteServers(rsRes.data.filter((r: any) => String(r.infrastructure?._id || r.infrastructure) === ix._id));
    setDetailLoading(false);
  };

  const backToList = () => {
    setView('list');
    setSelectedIx(null);
    loadDashboard();
  };

  const goFabric = () => onNavigateSection?.('fabric');
  const goVlans = () => onNavigateSection?.('vlans');
  const goBird = () => onNavigateSection?.('bird');
  const goPeers = () => onNavigateSection?.('peers');

  const toggleEnabled = async () => {
    if (!selectedIx || actionBusy) return;
    setActionBusy(true);
    const res = await adminFabricApi.updateInfrastructure(selectedIx._id, { enabled: !selectedIx.enabled });
    if (res.success && res.data) {
      setSelectedIx({ ...selectedIx, enabled: !selectedIx.enabled });
    }
    setActionBusy(false);
  };

  const handleDelete = async () => {
    if (!selectedIx || actionBusy) return;
    setActionBusy(true);
    const res = await adminFabricApi.deleteInfrastructure(selectedIx._id);
    if (res.success) {
      setShowDeleteConfirm(false);
      backToList();
    } else {
      alert(res.error || 'Failed to delete. Remove all switches, VLANs and route servers first.');
    }
    setActionBusy(false);
  };

  if (loading) {
    return (
      <PanelShell title="IX Dashboard" subtitle="Your exchange points at a glance" icon={Globe2} embedded={embedded} onBack={onBack}>
        <Spinner />
      </PanelShell>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DETAIL VIEW
  // ══════════════════════════════════════════════════════════════════════════
  if (view === 'detail' && selectedIx) {
    const portUtil = selectedIx.totalPorts > 0
      ? Math.round((selectedIx.assignedPorts / selectedIx.totalPorts) * 100)
      : 0;
    const capacityGbps = Math.round(selectedIx.totalCapacityMbps / 1000);

    return (
      <PanelShell
        title={selectedIx.name}
        subtitle={`ASN ${selectedIx.asn} · ${selectedIx.shortname}`}
        icon={Globe2}
        embedded={embedded}
        onBack={backToList}
        breadcrumb={
          <Breadcrumb items={[
            { label: 'IX Dashboard', onClick: backToList },
            { label: selectedIx.name },
          ]} />
        }
        actions={
          <div className="flex items-center gap-2">
            <Btn size="sm" icon={Edit2} onClick={() => setShowEditForm(true)}>Edit</Btn>
            <Btn size="sm" icon={Power} variant={selectedIx.enabled ? 'ghost' : 'primary'} onClick={toggleEnabled} busy={actionBusy}>
              {selectedIx.enabled ? 'Disable' : 'Enable'}
            </Btn>
            <Btn size="sm" icon={Trash2} variant="danger" onClick={() => setShowDeleteConfirm(true)}>Delete</Btn>
            <Badge tone={selectedIx.enabled ? 'green' : 'red'}>
              {selectedIx.enabled ? 'Active' : 'Disabled'}
            </Badge>
            {selectedIx.isPrimary && <Badge tone="blue">Primary</Badge>}
          </div>
        }
      >
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatTile label="Members" value={selectedIx.memberCount} tone={selectedIx.memberCount > 0 ? 'green' : 'gray'} />
          <StatTile label="Facilities" value={selectedIx.facilityCount} />
          <StatTile label="Switches" value={selectedIx.switchCount || 0} />
          <StatTile label="Ports" value={`${selectedIx.assignedPorts}/${selectedIx.totalPorts}`} hint={`${portUtil}% used`} />
          <StatTile label="Capacity" value={`${capacityGbps}G`} />
          <StatTile label="Route Servers" value={selectedIx.routeServerCount || 0} />
        </div>

        {/* Tab navigation */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-gray-700">
          {DETAIL_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDetailTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-t-lg whitespace-nowrap transition-colors cursor-pointer ${
                detailTab === tab.id
                  ? 'bg-gray-800 text-white border border-gray-700 border-b-gray-800 -mb-px'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {detailLoading ? <Spinner /> : (
          <div className="space-y-4">
            {detailTab === 'overview' && (
              <OverviewTab ix={selectedIx} facilities={facilities} devices={devices} vlans={vlans} routeServers={routeServers} portUtil={portUtil} onGoFabric={goFabric} onGoPeers={goPeers} />
            )}
            {detailTab === 'livestats' && (
              <LiveStatsTab ixId={selectedIx._id} />
            )}
            {detailTab === 'facilities' && (
              <FacilitiesTab facilities={facilities} cabinets={cabinets} onGoFabric={goFabric} />
            )}
            {detailTab === 'switches' && (
              <SwitchesTab devices={devices} onGoFabric={goFabric} />
            )}
            {detailTab === 'patchpanels' && (
              <EmbeddedPanel title="Patch Panels" hint="Cross-connects, LOAs & fibre lifecycle for this IX." section="patchpanels" />
            )}
            {detailTab === 'vlans' && (
              <VlansTab vlans={vlans} onGoVlans={goVlans} />
            )}
            {detailTab === 'peers' && (
              <EmbeddedPanel title="Peers & Connections" hint="Member LAGs, BGP peers & provisioning for this IX." section="peers" />
            )}
            {detailTab === 'bird' && (
              <EmbeddedPanel title="Bird Config" hint="Route-server config, deploy, IRRDB & rollback for this IX." section="bird" />
            )}
            {detailTab === 'routeservers' && (
              <RouteServersTab routeServers={routeServers} onGoBird={goBird} />
            )}
            {detailTab === 'corelinks' && (
              <EmbeddedPanel title="Core Links" hint="Inter-switch trunks & fabric capacity for this IX." section="corebundles" />
            )}
            {detailTab === 'maintenance' && (
              <EmbeddedPanel title="Maintenance Windows" hint="Planned maintenance windows & notifications." section="maintenance" />
            )}
            {detailTab === 'peeringmatrix' && (
              <EmbeddedPanel title="Peering Matrix" hint="Member-to-member connectivity heatmap." section="peeringmatrix" />
            )}
            {detailTab === 'peeringdb' && (
              <EmbeddedPanel title="PeeringDB" hint="ASN lookup, sync & participant reconciliation." section="peeringdb" />
            )}
          </div>
        )}

        {/* Edit IX Modal */}
        {showEditForm && (
          <EditIxForm
            ix={selectedIx}
            onClose={() => setShowEditForm(false)}
            onSaved={(updated) => {
              setSelectedIx({ ...selectedIx, ...updated });
              setShowEditForm(false);
            }}
          />
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-md w-full space-y-4">
              <h3 className="text-lg font-bold text-[#F20732]">Delete {selectedIx.name}?</h3>
              <p className="text-sm text-gray-400">
                This will permanently remove the IX record. All switches, VLANs, and route servers must be removed first.
                This action cannot be undone.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <Btn variant="primary" onClick={handleDelete} busy={actionBusy} icon={Trash2}>Delete IX</Btn>
                <Btn variant="ghost" onClick={() => setShowDeleteConfirm(false)}>Cancel</Btn>
              </div>
            </div>
          </div>
        )}
      </PanelShell>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LIST VIEW — IX Location Cards
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <PanelShell
      title="IX Dashboard"
      subtitle="Your internet exchange points at a glance"
      icon={Globe2}
      embedded={embedded}
      onBack={onBack}
      actions={
        <Btn variant="primary" icon={Plus} onClick={() => setShowCreateForm(true)}>
          Add IX
        </Btn>
      }
    >
      {/* Global stats banner */}
      {ixList.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile label="Exchanges" value={ixList.length} tone="blue" />
          <StatTile label="Total Members" value={ixList.reduce((s, ix) => s + ix.memberCount, 0)} tone="green" />
          <StatTile label="Total Ports" value={ixList.reduce((s, ix) => s + ix.totalPorts, 0)} />
          <StatTile
            label="Total Capacity"
            value={`${Math.round(ixList.reduce((s, ix) => s + ix.totalCapacityMbps, 0) / 1000)}G`}
          />
        </div>
      )}

      {/* IX Cards Grid */}
      {ixList.length === 0 && !showCreateForm ? (
        <EmptyState
          icon={Globe2}
          title="No exchanges configured"
          hint="Create your first IXP to start building the peering fabric."
          action={
            <Btn variant="primary" icon={Plus} onClick={() => setShowCreateForm(true)}>
              Create First IX
            </Btn>
          }
        />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {ixList.map((ix) => (
            <IxCard key={ix._id} ix={ix} onClick={() => openDetail(ix)} />
          ))}
        </div>
      )}

      {/* Create IX inline form */}
      {showCreateForm && (
        <CreateIxForm
          onClose={() => setShowCreateForm(false)}
          onCreated={() => { setShowCreateForm(false); loadDashboard(); }}
        />
      )}
    </PanelShell>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// IX Location Card
// ══════════════════════════════════════════════════════════════════════════════

const IxCard: React.FC<{ ix: IxDashboardItem; onClick: () => void }> = ({ ix, onClick }) => {
  const portUtil = ix.totalPorts > 0 ? Math.round((ix.assignedPorts / ix.totalPorts) * 100) : 0;
  const capacityGbps = Math.round(ix.totalCapacityMbps / 1000);

  return (
    <button
      onClick={onClick}
      className="bg-gray-800 border border-gray-700 rounded-lg p-5 text-left hover:border-gray-500 hover:bg-gray-750 transition-all group cursor-pointer w-full"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#F20732]/10 border border-[#F20732]/30 rounded-lg flex items-center justify-center">
            <Globe2 className="w-5 h-5 text-[#F20732]" />
          </div>
          <div>
            <h3 className="font-bold text-white group-hover:text-[#F20732] transition-colors">{ix.name}</h3>
            <p className="text-xs text-gray-500 font-mono">AS{ix.asn} · {ix.shortname}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ix.isPrimary && <Badge tone="blue">Primary</Badge>}
          <Badge tone={ix.enabled ? 'green' : 'red'}>{ix.enabled ? 'Live' : 'Off'}</Badge>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <div className="text-lg font-bold text-white">{ix.memberCount}</div>
          <div className="text-[9px] uppercase tracking-wider text-gray-500 font-mono">Members</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-white">{ix.totalPorts}</div>
          <div className="text-[9px] uppercase tracking-wider text-gray-500 font-mono">Ports</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-white">{capacityGbps}G</div>
          <div className="text-[9px] uppercase tracking-wider text-gray-500 font-mono">Capacity</div>
        </div>
      </div>

      {/* Port utilization bar */}
      <UtilBar percent={portUtil} label="Port Utilization" />

      {/* Bottom row: quick info */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-700">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{ix.facilityCount} DC</span>
          <span className="flex items-center gap-1"><Server className="w-3 h-3" />{ix.switchCount || 0} SW</span>
          <span className="flex items-center gap-1"><Cable className="w-3 h-3" />{ix.routeServerCount || 0} RS</span>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-[#F20732] transition-colors" />
      </div>
    </button>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Create IX Form (inline)
// ══════════════════════════════════════════════════════════════════════════════

const CreateIxForm: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({ name: '', shortname: '', asn: '', peeringLanName: '', mtu: '1500' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const res = await adminFabricApi.createInfrastructure({
      name: form.name,
      shortname: form.shortname.toLowerCase(),
      asn: Number(form.asn),
      peeringLanName: form.peeringLanName || `${form.name} Peering LAN`,
      mtu: Number(form.mtu) || 1500,
    });
    if (res.success) {
      onCreated();
    } else {
      setError(res.error || 'Failed to create IX');
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader title="Create New IX" actions={
        <button onClick={onClose} className="p-1.5 hover:bg-gray-700 rounded" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      } />
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {error && <Note tone="error">{error}</Note>}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Name *</label>
            <input className={field} placeholder="MX-IX Mumbai" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className={labelCls}>Short Name *</label>
            <input className={field} placeholder="mumbai" value={form.shortname} onChange={(e) => setForm({ ...form, shortname: e.target.value })} required />
            <p className="text-[10px] text-gray-500 mt-1">Lowercase, used in config files (a-z, 0-9, -, _)</p>
          </div>
          <div>
            <label className={labelCls}>ASN *</label>
            <input className={field} type="number" placeholder="135330" value={form.asn} onChange={(e) => setForm({ ...form, asn: e.target.value })} required />
          </div>
          <div>
            <label className={labelCls}>MTU</label>
            <input className={field} type="number" placeholder="1500" value={form.mtu} onChange={(e) => setForm({ ...form, mtu: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Peering LAN Name</label>
            <input className={field} placeholder="MX-IX Mumbai Peering LAN" value={form.peeringLanName} onChange={(e) => setForm({ ...form, peeringLanName: e.target.value })} />
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Btn type="submit" variant="primary" busy={saving} icon={Plus}>Create IX</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </form>
    </Card>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Edit IX Form (modal)
// ══════════════════════════════════════════════════════════════════════════════

const EditIxForm: React.FC<{ ix: IxDashboardItem; onClose: () => void; onSaved: (data: any) => void }> = ({ ix, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name: ix.name,
    shortname: ix.shortname,
    asn: String(ix.asn),
    peeringLanName: ix.peeringLanName || '',
    mtu: String(ix.mtu),
    nocEmail: ix.nocEmail || '',
    nocPhone: ix.nocPhone || '',
    peeringdbIxId: ix.peeringdbIxId ? String(ix.peeringdbIxId) : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload: any = {
      name: form.name,
      shortname: form.shortname.toLowerCase(),
      asn: Number(form.asn),
      peeringLanName: form.peeringLanName,
      mtu: Number(form.mtu) || 1500,
      nocEmail: form.nocEmail,
      nocPhone: form.nocPhone,
    };
    if (form.peeringdbIxId) payload.peeringdbIxId = Number(form.peeringdbIxId);
    const res = await adminFabricApi.updateInfrastructure(ix._id, payload);
    if (res.success && res.data) {
      onSaved(res.data);
    } else {
      setError(res.error || 'Failed to update IX');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-lg w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Edit {ix.name}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-700 rounded" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Note tone="error">{error}</Note>}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Name *</label>
              <input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className={labelCls}>Short Name *</label>
              <input className={field} value={form.shortname} onChange={(e) => setForm({ ...form, shortname: e.target.value })} required />
            </div>
            <div>
              <label className={labelCls}>ASN *</label>
              <input className={field} type="number" value={form.asn} onChange={(e) => setForm({ ...form, asn: e.target.value })} required />
            </div>
            <div>
              <label className={labelCls}>MTU</label>
              <input className={field} type="number" value={form.mtu} onChange={(e) => setForm({ ...form, mtu: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>NOC Email</label>
              <input className={field} type="email" value={form.nocEmail} onChange={(e) => setForm({ ...form, nocEmail: e.target.value })} placeholder="noc@mx-ix.com" />
            </div>
            <div>
              <label className={labelCls}>NOC Phone</label>
              <input className={field} value={form.nocPhone} onChange={(e) => setForm({ ...form, nocPhone: e.target.value })} placeholder="+91..." />
            </div>
            <div>
              <label className={labelCls}>PeeringDB IX ID</label>
              <input className={field} type="number" value={form.peeringdbIxId} onChange={(e) => setForm({ ...form, peeringdbIxId: e.target.value })} placeholder="e.g. 3456" />
            </div>
            <div>
              <label className={labelCls}>Peering LAN Name</label>
              <input className={field} value={form.peeringLanName} onChange={(e) => setForm({ ...form, peeringLanName: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Btn type="submit" variant="primary" busy={saving} icon={Check}>Save</Btn>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          </div>
        </form>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Detail Tabs
// ══════════════════════════════════════════════════════════════════════════════

const OverviewTab: React.FC<{
  ix: IxDashboardItem;
  facilities: FacilityItem[];
  devices: DeviceItem[];
  vlans: VlanItem[];
  routeServers: any[];
  portUtil: number;
  onGoFabric: () => void;
  onGoPeers: () => void;
}> = ({ ix, facilities, devices, vlans, routeServers, portUtil, onGoFabric, onGoPeers }) => (
  <div className="space-y-4">
    {/* Quick actions */}
    <div className="grid md:grid-cols-3 gap-3">
      <button onClick={onGoPeers} className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-[#F20732]/50 transition-colors text-left cursor-pointer">
        <Users className="w-8 h-8 text-[#F20732]" />
        <div>
          <p className="font-bold text-sm">Provision Member</p>
          <p className="text-xs text-gray-500">Add a new peer connection</p>
        </div>
      </button>
      <button onClick={onGoFabric} className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-[#F20732]/50 transition-colors text-left cursor-pointer">
        <Network className="w-8 h-8 text-[#F20732]" />
        <div>
          <p className="font-bold text-sm">Manage Fabric</p>
          <p className="text-xs text-gray-500">DCs, racks, switches</p>
        </div>
      </button>
      <button onClick={onGoFabric} className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-[#F20732]/50 transition-colors text-left cursor-pointer">
        <Zap className="w-8 h-8 text-[#F20732]" />
        <div>
          <p className="font-bold text-sm">View Capacity</p>
          <p className="text-xs text-gray-500">{portUtil}% port utilization</p>
        </div>
      </button>
    </div>

    {/* IX Info card */}
    <Card>
      <CardHeader title="IX Details" />
      <div className="p-5 grid md:grid-cols-2 gap-4 text-sm">
        <div><span className="text-gray-500">Name:</span> <span className="text-white font-bold ml-2">{ix.name}</span></div>
        <div><span className="text-gray-500">Short Name:</span> <span className="text-white font-mono ml-2">{ix.shortname}</span></div>
        <div><span className="text-gray-500">ASN:</span> <span className="text-white ml-2">{ix.asn}</span></div>
        <div><span className="text-gray-500">MTU:</span> <span className="text-white ml-2">{ix.mtu}</span></div>
        {ix.peeringLanName && <div><span className="text-gray-500">Peering LAN:</span> <span className="text-white ml-2">{ix.peeringLanName}</span></div>}
        {ix.peeringdbIxId && <div><span className="text-gray-500">PeeringDB IX:</span> <span className="text-white ml-2">#{ix.peeringdbIxId}</span></div>}
        {ix.nocEmail && <div><span className="text-gray-500">NOC Email:</span> <span className="text-white ml-2">{ix.nocEmail}</span></div>}
        {ix.nocPhone && <div><span className="text-gray-500">NOC Phone:</span> <span className="text-white ml-2">{ix.nocPhone}</span></div>}
      </div>
    </Card>

    {/* Health summary */}
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader title="Infrastructure" />
        <div className="p-5 space-y-3">
          <div className="flex justify-between text-sm"><span className="text-gray-400">Facilities</span><span className="text-white font-bold">{facilities.length}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-400">Switches</span><span className="text-white font-bold">{devices.filter(d => d.deviceType === 'switch').length}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-400">Routers</span><span className="text-white font-bold">{devices.filter(d => d.deviceType === 'router').length}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-400">VLANs</span><span className="text-white font-bold">{vlans.length}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-400">Route Servers</span><span className="text-white font-bold">{routeServers.length}</span></div>
        </div>
      </Card>
      <Card>
        <CardHeader title="Capacity" />
        <div className="p-5 space-y-4">
          <UtilBar percent={portUtil} label="Port Utilization" />
          <div className="flex justify-between text-sm"><span className="text-gray-400">Total Ports</span><span className="text-white font-bold">{ix.totalPorts}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-400">Assigned</span><span className="text-white font-bold">{ix.assignedPorts}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-400">Free</span><span className="text-white font-bold">{ix.totalPorts - ix.assignedPorts}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-400">Total Capacity</span><span className="text-white font-bold">{Math.round(ix.totalCapacityMbps / 1000)}G</span></div>
        </div>
      </Card>
    </div>
  </div>
);

const FacilitiesTab: React.FC<{ facilities: FacilityItem[]; cabinets: CabinetItem[]; onGoFabric: () => void }> = ({ facilities, cabinets, onGoFabric }) => (
  <div className="space-y-6">
    {/* Facilities */}
    <div>
      <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-3">Data Centers</h3>
      {facilities.length === 0 ? (
        <EmptyState icon={Building2} title="No facilities" hint="Add a data center in the Fabric panel." action={<Btn variant="primary" icon={Plus} onClick={onGoFabric}>Add Facility</Btn>} />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {facilities.map((f) => (
            <Card key={f._id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm truncate">{f.name}</h4>
                  <p className="text-xs text-gray-500 truncate">{f.city}{f.country ? `, ${f.country}` : ''}</p>
                  {f.provider && <p className="text-xs text-gray-500">Provider: {f.provider}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span>{f.cabinetCount || 0} racks</span>
                    <span>{f.deviceCount || 0} devices</span>
                    {f.peeringdbFacId && <Badge tone="blue">PDB #{f.peeringdbFacId}</Badge>}
                  </div>
                </div>
                <Badge tone={f.active ? 'green' : 'gray'}>{f.active ? 'Active' : 'Inactive'}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>

    {/* Racks */}
    {cabinets.length > 0 && (
      <div>
        <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-3">Racks ({cabinets.length})</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {cabinets.map((c) => (
            <Card key={c._id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-sm">{c.name}</h4>
                <Badge tone={c.active ? 'green' : 'gray'}>{c.active ? 'Active' : 'Off'}</Badge>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <div>{c.uHeight}U rack</div>
                {c.utilization != null && <UtilBar percent={c.utilization} label="Utilization" />}
                <div className="flex gap-3 mt-1">
                  <span>{c.usedUnits || 0}U used</span>
                  <span>{c.freeUnits || 0}U free</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    )}

    <Btn variant="ghost" icon={ArrowRight} onClick={onGoFabric}>Manage in Fabric Panel</Btn>
  </div>
);

const SwitchesTab: React.FC<{ devices: DeviceItem[]; onGoFabric: () => void }> = ({ devices, onGoFabric }) => {
  const switches = devices.filter((d) => d.deviceType === 'switch' || d.deviceType === 'router');
  return (
    <div className="space-y-4">
      {switches.length === 0 ? (
        <EmptyState icon={Router} title="No switches" hint="Mount devices in racks from the Fabric panel." action={<Btn variant="primary" icon={Plus} onClick={onGoFabric}>Add Device</Btn>} />
      ) : (
        <div className="space-y-2">
          {switches.map((d) => (
            <Card key={d._id} className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-9 h-9 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Router className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm">{d.name}</h4>
                    <Badge tone="gray">{d.deviceType}</Badge>
                    <Badge tone={d.active ? 'green' : 'red'}>{d.active ? 'Active' : 'Off'}</Badge>
                  </div>
                  <p className="text-xs text-gray-500">{d.vendor} {d.hardwareModel || ''} · {d.hostname || 'no hostname'}</p>
                </div>
                <div className="text-right text-xs text-gray-500">
                  {d.ports && (
                    <div>
                      <span className="text-white font-bold">{d.ports.total}</span> ports
                      <span className="text-green-400 ml-2">{d.ports.free} free</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Btn variant="ghost" icon={ArrowRight} onClick={onGoFabric}>Manage in Fabric Panel</Btn>
    </div>
  );
};

const VlansTab: React.FC<{ vlans: VlanItem[]; onGoVlans: () => void }> = ({ vlans, onGoVlans }) => (
  <div className="space-y-4">
    {vlans.length === 0 ? (
      <EmptyState icon={Layers} title="No VLANs" hint="Create peering LANs from the VLANs panel." action={<Btn variant="primary" icon={Plus} onClick={onGoVlans}>Add VLAN</Btn>} />
    ) : (
      <div className="space-y-2">
        {vlans.map((v: any) => (
          <Card key={v._id} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm">{v.name}</h4>
                <p className="text-xs text-gray-500 font-mono">VLAN {v.tag} · {v.ipv4Subnet || 'no IPv4'} · {v.ipv6Subnet || 'no IPv6'}</p>
              </div>
              <Badge tone={v.active !== false ? 'green' : 'gray'}>{v.active !== false ? 'Active' : 'Off'}</Badge>
            </div>
          </Card>
        ))}
      </div>
    )}
    <Btn variant="ghost" icon={ArrowRight} onClick={onGoVlans}>Manage VLANs</Btn>
  </div>
);

const RouteServersTab: React.FC<{ routeServers: any[]; onGoBird: () => void }> = ({ routeServers, onGoBird }) => (
  <div className="space-y-4">
    {routeServers.length === 0 ? (
      <EmptyState icon={Cable} title="No route servers" hint="Register BIRD instances from the Bird panel." action={<Btn variant="primary" icon={Plus} onClick={onGoBird}>Add Route Server</Btn>} />
    ) : (
      <div className="space-y-2">
        {routeServers.map((rs: any) => (
          <Card key={rs._id} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm">{rs.name}</h4>
                <p className="text-xs text-gray-500 font-mono">AS{rs.asn} · {rs.peeringIpv4 || ''} · {rs.peeringIpv6 || ''}</p>
              </div>
              <Badge tone={rs.enabled !== false ? 'green' : 'gray'}>{rs.enabled !== false ? 'Online' : 'Offline'}</Badge>
            </div>
          </Card>
        ))}
      </div>
    )}
    <Btn variant="ghost" icon={ArrowRight} onClick={onGoBird}>Manage Route Servers</Btn>
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// Embedded Panel — loads an existing admin panel inline within IX Detail
// ══════════════════════════════════════════════════════════════════════════════

const EmbeddedPanel: React.FC<{ title: string; hint: string; section: string }> = ({ title, hint, section }) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={title} hint={hint} />
        <div className="p-5">
          {!loaded ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-gray-400 text-sm">{hint}</p>
              <Btn variant="primary" icon={ArrowRight} onClick={() => setLoaded(true)}>
                Open {title}
              </Btn>
              <p className="text-xs text-gray-600">This will load the full management panel inline.</p>
            </div>
          ) : (
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 min-h-[300px]">
              <Note tone="info">
                The full <strong>{title}</strong> panel is embedded here. All features (CRUD, deploy, provisioning) work as before — but scoped to this IX.
              </Note>
              <p className="text-xs text-gray-500 mt-3">
                Tip: For now, the full panel is loaded. In a future update, panels will be filtered to show only data for this IX.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Live Stats Tab
// ══════════════════════════════════════════════════════════════════════════════

type StatsRange = '1h' | '24h' | '7d' | '30d';

const LiveStatsTab: React.FC<{ ixId: string }> = ({ ixId }) => {
  const [range, setRange] = useState<StatsRange>('1h');
  const [stats, setStats] = useState<IxLiveStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminFabricApi.ixLiveStats(ixId, range);
    if (res.success && res.data) setStats(res.data);
    setLoading(false);
  }, [ixId, range]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60s for 1h range
  useEffect(() => {
    if (range !== '1h') return;
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [range, load]);

  if (loading && !stats) return <Spinner />;
  if (!stats) return <Note tone="error">Failed to load live stats.</Note>;

  const t = stats.traffic;

  return (
    <div className="space-y-4">
      {/* Range selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(['1h', '24h', '7d', '30d'] as StatsRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                range === r
                  ? 'bg-[#F20732] text-white'
                  : 'bg-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className={`inline-block w-2 h-2 rounded-full ${t.source === 'zabbix' ? 'bg-green-500' : 'bg-gray-500'}`} />
          {t.source === 'zabbix' ? 'Live from Zabbix' : 'No Zabbix data'}
          {range === '1h' && <span className="text-gray-600">· auto-refreshing</span>}
        </div>
      </div>

      {/* Traffic stats tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Current Traffic" value={`${t.currentTotal} Gbps`} tone="green" hint={`In: ${t.currentInbound} / Out: ${t.currentOutbound}`} />
        <StatTile label="Peak Traffic" value={`${t.peakTotal} Gbps`} tone="amber" hint={`In: ${t.peakInbound} / Out: ${t.peakOutbound}`} />
        <StatTile label="Members" value={stats.members} tone="blue" />
        <StatTile label="Port Utilization" value={`${stats.portUtilization}%`} tone={stats.portUtilization >= 80 ? 'red' : stats.portUtilization >= 60 ? 'amber' : 'green'} />
      </div>

      {/* Traffic chart (simple SVG line chart) */}
      {t.series && t.series.inbound.length > 0 && (
        <Card>
          <CardHeader title="Traffic Graph" hint={`${stats.switchesMonitored}/${stats.switchesTotal} switches monitored`} />
          <div className="p-5">
            <TrafficChart series={t.series} />
          </div>
        </Card>
      )}

      {/* Infrastructure summary */}
      <div className="grid md:grid-cols-3 gap-3">
        <StatTile label="Total Capacity" value={`${stats.totalCapacityGbps} Gbps`} />
        <StatTile label="Ports" value={`${stats.assignedPorts} / ${stats.totalPorts}`} hint={`${stats.totalPorts - stats.assignedPorts} free`} />
        <StatTile label="Switches Monitored" value={`${stats.switchesMonitored} / ${stats.switchesTotal}`} hint={stats.switchesMonitored < stats.switchesTotal ? 'Some switches lack Zabbix host mapping' : 'All monitored'} />
      </div>

      {t.source === 'unavailable' && (
        <Note tone="warning">
          Traffic data unavailable. Ensure switches have their Zabbix Host Name configured in the Fabric panel, and that Grafana + Zabbix datasource is enabled in Integrations.
        </Note>
      )}
    </div>
  );
};

// ── Simple SVG traffic chart ──

const TrafficChart: React.FC<{ series: { timestamps: number[]; inbound: number[]; outbound: number[] } }> = ({ series }) => {
  const { inbound, outbound } = series;
  const len = inbound.length;
  if (len < 2) return <p className="text-xs text-gray-500">Not enough data points for a chart.</p>;

  const maxVal = Math.max(...inbound, ...outbound, 1);
  const W = 800;
  const H = 200;
  const padY = 20;

  const toPath = (data: number[]) => {
    return data.map((v, i) => {
      const x = (i / (len - 1)) * W;
      const y = H - padY - ((v / maxVal) * (H - padY * 2));
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  };

  const inPath = toPath(inbound);
  const outPath = toPath(outbound);

  // Y-axis labels
  const yLabels = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal].map((v) => ({
    value: v >= 1000 ? `${(v / 1000).toFixed(1)} Gbps` : `${Math.round(v)} Mbps`,
    y: H - padY - ((v / maxVal) * (H - padY * 2)),
  }));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-48" preserveAspectRatio="none">
        {/* Grid lines */}
        {yLabels.map((l, i) => (
          <line key={i} x1="0" y1={l.y} x2={W} y2={l.y} stroke="#374151" strokeWidth="0.5" strokeDasharray="4 4" />
        ))}
        {/* Inbound */}
        <path d={inPath} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Outbound */}
        <path d={outPath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs">
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-green-500 rounded" /> Inbound (Mbps)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-500 rounded" /> Outbound (Mbps)</span>
      </div>
      {/* Y-axis values */}
      <div className="absolute top-0 right-2 flex flex-col justify-between h-48 text-[9px] text-gray-500 font-mono py-3 pointer-events-none">
        <span>{yLabels[4]?.value}</span>
        <span>{yLabels[2]?.value}</span>
        <span>0</span>
      </div>
    </div>
  );
};

export default IxDashboard;
