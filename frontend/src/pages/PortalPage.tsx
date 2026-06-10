import React, { useEffect, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { portalApi, PortalUserInfo, PortalOrgInfo } from '../services/api';
import PortalLogin from './portal/PortalLogin';
import PortalShell from './portal/PortalShell';

interface PortalPageProps {
  onNavigate?: (page: string) => void;
}

/**
 * Customer Member Portal entry point.
 * Handles customer auth (separate from admin) and renders either the
 * login/signup screen or the authenticated dashboard shell.
 */
const PortalPage: React.FC<PortalPageProps> = ({ onNavigate }) => {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<PortalUserInfo | null>(null);
  const [org, setOrg] = useState<PortalOrgInfo | null>(null);

  useEffect(() => {
    document.body.classList.add('dark-nav');
    return () => document.body.classList.remove('dark-nav');
  }, []);

  const loadSession = useCallback(async () => {
    if (!portalApi.isLoggedIn()) {
      setChecking(false);
      return;
    }
    const res = await portalApi.me();
    if (res.success && res.data) {
      setUser(res.data.user);
      setOrg(res.data.organization);
    } else {
      portalApi.logout();
    }
    setChecking(false);
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // React to session expiry from any portal API call
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setOrg(null);
    };
    window.addEventListener('portal-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('portal-unauthorized', handleUnauthorized);
  }, []);

  const handleAuthenticated = (u: PortalUserInfo, o: PortalOrgInfo) => {
    setUser(u);
    setOrg(o);
  };

  const handleLogout = () => {
    portalApi.logout();
    setUser(null);
    setOrg(null);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#F20732]" />
      </div>
    );
  }

  if (!user || !org) {
    return <PortalLogin onAuthenticated={handleAuthenticated} onNavigate={onNavigate} />;
  }

  return (
    <PortalShell
      user={user}
      org={org}
      onLogout={handleLogout}
      onNavigate={onNavigate}
      onOrgRefresh={(o) => setOrg(o)}
    />
  );
};

export default PortalPage;
