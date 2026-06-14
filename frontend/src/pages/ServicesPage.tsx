import React, { useState, useEffect, useMemo } from 'react';
import { ArrowRight, Check, Plus, Minus, Network, Zap, ShieldCheck, Headphones, Server, Cloud, Building2, Radio } from 'lucide-react';
import { servicesApi, Service } from '../services/api';

// Who connects to the exchange — value props tailored by network type
const USE_CASES = [
  { icon: Radio, t: 'ISPs & Eyeball Networks', d: 'Cut transit costs and improve last-mile latency by peering directly with the content your subscribers request most.', tags: ['Lower transit', 'Better QoE'] },
  { icon: Cloud, t: 'Content & CDN', d: 'Push bits closer to end users with dense, low-latency interconnection across every PoP on the fabric.', tags: ['Edge reach', 'Throughput'] },
  { icon: Building2, t: 'Enterprises', d: 'Reach cloud on-ramps, SaaS and partners over private, predictable paths instead of the public internet.', tags: ['Private paths', 'Cloud on-ramp'] },
  { icon: Server, t: 'Cloud & Hosting', d: 'Aggregate peering in one port and scale capacity on demand as your traffic profile grows.', tags: ['Scale on demand', 'One port'] },
];

// Peering FAQs
const FAQS = [
  { q: 'How long does it take to get connected?', a: 'Once your port order and cross-connect are confirmed, most members are live and exchanging traffic within a few business days. Provisioning timelines depend on your chosen data center and cross-connect provider.' },
  { q: 'Do you charge for traffic?', a: 'No. MX-IX is a flat-rate exchange — you pay for the port, not the bits. There are no per-megabit or 95th-percentile traffic charges, so your costs stay predictable as you grow.' },
  { q: 'What do I need to peer on the route servers?', a: 'A public ASN, a registered PeeringDB record, and IRR/RPKI objects for the prefixes you announce. Our route servers apply RPKI and IRR filtering by default to keep the fabric clean.' },
  { q: 'Can I run both bilateral and multilateral peering?', a: 'Yes. You can peer multilaterally through the route servers for instant reach, and set up bilateral sessions with specific networks for direct control — both over the same port.' },
  { q: 'Is redundancy available?', a: 'Yes. You can order ports at multiple sites or take a second port for resiliency, and the fabric runs redundant route servers so a single failure never isolates you.' },
];

// Icon components for rendering based on backend icon strings
const IconComponents: { [key: string]: React.ReactNode } = {
  'bilateral-peering': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  'public-peering': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  'private-interconnect': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  'shield': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  'server': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  ),
  'login': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  ),
  'globe': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  'branch': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  ),
  'cpu': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  ),
  'star': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  'cloud': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  ),
  'ddos-shield': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),
};

const DefaultIcon = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

const getIcon = (iconString: string) => {
  if (!iconString) return DefaultIcon;
  if (IconComponents[iconString]) return IconComponents[iconString];
  return DefaultIcon;
};

const goToContact = () => {
  window.history.pushState({}, '', '/contact');
  window.dispatchEvent(new PopStateEvent('popstate'));
};

