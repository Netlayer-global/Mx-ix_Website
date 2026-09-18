import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  Network,
  Phone,
  FileText,
  ShoppingCart,
  LifeBuoy,
  BarChart3,
  Receipt,
  Globe2,
  ArrowRight,
  Loader2,
  ChevronLeft,
  Users,
  Wand2,
  Cable,
  Activity,
  Ban,
  PlayCircle,
  Upload,
  Download,
} from 'lucide-react';
import {
  adminCustomersApi,
  adminContactsApi,
  adminDocumentsApi,
  adminOrdersApi,
  adminPeersApi,
  adminFabricApi,
  adminBillingApi,
  DocCategory,
  DOCUMENT_MAX_BYTES,
  CustomerOrg,
  CustomerUser,
  PortItem,
  OrderItem,
  ConnectionItem,
  MemberContactItem,
} from '../services/api';

interface Props {
  embedded?: boolean;
  orgId: string;
  onBack?: () => void;
  onProvision?: (orgId: string, orgName: string) => void;
}

type Tab = 'overview' | 'connections' | 'contacts' | 'orders' | 'tickets' | 'documents' | 'billing';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: Building2 },
  { id: 'connections', label: 'Connections', icon: Network },
  { id: 'billing', label: 'Billing', icon: Receipt },
  { id: 'contacts', label: 'Contacts', icon: Phone },
  { id: 'orders', label: 'Orders', icon: ShoppingCart },
  { id: 'tickets', label: 'Tickets', icon: LifeBuoy },
  { id: 'documents', label: 'Documents', icon: FileText },
];

