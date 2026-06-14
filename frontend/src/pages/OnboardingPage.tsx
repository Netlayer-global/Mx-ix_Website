import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Network,
  MapPin,
  ShieldCheck,
  UserCircle,
  ClipboardCheck,
  Loader2,
  PartyPopper,
} from 'lucide-react';
import { useAdmin } from '../contexts/AdminContext';
import { portalApi } from '../services/api';

interface OnboardingPageProps {
  onNavigate?: (page: string) => void;
}

const isLive = (s: string) => s === 'active' || s === 'current';
const NETWORK_TYPES = ['ISP', 'Content', 'Cloud', 'CDN', 'Enterprise', 'Academic', 'Other'];
const POLICIES = ['Open', 'Selective', 'Restrictive'];
const DEFAULT_SPEEDS = ['1G', '10G', '25G', '100G', '400G'];

const STEPS = [
  { id: 1, label: 'Network', icon: Network },
  { id: 2, label: 'Connectivity', icon: MapPin },
  { id: 3, label: 'Readiness', icon: ShieldCheck },
  { id: 4, label: 'Account', icon: UserCircle },
  { id: 5, label: 'Review', icon: ClipboardCheck },
];

const CHECKS = [
  { key: 'asn', label: 'We have a public ASN (or are obtaining one).' },
  { key: 'bgp', label: 'Our router supports BGP-4 with IPv4 and IPv6.' },
  { key: 'irr', label: 'Our prefixes are registered in an IRR / have RPKI ROAs.' },
  { key: 'peeringdb', label: 'Our PeeringDB record is up to date.' },
  { key: 'rs', label: 'We intend to peer on the MX-IX route servers (AS141539).' },
];

