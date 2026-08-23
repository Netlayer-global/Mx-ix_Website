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
  LogIn,
  ArrowLeft,
  Network,
  Layers,
  Share2,
  Cable,
  EyeOff,
  Sparkles,
  Calendar,
  Grid3X3 as GridIcon,
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
const Customer360Panel = lazy(() => import('./Customer360Panel'));
const OrdersAdminPanel = lazy(() => import('./OrdersAdminPanel'));
const SupportAdminPanel = lazy(() => import('./SupportAdminPanel'));
const AdminUsersPanel = lazy(() => import('./AdminUsersPanel'));
const AuditLogPanel = lazy(() => import('./AuditLogPanel'));
const AnnouncementsPanel = lazy(() => import('./AnnouncementsPanel'));
const EmailTemplatesPanel = lazy(() => import('./EmailTemplatesPanel'));
const NocDashboardPanel = lazy(() => import('./NocDashboardPanel'));
const RouteServersAdminPanel = lazy(() => import('./RouteServersAdminPanel'));
const SitePromoAdminPanel = lazy(() => import('./SitePromoAdminPanel'));
const IxSetupWizard = lazy(() => import('./IxSetupWizard'));
const MaintenanceAdminPanel = lazy(() => import('./MaintenanceAdminPanel'));
const PeeringMatrixPanel = lazy(() => import('./PeeringMatrixPanel'));
// ── IXP fabric panels ──
const FabricAdminPanel = lazy(() => import('./FabricAdminPanel'));
const VlansAdminPanel = lazy(() => import('./VlansAdminPanel'));
const PeersAdminPanel = lazy(() => import('./PeersAdminPanel'));
const BirdAdminPanel = lazy(() => import('./BirdAdminPanel'));
const PeeringDbAdminPanel = lazy(() => import('./PeeringDbAdminPanel'));
const PatchPanelsAdminPanel = lazy(() => import('./PatchPanelsAdminPanel'));
const CoreBundlesAdminPanel = lazy(() => import('./CoreBundlesAdminPanel'));
const PageVisibilityAdminPanel = lazy(() => import('./PageVisibilityAdminPanel'));

type AdminSection =
  | 'dashboard'
  | 'services'
  | 'locations'
  | 'stats'
  | 'contacts'
  | 'homepage'
  | 'pagevisibility'
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
  | 'routeservers'
  | 'fabric'
  | 'vlans'
  | 'peers'
  | 'bird'
  | 'peeringdb'
  | 'patchpanels'
  | 'corebundles'
  | 'promo'
  | 'ixsetup'
  | 'maintenance'
  | 'peeringmatrix';

const SECTION_META: Record<AdminSection, { title: string; icon: React.ElementType; desc: string }> = {
  dashboard: { title: 'Overview', icon: Home, desc: 'Control panel summary' },
  customers: { title: 'Customers', icon: Building2, desc: 'Member accounts, approvals, ports & logins' },
  orders: { title: 'Orders', icon: ShoppingCart, desc: 'Port, upgrade & add-on requests' },
  support: { title: 'Support Desk', icon: LifeBuoy, desc: 'Member tickets, replies & SLA' },
  noc: { title: 'NOC Operations', icon: Radar, desc: 'Capacity, health & at-risk members' },
  services: { title: 'Services', icon: Server, desc: 'Service categories and items' },
  locations: { title: 'Locations', icon: MapPin, desc: 'Data centers, ASNs and sites' },
  homepage: { title: 'Homepage', icon: Home, desc: 'Global map and hero content' },
  pagevisibility: { title: 'Page Visibility', icon: EyeOff, desc: 'Show or hide public website pages' },
  stats: { title: 'Statistics', icon: BarChart3, desc: 'Network stats display' },
  contacts: { title: 'Contacts', icon: Phone, desc: 'Contact information' },
  members: { title: 'Members', icon: Users, desc: 'Public member directory' },
  status: { title: 'System Status', icon: Activity, desc: 'Status components & incidents' },
  routeservers: { title: 'Route Servers', icon: Server, desc: 'Alice-LG sources & config' },
  fabric: { title: 'Infrastructure', icon: Network, desc: 'IXPs, data centres, racks, devices & ports' },
  vlans: { title: 'VLANs & IPs', icon: Layers, desc: 'Peering LANs, quarantine VLANs & address pools' },
  peers: { title: 'Connections & Peers', icon: Share2, desc: 'Member LAGs, BGP peers & provisioning' },
  bird: { title: 'BIRD Config', icon: Cable, desc: 'Route-server config, deploy, IRRDB & rollback' },
  peeringdb: { title: 'PeeringDB', icon: Globe, desc: 'ASN lookup, sync & participant reconciliation' },
  patchpanels: { title: 'Patch Panels', icon: Cable, desc: 'Cross-connects, LOAs & fibre lifecycle' },
  corebundles: { title: 'Core Links', icon: Network, desc: 'Inter-switch trunks & fabric capacity' },
  announcements: { title: 'Announcements', icon: Megaphone, desc: 'Broadcast to members' },
  integrations: { title: 'Integrations', icon: Plug, desc: 'Grafana, Zabbix, IXP Manager, Zoho' },
  adminusers: { title: 'Admin Users', icon: ShieldCheck, desc: 'Role-based admin access' },
  audit: { title: 'Audit Log', icon: ScrollText, desc: 'Admin actions with diff' },
  templates: { title: 'Email Templates', icon: Mail, desc: 'Transactional email content' },
  promo: { title: 'Site Announcement', icon: Megaphone, desc: 'Headline bar & entry popup on the website' },
  ixsetup: { title: 'IX Setup', icon: Sparkles, desc: 'Guided setup: infrastructure → facility → rack → device → VLAN → RS' },
  maintenance: { title: 'Maintenance', icon: Calendar, desc: 'Planned maintenance windows & notifications' },
  peeringmatrix: { title: 'Peering Matrix', icon: GridIcon, desc: 'Member-to-member connectivity heatmap' },
};

