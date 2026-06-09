import { Service } from '../models';

// Icon identifiers (stored as strings, frontend renders the actual SVG)
const ICONS = {
  BILATERAL: 'bilateral-peering',
  PUBLIC: 'public-peering',
  PRIVATE: 'private-interconnect',
  SHIELD: 'shield',
  SERVER: 'server',
  LOGIN: 'login',
  GLOBE: 'globe',
  BRANCH: 'branch',
  CPU: 'cpu',
  STAR: 'star',
  CLOUD: 'cloud',
  DDOS: 'ddos-shield',
};

// Services data extracted from ServicesPage.tsx
const servicesData = [
  {
    id: 'peering',
    category: 'Peering',
    tagline: 'Direct Interconnection at Scale',
    description: "Establish direct peering relationships with the world's leading networks and content providers.",
    image: '/assets/peering_service_hero_1766400451669.png',
    order: 1,
    isActive: true,
    items: [
      {
        name: 'Bilateral Peering',
        icon: ICONS.BILATERAL,
        description: 'Direct private peering connections between two networks for dedicated, high-performance traffic exchange.',
        benefits: [
          'Dedicated bandwidth allocation',
          'Enhanced security with private VLANs',
          'Customizable traffic policies',
          'Direct network-to-network connection'
        ],
        features: [
          'Private VLAN connections',
          '10G to 400G port options',
          'Custom routing policies',
          'SLA-backed performance'
        ],
        order: 0
      },
      {
        name: 'Public Peering',
        icon: ICONS.PUBLIC,
        description: 'Connect to multiple networks simultaneously through our route servers, maximizing peering opportunities with a single connection.',
        benefits: [
          'Access to 500+ networks',
          'Reduced latency by up to 60%',
          'Save up to 80% on bandwidth costs',
          '24/7 network operations support'
        ],
        features: [
          'Multi-lateral peering via route servers',
          'IPv4 & IPv6 support',
          'Real-time traffic analytics',
          'Automated BGP session management'
        ],
        order: 1
      }
    ]
  },
  {
    id: 'private',
    category: 'Private Connectivity',
    tagline: 'Secure Dedicated Infrastructure',
    description: 'Enterprise-grade private connections for mission-critical applications and data transfer.',
    image: '/assets/private_connectivity_hero_1766400468118.png',
    order: 2,
    isActive: true,
    items: [
      {
        name: 'Private Interconnect',
        icon: ICONS.PRIVATE,
        description: 'Dedicated VLANs providing isolated, high-bandwidth connections between your networks.',
        benefits: [
          'Guaranteed bandwidth with SLA',
          'Complete traffic isolation',
          'Sub-millisecond latency',
          'Flexible bandwidth scaling'
        ],
        features: [
          '10G to 400G ports',
          'Layer 2 & Layer 3 options',
          'MPLS integration',
          'Encryption support'
        ],
        order: 0
      },
      {
        name: 'Closed User Group',
        icon: ICONS.SHIELD,
        description: 'Secure ecosystem for specific industry verticals like finance, healthcare, and government.',
        benefits: [
          '100% private network fabric',
          'Compliance-ready infrastructure',
          'Industry-specific security',
          'Controlled access management'
        ],
        features: [
          'Multi-tenant isolation',
          'Advanced authentication',
          'Audit trail logging',
          'Custom routing policies'
        ],
        order: 1
      },
      {
        name: 'Data Centre Interconnect',
        icon: ICONS.SERVER,
        description: 'High-speed Layer 2 point-to-point connections between data centers for seamless workload distribution.',
        benefits: [
          'Ultra-low latency (<1ms)',
          'High availability (99.99% uptime)',
          'Active-active data center setups',
          'Disaster recovery ready'
        ],
        features: [
          'Dark fiber options',
          'Wavelength services',
          'Metro & long-haul links',
          'Redundant path protection'
        ],
        order: 2
      }
    ]
  },
  {
    id: 'access',
    category: 'Access',
    tagline: 'Global Reach, Local Presence',
    description: 'Seamless connectivity to internet exchanges worldwide, without physical infrastructure.',
    image: '/assets/access_service_hero_1766400541443.png',
    order: 3,
    isActive: true,
    items: [
      {
        name: 'Autoprovisioning',
        icon: ICONS.LOGIN,
        description: 'Automated port provisioning for remote networks with zero-touch setup and configuration.',
        benefits: [
          '5-minute port activation',
          'Self-service portal',
          'Pay-as-you-grow pricing',
          'No long-term commitments'
        ],
        features: [
          '1G to 100G ports',
          'Instant provisioning',
          'Web-based management',
          'Usage analytics dashboard'
        ],
        order: 0
      },
      {
        name: 'Remote Peering',
        icon: ICONS.GLOBE,
        description: 'Reach 200+ global internet exchanges without physical presence, via our distributed PoP network.',
        benefits: [
          'Access to 200+ IXPs globally',
          'No on-site equipment needed',
          'Reduced operational costs',
          'Multi-IX redundancy'
        ],
        features: [
          'Virtual port allocation',
          'BGP session aggregation',
          'Global PoP network',
          'Centralized billing'
        ],
        order: 1
      },
      {
        name: 'Cross-IX',
        icon: ICONS.BRANCH,
        description: 'Seamless interconnection between disparate internet exchanges for unified peering strategy.',
        benefits: [
          'Unified peering across IXes',
          'Simplified route management',
          'Cost optimization',
          'Enhanced redundancy'
        ],
        features: [
          'Multi-IX routing',
          'Traffic engineering',
          'Single pane of glass',
          'Automated failover'
        ],
        order: 2
      }
    ]
  },
  {
    id: 'infrastructure',
    category: 'Infrastructure & Consultancy',
    tagline: 'Expert Guidance & Managed Solutions',
    description: 'Comprehensive infrastructure management and training services for network excellence.',
    image: '/assets/infrastructure_service_hero_1766400524058.png',
    order: 4,
    isActive: true,
    items: [
      {
        name: 'IX-as-a-Service',
        icon: ICONS.CPU,
        description: 'White-label exchange infrastructure management - we build and operate your IX platform.',
        benefits: [
          'Full IX infrastructure',
          '24/7 NOC operations',
          'White-label branding',
          'Turnkey solution'
        ],
        features: [
          'Route server management',
          'Member portal',
          'Traffic statistics',
          'Custom integrations'
        ],
        order: 0
      },
      {
        name: 'Innovation Services',
        icon: ICONS.STAR,
        description: 'R&D partnership programs for developing and testing next-generation network protocols.',
        benefits: [
          'Early access to new tech',
          'Joint development programs',
          'Testing infrastructure',
          'Innovation roadmap alignment'
        ],
        features: [
          'QUIC protocol testing',
          'IPv6 migration support',
          'SD-WAN integration',
          'AI-driven routing R&D'
        ],
        order: 1
      }
    ]
  },
  {
    id: 'cloud',
    category: 'Cloud',
    tagline: 'Direct Path to Cloud Providers',
    description: 'Low-latency, high-bandwidth connections directly to major cloud service providers.',
    image: '/assets/cloud_access_hero_1766400488264.png',
    order: 5,
    isActive: true,
    items: [
      {
        name: 'Cloud Access',
        icon: ICONS.CLOUD,
        description: 'Direct on-ramps to AWS, Microsoft Azure, Google Cloud, and Oracle Cloud infrastructure.',
        benefits: [
          'Bypass public internet',
          'Predictable performance',
          'Reduced egress costs',
          'Enhanced security'
        ],
        features: [
          'AWS Direct Connect',
          'Azure ExpressRoute',
          'Google Cloud Interconnect',
          'Multi-cloud connectivity'
        ],
        order: 0
      }
    ]
  },
  {
    id: 'security',
    category: 'Security',
    tagline: 'Advanced Threat Protection',
    description: 'Enterprise-grade DDoS mitigation and security services to protect your infrastructure.',
    image: '/assets/anti_ddos_hero_1766400506277.png',
    order: 6,
    isActive: true,
    items: [
      {
        name: 'Anti-DDoS',
        icon: ICONS.DDOS,
        description: 'Real-time volumetric attack mitigation with ML-powered threat detection and automated response.',
        benefits: [
          'Scrubbing capacity: 10+ Tbps',
          'Detection time: <30 seconds',
          'Mitigation time: <60 seconds',
          'Zero false positives'
        ],
        features: [
          'Layer 3-7 protection',
          'Always-on monitoring',
          'Instant traffic rerouting',
          'Post-attack analytics'
        ],
        stats: [
          { label: 'Attacks Mitigated', value: '50K+', period: 'annually' },
          { label: 'Peak Protection', value: '10 Tbps', period: 'capacity' },
          { label: 'Response Time', value: '<60s', period: 'average' }
        ],
        order: 0
      }
    ]
  }
];

export const seedServices = async (): Promise<void> => {
  try {
    console.log('🌱 Seeding services...');
    
    const existingCount = await Service.countDocuments();
    if (existingCount > 0) {
      console.log(`ℹ️ Services already exist (${existingCount} found). Skipping...`);
      return;
    }

    for (const service of servicesData) {
      await Service.create(service);
    }
    
    console.log(`✅ ${servicesData.length} services created with ${servicesData.reduce((acc, s) => acc + s.items.length, 0)} items`);
  } catch (error) {
    console.error('❌ Error seeding services:', error);
    throw error;
  }
};

// Force reseed (delete all and create fresh)
export const reseedServices = async (): Promise<void> => {
  try {
    console.log('🔄 Reseeding services (deleting existing)...');
    await Service.deleteMany({});
    
    for (const service of servicesData) {
      await Service.create(service);
    }
    
    console.log(`✅ ${servicesData.length} services created fresh`);
  } catch (error) {
    console.error('❌ Error reseeding services:', error);
    throw error;
  }
};

export default { seedServices, reseedServices };
