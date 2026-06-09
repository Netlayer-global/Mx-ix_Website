import React, { useState, useEffect } from 'react';
import { useAdmin } from '../contexts/AdminContext';
import { grafanaApi } from '../services/api';
import type { ASN, EnabledSite } from '../contexts/AdminContext';

interface LocationData {
  id: string;
  name: string;
  country: string;
  continentId: string;
  region: string;
  status: 'active' | 'maintenance' | 'planned';
  latency: string;
  datacenter: string;
  address: string;
  ixName: string;
  peers: number;
  capacity: string;
  uptime?: string;
  ipv4Routes?: string;
  ipv6Routes?: string;
  portSpeeds: string[];
  protocols: string[];
  features: string[];
  description: string;
  established: string;
  cityImage: string;
  pricing?: { portSpeed: string; monthlyPrice: number; setupFee: number; currency: string }[];
  routeServers?: { name: string; asn: number; ipv4: string; ipv6: string }[];
}

interface ContinentData {
  id: string;
  name: string;
}

interface LocationsPageProps {
  preSelectedLocation?: string;
  preSelectedSection?: string;
}

const LocationsPage = ({ preSelectedLocation, preSelectedSection }: LocationsPageProps) => {
  const [expandedContinent, setExpandedContinent] = useState<string>('asia');
  const [selectedLocation, setSelectedLocation] = useState<string>('del');
  const [asnSearch, setASNSearch] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'asns' | 'sites' | 'pricing' | 'route-servers' | 'stats'>('overview');
  const { locations: adminLocations, continents: adminContinents } = useAdmin();

  // Grafana live traffic data
  const [grafanaTraffic, setGrafanaTraffic] = useState<{
    peakTraffic: number;
    avgTraffic: number;
    isLive: boolean;
    loading: boolean;
  }>({
    peakTraffic: 0,
    avgTraffic: 0,
    isLive: false,
    loading: false,
  });

  // Hardcoded fallback data (used only if adminLocations is empty)
  const hardcodedLocations: LocationData[] = [
    // Current (Live) Locations - India
    {
      id: 'del',
      name: 'NEW DELHI',
      country: 'India',
      continentId: 'asia',
      region: 'South Asia',
      status: 'active',
      latency: '1.6',
      datacenter: 'NTT DELHI DC',
      address: 'Sector 142, Noida, Uttar Pradesh 201304, India',
      ixName: 'DELIX',
      peers: 320,
      capacity: '150+',
      portSpeeds: ['1G', '10G', '40G', '100G'],
      protocols: ['BGP-4', 'IPv4', 'IPv6', 'MPLS'],
      features: [
        'North India gateway',
        'Government connectivity hub',
        'Enterprise connectivity',
        'Multi-cloud access',
        'Low-latency trading',
        'Carrier-dense location'
      ],
      description: 'Strategic hub serving North India\'s enterprise and government networks.',
      established: '2023',
      cityImage: '/assets/cities/delhi.png',
      routeServers: [
        { name: 'RS1', asn: 49378, ipv4: '103.77.108.200', ipv6: '2001:df2:1900:2::200' },
        { name: 'RS2', asn: 49378, ipv4: '103.77.108.240', ipv6: '2001:df2:1900:2::240' }
      ]
    },
    {
      id: 'bom',
      name: 'MUMBAI',
      country: 'India',
      continentId: 'asia',
      region: 'South Asia',
      status: 'active',
      latency: '1.8',
      datacenter: 'Sify Rabale DC',
      address: 'MIDC Rabale, Navi Mumbai, Maharashtra 400701, India',
      ixName: 'MBIIX',
      peers: 340,
      capacity: '120+',
      portSpeeds: ['1G', '10G', '40G', '100G'],
      protocols: ['BGP-4', 'IPv4', 'IPv6'],
      features: [
        'Gateway to Indian subcontinent',
        'Financial hub connectivity',
        'Low-latency to APAC markets',
        'Carrier-neutral facility',
        'Enterprise connectivity',
        'Cloud on-ramps available'
      ],
      description: 'Strategic gateway serving India\'s largest financial and commercial center.',
      established: '2022',
      cityImage: '/assets/cities/mumbai.png',
      routeServers: [
        { name: 'RS1', asn: 49378, ipv4: '103.77.109.11', ipv6: '2001:df2:1900:2::11' },
        { name: 'RS2', asn: 49378, ipv4: '103.77.109.12', ipv6: '2001:df2:1900:2::12' }
      ]
    },
    {
      id: 'maa',
      name: 'CHENNAI',
      country: 'India',
      continentId: 'asia',
      region: 'South Asia',
      status: 'active',
      latency: '2.0',
      datacenter: 'STT CHENNAI 1',
      address: 'Ambattur Industrial Estate, Chennai 600058, India',
      ixName: 'CIIX',
      peers: 280,
      capacity: '100+',
      portSpeeds: ['1G', '10G', '40G', '100G'],
      protocols: ['BGP-4', 'IPv4', 'IPv6'],
      features: [
        'Submarine cable landing point',
        'South India gateway',
        'IT corridor connectivity',
        'Disaster recovery hub',
        'Cloud connectivity',
        'Enterprise-grade facility'
      ],
      description: 'Key submarine cable landing station connecting India to global networks.',
      established: '2023',
      cityImage: '/assets/cities/chennai.png'
    },
    {
      id: 'ccu',
      name: 'KOLKATA',
      country: 'India',
      continentId: 'asia',
      region: 'South Asia',
      status: 'active',
      latency: '2.2',
      datacenter: 'CTRLS KOLKATA',
      address: 'Sector V, Salt Lake City, Kolkata 700091, India',
      ixName: 'CCUIX',
      peers: 180,
      capacity: '80+',
      portSpeeds: ['1G', '10G', '40G', '100G'],
      protocols: ['BGP-4', 'IPv4', 'IPv6'],
      features: [
        'Eastern India gateway',
        'BFSI hub connectivity',
        'Low-latency to Bangladesh',
        'Enterprise connectivity',
        'Cloud on-ramps available',
        'Carrier-neutral facility'
      ],
      description: 'Strategic gateway serving Eastern India\'s enterprise and financial networks.',
      established: '2024',
      cityImage: '/assets/cities/kolkata.png'
    },
    {
      id: 'hyd',
      name: 'HYDERABAD',
      country: 'India',
      continentId: 'asia',
      region: 'South Asia',
      status: 'active',
      latency: '1.9',
      datacenter: 'YOTTA HYDERABAD',
      address: 'HITEC City, Hyderabad 500081, India',
      ixName: 'HYDIX',
      peers: 220,
      capacity: '100+',
      portSpeeds: ['1G', '10G', '40G', '100G'],
      protocols: ['BGP-4', 'IPv4', 'IPv6'],
      features: [
        'Central India gateway',
        'IT hub connectivity',
        'Enterprise connectivity',
        'Cloud on-ramps (AWS, Azure)',
        'Carrier-neutral facility',
        'Green energy powered'
      ],
      description: 'Key hub serving Hyderabad\'s thriving IT and enterprise sector.',
      established: '2024',
      cityImage: '/assets/cities/hyderabad.png'
    },
    {
      id: 'blr',
      name: 'BANGALORE',
      country: 'India',
      continentId: 'asia',
      region: 'South Asia',
      status: 'active',
      latency: '1.7',
      datacenter: 'NTT BANGALORE DC',
      address: 'Electronic City, Bangalore 560100, India',
      ixName: 'BLRIX',
      peers: 350,
      capacity: '150+',
      portSpeeds: ['1G', '10G', '40G', '100G'],
      protocols: ['BGP-4', 'IPv4', 'IPv6', 'MPLS'],
      features: [
        'Silicon Valley of India',
        'Tech hub connectivity',
        'Enterprise connectivity',
        'Multi-cloud access',
        'Low-latency trading',
        'Carrier-dense location'
      ],
      description: 'India\'s tech capital hub serving enterprise and startup networks.',
      established: '2023',
      cityImage: '/assets/cities/bangalore.png'
    },
    // Current (Live) Location - Middle East
    {
      id: 'dxb',
      name: 'DUBAI',
      country: 'United Arab Emirates',
      continentId: 'middle-east',
      region: 'Middle East',
      status: 'active',
      latency: '1.4',
      datacenter: 'EQUINIX DX1',
      address: 'Dubai Silicon Oasis, Dubai, UAE',
      ixName: 'UAE-IX',
      peers: 250,
      capacity: '180+',
      portSpeeds: ['10G', '40G', '100G'],
      protocols: ['BGP-4', 'IPv4', 'IPv6'],
      features: [
        'Middle East gateway',
        'MENA region hub',
        'Financial services hub',
        'Low-latency to Africa/Asia',
        'Enterprise connectivity',
        'Cloud on-ramps available'
      ],
      description: 'Premier Middle East hub connecting MENA region to global networks.',
      established: '2024',
      cityImage: '/assets/cities/dubai.png'
    },
    // Upcoming Locations - North America
    {
      id: 'lax',
      name: 'LOS ANGELES',
      country: 'United States',
      continentId: 'north-america',
      region: 'North America',
      status: 'planned',
      latency: '-',
      datacenter: 'EQUINIX LA1',
      address: 'Los Angeles, CA, USA',
      ixName: 'LAIIX',
      peers: 0,
      capacity: '-',
      portSpeeds: ['10G', '40G', '100G'],
      protocols: ['BGP-4', 'IPv4', 'IPv6'],
      features: [
        'West Coast gateway',
        'Pacific connectivity',
        'Content networks hub',
        'Cloud on-ramps',
        'Carrier-neutral facility',
        'Coming soon'
      ],
      description: 'Upcoming West Coast presence for Pacific connectivity.',
      established: 'Coming Soon',
      cityImage: '/assets/cities/losangeles.png'
    },
    {
      id: 'sjc',
      name: 'SILICON VALLEY',
      country: 'United States',
      continentId: 'north-america',
      region: 'North America',
      status: 'planned',
      latency: '-',
      datacenter: 'EQUINIX SV1',
      address: 'San Jose, CA, USA',
      ixName: 'SJIIX',
      peers: 0,
      capacity: '-',
      portSpeeds: ['10G', '40G', '100G', '400G'],
      protocols: ['BGP-4', 'IPv4', 'IPv6'],
      features: [
        'Tech capital access',
        'Cloud connectivity hub',
        'Enterprise networks',
        'Low-latency trading',
        'Multi-cloud access',
        'Coming soon'
      ],
      description: 'Upcoming presence in the heart of Silicon Valley.',
      established: 'Coming Soon',
      cityImage: '/assets/cities/siliconvalley.png'
    },
    {
      id: 'qro',
      name: 'QUERETARO',
      country: 'Mexico',
      continentId: 'north-america',
      region: 'North America',
      status: 'planned',
      latency: '-',
      datacenter: 'TBD',
      address: 'Queretaro, Mexico',
      ixName: 'QROIX',
      peers: 0,
      capacity: '-',
      portSpeeds: ['10G', '40G', '100G'],
      protocols: ['BGP-4', 'IPv4', 'IPv6'],
      features: [
        'LATAM gateway',
        'Mexico connectivity',
        'Enterprise networks',
        'Cloud on-ramps',
        'Carrier-neutral',
        'Coming soon'
      ],
      description: 'Upcoming presence in Mexico\'s growing tech hub.',
      established: 'Coming Soon',
      cityImage: '/assets/cities/queretaro.png'
    },
    // Upcoming Location - Europe
    {
      id: 'vie',
      name: 'VIENNA',
      country: 'Austria',
      continentId: 'europe',
      region: 'Europe',
      status: 'planned',
      latency: '-',
      datacenter: 'INTERXION VIE1',
      address: 'Vienna, Austria',
      ixName: 'VIX',
      peers: 0,
      capacity: '-',
      portSpeeds: ['10G', '40G', '100G'],
      protocols: ['BGP-4', 'IPv4', 'IPv6'],
      features: [
        'Central European gateway',
        'CEE connectivity',
        'Financial services',
        'Enterprise networks',
        'Green energy powered',
        'Coming soon'
      ],
      description: 'Upcoming Central European hub for CEE connectivity.',
      established: 'Coming Soon',
      cityImage: '/assets/cities/vienna.png'
    },
    // Upcoming Location - South America
    {
      id: 'eze',
      name: 'BUENOS AIRES',
      country: 'Argentina',
      continentId: 'south-america',
      region: 'South America',
      status: 'planned',
      latency: '-',
      datacenter: 'TBD',
      address: 'Buenos Aires, Argentina',
      ixName: 'AMSIX-BA',
      peers: 0,
      capacity: '-',
      portSpeeds: ['10G', '40G', '100G'],
      protocols: ['BGP-4', 'IPv4', 'IPv6'],
      features: [
        'South America gateway',
        'LATAM connectivity',
        'Enterprise networks',
        'Cloud on-ramps',
        'Carrier-neutral',
        'Coming soon'
      ],
      description: 'Upcoming South American presence for LATAM connectivity.',
      established: 'Coming Soon',
      cityImage: '/assets/cities/buenosaires.png'
    },
    // Upcoming Location - Middle East
    {
      id: 'fjr',
      name: 'FUJAIRAH',
      country: 'United Arab Emirates',
      continentId: 'middle-east',
      region: 'Middle East',
      status: 'planned',
      latency: '-',
      datacenter: 'TBD',
      address: 'Fujairah, UAE',
      ixName: 'FJRIX',
      peers: 0,
      capacity: '-',
      portSpeeds: ['10G', '40G', '100G'],
      protocols: ['BGP-4', 'IPv4', 'IPv6'],
      features: [
        'Strategic cable landing',
        'MENA connectivity',
        'Submarine cable hub',
        'Enterprise networks',
        'Low-latency to Asia',
        'Coming soon'
      ],
      description: 'Upcoming submarine cable hub for Middle East and Asia connectivity.',
      established: 'Coming Soon',
      cityImage: '/assets/cities/fujairah.png'
    }
  ];

  // Use live locations from AdminContext (from database)
  // Fallback to hardcoded data only if admin context is empty
  const locations = adminLocations.length > 0 ? adminLocations : hardcodedLocations;

  // Use live continents from AdminContext
  const hardcodedContinents: ContinentData[] = [
    { id: 'asia', name: 'ASIA' },
    { id: 'middle-east', name: 'MIDDLE EAST' },
    { id: 'europe', name: 'EUROPE' },
    { id: 'north-america', name: 'NORTH AMERICA' },
    { id: 'south-america', name: 'SOUTH AMERICA' }
  ];

  const continents = adminContinents.length > 0
    ? adminContinents.map(c => ({ id: c.id, name: c.name.toUpperCase() }))
    : hardcodedContinents;

  // Handle pre-selected location and section from map navigation
  useEffect(() => {
    if (preSelectedLocation) {
      setSelectedLocation(preSelectedLocation);
      // Find the continent for this location and expand it
      const location = locations.find(l => l.id === preSelectedLocation);
      if (location) {
        setExpandedContinent(location.continentId);
      }
    }
    if (preSelectedSection) {
      if (preSelectedSection === 'asns') setActiveTab('asns');
      else if (preSelectedSection === 'sites') setActiveTab('sites');
      else setActiveTab('overview');
    }
  }, [preSelectedLocation, preSelectedSection, locations]);

  // Ensure a valid location is selected on load or when locations change
  useEffect(() => {
    if (locations.length > 0) {
      const currentExists = locations.find(l => l.id === selectedLocation);
      if (!currentExists) {
        setSelectedLocation(locations[0].id);
        setExpandedContinent(locations[0].continentId);
      }
    }
  }, [locations, selectedLocation]);

  // Add dark-nav class for navbar visibility
  useEffect(() => {
    document.body.classList.add('dark-nav');
    return () => {
      document.body.classList.remove('dark-nav');
    };
  }, []);

  // Fetch Grafana traffic data when Stats tab is active
  useEffect(() => {
    if (activeTab !== 'stats') return;

    const fetchGrafanaData = async () => {
      setGrafanaTraffic(prev => ({ ...prev, loading: true }));
      try {
        const result = await grafanaApi.getTraffic();
        if (result.success && result.data) {
          setGrafanaTraffic({
            peakTraffic: result.data.peakTraffic,
            avgTraffic: result.data.avgTraffic,
            isLive: result.data.source === 'grafana',
            loading: false,
          });
        } else {
          setGrafanaTraffic(prev => ({ ...prev, isLive: false, loading: false }));
        }
      } catch (error) {
        console.error('Failed to fetch Grafana data:', error);
        setGrafanaTraffic(prev => ({ ...prev, isLive: false, loading: false }));
      }
    };

    fetchGrafanaData();
    const interval = setInterval(fetchGrafanaData, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [activeTab]);

  const getCitiesInContinent = (continentId: string) => {
    return locations.filter(l => l.continentId === continentId);
  };

  const selectedLocationData = locations.find(loc => loc.id === selectedLocation);

  const toggleContinent = (continentId: string) => {
    if (expandedContinent === continentId) {
      setExpandedContinent('');
    } else {
      setExpandedContinent(continentId);
    }
  };

  const handleCityClick = (cityId: string) => {
    setSelectedLocation(cityId);
    // Scroll to top on mobile
    if (window.innerWidth < 1024) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section with Globe */}
      <section className="relative bg-black text-white overflow-hidden">
        {/* Carbon Fiber Texture */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>

        {/* Red Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#F20732]/20 via-transparent to-transparent"></div>

        <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10 pt-32 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text Content */}
            <div>
              {/* Header Badge */}
              <div className="inline-flex items-center gap-3 mb-6">
                <div className="w-2 h-2 rounded-full bg-[#F20732] animate-pulse"></div>
                <span className="font-mono text-xs font-bold tracking-[0.2em] text-[#F20732] uppercase">
                  Global Presence
                </span>
              </div>

              {/* Main Heading */}
              <h1 className="text-5xl md:text-7xl font-black leading-tight tracking-tighter mb-6">
                OUR GLOBAL <span className="text-[#F20732]">LOCATIONS</span>
              </h1>

              <p className="text-gray-300 text-lg leading-relaxed max-w-xl mb-8">
                Strategic Points of Presence across the globe, ensuring ultra-low latency
                and maximum uptime for your critical infrastructure.
              </p>

              {/* Stats Quick View */}
              <div className="grid grid-cols-3 gap-4">
                <div className="border-l-2 border-[#F20732] pl-4">
                  <div className="text-3xl font-light text-white tracking-tighter">
                    {locations.length}
                  </div>
                  <div className="text-xs text-gray-400 uppercase font-mono tracking-wider">
                    Cities
                  </div>
                </div>
                <div className="border-l-2 border-gray-700 pl-4">
                  <div className="text-3xl font-light text-white tracking-tighter">
                    4.4K
                  </div>
                  <div className="text-xs text-gray-400 uppercase font-mono tracking-wider">
                    Peers
                  </div>
                </div>
                <div className="border-l-2 border-gray-700 pl-4">
                  <div className="text-3xl font-light text-white tracking-tighter">
                    100 %
                  </div>
                  <div className="text-xs text-gray-400 uppercase font-mono tracking-wider">
                    Uptime
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Globe Image */}
            <div className="relative lg:absolute lg:right-0 lg:top-1/2 lg:-translate-y-1/2 lg:w-[45%]">
              <div className="relative">
                {/* Glow effect behind globe */}
                <div className="absolute inset-0 bg-[#F20732]/20 blur-3xl rounded-full scale-75"></div>

                {/* Globe Image */}
                <img
                  src="/assets/globe/globe_hero.png"
                  alt="Global Network"
                  className="relative w-full h-auto opacity-90 hover:opacity-100 transition-opacity duration-500"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content: Sidebar + Details Panel */}
      <section className="relative bg-gray-100">
        <div className="max-w-[1920px] mx-auto">
          <div className="flex flex-col lg:flex-row min-h-screen">
            {/* LEFT SIDEBAR - Continent/City Navigation */}
            <aside className="lg:w-96 bg-white border-r-2 border-gray-300 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto shadow-lg scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <div className="p-8 border-b-2 border-gray-200 bg-gradient-to-br from-white to-gray-50">
                <div className="inline-flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 bg-[#F20732] rounded-full"></div>
                  <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-[#F20732] uppercase">
                    Global Topology
                  </span>
                </div>
                <h2 className="text-4xl font-black text-black tracking-tight">
                  LOCATIONS
                </h2>
              </div>

              {/* Accordion Menu */}
              <nav className="py-4">
                {continents.map((continent) => {
                  const cities = getCitiesInContinent(continent.id);
                  const isExpanded = expandedContinent === continent.id;

                  return (
                    <div key={continent.id} className="border-b border-gray-100">
                      {/* Continent Header */}
                      <button
                        onClick={() => toggleContinent(continent.id)}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors group"
                      >
                        <span className="font-bold text-sm tracking-wide text-black group-hover:text-[#F20732] transition-colors">
                          {continent.name}
                        </span>
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* City List */}
                      {isExpanded && cities.length > 0 && (
                        <div className="bg-gray-50">
                          {cities.map((city) => (
                            <button
                              key={city.id}
                              onClick={() => handleCityClick(city.id)}
                              className={`w-full px-6 py-3 text-left flex items-center justify-between group hover:bg-black transition-all duration-300 border-l-2 ${selectedLocation === city.id
                                ? 'border-[#F20732] bg-black'
                                : 'border-transparent bg-gray-50'
                                }`}
                            >
                              <div className="flex-1">
                                <div className={`font-medium text-sm transition-colors ${selectedLocation === city.id
                                  ? 'text-white'
                                  : 'text-gray-700 group-hover:text-white'
                                  }`}>
                                  {city.name}
                                </div>
                                <div className={`font-mono text-[10px] mt-0.5 transition-colors ${selectedLocation === city.id
                                  ? 'text-gray-400'
                                  : 'text-gray-400 group-hover:text-gray-300'
                                  }`}>
                                  {city.country} // {city.latency}ms
                                </div>
                              </div>

                              {/* Active Badge */}
                              {city.status === 'active' && (
                                <span className="inline-block px-2 py-0.5 bg-[#F20732] text-white text-[9px] font-mono font-bold uppercase tracking-wider">
                                  ACTIVE
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </aside>

            {/* RIGHT PANEL - City Details */}
            <main className="flex-1 lg:min-h-screen bg-white lg:p-8">
              {selectedLocationData ? (
                <div className="animate-in fade-in duration-500 bg-white lg:shadow-xl lg:border-2 lg:border-gray-200">
                  {/* City Header */}
                  <div className="bg-black text-white px-8 py-12 border-b-4 border-[#F20732]">
                    <h2 className="text-5xl md:text-6xl font-black mb-3 tracking-tight">
                      {selectedLocationData.name}
                    </h2>
                    <div className="flex items-center gap-4">
                      <span className="text-[#F20732] font-bold text-xl tracking-wide">
                        {selectedLocationData.country}
                      </span>
                      <span className="text-gray-400 font-mono text-sm">
                        // {selectedLocationData.region}
                      </span>
                    </div>
                  </div>

                  {/* Stats Bar */}
                  <div className="bg-white border-b border-gray-200">
                    <div className="max-w-6xl mx-auto px-8 py-6">
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                        <div className="text-center p-3 md:border-r border-gray-100">
                          <div className="font-mono text-[10px] text-[#F20732] uppercase tracking-widest mb-1">
                            Connected Networks
                          </div>
                          <div className="text-xl font-bold text-black">
                            {selectedLocationData.peers}+
                          </div>
                        </div>
                        <div className="text-center p-3 md:border-r border-gray-100">
                          <div className="font-mono text-[10px] text-gray-500 uppercase tracking-widest mb-1">
                            IPv4 Routes
                          </div>
                          <div className="text-xl font-bold text-black">
                            {selectedLocationData.ipv4Routes || `${Math.round(selectedLocationData.peers * 2.4)}K`}
                          </div>
                        </div>
                        <div className="text-center p-3 md:border-r border-gray-100">
                          <div className="font-mono text-[10px] text-gray-500 uppercase tracking-widest mb-1">
                            IPv6 Routes
                          </div>
                          <div className="text-xl font-bold text-black">
                            {selectedLocationData.ipv6Routes || `${Math.round(selectedLocationData.peers * 0.6)}K`}
                          </div>
                        </div>
                        <div className="text-center p-3 md:border-r border-gray-100">
                          <div className="font-mono text-[10px] text-gray-500 uppercase tracking-widest mb-1">
                            Capacity
                          </div>
                          <div className="text-xl font-bold text-black">
                            {(() => {
                              const capacityStr = selectedLocationData.capacity;
                              // Extract numbers from string (e.g., "100+" -> "100", "10Tbps" -> "10")
                              const capacityNum = parseFloat(capacityStr.replace(/[^0-9.]/g, ''));
                              return isNaN(capacityNum) ? '0' : capacityNum;
                            })()} Tbps
                          </div>
                        </div>
                        <div className="text-center p-3 md:border-r border-gray-100">
                          <div className="font-mono text-[10px] text-gray-500 uppercase tracking-widest mb-1">
                            Peak Traffic
                          </div>
                          <div className="text-xl font-bold text-black">
                            {(() => {
                              const capacityStr = selectedLocationData.capacity;
                              const capacityNum = parseFloat(capacityStr.replace(/[^0-9.]/g, ''));
                              return isNaN(capacityNum) ? '0' : Math.round(capacityNum * 0.85);
                            })()} Tbps
                          </div>
                        </div>
                        <div className="text-center p-3">
                          <div className="font-mono text-[10px] text-gray-500 uppercase tracking-widest mb-1">
                            Uptime
                          </div>
                          <div className="text-xl font-bold text-[#00B341]">
                            {selectedLocationData.uptime || '100 %'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tab Navigation */}
                  <div className="bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700">
                    <div className="max-w-5xl mx-auto px-0 md:px-8">
                      <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide">
                        <button
                          onClick={() => setActiveTab('overview')}
                          className={`px-4 py-3 md:px-6 md:py-4 font-mono text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all duration-300 border-b-2 whitespace-nowrap flex-shrink-0 ${activeTab === 'overview'
                            ? 'text-white border-[#F20732] bg-black/30'
                            : 'text-gray-400 border-transparent hover:text-white hover:bg-black/20'
                            }`}
                        >
                          Overview
                        </button>
                        <button
                          onClick={() => setActiveTab('asns')}
                          className={`px-4 py-3 md:px-6 md:py-4 font-mono text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all duration-300 border-b-2 flex items-center gap-2 whitespace-nowrap flex-shrink-0 ${activeTab === 'asns'
                            ? 'text-white border-[#F20732] bg-black/30'
                            : 'text-gray-400 border-transparent hover:text-white hover:bg-black/20'
                            }`}
                        >
                          Connected Networks
                          <span className={`px-2 py-0.5 rounded text-[10px] ${activeTab === 'asns' ? 'bg-[#F20732]' : 'bg-gray-700'}`}>
                            {adminLocations.find(l => l.id === selectedLocationData.id)?.asnList?.length || 0}
                          </span>
                        </button>
                        <button
                          onClick={() => setActiveTab('sites')}
                          className={`px-4 py-3 md:px-6 md:py-4 font-mono text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all duration-300 border-b-2 flex items-center gap-2 whitespace-nowrap flex-shrink-0 ${activeTab === 'sites'
                            ? 'text-white border-[#F20732] bg-black/30'
                            : 'text-gray-400 border-transparent hover:text-white hover:bg-black/20'
                            }`}
                        >
                          Enabled Sites
                          <span className={`px-2 py-0.5 rounded text-[10px] ${activeTab === 'sites' ? 'bg-[#F20732]' : 'bg-gray-700'}`}>
                            {adminLocations.find(l => l.id === selectedLocationData.id)?.enabledSites?.length || 0}
                          </span>
                        </button>
                        <button
                          onClick={() => setActiveTab('pricing')}
                          className={`px-4 py-3 md:px-6 md:py-4 font-mono text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all duration-300 border-b-2 whitespace-nowrap flex-shrink-0 ${activeTab === 'pricing'
                            ? 'text-white border-[#F20732] bg-black/30'
                            : 'text-gray-400 border-transparent hover:text-white hover:bg-black/20'
                            }`}
                        >
                          Pricing
                        </button>

                        <button
                          onClick={() => setActiveTab('stats')}
                          className={`px-4 py-3 md:px-6 md:py-4 font-mono text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all duration-300 border-b-2 whitespace-nowrap flex-shrink-0 ${activeTab === 'stats'
                            ? 'text-white border-[#F20732] bg-black/30'
                            : 'text-gray-400 border-transparent hover:text-white hover:bg-black/20'
                            }`}
                        >
                          Stats
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Main Content - Tab Panels */}
                  <div className="max-w-5xl mx-auto px-8 py-12">

                    {/* OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                      <>
                        {/* Description */}
                        <div className="mb-12">
                          <p className="text-gray-700 text-lg leading-relaxed">
                            {selectedLocationData.description}
                          </p>
                        </div>

                        {/* Technical Specs */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                          {/* Port Speeds */}
                          <div>
                            <div className="flex items-center gap-3 mb-6">
                              <div className="w-1 h-8 bg-[#F20732]"></div>
                              <h3 className="text-xl font-black text-black">
                                Available Port Speeds
                              </h3>
                            </div>
                            <div className="flex flex-wrap gap-3">
                              {selectedLocationData.portSpeeds.map((speed) => (
                                <span
                                  key={speed}
                                  className="px-4 py-2 bg-white border-2 border-gray-200 font-mono text-sm font-bold text-black hover:border-[#F20732] transition-colors"
                                >
                                  {speed}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Protocols */}
                          <div>
                            <div className="flex items-center gap-3 mb-6">
                              <div className="w-1 h-8 bg-black"></div>
                              <h3 className="text-xl font-black text-black">
                                Supported Protocols
                              </h3>
                            </div>
                            <div className="flex flex-wrap gap-3">
                              {selectedLocationData.protocols.map((protocol) => (
                                <span
                                  key={protocol}
                                  className="px-4 py-2 bg-white border-2 border-gray-200 font-mono text-sm text-black"
                                >
                                  {protocol}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Key Features */}
                        <div className="bg-white p-8 shadow-sm border border-gray-200 mb-12">
                          <h3 className="text-2xl font-black text-black mb-6">
                            Key Features
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {selectedLocationData.features.map((feature, idx) => (
                              <div key={idx} className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-[#F20732] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="text-gray-700 text-sm leading-relaxed">
                                  {feature}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* CONNECTED NETWORKS TAB (ASNs) */}
                    {activeTab === 'asns' && adminLocations.find(l => l.id === selectedLocationData.id)?.asnList && (
                      <>
                        {/* ASN Statistics */}
                        <div className="bg-gradient-to-r from-gray-900 to-black text-white p-8 mb-12 rounded-lg">
                          <h3 className="text-2xl font-black mb-6 flex items-center gap-3">
                            <div className="w-1 h-8 bg-[#F20732]"></div>
                            Connected Networks
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white/10 p-6 rounded-lg border-l-4 border-[#F20732]">
                              <div className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-2">Active ASNs</div>
                              <div className="text-5xl font-light text-white">
                                {adminLocations.find(l => l.id === selectedLocationData.id)?.asnList.filter(a => a.status === 'ACTIVE').length || 0}
                              </div>
                            </div>
                            <div className="bg-white/10 p-6 rounded-lg border-l-4 border-gray-300">
                              <div className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-2">Connecting ASNs</div>
                              <div className="text-5xl font-light text-white">
                                {adminLocations.find(l => l.id === selectedLocationData.id)?.asnList.filter(a => a.status === 'CONNECTING').length || 0}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* ASN Table */}
                        <div className="bg-white p-8 shadow-sm border border-gray-200 mb-12">
                          <div className="flex items-center justify-between mb-6">
                            <h3 className="text-2xl font-black text-black">Network ASNs</h3>
                            <input
                              type="text"
                              placeholder="Search ASN or name..."
                              value={asnSearch}
                              onChange={(e) => setASNSearch(e.target.value)}
                              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#F20732] font-mono text-sm"
                            />
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="bg-gray-100 border-b-2 border-gray-300">
                                  <th className="text-left px-4 py-3 font-mono text-xs uppercase tracking-wider text-gray-700">ASN</th>
                                  <th className="text-left px-4 py-3 font-mono text-xs uppercase tracking-wider text-gray-700">Name</th>
                                  <th className="text-left px-4 py-3 font-mono text-xs uppercase tracking-wider text-gray-700">Peering Policy</th>
                                  <th className="text-left px-4 py-3 font-mono text-xs uppercase tracking-wider text-gray-700">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {adminLocations.find(l => l.id === selectedLocationData.id)?.asnList
                                  .filter(asn =>
                                    asnSearch === '' ||
                                    asn.asnNumber.toString().includes(asnSearch) ||
                                    asn.name.toLowerCase().includes(asnSearch.toLowerCase())
                                  )
                                  .map((asn, idx) => (
                                    <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                                      <td className="px-4 py-4 font-mono font-bold text-black">AS{asn.asnNumber}</td>
                                      <td className="px-4 py-4 text-gray-700">{asn.name}</td>
                                      <td className="px-4 py-4">
                                        <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-mono rounded">
                                          {asn.peeringPolicy}
                                        </span>
                                      </td>
                                      <td className="px-4 py-4">
                                        <span className={`px-3 py-1 text-xs font-bold rounded ${asn.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                                          asn.status === 'CONNECTING' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-gray-100 text-gray-700'
                                          }`}>
                                          {asn.status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    )}

                    {/* ENABLED SITES TAB */}
                    {activeTab === 'sites' && adminLocations.find(l => l.id === selectedLocationData.id)?.enabledSites && (
                      <div className="bg-white p-8 shadow-sm border border-gray-200 mb-12">
                        <h3 className="text-2xl font-black text-black mb-6 flex items-center gap-3">
                          <div className="w-1 h-8 bg-[#F20732]"></div>
                          Enabled Data Centers
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {adminLocations.find(l => l.id === selectedLocationData.id)?.enabledSites.map((site) => (
                            <div key={site.id} className="border-2 border-gray-200 p-6 hover:border-[#F20732] transition-all duration-300 group">
                              <div className="flex items-start justify-between mb-4">
                                <div>
                                  <h4 className="text-lg font-black text-black group-hover:text-[#F20732] transition-colors">
                                    {site.name}
                                  </h4>
                                  <div className="text-sm font-mono text-gray-500 mt-1">{site.provider}</div>
                                </div>
                                <span className={`px-3 py-1 text-xs font-bold rounded ${site.status === 'available' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                                  }`}>
                                  {site.status === 'available' ? 'AVAILABLE' : 'COMING SOON'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mb-4">{site.address}</p>
                              <button
                                onClick={() => {
                                  const cityName = selectedLocationData.name.charAt(0) + selectedLocationData.name.slice(1).toLowerCase();
                                  window.dispatchEvent(new CustomEvent('navigateToContact', {
                                    detail: { city: cityName, locationId: selectedLocationData.id, site: site.name }
                                  }));
                                }}
                                className="w-full bg-black text-white px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider hover:bg-[#F20732] transition-colors flex items-center justify-center gap-2"
                                disabled={site.status !== 'available'}
                              >
                                {site.status === 'available' ? 'Get Connected' : 'Notify Me'}
                                <span>→</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* PRICING TAB */}
                    {activeTab === 'pricing' && (
                      <div className="space-y-8">
                        <div className="flex items-center gap-3">
                          <div className="w-1 h-8 bg-[#F20732]"></div>
                          <h3 className="text-2xl font-black text-black">
                            Port Pricing - {selectedLocationData.name}
                          </h3>
                        </div>

                        {selectedLocationData.pricing && selectedLocationData.pricing.length > 0 ? (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {selectedLocationData.pricing.map((priceTier, idx) => (
                                <div key={idx} className="bg-white border-2 border-gray-200 hover:border-[#F20732] p-6 hover:shadow-lg transition-all duration-300">
                                  <div className="font-mono text-xs text-gray-500 uppercase tracking-widest mb-2">Port Speed</div>
                                  <div className="text-4xl font-black text-black mb-4">{priceTier.portSpeed}</div>
                                  <div className="space-y-2 mb-6">
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-600">Setup Fee</span>
                                      <span className="font-bold">
                                        {priceTier.setupFee > 0
                                          ? `${priceTier.currency || 'USD'} ${priceTier.setupFee.toLocaleString()}`
                                          : 'Free'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-600">Monthly</span>
                                      <span className="font-bold">
                                        {priceTier.monthlyPrice > 0
                                          ? `${priceTier.currency || 'USD'} ${priceTier.monthlyPrice.toLocaleString()}/mo`
                                          : 'Contact Us'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-600">Commitment</span>
                                      <span className="font-bold">No Lock In</span>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => {
                                      const cityName = selectedLocationData.name.charAt(0) + selectedLocationData.name.slice(1).toLowerCase();
                                      window.dispatchEvent(new CustomEvent('navigateToContact', {
                                        detail: { city: cityName, locationId: selectedLocationData.id }
                                      }));
                                    }}
                                    className="w-full py-3 bg-black text-white hover:bg-[#F20732] font-mono text-xs font-bold uppercase tracking-wider transition-colors"
                                  >
                                    Get Quote
                                  </button>
                                </div>
                              ))}
                            </div>

                            <div className="bg-gray-50 p-6 border border-gray-200">
                              <p className="text-sm text-gray-600">
                                * Prices are indicative and may vary based on location, commitment period, and volume discounts.
                                Contact our sales team for a customized quote.
                              </p>
                            </div>
                          </>
                        ) : (
                          <div className="bg-gray-50 p-8 border border-gray-200 text-center">
                            <p className="text-gray-600 mb-4">Pricing information is not yet available for this location.</p>
                            <button
                              onClick={() => {
                                const cityName = selectedLocationData.name.charAt(0) + selectedLocationData.name.slice(1).toLowerCase();
                                window.dispatchEvent(new CustomEvent('navigateToContact', {
                                  detail: { city: cityName, locationId: selectedLocationData.id }
                                }));
                              }}
                              className="px-6 py-3 bg-[#F20732] text-white hover:bg-black font-mono text-xs font-bold uppercase tracking-wider transition-colors"
                            >
                              Contact Sales
                            </button>
                          </div>
                        )}
                      </div>
                    )}



                    {/* STATS TAB */}
                    {activeTab === 'stats' && (
                      <div className="space-y-8">
                        <div className="flex items-center gap-3">
                          <div className="w-1 h-8 bg-[#F20732]"></div>
                          <h3 className="text-2xl font-black text-black">
                            Traffic Statistics - {selectedLocationData.name}
                          </h3>
                          {grafanaTraffic.isLive && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-green-100 rounded-full">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                              <span className="text-xs font-mono font-bold text-green-700 uppercase">Live</span>
                            </div>
                          )}
                        </div>

                        {/* Stats Overview */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                          <div className="bg-white p-6 border-l-4 border-[#F20732] shadow-sm">
                            <div className="font-mono text-[10px] text-gray-500 uppercase tracking-widest mb-2">Peak Traffic</div>
                            {grafanaTraffic.loading ? (
                              <div className="text-3xl font-light text-gray-400 animate-pulse">Loading...</div>
                            ) : (
                              <>
                                <div className="text-3xl font-light text-black">
                                  {grafanaTraffic.isLive
                                    ? grafanaTraffic.peakTraffic
                                    : Math.round(parseFloat(selectedLocationData.capacity) * 0.85)
                                  }
                                  <span className="text-lg"> Tbps</span>
                                </div>
                                {!grafanaTraffic.isLive && (
                                  <div className="text-xs text-gray-400 mt-1">Calculated</div>
                                )}
                              </>
                            )}
                          </div>
                          <div className="bg-white p-6 border-l-4 border-black shadow-sm">
                            <div className="font-mono text-[10px] text-gray-500 uppercase tracking-widest mb-2">Avg Traffic</div>
                            {grafanaTraffic.loading ? (
                              <div className="text-3xl font-light text-gray-400 animate-pulse">Loading...</div>
                            ) : (
                              <>
                                <div className="text-3xl font-light text-black">
                                  {grafanaTraffic.isLive
                                    ? grafanaTraffic.avgTraffic
                                    : Math.round(parseFloat(selectedLocationData.capacity) * 0.55)
                                  }
                                  <span className="text-lg"> Tbps</span>
                                </div>
                                {!grafanaTraffic.isLive && (
                                  <div className="text-xs text-gray-400 mt-1">Calculated</div>
                                )}
                              </>
                            )}
                          </div>
                          <div className="bg-white p-6 border-l-4 border-gray-300 shadow-sm">
                            <div className="font-mono text-[10px] text-gray-500 uppercase tracking-widest mb-2">IPv4 Prefixes</div>
                            <div className="text-3xl font-light text-black">{Math.round(selectedLocationData.peers * 2.4)}<span className="text-lg">K</span></div>
                          </div>
                          <div className="bg-white p-6 border-l-4 border-gray-300 shadow-sm">
                            <div className="font-mono text-[10px] text-gray-500 uppercase tracking-widest mb-2">IPv6 Prefixes</div>
                            <div className="text-3xl font-light text-black">{Math.round(selectedLocationData.peers * 0.6)}<span className="text-lg">K</span></div>
                          </div>
                        </div>

                        {/* Traffic Breakdown */}
                        <div className="bg-white p-8 border border-gray-200">
                          <h4 className="font-black text-lg text-black mb-6">Traffic Breakdown by Category</h4>
                          <div className="space-y-4">
                            {[
                              { label: 'Content Delivery', percent: 42 },
                              { label: 'Cloud Providers', percent: 28 },
                              { label: 'Enterprise', percent: 18 },
                              { label: 'Gaming & Streaming', percent: 12 }
                            ].map((item) => (
                              <div key={item.label}>
                                <div className="flex justify-between text-sm mb-2">
                                  <span className="text-gray-700">{item.label}</span>
                                  <span className="font-bold">{item.percent}%</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-[#F20732] transition-all duration-500"
                                    style={{ width: `${item.percent}%` }}
                                  ></div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Uptime History */}
                        <div className="bg-white p-8 border border-gray-200">
                          <div className="flex items-center justify-between mb-6">
                            <h4 className="font-black text-lg text-black">Uptime History (Last 12 Months)</h4>
                            <span className="px-3 py-1 bg-green-100 text-green-700 font-mono text-xs font-bold rounded">99.99% SLA</span>
                          </div>
                          <div className="flex gap-1">
                            {Array.from({ length: 12 }).map((_, idx) => (
                              <div
                                key={idx}
                                className="flex-1 h-12 bg-green-500 rounded-sm hover:bg-green-600 transition-colors cursor-pointer"
                                title={`Month ${idx + 1}: 99.99% uptime`}
                              ></div>
                            ))}
                          </div>
                          <div className="flex justify-between mt-2 text-xs text-gray-500 font-mono">
                            <span>Jan</span>
                            <span>Dec</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-4 mt-8">
                      <button
                        onClick={() => {
                          // Navigate to contact page - will be handled by App.tsx setPage
                          // Convert city name to Title Case (e.g., "TOKYO" -> "Tokyo")
                          const cityName = selectedLocationData.name.charAt(0) + selectedLocationData.name.slice(1).toLowerCase();
                          window.dispatchEvent(new CustomEvent('navigateToContact', {
                            detail: { city: cityName, locationId: selectedLocationData.id }
                          }));
                        }}
                        className="bg-[#F20732] text-white px-8 py-4 font-mono text-xs font-bold uppercase tracking-widest hover:bg-black transition-all duration-300 flex items-center gap-3 group shadow-lg"
                      >
                        Request Port
                        <span className="group-hover:translate-x-1 transition-transform">→</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center">
                    <div className="text-gray-400 mb-4">
                      <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 font-mono text-sm">
                      Select a location from the menu
                    </p>
                  </div>
                </div>
              )}
            </main>
          </div>
        </div>
      </section>

      {/* Stats Footer */}
      <section className="relative bg-black py-24">
        {/* Carbon Fiber Texture */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5"></div>

        <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Cities POPs */}
            <div className="bg-[#0a0a0a] border-2 border-[#1a1a1a] p-10 text-center hover:border-[#F20732] transition-all duration-500 group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#F20732]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10">
                <div className="text-6xl md:text-7xl font-light tracking-tighter text-white mb-3 group-hover:text-[#F20732] transition-colors duration-300">
                  {locations.length}
                </div>
                <div className="h-px w-12 bg-[#F20732] mx-auto mb-3"></div>
                <div className="font-mono text-[10px] text-gray-400 uppercase tracking-[0.2em] group-hover:text-gray-300 transition-colors">
                  Cities POPs
                </div>
              </div>
            </div>

            {/* Total Peers */}
            <div className="bg-[#0a0a0a] border-2 border-[#1a1a1a] p-10 text-center hover:border-[#F20732] transition-all duration-500 group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#F20732]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10">
                <div className="text-6xl md:text-7xl font-light tracking-tighter text-white mb-3 group-hover:text-[#F20732] transition-colors duration-300">
                  4,410
                </div>
                <div className="h-px w-12 bg-[#F20732] mx-auto mb-3"></div>
                <div className="font-mono text-[10px] text-gray-400 uppercase tracking-[0.2em] group-hover:text-gray-300 transition-colors">
                  Total Peers
                </div>
              </div>
            </div>

            {/* Uptime */}
            <div className="bg-[#0a0a0a] border-2 border-[#1a1a1a] p-10 text-center hover:border-[#F20732] transition-all duration-500 group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#F20732]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10">
                <div className="text-6xl md:text-7xl font-light tracking-tighter text-white mb-3 group-hover:text-[#F20732] transition-colors duration-300">
                  99.99%
                </div>
                <div className="h-px w-12 bg-[#F20732] mx-auto mb-3"></div>
                <div className="font-mono text-[10px] text-gray-400 uppercase tracking-[0.2em] group-hover:text-gray-300 transition-colors">
                  Uptime SLA
                </div>
              </div>
            </div>

            {/* Support */}
            <div className="bg-[#0a0a0a] border-2 border-[#1a1a1a] p-10 text-center hover:border-[#F20732] transition-all duration-500 group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#F20732]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10">
                <div className="text-6xl md:text-7xl font-light tracking-tighter text-white mb-3 group-hover:text-[#F20732] transition-colors duration-300">
                  24/7
                </div>
                <div className="h-px w-12 bg-[#F20732] mx-auto mb-3"></div>
                <div className="font-mono text-[10px] text-gray-400 uppercase tracking-[0.2em] group-hover:text-gray-300 transition-colors">
                  Support
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LocationsPage;