const Customer360Panel: React.FC<Props> = ({ embedded, orgId, onBack, onProvision }) => {
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<CustomerOrg | null>(null);
  const [users, setUsers] = useState<CustomerUser[]>([]);
  const [ports, setPorts] = useState<PortItem[]>([]);
  const [contacts, setContacts] = useState<MemberContactItem[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [statusAction, setStatusAction] = useState<'suspend' | 'activate' | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [orgRes, connRes, contactRes, docRes, orderRes] = await Promise.all([
      adminCustomersApi.get(orgId),
      adminPeersApi.listConnections(),
      adminContactsApi.list(orgId),
      adminDocumentsApi.list(orgId),
      adminOrdersApi.list(),
    ]);
    if (orgRes.success && orgRes.data) {
      setOrg(orgRes.data.organization);
      setUsers(orgRes.data.users || []);
      setPorts(orgRes.data.ports || []);
    }
    if (connRes.success && connRes.data) {
      // Filter connections for this org
      setConnections(connRes.data.filter((c: any) => String(c.organization?._id || c.organization) === orgId));
    }
    if (contactRes.success && contactRes.data) setContacts(contactRes.data);
    if (docRes.success && docRes.data) setDocuments(docRes.data);
    if (orderRes.success && orderRes.data) {
      setOrders(orderRes.data.filter((o: any) => o.organization === orgId));
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async () => {
    if (!statusAction || !org) return;
    setStatusBusy(true);
    const newStatus = statusAction === 'suspend' ? 'suspended' : 'active';
    const res = await adminCustomersApi.setStatus(orgId, newStatus as any, suspendReason || undefined);
    if (res.success) {
      setOrg({ ...org, status: newStatus as any });
    }
    setStatusBusy(false);
    setStatusAction(null);
    setSuspendReason('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#F20732]" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <p className="text-red-400">Customer not found.</p>
        {onBack && <button onClick={onBack} className="mt-4 text-sm text-gray-400 hover:text-white">← Back</button>}
      </div>
    );
  }

  const statusColor = org.status === 'active' ? 'text-green-400' : org.status === 'pending' ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="min-h-screen bg-gray-900 text-white admin-panel">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-5 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            {onBack && (
              <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-lg">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#F20732] rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl font-black tracking-tight truncate">{org.name}</h1>
                  <div className="flex items-center gap-3 mt-1 text-sm">
                    {org.asn && <span className="font-mono text-gray-400">AS{org.asn}</span>}
                    <span className={`font-mono text-xs uppercase ${statusColor}`}>● {org.status}</span>
                    {org.type && <span className="text-gray-500">{org.type}</span>}
                    {org.peeringPolicy && <span className="text-gray-500">Policy: {org.peeringPolicy}</span>}
                  </div>
                </div>
              </div>
            </div>
            {onProvision && (
              <button
                onClick={() => onProvision(orgId, org.name)}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 rounded font-bold text-sm hover:bg-green-500 transition-colors"
              >
                <Wand2 className="w-4 h-4" /> Provision Port
              </button>
            )}
            {/* Suspend / Activate */}
            {org.status === 'active' && (
              <button
                onClick={() => setStatusAction('suspend')}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-600/20 border border-red-500/40 text-red-400 rounded font-bold text-sm hover:bg-red-600/30 transition-colors cursor-pointer"
              >
                <Ban className="w-4 h-4" /> Suspend
              </button>
            )}
            {org.status === 'suspended' && (
              <button
                onClick={() => setStatusAction('activate')}
                className="flex items-center gap-2 px-4 py-2.5 bg-green-600/20 border border-green-500/40 text-green-400 rounded font-bold text-sm hover:bg-green-600/30 transition-colors cursor-pointer"
              >
                <PlayCircle className="w-4 h-4" /> Activate
              </button>
            )}
          </div>

          {/* Tabs */}
          <nav className="flex items-center gap-1 mt-5 -mb-5 overflow-x-auto scrollbar-hide">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3 font-mono text-xs uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? 'border-[#F20732] text-white'
                    : 'border-transparent text-gray-500 hover:text-white'
                }`}
              >
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Suspend/Activate Confirmation Modal */}
      {statusAction && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold">
              {statusAction === 'suspend' ? '⚠️ Suspend Member' : '✅ Activate Member'}
            </h3>
            <p className="text-sm text-gray-400">
              {statusAction === 'suspend'
                ? `This will set ${org.name} to suspended and redeploy route servers. Their BGP sessions will be removed from the RS config.`
                : `This will reactivate ${org.name} and redeploy route servers. Their BGP sessions will be restored.`}
            </p>
            {statusAction === 'suspend' && (
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-gray-400 mb-1.5">Reason (optional)</label>
                <input
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#F20732] transition-colors"
                  placeholder="e.g. Overdue invoice, policy violation..."
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                />
              </div>
            )}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleStatusChange}
                disabled={statusBusy}
                className={`flex items-center gap-2 px-5 py-2.5 rounded font-bold text-sm transition-colors disabled:opacity-50 cursor-pointer ${
                  statusAction === 'suspend'
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-green-600 hover:bg-green-500 text-white'
                }`}
              >
                {statusBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                {statusAction === 'suspend' ? 'Confirm Suspend' : 'Confirm Activate'}
              </button>
              <button
                onClick={() => { setStatusAction(null); setSuspendReason(''); }}
                className="px-5 py-2.5 bg-gray-700 rounded font-bold text-sm hover:bg-gray-600 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-8">
        {tab === 'overview' && (
          <OverviewTab
            org={org}
            ports={ports}
            users={users}
            connections={connections}
            contacts={contacts}
            orders={orders}
            documents={documents}
          />
        )}
        {tab === 'connections' && <ConnectionsTab connections={connections} ports={ports} />}
        {tab === 'contacts' && <ContactsTab contacts={contacts} />}
        {tab === 'orders' && <OrdersTab orders={orders} />}
        {tab === 'tickets' && <TicketsTab orgName={org.name} />}
        {tab === 'documents' && <DocumentsTab documents={documents} orgId={orgId} onChanged={load} />}
        {tab === 'billing' && <BillingTab orgId={orgId} />}
      </main>
    </div>
  );
};

// ── Overview Tab ──
const OverviewTab: React.FC<{
  org: CustomerOrg;
  ports: PortItem[];
  users: CustomerUser[];
  connections: ConnectionItem[];
  contacts: MemberContactItem[];
  orders: OrderItem[];
  documents: any[];
}> = ({ org, ports, users, connections, contacts, orders, documents }) => {
  const activePorts = ports.filter((p) => p.status === 'active').length;
  const openOrders = orders.filter((o) => !['completed', 'rejected', 'cancelled'].includes(o.status)).length;

  return (
    <div className="space-y-6">
      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <QuickStat icon={Network} label="Ports" value={ports.length} sub={`${activePorts} active`} />
        <QuickStat icon={Cable} label="Connections" value={connections.length} />
        <QuickStat icon={Phone} label="Contacts" value={contacts.length} />
        <QuickStat icon={ShoppingCart} label="Open Orders" value={openOrders} />
        <QuickStat icon={Users} label="Logins" value={users.length} />
        <QuickStat icon={FileText} label="Documents" value={documents.length} />
      </div>

      {/* Profile details */}
      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <h3 className="font-bold mb-4 flex items-center gap-2"><Globe2 className="w-4 h-4 text-[#F20732]" /> Profile</h3>
          <dl className="space-y-2 text-sm">
            {org.asn && <DlRow label="Primary ASN" value={`AS${org.asn}`} />}
            {org.website && <DlRow label="Website" value={org.website} link />}
            {org.type && <DlRow label="Type" value={org.type} />}
            {org.peeringPolicy && <DlRow label="Peering Policy" value={org.peeringPolicy} />}
            {org.nocEmail && <DlRow label="NOC Email" value={org.nocEmail} />}
            {org.nocPhone && <DlRow label="NOC Phone" value={org.nocPhone} />}
            {(org.locations || []).length > 0 && <DlRow label="Locations" value={org.locations!.join(', ')} />}
          </dl>
        </section>

        <section className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <h3 className="font-bold mb-4 flex items-center gap-2"><Network className="w-4 h-4 text-[#F20732]" /> Active Ports</h3>
          {ports.length ? (
            <div className="space-y-2">
              {ports.slice(0, 5).map((p) => (
                <div key={p._id} className="bg-gray-900 border border-gray-700 rounded p-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm">{p.name}</span>
                    <span className="text-xs text-gray-500 ml-2">{p.speed} · {p.location || '—'}</span>
                  </div>
                  <span className={`text-[10px] uppercase font-mono ${p.status === 'active' ? 'text-green-400' : 'text-amber-400'}`}>
                    {p.status}
                  </span>
                </div>
              ))}
              {ports.length > 5 && <p className="text-xs text-gray-500">+{ports.length - 5} more</p>}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No ports provisioned yet.</p>
          )}
        </section>
      </div>

      {/* Recent orders */}
      {orders.length > 0 && (
        <section className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <h3 className="font-bold mb-4 flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-[#F20732]" /> Recent Orders</h3>
          <div className="space-y-2">
            {orders.slice(0, 3).map((o) => (
              <div key={o._id} className="bg-gray-900 border border-gray-700 rounded p-3 flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm">{o.type === 'new_port' ? 'New Port' : o.type === 'upgrade' ? 'Upgrade' : 'Add-on'}</span>
                  <span className="text-xs text-gray-500 ml-2">{o.speed} @ {o.location}</span>
                </div>
                <span className={`text-[10px] uppercase font-mono ${
                  o.status === 'completed' ? 'text-green-400' : o.status === 'rejected' ? 'text-red-400' : 'text-amber-400'
                }`}>
                  {o.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

// ── Connections Tab with Physical Path ──
const ConnectionsTab: React.FC<{ connections: ConnectionItem[]; ports: PortItem[] }> = ({ connections, ports }) => {
  return (
  <div className="space-y-4">
    {connections.length ? connections.map((c) => (
      <div key={c._id} className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between border-b border-gray-700">
          <h4 className="font-bold">{c.name}</h4>
          <span className="text-xs font-mono text-gray-500">
            {c.capacityMbps ? `${c.capacityMbps >= 1000 ? `${c.capacityMbps / 1000}G` : `${c.capacityMbps}M`}` : '—'}
            {c.lagFraming !== 'none' && c.ports?.length > 1 ? ` LAG (${c.lagFraming})` : ''}
          </span>
        </div>

        {/* Physical path for each port in the connection */}
        <div className="p-5 space-y-3">
          {(c.ports || []).map((p: any, idx: number) => (
            <div key={p.id || idx} className="bg-gray-900 border border-gray-700 rounded p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 bg-[#F20732] rounded flex items-center justify-center text-[10px] font-bold">{idx + 1}</span>
                <span className="font-bold text-sm">Physical Path</span>
                <span className={`ml-auto text-[10px] uppercase font-mono ${p.status === 'active' ? 'text-green-400' : 'text-amber-400'}`}>
                  {p.status || 'active'}
                </span>
              </div>

              {/* Path visualization */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <PathChip icon="🏢" label="Data Center" value={p.facilityName || '—'} />
                <PathArrow />
                <PathChip icon="📦" label="Rack" value={p.cabinetName || '—'} />
                <PathArrow />
                <PathChip icon="🖥️" label="Switch" value={p.switchName || '—'} />
                <PathArrow />
                <PathChip icon="🔌" label="Port" value={p.portName || '—'} />
                {p.xconnectRef && (
                  <>
                    <PathArrow />
                    <PathChip icon="🔗" label="X-Connect" value={p.xconnectRef} />
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-xs">
                <div><span className="text-gray-500 block">Speed</span><span className="font-mono">{p.speed >= 1000 ? `${p.speed / 1000}G` : `${p.speed}M`}</span></div>
                <div><span className="text-gray-500 block">Switch</span><span className="font-mono">{p.switchName || '—'}</span></div>
                <div><span className="text-gray-500 block">Port</span><span className="font-mono">{p.portName || '—'}</span></div>
                <div><span className="text-gray-500 block">Location</span><span>{p.facilityName || '—'}</span></div>
              </div>

              {/* Port info */}
            </div>
          ))}

          {/* Peering / IP info */}
          {(c.peers || []).map((peer: any, idx: number) => (
            <div key={peer.id || idx} className="bg-gray-900/50 border border-gray-700/50 rounded p-4">
              <h5 className="text-xs uppercase tracking-wider text-gray-500 font-mono mb-3">Peering Session {idx + 1}</h5>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-gray-500 text-xs block">VLAN</span>
                  <span className="font-mono">{peer.vlan?.name || '—'} (#{peer.vlan?.number || '—'})</span>
                </div>
                <div>
                  <span className="text-gray-500 text-xs block">IPv4</span>
                  <span className="font-mono text-green-400">{peer.ipv4 || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500 text-xs block">IPv6</span>
                  <span className="font-mono text-green-400">{peer.ipv6 || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500 text-xs block">Route Server</span>
                  <span className={`font-mono ${peer.rsClient ? 'text-green-400' : 'text-gray-500'}`}>
                    {peer.rsClient ? `Yes (${peer.rsMode})` : 'No'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )) : (
      <p className="text-gray-500 text-sm py-8 text-center">No connections provisioned. Use "Provision Port" to create one.</p>
    )}

    {ports.length > 0 && !connections.length && (
      <div className="mt-6">
        <h4 className="font-bold mb-3 text-gray-400 text-sm">Legacy Port Records</h4>
        <div className="space-y-2">
          {ports.map((p) => (
            <div key={p._id} className="bg-gray-800/50 border border-gray-700/50 rounded p-3 flex items-center justify-between text-sm">
              <span>{p.name} · {p.speed} · {p.location || '—'}</span>
              <span className="text-[10px] uppercase font-mono text-gray-500">{p.status}</span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
  );
};

const PathChip: React.FC<{ icon: string; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex-shrink-0 bg-gray-800 border border-gray-600 rounded px-3 py-2 min-w-[100px]">
    <div className="flex items-center gap-1.5 mb-1">
      <span className="text-xs">{icon}</span>
      <span className="text-[9px] uppercase tracking-wider text-gray-500 font-mono">{label}</span>
    </div>
    <span className="text-sm font-bold truncate block">{value}</span>
  </div>
);

const PathArrow: React.FC = () => (
  <span className="text-gray-600 flex-shrink-0">→</span>
);

// ── Contacts Tab ──
const ContactsTab: React.FC<{ contacts: MemberContactItem[] }> = ({ contacts }) => (
  <div className="space-y-2">
    {contacts.length ? contacts.map((c) => (
      <div key={c._id} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center gap-4">
        <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold">
          {c.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm">{c.name} <span className="text-[10px] uppercase text-gray-500 ml-2">{c.role}</span></div>
          <div className="text-xs text-gray-400">{c.email}{c.phone ? ` · ${c.phone}` : ''}</div>
        </div>
      </div>
    )) : (
      <p className="text-gray-500 text-sm py-8 text-center">No contacts added yet.</p>
    )}
  </div>
);

// ── Orders Tab ──
const OrdersTab: React.FC<{ orders: OrderItem[] }> = ({ orders }) => (
  <div className="space-y-2">
    {orders.length ? orders.map((o) => (
      <div key={o._id} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center justify-between">
        <div>
          <span className="font-bold text-sm">{o.type === 'new_port' ? 'New Port' : o.type === 'upgrade' ? 'Upgrade' : 'Add-on'}</span>
          <span className="text-xs text-gray-500 ml-2">{o.speed} @ {o.location} · {new Date(o.createdAt).toLocaleDateString()}</span>
        </div>
        <span className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border rounded ${
          o.status === 'completed' ? 'bg-green-500/15 text-green-400 border-green-500/30' :
          o.status === 'rejected' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
          'bg-amber-500/15 text-amber-400 border-amber-500/30'
        }`}>{o.status}</span>
      </div>
    )) : (
      <p className="text-gray-500 text-sm py-8 text-center">No orders.</p>
    )}
  </div>
);

