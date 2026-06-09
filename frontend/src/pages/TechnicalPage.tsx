import React from 'react';
import { useAdmin } from '../contexts/AdminContext';

const RouteServerTable = () => {
    const { locations } = useAdmin();
    const [selectedCityId, setSelectedCityId] = React.useState('');

    // Set initial city when locations load
    React.useEffect(() => {
        if (locations.length > 0 && !selectedCityId) {
            setSelectedCityId(locations[0].id);
        }
    }, [locations, selectedCityId]);

    const selectedLocation = locations.find(loc => loc.id === selectedCityId);
    const servers = selectedLocation?.routeServers || [];

    return (
        <div className="bg-[#111] rounded-xl overflow-hidden border border-gray-800 shadow-2xl">
            {/* Header / Filter */}
            <div className="p-6 border-b border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#F20732] animate-pulse"></div>
                    <h4 className="text-white font-bold text-lg">Route Server Status</h4>
                </div>
                
                <div className="relative">
                    <select 
                        value={selectedCityId}
                        onChange={(e) => setSelectedCityId(e.target.value)}
                        className="bg-black text-white border border-gray-700 rounded-md py-2 pl-4 pr-10 appearance-none focus:outline-none focus:border-[#F20732] transition-colors cursor-pointer min-w-[200px]"
                    >
                        {locations.map(loc => (
                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-[#1a1a1a]">
                            <th className="py-4 px-6 font-mono text-xs text-[#F20732] uppercase tracking-wider font-bold">Route Server</th>
                            <th className="py-4 px-6 font-mono text-xs text-[#F20732] uppercase tracking-wider font-bold">ASN</th>
                            <th className="py-4 px-6 font-mono text-xs text-[#F20732] uppercase tracking-wider font-bold">IPv4</th>
                            <th className="py-4 px-6 font-mono text-xs text-[#F20732] uppercase tracking-wider font-bold">IPv6</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {servers.length > 0 ? (
                            servers.map((server, idx) => (
                                <tr key={idx} className="hover:bg-white/5 transition-colors">
                                    <td className="py-4 px-6 text-white font-bold">{server.name}</td>
                                    <td className="py-4 px-6 text-gray-400 font-mono">{server.asn}</td>
                                    <td className="py-4 px-6 text-gray-300 font-mono text-sm">{server.ipv4}</td>
                                    <td className="py-4 px-6 text-gray-300 font-mono text-sm">{server.ipv6}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={4} className="py-12 text-center text-gray-500 italic">
                                    No Route Server details available for this location yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const TechnicalPage = () => {
  // Handle Body Class for Navbar Styling
  React.useEffect(() => {
    document.body.classList.add('dark-nav');
    return () => {
      document.body.classList.remove('dark-nav');
    };
  }, []);

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      const offset = 100; // Adjust for fixed header
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      
      // Update URL hash without jumping
      window.history.pushState(null, '', `#${id}`);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative bg-black text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-[#F20732]/20 via-transparent to-transparent"></div>

        <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10 pt-32 pb-20">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-2 h-2 rounded-full bg-[#F20732] animate-pulse"></div>
            <span className="font-mono text-xs font-bold tracking-[0.2em] text-[#F20732] uppercase">
              Member Resources
            </span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black leading-tight tracking-tighter mb-6">
            TECHNICAL <span className="text-[#F20732]">REQUIREMENTS</span>
          </h1>
          <p className="text-gray-300 text-lg leading-relaxed max-w-xl mb-8">
            Security policies, BGP configuration, and operational standards for the shared Layer 2 infrastructure.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Sidebar Navigation */}
          <div className="lg:col-span-3">
             <div className="sticky top-32 space-y-2">
                <a href="#security" onClick={(e) => scrollToSection(e, 'security')} className="block text-sm font-mono font-bold uppercase tracking-wider text-black hover:text-[#F20732] transition-colors py-2 border-l-2 border-[#F20732] pl-4">Security Policy</a>
                 <a href="#ip-traffic" onClick={(e) => scrollToSection(e, 'ip-traffic')} className="block text-sm font-mono font-bold uppercase tracking-wider text-gray-500 hover:text-[#F20732] transition-colors py-2 border-l-2 border-transparent pl-4 hover:border-gray-200">IP Traffic Exchange</a>
                 <a href="#route-servers" onClick={(e) => scrollToSection(e, 'route-servers')} className="block text-sm font-mono font-bold uppercase tracking-wider text-gray-500 hover:text-[#F20732] transition-colors py-2 border-l-2 border-transparent pl-4 hover:border-gray-200">RS Policies</a>
                 <a href="#filtering" onClick={(e) => scrollToSection(e, 'filtering')} className="block text-sm font-mono font-bold uppercase tracking-wider text-gray-500 hover:text-[#F20732] transition-colors py-2 border-l-2 border-transparent pl-4 hover:border-gray-200">Prefix Filtering</a>
             </div>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-9 space-y-16">
            
            {/* Security Policy */}
            <div id="security" className="scroll-mt-32">
                <h3 className="text-3xl font-bold mb-6 flex items-center gap-4">
                    Security Policy
                    <div className="h-px flex-1 bg-gray-200"></div>
                </h3>
                <div className="bg-gray-50 p-8 rounded-lg border border-gray-100">
                    <p className="text-gray-700 leading-relaxed">
                     aims to ensure the Members reliable and uninterrupted Service as well as to limit the risks of deliberate or accidental mistakes, defective equipment or lack of speed of certain Member to reflect the quality of the others.
                    </p>
                </div>
            </div>

            {/* IP Traffic Exchange */}
             <div id="ip-traffic" className="scroll-mt-32">
                <h3 className="text-3xl font-bold mb-6 flex items-center gap-4">
                    IP Traffic Exchange
                    <div className="h-px flex-1 bg-gray-200"></div>
                </h3>
                <p className="text-gray-700 mb-6">IP traffic should be exchanged between members using BGP protocol by the following ways:</p>
                
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-white border border-gray-200 p-6 rounded-lg hover:shadow-lg transition-shadow">
                        <div className="w-10 h-10 bg-black text-white flex items-center justify-center font-bold text-xl mb-4">01</div>
                        <h4 className="font-bold text-lg mb-2">Route Servers (RS)</h4>
                        <p className="text-gray-600 text-sm">Two RSs for redundancy and resilience.</p>
                    </div>
                    <div className="bg-white border border-gray-200 p-6 rounded-lg hover:shadow-lg transition-shadow">
                        <div className="w-10 h-10 bg-[#F20732] text-white flex items-center justify-center font-bold text-xl mb-4">02</div>
                        <h4 className="font-bold text-lg mb-2">Bilateral BGP Sessions</h4>
                        <p className="text-gray-600 text-sm">Between Members / Content providers with their mutual agreements.</p>
                    </div>
                </div>
            </div>

            {/* Route Server Details (Dynamic) */}
             <div id="route-servers" className="scroll-mt-32">
                <h3 className="text-3xl font-bold mb-6 flex items-center gap-4">
                    Route Server Details
                    <div className="h-px flex-1 bg-gray-200"></div>
                </h3>
                
                <div className="space-y-8">
                    {/* Intro & Policies */}
                    <div>
                        <div className="bg-blue-50 border-l-4 border-blue-500 p-6 mb-8 rounded-r-lg">
                             <div className="flex gap-4">
                                <div className="text-blue-500">
                                   <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                   </svg>
                                </div>
                                <div>
                                   <p className="text-sm text-blue-900 font-bold mb-1">Peering Configuration Note</p>
                                   <p className="text-sm text-blue-800">
                                      Use <span className="font-mono font-bold">no bgp enforce-first-as</span> (Cisco) or <span className="font-mono font-bold">undo check-first-as</span> (Huawei) as our Route Servers do not have their AS first in the AS_PATH.
                                   </p>
                                </div>
                             </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4 mb-8">
                             <div className="bg-black text-gray-300 p-4 rounded font-mono text-sm">
                                <div className="text-[#F20732] mb-2 font-bold uppercase text-[10px] tracking-widest">Cisco IOS/IOS-XE</div>
                                <code className="block">no bgp enforce-first-as</code>
                                <span className="text-gray-600 italic">or</span>
                                <code className="block">bgp enforce-first-as disable</code>
                             </div>
                             <div className="bg-black text-gray-300 p-4 rounded font-mono text-sm">
                                <div className="text-[#F20732] mb-2 font-bold uppercase text-[10px] tracking-widest">Huawei VRP</div>
                                <code className="block">undo check-first-as</code>
                             </div>
                        </div>
                    </div>

                    {/* Dynamic Data Table */}
                    <RouteServerTable />
                </div>
            </div>

            {/* Incoming Prefixes Filtering */}
            <div id="filtering" className="scroll-mt-32">
                 <h3 className="text-3xl font-bold mb-6 flex items-center gap-4">
                    Incoming Prefixes Filtering
                    <div className="h-px flex-1 bg-gray-200"></div>
                </h3>
                
                <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-100/50">
                        <h5 className="font-bold text-sm uppercase tracking-wider text-gray-500">Filtering Policy Rules</h5>
                    </div>
                    <ul className="divide-y divide-gray-200">
                        {[
                            'Drop small prefixes – longer than /24 for ipv4 and longer than /48 for ipv6.',
                            'Drop all well-known Martians and bogons.',
                            'Ensure that there is at least 1 ASN and less than 64 ASNs in the AS path.',
                            'Ensure that the peer AS is the same as the first AS in the AS path.',
                            'Drop any prefix where the next-hop IP address is not the same as the peer IP address. This prevents prefix hijacking.',
                            'Drop any prefix with a transit network (Internet or IP Transit) ASN in the AS path.',
                            'Ensure that origin AS is in the set of ASNs from the client’s IRRDB AS-SET.',
                            'If the prefix is evaluated as RPKI valid, it is accepted.',
                            'If the prefix is evaluated as RPKI invalid, it will be dropped.',
                            'If the prefix is evaluated as RPKI unknown, revert to the standard IRRDB prefix filtering.'
                        ].map((rule, idx) => (
                            <li key={idx} className="px-6 py-4 flex items-start gap-4 hover:bg-white transition-colors">
                                <span className="font-mono text-[#F20732] text-sm pt-1">0{idx + 1}</span>
                                <span className="text-gray-700">{rule}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
};

export default TechnicalPage;
