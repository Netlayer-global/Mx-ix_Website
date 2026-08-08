import React, { useCallback, useEffect, useState } from 'react';
import {
  Cable,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  FileText,
  UserPlus,
  ArrowRight,
} from 'lucide-react';
import {
  adminPatchPanelsApi,
  adminFabricApi,
  adminCustomersApi,
  PatchPanelItem,
  PatchPanelPortItem,
  FacilityItem,
  CustomerOrg,
  PatchPortState,
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
  fmtNumber,
  fmtDate,
  Tone,
} from './admin/ui';

interface Props {
  embedded?: boolean;
  onBack?: () => void;
}

const STATE_TONES: Record<PatchPortState, Tone> = {
  available: 'green',
  reserved: 'amber',
  'awaiting-loa': 'amber',
  'awaiting-xconnect': 'blue',
  connected: 'green',
  'awaiting-cease': 'orange',
  ceased: 'gray',
  broken: 'red',
  decommissioned: 'gray',
};

const STATE_LABELS: Record<PatchPortState, string> = {
  available: 'Available',
  reserved: 'Reserved',
  'awaiting-loa': 'Awaiting LOA',
  'awaiting-xconnect': 'Awaiting X-Connect',
  connected: 'Connected',
  'awaiting-cease': 'Cease Requested',
  ceased: 'Ceased',
  broken: 'Broken',
  decommissioned: 'Decommissioned',
};

/**
 * Patch panels & cross-connect tracking.
 *
 * Flow: Create panel → ports auto-generate → assign port to member (LOA code generated)
 * → colo patches it → mark connected → member leaves → cease → recycle.
 */