const ServicesPage = () => {
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    document.body.classList.add('dark-nav');
    return () => document.body.classList.remove('dark-nav');
  }, []);

  useEffect(() => {
    const fetchServices = async () => {
      setLoading(true);
      const result = await servicesApi.getAll();
      if (result.success && result.data) {
        const sorted = result.data.sort((a, b) => (a.order || 0) - (b.order || 0));
        setServices(sorted);
      } else {
        setError(result.error || 'Failed to load services');
      }
      setLoading(false);
    };
    fetchServices();
  }, []);

  const toggleService = (serviceId: string) =>
    setExpandedService(expandedService === serviceId ? null : serviceId);

  const totalItems = useMemo(() => services.reduce((acc, s) => acc + s.items.length, 0), [services]);

  return (
    <div className="min-h-screen bg-white text-ink">
      {/* Hero */}
      <section className="relative bg-ink text-white overflow-hidden pt-36 md:pt-44 pb-20">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#F20732]/15 blur-[120px]" />
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 relative z-10">
          <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Service Portfolio</span>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.95] mt-4 mb-6">
            OUR <span className="text-[#F20732]">SERVICES</span>
          </h1>
          <p className="text-gray-400 text-base md:text-lg leading-relaxed max-w-2xl border-l-2 border-white/10 pl-6">
            From public and private peering to cloud on-ramps and DDoS protection — everything your
            network needs to interconnect, exchange traffic efficiently and scale across the MX-IX fabric.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 border border-white/10 mt-12">
            {[
              { v: services.length || '—', l: 'Service Categories' },
              { v: totalItems || '—', l: 'Solutions' },
              { v: '200+', l: 'Global PoPs' },
              { v: '24/7', l: 'Expert Support' },
            ].map((s) => (
              <div key={s.l} className="bg-ink p-5">
                <div className="text-3xl md:text-4xl font-light tracking-tighter tabular-nums">{s.v}</div>
                <div className="font-mono text-label-sm tracking-label uppercase text-gray-400 mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick category nav */}
      {!loading && !error && services.length > 0 && (
        <section className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-gray-200">
          <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <span className="font-mono text-label-sm tracking-label uppercase text-gray-400 mr-2 flex-shrink-0">Jump to</span>
            {services.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex-shrink-0 px-4 py-2 font-mono text-label-sm tracking-mono uppercase border border-gray-300 text-gray-500 hover:border-ink hover:text-ink transition-colors hover-trigger"
              >
                {String(i + 1).padStart(2, '0')} · {s.category}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin w-8 h-8 border-2 border-[#F20732] border-t-transparent rounded-full" />
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="max-w-[1400px] mx-auto px-6 py-24 text-center">
          <p className="text-[#F20732] font-mono text-sm mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-ink text-white font-mono text-label-sm uppercase tracking-mono hover:bg-[#F20732] transition-colors hover-trigger"
          >
            Retry
          </button>
        </div>
      )}

      {/* Services Sections */}
      {!loading && !error && services.map((service, idx) => (
        <section
          key={service.id}
          id={service.id}
          className={`scroll-mt-16 border-b border-gray-200 ${idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}
        >
          <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-16 md:py-20">
            {/* Category header */}
            <div className="grid lg:grid-cols-3 gap-8 mb-12">
              <div className="lg:col-span-2">
                <div className="flex items-center gap-4 mb-4">
                  <span className="font-mono text-sm font-bold text-[#F20732]">{String(idx + 1).padStart(2, '0')}</span>
                  <span className="font-mono text-label-sm tracking-mono uppercase text-gray-400">{service.tagline}</span>
                </div>
                <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-ink">{service.category}</h2>
              </div>
              <div className="flex items-end">
                <p className="text-gray-600 leading-relaxed">{service.description}</p>
              </div>
            </div>

            {/* Service items — accordion */}
            <div className="border border-gray-200 divide-y divide-gray-200">
              {service.items.map((item, itemIdx) => {
                const itemId = `${service.id}-${itemIdx}`;
                const isExpanded = expandedService === itemId;
                return (
                  <div key={itemIdx} className={`bg-white transition-colors ${isExpanded ? '' : 'hover:bg-gray-50'}`}>
                    <button
                      onClick={() => toggleService(itemId)}
                      className="w-full px-6 md:px-8 py-6 flex items-center justify-between text-left group hover-trigger"
                    >
                      <div className="flex items-center gap-5 min-w-0">
                        <div className={`w-12 h-12 flex-shrink-0 flex items-center justify-center border transition-colors ${
                          isExpanded ? 'bg-[#F20732] text-white border-[#F20732]' : 'bg-white text-[#F20732] border-gray-200 group-hover:border-[#F20732]'
                        }`}>
                          {getIcon(item.icon)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-lg md:text-xl font-bold tracking-tight text-ink">{item.name}</h3>
                          <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{item.description}</p>
                        </div>
                      </div>
                      <div className={`w-9 h-9 flex-shrink-0 flex items-center justify-center border transition-colors ${
                        isExpanded ? 'bg-ink text-white border-ink' : 'border-gray-300 text-gray-500 group-hover:border-ink group-hover:text-ink'
                      }`}>
                        {isExpanded ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </div>
                    </button>

                    {/* Expanded */}
                    <div className={`overflow-hidden transition-all duration-500 ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                      <div className="px-6 md:px-8 pb-8 pt-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                          {/* Benefits */}
                          {item.benefits?.length > 0 && (
                            <div>
                              <h4 className="font-mono text-label-sm tracking-label uppercase text-gray-400 mb-4 flex items-center gap-2">
                                <span className="w-1 h-4 bg-[#F20732]" /> Key Benefits
                              </h4>
                              <ul className="space-y-3">
                                {item.benefits.map((benefit, bIdx) => (
                                  <li key={bIdx} className="flex items-start gap-3">
                                    <Check className="w-4 h-4 text-[#F20732] flex-shrink-0 mt-1" />
                                    <span className="text-sm text-gray-600 leading-relaxed">{benefit}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {/* Features */}
                          {item.features?.length > 0 && (
                            <div>
                              <h4 className="font-mono text-label-sm tracking-label uppercase text-gray-400 mb-4 flex items-center gap-2">
                                <span className="w-1 h-4 bg-ink" /> Technical Features
                              </h4>
                              <ul className="space-y-3">
                                {item.features.map((feature, fIdx) => (
                                  <li key={fIdx} className="flex items-start gap-3">
                                    <Check className="w-4 h-4 text-ink flex-shrink-0 mt-1" />
                                    <span className="text-sm text-gray-600 leading-relaxed">{feature}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Stats */}
                        {item.stats && item.stats.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-gray-200 border border-gray-200 mt-8">
                            {item.stats.map((stat, sIdx) => (
                              <div key={sIdx} className="bg-white p-5 text-center">
                                <div className="text-3xl font-light tracking-tighter text-ink">{stat.value}</div>
                                <div className="font-mono text-label-sm tracking-label uppercase text-gray-400 mt-1">{stat.label}</div>
                                {stat.period && <div className="font-mono text-[10px] text-gray-300 mt-0.5">{stat.period}</div>}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* CTA */}
                        <div className="mt-8 flex justify-end">
                          <button
                            onClick={goToContact}
                            className="bg-ink text-white px-6 py-3 font-mono text-label-sm font-bold uppercase tracking-mono hover:bg-[#F20732] transition-colors flex items-center gap-2 group hover-trigger"
                          >
                            Get started <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ))}

      {/* Why MX-IX */}
      {!loading && !error && (
        <section className="border-b border-gray-200 bg-white">
          <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-16">
            <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Why MX-IX</span>
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter mt-2 mb-10">Built for performance and simplicity</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200 border border-gray-200">
              {[
                { icon: Network, t: 'One port, full reach', d: 'A single connection peers you with every network on the exchange — no per-bit fees.' },
                { icon: Zap, t: 'Low latency', d: 'Local interconnection keeps traffic in-region, typically sub-2ms across the fabric.' },
                { icon: ShieldCheck, t: 'Secure by default', d: 'RPKI/IRR-filtered route servers and optional DDoS protection on every service.' },
                { icon: Headphones, t: '24/7 NOC', d: 'A dedicated operations team monitors the fabric and supports you around the clock.' },
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
      )}

      {/* Who connects */}
      {!loading && !error && (
        <section className="border-b border-gray-200 bg-white">
          <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-16">
            <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Who Connects</span>
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter mt-2 mb-3">Built for every kind of network</h2>
            <p className="text-gray-500 max-w-2xl mb-10">Whatever you run, peering at MX-IX shortens the path between your network and the destinations that matter to you.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200 border border-gray-200">
              {USE_CASES.map((u) => (
                <div key={u.t} className="group relative bg-white p-6 overflow-hidden hover:bg-gray-50 transition-colors">
                  <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732] -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
                  <u.icon className="w-6 h-6 text-[#F20732] mb-4" />
                  <h3 className="font-bold text-ink mb-1.5">{u.t}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed mb-4">{u.d}</p>
                  <div className="flex flex-wrap gap-2">
                    {u.tags.map((t) => (
                      <span key={t} className="font-mono text-label-sm tracking-label uppercase text-gray-500 border border-gray-200 px-2 py-1">{t}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {!loading && !error && (
        <section className="border-b border-gray-200 bg-gray-50">
          <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-16">
            <div className="grid lg:grid-cols-3 gap-10">
              <div>
                <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// FAQ</span>
                <h2 className="text-3xl md:text-4xl font-black tracking-tighter mt-2 mb-4">Common questions</h2>
                <p className="text-gray-500 leading-relaxed mb-6">Everything you need to know before you peer. Still unsure? Our team is happy to walk you through it.</p>
                <button onClick={goToContact} className="inline-flex items-center gap-2 font-mono text-label-sm font-bold tracking-mono uppercase text-ink hover:text-[#F20732] transition-colors hover-trigger">
                  Ask a question <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <div className="lg:col-span-2 border border-gray-200 divide-y divide-gray-200 bg-white">
                {FAQS.map((f, i) => {
                  const open = openFaq === i;
                  return (
                    <div key={i}>
                      <button
                        onClick={() => setOpenFaq(open ? null : i)}
                        className="w-full px-6 py-5 flex items-center justify-between text-left group hover:bg-gray-50 transition-colors hover-trigger"
                      >
                        <span className="font-bold text-ink pr-6">{f.q}</span>
                        <span className={`w-8 h-8 flex-shrink-0 flex items-center justify-center border transition-colors ${open ? 'bg-ink text-white border-ink' : 'border-gray-300 text-gray-500 group-hover:border-ink group-hover:text-ink'}`}>
                          {open ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </span>
                      </button>
                      <div className={`overflow-hidden transition-all duration-500 ${open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                        <p className="px-6 pb-5 text-sm text-gray-600 leading-relaxed">{f.a}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* How to get started */}
      {!loading && !error && (
        <section className="bg-gray-50 border-b border-gray-200">
          <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-16">
            <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Get Started</span>
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter mt-2 mb-10">From request to live in three steps</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-gray-200 border border-gray-200">
              {[
                { n: '01', t: 'Choose a service', d: 'Pick the peering, interconnect or protection service that fits your network.' },
                { n: '02', t: 'Order & provision', d: 'Our team confirms availability, cross-connect and pricing, then provisions your port.' },
                { n: '03', t: 'Peer & go live', d: 'Turn up BGP to the route servers and start exchanging traffic across the fabric.' },
              ].map((s) => (
                <div key={s.n} className="bg-white p-8">
                  <div className="text-5xl font-black tracking-tighter text-gray-200">{s.n}</div>
                  <h3 className="font-bold text-ink mt-4 mb-1.5">{s.t}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="bg-ink text-white">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-14 flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#F20732]/15 blur-[110px]" />
          <div className="relative">
            <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Connect</span>
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter mt-2">Ready to join the fabric?</h2>
            <p className="text-gray-400 mt-2 max-w-xl">Talk to our team and find the right service for your network.</p>
          </div>
          <button
            onClick={goToContact}
            className="relative self-start md:self-auto bg-[#F20732] text-white px-7 py-3.5 font-mono text-label-sm font-bold tracking-mono uppercase hover:bg-white hover:text-ink transition-colors flex items-center gap-3 group hover-trigger whitespace-nowrap"
          >
            Get in touch <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>
    </div>
  );
};

export default ServicesPage;
