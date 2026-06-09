import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import OrbitalLogoAdvanced from './components/OrbitalLogoAdvanced';
import Reveal from './components/Reveal';
import SectionCorners from './components/SectionCorners';
import CountUp from './components/CountUp';
import Preloader from './components/Preloader';
import Ticker from './components/Ticker';
import Capabilities from './components/Capabilities';
import RealTimeCapacity from './components/RealTimeCapacity';
import HowPeering from './components/HowPeering';
import { useMagnetic, useParallax } from './shared/interactions';
import { AdminProvider, useAdmin } from './contexts/AdminContext';

// Code-split pages & heavy components (loaded on demand)
const LocationsPage = lazy(() => import('./pages/LocationsPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const ServicesPage = lazy(() => import('./pages/ServicesPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const StatsPage = lazy(() => import('./pages/StatsPage'));
const TechnicalPage = lazy(() => import('./pages/TechnicalPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const LookingGlassPage = lazy(() => import('./pages/LookingGlassPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const NetworksPage = lazy(() => import('./pages/NetworksPage'));
const StatusPage = lazy(() => import('./pages/StatusPage'));
const GlobalFabric = lazy(() => import('./components/GlobalFabric'));
const HeroNetworkMap = lazy(() => import('./components/HeroNetworkMap'));

// ── Routing maps (page id ⇄ URL path) ──
const PATH_BY_PAGE: Record<string, string> = {
  home: '/',
  about: '/about',
  services: '/services',
  locations: '/locations',
  networks: '/networks',
  stats: '/stats',
  pricing: '/pricing',
  contact: '/contact',
  technical: '/technical',
  lg: '/looking-glass',
  status: '/status',
  admin: '/admin',
};

const PAGE_BY_PATH: Record<string, string> = {
  '': 'home',
  about: 'about',
  services: 'services',
  locations: 'locations',
  networks: 'networks',
  stats: 'stats',
  pricing: 'pricing',
  contact: 'contact',
  technical: 'technical',
  'looking-glass': 'lg',
  status: 'status',
  admin: 'admin',
};

const PAGE_TITLES: Record<string, string> = {
  home: 'MX-IX — Carrier-Neutral Internet Exchange & Peering',
  about: 'About — MX-IX Internet Exchange',
  services: 'Services — Peering, Cloud Connect & DDoS Protection | MX-IX',
  locations: 'Locations — MX-IX Points of Presence',
  networks: 'Connected Networks — MX-IX Members',
  stats: 'Traffic Stats — MX-IX',
  pricing: 'Pricing — MX-IX Port & Peering Pricing',
  contact: 'Request a Port — MX-IX',
  technical: 'Technical Requirements — MX-IX',
  lg: 'Looking Glass — MX-IX Route Servers',
  status: 'System Status — MX-IX',
};

const PAGE_DESCRIPTIONS: Record<string, string> = {
  home: 'MX-IX is a carrier-neutral Internet Exchange where networks peer directly — lower latency, reduced transit costs and resilient interconnection.',
  about: 'MX-IX is a carrier- and data-center-neutral Internet Exchange. Learn about our mission to make interconnection simple, open and accessible.',
  services: 'Public and private peering, cloud connectivity and DDoS protection on the MX-IX fabric — everything your network needs to interconnect.',
  locations: 'MX-IX points of presence and data centers. Explore route servers, connected ASNs and enabled sites across our locations.',
  networks: 'Browse the networks peering at MX-IX — ASNs, peering policies and session status across our route servers.',
  stats: 'Real-time and historical traffic statistics for the MX-IX Internet Exchange.',
  pricing: 'Simple, scalable MX-IX port pricing from 1G to 400G. One connection unlocks the entire peering ecosystem — no traffic charges.',
  contact: 'Request a port at MX-IX. Tell us about your network and our team will share availability and pricing.',
  technical: 'Technical requirements, BGP configuration and operational standards for connecting to the MX-IX shared fabric.',
  lg: 'MX-IX Looking Glass — inspect BGP sessions, route servers and routing tables across the exchange in real time.',
  status: 'Live operational status of MX-IX route servers, peering fabric and locations, plus incident history.',
};

// Update document title + SEO meta tags for the current page
function applyPageMeta(page: string) {
  const origin = window.location.origin;
  const path = PATH_BY_PAGE[page] || '/';
  const title = PAGE_TITLES[page] || 'MX-IX — Carrier-Neutral Internet Exchange';
  const desc = PAGE_DESCRIPTIONS[page] || PAGE_DESCRIPTIONS.home;
  const url = `${origin}${path}`;

  document.title = title;

  const setMeta = (selector: string, attr: string, key: string, value: string) => {
    let el = document.head.querySelector(selector) as HTMLElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', value);
  };

  setMeta('meta[name="description"]', 'name', 'description', desc);
  setMeta('meta[property="og:title"]', 'property', 'og:title', title);
  setMeta('meta[property="og:description"]', 'property', 'og:description', desc);
  setMeta('meta[property="og:url"]', 'property', 'og:url', url);
  setMeta('meta[property="og:type"]', 'property', 'og:type', 'website');
  setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
  setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
  setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', desc);

  // canonical link
  let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}


// --- TYPES ---
interface AppData {
  latency: number;
  peers: number;
  capacity: number;
  locations: LocationData[];
}

interface LocationData {
  id: string;
  name: string;
  region: string;
  status: 'active' | 'maintenance' | 'planned';
  latency: string;
}

// --- MOCK DATA ---
const INITIAL_DATA: AppData = {
  latency: 0.4,
  peers: 4921,
  capacity: 124,
  locations: [
    { id: 'ams', name: 'AMSTERDAM', region: 'EU', status: 'active', latency: '0.8ms' },
    { id: 'nyc', name: 'NEW YORK', region: 'NA', status: 'active', latency: '1.2ms' },
    { id: 'sin', name: 'SINGAPORE', region: 'APAC', status: 'active', latency: '2.1ms' },
    { id: 'frk', name: 'FRANKFURT', region: 'EU', status: 'active', latency: '0.9ms' },
    { id: 'tyo', name: 'TOKYO', region: 'APAC', status: 'active', latency: '1.5ms' },
  ]
};

// --- CUSTOM HOOKS ---
const useCounterAnimation = (end: number, isFloat: boolean = false, duration: number = 2000) => {
  const [count, setCount] = useState('0');
  const elementRef = useRef<HTMLSpanElement>(null);
  const observer = useRef<IntersectionObserver | null>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) {
      setCount(isFloat ? end.toFixed(1) : Math.floor(end).toLocaleString());
      return;
    }

    if (elementRef.current) {
      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true;
            let start = 0;
            const increment = end / (duration / 16);

            const timer = setInterval(() => {
              start += increment;
              if (start >= end) {
                setCount(isFloat ? end.toFixed(1) : Math.floor(end).toLocaleString());
                clearInterval(timer);
              } else {
                setCount(isFloat ? start.toFixed(1) : Math.floor(start).toLocaleString());
              }
            }, 16);
          }
        },
        { threshold: 0.5 }
      );
      observer.current.observe(elementRef.current);
    }
    return () => observer.current?.disconnect();
  }, [end, duration, isFloat]);

  useEffect(() => {
    if (hasAnimated.current) {
      setCount(isFloat ? end.toFixed(1) : Math.floor(end).toLocaleString());
    }
  }, [end, isFloat]);

  return { count, elementRef };
};

