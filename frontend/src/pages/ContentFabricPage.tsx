import React from 'react';
import {
  Layers,
  ShieldCheck,
  Gauge,
  Route,
  Server,
  Globe2,
  ArrowRight,
  Cable,
  Star,
  HardDrive,
} from 'lucide-react';
import Reveal from '../components/Reveal';
import SectionEyebrow from '../components/SectionEyebrow';

interface Props {
  onNavigate?: (page: string) => void;
}

const VALUE = [
  {
    Icon: Layers,
    title: 'One session, aggregated reach',
    desc: 'A single BGP session to the Content Fabric delivers a consolidated route set instead of a separate membership, port and session for every fabric you want reach into.',
  },
  {
    Icon: Gauge,
    title: 'Shorter paths to heavy destinations',
    desc: 'Traffic to the content and cloud destinations that dominate your bill takes a local path rather than transiting distant upstreams.',
  },
  {
    Icon: Route,
    title: 'Transit cost displacement',
    desc: 'Every prefix served over the fabric is a prefix you are no longer paying metered transit rates to reach.',
  },
  {
    Icon: ShieldCheck,
    title: 'Filtered and validated',
    desc: 'Routes are RPKI-validated and IRR-filtered before they reach you, with consistent prefix hygiene applied across the whole aggregate.',
  },
  {
    Icon: Server,
    title: 'No new hardware footprint',
    desc: 'Delivered over your existing MX-IX port. No additional cross-connects, colocation or remote-peering contracts to manage.',
  },
  {
    Icon: Globe2,
    title: 'Multi-site delivery',
    desc: 'Available at every MX-IX location, so you can take the fabric in more than one metro and keep your reachability diverse.',
  },
];

/**
 * Content platforms commonly served from cache or local interconnection at
 * exchange points. Availability is market-dependent and always subject to each
 * platform's own programme terms — the page states this explicitly.
 */
const CACHED_PLATFORMS = [
  { name: 'Google', note: 'Search, YouTube, Workspace' },
  { name: 'Netflix', note: 'Open Connect' },
  { name: 'Akamai', note: 'CDN delivery' },
  { name: 'Microsoft', note: 'Azure, Microsoft 365' },
  { name: 'Meta', note: 'Facebook, Instagram, WhatsApp' },
  { name: 'Amazon', note: 'AWS, Prime Video' },
  { name: 'Cloudflare', note: 'CDN delivery' },
  { name: 'Apple', note: 'Updates, services' },
];

const CACHE_VALUE = [
  {
    Icon: HardDrive,
    title: 'Served from the metro, not upstream',
    desc: 'Popular objects are answered by caching nodes inside the market, so repeat requests never traverse your paid transit at all.',
  },
  {
    Icon: Gauge,
    title: 'Better start times under load',
    desc: 'Video start time and page load improve most during evening peak — exactly when upstream congestion is worst for subscribers.',
  },
  {
    Icon: Route,
    title: 'The heaviest traffic first',
    desc: 'Video and software distribution dominate most eyeball networks. Displacing that share moves your cost curve more than anything else.',
  },
];

const HOW = [
  {
    k: '01',
    t: 'Aggregate',
    d: 'We consolidate reachability from our own peering relationships together with capacity we hold into additional interconnection fabrics.',
  },
  {
    k: '02',
    t: 'Normalise',
    d: 'The combined route set is deduplicated, RPKI-validated, IRR-filtered and tagged with consistent BGP communities.',
  },
  {
    k: '03',
    t: 'Deliver',
    d: 'You receive it as one managed BGP session on your existing MX-IX port — no per-fabric onboarding on your side.',
  },
  {
    k: '04',
    t: 'Operate',
    d: 'Our NOC monitors capacity and path health continuously, and you see utilisation and route counts in the member portal.',
  },
];

