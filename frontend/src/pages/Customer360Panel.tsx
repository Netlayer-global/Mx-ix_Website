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
} from 'lucide-react';
import {
  adminCustomersApi,
  adminContactsApi,
  adminDocumentsApi,
  adminOrdersApi,
  adminPeersApi,
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

type Tab = 'overview' | 'connections' | 'contacts' | 'orders' | 'tickets' | 'documents' | 'traffic';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: Building2 },
  { id: 'connections', label: 'Connections', icon: Network },
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
        {tab === 'documents' && <DocumentsTab documents={documents} />}
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
const ConnectionsTab: React.FC<{ connections: ConnectionItem[]; ports: PortItem[] }> = ({ connections, ports }) => (
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
const DocumentsTab: React.FC<{ documents: any[] }> = ({ documents }) => (
  <div className="space-y-2">
    {documents.length ? documents.map((d: any) => (
      <div key={d._id} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center justify-between">
        <div>
          <span className="font-bold text-sm">{d.name || d.filename}</span>
          <span className="text-xs text-gray-500 ml-2">{d.category} · {new Date(d.createdAt).toLocaleDateString()}</span>
        </div>
        <span className="text-[10px] uppercase font-mono text-gray-500">{d.visibility || 'staff'}</span>
      </div>
    )) : (
      <p className="text-gray-500 text-sm py-8 text-center">No documents uploaded.</p>
    )}
  </div>
);

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

export default Customer360Panel;
