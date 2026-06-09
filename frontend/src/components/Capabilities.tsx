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
      <Reveal className="mb-14 max-w-3xl">
        <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732] mb-4 block">
          // Why MX-IX
        </span>
        <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-[0.95] text-black">
          BUILT FOR<br />
          <span className="text-transparent" style={{ WebkitTextStroke: '1.5px #000' }}>PEERING</span>
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

            <div className="flex items-center justify-between mb-8">
              <cap.Icon className="w-9 h-9 text-black group-hover:text-[#F20732] transition-colors" strokeWidth={1.75} />
              <span className="font-mono text-label-sm tracking-mono text-gray-300 group-hover:text-[#F20732] transition-colors">
                {cap.tag}
              </span>
            </div>

            <h3 className="text-lg font-bold tracking-tight text-black mb-3">{cap.title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed font-light">{cap.desc}</p>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

export default Capabilities;
