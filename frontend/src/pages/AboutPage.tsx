import React, { useEffect, useMemo } from 'react';
import {
  ArrowRight,
  Network,
  Zap,
  ShieldCheck,
  Scale,
  Activity,
  Globe2,
  Users,
} from 'lucide-react';
import { useAdmin } from '../contexts/AdminContext';

const isLive = (s: string) => s === 'active' || s === 'current';

interface AboutPageProps {
  onNavigate?: (page: string) => void;
}

const goToContact = (onNavigate?: (p: string) => void) => {
  if (onNavigate) return onNavigate('contact');
  window.history.pushState({}, '', '/contact');
  window.dispatchEvent(new PopStateEvent('popstate'));
};

const AboutPage: React.FC<AboutPageProps> = ({ onNavigate }) => {
  const { locations } = useAdmin();

  useEffect(() => {
    document.body.classList.add('dark-nav');
    return () => document.body.classList.remove('dark-nav');
  }, []);

  const stats = useMemo(() => {
    const live = locations.filter((l) => isLive(l.status));
    const countries = new Set(locations.map((l) => l.country).filter(Boolean));
    return {
      cities: live.length || 2,
      countries: countries.size || 2,
    };
  }, [locations]);

  const heroStats = [
    { v: '2026', l: 'Founded' },
    { v: `${stats.countries}+`, l: 'Countries' },
    { v: `${stats.cities}+`, l: 'Live Cities' },
    { v: '400G', l: 'Max Port Speed' },
  ];

  return (
    <div className="min-h-screen bg-white text-ink">
      {/* Hero */}
      <section className="relative bg-ink text-white overflow-hidden pt-36 md:pt-44 pb-20">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#F20732]/15 blur-[120px]" />
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 relative z-10">
          <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Our Story</span>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.95] mt-4 mb-6">
            ABOUT <span className="text-[#F20732]">MX-IX</span>
          </h1>
          <p className="text-gray-400 text-base md:text-lg leading-relaxed max-w-2xl border-l-2 border-white/10 pl-6">
            MX-IX is a carrier- and data-center-neutral Internet Exchange where networks meet to
            exchange traffic directly — improving performance, cutting transit costs and keeping
            local traffic local.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 border border-white/10 mt-12">
            {heroStats.map((s) => (
              <div key={s.l} className="bg-ink p-5">
                <div className="text-3xl md:text-4xl font-light tracking-tighter tabular-nums">{s.v}</div>
                <div className="font-mono text-label-sm tracking-label uppercase text-gray-400 mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-16 grid lg:grid-cols-3 gap-10 items-start">
          <div className="lg:col-span-2">
            <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Mission</span>
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter mt-2 mb-6">Make interconnection simple, open and accessible</h2>
            <p className="text-gray-600 text-lg leading-relaxed mb-4">
              By bringing ISPs, content providers, cloud platforms and enterprises onto a single
              neutral fabric, we let networks peer directly instead of hauling traffic across
              expensive, distant transit paths.
            </p>
            <p className="text-gray-600 text-lg leading-relaxed">
              Connect once and reach the entire MX-IX ecosystem. From a regional ISP to a global
              content network, our route servers and high-capacity ports make peering effortless and
              scalable — from 1G all the way to 400G.
            </p>
          </div>
          <div className="border border-gray-200 divide-y divide-gray-200">
            {[
              { icon: Globe2, t: 'Neutral fabric', d: 'No carrier or DC lock-in.' },
              { icon: Network, t: 'One port, full reach', d: 'Peer with every member.' },
              { icon: ShieldCheck, t: 'Secure routing', d: 'RPKI + IRR filtered.' },
            ].map((f) => (
              <div key={f.t} className="flex items-start gap-4 p-5">
                <f.icon className="w-5 h-5 text-[#F20732] flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-ink">{f.t}</div>
                  <div className="text-sm text-gray-500">{f.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why peer */}
      <section className="border-b border-gray-200 bg-gray-50">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-16">
          <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Why Peer at MX-IX</span>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter mt-2 mb-10">The case for direct interconnection</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-gray-200 border border-gray-200">
            {[
              { icon: Network, t: 'Connect once, reach many', d: 'A single port to our route servers gives you multilateral peering with every network on the exchange — no session-by-session negotiation.' },
              { icon: Zap, t: 'Lower latency & cost', d: 'Keep local traffic local. Direct peering shortens paths, reduces round-trip times and cuts expensive IP transit spend.' },
              { icon: ShieldCheck, t: 'Resilient & protected', d: 'Redundant route servers, 24/7 NOC monitoring and built-in blackholing keep your traffic flowing and shielded from volumetric DDoS.' },
            ].map((c) => (
              <div key={c.t} className="group relative bg-white p-8 overflow-hidden hover:bg-gray-50 transition-colors">
                <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732] -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
                <c.icon className="w-8 h-8 text-[#F20732] mb-5" />
                <h3 className="text-xl font-bold tracking-tight text-ink mb-2">{c.t}</h3>
                <p className="text-gray-500 leading-relaxed">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Journey / milestones */}
      <section className="border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-16">
          <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Journey</span>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter mt-2 mb-10">How we're growing the regional internet</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-gray-200 border border-gray-200">
            {[
              { n: '01', t: 'Launch', d: 'MX-IX goes live with carrier-neutral PoPs and multilateral route servers.' },
              { n: '02', t: 'Expand', d: 'New cities added across South Asia and the Middle East, growing reach.' },
              { n: '03', t: 'Enrich', d: 'Cloud on-ramps, DDoS protection and a self-service member portal.' },
              { n: '04', t: 'Scale', d: '400G-ready fabric and deeper interconnection with global networks.' },
            ].map((m) => (
              <div key={m.n} className="bg-white p-8">
                <div className="text-5xl font-black tracking-tighter text-gray-200">{m.n}</div>
                <h3 className="font-bold text-ink mt-4 mb-1.5">{m.t}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{m.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-ink text-white relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#F20732]/15 blur-[110px]" />
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-16 relative z-10">
          <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// What We Stand For</span>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter mt-2 mb-10">Our values</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 border border-white/10">
            {[
              { icon: Scale, t: 'Neutrality', d: 'Carrier- and DC-neutral by design. Every network connects on equal terms.' },
              { icon: Activity, t: 'Reliability', d: 'Redundant switching, dual route servers and 24/7 monitoring. 99.99% is the baseline.' },
              { icon: Globe2, t: 'Openness', d: 'Transparent pricing, an open peering policy and a public looking glass.' },
              { icon: Users, t: 'Community', d: 'We make interconnection affordable for networks of every size.' },
            ].map((v) => (
              <div key={v.t} className="bg-ink p-8">
                <v.icon className="w-7 h-7 text-[#F20732] mb-4" />
                <h3 className="text-lg font-bold mb-2">{v.t}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{v.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white border-t border-gray-200">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-16 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Join Us</span>
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter mt-2">Become part of the fabric</h2>
            <p className="text-gray-500 mt-2 max-w-xl">Peer at MX-IX and reach every network on the exchange with a single connection.</p>
          </div>
          <button
            onClick={() => goToContact(onNavigate)}
            className="self-start md:self-auto bg-ink text-white px-7 py-3.5 font-mono text-label-sm font-bold tracking-mono uppercase hover:bg-[#F20732] transition-colors flex items-center gap-3 group hover-trigger whitespace-nowrap"
          >
            Get in touch <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