const useMousePosition = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const updateMousePosition = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', updateMousePosition);
    return () => window.removeEventListener('mousemove', updateMousePosition);
  }, []);
  return mousePosition;
};

// --- SHARED COMPONENTS ---
const CustomCursor = () => {
  const { x, y } = useMousePosition();
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const handleMouseOver = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.hover-trigger')) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };
    document.addEventListener('mouseover', handleMouseOver);
    return () => document.removeEventListener('mouseover', handleMouseOver);
  }, []);

  return (
    <>
      <style>{`
        body { cursor: none; }
        a, button, input, select, textarea { cursor: none; }
      `}</style>
      <div
        className="fixed top-0 left-0 w-4 h-4 rounded-full bg-[#F20732] pointer-events-none z-[100] mix-blend-difference transition-transform duration-100 ease-out"
        style={{ transform: `translate(${x - 8}px, ${y - 8}px) scale(${isHovering ? 2.5 : 1})` }}
      />
      <div
        className="fixed top-0 left-0 w-8 h-8 rounded-full border border-[#F20732] pointer-events-none z-[100] transition-transform duration-300 ease-out"
        style={{ transform: `translate(${x - 16}px, ${y - 16}px) scale(${isHovering ? 1.5 : 1})` }}
      />
    </>
  );
};

