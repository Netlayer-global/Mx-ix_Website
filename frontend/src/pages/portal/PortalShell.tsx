import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard,
  Network,
  Share2,
  BarChart3,
  ShoppingCart,
  Receipt,
  LifeBuoy,
  Bell,
  ShieldOff,
  Users,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  ExternalLink,
  Check,
} from 'lucide-react';
import { PortalUserInfo, PortalOrgInfo, PortalRole, portalNotificationsApi, NotificationItem } from '../../services/api';
import PortalOverview from './PortalOverview';
import PortalPorts from './PortalPorts';
import PortalPeering from './PortalPeering';
import PortalTraffic from './PortalTraffic';
import PortalServices from './PortalServices';
import PortalBilling from './PortalBilling';
import PortalSupport from './PortalSupport';
import PortalAlerts from './PortalAlerts';
import PortalBlackhole from './PortalBlackhole';
import PortalTeam from './PortalTeam';
import PortalSettings from './PortalSettings';

type Section =
  | 'overview'
  | 'ports'
  | 'peering'
  | 'traffic'
  | 'services'
  | 'billing'
  | 'support'
  | 'alerts'
  | 'blackholing'
  | 'team'
  | 'settings';

interface Props {
  user: PortalUserInfo;
  org: PortalOrgInfo;
  onLogout: () => void;
  onNavigate?: (page: string) => void;
  onOrgRefresh?: (org: PortalOrgInfo) => void;
}

const NAV: { id: Section; label: string; icon: React.ElementType; roles?: PortalRole[] }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'ports', label: 'My Connections', icon: Network },
  { id: 'peering', label: 'Peering', icon: Share2 },
  { id: 'traffic', label: 'Traffic', icon: BarChart3 },
  { id: 'services', label: 'Services', icon: ShoppingCart },
  { id: 'billing', label: 'Billing', icon: Receipt, roles: ['admin', 'billing'] },
  { id: 'support', label: 'Support', icon: LifeBuoy },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'blackholing', label: 'Blackholing', icon: ShieldOff },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

