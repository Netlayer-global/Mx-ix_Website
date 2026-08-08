import React from 'react';
import { CheckCircle2, ShieldCheck, Network, Gauge, Route, ArrowRight, ExternalLink } from 'lucide-react';
import Reveal from '../components/Reveal';
import SectionEyebrow from '../components/SectionEyebrow';

interface Props {
  onNavigate?: (page: string) => void;
}

const BENEFITS = [
  {
    Icon: Route,
    title: 'No direct-peering prerequisites',
    desc: 'Google customers who connect through a Verified Peering Provider are not required to meet Google’s own Direct Peering criteria themselves.',
  },
  {
    Icon: Network,
    title: 'Diverse paths to Google',
    desc: 'The programme is built around redundant, physically diverse connectivity — exactly what a multi-site exchange fabric is designed to deliver.',
  },
  {
    Icon: Gauge,
    title: 'Predictable latency',
    desc: 'Shorter, local paths to Google properties reduce round-trip time and smooth out the variance users notice during upstream events.',
  },
  {
    Icon: ShieldCheck,
    title: 'Enterprise-grade posture',
    desc: 'Providers in the programme commit to enterprise service levels and operational discipline, not best-effort transit.',
  },
];

const REQUIREMENTS = [
  'A public ASN with current Maintainer, AS-SET and Route/Route6 objects in a supported IRR.',
  'An accurate, actively maintained PeeringDB record, including the AS-SET reference.',
  'Redundant, physically diverse connectivity toward Google — not a single path.',
  'Sufficient capacity headroom so peak demand never depends on a single link.',
  'Enterprise-grade service levels and 24/7 operational support for customers.',
  'RPKI-valid announcements and clean, consistently filtered prefix hygiene.',
];

const STEPS = [
  {
    k: '01',
    t: 'Establish peering at MX-IX',
    d: 'Provision a port, bring up your BGP sessions to our route servers and validate your prefix filtering and RPKI posture.',
  },
  {
    k: '02',
    t: 'Build diversity across sites',
    d: 'Add a second port at another MX-IX location so your reachability no longer depends on a single facility or path.',
  },
  {
    k: '03',
    t: 'Tidy your public records',
    d: 'Align PeeringDB, your IRR objects and your AS-SET so automated validation on Google’s side resolves cleanly.',
  },
  {
    k: '04',
    t: 'Apply to Google',
    d: 'Submit your application to Google. Verified Peering Provider status is assessed and granted by Google directly.',
  },
];

