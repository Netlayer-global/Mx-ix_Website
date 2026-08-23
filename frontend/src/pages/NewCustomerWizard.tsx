import React, { useState } from 'react';
import {
  Building2,
  Users,
  LogIn,
  Network,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  X,
} from 'lucide-react';
import {
  adminCustomersApi,
  adminContactsApi,
  adminPeersApi,
  ProvisioningOption,
} from '../services/api';

interface Props {
  options: ProvisioningOption[];
  onClose: () => void;
  onDone: (orgId: string) => void;
}

type Step = 'profile' | 'contacts' | 'login' | 'provision' | 'done';

const STEPS: { id: Step; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Organization', icon: Building2 },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'login', label: 'Portal Login', icon: LogIn },
  { id: 'provision', label: 'Port Provisioning', icon: Network },
  { id: 'done', label: 'Complete', icon: Check },
];

const field = 'w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#F20732] transition-colors';
const label = 'text-xs text-gray-400 uppercase tracking-wider font-mono block mb-1.5';

const TYPES = ['ISP', 'Content', 'Cloud', 'CDN', 'Enterprise', 'Academic', 'Other'];
const POLICIES = ['Open', 'Selective', 'Restrictive'];
const CONTACT_ROLES = ['noc', 'peering', 'billing', 'admin', 'sales', 'other'];

