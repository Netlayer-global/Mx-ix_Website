import React from 'react';
import { Plug, Share2, Globe2 } from 'lucide-react';
import Reveal from './Reveal';

const STEPS = [
  {
    Icon: Plug,
    step: '01',
    title: 'Connect a Port',
    desc: 'Order a 1G–400G port at any MX-IX location and cross-connect to our switching fabric in the data center.',
  },
  {
    Icon: Share2,
    step: '02',
    title: 'Join the Route Servers',
    desc: 'Configure a single BGP session to our redundant route servers — no per-peer negotiation required.',
  },
  {
    Icon: Globe2,
    step: '03',
    title: 'Reach Every Network',
    desc: 'Instantly exchange traffic with every ISP, content and cloud network on the exchange. Local stays local.',
  },
];

const HowPeering: React.FC = () => (
  <section className="relative bg-ink text-white py-20 md:py-28 overflow-hidden border-b border-white/10">
    <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#F20732]/15 blur-[130px] pointer-events-none"></div>
    <div className="relative max-w-[1400px] mx-auto px-6 md:px-12">
      <Reveal className="mb-14 max-w-3xl">
        <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732] mb-4 block">// How It Works</span>
        <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-[0.95]">
          PEERING IN<br /><span className="text-[#F20732]">THREE STEPS</span>
        </h2>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10 border border-white/10">
        {STEPS.map((s, i) => (
          <Reveal
            key={s.step}
            delay={i * 100}
            className="group relative bg-ink p-8 lg:p-10 hover:bg-white/[0.03] transition-colors overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732] -translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
            <div className="flex items-center justify-between mb-8">
              <s.Icon className="w-9 h-9 text-white group-hover:text-[#F20732] transition-colors" strokeWidth={1.6} />
              <span className="font-mono text-2xl font-black text-white/15">{s.step}</span>
            </div>
            <h3 className="text-xl font-bold tracking-tight mb-3">{s.title}</h3>
            <p className="text-sm text-gray-400 leading-relaxed font-light">{s.desc}</p>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

export default HowPeering;
