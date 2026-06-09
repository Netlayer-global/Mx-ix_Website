import React, { useEffect, useMemo } from 'react';
import { Check, ArrowRight, Zap } from 'lucide-react';
import { useAdmin } from '../contexts/AdminContext';

interface PricingPageProps {
  onNavigate?: (page: string) => void;
}

// Order port speeds sensibly (1G < 10G < 25G < 100G < 400G)
const speedRank = (s: string) => {
  const n = parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
  return /t/i.test(s) ? n * 1000 : n;
};

const INCLUDED = [
  'Access to all MX-IX route servers',
  'Multilateral peering with every member',
  'IPv4 & IPv6 dual-stack',
  'Redundant switching fabric',
  '24/7 NOC monitoring',
  'DDoS blackholing community',
  'Looking Glass & portal access',
  '99.99% uptime SLA',
];

const PricingPage: React.FC<PricingPageProps> = ({ onNavigate }) => {
  const { locations } = useAdmin();

  useEffect(() => {
    document.body.classList.add('dark-nav');
    return () => document.body.classList.remove('dark-nav');
  }, []);

  // Derive port tiers from real per-location pricing data
  const tiers = useMemo(() => {
    const map = new Map<string, { monthly: number; setup: number; currency: string }>();
    locations.forEach((loc) => {
      (loc.pricing || []).forEach((p) => {
        if (!p.portSpeed) return;
        const existing = map.get(p.portSpeed);
        if (!existing || (p.monthlyPrice && p.monthlyPrice < existing.monthly)) {
          map.set(p.portSpeed, {
            monthly: p.monthlyPrice || 0,
            setup: p.setupFee || 0,
            currency: p.currency || '₹',
          });
        }
      });
    });
    // Fallback: if no pricing rows, use distinct portSpeeds from locations
    if (map.size === 0) {
      const speeds = new Set<string>();
      locations.forEach((loc) => (loc.portSpeeds || []).forEach((s) => speeds.add(s)));
      Array.from(speeds).forEach((s) => map.set(s, { monthly: 0, setup: 0, currency: '' }));
    }
    return Array.from(map.entries())
      .map(([portSpeed, v]) => ({ portSpeed, ...v }))
      .sort((a, b) => speedRank(a.portSpeed) - speedRank(b.portSpeed));
  }, [locations]);

  const fmt = (cur: string, n: number) => (n > 0 ? `${cur}${n.toLocaleString()}` : 'Contact us');

  return (
    <div className="min-h-screen bg-white">
      {/* HERO */}
      <section className="relative pt-36 md:pt-44 pb-16 bg-ink text-white overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#F20732]/15 blur-[120px]"></div>
        <div className="relative max-w-[1400px] mx-auto px-6 md:px-12">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="w-4 h-4 text-[#F20732]" />
            <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Pricing</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black leading-[0.9] tracking-tighter mb-4">
            SIMPLE, <span className="text-[#F20732]">SCALABLE</span> PRICING
          </h1>
          <p className="max-w-2xl text-gray-400 text-sm md:text-base font-light leading-relaxed">
            Pay only for the port you need — from 1G to 400G. One connection unlocks the entire
            MX-IX peering ecosystem. No traffic charges, no lock-in.
          </p>
        </div>
      </section>

      {/* PORT TIERS */}
      <section className="relative bg-white py-16 border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <div className="flex items-center gap-2.5 mb-8">
            <span className="font-mono text-label-sm font-bold tracking-label uppercase text-black">Port Pricing</span>
            <span className="font-mono text-label-sm text-gray-400">// from, per month</span>
          </div>

          {tiers.length === 0 ? (
            <div className="py-16 text-center border border-gray-200 border-dashed">
              <p className="font-mono text-xs text-gray-400 uppercase tracking-label">Pricing details available on request.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200 border border-gray-200">
              {tiers.map((t, i) => (
                <div key={t.portSpeed} className={`group relative bg-white p-8 hover:bg-gray-50 transition-colors overflow-hidden ${i === 1 ? 'ring-1 ring-[#F20732]/30' : ''}`}>
                  <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732] -translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
                  <div className="font-mono text-label-sm tracking-label uppercase text-gray-400 mb-2">Port Speed</div>
                  <div className="text-3xl font-black tracking-tighter text-black mb-6">{t.portSpeed}</div>
                  <div className="text-3xl font-light tracking-tighter text-black tabular-nums">{fmt(t.currency, t.monthly)}</div>
                  <div className="font-mono text-[10px] tracking-label uppercase text-gray-400 mt-1">
                    {t.monthly > 0 ? 'per month' : 'get a quote'}
                  </div>
                  {t.setup > 0 && (
                    <div className="font-mono text-[10px] text-gray-500 mt-3 pt-3 border-t border-gray-100">
                      One-time setup: {t.currency}{t.setup.toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="font-mono text-[11px] text-gray-400 mt-4 leading-relaxed">
            Indicative pricing — exact rates may vary by location and data center. See per-location
            pricing on the Locations page or contact us for a tailored quote.
          </p>
        </div>
      </section>

      {/* WHAT'S INCLUDED */}
      <section className="relative bg-white py-16">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div>
            <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732] mb-4 block">// Every Port Includes</span>
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-black mb-6">One price. Everything you need to peer.</h2>
            <p className="text-gray-500 leading-relaxed">
              There are no per-megabit or per-session charges at MX-IX. A single port gives you
              unmetered access to the full exchange — peer with as many networks as you like.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            {INCLUDED.map((item) => (
              <div key={item} className="flex items-start gap-3">
                <Check className="w-5 h-5 text-[#F20732] flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative bg-ink text-white overflow-hidden">
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-[#F20732]/15 blur-[110px]"></div>
        <div className="relative max-w-[1400px] mx-auto px-6 md:px-12 py-16 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter">Ready to connect?</h2>
            <p className="text-gray-400 mt-2">Request a port and our team will share exact pricing for your location.</p>
          </div>
          <button
            onClick={() => onNavigate?.('contact')}
            className="hover-trigger self-start md:self-auto bg-[#F20732] text-white px-8 py-4 font-mono text-label-sm font-bold tracking-mono uppercase hover:bg-white hover:text-ink transition-colors flex items-center gap-3 group whitespace-nowrap"
          >
            Request a Port <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>
    </div>
  );
};

export default PricingPage;