const PortalShell: React.FC<Props> = ({ user, org, onLogout, onNavigate, onOrgRefresh }) => {
  const [section, setSection] = useState<Section>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const loadNotifications = useCallback(async () => {
    const res = await portalNotificationsApi.list();
    if (res.success && res.data) {
      setNotifications(res.data.notifications);
      setUnread(res.data.unread);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    try {
      const es = new EventSource(portalNotificationsApi.streamUrl());
      es.addEventListener('notification', (e: MessageEvent) => {
        try {
          const n = JSON.parse(e.data) as NotificationItem;
          setNotifications((prev) => [n, ...prev].slice(0, 100));
          setUnread((u) => u + 1);
        } catch {
          /* ignore */
        }
      });
      es.onerror = () => {
        /* browser auto-reconnects */
      };
      esRef.current = es;
    } catch {
      /* SSE unsupported */
    }
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [loadNotifications]);

  const markAllRead = async () => {
    await portalNotificationsApi.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  const openNotification = async (n: NotificationItem) => {
    if (!n.read) {
      await portalNotificationsApi.markRead(n._id);
      setNotifications((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
    }
    setBellOpen(false);
    if (n.link && NAV.some((nav) => nav.id === n.link)) setSection(n.link as Section);
  };

  const renderSection = () => {
    switch (section) {
      case 'overview':
        return <PortalOverview org={org} onGoToSection={(s) => setSection(s as Section)} />;
      case 'ports':
        return <PortalPorts />;
      case 'peering':
        return <PortalPeering org={org} />;
      case 'traffic':
        return <PortalTraffic org={org} />;
      case 'services':
        return <PortalServices />;
      case 'billing':
        return <PortalBilling />;
      case 'support':
        return <PortalSupport />;
      case 'alerts':
        return <PortalAlerts />;
      case 'blackholing':
        return <PortalBlackhole />;
      case 'team':
        return <PortalTeam user={user} />;
      case 'settings':
        return <PortalSettings user={user} org={org} onOrgRefresh={onOrgRefresh} />;
      default:
        return null;
    }
  };

  const initials = (user.name || user.email).slice(0, 2).toUpperCase();
  const navItems = NAV.filter((n) => !n.roles || n.roles.includes(user.role));

  const SidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-6 py-6 border-b border-white/10">
        <button
          onClick={() => onNavigate?.('home')}
          className="flex items-center gap-2 hover-trigger group"
        >
          <img src="/assets/logo.png" alt="MX-IX" className="w-8 h-8 object-contain" />
          <span className="text-xl font-black tracking-tighter">MX-IX</span>
        </button>
        <span className="block mt-3 font-mono text-label-sm tracking-mono uppercase text-[#F20732]">
          // Member Portal
        </span>
      </div>

      {/* Org summary */}
      <div className="px-6 py-5 border-b border-white/10">
        <p className="text-sm font-bold truncate">{org.name}</p>
        <p className="font-mono text-xs text-gray-400 mt-1">
          {org.asn ? `AS${org.asn}` : 'No ASN set'}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active = section === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setSection(item.id);
                setMobileOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 font-mono text-label-sm tracking-mono uppercase transition-colors hover-trigger relative ${
                active ? 'bg-white/5 text-white' : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              {active && <span className="absolute left-0 top-0 h-full w-0.5 bg-[#F20732]" />}
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        <button
          onClick={() => onNavigate?.('status')}
          className="w-full flex items-center gap-3 px-4 py-2.5 font-mono text-label-sm tracking-mono uppercase text-gray-400 hover:text-white transition-colors hover-trigger"
        >
          <ExternalLink className="w-4 h-4" /> System Status
        </button>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 font-mono text-label-sm tracking-mono uppercase text-gray-400 hover:text-[#F20732] transition-colors hover-trigger"
        >
          <LogOut className="w-4 h-4" /> Sign Out
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

      {/* Mobile sidebar */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-64 bg-ink text-white z-50 lg:hidden">
            {SidebarContent}
          </aside>
        </>
      )}

      {/* Main */}
      <div className="flex-1 lg:ml-64 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-10 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden p-2 -ml-2 text-ink hover:text-[#F20732] transition-colors"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="font-mono text-label tracking-label uppercase text-gray-500">
                {NAV.find((n) => n.id === section)?.label}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              {/* Notification bell */}
              <div className="relative">
                <button
                  onClick={() => setBellOpen((v) => !v)}
                  className="relative p-2 text-gray-500 hover:text-ink transition-colors hover-trigger"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {unread > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 bg-[#F20732] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </button>

                {bellOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setBellOpen(false)} />
                    <div className="absolute right-0 mt-2 w-80 max-h-[28rem] overflow-y-auto bg-white border border-gray-200 shadow-elevated z-40">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 sticky top-0 bg-white">
                        <span className="font-mono text-label-sm tracking-label uppercase text-ink">Notifications</span>
                        {unread > 0 && (
                          <button
                            onClick={markAllRead}
                            className="flex items-center gap-1 font-mono text-label-sm tracking-mono uppercase text-gray-400 hover:text-[#F20732] transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" /> Mark all
                          </button>
                        )}
                      </div>
                      {notifications.length ? (
                        notifications.map((n) => (
                          <button
                            key={n._id}
                            onClick={() => openNotification(n)}
                            className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                              n.read ? '' : 'bg-[#F20732]/[0.03]'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[#F20732] mt-1.5 flex-shrink-0" />}
                              <div className={n.read ? 'pl-3.5' : ''}>
                                <p className="text-sm font-bold text-ink">{n.title}</p>
                                {n.body && <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>}
                                <p className="font-mono text-[10px] text-gray-400 mt-1">
                                  {new Date(n.createdAt).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))
                      ) : (
                        <p className="px-4 py-8 text-center font-mono text-label-sm tracking-mono uppercase text-gray-400">
                          No notifications
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold leading-tight">{user.name}</p>
                <p className="font-mono text-label-sm tracking-mono uppercase text-gray-400">{user.role}</p>
              </div>
              <div className="w-9 h-9 bg-ink text-white flex items-center justify-center font-mono text-xs font-bold">
                {initials}
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 sm:px-6 lg:px-10 py-8 max-w-[1400px] mx-auto">{renderSection()}</main>
      </div>

      {/* Close button for mobile drawer */}
      {mobileOpen && (
        <button
          onClick={() => setMobileOpen(false)}
          className="fixed top-4 right-4 z-50 p-2 text-white lg:hidden"
          aria-label="Close menu"
        >
          <X className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

export default PortalShell;
