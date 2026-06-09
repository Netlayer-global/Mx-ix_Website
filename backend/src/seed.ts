import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Service } from './models/service.model';
import { Continent } from './models/continent.model';
import { Location } from './models/location.model';
import { ContactInfo } from './models/contactInfo.model';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mx-ix';

// Continents
const continents = [
  { id: 'asia', name: 'Asia', order: 1 },
  { id: 'middle-east', name: 'Middle East', order: 2 },
  { id: 'europe', name: 'Europe', order: 3 },
  { id: 'north-america', name: 'North America', order: 4 },
  { id: 'south-america', name: 'South America', order: 5 },
];

// Locations
const locations = [
  // ASIA - India
  {
    id: 'new-delhi',
    name: 'New Delhi',
    code: 'DEL',
    city: 'New Delhi',
    country: 'India',
    region: 'ASIA',
    continentId: 'asia',
    coordinates: [77.2090, 28.6139],
    facilities: ['NTT Delhi DC', 'STT Delhi 1', 'CtrlS Noida'],
    asnList: [
      { asnNumber: 9498, name: 'Bharti Airtel Ltd.', peeringPolicy: 'Selective', status: 'ACTIVE' },
      { asnNumber: 4755, name: 'Tata Communications Ltd', peeringPolicy: 'Open', status: 'ACTIVE' },
      { asnNumber: 45820, name: 'BSNL - Bharat Sanchar Nigam Ltd.', peeringPolicy: 'Open', status: 'ACTIVE' },
      { asnNumber: 17488, name: 'Hathway Cable and Datacom Ltd.', peeringPolicy: 'Open', status: 'CONNECTING' },
      { asnNumber: 55836, name: 'Reliance Jio Infocomm Limited', peeringPolicy: 'Selective', status: 'ACTIVE' },
    ],
    enabledSites: [
      { id: 'ntt-delhi-dc', name: 'NTT Delhi DC', provider: 'NTT', address: 'Sector 142, Noida, Uttar Pradesh 201304', status: 'available' },
      { id: 'stt-delhi-1', name: 'STT Delhi 1', provider: 'STT GDC', address: 'Mahipalpur Extension, New Delhi 110037', status: 'available' },
      { id: 'ctrls-noida', name: 'CtrlS Noida', provider: 'CtrlS', address: 'Knowledge Park III, Greater Noida 201306', status: 'available' },
      { id: 'netmagic-delhi-dc', name: 'Netmagic Delhi DC', provider: 'Netmagic', address: 'Sector 62, Noida, UP 201309', status: 'available' },
      { id: 'yotta-noida', name: 'Yotta Noida', provider: 'Yotta', address: 'Greater Noida, UP 201306', status: 'coming-soon' },
    ],
    pricingTiers: [
      { speed: '1G', setupFee: 0, monthlyFee: 0 },
      { speed: '10G', setupFee: 0, monthlyFee: 0 },
      { speed: '100G', setupFee: 0, monthlyFee: 0 },
    ],
    routeServers: [
      { name: 'RS1', asn: '49378', ipv4: '206.72.210.10', ipv6: '2001:de8:4::4:9378:1' },
      { name: 'RS2', asn: '49378', ipv4: '206.72.210.11', ipv6: '2001:de8:4::4:9378:2' },
    ],
    peers: 320,
    capacity: '150+ Tbps',
    uptime: '99.99%',
    portSpeeds: ['1G', '10G', '40G', '100G'],
    protocols: ['BGP-4', 'IPv4', 'IPv6', 'MPLS'],
    features: ['North India gateway', 'Government connectivity hub', 'Enterprise connectivity', 'Multi-cloud access', 'Low-latency trading', 'Carrier-dense location'],
    description: 'Strategic hub serving North India\'s enterprise and government networks.',
    latency: '1.6',
  },
  {
    id: 'mumbai',
    name: 'Mumbai',
    code: 'BOM',
    city: 'Mumbai',
    country: 'India',
    region: 'ASIA',
    continentId: 'asia',
    coordinates: [72.8777, 19.0760],
    facilities: ['GPX Mumbai', 'Netmagic Mumbai'],
    asnList: [
      { asnNumber: 9498, name: 'Bharti Airtel Ltd.', peeringPolicy: 'Selective', status: 'ACTIVE' },
      { asnNumber: 4755, name: 'Tata Communications Ltd', peeringPolicy: 'Open', status: 'ACTIVE' },
    ],
    enabledSites: [
      { id: 'gpx-mumbai', name: 'GPX Mumbai', provider: 'GPX', address: 'Lower Parel, Mumbai 400013', status: 'available' },
    ],
    pricingTiers: [
      { speed: '1G', setupFee: 0, monthlyFee: 0 },
      { speed: '10G', setupFee: 0, monthlyFee: 0 },
    ],
    routeServers: [
      { name: 'RS1', asn: '49378', ipv4: '103.27.170.1', ipv6: '2405:6e00:30c0::1' },
      { name: 'RS2', asn: '49378', ipv4: '103.27.170.2', ipv6: '2405:6e00:30c0::2' },
    ],
    peers: 280,
    capacity: '120+ Tbps',
    uptime: '99.98%',
    portSpeeds: ['1G', '10G', '40G', '100G'],
    protocols: ['BGP-4', 'IPv4', 'IPv6'],
    features: ['Financial services hub', 'Media and entertainment connectivity', 'Cloud provider gateway', 'Stock exchange access', 'Banking sector connectivity', 'Multi-carrier ecosystem'],
    description: 'India\'s financial capital and major peering hub.',
    latency: '1.8',
  },
  {
    id: 'chennai',
    name: 'Chennai',
    code: 'MAA',
    city: 'Chennai',
    country: 'India',
    region: 'ASIA',
    continentId: 'asia',
    coordinates: [80.2707, 13.0827],
    facilities: ['CtrlS Chennai'],
    asnList: [
      { asnNumber: 4755, name: 'Tata Communications Ltd', peeringPolicy: 'Open', status: 'ACTIVE' },
    ],
    enabledSites: [
      { id: 'ctrls-chennai', name: 'CtrlS Chennai', provider: 'CtrlS', address: 'Ambattur, Chennai 600098', status: 'available' },
    ],
    pricingTiers: [
      { speed: '1G', setupFee: 0, monthlyFee: 0 },
      { speed: '10G', setupFee: 0, monthlyFee: 0 },
    ],
    routeServers: [
      { name: 'RS1', asn: '49378', ipv4: '103.27.171.1', ipv6: '2405:6e00:30c1::1' },
      { name: 'RS2', asn: '49378', ipv4: '103.27.171.2', ipv6: '2405:6e00:30c1::2' },
    ],
    peers: 180,
    capacity: '80+ Tbps',
    uptime: '99.95%',
    portSpeeds: ['1G', '10G', '40G'],
    protocols: ['BGP-4', 'IPv4', 'IPv6'],
    features: ['South India gateway', 'IT corridor access', 'Submarine cable landing', 'International bandwidth hub', 'Manufacturing sector connectivity', 'Automotive industry access'],
    description: 'Key hub for South India and international connectivity.',
    latency: '2.0',
  },
  {
    id: 'kolkata',
    name: 'Kolkata',
    code: 'CCU',
    city: 'Kolkata',
    country: 'India',
    region: 'ASIA',
    continentId: 'asia',
    coordinates: [88.3639, 22.5726],
    facilities: ['Netmagic Kolkata'],
    asnList: [
      { asnNumber: 45820, name: 'BSNL - Bharat Sanchar Nigam Ltd.', peeringPolicy: 'Open', status: 'ACTIVE' },
    ],
    enabledSites: [
      { id: 'netmagic-kolkata', name: 'Netmagic Kolkata', provider: 'Netmagic', address: 'Salt Lake, Kolkata 700091', status: 'available' },
    ],
    pricingTiers: [
      { speed: '1G', setupFee: 0, monthlyFee: 0 },
      { speed: '10G', setupFee: 0, monthlyFee: 0 },
    ],
    routeServers: [
      { name: 'RS1', asn: '49378', ipv4: '103.27.172.1', ipv6: '2405:6e00:30c2::1' },
      { name: 'RS2', asn: '49378', ipv4: '103.27.172.2', ipv6: '2405:6e00:30c2::2' },
    ],
    peers: 120,
    capacity: '50+ Tbps',
    uptime: '99.92%',
    portSpeeds: ['1G', '10G'],
    protocols: ['BGP-4', 'IPv4', 'IPv6'],
    features: ['East India gateway', 'Bangladesh connectivity', 'Government networks', 'Regional carrier hub', 'Cross-border traffic exchange', 'Educational institutions access'],
    description: 'Strategic location for Eastern India and Bangladesh connectivity.',
    latency: '2.2',
  },
  {
    id: 'hyderabad',
    name: 'Hyderabad',
    code: 'HYD',
    city: 'Hyderabad',
    country: 'India',
    region: 'ASIA',
    continentId: 'asia',
    coordinates: [78.4867, 17.3850],
    facilities: ['CtrlS Hyderabad'],
    asnList: [
      { asnNumber: 55836, name: 'Reliance Jio Infocomm Limited', peeringPolicy: 'Selective', status: 'ACTIVE' },
    ],
    enabledSites: [
      { id: 'ctrls-hyderabad', name: 'CtrlS Hyderabad', provider: 'CtrlS', address: 'HITEC City, Hyderabad 500081', status: 'available' },
    ],
    pricingTiers: [
      { speed: '1G', setupFee: 0, monthlyFee: 0 },
      { speed: '10G', setupFee: 0, monthlyFee: 0 },
    ],
    routeServers: [
      { name: 'RS1', asn: '49378', ipv4: '103.27.173.1', ipv6: '2405:6e00:30c3::1' },
      { name: 'RS2', asn: '49378', ipv4: '103.27.173.2', ipv6: '2405:6e00:30c3::2' },
    ],
    peers: 150,
    capacity: '60+ Tbps',
    uptime: '99.96%',
    portSpeeds: ['1G', '10G', '40G'],
    protocols: ['BGP-4', 'IPv4', 'IPv6'],
    features: ['IT/ITES hub', 'Hyperscale DC connectivity', 'Central India gateway', 'Pharmaceutical sector access', 'Biotech industry connectivity', 'Research institutions network'],
    description: 'Emerging tech hub with strong hyperscale presence.',
    latency: '1.9',
  },
  {
    id: 'bangalore',
    name: 'Bangalore',
    code: 'BLR',
    city: 'Bangalore',
    country: 'India',
    region: 'ASIA',
    continentId: 'asia',
    coordinates: [77.5946, 12.9716],
    facilities: ['GPX Bangalore'],
    asnList: [
      { asnNumber: 9498, name: 'Bharti Airtel Ltd.', peeringPolicy: 'Selective', status: 'ACTIVE' },
    ],
    enabledSites: [
      { id: 'gpx-bangalore', name: 'GPX Bangalore', provider: 'GPX', address: 'Whitefield, Bangalore 560066', status: 'available' },
    ],
    pricingTiers: [
      { speed: '1G', setupFee: 0, monthlyFee: 0 },
      { speed: '10G', setupFee: 0, monthlyFee: 0 },
    ],
    routeServers: [
      { name: 'RS1', asn: '49378', ipv4: '103.27.174.1', ipv6: '2405:6e00:30c4::1' },
      { name: 'RS2', asn: '49378', ipv4: '103.27.174.2', ipv6: '2405:6e00:30c4::2' },
    ],
    peers: 200,
    capacity: '90+ Tbps',
    uptime: '99.97%',
    portSpeeds: ['1G', '10G', '40G', '100G'],
    protocols: ['BGP-4', 'IPv4', 'IPv6'],
    features: ['Silicon Valley of India', 'Startup ecosystem', 'Cloud provider hub', 'R&D center access', 'Tech giant connectivity', 'Innovation corridor', 'SaaS company presence'],
    description: 'India\'s tech capital with extensive cloud connectivity.',
    latency: '1.7',
  },

  // MIDDLE EAST
  {
    id: 'dubai',
    name: 'Dubai',
    code: 'DXB',
    city: 'Dubai',
    country: 'United Arab Emirates',
    region: 'MIDDLE EAST',
    continentId: 'middle-east',
    coordinates: [55.2708, 25.2048],
    facilities: ['Equinix DX1'],
    asnList: [
      { asnNumber: 5384, name: 'Emirates Telecommunications Corporation', peeringPolicy: 'Selective', status: 'ACTIVE' },
    ],
    enabledSites: [
      { id: 'equinix-dx1', name: 'Equinix DX1', provider: 'Equinix', address: 'Dubai Internet City', status: 'available' },
    ],
    pricingTiers: [
      { speed: '1G', setupFee: 0, monthlyFee: 0 },
      { speed: '10G', setupFee: 0, monthlyFee: 0 },
    ],
    routeServers: [
      { name: 'RS1', asn: '49378', ipv4: '185.1.100.1', ipv6: '2001:7f8:61::1' },
      { name: 'RS2', asn: '49378', ipv4: '185.1.100.2', ipv6: '2001:7f8:61::2' },
    ],
    peers: 250,
    capacity: '100+ Tbps',
    uptime: '99.99%',
    portSpeeds: ['1G', '10G', '40G', '100G'],
    protocols: ['BGP-4', 'IPv4', 'IPv6'],
    features: ['Middle East hub', 'Africa gateway', 'Financial services', 'Free zone access', 'Regional content hub', 'Smart city infrastructure', 'E-commerce connectivity'],
    description: 'Strategic Middle East hub connecting Asia, Europe, and Africa.',
    latency: '1.4',
  },
  {
    id: 'fujairah',
    name: 'Fujairah',
    code: 'FJR',
    city: 'Fujairah',
    country: 'United Arab Emirates', 
    region: 'MIDDLE EAST',
    continentId: 'middle-east',
    coordinates: [56.3264, 25.1164],
    facilities: ['Fujairah DC'],
    asnList: [
      { asnNumber: 5384, name: 'Emirates Telecommunications Corporation', peeringPolicy: 'Selective', status: 'ACTIVE' },
    ],
    enabledSites: [
      { id: 'fujairah-dc', name: 'Fujairah DC', provider: 'Local', address: 'Fujairah Free Zone', status: 'available' },
    ],
    pricingTiers: [
      { speed: '1G', setupFee: 0, monthlyFee: 0 },
      { speed: '10G', setupFee: 0, monthlyFee: 0 },
    ],
    routeServers: [
      { name: 'RS1', asn: '49378', ipv4: '185.1.101.1', ipv6: '2001:7f8:62::1' },
      { name: 'RS2', asn: '49378', ipv4: '185.1.101.2', ipv6: '2001:7f8:62::2' },
    ],
    peers: 100,
    capacity: '40+ Tbps',
    uptime: '99.95%',
    portSpeeds: ['1G', '10G', '40G'],
    protocols: ['BGP-4', 'IPv4', 'IPv6'],
    features: ['Submarine cable hub', 'East-West gateway', 'Strategic location', 'Cable landing station', 'Low-latency routes', 'Diverse path options', 'Maritime connectivity'],
    description: 'Major submarine cable landing point for East-West traffic.',
    latency: '1.5',
  },

  // EUROPE
  {
    id: 'vienna',
    name: 'Vienna',
    code: 'VIE',
    city: 'Vienna',
    country: 'Austria',
    region: 'EUROPE',
    continentId: 'europe',
    coordinates: [16.3738, 48.2082],
    facilities: ['Interxion VIE1'],
    asnList: [
      { asnNumber: 1853, name: 'A1 Telekom Austria AG', peeringPolicy: 'Open', status: 'ACTIVE' },
    ],
    enabledSites: [
      { id: 'interxion-vie1', name: 'Interxion VIE1', provider: 'Interxion', address: 'Vienna, Austria', status: 'available' },
    ],
    pricingTiers: [
      { speed: '1G', setupFee: 0, monthlyFee: 0 },
      { speed: '10G', setupFee: 0, monthlyFee: 0 },
    ],
    routeServers: [
      { name: 'RS1', asn: '49378', ipv4: '194.126.200.1', ipv6: '2001:7f8:1e::1' },
      { name: 'RS2', asn: '49378', ipv4: '194.126.200.2', ipv6: '2001:7f8:1e::2' },
    ],
    peers: 180,
    capacity: '80+ Tbps',
    uptime: '99.98%',
    portSpeeds: ['1G', '10G', '40G', '100G'],
    protocols: ['BGP-4', 'IPv4', 'IPv6'],
    features: ['Central European hub', 'CEE gateway', 'Neutral location', 'Financial district access', 'UN organization connectivity', 'Cultural institutions network', 'Business district proximity'],
    description: 'Strategic location connecting Western and Eastern Europe.',
    latency: '1.2',
  },

  // NORTH AMERICA
  {
    id: 'los-angeles',
    name: 'Los Angeles',
    code: 'LAX',
    city: 'Los Angeles',
    country: 'United States',
    region: 'NORTH AMERICA',
    continentId: 'north-america',
    coordinates: [-118.2437, 34.0522],
    facilities: ['CoreSite LA1', 'One Wilshire'],
    asnList: [
      { asnNumber: 3356, name: 'Level 3 Parent, LLC', peeringPolicy: 'Selective', status: 'ACTIVE' },
    ],
    enabledSites: [
      { id: 'coresite-la1', name: 'CoreSite LA1', provider: 'CoreSite', address: 'Los Angeles, CA', status: 'available' },
    ],
    pricingTiers: [
      { speed: '1G', setupFee: 0, monthlyFee: 0 },
      { speed: '10G', setupFee: 0, monthlyFee: 0 },
    ],
    routeServers: [
      { name: 'RS1', asn: '49378', ipv4: '206.41.110.1', ipv6: '2001:504:0:2::1' },
      { name: 'RS2', asn: '49378', ipv4: '206.41.110.2', ipv6: '2001:504:0:2::2' },
    ],
    peers: 220,
    capacity: '120+ Tbps',
    uptime: '99.99%',
    portSpeeds: ['1G', '10G', '40G', '100G'],
    protocols: ['BGP-4', 'IPv4', 'IPv6'],
    features: ['Pacific gateway', 'Content hub', 'Media services', 'Entertainment industry access', 'Streaming platforms', 'Gaming companies', 'Asia-Pacific connectivity', 'Latin America bridge'],
    description: 'Major West Coast hub with extensive content provider presence.',
    latency: '0.8',
  },
  {
    id: 'silicon-valley',
    name: 'Silicon Valley',
    code: 'SJC',
    city: 'San Jose',
    country: 'United States',
    region: 'NORTH AMERICA',
    continentId: 'north-america',
    coordinates: [-121.8863, 37.3382],
    facilities: ['Equinix SV1', 'Digital Realty SJC'],
    asnList: [
      { asnNumber: 15169, name: 'Google LLC', peeringPolicy: 'Selective', status: 'ACTIVE' },
    ],
    enabledSites: [
      { id: 'equinix-sv1', name: 'Equinix SV1', provider: 'Equinix', address: 'San Jose, CA', status: 'available' },
    ],
    pricingTiers: [
      { speed: '1G', setupFee: 0, monthlyFee: 0 },
      { speed: '10G', setupFee: 0, monthlyFee: 0 },
    ],
    routeServers: [
      { name: 'RS1', asn: '49378', ipv4: '206.197.187.1', ipv6: '2001:504:0:4::1' },
      { name: 'RS2', asn: '49378', ipv4: '206.197.187.2', ipv6: '2001:504:0:4::2' },
    ],
    peers: 300,
    capacity: '150+ Tbps',
    uptime: '99.99%',
    portSpeeds: ['1G', '10G', '40G', '100G'],
    protocols: ['BGP-4', 'IPv4', 'IPv6'],
    features: ['Tech hub', 'Cloud providers', 'Innovation center', 'Major CSP presence', 'Venture capital access', 'AI/ML research labs', 'Hardware manufacturers', 'Software giants'],
    description: 'Heart of tech innovation with major cloud and content providers.',
    latency: '0.5',
  },
  {
    id: 'queretaro',
    name: 'Queretaro',
    code: 'QRO',
    city: 'Queretaro',
    country: 'Mexico',
    region: 'NORTH AMERICA',
    continentId: 'north-america',
    coordinates: [-100.3899, 20.5888],
    facilities: ['KIO Networks QRO'],
    asnList: [
      { asnNumber: 8151, name: 'Uninet S.A. de C.V.', peeringPolicy: 'Open', status: 'ACTIVE' },
    ],
    enabledSites: [
      { id: 'kio-qro', name: 'KIO Networks QRO', provider: 'KIO Networks', address: 'Queretaro, Mexico', status: 'available' },
    ],
    pricingTiers: [
      { speed: '1G', setupFee: 0, monthlyFee: 0 },
      { speed: '10G', setupFee: 0, monthlyFee: 0 },
    ],
    routeServers: [
      { name: 'RS1', asn: '49378', ipv4: '187.16.217.1', ipv6: '2001:13c7:7000::1' },
      { name: 'RS2', asn: '49378', ipv4: '187.16.217.2', ipv6: '2001:13c7:7000::2' },
    ],
    peers: 80,
    capacity: '30+ Tbps',
    uptime: '99.95%',
    portSpeeds: ['1G', '10G', '40G'],
    protocols: ['BGP-4', 'IPv4', 'IPv6'],
    features: ['Mexico hub', 'Nearshoring gateway', 'Latin America access', 'Manufacturing corridor', 'Automotive industry', 'Cross-border connectivity', 'USMCA trade zone'],
    description: 'Emerging data center hub serving Mexico and Latin America.',
    latency: '1.0',
  },

  // SOUTH AMERICA
  {
    id: 'buenos-aires',
    name: 'Buenos Aires',
    code: 'BUE',
    city: 'Buenos Aires',
    country: 'Argentina',
    region: 'SOUTH AMERICA',
    continentId: 'south-america',
    coordinates: [-58.3816, -34.6037],
    facilities: ['Teleport Buenos Aires'],
    asnList: [
      { asnNumber: 7303, name: 'Telecom Argentina S.A.', peeringPolicy: 'Open', status: 'ACTIVE' },
    ],
    enabledSites: [
      { id: 'teleport-bue', name: 'Teleport Buenos Aires', provider: 'Teleport', address: 'Buenos Aires, Argentina', status: 'available' },
    ],
    pricingTiers: [
      { speed: '1G', setupFee: 0, monthlyFee: 0 },
      { speed: '10G', setupFee: 0, monthlyFee: 0 },
    ],
    routeServers: [
      { name: 'RS1', asn: '49378', ipv4: '200.0.204.1', ipv6: '2001:13c7:6000::1' },
      { name: 'RS2', asn: '49378', ipv4: '200.0.204.2', ipv6: '2001:13c7:6000::2' },
    ],
    peers: 120,
    capacity: '50+ Tbps',
    uptime: '99.93%',
    portSpeeds: ['1G', '10G', '40G'],
    protocols: ['BGP-4', 'IPv4', 'IPv6'],
    features: ['South America gateway', 'Regional hub', 'Content distribution', 'Financial center', 'Mercosur connectivity', 'Agricultural sector access', 'Energy industry network'],
    description: 'Primary internet exchange for Southern Cone region.',
    latency: '1.5',
  },
];

