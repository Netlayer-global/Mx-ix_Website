import React, { useState, useEffect, useMemo } from 'react';
import {
  MapPin,
  Server,
  Network,
  Globe,
  Zap,
  ArrowRight,
  ArrowLeft,
  Check,
  Building2,
  Activity,
  Copy,
  Search,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';
import { useAdmin } from '../contexts/AdminContext';
import { copyText } from '../shared/lg';

interface LocationsPageProps {
  preSelectedLocation?: string;
  preSelectedSection?: string;
}

type AnyLoc = any;

const FALLBACK_LOCATIONS: AnyLoc[] = [
  { id: 'del', name: 'New Delhi', country: 'India', continentId: 'asia', region: 'South Asia', status: 'current', latency: '1.6', datacenter: 'NTT Delhi DC', ixName: 'DELIX', peers: 320, capacity: '150', portSpeeds: ['1G', '10G', '100G'], established: '2023', description: 'North India gateway for enterprise and government networks.' },
  { id: 'bom', name: 'Mumbai', country: 'India', continentId: 'asia', region: 'South Asia', status: 'current', latency: '1.8', datacenter: 'Sify Rabale DC', ixName: 'MBIIX', peers: 340, capacity: '120', portSpeeds: ['1G', '10G', '100G'], established: '2022', description: "India's financial-capital interconnection hub." },
  { id: 'dxb', name: 'Dubai', country: 'UAE', continentId: 'middle-east', region: 'Middle East', status: 'current', latency: '1.4', datacenter: 'Equinix DX1', ixName: 'UAE-IX', peers: 250, capacity: '180', portSpeeds: ['10G', '100G'], established: '2024', description: 'Premier MENA hub connecting Middle East to the world.' },
  { id: 'sjc', name: 'Silicon Valley', country: 'USA', continentId: 'north-america', region: 'North America', status: 'upcoming', latency: '-', datacenter: 'Equinix SV1', ixName: 'SJIIX', peers: 0, capacity: '-', portSpeeds: ['10G', '100G', '400G'], established: 'Coming soon', description: 'Upcoming presence in the heart of Silicon Valley.' },
];

const FALLBACK_CONTINENTS = [
  { id: 'asia', name: 'Asia' },
  { id: 'middle-east', name: 'Middle East' },
  { id: 'europe', name: 'Europe' },
  { id: 'north-america', name: 'North America' },
  { id: 'south-america', name: 'South America' },
];

const isLive = (s: string) => s === 'active' || s === 'current';
const isUpcoming = (s: string) => s === 'planned' || s === 'upcoming';

const statusMeta = (status: string) => {
  if (isLive(status)) return { label: 'Live', dot: 'bg-green-500', text: 'text-green-600' };
  if (status === 'maintenance') return { label: 'Maintenance', dot: 'bg-amber-500', text: 'text-amber-600' };
  return { label: 'Coming soon', dot: 'bg-gray-400', text: 'text-gray-500' };
};

const LocationsPage: React.FC<LocationsPageProps> = ({ preSelectedLocation }) => {
  const { locations: adminLocations, continents: adminContinents } = useAdmin();
  const [region, setRegion] = useState<string>('all');
  const [country, setCountry] = useState<string>('all');
  const [selected, setSelected] = useState<AnyLoc | null>(null);

  const locations: AnyLoc[] = adminLocations.length > 0 ? adminLocations : FALLBACK_LOCATIONS;
  const continents = adminContinents.length > 0 ? adminContinents.map((c) => ({ id: c.id, name: c.name })) : FALLBACK_CONTINENTS;

  useEffect(() => {
    document.body.classList.add('dark-nav');
    return () => document.body.classList.remove('dark-nav');
  }, []);

  useEffect(() => {
    if (preSelectedLocation) {
      const loc = locations.find((l) => l.id === preSelectedLocation);
      if (loc) setSelected(loc);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preSelectedLocation, adminLocations.length]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [selected]);

  // Reset to the list when the "Locations" nav item is clicked again.
  useEffect(() => {
    const onNav = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.page === 'locations') setSelected(null);
    };
    window.addEventListener('app-navigate', onNav);
    return () => window.removeEventListener('app-navigate', onNav);
  }, []);

  // Reset country when region changes
  useEffect(() => { setCountry('all'); }, [region]);

  const stats = useMemo(() => {
    const countries = new Set(locations.map((l) => l.country));
    return {
      live: locations.filter((l) => isLive(l.status)).length,
      countries: countries.size,
      upcoming: locations.filter((l) => isUpcoming(l.status)).length,
    };
  }, [locations]);

  const regionsWithLocations = continents.filter((c) => locations.some((l) => l.continentId === c.id));
  const inRegion = region === 'all' ? locations : locations.filter((l) => l.continentId === region);
  const countriesInRegion = Array.from(new Set(inRegion.map((l) => l.country))).filter(Boolean).sort();
  const visible = inRegion.filter((l) => country === 'all' || l.country === country);

  const goToContact = (city?: string) => {
    window.dispatchEvent(new CustomEvent('navigateToContact', { detail: { city: city || '' } }));
  };

  if (selected) {
    return <LocationDetail loc={selected} onBack={() => setSelected(null)} onRequest={goToContact} />;
  }

  return (
    <div className="min-h-screen bg-white text-ink">
      {/* Hero */}
      <section className="relative bg-ink text-white overflow-hidden pt-36 md:pt-44 pb-20">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#F20732]/15 blur-[120px]" />
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Global Presence</span>
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.95] mt-4 mb-6">
                OUR <span className="text-[#F20732]">LOCATIONS</span>
              </h1>
              <p className="text-gray-400 text-base md:text-lg leading-relaxed max-w-xl border-l-2 border-white/10 pl-6">
                Carrier-neutral points of presence across Asia, the Middle East and beyond — peer once,
                reach everywhere, with low latency and resilient interconnection.
              </p>
              <div className="grid grid-cols-3 gap-4 mt-10 max-w-lg">
                {[
                  { v: stats.live, l: 'Live Cities' },
                  { v: stats.countries, l: 'Countries' },
                  { v: stats.upcoming, l: 'Upcoming' },
                ].map((s) => (
                  <div key={s.l} className="border-l-2 border-[#F20732] pl-4">
                    <div className="text-4xl font-light tracking-tighter tabular-nums">{s.v}</div>
                    <div className="font-mono text-label-sm tracking-label uppercase text-gray-400 mt-1">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="hidden lg:flex items-center justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-[#F20732]/20 blur-3xl rounded-full scale-75" />
                <img src="/assets/globe/globe_hero.png" alt="Global network" className="relative w-full max-w-md h-auto opacity-90" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Region + country filters */}
      <section className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-3 space-y-2">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <span className="font-mono text-label-sm tracking-label uppercase text-gray-400 mr-2 flex-shrink-0 w-16">Region</span>
            {[{ id: 'all', name: 'All' }, ...regionsWithLocations].map((c) => (
              <button
                key={c.id}
                onClick={() => setRegion(c.id)}
                className={`flex-shrink-0 px-4 py-2 font-mono text-label-sm tracking-mono uppercase border transition-colors hover-trigger ${
                  region === c.id ? 'bg-ink text-white border-ink' : 'border-gray-300 text-gray-500 hover:border-ink hover:text-ink'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
          {countriesInRegion.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
              <span className="font-mono text-label-sm tracking-label uppercase text-gray-400 mr-2 flex-shrink-0 w-16">Country</span>
              <button
                onClick={() => setCountry('all')}
                className={`flex-shrink-0 px-4 py-2 font-mono text-label-sm tracking-mono uppercase border transition-colors hover-trigger ${
                  country === 'all' ? 'bg-[#F20732] text-white border-[#F20732]' : 'border-gray-300 text-gray-500 hover:border-ink hover:text-ink'
                }`}
              >
                All
              </button>
              {countriesInRegion.map((c) => (
                <button
                  key={c}
                  onClick={() => setCountry(c)}
                  className={`flex-shrink-0 px-4 py-2 font-mono text-label-sm tracking-mono uppercase border transition-colors hover-trigger ${
                    country === c ? 'bg-[#F20732] text-white border-[#F20732]' : 'border-gray-300 text-gray-500 hover:border-ink hover:text-ink'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Cards grid */}
      <section className="max-w-[1400px] mx-auto px-6 md:px-12 py-12 md:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-200 border border-gray-200">
          {visible.map((loc) => {
            const st = statusMeta(loc.status);
            const live = isLive(loc.status);
            return (
              <button
                key={loc.id}
                onClick={() => live && setSelected(loc)}
                className={`group relative bg-white p-6 text-left overflow-hidden transition-colors ${live ? 'hover:bg-gray-50 hover-trigger cursor-pointer' : 'cursor-default'}`}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732] -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                    <span className={`font-mono text-label-sm tracking-mono uppercase ${st.text}`}>{st.label}</span>
                  </div>
                  <span className="font-mono text-label-sm tracking-label uppercase text-gray-400">{loc.region}</span>
                </div>
                <h3 className="text-2xl font-black tracking-tighter text-ink">{loc.name}</h3>
                <p className="font-mono text-xs text-gray-400 mt-1">{loc.country}{loc.ixName ? ` · ${loc.ixName}` : ''}</p>
                {loc.description && <p className="text-sm text-gray-500 mt-4 leading-relaxed line-clamp-2">{loc.description}</p>}
                {live ? (
                  <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-gray-100">
                    <div>
                      <div className="text-lg font-light tracking-tight text-ink tabular-nums">{loc.peers ?? loc.asns ?? 0}+</div>
                      <div className="font-mono text-label-sm tracking-label uppercase text-gray-400">Networks</div>
                    </div>
                    <div>
                      <div className="text-lg font-light tracking-tight text-ink tabular-nums">{loc.latency && loc.latency !== '-' ? loc.latency : '<2'}<span className="text-xs text-gray-400">ms</span></div>
                      <div className="font-mono text-label-sm tracking-label uppercase text-gray-400">Latency</div>
                    </div>
                    <div>
                      <div className="text-lg font-light tracking-tight text-ink tabular-nums">{(loc.routeServers?.length ?? 0) || (loc.sites ?? 0)}</div>
                      <div className="font-mono text-label-sm tracking-label uppercase text-gray-400">{loc.routeServers?.length ? 'Route Srv' : 'Sites'}</div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 pt-5 border-t border-gray-100">
                    <span className="font-mono text-label-sm tracking-mono uppercase text-gray-400">{loc.established || 'Coming soon'}</span>
                  </div>
                )}
                {live && (
                  <span className="inline-flex items-center gap-1 mt-5 font-mono text-label-sm tracking-mono uppercase text-ink group-hover:text-[#F20732] transition-colors">
                    View details <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {!visible.length && <p className="text-center py-16 font-mono text-label tracking-label uppercase text-gray-400">No locations in this region yet</p>}
      </section>

      {/* Why peer here */}
      <section className="border-t border-gray-200 bg-gray-50">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-14">
          <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Why MX-IX</span>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter mt-2 mb-10">One fabric, every location</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200 border border-gray-200">
            {[
              { icon: Building2, t: 'Carrier & DC neutral', d: 'Connect from any carrier or data center — no lock-in, your choice of provider.' },
              { icon: Network, t: 'One port, full reach', d: 'A single connection peers you with every network on the exchange. No per-bit fees.' },
              { icon: Zap, t: 'Low latency', d: 'Local interconnection keeps traffic in-region — typically sub-2ms across the fabric.' },
              { icon: ShieldCheck, t: '24/7 NOC + route servers', d: 'Multilateral route servers with RPKI/IRR filtering, monitored around the clock.' },
            ].map((b) => (
              <div key={b.t} className="bg-white p-6">
                <b.icon className="w-6 h-6 text-[#F20732] mb-4" />
                <h3 className="font-bold text-ink mb-1.5">{b.t}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{b.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How to connect */}
      <section className="max-w-[1400px] mx-auto px-6 md:px-12 py-14">
        <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Get Connected</span>
        <h2 className="text-3xl md:text-4xl font-black tracking-tighter mt-2 mb-10">Live in three steps</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-gray-200 border border-gray-200">
          {[
            { n: '01', t: 'Pick a location', d: 'Choose a city and port speed that fits your network and traffic profile.' },
            { n: '02', t: 'Order your port', d: 'Request a port — our team confirms availability, cross-connect and pricing.' },
            { n: '03', t: 'Peer & go live', d: 'Turn up BGP to the route servers and start exchanging traffic with the fabric.' },
          ].map((s) => (
            <div key={s.n} className="bg-white p-8">
              <div className="text-5xl font-black tracking-tighter text-gray-200">{s.n}</div>
              <h3 className="font-bold text-ink mt-4 mb-1.5">{s.t}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-ink text-white">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-14 flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#F20732]/15 blur-[110px]" />
          <div className="relative">
            <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Connect</span>
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter mt-2">Peer at any MX-IX location</h2>
            <p className="text-gray-400 mt-2 max-w-xl">One port, one connection — reach every network on the fabric.</p>
          </div>
          <button onClick={() => goToContact()} className="relative self-start md:self-auto bg-[#F20732] text-white px-7 py-3.5 font-mono text-label-sm font-bold tracking-mono uppercase hover:bg-white hover:text-ink transition-colors flex items-center gap-3 group hover-trigger whitespace-nowrap">
            Request a Port <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>
    </div>
  );
};

// ── Full city detail page ──────────────────────────────────────────────────
const CopyChip: React.FC<{ value: string }> = ({ value }) => {
  const [done, setDone] = useState(false);
  if (!value) return <span className="text-gray-400">—</span>;
  return (
    <button
      onClick={async () => { if (await copyText(value)) { setDone(true); setTimeout(() => setDone(false), 1200); } }}
      className="inline-flex items-center gap-1.5 font-mono text-xs text-gray-600 hover:text-[#F20732] transition-colors hover-trigger group"
    >
      {value}
      {done ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100" />}
    </button>
  );
};

const LocationDetail: React.FC<{ loc: AnyLoc; onBack: () => void; onRequest: (city?: string) => void }> = ({ loc, onBack, onRequest }) => {
  const [asnQuery, setAsnQuery] = useState('');
  const asns: AnyLoc[] = loc.asnList || [];
  const sites: AnyLoc[] = loc.enabledSites || [];
  const routeServers: AnyLoc[] = loc.routeServers || [];
  const features: string[] = loc.features || [];
  const portSpeeds: string[] = loc.portSpeeds || [];
  const st = statusMeta(loc.status);

  const money = (n: number, cur?: string) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency: cur || 'USD', maximumFractionDigits: 0 }).format(n || 0);

  // Use location-specific pricing if set; otherwise indicative standard pricing
  // derived from the available port speeds (admin can override per-location).
  const DEFAULT_PRICE: Record<string, number> = { '1G': 250, '10G': 500, '25G': 900, '40G': 1100, '100G': 1500, '400G': 4000 };
  const explicitPricing: AnyLoc[] = loc.pricing || [];
  const pricing: AnyLoc[] = explicitPricing.length
    ? explicitPricing
    : portSpeeds
        .filter((s) => DEFAULT_PRICE[s])
        .map((s) => ({ portSpeed: s, monthlyPrice: DEFAULT_PRICE[s], setupFee: 0, currency: 'USD' }));
  const pricingIsIndicative = explicitPricing.length === 0;

  const filteredAsns = asnQuery
    ? asns.filter((a) => `${a.name} ${a.asnNumber} ${a.macro || ''}`.toLowerCase().includes(asnQuery.toLowerCase()))
    : asns;

  const heroStats = [
    { v: loc.peers ?? asns.length ?? 0, suffix: '+', l: 'Networks' },
    { v: routeServers.length, l: 'Route Servers' },
    { v: sites.length || loc.sites || 0, l: 'Enabled Sites' },
    { v: loc.latency && loc.latency !== '-' ? loc.latency : '<2', suffix: 'ms', l: 'Latency' },
  ];

  const facts = [
    { icon: Building2, label: 'Data Center', value: loc.datacenter },
    { icon: Network, label: 'Exchange', value: loc.ixName || loc.code },
    { icon: Globe, label: 'Capacity', value: loc.capacity && loc.capacity !== '-' ? `${String(loc.capacity).replace('+', '')} Tbps` : undefined },
    { icon: Activity, label: 'Established', value: loc.established },
  ].filter((f) => f.value);

  return (
    <div className="min-h-screen bg-white text-ink">
      {/* Hero */}
      <section className="relative bg-ink text-white overflow-hidden pt-32 md:pt-36 pb-12">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#F20732]/15 blur-[120px]" />
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 relative z-10">
          <button onClick={onBack} className="inline-flex items-center gap-2 font-mono text-label-sm tracking-mono uppercase text-gray-400 hover:text-white transition-colors mb-8 hover-trigger">
            <ArrowLeft className="w-4 h-4" /> All locations
          </button>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// {loc.region}</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.9]">{loc.name}</h1>
              <p className="text-gray-300 text-lg mt-3">{loc.country}</p>
            </div>
            <button onClick={() => onRequest(loc.name)} className="bg-[#F20732] text-white px-6 py-3.5 font-mono text-label-sm font-bold tracking-mono uppercase hover:bg-white hover:text-ink transition-colors flex items-center gap-2 hover-trigger">
              Request a port <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Hero stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 border border-white/10 mt-10">
            {heroStats.map((s) => (
              <div key={s.l} className="bg-ink p-5">
                <div className="text-3xl md:text-4xl font-light tracking-tighter tabular-nums">
                  {s.v}{s.suffix && <span className="text-base text-gray-500 ml-1">{s.suffix}</span>}
                </div>
                <div className="font-mono text-label-sm tracking-label uppercase text-gray-400 mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-[1400px] mx-auto px-6 md:px-12 py-12 md:py-16">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left: overview */}
          <div className="lg:col-span-2 space-y-10">
            {loc.description && (
              <div>
                <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Overview</span>
                <p className="text-gray-600 text-lg leading-relaxed mt-3">{loc.description}</p>
              </div>
            )}

            {/* Facts */}
            {facts.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-200 border border-gray-200">
                {facts.map((f) => (
                  <div key={f.label} className="bg-white p-4">
                    <f.icon className="w-4 h-4 text-[#F20732] mb-2" />
                    <div className="font-mono text-label-sm tracking-label uppercase text-gray-400">{f.label}</div>
                    <div className="text-sm font-bold text-ink mt-0.5">{f.value}</div>
                  </div>
                ))}
              </div>
            )}

            {loc.address && (
              <div className="flex items-start gap-3 border border-gray-200 p-5">
                <MapPin className="w-5 h-5 text-[#F20732] flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-mono text-label-sm tracking-label uppercase text-gray-400 mb-1">Facility Address</div>
                  <p className="text-sm text-ink">{loc.address}</p>
                </div>
              </div>
            )}

            {/* Pricing */}
            {pricing.length > 0 && (
              <div>
                <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
                  <h3 className="font-mono text-label tracking-label uppercase text-ink flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#F20732]" /> Port Pricing
                  </h3>
                  <span className="font-mono text-label-sm tracking-mono uppercase text-green-600">No traffic charges</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-200 border border-gray-200">
                  {pricing.map((p, i) => (
                    <div key={i} className="group relative bg-white p-5 overflow-hidden hover:bg-gray-50 transition-colors">
                      <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732] -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
                      <div className="font-mono text-label tracking-label uppercase text-gray-400">{p.portSpeed} Port</div>
                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-3xl font-black tracking-tighter text-ink">{money(p.monthlyPrice, p.currency)}</span>
                        <span className="text-sm text-gray-400 font-mono">/mo</span>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                        <span className="font-mono text-label-sm tracking-label uppercase text-gray-400">Setup</span>
                        <span className="text-sm font-bold text-ink tabular-nums">{p.setupFee ? money(p.setupFee, p.currency) : 'Free'}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  One port unlocks the entire peering ecosystem — unlimited peering, no per-bit/traffic fees. Taxes may apply.
                  {pricingIsIndicative && ' Prices shown are indicative — contact us for a formal quote.'}
                </p>
              </div>
            )}

            {/* Route servers */}
            {routeServers.length > 0 && (
              <div>
                <h3 className="font-mono text-label tracking-label uppercase text-ink mb-4 flex items-center gap-2"><Server className="w-4 h-4 text-[#F20732]" /> Route Servers</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {routeServers.map((rs, i) => (
                    <div key={i} className="border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-ink">{rs.name}</span>
                        <span className="font-mono text-xs text-gray-400">AS{rs.asn}</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2"><span className="font-mono text-label-sm tracking-label uppercase text-gray-400">IPv4</span><CopyChip value={rs.ipv4} /></div>
                        <div className="flex items-center justify-between gap-2"><span className="font-mono text-label-sm tracking-label uppercase text-gray-400">IPv6</span><CopyChip value={rs.ipv6} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Connected networks */}
            {asns.length > 0 && (
              <div>
                <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
                  <h3 className="font-mono text-label tracking-label uppercase text-ink flex items-center gap-2"><Network className="w-4 h-4 text-[#F20732]" /> Connected Networks <span className="text-gray-400">({asns.length})</span></h3>
                  {asns.length > 6 && (
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input value={asnQuery} onChange={(e) => setAsnQuery(e.target.value)} placeholder="Search ASN…" className="pl-9 pr-3 py-2 border border-gray-300 font-mono text-sm focus:outline-none focus:border-[#F20732] w-48" />
                    </div>
                  )}
                </div>
                <div className="border border-gray-200 divide-y divide-gray-100 max-h-96 overflow-y-auto">
                  {filteredAsns.map((a, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="font-bold text-ink">{a.name}</span>
                        <span className="font-mono text-xs text-gray-400 ml-2">AS{a.asnNumber}</span>
                        {a.macro && <span className="font-mono text-xs text-gray-400 ml-2">{a.macro}</span>}
                      </div>
                      <span className="font-mono text-label-sm tracking-mono uppercase text-gray-400 flex-shrink-0">{a.peeringPolicy}</span>
                    </div>
                  ))}
                  {!filteredAsns.length && <p className="px-4 py-6 text-center font-mono text-label-sm tracking-mono uppercase text-gray-400">No match</p>}
                </div>
              </div>
            )}

            {/* Enabled sites */}
            {sites.length > 0 && (
              <div>
                <h3 className="font-mono text-label tracking-label uppercase text-ink mb-4 flex items-center gap-2"><Building2 className="w-4 h-4 text-[#F20732]" /> Enabled Sites</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {sites.map((s, i) => (
                    <div key={i} className="border border-gray-200 p-4">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-sm text-ink">{s.name}</p>
                        {s.status && <span className="font-mono text-label-sm tracking-mono uppercase text-gray-400">{s.status === 'available' ? 'Available' : 'Soon'}</span>}
                      </div>
                      <p className="font-mono text-xs text-gray-400 mt-0.5">{s.provider}</p>
                      {s.address && <p className="text-xs text-gray-500 mt-1">{s.address}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: sticky info / connect */}
          <aside className="lg:col-span-1">
            <div className="lg:sticky lg:top-24 space-y-6">
              {portSpeeds.length > 0 && (
                <div className="border border-gray-200 p-5">
                  <h3 className="font-mono text-label tracking-label uppercase text-ink mb-3">Port Speeds</h3>
                  <div className="flex flex-wrap gap-2">
                    {portSpeeds.map((s) => (
                      <span key={s} className="px-3 py-1.5 border border-gray-300 font-mono text-label-sm tracking-mono uppercase text-ink">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {features.length > 0 && (
                <div className="border border-gray-200 p-5">
                  <h3 className="font-mono text-label tracking-label uppercase text-ink mb-3">Highlights</h3>
                  <div className="space-y-2">
                    {features.map((f) => (
                      <div key={f} className="flex items-start gap-2 text-sm text-gray-600">
                        <Check className="w-4 h-4 text-[#F20732] flex-shrink-0 mt-0.5" /> {f}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-ink text-white p-6 relative overflow-hidden">
                <div className="absolute -top-16 -right-12 w-44 h-44 rounded-full bg-[#F20732]/15 blur-[80px]" />
                <ShieldCheck className="w-6 h-6 text-[#F20732] mb-3" />
                <h3 className="text-xl font-black tracking-tight mb-1">Connect at {loc.name}</h3>
                <p className="text-gray-400 text-sm mb-4">Get availability and pricing for a port at this location.</p>
                <button onClick={() => onRequest(loc.name)} className="w-full bg-[#F20732] text-white px-5 py-3 font-mono text-label-sm font-bold tracking-mono uppercase hover:bg-white hover:text-ink transition-colors flex items-center justify-center gap-2 hover-trigger">
                  Request a port <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
};

export default LocationsPage;
