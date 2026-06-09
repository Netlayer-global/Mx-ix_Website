import React from 'react';

const AboutPage: React.FC = () => {
  return (
    <section className="relative min-h-screen pt-24 md:pt-32 pb-12 md:pb-20 bg-white">
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 relative z-10">
        {/* Header */}
        <div className="mb-16">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-2 h-2 rounded-full bg-[#F20732] animate-pulse"></div>
            <span className="font-mono text-xs font-bold tracking-[0.2em] text-[#F20732] uppercase">
              Our Story
            </span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black leading-tight tracking-tighter mb-6 text-black">
            ABOUT <span className="text-[#F20732]">MX-IX</span>
          </h1>
          
          <p className="max-w-2xl text-gray-500 text-base md:text-lg leading-relaxed border-l-2 border-gray-100 pl-4 md:pl-6">
            MX-IX is a carrier- and data-center-neutral Internet Exchange where networks meet to
            exchange traffic directly — improving performance, cutting transit costs and keeping
            local traffic local.
          </p>
        </div>

        {/* Content sections */}
        <div className="space-y-20">
          {/* Mission */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-black tracking-tighter mb-6 text-black">
                Our Mission
              </h2>
              <p className="text-gray-600 text-lg leading-relaxed mb-4">
                MX-IX exists to make interconnection simple, open and accessible. By bringing ISPs,
                content providers, cloud platforms and enterprises onto a single neutral fabric, we
                let networks peer directly instead of hauling traffic across expensive, distant
                transit paths.
              </p>
              <p className="text-gray-600 text-lg leading-relaxed">
                Connect once and reach the entire MX-IX ecosystem. From a regional ISP to a global
                content network, our route servers and high-capacity ports make peering effortless
                and scalable — from 1G all the way to 400G.
              </p>
            </div>
            <div className="bg-gray-50 border border-gray-200 p-8 md:p-12 relative group hover:border-black transition-all duration-300">
              <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
              <div className="space-y-8">
                <div>
                  <div className="text-5xl font-light tracking-tighter text-black mb-2">2026</div>
                  <div className="font-mono text-xs text-gray-400 uppercase tracking-widest">Founded</div>
                </div>
                <div>
                  <div className="text-5xl font-light tracking-tighter text-black mb-2">2+</div>
                  <div className="font-mono text-xs text-gray-400 uppercase tracking-widest">Countries</div>
                </div>
                <div>
                  <div className="text-5xl font-light tracking-tighter text-black mb-2">5000+</div>
                  <div className="font-mono text-xs text-gray-400 uppercase tracking-widest">Enterprise Clients</div>
                </div>
              </div>
            </div>
          </div>

          {/* Why Peer */}
          <div>
            <h2 className="text-4xl font-black tracking-tighter mb-8 text-black">
              Why Peer at MX-IX
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border border-gray-200 p-6 md:p-8 hover:border-black transition-all duration-300 group relative overflow-hidden hover-trigger">
                <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
                <div className="mb-4">
                  <svg className="w-12 h-12 text-[#F20732]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-black tracking-tighter mb-3 text-black">Connect Once, Reach Many</h3>
                <p className="text-gray-600 leading-relaxed">
                  A single port to our route servers gives you multilateral peering with every
                  network on the exchange — no need to negotiate sessions one by one.
                </p>
              </div>

              <div className="bg-white border border-gray-200 p-8 hover:border-black transition-all duration-300 group relative overflow-hidden hover-trigger">
                <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left delay-75"></div>
                <div className="mb-4">
                  <svg className="w-12 h-12 text-[#F20732]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-black tracking-tighter mb-3 text-black">Lower Latency &amp; Cost</h3>
                <p className="text-gray-600 leading-relaxed">
                  Keep local traffic local. Direct peering shortens network paths, reduces
                  round-trip times and cuts the cost of expensive IP transit.
                </p>
              </div>

              <div className="bg-white border border-gray-200 p-8 hover:border-black transition-all duration-300 group relative overflow-hidden hover-trigger">
                <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left delay-150"></div>
                <div className="mb-4">
                  <svg className="w-12 h-12 text-[#F20732]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-black tracking-tighter mb-3 text-black">Resilient &amp; Protected</h3>
                <p className="text-gray-600 leading-relaxed">
                  Redundant route servers, 24/7 NOC monitoring and built-in blackholing keep your
                  traffic flowing and shielded against volumetric DDoS attacks.
                </p>
              </div>
            </div>
          </div>

          {/* Values */}
          <div className="bg-ink text-white p-8 md:p-12 lg:p-16 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#F20732]/15 blur-[110px] pointer-events-none"></div>
            <div className="relative z-10">
              <h2 className="text-4xl font-black tracking-tighter mb-8">What We Stand For</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xl font-bold mb-3 text-[#F20732]">Neutrality</h3>
                  <p className="text-gray-300 leading-relaxed">
                    Carrier- and data-center-neutral by design. Every network connects on equal
                    terms, free to peer with whomever they choose.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-3 text-[#F20732]">Reliability</h3>
                  <p className="text-gray-300 leading-relaxed">
                    Redundant switching, dual route servers and 24/7 monitoring. 99.99% uptime is
                    the baseline, not the target.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-3 text-[#F20732]">Openness</h3>
                  <p className="text-gray-300 leading-relaxed">
                    Transparent pricing, an open peering policy and a public looking glass — so you
                    always know exactly what the fabric is doing.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-3 text-[#F20732]">Community</h3>
                  <p className="text-gray-300 leading-relaxed">
                    We grow the regional internet by making interconnection affordable and
                    accessible for networks of every size.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutPage;
