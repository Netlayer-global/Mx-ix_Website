import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  Server,
  MapPin,
  BarChart3,
  Phone,
  Home,
  LogOut,
  ChevronRight,
  Loader2,
  Globe,
  Plug,
  Activity,
  Users,
  Building2,
  ShoppingCart,
  LifeBuoy,
  ShieldCheck,
  ScrollText,
  Megaphone,
  Radar,
  Mail,
  Command,
  Menu,
  X,
} from 'lucide-react';
import { authApi, servicesApi, locationsApi } from '../services/api';

// Admin panels are code-split so the dashboard shell loads fast.
const ServicesAdminPanel = lazy(() => import('./ServicesAdminPanel'));
const LocationsAdminPanel = lazy(() => import('./LocationsAdminPanel'));
const ContactsAdminPanel = lazy(() => import('./ContactsAdminPanel'));
const StatsAdminPanel = lazy(() => import('./StatsAdminPanel'));
const HomepageAdminPanel = lazy(() => import('./HomepageAdminPanel'));
const IntegrationsAdminPanel = lazy(() => import('./IntegrationsAdminPanel'));
const StatusAdminPanel = lazy(() => import('./StatusAdminPanel'));
const MembersAdminPanel = lazy(() => import('./MembersAdminPanel'));
const CustomersAdminPanel = lazy(() => import('./CustomersAdminPanel'));
const OrdersAdminPanel = lazy(() => import('./OrdersAdminPanel'));
const SupportAdminPanel = lazy(() => import('./SupportAdminPanel'));
const AdminUsersPanel = lazy(() => import('./AdminUsersPanel'));
const AuditLogPanel = lazy(() => import('./AuditLogPanel'));
const AnnouncementsPanel = lazy(() => import('./AnnouncementsPanel'));
const EmailTemplatesPanel = lazy(() => import('./EmailTemplatesPanel'));
const NocDashboardPanel = lazy(() => import('./NocDashboardPanel'));
const RouteServersAdminPanel = lazy(() => import('./RouteServersAdminPanel'));

type AdminSection =
  | 'dashboard'
  | 'services'
  | 'locations'
  | 'stats'
  | 'contacts'
  | 'homepage'
  | 'integrations'
  | 'status'
  | 'members'
  | 'customers'
  | 'orders'
  | 'support'
  | 'adminusers'
  | 'audit'
  | 'announcements'
  | 'templates'
  | 'noc'
  | 'routeservers';

const SECTION_META: Record<AdminSection, { title: string; icon: React.ElementType; desc: string }> = {
  dashboard: { title: 'Overview', icon: Home, desc: 'Control panel summary' },
  customers: { title: 'Customers', icon: Building2, desc: 'Member accounts, approvals, ports & logins' },
  orders: { title: 'Orders', icon: ShoppingCart, desc: 'Port, upgrade & add-on requests' },
  support: { title: 'Support Desk', icon: LifeBuoy, desc: 'Member tickets, replies & SLA' },
  noc: { title: 'NOC Operations', icon: Radar, desc: 'Capacity, health & at-risk members' },
  services: { title: 'Services', icon: Server, desc: 'Service categories and items' },
  locations: { title: 'Locations', icon: MapPin, desc: 'Data centers, ASNs and sites' },
  homepage: { title: 'Homepage', icon: Home, desc: 'Global map and hero content' },
  stats: { title: 'Statistics', icon: BarChart3, desc: 'Network stats display' },
  contacts: { title: 'Contacts', icon: Phone, desc: 'Contact information' },
  members: { title: 'Members', icon: Users, desc: 'Public member directory' },
  status: { title: 'System Status', icon: Activity, desc: 'Status components & incidents' },
  routeservers: { title: 'Route Servers', icon: Server, desc: 'Alice-LG sources & config' },
  announcements: { title: 'Announcements', icon: Megaphone, desc: 'Broadcast to members' },
  integrations: { title: 'Integrations', icon: Plug, desc: 'Grafana, Zabbix, IXP Manager, Zoho' },
  adminusers: { title: 'Admin Users', icon: ShieldCheck, desc: 'Role-based admin access' },
  audit: { title: 'Audit Log', icon: ScrollText, desc: 'Admin actions with diff' },
  templates: { title: 'Email Templates', icon: Mail, desc: 'Transactional email content' },
};

const NAV_GROUPS: { label: string; items: AdminSection[] }[] = [
  { label: '', items: ['dashboard'] },
  { label: 'Members', items: ['customers', 'orders', 'support', 'noc'] },
  { label: 'Website', items: ['services', 'locations', 'homepage', 'stats', 'contacts', 'members'] },
  { label: 'Operations', items: ['status', 'routeservers', 'announcements', 'integrations'] },
  { label: 'System', items: ['adminusers', 'audit', 'templates'] },
];

// Section access by admin role (super-admin/admin see everything).
const ROLE_ACCESS: Record<string, AdminSection[]> = {
  noc: ['customers', 'orders', 'support', 'status', 'noc', 'announcements', 'locations', 'routeservers', 'integrations'],
  support: ['customers', 'support'],
  billing: ['customers', 'orders'],
  editor: ['services', 'locations', 'homepage', 'stats', 'contacts', 'members'],
};

