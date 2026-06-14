import React from 'react';
import {
  ArrowRight,
  Copy,
  Check,
  ShieldCheck,
  Server,
  Network,
  Filter,
  GitBranch,
  ListChecks,
  Cable,
} from 'lucide-react';
import { useAdmin } from '../contexts/AdminContext';
import { copyText } from '../shared/lg';

const NAV = [
  { id: 'checklist', label: 'Get Connected' },
  { id: 'security', label: 'Security Policy' },
  { id: 'ip-traffic', label: 'IP Traffic Exchange' },
  { id: 'route-servers', label: 'Route Servers' },
  { id: 'filtering', label: 'Prefix Filtering' },
];

const FILTER_RULES = [
  'Drop small prefixes — longer than /24 for IPv4 and longer than /48 for IPv6.',
  'Drop all well-known Martians and bogons.',
  'Ensure there is at least 1 ASN and fewer than 64 ASNs in the AS path.',
  'Ensure the peer AS is the same as the first AS in the AS path.',
  'Drop any prefix where the next-hop IP is not the peer IP address — this prevents prefix hijacking.',
  'Drop any prefix with a transit network (Internet or IP Transit) ASN in the AS path.',
  'Ensure the origin AS is in the set of ASNs from the client’s IRRDB AS-SET.',
  'If the prefix is RPKI valid, it is accepted.',
  'If the prefix is RPKI invalid, it is dropped.',
  'If the prefix is RPKI unknown, revert to standard IRRDB prefix filtering.',
];

const CHECKLIST = [
  { icon: Network, t: 'Public ASN', d: 'A globally unique Autonomous System Number to identify your network.' },
  { icon: Cable, t: 'A port at a PoP', d: 'A 1G–400G port at one of our enabled data centers, plus a cross-connect.' },
  { icon: GitBranch, t: 'BGP-capable router', d: 'A router that speaks BGP-4 with support for IPv4 and IPv6 sessions.' },
  { icon: ShieldCheck, t: 'PeeringDB + IRR/RPKI', d: 'An up-to-date PeeringDB record and registered IRR objects / ROAs for your prefixes.' },
];