const OnboardingPage: React.FC<OnboardingPageProps> = ({ onNavigate }) => {
  const { locations } = useAdmin();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // form state
  const [companyName, setCompanyName] = useState('');
  const [type, setType] = useState('ISP');
  const [asn, setAsn] = useState('');
  const [additionalAsns, setAdditionalAsns] = useState('');
  const [website, setWebsite] = useState('');
  const [peeringPolicy, setPeeringPolicy] = useState('Open');

  const [location, setLocation] = useState('');
  const [speed, setSpeed] = useState('10G');
  const [connType, setConnType] = useState<'cross-connect' | 'remote'>('cross-connect');

  const [checks, setChecks] = useState<Record<string, boolean>>({});

  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agree, setAgree] = useState(false);

  useEffect(() => {
    document.body.classList.add('dark-nav');
    return () => document.body.classList.remove('dark-nav');
  }, []);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [step, done]);

  const liveLocations = useMemo(() => locations.filter((l) => isLive(l.status)), [locations]);
  const selectedLoc = liveLocations.find((l) => l.id === location);
  const speedOptions = (selectedLoc?.portSpeeds && selectedLoc.portSpeeds.length ? selectedLoc.portSpeeds : DEFAULT_SPEEDS);

  const allChecked = CHECKS.every((c) => checks[c.key]);

  const canNext = () => {
    if (step === 1) return companyName.trim().length > 1;
    if (step === 2) return !!location && !!speed;
    if (step === 3) return allChecked;
    if (step === 4)
      return (
        contactName.trim() &&
        /\S+@\S+\.\S+/.test(email) &&
        password.length >= 8 &&
        password === confirm &&
        agree
      );
    return true;
  };

  const next = () => { setError(''); setStep((s) => Math.min(5, s + 1)); };
  const back = () => { setError(''); setStep((s) => Math.max(1, s - 1)); };

  const submit = async () => {
    setSubmitting(true);
    setError('');
    const notes = `Onboarding: ${type} · ${connType === 'remote' ? 'Remote peering' : 'Cross-connect'} · Port ${speed} @ ${selectedLoc?.name || location}.`;
    const res = await portalApi.signup({
      companyName: companyName.trim(),
      asn: asn.trim() || undefined,
      additionalAsns: additionalAsns
        .split(',')
        .map((a) => Number(a.trim().replace(/^as/i, '')))
        .filter((n) => Number.isFinite(n) && n > 0),
      website: website.trim() || undefined,
      type,
      peeringPolicy,
      locations: location ? [location] : [],
      desiredSpeed: speed,
      contactName: contactName.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      password,
      notes,
    });
    setSubmitting(false);
    if (res.success) {
      setDone(true);
    } else {
      setError(res.error || 'Something went wrong. Please try again.');
      if (/already exists/i.test(res.error || '')) setStep(4);
    }
  };

  // ── Success screen ─────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen bg-white text-ink">
        <section className="relative bg-ink text-white overflow-hidden pt-36 md:pt-44 pb-20">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#F20732]/15 blur-[120px]" />
          <div className="max-w-3xl mx-auto px-6 md:px-12 relative z-10 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#F20732] mb-6">
              <PartyPopper className="w-8 h-8 text-white" />
            </div>
            <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Application received</span>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-[0.95] mt-4 mb-6">
              Welcome aboard, <span className="text-[#F20732]">{companyName || 'partner'}</span>
            </h1>
            <p className="text-gray-400 text-base md:text-lg leading-relaxed">
              Your member account and port request have been submitted. Our team will review your
              details and reach out at <span className="text-white">{email}</span> to confirm
              availability, cross-connect and provisioning.
            </p>
          </div>
        </section>

        <section className="max-w-[1400px] mx-auto px-6 md:px-12 py-14">
          <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// What happens next</span>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter mt-2 mb-10">Your path to going live</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-gray-200 border border-gray-200">
            {[
              { n: '01', t: 'Review & approval', d: 'We verify your network details and approve your portal access.' },
              { n: '02', t: 'Provisioning', d: 'We confirm port availability and cross-connect, then provision your port.' },
              { n: '03', t: 'Peer & go live', d: 'Turn up BGP to the route servers and start exchanging traffic.' },
            ].map((s) => (
              <div key={s.n} className="bg-white p-8">
                <div className="text-5xl font-black tracking-tighter text-gray-200">{s.n}</div>
                <h3 className="font-bold text-ink mt-4 mb-1.5">{s.t}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            <button onClick={() => onNavigate?.('portal')} className="bg-ink text-white px-7 py-3.5 font-mono text-label-sm font-bold tracking-mono uppercase hover:bg-[#F20732] transition-colors flex items-center gap-3 group hover-trigger">
              Go to member portal <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button onClick={() => onNavigate?.('technical')} className="border border-gray-300 text-ink px-7 py-3.5 font-mono text-label-sm font-bold tracking-mono uppercase hover:border-ink transition-colors hover-trigger">
              Technical requirements
            </button>
          </div>
        </section>
      </div>
    );
  }

  // ── Wizard ─────────────────────────────────────────────────
  const field = 'w-full px-4 py-3 bg-white border border-gray-300 focus:border-[#F20732] outline-none transition-colors font-mono text-sm text-ink';
  const labelCls = 'block font-mono text-label-sm tracking-label uppercase text-gray-500 mb-2';

  return (
    <div className="min-h-screen bg-white text-ink">
      {/* Hero */}
      <section className="relative bg-ink text-white overflow-hidden pt-36 md:pt-40 pb-12">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#F20732]/15 blur-[120px]" />
        <div className="max-w-[1100px] mx-auto px-6 md:px-12 relative z-10">
          <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Become a Member</span>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-[0.95] mt-4 mb-4">
            Join the <span className="text-[#F20732]">MX-IX</span> fabric
          </h1>
          <p className="text-gray-400 text-base md:text-lg leading-relaxed max-w-2xl">
            A few quick steps to set up your account and request your first port. It takes about two minutes.
          </p>
        </div>
      </section>

      {/* Stepper */}
      <section className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-[1100px] mx-auto px-6 md:px-12 py-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {STEPS.map((s, i) => {
            const active = step === s.id;
            const complete = step > s.id;
            return (
              <React.Fragment key={s.id}>
                <div className={`flex items-center gap-2 flex-shrink-0 ${active ? 'text-ink' : complete ? 'text-[#F20732]' : 'text-gray-400'}`}>
                  <span className={`w-7 h-7 flex items-center justify-center border font-mono text-label-sm ${
                    active ? 'border-ink bg-ink text-white' : complete ? 'border-[#F20732] text-[#F20732]' : 'border-gray-300'
                  }`}>
                    {complete ? <Check className="w-3.5 h-3.5" /> : s.id}
                  </span>
                  <span className="font-mono text-label-sm tracking-mono uppercase hidden sm:inline">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <span className="w-6 h-px bg-gray-200 flex-shrink-0" />}
              </React.Fragment>
            );
          })}
        </div>
      </section>

      {/* Form body */}
      <section className="max-w-[1100px] mx-auto px-6 md:px-12 py-12">
        <div className="border border-gray-200 p-6 md:p-10">
          {/* Step 1 — Network */}
          {step === 1 && (
            <div className="space-y-6">
              <Header tag="Step 1" title="Tell us about your network" />
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className={labelCls}>Company / network name *</label>
                  <input className={field} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Networks Pvt. Ltd." />
                </div>
                <div>
                  <label className={labelCls}>Network type</label>
                  <select className={field} value={type} onChange={(e) => setType(e.target.value)}>
                    {NETWORK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Primary ASN</label>
                  <input className={field} value={asn} onChange={(e) => setAsn(e.target.value.replace(/[^0-9]/g, ''))} placeholder="e.g. 64500" />
                </div>
                <div>
                  <label className={labelCls}>Additional ASNs (comma-separated)</label>
                  <input className={field} value={additionalAsns} onChange={(e) => setAdditionalAsns(e.target.value)} placeholder="e.g. 64501, 64502" />
                </div>
                <div>
                  <label className={labelCls}>Website</label>
                  <input className={field} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://acme.net" />
                </div>
                <div>
                  <label className={labelCls}>Peering policy</label>
                  <select className={field} value={peeringPolicy} onChange={(e) => setPeeringPolicy(e.target.value)}>
                    {POLICIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Connectivity */}
          {step === 2 && (
            <div className="space-y-6">
              <Header tag="Step 2" title="Where do you want to connect?" />
              <div>
                <label className={labelCls}>Location *</label>
                {liveLocations.length === 0 ? (
                  <p className="text-sm text-gray-500">Loading locations…</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-200 border border-gray-200">
                    {liveLocations.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => setLocation(l.id)}
                        className={`text-left p-4 transition-colors hover-trigger ${location === l.id ? 'bg-ink text-white' : 'bg-white hover:bg-gray-50'}`}
                      >
                        <div className="font-bold">{l.name}</div>
                        <div className={`font-mono text-xs mt-0.5 ${location === l.id ? 'text-gray-300' : 'text-gray-400'}`}>{l.country}{l.ixName ? ` · ${l.ixName}` : ''}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className={labelCls}>Port speed *</label>
                  <div className="flex flex-wrap gap-2">
                    {speedOptions.map((s: string) => (
                      <button key={s} onClick={() => setSpeed(s)} className={`px-4 py-2 font-mono text-label-sm tracking-mono uppercase border transition-colors hover-trigger ${speed === s ? 'bg-[#F20732] text-white border-[#F20732]' : 'border-gray-300 text-gray-500 hover:border-ink hover:text-ink'}`}>{s}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Connection type</label>
                  <div className="flex flex-wrap gap-2">
                    {([['cross-connect', 'Cross-connect'], ['remote', 'Remote peering']] as const).map(([v, lbl]) => (
                      <button key={v} onClick={() => setConnType(v)} className={`px-4 py-2 font-mono text-label-sm tracking-mono uppercase border transition-colors hover-trigger ${connType === v ? 'bg-ink text-white border-ink' : 'border-gray-300 text-gray-500 hover:border-ink hover:text-ink'}`}>{lbl}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Readiness */}
          {step === 3 && (
            <div className="space-y-6">
              <Header tag="Step 3" title="Confirm your technical readiness" />
              <p className="text-sm text-gray-500">Tick each item to confirm — these keep the shared fabric clean and get you live faster.</p>
              <div className="border border-gray-200 divide-y divide-gray-200">
                {CHECKS.map((c) => (
                  <button key={c.key} onClick={() => setChecks((p) => ({ ...p, [c.key]: !p[c.key] }))} className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 transition-colors hover-trigger">
                    <span className={`w-6 h-6 flex-shrink-0 flex items-center justify-center border transition-colors ${checks[c.key] ? 'bg-[#F20732] border-[#F20732] text-white' : 'border-gray-300'}`}>
                      {checks[c.key] && <Check className="w-4 h-4" />}
                    </span>
                    <span className="text-sm text-ink">{c.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400">Not sure about something? You can still proceed and our NOC will help you get set up.</p>
            </div>
          )}

          {/* Step 4 — Account */}
          {step === 4 && (
            <div className="space-y-6">
              <Header tag="Step 4" title="Create your portal account" />
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className={labelCls}>Your name *</label>
                  <input className={field} value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Jane Doe" />
                </div>
                <div>
                  <label className={labelCls}>Work email *</label>
                  <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@acme.net" />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 ..." />
                </div>
                <div className="hidden md:block" />
                <div>
                  <label className={labelCls}>Password * (min 8 chars)</label>
                  <input className={field} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <div>
                  <label className={labelCls}>Confirm password *</label>
                  <input className={field} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
                  {confirm && confirm !== password && <p className="text-xs text-[#F20732] mt-1 font-mono">Passwords don't match</p>}
                </div>
              </div>
              <label className="flex items-start gap-3 cursor-pointer hover-trigger">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 accent-[#F20732] w-4 h-4" />
                <span className="text-sm text-gray-600">I agree to the MX-IX terms of service and acknowledge that my account requires approval before activation.</span>
              </label>
            </div>
          )}

          {/* Step 5 — Review */}
          {step === 5 && (
            <div className="space-y-6">
              <Header tag="Step 5" title="Review your application" />
              <div className="grid sm:grid-cols-2 gap-px bg-gray-200 border border-gray-200">
                {[
                  ['Network', companyName],
                  ['Type', type],
                  ['Primary ASN', asn ? `AS${asn}` : '—'],
                  ['Additional ASNs', additionalAsns || '—'],
                  ['Peering policy', peeringPolicy],
                  ['Website', website || '—'],
                  ['Location', selectedLoc?.name || '—'],
                  ['Port speed', speed],
                  ['Connection', connType === 'remote' ? 'Remote peering' : 'Cross-connect'],
                  ['Contact', contactName],
                  ['Email', email],
                  ['Phone', phone || '—'],
                ].map(([k, v]) => (
                  <div key={k} className="bg-white p-4">
                    <div className="font-mono text-label-sm tracking-label uppercase text-gray-400">{k}</div>
                    <div className="text-sm font-bold text-ink mt-0.5 break-words">{v}</div>
                  </div>
                ))}
              </div>
              {error && <div className="border-l-2 border-[#F20732] bg-gray-50 p-4 text-sm text-[#F20732] font-mono">{error}</div>}
            </div>
          )}

          {/* Nav buttons */}
          <div className="flex items-center justify-between mt-10 pt-6 border-t border-gray-200">
            <button
              onClick={back}
              disabled={step === 1}
              className={`px-5 py-3 font-mono text-label-sm font-bold tracking-mono uppercase border transition-colors hover-trigger flex items-center gap-2 ${step === 1 ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-gray-300 text-ink hover:border-ink'}`}
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            {step < 5 ? (
              <button
                onClick={next}
                disabled={!canNext()}
                className={`px-7 py-3 font-mono text-label-sm font-bold tracking-mono uppercase transition-colors flex items-center gap-2 hover-trigger ${canNext() ? 'bg-ink text-white hover:bg-[#F20732]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={submitting}
                className="px-7 py-3 font-mono text-label-sm font-bold tracking-mono uppercase bg-[#F20732] text-white hover:bg-ink transition-colors flex items-center gap-2 hover-trigger disabled:opacity-60"
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : <>Submit application <Check className="w-4 h-4" /></>}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-sm text-gray-400 mt-6">
          Already a member?{' '}
          <button onClick={() => onNavigate?.('portal')} className="text-ink font-bold hover:text-[#F20732] transition-colors hover-trigger">Sign in to the portal</button>
        </p>
      </section>
    </div>
  );
};

const Header: React.FC<{ tag: string; title: string }> = ({ tag, title }) => (
  <div>
    <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// {tag}</span>
    <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-ink mt-2">{title}</h2>
  </div>
);

export default OnboardingPage;