const PatchPanelsAdminPanel: React.FC<Props> = ({ embedded, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [panels, setPanels] = useState<PatchPanelItem[]>([]);
  const [facilities, setFacilities] = useState<FacilityItem[]>([]);
  const [stats, setStats] = useState<{ total: number; byState: Record<string, number> } | null>(null);

  const [selectedPanel, setSelectedPanel] = useState<PatchPanelItem | null>(null);
  const [ports, setPorts] = useState<PatchPanelPortItem[]>([]);
  const [portFilter, setPortFilter] = useState<PatchPortState | ''>('');

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PatchPanelItem | null>(null);
  const [assigning, setAssigning] = useState<PatchPanelItem | null>(null);
  const [editingPort, setEditingPort] = useState<PatchPanelPortItem | null>(null);

  const load = useCallback(async () => {
    const [pRes, fRes, sRes] = await Promise.all([
      adminPatchPanelsApi.list(),
      adminFabricApi.listFacilities(),
      adminPatchPanelsApi.stats(),
    ]);
    if (pRes.success && pRes.data) setPanels(pRes.data);
    else setError(pRes.error || 'Could not load panels.');
    if (fRes.success && fRes.data) setFacilities(fRes.data);
    if (sRes.success && sRes.data) setStats(sRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadPorts = useCallback(async (panelId: string) => {
    const res = await adminPatchPanelsApi.listPorts(panelId, portFilter || undefined);
    if (res.success && res.data) setPorts(res.data);
  }, [portFilter]);

  useEffect(() => {
    if (selectedPanel) loadPorts(selectedPanel._id);
  }, [selectedPanel, loadPorts]);

  const removePanel = async (p: PatchPanelItem) => {
    if (!confirm(`Delete panel "${p.name}"? All ports go with it.`)) return;
    const res = await adminPatchPanelsApi.remove(p._id);
    if (!res.success) setError(res.error || 'Delete failed.');
    else { setSelectedPanel(null); load(); }
  };

  if (loading) return <Spinner label="Loading patch panels…" />;

  const available = stats?.byState?.available || 0;
  const connected = stats?.byState?.connected || 0;
  const awaitingXc = stats?.byState?.['awaiting-xconnect'] || 0;

  return (
    <PanelShell
      title="Patch Panels"
      subtitle="Cross-connects, LOAs & fibre lifecycle"
      icon={Cable}
      embedded={embedded}
      onBack={onBack}
      actions={
        <>
          <Btn icon={RefreshCw} size="sm" onClick={load} />
          <Btn icon={Plus} variant="primary" size="sm" onClick={() => setCreating(true)}>
            Add panel
          </Btn>
        </>
      }
    >
      {error && <Note tone="error" onDismiss={() => setError('')}>{error}</Note>}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatTile label="Total ports" value={fmtNumber(stats?.total)} />
        <StatTile label="Available" value={fmtNumber(available)} tone="green" />
        <StatTile label="Connected" value={fmtNumber(connected)} tone="blue" />
        <StatTile label="Awaiting X-Connect" value={fmtNumber(awaitingXc)} tone={awaitingXc ? 'amber' : undefined} />
        <StatTile label="Panels" value={panels.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel list */}
        <Card className="lg:col-span-1">
          <CardHeader title="Panels" hint="Click to see ports" />
          {!panels.length ? (
            <div className="p-4"><EmptyState icon={Cable} title="No panels" action={<Btn icon={Plus} variant="primary" size="sm" onClick={() => setCreating(true)}>Add panel</Btn>} /></div>
          ) : (
            <div className="divide-y divide-gray-700/60 max-h-[60vh] overflow-y-auto">
              {panels.map((p) => (
                <button
                  key={p._id}
                  onClick={() => setSelectedPanel(p)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-700/30 transition-colors ${
                    selectedPanel?._id === p._id ? 'bg-[#F20732]/10 border-l-2 border-[#F20732]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">{p.name}</div>
                      <div className="font-mono text-[11px] text-gray-500">
                        {p.facility?.name || '—'} · {p.connectorType} {p.mediaType} · {p.portCount}p{p.duplex ? ' duplex' : ''}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {p.portStates?.available && <Badge tone="green">{p.portStates.available}</Badge>}
                      {p.portStates?.connected && <Badge tone="blue">{p.portStates.connected}</Badge>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Port detail */}
        <Card className="lg:col-span-2">
          {!selectedPanel ? (
            <div className="p-8"><EmptyState icon={FileText} title="Select a panel" hint="Click a panel on the left to see its ports and cross-connect status." /></div>
          ) : (
            <>
              <CardHeader
                title={selectedPanel.name}
                hint={`${selectedPanel.facility?.name || '—'} · ${selectedPanel.connectorType} ${selectedPanel.mediaType} · Far end: ${selectedPanel.farEndLocation || '—'}`}
                actions={
                  <>
                    <Btn icon={UserPlus} size="sm" onClick={() => setAssigning(selectedPanel)}>Assign to member</Btn>
                    <Btn icon={Pencil} size="sm" onClick={() => setEditing(selectedPanel)} title="Edit panel" />
                    <Btn icon={Trash2} variant="danger" size="sm" onClick={() => removePanel(selectedPanel)} title="Delete" />
                  </>
                }
              />

              {/* Port state filter */}
              <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-gray-700 overflow-x-auto">
                <button
                  onClick={() => setPortFilter('')}
                  className={`px-2.5 py-1 rounded font-mono text-[10px] uppercase tracking-wider transition-colors flex-shrink-0 ${
                    !portFilter ? 'bg-[#F20732] text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  All
                </button>
                {(Object.keys(STATE_LABELS) as PatchPortState[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setPortFilter(s)}
                    className={`px-2.5 py-1 rounded font-mono text-[10px] uppercase tracking-wider transition-colors flex-shrink-0 ${
                      portFilter === s ? 'bg-[#F20732] text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {STATE_LABELS[s]}
                  </button>
                ))}
              </div>

              {!ports.length ? (
                <div className="p-4"><EmptyState title="No ports match" /></div>
              ) : (
                <Table head={['#', 'State', 'Member', 'LOA', 'X-Connect Ref', 'Switch Port', 'Duplex', '']} dense>
                  {ports.map((port) => (
                    <tr key={port._id} className="hover:bg-gray-700/20">
                      <Td className="font-mono text-xs font-bold">{port.name || port.number}</Td>
                      <Td><Badge tone={STATE_TONES[port.state]}>{STATE_LABELS[port.state]}</Badge></Td>
                      <Td className="text-xs">
                        {port.organization ? (
                          <span>{port.organization.name}{port.organization.asn ? <span className="font-mono text-gray-500"> AS{port.organization.asn}</span> : ''}</span>
                        ) : '—'}
                      </Td>
                      <Td className="font-mono text-xs text-gray-400">{port.loaCode || '—'}</Td>
                      <Td className="font-mono text-xs text-gray-400">{port.xconnectRef || '—'}</Td>
                      <Td className="font-mono text-xs text-gray-400">{port.switchPort?.name || '—'}</Td>
                      <Td className="text-xs text-gray-400">
                        {port.duplexPartner ? `↔ ${port.duplexPartner.name || `#${port.duplexPartner.number}`}` : '—'}
                      </Td>
                      <Td>
                        <Btn icon={Pencil} variant="danger" size="sm" onClick={() => setEditingPort(port)} title="Edit port" />
                      </Td>
                    </tr>
                  ))}
                </Table>
              )}
            </>
          )}
        </Card>
      </div>

      {/* Create/Edit panel modal */}
      {(creating || editing) && (
        <PanelForm
          row={editing || undefined}
          facilities={facilities}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); load(); }}
        />
      )}

      {/* Assign port to member */}
      {assigning && (
        <AssignModal
          panel={assigning}
          onClose={() => setAssigning(null)}
          onSaved={() => { setAssigning(null); if (selectedPanel) loadPorts(selectedPanel._id); load(); }}
        />
      )}

      {/* Edit port state/details */}
      {editingPort && selectedPanel && (
        <PortEditModal
          port={editingPort}
          panelId={selectedPanel._id}
          onClose={() => setEditingPort(null)}
          onSaved={() => { setEditingPort(null); if (selectedPanel) loadPorts(selectedPanel._id); load(); }}
        />
      )}
    </PanelShell>
  );
};

// ── Panel create/edit form ──

const PanelForm: React.FC<{
  row?: PatchPanelItem;
  facilities: FacilityItem[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ row, facilities, onClose, onSaved }) => {
  const [form, setForm] = useState({
    facility: row?.facility?._id || row?.facility || facilities[0]?._id || '',
    name: row?.name || '',
    portCount: String(row?.portCount ?? 24),
    duplex: row?.duplex ?? true,
    connectorType: row?.connectorType || 'LC',
    mediaType: row?.mediaType || 'SMF',
    farEndLocation: row?.farEndLocation || '',
    providerRef: row?.providerRef || '',
    portNamePrefix: row?.portNamePrefix || 'P',
    active: row?.active ?? true,
    notes: row?.notes || '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setErr('');
    const payload: any = {
      facility: form.facility,
      name: form.name.trim(),
      portCount: Number(form.portCount) || 24,
      duplex: form.duplex,
      connectorType: form.connectorType,
      mediaType: form.mediaType,
      farEndLocation: form.farEndLocation.trim(),
      providerRef: form.providerRef.trim(),
      portNamePrefix: form.portNamePrefix.trim() || 'P',
      active: form.active,
      notes: form.notes,
    };
    setBusy(true);
    const res = row ? await adminPatchPanelsApi.update(row._id, payload) : await adminPatchPanelsApi.create(payload);
    setBusy(false);
    if (res.success) onSaved();
    else setErr(res.error || 'Save failed.');
  };

  return (
    <Modal
      title={row ? `Edit ${row.name}` : 'New patch panel'}
      hint="Ports are auto-generated on create. For a 12-duplex panel, enter 24 ports."
      onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" busy={busy} onClick={save}>{row ? 'Save' : 'Create'}</Btn></>}
    >
      {err && <Note tone="error">{err}</Note>}
      <Grid>
        <Fld label="Facility">
          <select className={field} value={form.facility} onChange={(e) => setForm({ ...form, facility: e.target.value })}>
            {facilities.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
          </select>
        </Fld>
        <Fld label="Panel name">
          <input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="MB2-R12-PP01" />
        </Fld>
        <Fld label="Port count" hint="For duplex panels: count physical ports (12 duplex = 24)">
          <input className={field} value={form.portCount} onChange={(e) => setForm({ ...form, portCount: e.target.value })} />
        </Fld>
        <Fld label="Port name prefix">
          <input className={field} value={form.portNamePrefix} onChange={(e) => setForm({ ...form, portNamePrefix: e.target.value })} placeholder="P" />
        </Fld>
        <Fld label="Connector type">
          <select className={field} value={form.connectorType} onChange={(e) => setForm({ ...form, connectorType: e.target.value as any })}>
            {['LC', 'SC', 'MPO', 'MTP', 'RJ45', 'ST', 'Other'].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Fld>
        <Fld label="Media type">
          <select className={field} value={form.mediaType} onChange={(e) => setForm({ ...form, mediaType: e.target.value as any })}>
            {['SMF', 'MMF-OM3', 'MMF-OM4', 'MMF-OM5', 'Copper', 'Other'].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Fld>
        <Fld label="Far-end location" hint="Where the far end of this panel goes" span>
          <input className={field} value={form.farEndLocation} onChange={(e) => setForm({ ...form, farEndLocation: e.target.value })} placeholder="Meet-me room A, rack 3" />
        </Fld>
        <Fld label="Provider reference" hint="Colo's identifier for this panel/trunk">
          <input className={field} value={form.providerRef} onChange={(e) => setForm({ ...form, providerRef: e.target.value })} />
        </Fld>
      </Grid>
      <Toggle checked={form.duplex} onChange={(v) => setForm({ ...form, duplex: v })} label="Duplex panel" hint="Ports are allocated in pairs (Tx/Rx)." />
      <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Active" />
      <Fld label="Notes"><textarea className={`${field} h-20`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Fld>
    </Modal>
  );
};

// ── Assign port to member ──

const AssignModal: React.FC<{
  panel: PatchPanelItem;
  onClose: () => void;
  onSaved: () => void;
}> = ({ panel, onClose, onSaved }) => {
  const [customers, setCustomers] = useState<CustomerOrg[]>([]);
  const [orgId, setOrgId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    adminCustomersApi.list().then((res) => {
      if (res.success && res.data) setCustomers(res.data);
    });
  }, []);

  const assign = async () => {
    setErr('');
    if (!orgId) return setErr('Select a member.');
    setBusy(true);
    const res = await adminPatchPanelsApi.assignPort(panel._id, { organizationId: orgId });
    setBusy(false);
    if (res.success) onSaved();
    else setErr(res.error || 'Assignment failed.');
  };

  return (
    <Modal
      title={`Assign port — ${panel.name}`}
      hint="Picks the next available port, generates a unique LOA code, and moves it to 'Awaiting LOA' state. For duplex panels, the partner port is auto-paired."
      onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" icon={UserPlus} busy={busy} onClick={assign}>Assign</Btn></>}
    >
      {err && <Note tone="error">{err}</Note>}
      <Fld label="Member" hint="Who this cross-connect is for">
        <select className={field} value={orgId} onChange={(e) => setOrgId(e.target.value)}>
          <option value="">Select a member…</option>
          {customers.map((c) => <option key={c._id} value={c._id}>{c.name}{c.asn ? ` (AS${c.asn})` : ''}</option>)}
        </select>
      </Fld>
      <Note tone="info">
        The LOA code is auto-generated and unique. Give it to the member and quote it to the colo when ordering the cross-connect.
      </Note>
    </Modal>
  );
};

// ── Port state edit ──

const PortEditModal: React.FC<{
  port: PatchPanelPortItem;
  panelId: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ port, panelId, onClose, onSaved }) => {
  const [state, setState] = useState(port.state);
  const [xconnectRef, setXconnectRef] = useState(port.xconnectRef || '');
  const [customerRef, setCustomerRef] = useState(port.customerRef || '');
  const [opticalLoss, setOpticalLoss] = useState(port.opticalLossDb != null ? String(port.opticalLossDb) : '');
  const [notes, setNotes] = useState(port.notes || '');
  const [memberNotes, setMemberNotes] = useState(port.memberVisibleNotes || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setErr('');
    const payload: any = {
      state,
      xconnectRef: xconnectRef.trim(),
      customerRef: customerRef.trim(),
      notes,
      memberVisibleNotes: memberNotes,
    };
    if (opticalLoss) payload.opticalLossDb = Number(opticalLoss);
    setBusy(true);
    const res = await adminPatchPanelsApi.updatePort(panelId, port._id, payload);
    setBusy(false);
    if (res.success) onSaved();
    else setErr(res.error || 'Save failed.');
  };

  // State transition flow arrows
  const transitions: Record<string, PatchPortState[]> = {
    available: ['reserved', 'awaiting-loa'],
    reserved: ['awaiting-loa', 'available'],
    'awaiting-loa': ['awaiting-xconnect', 'available'],
    'awaiting-xconnect': ['connected', 'available'],
    connected: ['awaiting-cease', 'broken'],
    'awaiting-cease': ['ceased'],
    ceased: ['available'],
    broken: ['available', 'decommissioned'],
    decommissioned: [],
  };
  const allowed = transitions[port.state] || [];

  return (
    <Modal
      title={`Port ${port.name || port.number} — ${STATE_LABELS[port.state]}`}
      hint={port.loaCode ? `LOA: ${port.loaCode}` : 'No LOA issued yet'}
      onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" busy={busy} onClick={save}>Save</Btn></>}
    >
      {err && <Note tone="error">{err}</Note>}

      {/* Key dates */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 font-mono text-[11px]">
        {[
          ['Assigned', port.assignedAt],
          ['LOA issued', port.loaIssuedAt],
          ['Connected', port.connectedAt],
          ['Ceased', port.ceasedAt],
        ].map(([label, val]) => (
          <div key={label as string}>
            <span className="text-gray-500 uppercase tracking-wider">{label}</span>
            <div className="text-gray-300">{val ? fmtDate(val as string) : '—'}</div>
          </div>
        ))}
      </div>

      <Fld label="State transition" hint="Only valid next states are shown.">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone={STATE_TONES[port.state]}>{STATE_LABELS[port.state]}</Badge>
          {allowed.length > 0 && <ArrowRight className="w-4 h-4 text-gray-500" />}
          {allowed.map((s) => (
            <button
              key={s}
              onClick={() => setState(s)}
              className={`px-2.5 py-1 rounded font-mono text-[10px] uppercase tracking-wider border transition-colors ${
                state === s
                  ? 'bg-[#F20732] text-white border-[#F20732]'
                  : 'border-gray-600 text-gray-400 hover:text-white hover:border-gray-400'
              }`}
            >
              {STATE_LABELS[s]}
            </button>
          ))}
        </div>
      </Fld>

      {state === 'available' && port.state !== 'available' && (
        <Note tone="warning">Recycling this port clears all tracking data (member, LOA, refs, dates).</Note>
      )}

      <Grid>
        <Fld label="Colo X-Connect ref" hint="The colo provider's order/ref number">
          <input className={field} value={xconnectRef} onChange={(e) => setXconnectRef(e.target.value)} />
        </Fld>
        <Fld label="Customer ref" hint="Member's own reference, so their tickets match up">
          <input className={field} value={customerRef} onChange={(e) => setCustomerRef(e.target.value)} />
        </Fld>
        <Fld label="Optical loss (dB)" hint="Measured at handover">
          <input className={field} value={opticalLoss} onChange={(e) => setOpticalLoss(e.target.value)} placeholder="e.g. 2.3" />
        </Fld>
      </Grid>
      <Fld label="Internal notes">
        <textarea className={`${field} h-16`} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Fld>
      <Fld label="Member-visible notes" hint="Shown to the member in their portal">
        <textarea className={`${field} h-16`} value={memberNotes} onChange={(e) => setMemberNotes(e.target.value)} />
      </Fld>
    </Modal>
  );
};

export default PatchPanelsAdminPanel;