const Navigation = ({ currentPage, setPage }: { currentPage: string, setPage: (p: string) => void }) => {
  const [scrolled, setScrolled] = useState(false);
  const [isDarkNav, setIsDarkNav] = useState(false);
  const [isLogoRotating, setIsLogoRotating] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const connectMagneticRef = useMagnetic<HTMLButtonElement>(0.3);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);

    // Check for dark-nav class
    const checkDarkNav = () => {
      setIsDarkNav(document.body.classList.contains('dark-nav'));
    };

    // Initial check
    checkDarkNav();

    // Watch for class changes
    const observer = new MutationObserver(checkDarkNav);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    // Trigger logo rotation on initial load
    setTimeout(() => {
      setIsLogoRotating(true);
      setTimeout(() => setIsLogoRotating(false), 1500);
    }, 500);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, []);

  // Close mobile menu when clicking outside or on navigation
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  const handleLogoClick = () => {
    setPage('home');
    setIsMobileMenuOpen(false);
  };

  const handleLogoHover = () => {
    if (!isLogoRotating) {
      setIsLogoRotating(true);
      setTimeout(() => setIsLogoRotating(false), 3000);
    }
  };

  const handleNavClick = (pageId: string) => {
    setPage(pageId);
    setIsMobileMenuOpen(false);
  };

  const navItems = [
    { id: 'about', label: 'ABOUT' },
    { id: 'services', label: 'SERVICES' },
    { id: 'locations', label: 'LOCATIONS' },
    { id: 'networks', label: 'NETWORKS' },
    { id: 'stats', label: 'STATS' },
  ];

  const resourceItems: { id: string; label: string; type: string; url?: string }[] = [
    { id: 'pricing', label: 'Pricing', type: 'internal' },
    { id: 'technical', label: 'Technical Requirements', type: 'internal' },
    { id: 'lg', label: 'Looking Glass', type: 'internal' },
    { id: 'status', label: 'Status Page', type: 'internal' },
  ];

  // Adjust colors based on dark mode and scroll state
  const getNavBg = () => {
    // When mobile menu is open, always use solid white background
    if (isMobileMenuOpen) return 'bg-white border-b border-gray-200';
    if (isDarkNav && !scrolled) return 'bg-black/50 backdrop-blur-md border-b border-white/10';
    if (scrolled) return 'bg-white/95 backdrop-blur-md border-b border-gray-200';
    return 'bg-transparent';
  };

  const getTextColor = () => {
    // When mobile menu is open, always use black text for visibility
    if (isMobileMenuOpen) return 'text-black';
    return isDarkNav && !scrolled ? 'text-white' : 'text-black';
  };

  const getNavItemBg = () => {
    if (isDarkNav && !scrolled) return 'bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20';
    return 'bg-white/60 backdrop-blur-md border-gray-100 hover:bg-white/80';
  };

  const getNavItemTextColor = (isActive: boolean) => {
    if (isDarkNav && !scrolled) {
      return isActive ? 'text-[#F20732]' : 'text-gray-300 hover:text-white';
    }
    return isActive ? 'text-[#F20732]' : 'text-gray-500 hover:text-black';
  };

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${getNavBg()} ${scrolled ? 'py-3' : 'py-6 md:py-8'}`}>
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 md:px-12 flex items-center justify-between h-14">
        {/* Logo */}
        <div className="flex-shrink-0 flex items-center justify-start z-50">
          <button onClick={handleLogoClick} onMouseEnter={handleLogoHover} className="flex items-center gap-1.5 hover-trigger group">
            <div className="flex items-center gap-1.5">
              <OrbitalLogoAdvanced isAnimating={false} />
              <span className={`font-bold tracking-tight text-xl sm:text-2xl ${getTextColor()}`}>MX-IX</span>
            </div>
          </button>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex flex-1 items-center justify-center px-4">
          <div className={`flex items-center gap-8 xl:gap-12 px-8 xl:px-12 py-3 rounded-full border shadow-sm transition-all duration-300 hover:shadow-md ${getNavItemBg()}`}>
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`
                  text-[11px] font-mono font-bold tracking-[0.15em] uppercase transition-all duration-300 hover-trigger relative group
                  ${getNavItemTextColor(currentPage === item.id)}
                `}
              >
                {item.label}
                <span className={`absolute -bottom-1 left-0 w-full h-[2px] bg-[#F20732] transform origin-left transition-transform duration-300 ease-out ${currentPage === item.id ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`}></span>
              </button>
            ))}

            {/* Resources Dropdown */}
            <div className="relative group/dropdown">
              <button
                className={`
                      text-[11px] font-mono font-bold tracking-[0.15em] uppercase transition-all duration-300 hover-trigger relative
                      ${getNavItemTextColor(currentPage === 'technical')} flex items-center gap-1
                    `}
              >
                RESOURCES
                <svg className="w-3 h-3 transition-transform duration-300 group-hover/dropdown:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>

              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-6 opacity-0 translate-y-2 pointer-events-none group-hover/dropdown:opacity-100 group-hover/dropdown:translate-y-0 group-hover/dropdown:pointer-events-auto transition-all duration-300">
                <div className="w-48 bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden py-1">
                  {resourceItems.map((item) => (
                    item.type === 'internal' ? (
                      <button
                        key={item.id}
                        onClick={() => {
                          setPage(item.id);
                          // Close dropdown by removing focus or moving mouse (handled by CSS hover)
                        }}
                        className="w-full text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-50 hover:text-[#F20732] transition-colors"
                      >
                        {item.label}
                      </button>
                    ) : (
                      <a
                        key={item.id}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-50 hover:text-[#F20732] transition-colors"
                      >
                        {item.label}
                      </a>
                    )
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Desktop Connect Button */}
        <div className="hidden lg:flex flex-shrink-0 items-center justify-end gap-6 z-50 min-w-[200px]">
          <button
            ref={connectMagneticRef}
            onClick={() => setPage('contact')}
            className="hover-trigger bg-[#F20732] text-white px-6 py-3 font-mono text-label-sm font-bold tracking-mono hover:bg-black transition-[transform,background-color,box-shadow] duration-200 flex items-center gap-3 group shadow-red-glow hover:shadow-elevated uppercase will-change-transform"
          >
            Connect <span className="text-sm leading-none mb-0.5 group-hover:translate-x-1 transition-transform">→</span>
          </button>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`lg:hidden z-[80] p-2 rounded-md transition-colors ${getTextColor()}`}
          aria-label="Toggle menu"
        >
          <div className="w-6 h-5 flex flex-col justify-between">
            <span className={`block h-0.5 w-full bg-current transition-all duration-300 ${isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
            <span className={`block h-0.5 w-full bg-current transition-all duration-300 ${isMobileMenuOpen ? 'opacity-0' : ''}`}></span>
            <span className={`block h-0.5 w-full bg-current transition-all duration-300 ${isMobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
          </div>
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop - higher z-index than nav bar to cover everything */}
          <div
            className="fixed inset-0 bg-black/90 z-[60] lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>

          {/* Mobile Menu Panel - highest z-index */}
          <div className="fixed top-0 right-0 h-full w-[280px] shadow-2xl z-[70] lg:hidden animate-in slide-in-from-right duration-300 border-l-2 border-gray-200" style={{ backgroundColor: '#ffffff', backdropFilter: 'none' }}>
            <div className="flex flex-col h-full pt-24 pb-8 px-6">
              {/* Navigation Items */}
              <nav className="flex-1 space-y-2">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full text-left px-4 py-4 rounded-lg font-mono text-sm font-bold tracking-wider uppercase transition-all duration-300 ${currentPage === item.id
                        ? 'bg-[#F20732] text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                      }`}
                  >
                    {item.label}
                  </button>
                ))}

                {/* Mobile Resources */}
                <div className="pt-2 pb-2 border-t border-gray-100">
                  <p className="px-4 text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-2">Resources</p>
                  {resourceItems.map((item) => (
                    item.type === 'internal' ? (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={`w-full text-left px-4 py-3 rounded-lg font-mono text-sm font-bold tracking-wider uppercase transition-all duration-300 ${currentPage === item.id
                            ? 'bg-[#F20732] text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                          }`}
                      >
                        {item.label}
                      </button>
                    ) : (
                      <a
                        key={item.id}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full text-left px-4 py-3 rounded-lg font-mono text-sm font-bold tracking-wider uppercase text-gray-700 hover:bg-gray-100 transition-all duration-300"
                      >
                        {item.label}
                      </a>
                    )
                  ))}
                </div>

              </nav>

              {/* Connect Button */}
              <button
                onClick={() => handleNavClick('contact')}
                className="w-full bg-[#F20732] text-white px-6 py-4 font-mono text-xs font-bold tracking-[0.2em] hover:bg-black transition-colors flex items-center justify-center gap-3 group shadow-lg shadow-[#F20732]/20 uppercase rounded-lg"
              >
                Connect <span className="text-sm leading-none group-hover:translate-x-1 transition-transform">→</span>
              </button>
            </div>
          </div>
        </>
      )}
    </nav>
  );
};

