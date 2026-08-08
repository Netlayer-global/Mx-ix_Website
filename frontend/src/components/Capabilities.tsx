import React from 'react';
import { Cpu, Gauge, Share2, ShieldCheck } from 'lucide-react';
import Reveal from './Reveal';
import SectionCorners from './SectionCorners';

const CAPABILITIES = [
  {
    Icon: Share2,
    title: 'Direct Peering',
    desc: 'Exchange traffic directly with ISPs, content and cloud networks instead of paying for distant IP transit.',
    tag: '01',
  },
  {
    Icon: Cpu,
    title: 'Multilateral Route Servers',
    desc: 'One BGP session to our redundant route servers peers you with every participant on the exchange.',
    tag: '02',
  },
  {
    Icon: Gauge,
    title: 'Lower Latency & Cost',
    desc: 'Keeping local traffic local shortens network paths, improves performance and cuts transit bills.',
    tag: '03',
  },
  {
    Icon: ShieldCheck,
    title: 'Resilient & Neutral',
    desc: 'Carrier-neutral, fully redundant fabric with 24/7 NOC monitoring, blackholing and a 99.99% SLA.',
    tag: '04',
  },
];

const Capabilities: React.FC = () => (
  <section className="relative bg-white py-20 md:py-28 border-b border-gray-200 overflow-hidden z-10">
    <div className="relative max-w-[1400px] mx-auto px-6 md:px-12">
      {/* Header */}
      <Reveal className="mb-16 max-w-3xl">
        <span className="eyebrow mb-7 text-ink">Why MX-IX</span>
        <h2 className="text-[clamp(2rem,4.6vw,4rem)] font-black uppercase leading-[0.9] tracking-[-0.05em] text-ink">
          Built for
          <span className="flex items-end gap-[0.12em]">
            Peering
            <span className="mb-[0.16em] h-[0.11em] w-[0.11em] shrink-0 rounded-full bg-brand-red" aria-hidden="true" />
          </span>
        </h2>
      </Reveal>

      {/* Cards */}
      <div className="relative corner-marks grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border-t border-l border-gray-200">
        <SectionCorners />
        {CAPABILITIES.map((cap, i) => (
          <Reveal
            key={cap.title}
            delay={i * 90}
            className="group relative p-8 lg:p-10 border-r border-b border-gray-200 hover:bg-gray-50 transition-colors hover-trigger overflow-hidden"
          >
            {/* top sliding red bar */}
            <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732] transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>

            <div className="mb-10 flex items-center justify-between">
              <cap.Icon className="h-8 w-8 text-ink transition-colors duration-200 group-hover:text-[#F20732]" strokeWidth={1.5} />
              <span className="font-mono text-label-sm font-bold tracking-mono text-gray-400 transition-colors duration-200 group-hover:text-[#F20732]">
                {cap.tag}
              </span>
            </div>

            <h3 className="mb-3 text-lg font-bold tracking-[-0.02em] text-ink">{cap.title}</h3>
            <p className="text-sm leading-7 text-gray-600">{cap.desc}</p>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

export default Capabilities;
