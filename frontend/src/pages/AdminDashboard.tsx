import React, { useState, useEffect } from 'react';
import { 
  Server, 
  MapPin, 
  BarChart3, 
  Phone, 
  Home,
  Settings,
  LogOut,
  ChevronRight,
  Loader2,
  Globe,
  Plug,
  Activity
} from 'lucide-react';
import { authApi, servicesApi, locationsApi } from '../services/api';
import ServicesAdminPanel from './ServicesAdminPanel';
import LocationsAdminPanel from './LocationsAdminPanel';
import ContactsAdminPanel from './ContactsAdminPanel';
import StatsAdminPanel from './StatsAdminPanel';
import HomepageAdminPanel from './HomepageAdminPanel';
import IntegrationsAdminPanel from './IntegrationsAdminPanel';
import StatusAdminPanel from './StatusAdminPanel';

type AdminSection = 'dashboard' | 'services' | 'locations' | 'stats' | 'contacts' | 'homepage' | 'integrations' | 'status';

const AdminDashboard: React.FC = () => {
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Navigation state
  const [currentSection, setCurrentSection] = useState<AdminSection>('dashboard');

  // Dashboard stats
  const [stats, setStats] = useState({
    services: 0,
    locations: 0,
    asns: 0,
    sites: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Check auth on mount
  useEffect(() => {
    if (authApi.isLoggedIn()) {
      setIsLoggedIn(true);
      loadDashboardStats();
    }
    setCheckingAuth(false);
  }, []);

  const loadDashboardStats = async () => {
    setLoadingStats(true);
    try {
      const [servicesRes, locationsRes] = await Promise.all([
        servicesApi.getAll(),
        locationsApi.getAll(),
      ]);
      
      let totalAsns = 0;
      let totalSites = 0;
      
      if (locationsRes.success && locationsRes.data) {
        locationsRes.data.forEach(loc => {
          totalAsns += loc.asnList?.length || 0;
          totalSites += loc.enabledSites?.length || 0;
        });
      }

      setStats({
        services: servicesRes.data?.length || 0,
        locations: locationsRes.data?.length || 0,
        asns: totalAsns,
        sites: totalSites,
      });
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
    setLoadingStats(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    
    const result = await authApi.login(email, password);
    if (result.success) {
      setIsLoggedIn(true);
      loadDashboardStats();
    } else {
      setLoginError(result.error || 'Login failed');
    }
    setLoginLoading(false);
  };

  const handleLogout = () => {
    authApi.logout();
    setIsLoggedIn(false);
    setCurrentSection('dashboard');
  };

  // Loading state
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#F20732]" />
      </div>
    );
  }

  // Login form
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-xl p-8 w-full max-w-md border border-gray-700">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#F20732] rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-2xl font-black">MX</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
            <p className="text-gray-400 mt-2">Sign in to manage your website</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#F20732]"
                placeholder="admin@mx-ix.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#F20732]"
                placeholder="••••••••"
              />
            </div>

            {loginError && (
              <div className="text-red-400 text-sm text-center">{loginError}</div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-[#F20732] text-white font-bold rounded-lg hover:bg-[#C00628] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loginLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Render section content
  const renderSection = () => {
    switch (currentSection) {
      case 'services':
        return <ServicesAdminPanel embedded onBack={() => setCurrentSection('dashboard')} />;
      case 'locations':
        return <LocationsAdminPanel embedded onBack={() => setCurrentSection('dashboard')} />;
      case 'stats':
        return <StatsAdminPanel embedded onBack={() => setCurrentSection('dashboard')} />;
      case 'contacts':
        return <ContactsAdminPanel embedded onBack={() => setCurrentSection('dashboard')} />;
      case 'homepage':
        return <HomepageAdminPanel embedded onBack={() => setCurrentSection('dashboard')} />;
      case 'integrations':
        return <IntegrationsAdminPanel embedded onBack={() => setCurrentSection('dashboard')} />;
      case 'status':
        return <StatusAdminPanel embedded onBack={() => setCurrentSection('dashboard')} />;
      default:
        return null;
    }
  };

  // Dashboard with cards
  if (currentSection !== 'dashboard') {
    return renderSection();
  }

  const adminCards = [
    {
      id: 'services' as AdminSection,
      title: 'Services',
      description: 'Manage service categories and items',
      icon: Server,
      count: stats.services,
      countLabel: 'categories',
      color: 'from-blue-500 to-blue-600',
    },
    {
      id: 'locations' as AdminSection,
      title: 'Locations',
      description: 'Manage data centers, ASNs, and sites',
      icon: MapPin,
      count: stats.locations,
      countLabel: 'locations',
      color: 'from-green-500 to-green-600',
    },
    {
      id: 'homepage' as AdminSection,
      title: 'Homepage',
      description: 'Edit global map and hero content',
      icon: Home,
      count: null,
      countLabel: '',
      color: 'from-purple-500 to-purple-600',
    },
    {
      id: 'stats' as AdminSection,
      title: 'Statistics',
      description: 'Configure network stats display',
      icon: BarChart3,
      count: null,
      countLabel: '',
      color: 'from-orange-500 to-orange-600',
    },
    {
      id: 'contacts' as AdminSection,
      title: 'Contacts',
      description: 'Manage contact information',
      icon: Phone,
      count: null,
      countLabel: '',
      color: 'from-pink-500 to-pink-600',
    },
    {
      id: 'integrations' as AdminSection,
      title: 'Integrations',
      description: 'Connect Grafana & Zabbix for live metrics',
      icon: Plug,
      count: null,
      countLabel: '',
      color: 'from-red-500 to-red-600',
    },
    {
      id: 'status' as AdminSection,
      title: 'System Status',
      description: 'Manage status components & incidents',
      icon: Activity,
      count: null,
      countLabel: '',
      color: 'from-emerald-500 to-emerald-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-[#F20732] rounded-lg flex items-center justify-center">
              <span className="text-white font-black">MX</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">Admin Dashboard</h1>
              <p className="text-gray-400 text-sm">MX-IX Control Panel</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Services" value={stats.services} loading={loadingStats} />
          <StatCard label="Locations" value={stats.locations} loading={loadingStats} />
          <StatCard label="ASNs" value={stats.asns} loading={loadingStats} />
          <StatCard label="Sites" value={stats.sites} loading={loadingStats} />
        </div>

        {/* Admin Cards */}
        <h2 className="text-lg font-bold mb-4 text-gray-300">Manage Sections</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminCards.map(card => (
            <button
              key={card.id}
              onClick={() => setCurrentSection(card.id)}
              className="bg-gray-800 rounded-xl border border-gray-700 p-6 text-left hover:border-gray-500 transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                  <card.icon className="w-6 h-6 text-white" />
                </div>
                <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-lg font-bold mb-1">{card.title}</h3>
              <p className="text-gray-400 text-sm mb-3">{card.description}</p>
              {card.count !== null && (
                <div className="text-sm text-gray-500">
                  <span className="text-[#F20732] font-bold">{card.count}</span> {card.countLabel}
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Quick Links */}
        <div className="mt-8 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Quick Links</h3>
          <div className="flex flex-wrap gap-3">
            <a href="/" target="_blank" className="px-3 py-1.5 bg-gray-700 rounded text-sm hover:bg-gray-600 transition-colors flex items-center gap-2">
              <Globe className="w-4 h-4" /> View Website
            </a>
            <a href="/services" target="_blank" className="px-3 py-1.5 bg-gray-700 rounded text-sm hover:bg-gray-600 transition-colors">
              Services Page
            </a>
            <a href="/locations" target="_blank" className="px-3 py-1.5 bg-gray-700 rounded text-sm hover:bg-gray-600 transition-colors">
              Locations Page
            </a>
          </div>
        </div>
      </main>
    </div>
  );
};

// Stat Card Component
const StatCard: React.FC<{ label: string; value: number; loading: boolean }> = ({ label, value, loading }) => (
  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
    <div className="text-gray-400 text-xs uppercase tracking-wide mb-1">{label}</div>
    {loading ? (
      <div className="h-8 w-16 bg-gray-700 animate-pulse rounded"></div>
    ) : (
      <div className="text-2xl font-bold text-white">{value}</div>
    )}
  </div>
);

// Coming Soon Placeholder
const ComingSoon: React.FC<{ title: string; onBack: () => void }> = ({ title, onBack }) => (
  <div className="min-h-screen bg-gray-900 text-white">
    <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
          <ChevronRight className="w-5 h-5 rotate-180" />
        </button>
        <h1 className="text-xl font-bold">{title}</h1>
      </div>
    </header>
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <Settings className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-400">Coming Soon</h2>
        <p className="text-gray-500 mt-2">This section is under development</p>
        <button 
          onClick={onBack}
          className="mt-6 px-6 py-2 bg-[#F20732] rounded-lg hover:bg-[#C00628] transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  </div>
);

export default AdminDashboard;
