import React, { useEffect, useState, useCallback } from 'react';
import {
  ChevronLeft,
  Loader2,
  Plus,
  Trash2,
  Users,
  Save,
  X,
  CheckCircle2,
  Ban,
  Building2,
  Network,
  UserPlus,
  RotateCcw,
  Eye,
  RefreshCw,
} from 'lucide-react';
import {
  adminCustomersApi,
  adminIxpApi,
  CustomerOrg,
  CustomerUser,
  PortItem,
  OrgStatus,
  PortalRole,
  PortStatus,
  PORTAL_TOKEN_KEY,
} from '../services/api';

interface Props {
  embedded?: boolean;
  onBack?: () => void;
}

const TYPES = ['ISP', 'Content', 'Cloud', 'CDN', 'Enterprise', 'Academic', 'Other'];
const POLICIES = ['Open', 'Selective', 'Restrictive'];
const ROLES: PortalRole[] = ['admin', 'viewer', 'billing'];
const PORT_STATUSES: PortStatus[] = ['active', 'provisioning', 'down', 'maintenance'];
const PORT_SPEEDS = ['1G', '10G', '25G', '100G', '400G'];

const field = 'w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm';

const statusBadge = (status: OrgStatus) => {
  const map: Record<OrgStatus, string> = {
    active: 'bg-green-500/15 text-green-400 border-green-500/30',
    pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    suspended: 'bg-[#F20732]/15 text-[#F20732] border-[#F20732]/30',
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border rounded ${map[status]}`}>
      {status}
    </span>
  );
};

const emptyForm = {
  name: '',
  asn: '',
  website: '',
  type: 'ISP',
  peeringPolicy: 'Open',
  status: 'active' as OrgStatus,
  locations: '',
  nocEmail: '',
  nocPhone: '',
  ixpManagerId: '',
  zohoContactId: '',
  notes: '',
  userEmail: '',
  userName: '',
  userPassword: '',
};

const CustomersAdminPanel: React.FC<Props> = ({ embedded, onBack }) => {
  const [customers, setCustomers] = useState<CustomerOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | OrgStatus>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const runIxpSync = async () => {
    setSyncing(true);
    setSyncMsg('');
    const res = await adminIxpApi.sync();
    setSyncing(false);
    if (res.success && res.data) {
      setSyncMsg(`Synced ${res.data.fetched} member(s) · linked ${res.data.linked} · ${res.data.unmatched.length} unmatched.`);
      load();
    } else {
      setSyncMsg(res.error || 'IXP Manager sync failed.');
    }
  };

  const load = useCallback(async () => {
    const res = await adminCustomersApi.list();
    if (res.success && res.data) setCustomers(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createCustomer = async () => {
    setError('');
    if (!form.name.trim()) {
      setError('Organization name is required.');
      return;
    }
    setSaving(true);
    const payload: any = {
      name: form.name.trim(),
      asn: form.asn ? Number(form.asn) : undefined,
      website: form.website.trim(),
      type: form.type,
      peeringPolicy: form.peeringPolicy,
      status: form.status,
      locations: form.locations.split(',').map((s) => s.trim()).filter(Boolean),
      nocEmail: form.nocEmail.trim(),
      nocPhone: form.nocPhone.trim(),
      ixpManagerId: form.ixpManagerId.trim(),
      zohoContactId: form.zohoContactId.trim(),
      notes: form.notes.trim(),
    };
    if (form.userEmail.trim() && form.userPassword) {
      payload.user = {
        email: form.userEmail.trim(),
        password: form.userPassword,
        name: form.userName.trim() || form.name.trim(),
        role: 'admin',
      };
    }
    const res = await adminCustomersApi.create(payload);
    setSaving(false);
    if (res.success) {
      setForm({ ...emptyForm });
      setShowCreate(false);
      load();
    } else {
      setError(res.error || 'Failed to create customer.');
    }
  };

  const setStatus = async (id: string, status: OrgStatus) => {
    await adminCustomersApi.setStatus(id, status);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this customer and all its users and ports? This cannot be undone.')) return;
    await adminCustomersApi.remove(id);
    if (selectedId === id) setSelectedId(null);
    load();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#F20732]" />
      </div>
    );
  }

  if (selectedId) {
    return (
      <CustomerDetail
        id={selectedId}
        onBack={() => {
          setSelectedId(null);
          load();
        }}
      />
    );
  }

  const filtered = filter === 'all' ? customers : customers.filter((c) => c.status === filter);
  const pendingCount = customers.filter((c) => c.status === 'pending').length;

  return (
    <div className="min-h-screen bg-gray-900 text-white admin-panel">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          {embedded && onBack && (
            <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#F20732] rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Customers</h1>
              <p className="text-gray-400 text-sm">Member organizations, accounts &amp; ports</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-[#F20732] rounded font-bold text-sm hover:bg-[#C00628] transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Customer
          </button>
          <button
            onClick={runIxpSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 rounded font-bold text-sm hover:bg-gray-600 transition-colors disabled:opacity-50"
            title="Pull & link members from IXP Manager"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} IXP Sync
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {syncMsg && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-300">{syncMsg}</div>
        )}
        {/* Create form */}
        {showCreate && (
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">New customer organization</h2>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setForm({ ...emptyForm });
                  setError('');
                }}
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Organization name *" className={field} />
              <input value={form.asn} onChange={(e) => setForm({ ...form, asn: e.target.value })} placeholder="ASN (e.g. 15169)" className={field} />
              <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="Website" className={field} />
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={field}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={form.peeringPolicy} onChange={(e) => setForm({ ...form, peeringPolicy: e.target.value })} className={field}>
                {POLICIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as OrgStatus })} className={field}>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </select>
              <input value={form.locations} onChange={(e) => setForm({ ...form, locations: e.target.value })} placeholder="Locations (comma separated)" className={field} />
              <input value={form.nocEmail} onChange={(e) => setForm({ ...form, nocEmail: e.target.value })} placeholder="NOC email" className={field} />
              <input value={form.nocPhone} onChange={(e) => setForm({ ...form, nocPhone: e.target.value })} placeholder="NOC phone" className={field} />
              <input value={form.ixpManagerId} onChange={(e) => setForm({ ...form, ixpManagerId: e.target.value })} placeholder="IXP Manager member ID (optional)" className={field} />
              <input value={form.zohoContactId} onChange={(e) => setForm({ ...form, zohoContactId: e.target.value })} placeholder="Zoho Books contact ID (optional)" className={field} />
            </div>

            <div className="mt-5 pt-4 border-t border-gray-700">
              <p className="text-xs uppercase tracking-wider text-gray-400 font-mono mb-3 flex items-center gap-2">
                <UserPlus className="w-3.5 h-3.5" /> First login (optional)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input value={form.userName} onChange={(e) => setForm({ ...form, userName: e.target.value })} placeholder="Contact name" className={field} />
                <input value={form.userEmail} onChange={(e) => setForm({ ...form, userEmail: e.target.value })} placeholder="Login email" className={field} />
                <input type="password" value={form.userPassword} onChange={(e) => setForm({ ...form, userPassword: e.target.value })} placeholder="Password (min 8)" className={field} />
              </div>
            </div>

            {error && <p className="text-[#F20732] text-sm mt-3">{error}</p>}

            <div className="flex justify-end mt-4">
              <button onClick={createCustomer} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-[#F20732] rounded font-bold text-sm hover:bg-[#C00628] transition-colors disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Create
              </button>
            </div>
          </section>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'pending', 'active', 'suspended'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-sm font-mono uppercase tracking-wider transition-colors ${
                filter === f ? 'bg-[#F20732] text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {f}
              {f === 'pending' && pendingCount > 0 && (
                <span className="ml-2 bg-amber-500 text-gray-900 rounded-full px-1.5 text-[10px]">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        <section className="space-y-2">
          {filtered.map((c) => (
            <div key={c._id} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center gap-4">
              <button onClick={() => setSelectedId(c._id)} className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-bold truncate">{c.name}</span>
                  {statusBadge(c.status)}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {c.asn ? `AS${c.asn} · ` : ''}{c.type} · {c.userCount ?? 0} user{(c.userCount ?? 0) === 1 ? '' : 's'} · {c.portCount ?? 0} port{(c.portCount ?? 0) === 1 ? '' : 's'}
                </div>
              </button>

              {c.status === 'pending' && (
                <button onClick={() => setStatus(c._id, 'active')} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 rounded text-xs font-bold hover:bg-green-700 transition-colors">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                </button>
              )}
              {c.status === 'active' && (
                <button onClick={() => setStatus(c._id, 'suspended')} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 rounded text-xs font-bold hover:bg-[#F20732] transition-colors">
                  <Ban className="w-3.5 h-3.5" /> Suspend
                </button>
              )}
              {c.status === 'suspended' && (
                <button onClick={() => setStatus(c._id, 'active')} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 rounded text-xs font-bold hover:bg-green-600 transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" /> Reactivate
                </button>
              )}
              <button onClick={() => remove(c._id)} className="p-2 text-gray-400 hover:text-[#F20732] transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {!filtered.length && (
            <p className="text-gray-500 text-sm text-center py-12 flex flex-col items-center gap-3">
              <Network className="w-8 h-8 text-gray-600" />
              No customers{filter !== 'all' ? ` with status "${filter}"` : ''} yet.
            </p>
          )}
        </section>
      </main>
    </div>
  );
};

// ── Customer detail (edit org, users, ports) ──────────────────────────────

const CustomerDetail: React.FC<{ id: string; onBack: () => void }> = ({ id, onBack }) => {
  const [org, setOrg] = useState<CustomerOrg | null>(null);
  const [users, setUsers] = useState<CustomerUser[]>([]);
  const [ports, setPorts] = useState<PortItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // new user form
  const [nu, setNu] = useState({ name: '', email: '', password: '', role: 'viewer' as PortalRole });
  // new port form
  const [np, setNp] = useState({ name: '', location: '', speed: '10G', vlan: '', ipv4: '', ipv6: '', status: 'provisioning' as PortStatus });

  const load = useCallback(async () => {
    const res = await adminCustomersApi.get(id);
    if (res.success && res.data) {
      setOrg(res.data.organization);
      setUsers(res.data.users);
      setPorts(res.data.ports);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const saveOrg = async () => {
    if (!org) return;
    setSaving(true);
    await adminCustomersApi.update(id, {
      name: org.name,
      asn: org.asn,
      website: org.website,
      type: org.type,
      peeringPolicy: org.peeringPolicy,
      locations: org.locations,
      nocEmail: org.nocEmail,
      nocPhone: org.nocPhone,
      ixpManagerId: org.ixpManagerId,
      zohoContactId: org.zohoContactId,
      notes: org.notes,
    });
    setSaving(false);
    load();
  };

  const addUser = async () => {
    if (!nu.email || !nu.password || !nu.name) return;
    const res = await adminCustomersApi.createUser(id, nu);
    if (res.success) {
      setNu({ name: '', email: '', password: '', role: 'viewer' });
      load();
    } else {
      alert(res.error || 'Failed to add user');
    }
  };

  const delUser = async (userId: string) => {
    if (!confirm('Remove this login?')) return;
    await adminCustomersApi.deleteUser(id, userId);
    load();
  };

  const addPort = async () => {
    if (!np.name) return;
    const res = await adminCustomersApi.createPort(id, np);
    if (res.success) {
      setNp({ name: '', location: '', speed: '10G', vlan: '', ipv4: '', ipv6: '', status: 'provisioning' });
      load();
    }
  };

  const updatePortStatus = async (portId: string, status: PortStatus) => {
    await adminCustomersApi.updatePort(id, portId, { status });
    load();
  };

  const delPort = async (portId: string) => {
    if (!confirm('Delete this port?')) return;
    await adminCustomersApi.deletePort(id, portId);
    load();
  };

  const impersonate = async () => {
    const res = await adminCustomersApi.impersonate(id);
    if (res.success && res.data?.token) {
      localStorage.setItem(PORTAL_TOKEN_KEY, res.data.token);
      window.open('/portal', '_blank');
    } else {
      alert(res.error || 'Cannot impersonate this customer.');
    }
  };

  const importPorts = async () => {
    const res = await adminIxpApi.importPorts(id);
    if (res.success) {
      load();
      alert(`Imported ${res.data?.imported ?? 0} port(s) from IXP Manager.`);
    } else {
      alert(res.error || 'Import failed.');
    }
  };

  if (loading || !org) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#F20732]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white admin-panel">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#F20732] rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">{org.name} {statusBadge(org.status)}</h1>
              <p className="text-gray-400 text-sm">{org.asn ? `AS${org.asn}` : 'No ASN'} · {org.type}</p>
            </div>
          </div>
          {org.status === 'active' && (
            <button
              onClick={impersonate}
              className="ml-auto flex items-center gap-2 px-4 py-2 bg-gray-700 rounded font-bold text-sm hover:bg-gray-600 transition-colors"
              title="Open the member portal as this customer"
            >
              <Eye className="w-4 h-4" /> View as member
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Profile */}
        <section className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <h2 className="font-bold mb-4">Profile</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} placeholder="Name" className={field} />
            <input value={org.asn ?? ''} onChange={(e) => setOrg({ ...org, asn: e.target.value ? Number(e.target.value) : undefined })} placeholder="ASN" className={field} />
            <input value={org.website ?? ''} onChange={(e) => setOrg({ ...org, website: e.target.value })} placeholder="Website" className={field} />
            <select value={org.type} onChange={(e) => setOrg({ ...org, type: e.target.value })} className={field}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={org.peeringPolicy} onChange={(e) => setOrg({ ...org, peeringPolicy: e.target.value })} className={field}>
              {POLICIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input value={(org.locations || []).join(', ')} onChange={(e) => setOrg({ ...org, locations: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="Locations (comma separated)" className={field} />
            <input value={org.nocEmail ?? ''} onChange={(e) => setOrg({ ...org, nocEmail: e.target.value })} placeholder="NOC email" className={field} />
            <input value={org.nocPhone ?? ''} onChange={(e) => setOrg({ ...org, nocPhone: e.target.value })} placeholder="NOC phone" className={field} />
            <input value={org.ixpManagerId ?? ''} onChange={(e) => setOrg({ ...org, ixpManagerId: e.target.value })} placeholder="IXP Manager member ID" className={field} />
            <input value={org.zohoContactId ?? ''} onChange={(e) => setOrg({ ...org, zohoContactId: e.target.value })} placeholder="Zoho Books contact ID" className={field} />
          </div>
          <textarea value={org.notes ?? ''} onChange={(e) => setOrg({ ...org, notes: e.target.value })} placeholder="Internal notes" rows={2} className={`${field} mt-3`} />
          <div className="flex justify-end mt-4">
            <button onClick={saveOrg} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-[#F20732] rounded font-bold text-sm hover:bg-[#C00628] transition-colors disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save profile
            </button>
          </div>
        </section>

        {/* Ports */}
        <section className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold flex items-center gap-2"><Network className="w-4 h-4" /> Ports</h2>
            {org.ixpManagerId && (
              <button onClick={importPorts} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 rounded text-xs font-bold hover:bg-gray-600 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" /> Import from IXP Manager
              </button>
            )}
          </div>
          <div className="space-y-2 mb-4">
            {ports.map((p) => (
              <div key={p._id} className="bg-gray-900 border border-gray-700 rounded p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{p.name}</div>
                  <div className="text-xs text-gray-400">{p.location || '—'} · {p.speed}{p.vlan ? ` · VLAN ${p.vlan}` : ''}{p.ipv4 ? ` · ${p.ipv4}` : ''}</div>
                </div>
                <select value={p.status} onChange={(e) => updatePortStatus(p._id, e.target.value as PortStatus)} className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs">
                  {PORT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={() => delPort(p._id)} className="p-1.5 text-gray-400 hover:text-[#F20732] transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {!ports.length && <p className="text-gray-500 text-sm">No ports yet.</p>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-4 border-t border-gray-700">
            <input value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} placeholder="Port name *" className={field} />
            <input value={np.location} onChange={(e) => setNp({ ...np, location: e.target.value })} placeholder="Location" className={field} />
            <select value={np.speed} onChange={(e) => setNp({ ...np, speed: e.target.value })} className={field}>
              {PORT_SPEEDS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input value={np.vlan} onChange={(e) => setNp({ ...np, vlan: e.target.value })} placeholder="VLAN" className={field} />
            <input value={np.ipv4} onChange={(e) => setNp({ ...np, ipv4: e.target.value })} placeholder="IPv4" className={field} />
            <input value={np.ipv6} onChange={(e) => setNp({ ...np, ipv6: e.target.value })} placeholder="IPv6" className={field} />
            <select value={np.status} onChange={(e) => setNp({ ...np, status: e.target.value as PortStatus })} className={field}>
              {PORT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={addPort} className="flex items-center justify-center gap-2 px-3 py-2 bg-[#F20732] rounded font-bold text-sm hover:bg-[#C00628] transition-colors">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </section>

        {/* Users */}
        <section className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <h2 className="font-bold mb-4 flex items-center gap-2"><Users className="w-4 h-4" /> Logins</h2>
          <div className="space-y-2 mb-4">
            {users.map((u) => (
              <div key={u._id} className="bg-gray-900 border border-gray-700 rounded p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{u.name} <span className="text-[10px] uppercase text-gray-500 ml-1">{u.role}</span></div>
                  <div className="text-xs text-gray-400">{u.email}{u.lastLogin ? ` · last login ${new Date(u.lastLogin).toLocaleDateString()}` : ' · never logged in'}</div>
                </div>
                <button onClick={() => delUser(u._id)} className="p-1.5 text-gray-400 hover:text-[#F20732] transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {!users.length && <p className="text-gray-500 text-sm">No logins yet. Add one below so this customer can sign in.</p>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-4 border-t border-gray-700">
            <input value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} placeholder="Name *" className={field} />
            <input value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} placeholder="Email *" className={field} />
            <input type="password" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} placeholder="Password (min 8) *" className={field} />
            <select value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value as PortalRole })} className={field}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button onClick={addUser} className="md:col-span-4 flex items-center justify-center gap-2 px-3 py-2 bg-[#F20732] rounded font-bold text-sm hover:bg-[#C00628] transition-colors">
              <UserPlus className="w-4 h-4" /> Add login
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default CustomersAdminPanel;