const Footer = ({ setPage }: { setPage: (p: string) => void }) => {
  const ctaMagneticRef = useMagnetic<HTMLButtonElement>(0.3);

  const companyLinks = [
    { label: 'About Us', page: 'about' },
    { label: 'Services', page: 'services' },
    { label: 'Locations', page: 'locations' },
    { label: 'Contact', page: 'contact' },
  ];

  const resourceLinks: { label: string; page?: string; url?: string }[] = [
    { label: 'Technical Requirements', page: 'technical' },
    { label: 'Network Stats', page: 'stats' },
    { label: 'Status Page', url: 'https://status.mx-ix.com' },
    { label: 'Looking Glass', url: 'http://lg.mx-ix.com/' },
  ];

  return (
    <footer className="relative overflow-hidden bg-[#0A0A0B] text-white z-10">
      {/* layered dark gradient for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#16161A] via-[#0A0A0B] to-black pointer-events-none"></div>
      {/* top hairline accent */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#F20732] to-transparent opacity-70"></div>
      {/* red glow */}
      <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#F20732]/15 blur-[110px] pointer-events-none"></div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12">

        {/* ── CTA BAND ───────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 py-10 border-b border-white/10">
          <div>
            <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732] mb-2.5 block">// Peer With Us</span>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight leading-tight">
              Ready to join the <span className="text-[#F20732]">Fabric</span>?
            </h2>
          </div>
          <button
            ref={ctaMagneticRef}
            onClick={() => setPage('contact')}
            className="hover-trigger self-start md:self-auto bg-[#F20732] text-white px-7 py-3.5 font-mono text-label-sm font-bold tracking-mono uppercase hover:bg-white hover:text-[#0A0A0B] transition-[transform,background-color,color,box-shadow] duration-200 flex items-center gap-3 group shadow-[0_8px_30px_-6px_rgba(242,7,50,0.4)] will-change-transform whitespace-nowrap"
          >
            Initialize Peering
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </button>
        </div>

        {/* ── MAIN GRID ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10 py-12">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <img src="/assets/logo.png" alt="MX-IX Logo" className="w-10 h-10 object-contain" />
              <span className="text-2xl font-black tracking-tighter leading-none">MX-IX</span>
            </div>
            <p className="max-w-xs text-gray-400 text-sm leading-relaxed font-light">
              The carrier-neutral Internet Exchange where networks meet to peer directly — faster, cheaper and more resilient interconnection.
            </p>
          </div>

          {/* Company */}
          <div className="lg:col-span-2">
            <h4 className="font-mono font-bold mb-4 uppercase tracking-label text-label-sm text-gray-500">Company</h4>
            <ul className="space-y-2.5 font-mono text-xs text-gray-300">
              {companyLinks.map((l) => (
                <li key={l.page}>
                  <button onClick={() => setPage(l.page)} className="hover:text-[#F20732] transition-colors hover-trigger flex items-center group">
                    <span className="w-0 group-hover:w-3.5 overflow-hidden transition-all duration-300 text-[#F20732]">→</span>
                    <span className="group-hover:translate-x-1 transition-transform">{l.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div className="lg:col-span-2">
            <h4 className="font-mono font-bold mb-4 uppercase tracking-label text-label-sm text-gray-500">Resources</h4>
            <ul className="space-y-2.5 font-mono text-xs text-gray-300">
              {resourceLinks.map((l) => (
                <li key={l.label}>
                  {l.page ? (
                    <button onClick={() => setPage(l.page!)} className="hover:text-[#F20732] transition-colors hover-trigger flex items-center group">
                      <span className="w-0 group-hover:w-3.5 overflow-hidden transition-all duration-300 text-[#F20732]">→</span>
                      <span className="group-hover:translate-x-1 transition-transform">{l.label}</span>
                    </button>
                  ) : (
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="hover:text-[#F20732] transition-colors hover-trigger flex items-center group">
                      <span className="w-0 group-hover:w-3.5 overflow-hidden transition-all duration-300 text-[#F20732]">↗</span>
                      <span className="group-hover:translate-x-1 transition-transform">{l.label}</span>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Office */}
          <div className="lg:col-span-3">
            <h4 className="font-mono font-bold mb-4 uppercase tracking-label text-label-sm text-gray-500">Registered Office</h4>
            <p className="font-mono text-xs text-gray-400 leading-relaxed">
              MX-IX Digital Infrastructure Pvt. Ltd.<br />
              Enkay Tower, Udyog Vihar Phase V,<br />
              Sector 19, Gurugram, India 122016
            </p>
          </div>
        </div>

        {/* ── BOTTOM BAR ─────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 py-6 border-t border-white/10">
          <span className="font-mono text-label-sm text-gray-500 uppercase tracking-label text-center md:text-left">
            © 2026 MX-IX Digital Infrastructure Pvt. Ltd. — All Rights Reserved
          </span>
        </div>
      </div>
    </footer>
  );
};

function AppContent() {
  const { networkStats, locations } = useAdmin();
  const heroParallaxRef = useParallax<HTMLDivElement>(22);

  // Path-based routing (real URLs so pages are crawlable / shareable)
  const getPageFromPath = () => {
    const seg = window.location.pathname.replace(/^\//, '').split('/')[0];
    return PAGE_BY_PATH[seg] ?? (seg || 'home');
  };

  const [page, setPage] = useState(getPageFromPath);
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('overview');

  const navigateTo = (newPage: string) => {
    const path = PATH_BY_PAGE[newPage] || `/${newPage}`;
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    setPage(newPage);
  };

  // Listen for browser back/forward
  useEffect(() => {
    const handlePop = () => setPage(getPageFromPath());
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  // Navigate when page changes (used by nav/footer links)
  const handleSetPage = (newPage: string) => navigateTo(newPage);

  // Update title + SEO meta per page
  useEffect(() => {
    applyPageMeta(page);
  }, [page]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  useEffect(() => {
    const handleNavigateToContact = (e: CustomEvent) => {
      const { city } = e.detail;
      setSelectedCity(city);
      navigateTo('contact');
    };

    const handleNavigateToLocations = (e: CustomEvent) => {
      const { locationId, section } = e.detail;
      setSelectedLocationId(locationId);
      setSelectedSection(section || 'overview');
      navigateTo('locations');
    };

    window.addEventListener('navigateToContact' as any, handleNavigateToContact);
    window.addEventListener('navigateToLocations' as any, handleNavigateToLocations);
    return () => {
      window.removeEventListener('navigateToContact' as any, handleNavigateToContact);
      window.removeEventListener('navigateToLocations' as any, handleNavigateToLocations);
    };
  }, []);

  const renderPage = () => {
    switch (page) {
      case 'home':
        return (
          <>
            <section className="relative min-h-screen pt-24 md:pt-20 flex flex-col border-b border-gray-200 bg-white z-10 overflow-hidden">
              <div className="flex-1 w-full max-w-[1920px] mx-auto px-6 md:px-12 relative z-10 py-12 lg:py-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 h-full items-center">
                  {/* Left side - Content */}
                  <div className="max-w-2xl">
                    <Reveal delay={80}>
                      <h1 className="text-6xl md:text-7xl lg:text-8xl font-black leading-[0.9] tracking-tighter mb-8 text-black">
                        INFRA<br />
                        <span className="text-[#F20732]">STRUCTURE</span><br />
                        <span className="text-transparent" style={{
                          WebkitTextStroke: '2px #000'
                        }}>EVOLVED</span>
                      </h1>
                    </Reveal>

                    <Reveal delay={200}>
                      <p className="max-w-xl text-gray-500 text-base md:text-lg leading-relaxed mb-12 font-light border-l-2 border-gray-100 pl-6">
                        The interconnection fabric where networks meet. Peer directly with ISPs, content and cloud providers across the MX-IX exchange — for faster, more reliable and more cost-effective traffic exchange.
                      </p>
                    </Reveal>

                    <div className="flex flex-col sm:flex-row gap-4 mb-16 lg:mb-0">
                    </div>
                  </div>

                  {/* Right side - Network Map Visualization */}
                  <div className="hidden lg:flex items-center justify-center h-[500px] xl:h-[600px] relative">
                    <div ref={heroParallaxRef} className="absolute inset-0 flex items-center justify-center will-change-transform">
                      <Suspense fallback={null}><HeroNetworkMap /></Suspense>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full border-t border-gray-200 bg-white/80 backdrop-blur-md relative z-10 corner-marks">
                <SectionCorners />
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-200 max-w-[1920px] mx-auto">
                  <Reveal className="p-8 lg:p-12 flex flex-col justify-center group hover:bg-gray-50 transition-colors hover-trigger relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732] transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
                    <div className="flex justify-between items-end mb-3">
                      <span className="font-mono text-label text-gray-400 uppercase tracking-label group-hover:text-black transition-colors">Locations</span>
                    </div>
                    <div className="text-5xl lg:text-6xl font-light tracking-tighter text-black flex items-baseline">
                      <CountUp value={networkStats.locationsCount ?? locations.length} />
                    </div>
                    <div className="mt-4 flex items-end gap-[3px] h-3 opacity-60 group-hover:opacity-100 transition-opacity" aria-hidden="true">
                      {[3, 6, 4, 8, 5, 9, 6, 10, 7, 11].map((h, i) => (
                        <span key={i} className="w-px bg-gray-300 group-hover:bg-[#F20732] transition-colors" style={{ height: `${h}px` }} />
                      ))}
                    </div>
                  </Reveal>

                  <Reveal delay={100} className="p-8 lg:p-12 flex flex-col justify-center group hover:bg-gray-50 transition-colors hover-trigger relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732] transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500 delay-75"></div>
                    <div className="flex justify-between items-end mb-3">
                      <span className="font-mono text-label text-gray-400 uppercase tracking-label group-hover:text-black transition-colors">Connected Data Centers</span>
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"></div>
                      </div>
                    </div>
                    <div className="text-5xl lg:text-6xl font-light tracking-tighter text-black">
                      <CountUp value={networkStats.activeNodes} />
                    </div>
                    <div className="mt-4 flex items-end gap-[3px] h-3 opacity-60 group-hover:opacity-100 transition-opacity" aria-hidden="true">
                      {[5, 7, 6, 9, 7, 10, 8, 6, 9, 11].map((h, i) => (
                        <span key={i} className="w-px bg-gray-300 group-hover:bg-[#F20732] transition-colors" style={{ height: `${h}px` }} />
                      ))}
                    </div>
                  </Reveal>

                  <Reveal delay={200} className="p-8 lg:p-12 flex flex-col justify-center group hover:bg-gray-50 transition-colors hover-trigger relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732] transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500 delay-150"></div>
                    <div className="flex justify-between items-end mb-3">
                      <span className="font-mono text-label text-gray-400 uppercase tracking-label group-hover:text-black transition-colors">Capacity</span>
                      <svg className="w-4 h-4 text-gray-300 group-hover:text-[#F20732] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    </div>
                    <div className="text-5xl lg:text-6xl font-light tracking-tighter text-black flex items-baseline">
                      <CountUp value={networkStats.throughput} /><span className="text-base ml-2 text-gray-400 font-mono font-bold tracking-label group-hover:text-[#F20732] transition-colors">Tbps</span>
                    </div>
                    <div className="mt-4 flex items-end gap-[3px] h-3 opacity-60 group-hover:opacity-100 transition-opacity" aria-hidden="true">
                      {[4, 6, 8, 7, 10, 9, 11, 8, 10, 12].map((h, i) => (
                        <span key={i} className="w-px bg-gray-300 group-hover:bg-[#F20732] transition-colors" style={{ height: `${h}px` }} />
                      ))}
                    </div>
                  </Reveal>
                </div>
              </div>
            </section>
            <Ticker
              items={[
                'Direct Peering',
                'Carrier-Neutral',
                'Multilateral Route Servers',
                'Lower Latency',
                'Reduced Transit Cost',
                '1G · 10G · 100G · 400G Ports',
                'DDoS Blackholing',
                '99.99% Uptime SLA',
              ]}
            />
            <RealTimeCapacity />
            <Capabilities />
            <HowPeering />
            <Suspense fallback={null}><GlobalFabric /></Suspense>
          </>
        );
      case 'about':
        return (
          <>
            <AboutPage />
          </>
        );
      case 'services':
        return <ServicesPage />;
      case 'locations':
        return <LocationsPage preSelectedLocation={selectedLocationId} preSelectedSection={selectedSection} />;
      case 'networks':
        return <NetworksPage onNavigate={handleSetPage} />;
      case 'stats':
        return <StatsPage />;
      case 'contact':
        return <ContactPage preSelectedCity={selectedCity} />;
      case 'technical':
        return <TechnicalPage />;
      case 'pricing':
        return <PricingPage onNavigate={handleSetPage} />;
      case 'lg':
        return <LookingGlassPage />;
      case 'status':
        return <StatusPage />;
      case 'admin':
        return <AdminDashboard />;
      default:
        return <NotFoundPage />;
    }
  };

  return (
    <div className="scroll-smooth bg-gray-50 text-black selection:bg-[#F20732] selection:text-white min-h-screen">

      <Preloader />

      {/* Film grain overlay (premium material texture) */}
      <div className="grain-overlay"></div>

      <div className="fixed inset-0 z-0 opacity-20 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-200 via-transparent to-transparent"></div>

      {/* Hide navigation on admin page - admin has its own header */}
      {page !== 'admin' && <Navigation currentPage={page} setPage={handleSetPage} />}

      <main className="relative z-10 min-h-screen">
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#F20732] border-t-transparent rounded-full animate-spin"></div></div>}>
          {renderPage()}
        </Suspense>
      </main>

      {/* Hide footer on admin page */}
      {page !== 'admin' && <Footer setPage={handleSetPage} />}
    </div>
  );
}

function App() {
  return (
    <AdminProvider>
      <AppContent />
    </AdminProvider>
  );
}

export default App;