// Services
const services = [
  {
    id: 'peering',
    category: 'Peering',
    tagline: 'Direct Interconnection at Scale',
    description: 'Establish direct peering relationships with the world\'s leading networks and content providers.',
    image: '',
    order: 1,
    isActive: true,
    items: [
      {
        name: 'Bilateral Peering',
        description: 'Direct private peering connections between two networks for dedicated, high-performance traffic exchange.',
        icon: 'bilateral-peering',
        benefits: [
          'Dedicated bandwidth allocation',
          'Enhanced security with private VLANs',
          'Customizable traffic policies',
          'Direct network-to-network connection',
        ],
        features: [
          'Private VLAN connections',
          '10G to 400G port options',
          'Custom routing policies',
          'SLA-backed performance',
        ],
        order: 1,
      },
      {
        name: 'Public Peering',
        description: 'Exchange traffic with multiple networks simultaneously',
        icon: 'public-peering',
        benefits: [
          'Cost-effective scaling',
          'Access to hundreds of networks',
          'Simplified operations',
          'Reduced complexity',
        ],
        features: [
          'Route server support',
          'IPv4 and IPv6',
          'Looking glass access',
          'Peering coordinator support',
        ],
        order: 2,
      },
    ],
  },
  {
    id: 'private-connectivity',
    category: 'Private Connectivity',
    tagline: 'Secure Dedicated Infrastructure',
    description: 'Enterprise-grade private connections for mission-critical applications and data transfer.',
    image: '',
    order: 2,
    isActive: true,
    items: [
      {
        name: 'Private Interconnect',
        description: 'Dedicated VLANs providing isolated, high-bandwidth connections between your networks.',
        icon: 'private-interconnect',
        benefits: [
          'Guaranteed bandwidth with SLA',
          'Complete traffic isolation',
          'Sub-millisecond latency',
          'Flexible bandwidth scaling',
        ],
        features: [
          '10G to 400G ports',
          'Layer 2 & Layer 3 options',
          'MPLS integration',
          'Encryption support',
        ],
        order: 1,
      },
      {
        name: 'Closed User Group',
        description: 'Secure ecosystem for specific industry verticals like finance, healthcare, and government.',
        icon: 'shield',
        benefits: [
          'Industry-specific secure networks',
          'Compliance-ready infrastructure',
          'Controlled member access',
          'Enhanced data privacy',
        ],
        features: [
          'VLAN segregation',
          'Access control lists',
          'Traffic monitoring',
          'Custom peering policies',
        ],
        order: 2,
      },
      {
        name: 'Data Centre Interconnect',
        description: 'High-speed Layer 2 point-to-point connections between data centers for seamless workload distribution.',
        icon: 'server',
        benefits: [
          'High-speed data replication',
          'Disaster recovery enablement',
          'Load balancing support',
          'Zero packet loss',
        ],
        features: [
          'Point-to-point connections',
          'Dark fiber options',
          'Multiple redundancy paths',
          'Sub-1ms latency',
        ],
        order: 3,
      },
    ],
  },
  {
    id: 'access',
    category: 'Access',
    tagline: 'Global Reach, Local Presence',
    description: 'Seamless connectivity to internet exchanges worldwide, without physical infrastructure.',
    image: '',
    order: 3,
    isActive: true,
    items: [
      {
        name: 'Autoprovisioning',
        description: 'Automated port provisioning for remote networks with zero-touch setup and configuration.',
        icon: 'cpu',
        benefits: [
          'Zero-touch deployment',
          'Instant activation',
          'Reduced setup time',
          'Automated configuration',
        ],
        features: [
          'API-driven provisioning',
          'Real-time port activation',
          'Self-service portal',
          'Multi-vendor support',
        ],
        order: 1,
      },
      {
        name: 'Remote Peering',
        description: 'Reach 200+ global internet exchanges without physical presence, via our distributed PoP network.',
        icon: 'globe',
        benefits: [
          'Global reach without infrastructure',
          'Cost-effective expansion',
          'Access to 200+ IXPs',
          'Simplified operations',
        ],
        features: [
          'Distributed PoP network',
          'BGP session management',
          'Route server access',
          '24/7 monitoring',
        ],
        order: 2,
      },
      {
        name: 'Cross-IX',
        description: 'Seamless interconnection between disparate internet exchanges for unified peering strategy.',
        icon: 'branch',
        benefits: [
          'Unified peering strategy',
          'Multi-IX connectivity',
          'Streamlined management',
          'Enhanced redundancy',
        ],
        features: [
          'Inter-IX VLAN connections',
          'Consistent policies',
          'Centralized monitoring',
          'Automated failover',
        ],
        order: 3,
      },
    ],
  },
  {
    id: 'infrastructure-consultancy',
    category: 'Infrastructure & Consultancy',
    tagline: 'Expert Guidance & Managed Solutions',
    description: 'Comprehensive infrastructure management and training services for network excellence.',
    image: '',
    order: 4,
    isActive: true,
    items: [
      {
        name: 'IX-as-a-Service',
        description: 'White-label exchange infrastructure management - we build and operate your IX platform.',
        icon: 'server',
        benefits: [
          'White-label IX platform',
          'Turnkey operations',
          'Scalable infrastructure',
          'Expert management',
        ],
        features: [
          'Full platform deployment',
          'NOC services',
          'Route server management',
          'Customer onboarding support',
        ],
        order: 1,
      },
      {
        name: 'Innovation Services',
        description: 'R&D partnership programs for developing and testing next-generation network protocols.',
        icon: 'star',
        benefits: [
          'Next-gen protocol testing',
          'R&D collaboration',
          'Proof-of-concept support',
          'Technology roadmap guidance',
        ],
        features: [
          'Test lab access',
          'Protocol development support',
          'Performance benchmarking',
          'Innovation workshops',
        ],
        order: 2,
      },
    ],
  },
  {
    id: 'cloud',
    category: 'Cloud',
    tagline: 'Direct Path to Cloud Providers',
    description: 'Seamless connectivity to major cloud platforms with dedicated, low-latency connections.',
    image: '',
    order: 5,
    isActive: true,
    items: [
      {
        name: 'AWS Direct Connect',
        description: 'Dedicated network connection to Amazon Web Services',
        icon: 'cloud',
        benefits: [
          'Consistent network performance',
          'Reduced bandwidth costs',
          'Private connectivity',
          'Hybrid cloud enablement',
        ],
        features: [
          '1G to 100G connections',
          'Multiple VIF support',
          'BGP routing',
          'Redundancy options',
        ],
        order: 1,
      },
    ],
  },
  {
    id: 'security',
    category: 'Security',
    tagline: 'Advanced Threat Protection',
    description: 'Comprehensive security solutions to protect your network infrastructure.',
    image: '',
    order: 6,
    isActive: true,
    items: [
      {
        name: 'Anti-DDoS',
        description: 'Real-time volumetric attack mitigation with ML-powered threat detection',
        icon: 'ddos-shield',
        benefits: [
          'Scrubbing capacity: 10+ Tbps',
          'Detection time: <30 seconds',
          'Mitigation time: <60 seconds',
          'Zero false positives',
        ],
        features: [
          'Layer 3-7 protection',
          'Always-on monitoring',
          'Instant traffic rerouting',
          'Post-attack analytics',
        ],
        order: 1,
      },
    ],
  },
];