const SPECS = [
  { l: 'Delivery', v: 'Managed BGP session on your MX-IX port' },
  { l: 'Content sources', v: 'Aggregated routes plus locally cached content' },
  { l: 'Address families', v: 'IPv4 and IPv6, dual-stack' },
  { l: 'Route validation', v: 'RPKI ROV enforced, IRR filtered' },
  { l: 'Route tagging', v: 'BGP communities for source classification' },
  { l: 'Port speeds', v: '1G to 400G' },
  { l: 'Commercial model', v: 'Flat monthly rate, no per-bit charges' },
  { l: 'Redundancy', v: 'Optional second session at another location' },
  { l: 'Cache availability', v: 'Per location, confirmed before order' },
  { l: 'Support', v: '24/7 NOC with escalation path' },
];

const WHO = [
  {
    title: 'Regional ISPs',
    desc: 'Cut the share of eyeball traffic riding paid transit and improve the experience your subscribers actually notice.',
  },
  {
    title: 'Enterprises',
    desc: 'Get shorter, more predictable paths to the SaaS and cloud destinations your workforce depends on all day.',
  },
  {
    title: 'Hosting & cloud providers',
    desc: 'Serve customer workloads over local interconnection instead of backhauling everything to an upstream.',
  },
  {
    title: 'Networks scaling into new metros',
    desc: 'Establish meaningful reach in a new market immediately, without negotiating a fabric-by-fabric footprint first.',
  },
];

const FAQ = [
  {
    q: 'Is this a replacement for IP transit?',
    a: 'No. The Content Fabric carries a large, well-defined portion of your traffic over interconnection. You should keep transit for full default-route reachability and as a fallback path.',
  },
  {
    q: 'How is it different from a standard peering port?',
    a: 'A standard port connects you to networks present on the MX-IX fabric itself. The Content Fabric adds aggregated reachability we hold into further interconnection fabrics plus locally cached content, delivered as one session.',
  },
  {
    q: 'Which content platforms are served from cache?',
    a: 'The mix depends on what is deployed and serviceable at each location, and on each platform\u2019s own programme terms. We confirm the exact list for your chosen sites in writing before you order rather than publishing blanket claims.',
  },
  {
    q: 'Does cached traffic count against a data allowance?',
    a: 'No. The commercial model is a flat monthly port and session rate. There are no per-bit charges, whether a request is answered from cache or over aggregated routes.',
  },
  {
    q: 'Do I need my own ASN?',
    a: 'Yes. You need a public ASN and the ability to run BGP, exactly as you would for ordinary peering.',
  },
  {
    q: 'What happens if a route disappears upstream?',
    a: 'Withdrawals propagate normally and your transit or alternate paths take over. Because the aggregate spans multiple sources, the loss of any single source does not remove the whole route set.',
  },
  {
    q: 'Can I see what I am receiving?',
    a: 'Yes. Received, filtered and not-exported prefixes are all inspectable in the member portal, and you can export them for your own analysis.',
  },
  {
    q: 'Is there a prefix limit?',
    a: 'A generous maximum-prefix limit is applied and agreed with you at turn-up, so a routing anomaly upstream cannot destabilise your edge.',
  },
];

