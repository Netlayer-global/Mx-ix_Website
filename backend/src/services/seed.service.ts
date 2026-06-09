import { User, NetworkStats, GlobalFabricStats, Location, Continent } from '../models';
import GlobalStats from '../models/globalStats.model';
import config from '../config/environment';
import { seedServices } from './seedServices.service';

// Default continents
const defaultContinents = [
  { id: 'asia', name: 'Asia Pacific', description: 'Asia Pacific region including India, Southeast Asia, Australia', order: 1, isActive: true },
  { id: 'europe', name: 'Europe', description: 'European region including EU and UK', order: 2, isActive: true },
  { id: 'north-america', name: 'North America', description: 'North American region including USA, Canada, Mexico', order: 3, isActive: true },
  { id: 'south-america', name: 'South America', description: 'South American region including Brazil, Argentina', order: 4, isActive: true },
  { id: 'middle-east', name: 'Middle East', description: 'Middle East region including UAE, Saudi Arabia', order: 5, isActive: true },
  { id: 'africa', name: 'Africa', description: 'African continent', order: 6, isActive: true },
];

// Default locations data from your frontend AdminContext
const defaultLocations = [
  // Current (Live) Locations - India
  { id: 'del', name: 'New Delhi', coordinates: [77.2090, 28.6139] as [number, number], code: 'DEL_NORTH', region: 'ASIA', status: 'current' as const,
    asnList: [
      { asnNumber: 9498, name: 'Bharti Airtel Ltd.', macro: '', peeringPolicy: 'Selective' as const, status: 'ACTIVE' as const },
      { asnNumber: 4755, name: 'Tata Communications Ltd', macro: '', peeringPolicy: 'Open' as const, status: 'ACTIVE' as const },
      { asnNumber: 45820, name: 'BSNL - Bharat Sanchar Nigam Ltd.', macro: '', peeringPolicy: 'Open' as const, status: 'ACTIVE' as const },
      { asnNumber: 17488, name: 'Hathway Cable and Datacom Ltd.', macro: '', peeringPolicy: 'Open' as const, status: 'CONNECTING' as const },
      { asnNumber: 55836, name: 'Reliance Jio Infocomm Limited', macro: '', peeringPolicy: 'Selective' as const, status: 'ACTIVE' as const }
    ],
    enabledSites: [
      { id: 'del-1', name: 'NTT Delhi DC', provider: 'NTT', address: 'Sector 142, Noida, Uttar Pradesh 201304', status: 'available' as const },
      { id: 'del-2', name: 'STT Delhi 1', provider: 'STT GDC', address: 'Mahipalpur Extension, New Delhi 110037', status: 'available' as const },
      { id: 'del-3', name: 'CtrlS Noida', provider: 'CtrlS', address: 'Knowledge Park III, Greater Noida 201306', status: 'available' as const },
      { id: 'del-4', name: 'Netmagic Delhi DC', provider: 'Netmagic', address: 'Sector 62, Noida, UP 201309', status: 'available' as const },
      { id: 'del-5', name: 'Yotta Noida', provider: 'Yotta', address: 'Greater Noida, UP 201306', status: 'coming-soon' as const }
    ]
  },
  { id: 'bom', name: 'Mumbai', coordinates: [72.8777, 19.076] as [number, number], code: 'BOM_WEST', region: 'ASIA', status: 'upcoming' as const,
    asnList: [
      { asnNumber: 9498, name: 'Bharti Airtel Ltd.', macro: '', peeringPolicy: 'Selective' as const, status: 'ACTIVE' as const },
      { asnNumber: 45609, name: 'Tata Teleservices (Maharashtra) Limited', macro: '', peeringPolicy: 'Open' as const, status: 'ACTIVE' as const },
      { asnNumber: 55410, name: 'Vodafone Idea Limited', macro: '', peeringPolicy: 'Restrictive' as const, status: 'CONNECTING' as const }
    ],
    enabledSites: [
      { id: 'bom-1', name: 'GPX Mumbai 1', provider: 'GPX', address: 'Powai, Mumbai 400076', status: 'available' as const },
      { id: 'bom-2', name: 'Netmagic DC2', provider: 'Netmagic', address: 'Airoli, Navi Mumbai 400708', status: 'available' as const },
      { id: 'bom-3', name: 'STT Mumbai', provider: 'STT GDC', address: 'Navi Mumbai, Maharashtra 400709', status: 'coming-soon' as const }
    ]
  },
  { id: 'maa', name: 'Chennai', coordinates: [80.2707, 13.0827] as [number, number], code: 'MAA_SOUTH', region: 'ASIA', status: 'current' as const,
    asnList: [
      { asnNumber: 9498, name: 'Bharti Airtel Ltd.', macro: '', peeringPolicy: 'Selective' as const, status: 'ACTIVE' as const },
      { asnNumber: 4755, name: 'Tata Communications Ltd', macro: '', peeringPolicy: 'Open' as const, status: 'ACTIVE' as const },
      { asnNumber: 55410, name: 'Vodafone Idea Limited', macro: '', peeringPolicy: 'Restrictive' as const, status: 'CONNECTING' as const },
      { asnNumber: 45820, name: 'BSNL - Bharat Sanchar Nigam Ltd.', macro: '', peeringPolicy: 'Open' as const, status: 'ACTIVE' as const },
      { asnNumber: 17747, name: 'SIFY Technologies Ltd.', macro: '', peeringPolicy: 'Open' as const, status: 'CONNECTING' as const }
    ],
    enabledSites: [
      { id: 'maa-1', name: 'STT Chennai 1', provider: 'STT GDC', address: 'Ambattur Industrial Estate, Chennai 600058', status: 'available' as const },
      { id: 'maa-2', name: 'NTT Chennai DC', provider: 'NTT', address: 'SIPCOT IT Park, Siruseri, Chennai 603103', status: 'available' as const },
      { id: 'maa-3', name: 'CtrlS Chennai', provider: 'CtrlS', address: 'Sholinganallur, Chennai 600119', status: 'available' as const },
      { id: 'maa-4', name: 'Sify Navallur DC', provider: 'Sify', address: 'Navallur, Chennai 600130', status: 'coming-soon' as const }
    ]
  },
  { id: 'ccu', name: 'Kolkata', coordinates: [88.3639, 22.5726] as [number, number], code: 'CCU_EAST', region: 'ASIA', status: 'upcoming' as const,
    asnList: [
      { asnNumber: 9498, name: 'Bharti Airtel Ltd.', macro: '', peeringPolicy: 'Selective' as const, status: 'ACTIVE' as const },
      { asnNumber: 4755, name: 'Tata Communications Ltd', macro: '', peeringPolicy: 'Open' as const, status: 'ACTIVE' as const },
      { asnNumber: 45820, name: 'BSNL - Bharat Sanchar Nigam Ltd.', macro: '', peeringPolicy: 'Open' as const, status: 'ACTIVE' as const }
    ],
    enabledSites: [
      { id: 'ccu-1', name: 'CtrlS Kolkata', provider: 'CtrlS', address: 'Sector V, Salt Lake City, Kolkata 700091', status: 'available' as const },
      { id: 'ccu-2', name: 'Sify Kolkata DC', provider: 'Sify', address: 'Rajarhat, Kolkata 700156', status: 'available' as const },
      { id: 'ccu-3', name: 'GPX Kolkata', provider: 'GPX', address: 'Newtown, Kolkata 700135', status: 'coming-soon' as const }
    ]
  },
  { id: 'hyd', name: 'Hyderabad', coordinates: [78.4867, 17.3850] as [number, number], code: 'HYD_CENTRAL', region: 'ASIA', status: 'upcoming' as const,
    asnList: [
      { asnNumber: 9498, name: 'Bharti Airtel Ltd.', macro: '', peeringPolicy: 'Selective' as const, status: 'ACTIVE' as const },
      { asnNumber: 4755, name: 'Tata Communications Ltd', macro: '', peeringPolicy: 'Open' as const, status: 'ACTIVE' as const },
      { asnNumber: 55836, name: 'Reliance Jio Infocomm Limited', macro: '', peeringPolicy: 'Selective' as const, status: 'ACTIVE' as const },
      { asnNumber: 45820, name: 'BSNL - Bharat Sanchar Nigam Ltd.', macro: '', peeringPolicy: 'Open' as const, status: 'CONNECTING' as const }
    ],
    enabledSites: [
      { id: 'hyd-1', name: 'Yotta Hyderabad', provider: 'Yotta', address: 'HITEC City, Hyderabad 500081', status: 'available' as const },
      { id: 'hyd-2', name: 'CtrlS Hyderabad', provider: 'CtrlS', address: 'Nanakramguda, Hyderabad 500032', status: 'available' as const },
      { id: 'hyd-3', name: 'NTT Hyderabad DC', provider: 'NTT', address: 'Gachibowli, Hyderabad 500032', status: 'available' as const },
      { id: 'hyd-4', name: 'Amazon Hyderabad', provider: 'AWS', address: 'Kondapur, Hyderabad 500084', status: 'coming-soon' as const }
    ]
  },
  { id: 'blr', name: 'Bangalore', coordinates: [77.5946, 12.9716] as [number, number], code: 'BLR_SOUTH', region: 'ASIA', status: 'upcoming' as const,
    asnList: [
      { asnNumber: 9498, name: 'Bharti Airtel Ltd.', macro: '', peeringPolicy: 'Selective' as const, status: 'ACTIVE' as const },
      { asnNumber: 4755, name: 'Tata Communications Ltd', macro: '', peeringPolicy: 'Open' as const, status: 'ACTIVE' as const },
      { asnNumber: 55836, name: 'Reliance Jio Infocomm Limited', macro: '', peeringPolicy: 'Selective' as const, status: 'ACTIVE' as const },
      { asnNumber: 17747, name: 'SIFY Technologies Ltd.', macro: '', peeringPolicy: 'Open' as const, status: 'ACTIVE' as const },
      { asnNumber: 45820, name: 'BSNL - Bharat Sanchar Nigam Ltd.', macro: '', peeringPolicy: 'Open' as const, status: 'CONNECTING' as const }
    ],
    enabledSites: [
      { id: 'blr-1', name: 'NTT Bangalore DC', provider: 'NTT', address: 'Electronic City, Bangalore 560100', status: 'available' as const },
      { id: 'blr-2', name: 'CtrlS Bangalore', provider: 'CtrlS', address: 'Whitefield, Bangalore 560066', status: 'available' as const },
      { id: 'blr-3', name: 'STT Bangalore', provider: 'STT GDC', address: 'Marathahalli, Bangalore 560037', status: 'available' as const },
      { id: 'blr-4', name: 'Equinix MB1', provider: 'Equinix', address: 'Mahadevapura, Bangalore 560048', status: 'available' as const },
      { id: 'blr-5', name: 'Microsoft Bangalore', provider: 'Azure', address: 'Bellandur, Bangalore 560103', status: 'coming-soon' as const }
    ]
  },
  // Current (Live) Location - Middle East
  { id: 'dxb', name: 'Dubai', coordinates: [55.2708, 25.2048] as [number, number], code: 'DXB_GULF', region: 'MIDDLE EAST', status: 'upcoming' as const,
    asnList: [
      { asnNumber: 5384, name: 'Emirates Telecommunications Corporation (Etisalat)', macro: '', peeringPolicy: 'Selective' as const, status: 'ACTIVE' as const },
      { asnNumber: 8966, name: 'Emirates Integrated Telecommunications Company (du)', macro: '', peeringPolicy: 'Selective' as const, status: 'ACTIVE' as const },
      { asnNumber: 15802, name: 'Ooredoo Q.S.C.', macro: '', peeringPolicy: 'Open' as const, status: 'CONNECTING' as const },
      { asnNumber: 35753, name: 'Omantel', macro: '', peeringPolicy: 'Open' as const, status: 'ACTIVE' as const },
      { asnNumber: 51847, name: 'Gulf Bridge International', macro: '', peeringPolicy: 'Open' as const, status: 'CONNECTING' as const }
    ],
    enabledSites: [
      { id: 'dxb-1', name: 'Equinix DX1', provider: 'Equinix', address: 'Dubai Silicon Oasis, Dubai, UAE', status: 'available' as const },
      { id: 'dxb-2', name: 'Khazna Data Center', provider: 'Khazna', address: 'Masdar City, Abu Dhabi, UAE', status: 'available' as const },
      { id: 'dxb-3', name: 'Gulf Data Hub', provider: 'GDH', address: 'Sheikh Zayed Road, Dubai, UAE', status: 'available' as const },
      { id: 'dxb-4', name: 'Moro Hub', provider: 'Moro', address: 'DWTC, Dubai, UAE', status: 'coming-soon' as const }
    ]
  },
  // Upcoming Locations
  { id: 'lax', name: 'Los Angeles', coordinates: [-118.2437, 34.0522] as [number, number], code: 'LAX_WEST', region: 'NORTH AMERICA', status: 'current' as const,
    asnList: [], enabledSites: []
  },
  { id: 'sjc', name: 'Silicon Valley', coordinates: [-121.8863, 37.3382] as [number, number], code: 'SJC_VALLEY', region: 'NORTH AMERICA', status: 'current' as const,
    asnList: [], enabledSites: []
  },
  { id: 'vie', name: 'Vienna', coordinates: [16.3738, 48.2082] as [number, number], code: 'VIE_EU', region: 'EUROPE', status: 'upcoming' as const,
    asnList: [], enabledSites: []
  },
  { id: 'qro', name: 'Queretaro', coordinates: [-100.3899, 20.5888] as [number, number], code: 'QRO_MX', region: 'NORTH AMERICA', status: 'current' as const,
    asnList: [], enabledSites: []
  },
  { id: 'eze', name: 'Buenos Aires', coordinates: [-58.3816, -34.6037] as [number, number], code: 'EZE_SA', region: 'SOUTH AMERICA', status: 'current' as const,
    asnList: [], enabledSites: []
  },
  { id: 'fjr', name: 'Fujairah', coordinates: [56.3414, 25.1288] as [number, number], code: 'FJR_UAE', region: 'MIDDLE EAST', status: 'current' as const,
    asnList: [], enabledSites: []
  }
];