const AdminDashboard: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [currentSection, setCurrentSection] = useState<AdminSection>('dashboard');
  const [role, setRole] = useState<string>('admin');
  const [name, setName] = useState<string>('Admin');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [stats, setStats] = useState({ services: 0, locations: 0, asns: 0, sites: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  const loadMe = () =>
    authApi.getMe().then((r) => {
      if (r.success && r.data?.role) setRole(r.data.role);
      if (r.success && r.data?.name) setName(r.data.name);
    });

  useEffect(() => {
    if (authApi.isLoggedIn()) {
      setIsLoggedIn(true);
      loadDashboardStats();
      loadMe();
    }
    setCheckingAuth(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === 'Escape') setPaletteOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const loadDashboardStats = async () => {
    setLoadingStats(true);
    try {
      const [servicesRes, locationsRes] = await Promise.all([servicesApi.getAll(), locationsApi.getAll()]);
      let totalAsns = 0;
      let totalSites = 0;
      if (locationsRes.success && locationsRes.data) {
        locationsRes.data.forEach((loc) => {
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
      loadMe();
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

  const isFullAdmin = role === 'admin' || role === 'super-admin';
  const canAccess = (id: AdminSection) =>
    id === 'dashboard' || isFullAdmin || (ROLE_ACCESS[role] || []).includes(id);

  const go = (id: AdminSection) => {
    setCurrentSection(id);
    setMobileOpen(false);
  };

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
            <p className="text-gray-400 mt-2">Sign in to manage your platform</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#F20732]" placeholder="admin@mx-ix.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#F20732]" placeholder="••••••••" />
            </div>
            {loginError && <div className="text-red-400 text-sm text-center">{loginError}</div>}
            <button type="submit" disabled={loginLoading} className="w-full py-3 bg-[#F20732] text-white font-bold rounded-lg hover:bg-[#C00628] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {loginLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const renderSection = () => {
    switch (currentSection) {
      case 'services': return <ServicesAdminPanel embedded />;
      case 'locations': return <LocationsAdminPanel embedded />;
      case 'stats': return <StatsAdminPanel embedded />;
      case 'contacts': return <ContactsAdminPanel embedded />;
      case 'homepage': return <HomepageAdminPanel embedded />;
      case 'integrations': return <IntegrationsAdminPanel embedded />;
      case 'status': return <StatusAdminPanel embedded />;
      case 'members': return <MembersAdminPanel embedded />;
      case 'customers': return <CustomersAdminPanel embedded />;
      case 'orders': return <OrdersAdminPanel embedded />;
      case 'support': return <SupportAdminPanel embedded />;
      case 'adminusers': return <AdminUsersPanel embedded />;
      case 'audit': return <AuditLogPanel embedded />;
      case 'announcements': return <AnnouncementsPanel embedded />;
      case 'templates': return <EmailTemplatesPanel embedded />;
      case 'noc': return <NocDashboardPanel embedded />;
      case 'routeservers': return <RouteServersAdminPanel embedded />;
      default: return null;
    }
  };

  const accessibleSections = (Object.keys(SECTION_META) as AdminSection[]).filter(canAccess);

  const SidebarContent = (
    <div className="flex flex-col h-full">
      <div className="px-6 py-6 border-b border-white/10">
        <button onClick={() => go('dashboard')} className="flex items-center gap-2">
          <img src="/assets/logo.png" alt="MX-IX" className="w-8 h-8 object-contain" />
          <span className="text-xl font-black tracking-tighter">MX-IX</span>
        </button>
        <span className="block mt-3 font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Control Panel</span>
      </div>

      <div className="px-6 py-5 border-b border-white/10">
        <p className="text-sm font-bold truncate">{name}</p>
        <span className="inline-block mt-1.5 px-2 py-0.5 bg-white/10 rounded text-[10px] font-mono uppercase tracking-wider text-gray-300">{role}</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter(canAccess);
          if (!items.length) return null;
          return (
            <div key={group.label || 'main'}>
              {group.label && (
                <p className="px-4 mb-1.5 font-mono text-label-sm tracking-mono uppercase text-gray-500">{group.label}</p>
              )}
              <div className="space-y-0.5">
                {items.map((id) => {
                  const meta = SECTION_META[id];
                  const active = currentSection === id;
                  return (
                    <button
                      key={id}
                      onClick={() => go(id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 font-mono text-label-sm tracking-mono uppercase transition-colors relative ${
                        active ? 'bg-white/5 text-white' : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
                      }`}
                    >
                      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#F20732] rounded-full" />}
                      <meta.icon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{meta.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/10 space-y-0.5">
        <button onClick={() => setPaletteOpen(true)} className="w-full flex items-center gap-3 px-4 py-2.5 font-mono text-label-sm tracking-mono uppercase text-gray-400 hover:text-white hover:bg-white/[0.03] transition-colors">
          <Command className="w-4 h-4" /> Search <span className="ml-auto text-[10px] text-gray-600">⌘K</span>
        </button>
        <a href="/" target="_blank" rel="noreferrer" className="w-full flex items-center gap-3 px-4 py-2.5 font-mono text-label-sm tracking-mono uppercase text-gray-400 hover:text-white hover:bg-white/[0.03] transition-colors">
          <Globe className="w-4 h-4" /> View Site
        </a>
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 font-mono text-label-sm tracking-mono uppercase text-gray-400 hover:text-[#F20732] hover:bg-white/[0.03] transition-colors">
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 text-ink flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-ink text-white fixed inset-y-0 left-0 z-30">
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-64 bg-ink text-white z-50 lg:hidden">
            {SidebarContent}
          </aside>
          <button onClick={() => setMobileOpen(false)} className="fixed top-4 right-4 z-50 p-2 text-white lg:hidden" aria-label="Close menu">
            <X className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Content */}
      <div className="flex-1 lg:ml-64 min-w-0 admin-light">
        {currentSection === 'dashboard' ? (
          <DashboardOverview
            name={name}
            stats={stats}
            loadingStats={loadingStats}
            sections={accessibleSections.filter((s) => s !== 'dashboard')}
            onPick={go}
          />
        ) : (
          <Suspense
            fallback={
              <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#F20732]" />
              </div>
            }
          >
            {renderSection()}
          </Suspense>
        )}
      </div>

      {paletteOpen && (
        <CommandPalette
          sections={accessibleSections.map((id) => ({ id, title: SECTION_META[id].title }))}
          onPick={(id) => {
            setPaletteOpen(false);
            go(id as AdminSection);
          }}
          onClose={() => setPaletteOpen(false)}
        />
      )}

      {/* Mobile menu FAB */}
      {!mobileOpen && (
        <button
          onClick={() => setMobileOpen(true)}
          className="lg:hidden fixed bottom-5 right-5 z-40 w-12 h-12 bg-[#F20732] rounded-full shadow-lg flex items-center justify-center"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-white" />
        </button>
      )}
    </div>
  );
};

// ── Overview (dashboard landing) ──
const DashboardOverview: React.FC<{
  name: string;
  stats: { services: number; locations: number; asns: number; sites: number };
  loadingStats: boolean;
  sections: AdminSection[];
  onPick: (id: AdminSection) => void;
}> = ({ name, stats, loadingStats, sections, onPick }) => (
  <main className="px-4 sm:px-6 lg:px-10 py-8 max-w-[1400px] mx-auto">
    <div className="mb-8">
      <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#F20732]">// Dashboard</span>
      <h1 className="text-3xl md:text-4xl font-black tracking-tighter mt-2">Welcome back, {name}</h1>
      <p className="text-gray-400 text-sm mt-2">Manage the MX-IX platform — members, operations, content and integrations.</p>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
      <StatCard label="Services" value={stats.services} loading={loadingStats} />
      <StatCard label="Locations" value={stats.locations} loading={loadingStats} />
      <StatCard label="ASNs" value={stats.asns} loading={loadingStats} />
      <StatCard label="Sites" value={stats.sites} loading={loadingStats} />
    </div>

    <h2 className="text-sm font-bold mb-4 text-gray-400 font-mono uppercase tracking-wider">Quick access</h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {sections.map((id) => {
        const meta = SECTION_META[id];
        return (
          <button
            key={id}
            onClick={() => onPick(id)}
            className="group bg-gray-800 rounded-xl border border-gray-700 p-5 text-left hover:border-gray-500 transition-all relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-0.5 bg-[#F20732] -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center group-hover:bg-[#F20732] transition-colors">
                <meta.icon className="w-5 h-5 text-white" />
              </div>
              <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="font-bold mb-1">{meta.title}</h3>
            <p className="text-gray-400 text-xs">{meta.desc}</p>
          </button>
        );
      })}
    </div>
  </main>
);

const StatCard: React.FC<{ label: string; value: number; loading: boolean }> = ({ label, value, loading }) => (
  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
    <div className="text-gray-400 text-xs uppercase tracking-wide mb-1 font-mono">{label}</div>
    {loading ? <div className="h-8 w-16 bg-gray-700 animate-pulse rounded" /> : <div className="text-2xl font-bold text-white">{value}</div>}
  </div>
);

// Command palette (Ctrl/Cmd+K)
const CommandPalette: React.FC<{
  sections: { id: string; title: string }[];
  onPick: (id: string) => void;
  onClose: () => void;
}> = ({ sections, onPick, onClose }) => {
  const [q, setQ] = useState('');
  const filtered = sections.filter((s) => s.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-start justify-center pt-24 px-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-700">
          <Command className="w-4 h-4 text-gray-400" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Jump to a section…" className="flex-1 bg-transparent text-white text-sm focus:outline-none" />
          <span className="text-[10px] font-mono text-gray-500">ESC</span>
        </div>
        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.map((s) => (
            <button key={s.id} onClick={() => onPick(s.id)} className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-gray-500" /> {s.title}
            </button>
          ))}
          {!filtered.length && <p className="px-4 py-6 text-center text-sm text-gray-500">No matches</p>}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