const ContentFabricPage: React.FC<Props> = ({ onNavigate }) => {
  const [open, setOpen] = React.useState<number | null>(0);

  React.useEffect(() => {
    document.body.classList.add('dark-nav');
    return () => document.body.classList.remove('dark-nav');
  }, []);

  return (
    <div className="min-h-screen bg-white text-ink">
      {/* Hero */}
      <section className="relative bg-ink text-white pt-36 md:pt-44 pb-16">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#F20732]/15 blur-[120px]" />
        </div>
        <div className="relative z-10 mx-auto max-w-[1400px] px-6 md:px-12">
          <div className="mb-7 flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-red px-4 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-white">
              <Star className="h-3 w-3" strokeWidth={2.5} />
              Flagship Product
            </span>
            <SectionEyebrow tone="dark">MX-IX Product</SectionEyebrow>
          </div>
          <h1 className="mb-6 text-5xl font-black leading-[0.92] tracking-[-0.05em] md:text-7xl">
            CONTENT <span className="text-[#F20732]">FABRIC</span>
          </h1>
          <p className="max-w-2xl border-l border-white/15 pl-6 text-base leading-8 text-gray-300 md:text-lg">
            Our flagship interconnection service. One managed BGP session consolidates our peering reach, the
            interconnection capacity we hold and locally cached content into a single validated route set — so
            you serve the destinations that drive your traffic without assembling that footprint yourself.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => onNavigate?.('contact')}
              className="hover-trigger group inline-flex min-h-12 cursor-pointer items-center justify-center gap-3 rounded-full bg-brand-red px-7 font-mono text-label-sm font-bold uppercase tracking-mono text-white transition-colors duration-200 hover:bg-white hover:text-ink"
            >
              Request Content Fabric
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </button>
            <button
              onClick={() => onNavigate?.('pricing')}
              className="hover-trigger inline-flex min-h-12 cursor-pointer items-center justify-center gap-3 rounded-full border border-white/20 px-7 font-mono text-label-sm font-bold uppercase tracking-mono text-white transition-colors duration-200 hover:border-white"
            >
              See pricing
            </button>
          </div>
        </div>
      </section>

      {/* Problem / positioning */}
      <section className="border-b border-gray-200">
        <div className="mx-auto max-w-[1400px] px-6 py-16 md:px-12 md:py-20">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <SectionEyebrow className="mb-6">The problem</SectionEyebrow>
              <h2 className="text-3xl font-black tracking-[-0.045em] md:text-4xl">
                Reach normally costs you overhead
              </h2>
            </div>
            <div className="lg:col-span-7">
              <p className="text-base leading-8 text-gray-600">
                Building broad interconnection reach the traditional way means joining several fabrics
                separately. Each one brings its own membership, port, cross-connect, invoice, routing policy
                and turn-up project. The engineering effort scales linearly with the number of fabrics, long
                before the traffic benefit does.
              </p>
              <p className="mt-6 text-base leading-8 text-gray-600">
                The Content Fabric collapses that overhead. We carry the memberships, the capacity and the
                routing complexity. You take one session on a port you already have, and inherit the
                aggregate reach behind it.
              </p>

              <div className="mt-8 grid grid-cols-1 gap-px border border-gray-200 bg-gray-200 sm:grid-cols-3">
                {[
                  { l: 'Sessions to manage', v: 'One' },
                  { l: 'Extra cross-connects', v: 'None' },
                  { l: 'Per-bit charges', v: 'None' },
                ].map((s) => (
                  <div key={s.l} className="bg-white p-6">
                    <span className="font-mono text-[10px] uppercase tracking-label text-gray-500">{s.l}</span>
                    <div className="mt-2 text-2xl font-light tracking-[-0.04em] text-ink">{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value grid */}
      <section className="border-b border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-[1400px] px-6 py-16 md:px-12 md:py-20">
          <SectionEyebrow className="mb-6">What you get</SectionEyebrow>
          <h2 className="mb-12 max-w-3xl text-3xl font-black tracking-[-0.045em] md:text-4xl">
            Aggregated reach, delivered as one clean service
          </h2>

          <div className="grid grid-cols-1 gap-px border border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-3">
            {VALUE.map((v, i) => (
              <Reveal key={v.title} delay={i * 70}>
                <div className="group relative h-full overflow-hidden bg-white p-8">
                  <div className="absolute left-0 top-0 h-1 w-full -translate-x-full bg-brand-red transition-transform duration-500 group-hover:translate-x-0" aria-hidden="true" />
                  <v.Icon className="h-8 w-8 text-ink transition-colors duration-200 group-hover:text-brand-red" strokeWidth={1.5} />
                  <h3 className="mt-8 text-lg font-bold tracking-[-0.02em]">{v.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-gray-600">{v.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Cached content */}
      <section className="border-b border-gray-200">
        <div className="mx-auto max-w-[1400px] px-6 py-16 md:px-12 md:py-20">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <SectionEyebrow className="mb-6">Cached content</SectionEyebrow>
              <h2 className="text-3xl font-black tracking-[-0.045em] md:text-4xl">
                The bytes that matter, cached locally
              </h2>
              <p className="mt-5 text-base leading-8 text-gray-600">
                Route reach solves where traffic can go. Caching solves how far it has to travel. Content
                Fabric combines both: alongside aggregated routes, we bring locally deployed caching and
                on-net content delivery into the same session.
              </p>
              <p className="mt-6 text-base leading-8 text-gray-600">
                The result is that a large share of your busiest traffic — streaming video, software updates,
                social media and cloud productivity — is answered inside the metro instead of being hauled
                across an upstream provider.
              </p>
            </div>

            <div className="lg:col-span-7">
              <div className="grid grid-cols-2 gap-px border border-gray-200 bg-gray-200 sm:grid-cols-4">
                {CACHED_PLATFORMS.map((p) => (
                  <div key={p.name} className="group bg-white p-5 transition-colors duration-200 hover:bg-gray-50">
                    <div className="text-base font-black tracking-[-0.03em] text-ink transition-colors duration-200 group-hover:text-brand-red">
                      {p.name}
                    </div>
                    <div className="mt-1.5 font-mono text-[9px] uppercase leading-relaxed tracking-label text-gray-500">
                      {p.note}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-1 gap-px border border-gray-200 bg-gray-200 sm:grid-cols-3">
                {CACHE_VALUE.map((c) => (
                  <div key={c.title} className="bg-white p-6">
                    <c.Icon className="h-7 w-7 text-ink" strokeWidth={1.5} />
                    <h3 className="mt-6 text-base font-bold tracking-[-0.02em]">{c.title}</h3>
                    <p className="mt-2.5 text-sm leading-7 text-gray-600">{c.desc}</p>
                  </div>
                ))}
              </div>

              <p className="mt-6 border-l-2 border-brand-red bg-gray-50 p-5 text-sm leading-7 text-gray-600">
                Cache and on-net availability varies by location and is subject to each content platform's own
                programme terms, eligibility and approval. We will confirm exactly what is serviceable at your
                chosen sites before you order — no assumptions, no overstated coverage.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-gray-200 bg-ink text-white">
        <div className="mx-auto max-w-[1400px] px-6 py-20 md:px-12 md:py-28">
          <SectionEyebrow tone="dark" className="mb-7">
            How it works
          </SectionEyebrow>
          <h2 className="mb-4 max-w-3xl text-3xl font-black tracking-[-0.045em] md:text-5xl">
            We hold the complexity. You take the session.
          </h2>
          <p className="mb-14 max-w-2xl text-base leading-8 text-gray-300">
            Four stages sit between our upstream interconnection footprint and the single session that lands
            on your router.
          </p>

          <div className="grid grid-cols-1 gap-px border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
            {HOW.map((s, i) => (
              <Reveal key={s.k} delay={i * 80}>
                <div className="group relative h-full overflow-hidden bg-ink p-8 transition-colors duration-300 hover:bg-white/[0.035] md:p-10">
                  <div className="absolute left-0 top-0 h-px w-full -translate-x-full bg-brand-red transition-transform duration-500 group-hover:translate-x-0" aria-hidden="true" />
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-label-sm font-bold tracking-mono text-white/35">{s.k}</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-white/15 transition-colors duration-300 group-hover:bg-brand-red" aria-hidden="true" />
                  </div>
                  <h3 className="mt-8 text-xl font-bold tracking-[-0.02em]">{s.t}</h3>
                  <p className="mt-3 text-sm leading-7 text-gray-400">{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Specs */}
      <section className="border-b border-gray-200">
        <div className="mx-auto max-w-[1400px] px-6 py-16 md:px-12 md:py-20">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <SectionEyebrow className="mb-6">Service profile</SectionEyebrow>
              <h2 className="text-3xl font-black tracking-[-0.045em] md:text-4xl">Specifications</h2>
              <p className="mt-5 text-base leading-8 text-gray-600">
                Standard delivery parameters. Anything site-specific is confirmed during turn-up.
              </p>
              <button
                onClick={() => onNavigate?.('technical')}
                className="hover-trigger group mt-7 inline-flex cursor-pointer items-center gap-2 font-mono text-label-sm font-bold uppercase tracking-mono text-ink transition-colors duration-200 hover:text-brand-red"
              >
                <Cable className="h-4 w-4" />
                Technical requirements
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
              </button>
            </div>

            <div className="lg:col-span-8">
              <dl className="grid grid-cols-1 gap-px border border-gray-200 bg-gray-200 sm:grid-cols-2">
                {SPECS.map((s) => (
                  <div key={s.l} className="bg-white p-6">
                    <dt className="font-mono text-[10px] uppercase tracking-label text-gray-500">{s.l}</dt>
                    <dd className="mt-2 text-sm font-bold leading-7 text-ink">{s.v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="border-b border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-[1400px] px-6 py-16 md:px-12 md:py-20">
          <SectionEyebrow className="mb-6">Who it suits</SectionEyebrow>
          <h2 className="mb-12 text-3xl font-black tracking-[-0.045em] md:text-4xl">Built for networks that buy reach</h2>

          <div className="grid grid-cols-1 gap-px border border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-4">
            {WHO.map((w, i) => (
              <Reveal key={w.title} delay={i * 80}>
                <div className="group relative h-full overflow-hidden bg-white p-8">
                  <div className="absolute left-0 top-0 h-1 w-full -translate-x-full bg-brand-red transition-transform duration-500 group-hover:translate-x-0" aria-hidden="true" />
                  <h3 className="text-lg font-bold tracking-[-0.02em]">{w.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-gray-600">{w.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-gray-200">
        <div className="mx-auto max-w-[1400px] px-6 py-16 md:px-12 md:py-20">
          <div className="grid gap-12 lg:grid-cols-3">
            <div>
              <SectionEyebrow className="mb-6">FAQ</SectionEyebrow>
              <h2 className="text-3xl font-black tracking-[-0.045em] md:text-4xl">Straight answers</h2>
              <p className="mt-5 text-base leading-8 text-gray-600">
                What engineers usually ask before turning up a Content Fabric session.
              </p>
            </div>

            <div className="lg:col-span-2">
              <div className="divide-y divide-gray-200 border-y border-gray-200">
                {FAQ.map((f, i) => (
                  <div key={f.q}>
                    <button
                      onClick={() => setOpen(open === i ? null : i)}
                      aria-expanded={open === i}
                      className="hover-trigger flex w-full cursor-pointer items-center justify-between gap-6 py-5 text-left transition-colors duration-200 hover:text-brand-red"
                    >
                      <span className="text-base font-bold tracking-[-0.02em]">{f.q}</span>
                      <span
                        className={`flex-shrink-0 font-mono text-lg transition-transform duration-300 ${open === i ? 'rotate-45' : ''}`}
                        aria-hidden="true"
                      >
                        +
                      </span>
                    </button>
                    {open === i && <p className="pb-6 pr-10 text-sm leading-7 text-gray-600">{f.a}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-b border-gray-200">
        <div className="mx-auto max-w-[1400px] px-6 py-16 md:px-12 md:py-20">
          <div className="flex flex-col items-start justify-between gap-8 border border-gray-200 p-8 md:flex-row md:items-center md:p-12">
            <div>
              <SectionEyebrow className="mb-5">Get started</SectionEyebrow>
              <h2 className="text-2xl font-black tracking-[-0.04em] md:text-3xl">
                Tell us what your traffic looks like
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-gray-600">
                Share your volumes and destinations and we will size the right session and location mix for
                your network.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => onNavigate?.('contact')}
                className="hover-trigger group inline-flex min-h-12 cursor-pointer items-center justify-center gap-3 rounded-full bg-ink px-7 font-mono text-label-sm font-bold uppercase tracking-mono text-white transition-colors duration-200 hover:bg-brand-red"
              >
                Request Content Fabric
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </button>
              <button
                onClick={() => onNavigate?.('locations')}
                className="hover-trigger inline-flex min-h-12 cursor-pointer items-center justify-center gap-3 rounded-full border border-ink/20 px-7 font-mono text-label-sm font-bold uppercase tracking-mono text-ink transition-colors duration-200 hover:border-ink hover:bg-gray-50"
              >
                Explore the Locations
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ContentFabricPage;