const contacts = [
  {
    department: 'sales',
    locationId: 'global',
    phone: '+1 (555) 100-2000',
    email: 'sales@mx-ix.com',
  },
  {
    department: 'support',
    locationId: 'global',
    phone: '+1 (555) 100-3000',
    email: 'support@mx-ix.com',
  },
];

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seed...');
    console.log(`📡 Connecting to MongoDB: ${MONGODB_URI}`);
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    console.log('\n🗑️  Clearing existing data...');
    await Promise.all([
      Service.deleteMany({}),
      Continent.deleteMany({}),
      Location.deleteMany({}),
      ContactInfo.deleteMany({}),
    ]);
    console.log('✅ Cleared existing data');

    // Seed continents
    console.log('\n🌍 Seeding continents...');
    const createdContinents = await Continent.insertMany(continents);
    console.log(`✅ Created ${createdContinents.length} continents`);

    // Seed locations
    console.log('\n📍 Seeding locations...');
    const createdLocations = await Location.insertMany(locations);
    console.log(`✅ Created ${createdLocations.length} locations`);

    // Seed services
    console.log('\n🔧 Seeding services...');
    const createdServices = await Service.insertMany(services);
    console.log(`✅ Created ${createdServices.length} services`);

    // Seed contacts
    console.log('\n📞 Seeding contacts...');
    const createdContacts = await ContactInfo.insertMany(contacts);
    console.log(`✅ Created ${createdContacts.length} contacts`);

    console.log('\n🎉 Database seeded successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Continents: ${createdContinents.length}`);
    console.log(`   - Locations: ${createdLocations.length}`);
    console.log(`   - Services: ${createdServices.length}`);
    console.log(`   - Contacts: ${createdContacts.length}`);
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the seed function
seedDatabase();