// ── Tickets Tab (placeholder — loads from existing support API) ──
const TicketsTab: React.FC<{ orgName: string }> = ({ orgName }) => (
  <div className="text-center py-12">
    <LifeBuoy className="w-10 h-10 text-gray-600 mx-auto mb-3" />
    <p className="text-gray-500 text-sm">Support tickets for {orgName} are accessible in the Support Desk panel.</p>
  </div>
);

// ── Documents Tab ──
const DOC_CATEGORIES: { id: DocCategory; label: string }[] = [
  { id: 'contract', label: 'Contract' },
  { id: 'loa', label: 'LOA' },
  { id: 'invoice', label: 'Invoice' },
  { id: 'policy', label: 'Policy' },
  { id: 'diagram', label: 'Diagram' },
  { id: 'other', label: 'Other' },
];

const fileSize = (bytes: number): string =>
  !bytes ? '—' : bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const DocumentsTab: React.FC<{ documents: any[]; orgId?: string; onChanged?: () => void }> = ({
  documents,
  orgId,
  onChanged,
}) => {
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<DocCategory>('contract');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'staff' | 'shared'>('staff');
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setDescription('');
    setCategory('contract');
    setVisibility('staff');
    setError('');
  };

  const handleUpload = async () => {
    if (!file || !orgId) return;
    if (file.size > DOCUMENT_MAX_BYTES) {
      setError(`File is too large. The maximum is ${fileSize(DOCUMENT_MAX_BYTES)}.`);
      return;
    }
    setUploading(true);
    setError('');
    const res = await adminDocumentsApi.upload(orgId, file, { category, description, visibility });
    setUploading(false);
    if (!res.success) {
      setError(res.error || 'Upload failed.');
      return;
    }
    setShowUpload(false);
    reset();
    onChanged?.();
  };

  const handleDownload = async (d: any) => {
    if (!orgId) return;
    setDownloading(d._id);
    const err = await adminDocumentsApi.download(orgId, d._id, d.filename);
    setDownloading(null);
    if (err) setError(err);
  };

  const handleDelete = async (d: any) => {
    if (!orgId) return;
    const res = await adminDocumentsApi.remove(orgId, d._id);
    if (res.success) onChanged?.();
    else setError(res.error || 'Delete failed.');
  };

  const toggleVisibility = async (d: any) => {
    if (!orgId) return;
    const next = d.visibility === 'shared' ? 'staff' : 'shared';
    const res = await adminDocumentsApi.update(orgId, d._id, { visibility: next });
    if (res.success) onChanged?.();
    else setError(res.error || 'Could not change visibility.');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-gray-400">{documents.length} Documents</h3>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex cursor-pointer items-center gap-2 rounded bg-[#F20732] px-3 py-1.5 text-xs font-bold transition-colors hover:bg-[#C00628]"
        >
          <Upload className="h-3.5 w-3.5" /> Upload Document
        </button>
      </div>

      {showUpload && (
        <div className="space-y-3 rounded-lg border border-gray-700 bg-gray-800 p-4">
          <label className="block">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-gray-400">File</span>
            <input
              type="file"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setError('');
              }}
              className="w-full cursor-pointer rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-gray-600 file:px-3 file:py-1 file:text-xs file:font-bold file:text-white"
            />
            <span className="mt-1 block text-[11px] text-gray-500">
              PDF, Word, Excel, text, images or ZIP. Maximum {fileSize(DOCUMENT_MAX_BYTES)}.
            </span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-gray-400">Category</span>
              <select
                className="w-full cursor-pointer rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value as DocCategory)}
              >
                {DOC_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-gray-400">Visibility</span>
              <select
                className="w-full cursor-pointer rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as 'staff' | 'shared')}
              >
                <option value="staff">Staff only</option>
                <option value="shared">Shared with member</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-gray-400">
              Description (optional)
            </span>
            <input
              className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm"
              placeholder="e.g. LOA for MB2 cross-connect #3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          {error && <p className="font-mono text-xs text-[#F20732]">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleUpload}
              disabled={uploading || !file}
              className="flex cursor-pointer items-center gap-2 rounded bg-green-600 px-4 py-2 text-xs font-bold transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
            <button
              onClick={() => {
                setShowUpload(false);
                reset();
              }}
              className="cursor-pointer rounded bg-gray-700 px-4 py-2 text-xs font-bold transition-colors hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!showUpload && error && <p className="font-mono text-xs text-[#F20732]">{error}</p>}

      {documents.length
        ? documents.map((d: any) => (
            <div
              key={d._id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-700 bg-gray-800 p-4"
            >
              <div className="min-w-0">
                <span className="text-sm font-bold">{d.filename || d.name}</span>
                <p className="mt-0.5 text-xs text-gray-500">
                  {d.category} · {fileSize(d.size)} · {new Date(d.createdAt).toLocaleDateString()}
                  {d.uploadedBy ? ` · ${d.uploadedBy}` : ''}
                  {d.description ? ` · ${d.description}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button
                  onClick={() => toggleVisibility(d)}
                  title="Toggle whether the member can see this in their portal"
                  className={`cursor-pointer rounded border px-2 py-1 font-mono text-[10px] uppercase transition-colors ${
                    d.visibility === 'shared'
                      ? 'border-green-500/40 bg-green-500/10 text-green-400 hover:border-green-400'
                      : 'border-gray-600 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {d.visibility === 'shared' ? 'Shared' : 'Staff only'}
                </button>
                {d.available === false ? (
                  <span className="font-mono text-[10px] uppercase text-gray-500" title="No stored file — legacy metadata record">
                    No file
                  </span>
                ) : (
                  <button
                    onClick={() => handleDownload(d)}
                    disabled={downloading === d._id}
                    className="flex cursor-pointer items-center gap-1.5 font-mono text-[10px] uppercase text-[#F20732] transition-colors hover:text-white disabled:opacity-50"
                  >
                    {downloading === d._id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Download className="h-3 w-3" />
                    )}
                    Download
                  </button>
                )}
                <button
                  onClick={() => handleDelete(d)}
                  className="cursor-pointer font-mono text-[10px] uppercase text-gray-500 transition-colors hover:text-[#F20732]"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        : !showUpload && <p className="py-8 text-center text-sm text-gray-500">No documents uploaded.</p>}
    </div>
  );
};

// ── Helpers ──
const QuickStat: React.FC<{ icon: React.ElementType; label: string; value: number | string; sub?: string }> = ({ icon: Icon, label, value, sub }) => (
  <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-4 h-4 text-[#F20732]" />
      <span className="text-[10px] uppercase tracking-wider text-gray-500 font-mono">{label}</span>
    </div>
    <div className="text-2xl font-bold">{value}</div>
    {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
  </div>
);

const DlRow: React.FC<{ label: string; value: string; link?: boolean }> = ({ label, value, link }) => (
  <div className="flex items-center justify-between gap-4">
    <dt className="text-gray-500 text-xs uppercase tracking-wider font-mono">{label}</dt>
    <dd className="text-right truncate">
      {link ? <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noreferrer" className="text-[#F20732] hover:underline">{value}</a> : value}
    </dd>
  </div>
);

// ── Billing Tab ──
const BillingTab: React.FC<{ orgId: string }> = ({ orgId }) => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [linked, setLinked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await adminBillingApi.customerInvoices(orgId);
      if (res.success && res.data) {
        setLinked(res.data.linked);
        setInvoices(res.data.invoices || []);
      }
      setLoading(false);
    })();
  }, [orgId]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#F20732]" /></div>;

  if (!linked) {
    return (
      <div className="text-center py-12">
        <Receipt className="w-10 h-10 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">No Zoho Books contact linked to this customer.</p>
        <p className="text-gray-600 text-xs mt-1">Link a Zoho contact ID in the customer settings to see invoices here.</p>
      </div>
    );
  }

  if (!invoices.length) {
    return (
      <div className="text-center py-12">
        <Receipt className="w-10 h-10 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">No invoices found in Zoho Books.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-center">
          <div className="text-xl font-bold">{invoices.length}</div>
          <div className="text-[9px] uppercase tracking-wider text-gray-500 font-mono">Total</div>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-green-400">{invoices.filter((i: any) => i.status === 'paid').length}</div>
          <div className="text-[9px] uppercase tracking-wider text-gray-500 font-mono">Paid</div>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-red-400">{invoices.filter((i: any) => i.status === 'overdue').length}</div>
          <div className="text-[9px] uppercase tracking-wider text-gray-500 font-mono">Overdue</div>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-amber-400">{invoices.filter((i: any) => i.status === 'sent' || i.status === 'draft').length}</div>
          <div className="text-[9px] uppercase tracking-wider text-gray-500 font-mono">Pending</div>
        </div>
      </div>
      {invoices.map((inv: any) => {
        const statusColor = inv.status === 'paid' ? 'text-green-400 border-green-500/30 bg-green-500/10'
          : inv.status === 'overdue' ? 'text-red-400 border-red-500/30 bg-red-500/10'
          : 'text-amber-400 border-amber-500/30 bg-amber-500/10';
        return (
          <div key={inv.invoice_id || inv.invoice_number} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center justify-between">
            <div>
              <span className="font-bold text-sm">{inv.invoice_number}</span>
              <span className="text-xs text-gray-500 ml-3">{inv.date}</span>
              {inv.due_date && <span className="text-xs text-gray-600 ml-2">Due: {inv.due_date}</span>}
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm">{inv.currency_symbol || '₹'}{inv.total}</span>
              <span className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border rounded ${statusColor}`}>
                {inv.status}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Customer360Panel;