const NAV_GROUPS: { label: string; items: AdminSection[] }[] = [
  { label: '', items: ['dashboard'] },
  { label: 'Members', items: ['customers', 'orders', 'support', 'noc'] },
  { label: 'IX Operations', items: ['ixsetup', 'fabric', 'vlans', 'peers', 'bird', 'peeringdb', 'patchpanels', 'corebundles', 'maintenance', 'peeringmatrix', 'routeservers', 'status'] },
  { label: 'Website', items: ['promo', 'services', 'locations', 'homepage', 'pagevisibility', 'stats', 'contacts', 'members'] },
  { label: 'System', items: ['announcements', 'integrations', 'adminusers', 'audit', 'templates'] },
];

// Section access by admin role (super-admin/admin see everything).
const ROLE_ACCESS: Record<string, AdminSection[]> = {
  noc: ['customers', 'orders', 'support', 'status', 'noc', 'announcements', 'locations', 'routeservers', 'fabric', 'vlans', 'peers', 'bird', 'peeringdb', 'patchpanels', 'corebundles', 'maintenance', 'peeringmatrix', 'integrations', 'members'],
  support: ['customers', 'support'],
  billing: ['customers', 'orders'],
  editor: ['promo', 'services', 'locations', 'homepage', 'pagevisibility', 'stats', 'contacts', 'members'],
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
  const [provisionContext, setProvisionContext] = useState<any>(null);
  const [customer360Id, setCustomer360Id] = useState<string | null>(null);

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
      <div className="min-h-screen bg-ink flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#F20732]" />
      </div>
    );
  }

  // Login form — mirrors the member/portal login styling
  if (!isLoggedIn) {
    const inputClass =
      'w-full bg-white/5 border border-white/15 text-white placeholder-gray-500 px-4 py-3 font-mono text-sm focus:outline-none focus:border-[#F20732] transition-colors';
    return (
      <div className="min-h-screen bg-ink text-white relative overflow-hidden flex items-center justify-center px-6 py-20">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#F20732]/15 blur-[120px]"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-[#F20732]/10 blur-[120px]"></div>

        <button
          onClick={() => { window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }}
          className="absolute top-6 left-6 inline-flex items-center gap-2 font-mono text-label-sm tracking-mono uppercase text-gray-500 hover:text-white transition-colors hover-trigger"
        >
          <ArrowLeft className="w-4 h-4" /> MX-IX
        </button>

        <div className="relative w-full max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <LogIn className="w-4 h-4 text-[#F20732]" />
            <span className="eyebrow">Admin Panel</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-[0.95] mb-4">
            ADMIN <span className="text-[#F20732]">LOGIN</span>
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-8">
            Manage services, members, orders and the MX-IX platform.
          </p>

          <form className="space-y-3" onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="admin@mx-ix.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              className={inputClass}
            />
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className={inputClass}
            />

            {loginError && <p className="text-[#F20732] font-mono text-xs">{loginError}</p>}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-[#F20732] text-white px-6 py-3.5 font-mono text-label-sm font-bold tracking-mono uppercase hover:bg-white hover:text-ink transition-colors disabled:opacity-60 flex items-center justify-center gap-2 hover-trigger"
            >
              {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
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
      case 'pagevisibility': return <PageVisibilityAdminPanel embedded />;
      case 'integrations': return <IntegrationsAdminPanel embedded />;
      case 'status': return <StatusAdminPanel embedded />;
      case 'members': return <MembersAdminPanel embedded />;
      case 'customers': return customer360Id
        ? <Customer360Panel embedded orgId={customer360Id} onBack={() => setCustomer360Id(null)} onProvision={(id, name) => { setProvisionContext({ orgId: id, orgName: name }); go('peers' as AdminSection); }} />
        : <CustomersAdminPanel embedded onSelectCustomer={(id: string) => setCustomer360Id(id)} />;
      case 'orders': return <OrdersAdminPanel embedded onNavigateSection={(section, ctx) => { setProvisionContext(ctx); go(section as AdminSection); }} />;
      case 'support': return <SupportAdminPanel embedded />;
      case 'adminusers': return <AdminUsersPanel embedded />;
      case 'audit': return <AuditLogPanel embedded />;
      case 'announcements': return <AnnouncementsPanel embedded />;
      case 'templates': return <EmailTemplatesPanel embedded />;
      case 'noc': return <NocDashboardPanel embedded />;
      case 'routeservers': return <RouteServersAdminPanel embedded />;
      case 'promo': return <SitePromoAdminPanel embedded />;
      case 'ixsetup': return <IxSetupWizard embedded onNavigateSection={(s) => go(s as AdminSection)} />;
      case 'maintenance': return <MaintenanceAdminPanel embedded />;
      case 'peeringmatrix': return <PeeringMatrixPanel embedded />;
      case 'fabric': return <FabricAdminPanel embedded />;
      case 'vlans': return <VlansAdminPanel embedded />;
      case 'peers': return <PeersAdminPanel embedded provisionContext={provisionContext} onProvisionDone={() => setProvisionContext(null)} />;
      case 'bird': return <BirdAdminPanel embedded />;
      case 'peeringdb': return <PeeringDbAdminPanel embedded />;
      case 'patchpanels': return <PatchPanelsAdminPanel embedded />;
      case 'corebundles': return <CoreBundlesAdminPanel embedded />;
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
        <span className="eyebrow mt-3">Control Panel</span>
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
                <p className="px-4 mb-1.5 font-mono text-label-sm tracking-mono uppercase text-white">{group.label}</p>
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
                        active ? 'bg-white/5 text-white' : 'text-white hover:text-white hover:bg-white/[0.03]'
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
        <button onClick={() => setPaletteOpen(true)} className="w-full flex items-center gap-3 px-4 py-2.5 font-mono text-label-sm tracking-mono uppercase text-white hover:text-white hover:bg-white/[0.03] transition-colors">
          <Command className="w-4 h-4" /> Search <span className="ml-auto text-[10px] text-gray-600">⌘K</span>
        </button>
        <a href="/" target="_blank" rel="noreferrer" className="w-full flex items-center gap-3 px-4 py-2.5 font-mono text-label-sm tracking-mono uppercase text-white hover:text-white hover:bg-white/[0.03] transition-colors">
          <Globe className="w-4 h-4" /> View Site
        </a>
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 font-mono text-label-sm tracking-mono uppercase text-white hover:text-[#F20732] hover:bg-white/[0.03] transition-colors">
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
      <span className="eyebrow">Dashboard</span>
      <h1 className="text-3xl md:text-4xl font-black tracking-tighter mt-2">Welcome back, {name}</h1>
      <p className="text-gray-500 text-sm mt-2">Manage the MX-IX platform — members, operations, content and integrations.</p>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
      <StatCard label="Services" value={stats.services} loading={loadingStats} />
      <StatCard label="Locations" value={stats.locations} loading={loadingStats} />
      <StatCard label="ASNs" value={stats.asns} loading={loadingStats} />
      <StatCard label="Sites" value={stats.sites} loading={loadingStats} />
    </div>

    <h2 className="text-sm font-bold mb-4 text-gray-500 font-mono uppercase tracking-wider">Quick access</h2>
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
            <p className="text-gray-500 text-xs">{meta.desc}</p>
          </button>
        );
      })}
    </div>
  </main>
);

const StatCard: React.FC<{ label: string; value: number; loading: boolean }> = ({ label, value, loading }) => (
  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
    <div className="text-gray-500 text-xs uppercase tracking-wide mb-1 font-mono">{label}</div>
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
          <Command className="w-4 h-4 text-gray-500" />
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