export const seedDatabase = async (): Promise<void> => {
  try {
    console.log('🌱 Starting database seeding...');

    // Seed admin user
    const existingUser = await User.findOne({ email: config.adminEmail });
    if (!existingUser) {
      await User.create({
        email: config.adminEmail,
        password: config.adminPassword,
        name: 'Admin',
        role: 'admin',
        isActive: true,
      });
      console.log('✅ Admin user created');
    } else {
      console.log('ℹ️ Admin user already exists');
    }

    // Seed network stats
    const existingNetworkStats = await NetworkStats.findOne();
    if (!existingNetworkStats) {
      await NetworkStats.create({
        globalLatency: { value: 0.4, unit: 'ms' },
        activeNodes: 4921,
        throughput: 124,
      });
      console.log('✅ Network stats created');
    } else {
      console.log('ℹ️ Network stats already exists');
    }

    // Seed global fabric stats
    const existingFabricStats = await GlobalFabricStats.findOne();
    if (!existingFabricStats) {
      await GlobalFabricStats.create({
        totalCapacity: '5.2 Tbps',
        activeRoutes: '10,000+',
        avgLatency: '<5ms',
        globalCoverage: '100%',
      });
      console.log('✅ Global fabric stats created');
    } else {
      console.log('ℹ️ Global fabric stats already exists');
    }

    // Seed continents
    const existingContinents = await Continent.countDocuments();
    if (existingContinents === 0) {
      for (const cont of defaultContinents) {
        await Continent.create(cont);
      }
      console.log(`✅ ${defaultContinents.length} continents created`);
    } else {
      console.log(`ℹ️ Continents already exist (${existingContinents} found)`);
    }

    // Seed locations
    const existingLocations = await Location.countDocuments();
    if (existingLocations === 0) {
      for (const loc of defaultLocations) {
        await Location.create({
          id: loc.id,
          name: loc.name,
          coordinates: loc.coordinates,
          code: loc.code,
          region: loc.region,
          asnList: loc.asnList,
          enabledSites: loc.enabledSites,
          status: loc.status,
          continentId: loc.region === 'ASIA' ? 'asia' : 
                       loc.region === 'EUROPE' ? 'europe' :
                       loc.region === 'NORTH AMERICA' ? 'north-america' :
                       loc.region === 'SOUTH AMERICA' ? 'south-america' :
                       loc.region === 'MIDDLE EAST' ? 'middle-east' : 'asia',
        });
      }
      console.log(`✅ ${defaultLocations.length} locations created`);
    } else {
      console.log(`ℹ️ Locations already exist (${existingLocations} found)`);
    }

    // Seed global stats
    const existingGlobalStats = await GlobalStats.findOne();
    if (!existingGlobalStats) {
      await GlobalStats.create({
        totalCapacity: { value: 450, unit: 'Tbps' },
        peakTraffic: { value: 156.2, unit: 'Tbps', trend: 'up', trendValue: '+8.1%' },
        connectedNetworks: { value: 4921, unit: 'Peers', trend: 'up', trendValue: '+47' },
        ipv4Prefixes: { value: 892345, unit: 'Routes', trend: 'stable' },
      });
      console.log('✅ Global stats created');
    } else {
      console.log('ℹ️ Global stats already exists');
    }


    // Seed services
    await seedServices();

    console.log('🎉 Database seeding completed!');
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  }
};

export default seedDatabase;
