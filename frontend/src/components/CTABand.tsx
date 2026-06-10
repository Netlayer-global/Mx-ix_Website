import React from 'react';
import { ArrowRight } from 'lucide-react';

interface Props { onNavigate?: (page: string) => void; }

const CTABand: React.FC<Props> = ({ onNavigate }) => (
  <section className="relative bg-ink text-white overflow-hidden z-10">
    <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-[#F20732]/15 blur-[110px] pointer-events-none"></div>
    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#F20732] to-transparent opacity-60"></div>
    <div className="relative max-w-[1400px] mx-auto px-6 md:px-12 py-20 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
      <div>
        <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732] mb-3 block">// Join the Fabric</span>
        <h2 className="text-3xl md:text-5xl font-black tracking-tighter leading-[0.95]">
          Ready to peer at <span className="text-[#F20732]">MX-IX</span>?
        </h2>
        <p className="text-gray-400 mt-3 max-w-xl font-light">
          One port. Direct access to every network on the exchange. Lower latency, lower cost.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={() => onNavigate?.('contact')} className="hover-trigger bg-[#F20732] text-white px-8 py-4 font-mono text-label-sm font-bold tracking-mono uppercase hover:bg-white hover:text-ink transition-colors flex items-center justify-center gap-3 group whitespace-nowrap">
          Request a Port <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
        <button onClick={() => onNavigate?.('pricing')} className="hover-trigger border border-white/20 text-white px-8 py-4 font-mono text-label-sm font-bold tracking-mono uppercase hover:bg-white hover:text-ink transition-colors whitespace-nowrap">
          View Pricing
        </button>
      </div>
    </div>
  </section>
);

export default CTABand;
