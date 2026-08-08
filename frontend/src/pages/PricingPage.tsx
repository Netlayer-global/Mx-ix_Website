import React, { useEffect, useMemo, useState } from 'react';
import { Check, ArrowRight, Zap, MapPin } from 'lucide-react';
import { useAdmin } from '../contexts/AdminContext';

interface PricingPageProps {
  onNavigate?: (page: string) => void;
}

const isLive = (s: string) => s === 'active' || s === 'current';

// Order port speeds sensibly (1G < 10G < 25G < 100G < 400G)
const speedRank = (s: string) => {
  const n = parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
  return /t/i.test(s) ? n * 1000 : n;
};

// Indicative defaults when a location has no explicit pricing rows.
const DEFAULT_PRICE: Record<string, number> = { '1G': 250, '10G': 500, '25G': 900, '40G': 1100, '100G': 1500, '400G': 4000 };
const sym = (c?: string) => (c === 'USD' || c === '$' ? '$' : c === 'INR' || c === '₹' ? '₹' : c ? `${c} ` : '$');

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
  const [city, setCity] = useState<string>('');

  useEffect(() => {
    document.body.classList.add('dark-nav');
    return () => document.body.classList.remove('dark-nav');
  }, []);

  const liveLocations = useMemo(() => locations.filter((l) => isLive(l.status)), [locations]);

  // Default to the first live city once locations load.
  useEffect(() => {
    if (!city && liveLocations.length) setCity(liveLocations[0].id);
  }, [city, liveLocations]);

  // Per-location tiers (explicit pricing, else indicative defaults from its port speeds).
  const tiersFor = (loc: any) => {
    const explicit = loc.pricing || [];
    const rows = explicit.length
      ? explicit.map((p: any) => ({ portSpeed: p.portSpeed, monthly: p.monthlyPrice || 0, setup: p.setupFee || 0, currency: p.currency || 'USD' }))
      : (loc.portSpeeds || []).filter((s: string) => DEFAULT_PRICE[s]).map((s: string) => ({ portSpeed: s, monthly: DEFAULT_PRICE[s], setup: 0, currency: 'USD' }));
    return rows.sort((a: any, b: any) => speedRank(a.portSpeed) - speedRank(b.portSpeed));
  };

  const selectedLoc = liveLocations.find((l) => l.id === city);
  const shownTiers = selectedLoc ? tiersFor(selectedLoc) : [];
  const isIndicative = !!(selectedLoc && !(selectedLoc.pricing || []).length);

  const fmt = (cur: string, n: number) => (n > 0 ? `${sym(cur)}${n.toLocaleString()}` : 'Contact us');

  return (
    <div className="min-h-screen bg-white">
      {/* HERO */}
      <section className="relative pt-36 md:pt-44 pb-16 bg-ink text-white overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#F20732]/15 blur-[120px]"></div>
        <div className="relative max-w-[1400px] mx-auto px-6 md:px-12">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="w-4 h-4 text-[#F20732]" />
            <span className="eyebrow">Pricing</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black leading-[0.9] tracking-tighter mb-4">
            SIMPLE, <span className="text-[#F20732]">SCALABLE</span> PRICING
          </h1>
          <p className="max-w-2xl text-gray-500 text-sm md:text-base font-light leading-relaxed">
            Pay only for the port you need — from 1G to 400G. One connection unlocks the entire
            MX-IX peering ecosystem. No traffic charges, no lock-in.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 border border-white/10 mt-12">
            {[
              { v: 'Flat', l: 'Port-based pricing' },
              { v: '$0', l: 'Per-bit / traffic fees' },
              { v: '1G–400G', l: 'Port speeds' },
              { v: 'No', l: 'Lock-in contracts' },
            ].map((s) => (
              <div key={s.l} className="bg-ink p-5">
                <div className="text-3xl md:text-4xl font-light tracking-tighter">{s.v}</div>
                <div className="font-mono text-label-sm tracking-label uppercase text-gray-500 mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PORT TIERS — city-wise */}
      <section className="relative bg-white py-16 border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <div className="flex items-center gap-2.5 mb-5">
            <span className="font-mono text-label-sm font-bold tracking-label uppercase text-black">Port Pricing</span>
            <span className="font-mono text-label-sm text-gray-500">
              {selectedLoc ? `${selectedLoc.name} — per month` : 'select a city'}
            </span>
          </div>

          {/* City selector */}
          {liveLocations.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide mb-8 pb-1">
              {liveLocations.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setCity(l.id)}
                  className={`flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 font-mono text-label-sm tracking-mono uppercase border transition-colors hover-trigger ${city === l.id ? 'bg-[#F20732] text-white border-[#F20732]' : 'border-gray-300 text-gray-500 hover:border-ink hover:text-ink'}`}
                >
                  <MapPin className="w-3.5 h-3.5" /> {l.name}
                </button>
              ))}
            </div>
          )}

          {shownTiers.length === 0 ? (
            <div className="py-16 text-center border border-gray-200 border-dashed">
              <p className="font-mono text-xs text-gray-500 uppercase tracking-label">Pricing details available on request.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {shownTiers.map((t: any, i: number) => (
                <div key={t.portSpeed} className={`group relative bg-white p-8 border border-gray-200 hover:bg-gray-50 transition-colors overflow-hidden ${i === 1 ? 'ring-1 ring-[#F20732]/30' : ''}`}>
                  <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732] -translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
                  {i === 1 && (
                    <span className="absolute top-3 right-3 font-mono text-[9px] font-bold tracking-label uppercase bg-[#F20732] text-white px-2 py-1">Popular</span>
                  )}
                  <div className="font-mono text-label-sm tracking-label uppercase text-gray-500 mb-2">Port Speed</div>
                  <div className="text-3xl font-black tracking-tighter text-black mb-6">{t.portSpeed}</div>
                  <div className="text-3xl font-light tracking-tighter text-black tabular-nums">{fmt(t.currency, t.monthly)}</div>
                  <div className="font-mono text-[10px] tracking-label uppercase text-gray-500 mt-1">
                    {t.monthly > 0 ? 'per month' : 'get a quote'}
                  </div>
                  {t.setup > 0 && (
                    <div className="font-mono text-[10px] text-gray-500 mt-3 pt-3 border-t border-gray-100">
                      One-time setup: {sym(t.currency)}{t.setup.toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="font-mono text-[11px] text-gray-500 mt-4 leading-relaxed">
            {isIndicative
              ? `Indicative pricing for ${selectedLoc?.name} — contact us for a formal quote.`
              : `Pricing for ${selectedLoc?.name}. Cross-connect costs are billed by your data center.`}
            {' '}One port unlocks the entire peering ecosystem — no per-bit / traffic fees. All prices are exclusive of tax; applicable taxes vary by country.
          </p>
        </div>
      </section>

      {/* WHAT'S INCLUDED */}
      <section className="relative bg-white py-16">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div>
            <span className="eyebrow mb-4">Every Port Includes</span>
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

      {/* PEERING VS TRANSIT */}
      <section className="relative bg-gray-50 py-16 border-t border-gray-200">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <span className="eyebrow mb-2">Peering vs Transit</span>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-ink mb-3">Why a flat port beats metered transit</h2>
          <p className="text-gray-500 max-w-2xl mb-10">Transit bills you for every bit at the 95th percentile. A peering port is a fixed cost — the more you grow, the more you save.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-200 border border-gray-200">
            <div className="bg-white p-8">
              <div className="font-mono text-label-sm tracking-label uppercase text-[#F20732] mb-4">MX-IX Peering</div>
              <ul className="space-y-3">
                {['Fixed monthly port cost', 'No per-megabit charges', 'Direct, low-latency paths', 'Reach every member on one port', 'Predictable as you scale'].map((x) => (
                  <li key={x} className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[#F20732] flex-shrink-0 mt-1" />
                    <span className="text-sm text-gray-700">{x}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white p-8">
              <div className="font-mono text-label-sm tracking-label uppercase text-gray-500 mb-4">IP Transit</div>
              <ul className="space-y-3">
                {['Billed on 95th-percentile usage', 'Costs rise with every bit', 'Longer, indirect paths', 'Single upstream dependency', 'Unpredictable monthly spend'].map((x) => (
                  <li key={x} className="flex items-start gap-3">
                    <span className="w-4 h-4 flex-shrink-0 mt-1 flex items-center justify-center text-gray-500">—</span>
                    <span className="text-sm text-gray-500">{x}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative bg-white py-16 border-t border-gray-200">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 grid lg:grid-cols-3 gap-10">
          <div>
            <span className="eyebrow">FAQ</span>
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-ink mt-2 mb-4">Pricing questions</h2>
            <p className="text-gray-500 leading-relaxed">Clear, upfront answers about what you pay and what you get.</p>
          </div>
          <div className="lg:col-span-2 border border-gray-200 divide-y divide-gray-200">
            {[
              { q: 'Are there any traffic charges?', a: 'No. You pay a flat monthly fee for your port regardless of how much traffic you exchange. There are no per-megabit or 95th-percentile charges.' },
              { q: 'Is there a setup or cross-connect fee?', a: 'A one-time port setup fee may apply depending on location. Cross-connect costs are billed by your data center. We confirm exact figures in your quote.' },
              { q: 'Can I upgrade my port later?', a: 'Yes. You can scale from 1G up to 400G as your traffic grows — contact us and we will arrange the upgrade with minimal disruption.' },
              { q: 'Do prices vary by location?', a: 'Slightly. Rates reflect local data-center and facility costs. See per-location pricing on the Locations page or request a tailored quote.' },
            ].map((f, i) => (
              <div key={i} className="p-6">
                <div className="font-bold text-ink mb-1.5">{f.q}</div>
                <p className="text-sm text-gray-600 leading-relaxed">{f.a}</p>
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
            <p className="text-gray-500 mt-2">Request a port and our team will share exact pricing for your location.</p>
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