const CopyChip: React.FC<{ value?: string }> = ({ value }) => {
  const [done, setDone] = React.useState(false);
  if (!value) return <span className="text-gray-400">—</span>;
  return (
    <button
      onClick={async () => { if (await copyText(value)) { setDone(true); setTimeout(() => setDone(false), 1200); } }}
      className="inline-flex items-center gap-1.5 font-mono text-sm text-gray-600 hover:text-[#F20732] transition-colors hover-trigger group"
    >
      {value}
      {done ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100" />}
    </button>
  );
};

const RouteServerTable = () => {
  const { locations } = useAdmin();
  const [selectedCityId, setSelectedCityId] = React.useState('');

  React.useEffect(() => {
    if (locations.length > 0 && !selectedCityId) setSelectedCityId(locations[0].id);
  }, [locations, selectedCityId]);

  const selectedLocation = locations.find((loc) => loc.id === selectedCityId);
  const servers = selectedLocation?.routeServers || [];

  return (
    <div className="border border-gray-200">
      {/* Header / filter */}
      <div className="p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-[#F20732] animate-pulse" />
          <h4 className="font-mono text-label tracking-label uppercase text-ink">Route Server Status</h4>
        </div>
        <div className="relative">
          <select
            value={selectedCityId}
            onChange={(e) => setSelectedCityId(e.target.value)}
            className="bg-white text-ink border border-gray-300 py-2 pl-4 pr-10 appearance-none focus:outline-none focus:border-[#F20732] transition-colors cursor-pointer min-w-[200px] font-mono text-sm"
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
          <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-200">
              {['Route Server', 'ASN', 'IPv4', 'IPv6'].map((h) => (
                <th key={h} className="py-3.5 px-6 font-mono text-label-sm text-[#F20732] uppercase tracking-label font-bold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {servers.length > 0 ? (
              servers.map((server, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6 font-bold text-ink">{server.name}</td>
                  <td className="py-4 px-6 text-gray-500 font-mono text-sm">AS{server.asn}</td>
                  <td className="py-4 px-6"><CopyChip value={server.ipv4} /></td>
                  <td className="py-4 px-6"><CopyChip value={server.ipv6} /></td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-12 text-center font-mono text-label-sm tracking-mono uppercase text-gray-400">
                  No route server details available for this location yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SectionTitle: React.FC<{ tag: string; title: string; icon: React.ElementType }> = ({ tag, title, icon: Icon }) => (
  <div className="mb-6">
    <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// {tag}</span>
    <h3 className="text-2xl md:text-3xl font-black tracking-tighter text-ink mt-2 flex items-center gap-3">
      <Icon className="w-6 h-6 text-[#F20732]" /> {title}
    </h3>
  </div>
);

const goToContact = () => {
  window.history.pushState({}, '', '/contact');
  window.dispatchEvent(new PopStateEvent('popstate'));
};

const TechnicalPage = () => {
  const [active, setActive] = React.useState('checklist');

  React.useEffect(() => {
    document.body.classList.add('dark-nav');
    return () => document.body.classList.remove('dark-nav');
  }, []);

  // Scrollspy
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
      },
      { rootMargin: '-30% 0px -60% 0px' }
    );
    NAV.forEach((n) => {
      const el = document.getElementById(n.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      const offset = 110;
      const top = element.getBoundingClientRect().top - document.body.getBoundingClientRect().top - offset;
      window.scrollTo({ top, behavior: 'smooth' });
      window.history.pushState(null, '', `#${id}`);
    }
  };

  return (
    <div className="min-h-screen bg-white text-ink">
      {/* Hero */}
      <section className="relative bg-ink text-white overflow-hidden pt-36 md:pt-44 pb-16">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#F20732]/15 blur-[120px]" />
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 relative z-10">
          <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Member Resources</span>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.95] mt-4 mb-6">
            TECHNICAL <span className="text-[#F20732]">REQUIREMENTS</span>
          </h1>
          <p className="text-gray-400 text-base md:text-lg leading-relaxed max-w-2xl border-l-2 border-white/10 pl-6">
            Security policy, BGP configuration and operational standards for connecting to the
            shared MX-IX Layer 2 fabric.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 border border-white/10 mt-12">
            {[
              { v: 'BGP-4', l: 'Routing protocol' },
              { v: 'IPv4 + IPv6', l: 'Dual-stack' },
              { v: 'RPKI + IRR', l: 'Prefix filtering' },
              { v: 'Dual', l: 'Route servers' },
            ].map((s) => (
              <div key={s.l} className="bg-ink p-5">
                <div className="text-2xl md:text-3xl font-light tracking-tighter">{s.v}</div>
                <div className="font-mono text-label-sm tracking-label uppercase text-gray-400 mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main content */}
      <section className="max-w-[1400px] mx-auto px-6 md:px-12 py-14 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Sidebar */}
          <aside className="lg:col-span-3">
            <div className="sticky top-28 space-y-1">
              <div className="font-mono text-label-sm tracking-label uppercase text-gray-400 mb-3 px-4">On this page</div>
              {NAV.map((n) => (
                <a
                  key={n.id}
                  href={`#${n.id}`}
                  onClick={(e) => scrollToSection(e, n.id)}
                  className={`block font-mono text-label-sm font-bold uppercase tracking-mono py-2 border-l-2 pl-4 transition-colors hover-trigger ${
                    active === n.id ? 'border-[#F20732] text-ink' : 'border-gray-200 text-gray-500 hover:text-ink hover:border-gray-400'
                  }`}
                >
                  {n.label}
                </a>
              ))}
            </div>
          </aside>

          {/* Content */}
          <div className="lg:col-span-9 space-y-16">
            {/* Get connected checklist */}
            <div id="checklist" className="scroll-mt-28">
              <SectionTitle tag="Get Connected" title="What you'll need" icon={ListChecks} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-200 border border-gray-200">
                {CHECKLIST.map((c) => (
                  <div key={c.t} className="bg-white p-6">
                    <c.icon className="w-6 h-6 text-[#F20732] mb-4" />
                    <h4 className="font-bold text-ink mb-1.5">{c.t}</h4>
                    <p className="text-sm text-gray-500 leading-relaxed">{c.d}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Security */}
            <div id="security" className="scroll-mt-28">
              <SectionTitle tag="Policy" title="Security Policy" icon={ShieldCheck} />
              <div className="border-l-2 border-[#F20732] bg-gray-50 p-6">
                <p className="text-gray-700 leading-relaxed">
                  The MX-IX security policy ensures Members receive reliable, uninterrupted service
                  while limiting the risk that deliberate or accidental mistakes, defective equipment,
                  or one Member's lack of capacity degrade the experience of others. All Members are
                  expected to follow these operational standards to keep the shared fabric clean and
                  resilient.
                </p>
              </div>
            </div>

            {/* IP Traffic Exchange */}
            <div id="ip-traffic" className="scroll-mt-28">
              <SectionTitle tag="Routing" title="IP Traffic Exchange" icon={Network} />
              <p className="text-gray-600 mb-6">IP traffic is exchanged between Members using the BGP protocol in two ways:</p>
              <div className="grid md:grid-cols-2 gap-px bg-gray-200 border border-gray-200">
                <div className="group relative bg-white p-6 overflow-hidden hover:bg-gray-50 transition-colors">
                  <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732] -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
                  <div className="text-4xl font-black tracking-tighter text-gray-200">01</div>
                  <h4 className="font-bold text-ink mt-3 mb-1.5">Route Servers (RS)</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">Two redundant route servers give you multilateral peering with every member from a single session.</p>
                </div>
                <div className="group relative bg-white p-6 overflow-hidden hover:bg-gray-50 transition-colors">
                  <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732] -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
                  <div className="text-4xl font-black tracking-tighter text-gray-200">02</div>
                  <h4 className="font-bold text-ink mt-3 mb-1.5">Bilateral BGP Sessions</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">Direct sessions between Members and content providers under their own mutual peering agreements.</p>
                </div>
              </div>
            </div>

            {/* Route Servers */}
            <div id="route-servers" className="scroll-mt-28">
              <SectionTitle tag="Configuration" title="Route Server Details" icon={Server} />

              {/* Config note */}
              <div className="border-l-2 border-ink bg-gray-50 p-6 mb-6">
                <p className="font-mono text-label-sm tracking-label uppercase text-ink mb-1.5">Peering configuration note</p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Use <span className="font-mono font-bold text-ink">no bgp enforce-first-as</span> (Cisco) or
                  {' '}<span className="font-mono font-bold text-ink">undo check-first-as</span> (Huawei), as our
                  route servers do not place their own AS first in the AS_PATH.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-px bg-gray-200 border border-gray-200 mb-8">
                <div className="bg-ink text-gray-300 p-5 font-mono text-sm">
                  <div className="text-[#F20732] mb-2 font-bold uppercase text-[10px] tracking-label">Cisco IOS / IOS-XE</div>
                  <code className="block">no bgp enforce-first-as</code>
                  <span className="text-gray-600 italic">or</span>
                  <code className="block">bgp enforce-first-as disable</code>
                </div>
                <div className="bg-ink text-gray-300 p-5 font-mono text-sm">
                  <div className="text-[#F20732] mb-2 font-bold uppercase text-[10px] tracking-label">Huawei VRP</div>
                  <code className="block">undo check-first-as</code>
                </div>
              </div>

              <RouteServerTable />
              <p className="text-xs text-gray-400 mt-3 font-mono">Select a location to view its route server addresses · click an IP to copy.</p>
            </div>

            {/* Prefix filtering */}
            <div id="filtering" className="scroll-mt-28">
              <SectionTitle tag="Hygiene" title="Incoming Prefix Filtering" icon={Filter} />
              <div className="border border-gray-200">
                <div className="px-6 py-3.5 border-b border-gray-200 bg-gray-50">
                  <h5 className="font-mono text-label-sm tracking-label uppercase text-gray-500">Filtering policy rules</h5>
                </div>
                <ul className="divide-y divide-gray-100">
                  {FILTER_RULES.map((rule, idx) => (
                    <li key={idx} className="px-6 py-4 flex items-start gap-4 hover:bg-gray-50 transition-colors">
                      <span className="font-mono text-[#F20732] text-sm pt-0.5 tabular-nums">{String(idx + 1).padStart(2, '0')}</span>
                      <span className="text-sm text-gray-700 leading-relaxed">{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-ink text-white">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-14 flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#F20732]/15 blur-[110px]" />
          <div className="relative">
            <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Need a hand?</span>
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter mt-2">Ready to configure your session?</h2>
            <p className="text-gray-400 mt-2 max-w-xl">Our NOC can help you turn up BGP and get your prefixes filtered correctly.</p>
          </div>
          <button
            onClick={goToContact}
            className="relative self-start md:self-auto bg-[#F20732] text-white px-7 py-3.5 font-mono text-label-sm font-bold tracking-mono uppercase hover:bg-white hover:text-ink transition-colors flex items-center gap-3 group hover-trigger whitespace-nowrap"
          >
            Contact the NOC <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>
    </div>
  );
};

export default TechnicalPage;