const GoogleVppPage: React.FC<Props> = ({ onNavigate }) => {
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
          <SectionEyebrow tone="dark" className="mb-7">
            Resources
          </SectionEyebrow>
          <h1 className="mb-6 text-5xl font-black leading-[0.92] tracking-[-0.05em] md:text-7xl">
            GOOGLE <span className="text-[#F20732]">VPP</span> PROGRAM
          </h1>
          <p className="max-w-2xl border-l border-white/15 pl-6 text-base leading-8 text-gray-300 md:text-lg">
            Google’s Verified Peering Provider programme identifies networks that deliver enterprise-grade
            internet services with diverse, reliable connectivity to Google. Peering at MX-IX is a practical
            step toward meeting the connectivity expectations the programme is built on.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => onNavigate?.('contact')}
              className="hover-trigger group inline-flex min-h-12 cursor-pointer items-center justify-center gap-3 rounded-full bg-brand-red px-7 font-mono text-label-sm font-bold uppercase tracking-mono text-white transition-colors duration-200 hover:bg-white hover:text-ink"
            >
              Talk to our team
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </button>
            <a
              href="https://cloud.google.com/network-connectivity/docs/verified-peering-provider"
              target="_blank"
              rel="noopener noreferrer"
              className="hover-trigger group inline-flex min-h-12 cursor-pointer items-center justify-center gap-3 rounded-full border border-white/20 px-7 font-mono text-label-sm font-bold uppercase tracking-mono text-white transition-colors duration-200 hover:border-white"
            >
              Google documentation
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </section>

      {/* What it is */}
      <section className="border-b border-gray-200">
        <div className="mx-auto max-w-[1400px] px-6 py-16 md:px-12 md:py-20">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <SectionEyebrow className="mb-6">What it is</SectionEyebrow>
              <h2 className="text-3xl font-black tracking-[-0.045em] md:text-4xl">
                An alternative route to Google
              </h2>
            </div>
            <div className="lg:col-span-7">
              <p className="text-base leading-8 text-gray-600">
                Historically, a network wanting a direct relationship with Google had to satisfy Google’s
                Direct Peering requirements on its own. The Verified Peering Provider programme changes that
                path: Google identifies service providers that already demonstrate diverse, resilient
                connectivity to its network, and customers can obtain internet services through one of those
                providers instead.
              </p>
              <p className="mt-6 text-base leading-8 text-gray-600">
                For an ISP or enterprise network, this reframes the problem. Rather than chasing a bilateral
                arrangement, the question becomes whether your connectivity is diverse, well-documented and
                operationally sound enough to stand behind an enterprise service — which is precisely what a
                multi-site peering fabric helps you build.
              </p>
              <p className="mt-6 rounded-none border-l-2 border-brand-red bg-gray-50 p-5 text-sm leading-7 text-gray-600">
                Verified Peering Provider status is assessed, approved and published by Google. MX-IX provides
                the interconnection layer and operational support that underpins an application — we do not
                grant or guarantee programme status.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="border-b border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-[1400px] px-6 py-16 md:px-12 md:py-20">
          <SectionEyebrow className="mb-6">Why it matters</SectionEyebrow>
          <h2 className="mb-12 text-3xl font-black tracking-[-0.045em] md:text-4xl">
            What the programme unlocks
          </h2>

          <div className="grid grid-cols-1 gap-px border border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((b, i) => (
              <Reveal key={b.title} delay={i * 80}>
                <div className="group relative h-full overflow-hidden bg-white p-8">
                  <div className="absolute left-0 top-0 h-1 w-full -translate-x-full bg-brand-red transition-transform duration-500 group-hover:translate-x-0" aria-hidden="true" />
                  <b.Icon className="h-8 w-8 text-ink transition-colors duration-200 group-hover:text-brand-red" strokeWidth={1.5} />
                  <h3 className="mt-8 text-lg font-bold tracking-[-0.02em]">{b.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-gray-600">{b.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Requirements */}
      <section className="border-b border-gray-200">
        <div className="mx-auto max-w-[1400px] px-6 py-16 md:px-12 md:py-20">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <SectionEyebrow className="mb-6">Readiness</SectionEyebrow>
              <h2 className="text-3xl font-black tracking-[-0.045em] md:text-4xl">
                What Google looks for
              </h2>
              <p className="mt-5 max-w-md text-base leading-8 text-gray-600">
                The specifics are set by Google and evolve over time. In practice, applicants are expected to
                demonstrate the following before review.
              </p>
            </div>

            <div className="lg:col-span-7">
              <ul className="divide-y divide-gray-200 border-y border-gray-200">
                {REQUIREMENTS.map((r) => (
                  <li key={r} className="flex items-start gap-4 py-5">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-red" strokeWidth={2} />
                    <span className="text-sm leading-7 text-gray-600">{r}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 font-mono text-[10px] uppercase tracking-label text-gray-400">
                Always confirm current criteria against Google’s official documentation before applying.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="border-b border-gray-200 bg-ink text-white">
        <div className="mx-auto max-w-[1400px] px-6 py-20 md:px-12 md:py-28">
          <SectionEyebrow tone="dark" className="mb-7">
            How MX-IX helps
          </SectionEyebrow>
          <h2 className="mb-4 max-w-3xl text-3xl font-black tracking-[-0.045em] md:text-5xl">
            From first port to application-ready
          </h2>
          <p className="mb-14 max-w-2xl text-base leading-8 text-gray-300">
            Peering with us gives you the diverse, well-documented interconnection footprint the programme
            expects — and a NOC that will help you get the details right.
          </p>

          <div className="grid grid-cols-1 gap-px border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
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

      {/* CTA */}
      <section className="border-b border-gray-200">
        <div className="mx-auto max-w-[1400px] px-6 py-16 md:px-12 md:py-20">
          <div className="flex flex-col items-start justify-between gap-8 border border-gray-200 p-8 md:flex-row md:items-center md:p-12">
            <div>
              <SectionEyebrow className="mb-5">Next step</SectionEyebrow>
              <h2 className="text-2xl font-black tracking-[-0.04em] md:text-3xl">
                Build the connectivity story first
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-gray-600">
                Tell us where your network needs to be and we will map out the ports, diversity and routing
                hygiene that make a strong application.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => onNavigate?.('contact')}
                className="hover-trigger group inline-flex min-h-12 cursor-pointer items-center justify-center gap-3 rounded-full bg-ink px-7 font-mono text-label-sm font-bold uppercase tracking-mono text-white transition-colors duration-200 hover:bg-brand-red"
              >
                Request a Port
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </button>
              <button
                onClick={() => onNavigate?.('technical')}
                className="hover-trigger inline-flex min-h-12 cursor-pointer items-center justify-center gap-3 rounded-full border border-ink/20 px-7 font-mono text-label-sm font-bold uppercase tracking-mono text-ink transition-colors duration-200 hover:border-ink hover:bg-gray-50"
              >
                Technical requirements
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default GoogleVppPage;