const NewCustomerWizard: React.FC<Props> = ({ options, onClose, onDone }) => {
  const [step, setStep] = useState<Step>('profile');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [orgId, setOrgId] = useState('');

  // Step 1: Profile
  const [profile, setProfile] = useState({
    name: '', asn: '', website: '', type: 'ISP', peeringPolicy: 'Open',
    nocEmail: '', nocPhone: '', locations: '',
  });

  // Step 2: Contacts
  const [contacts, setContacts] = useState<Array<{ name: string; email: string; phone: string; role: string }>>([
    { name: '', email: '', phone: '', role: 'noc' },
  ]);

  // Step 3: Login
  const [login, setLogin] = useState({ name: '', email: '', password: '', role: 'admin' });

  // Step 4: Provision
  const [infraId, setInfraId] = useState(options[0]?.id || '');
  const [speed, setSpeed] = useState('10000');
  const [selectedPorts, setSelectedPorts] = useState<string[]>([]);
  const [provisionResult, setProvisionResult] = useState<any>(null);

  const stepIdx = STEPS.findIndex((s) => s.id === step);

  const createOrg = async () => {
    setError('');
    setBusy(true);
    const res = await adminCustomersApi.create({
      name: profile.name.trim(),
      asn: profile.asn ? Number(profile.asn) : undefined,
      website: profile.website.trim(),
      type: profile.type,
      peeringPolicy: profile.peeringPolicy,
      nocEmail: profile.nocEmail.trim(),
      nocPhone: profile.nocPhone.trim(),
      locations: profile.locations.split(',').map((s) => s.trim()).filter(Boolean),
      status: 'active',
    } as any);
    setBusy(false);
    if (res.success && res.data) {
      setOrgId(res.data._id);
      setStep('contacts');
    } else {
      setError(res.error || 'Failed to create organization.');
    }
  };

  const saveContacts = async () => {
    setError('');
    setBusy(true);
    const valid = contacts.filter((c) => c.name.trim() && c.email.trim());
    for (const c of valid) {
      await adminContactsApi.create(orgId, { name: c.name.trim(), email: c.email.trim(), phone: c.phone.trim(), role: c.role } as any);
    }
    setBusy(false);
    setStep('login');
  };

  const createLogin = async () => {
    setError('');
    if (!login.email.trim() || !login.password || login.password.length < 8) {
      setError('Email and password (min 8 chars) are required.');
      return;
    }
    setBusy(true);
    const res = await adminCustomersApi.createUser(orgId, {
      name: login.name.trim(),
      email: login.email.trim(),
      password: login.password,
      role: login.role,
    } as any);
    setBusy(false);
    if (res.success) {
      setStep('provision');
    } else {
      setError(res.error || 'Failed to create login.');
    }
  };

  const provisionPort = async () => {
    if (!selectedPorts.length) { setError('Select at least one switch port.'); return; }
    setError('');
    setBusy(true);
    const res = await adminPeersApi.provision({
      organizationId: orgId,
      infrastructureId: infraId,
      switchPortIds: selectedPorts,
      speed: Number(speed),
      ipv4: true,
      ipv6: true,
      rsClient: true,
      rsMode: 'passive',
      irrdbFilter: true,
      rpkiFilter: true,
      syncPeeringDb: true,
      refreshIrrdb: true,
      deploy: true,
    });
    setBusy(false);
    if (res.success && res.data) {
      setProvisionResult(res.data);
      setStep('done');
    } else {
      setError(res.error || 'Provisioning failed.');
    }
  };

  const infra = options.find((o) => o.id === infraId);
  const freePorts = infra?.freePorts?.filter((p) => String(p.speed) === speed) || [];

  const addContact = () => setContacts([...contacts, { name: '', email: '', phone: '', role: 'noc' }]);
  const updateContact = (idx: number, patch: Partial<typeof contacts[0]>) =>
    setContacts(contacts.map((c, i) => i === idx ? { ...c, ...patch } : c));
  const removeContact = (idx: number) => setContacts(contacts.filter((_, i) => i !== idx));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-800 border border-gray-700 rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-800 border-b border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">New Member</h2>
              <p className="text-xs text-gray-400">Step {stepIdx + 1} of {STEPS.length} — {STEPS[stepIdx].label}</p>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          {/* Progress */}
          <div className="flex items-center gap-1 mt-4">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex-1 flex items-center gap-1">
                <div className={`flex-1 h-1.5 rounded-full transition-colors ${i <= stepIdx ? 'bg-[#F20732]' : 'bg-gray-700'}`} />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2">
            {STEPS.map((s, i) => (
              <span key={s.id} className={`text-[9px] uppercase tracking-wider font-mono ${i <= stepIdx ? 'text-white' : 'text-gray-600'}`}>
                {s.label}
              </span>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4 text-white">
          {error && <p className="text-sm text-[#F20732] bg-[#F20732]/10 border border-[#F20732]/30 rounded p-3">{error}</p>}

          {step === 'profile' && (
            <>
              <p className="text-sm text-gray-300 mb-4">Basic organization details. ASN is used for PeeringDB lookup and Bird config.</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={label}>Organization name *</label><input className={field} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="Netlayer" /></div>
                <div><label className={label}>ASN</label><input className={field} value={profile.asn} onChange={(e) => setProfile({ ...profile, asn: e.target.value })} placeholder="50839" /></div>
                <div><label className={label}>Website</label><input className={field} value={profile.website} onChange={(e) => setProfile({ ...profile, website: e.target.value })} placeholder="https://netlayer.in" /></div>
                <div><label className={label}>Type</label><select className={field} value={profile.type} onChange={(e) => setProfile({ ...profile, type: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
                <div><label className={label}>Peering Policy</label><select className={field} value={profile.peeringPolicy} onChange={(e) => setProfile({ ...profile, peeringPolicy: e.target.value })}>{POLICIES.map((p) => <option key={p}>{p}</option>)}</select></div>
                <div><label className={label}>Locations (comma sep)</label><input className={field} value={profile.locations} onChange={(e) => setProfile({ ...profile, locations: e.target.value })} placeholder="Delhi, Mumbai" /></div>
                <div><label className={label}>NOC Email</label><input className={field} value={profile.nocEmail} onChange={(e) => setProfile({ ...profile, nocEmail: e.target.value })} placeholder="noc@netlayer.in" /></div>
                <div><label className={label}>NOC Phone</label><input className={field} value={profile.nocPhone} onChange={(e) => setProfile({ ...profile, nocPhone: e.target.value })} /></div>
              </div>
            </>
          )}

          {step === 'contacts' && (
            <>
              <p className="text-sm text-gray-300 mb-4">Add NOC, peering and billing contacts. At least one NOC contact is recommended.</p>
              {contacts.map((c, i) => (
                <div key={i} className="grid grid-cols-5 gap-2 items-end">
                  <div><label className={label}>Name</label><input className={field} value={c.name} onChange={(e) => updateContact(i, { name: e.target.value })} /></div>
                  <div><label className={label}>Email</label><input className={field} value={c.email} onChange={(e) => updateContact(i, { email: e.target.value })} /></div>
                  <div><label className={label}>Phone</label><input className={field} value={c.phone} onChange={(e) => updateContact(i, { phone: e.target.value })} /></div>
                  <div><label className={label}>Role</label><select className={field} value={c.role} onChange={(e) => updateContact(i, { role: e.target.value })}>{CONTACT_ROLES.map((r) => <option key={r}>{r}</option>)}</select></div>
                  <button onClick={() => removeContact(i)} className="p-2 text-gray-500 hover:text-[#F20732] mb-0.5"><X className="w-4 h-4" /></button>
                </div>
              ))}
              <button onClick={addContact} className="text-sm text-[#F20732] hover:underline">+ Add another contact</button>
            </>
          )}

          {step === 'login' && (
            <>
              <p className="text-sm text-gray-300 mb-4">Create a portal login so this member can sign in, view traffic and manage peering.</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={label}>Full name *</label><input className={field} value={login.name} onChange={(e) => setLogin({ ...login, name: e.target.value })} /></div>
                <div><label className={label}>Email *</label><input className={field} value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} placeholder="admin@netlayer.in" /></div>
                <div><label className={label}>Password * (min 8)</label><input type="password" className={field} value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} /></div>
                <div><label className={label}>Role</label><select className={field} value={login.role} onChange={(e) => setLogin({ ...login, role: e.target.value })}><option value="admin">Admin</option><option value="viewer">Viewer</option><option value="billing">Billing</option></select></div>
              </div>
            </>
          )}

          {step === 'provision' && (
            <>
              <p className="text-sm text-gray-300 mb-4">Provision a port for this member. Select the infrastructure, speed and switch port(s).</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className={label}>Infrastructure</label>
                  <select className={field} value={infraId} onChange={(e) => { setInfraId(e.target.value); setSelectedPorts([]); }}>
                    {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={label}>Port speed</label>
                  <select className={field} value={speed} onChange={(e) => { setSpeed(e.target.value); setSelectedPorts([]); }}>
                    <option value="1000">1G</option>
                    <option value="10000">10G</option>
                    <option value="25000">25G</option>
                    <option value="100000">100G</option>
                    <option value="400000">400G</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={label}>Available switch ports ({freePorts.length} free)</label>
                <div className="max-h-48 overflow-y-auto border border-gray-700 rounded p-2 space-y-1">
                  {freePorts.length ? freePorts.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-700 rounded cursor-pointer">
                      <input type="checkbox" checked={selectedPorts.includes(p.id)} onChange={() => setSelectedPorts((prev) => prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id])} />
                      <span className="text-sm">{p.name}</span>
                      <span className="text-xs text-gray-500 ml-auto">{p.switchName || ''}</span>
                    </label>
                  )) : (
                    <p className="text-sm text-gray-500 py-4 text-center">No free ports at this speed. Add a switch with ports first.</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">Select multiple ports for a LAG. VLAN and IPs will be auto-assigned.</p>
            </>
          )}

          {step === 'done' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-500/15 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Member Provisioned!</h3>
              <p className="text-gray-400 mb-4">
                {profile.name} is now active on the fabric.
                {provisionResult?.ipv4 && <><br />IPv4: <span className="font-mono text-green-400">{provisionResult.ipv4}</span></>}
                {provisionResult?.ipv6 && <><br />IPv6: <span className="font-mono text-green-400">{provisionResult.ipv6}</span></>}
              </p>
              <p className="text-xs text-gray-500">Route servers updated. The member can now log in and see their connection.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 px-6 py-4 flex items-center justify-between">
          <div>
            {step !== 'profile' && step !== 'done' && (
              <button onClick={() => setStep(STEPS[stepIdx - 1].id)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step !== 'done' && <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>}
            {step === 'profile' && (
              <button onClick={createOrg} disabled={busy || !profile.name.trim()} className="flex items-center gap-2 px-5 py-2.5 bg-[#F20732] rounded font-bold text-sm text-white hover:bg-[#C00628] disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Create & continue <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {step === 'contacts' && (
              <button onClick={saveContacts} disabled={busy} className="flex items-center gap-2 px-5 py-2.5 bg-[#F20732] rounded font-bold text-sm text-white hover:bg-[#C00628] disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save contacts <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {step === 'login' && (
              <>
                <button onClick={() => setStep('provision')} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Skip login</button>
                <button onClick={createLogin} disabled={busy} className="flex items-center gap-2 px-5 py-2.5 bg-[#F20732] rounded font-bold text-sm text-white hover:bg-[#C00628] disabled:opacity-50">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Create login <ArrowRight className="w-4 h-4" />
                </button>
              </>
            )}
            {step === 'provision' && (
              <>
                <button onClick={() => { setStep('done'); }} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Skip provisioning</button>
                <button onClick={provisionPort} disabled={busy || !selectedPorts.length} className="flex items-center gap-2 px-5 py-2.5 bg-green-600 rounded font-bold text-sm text-white hover:bg-green-500 disabled:opacity-50">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Network className="w-4 h-4" />} Provision
                </button>
              </>
            )}
            {step === 'done' && (
              <button onClick={() => onDone(orgId)} className="flex items-center gap-2 px-5 py-2.5 bg-[#F20732] rounded font-bold text-sm text-white hover:bg-[#C00628]">
                View customer <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewCustomerWizard;
