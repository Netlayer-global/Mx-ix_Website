import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import Reveal from './components/Reveal';
import SectionCorners from './components/SectionCorners';
import Preloader from './components/Preloader';
import Ticker from './components/Ticker';
import Capabilities from './components/Capabilities';
import RealTimeCapacity from './components/RealTimeCapacity';
import HowPeering from './components/HowPeering';
import FAQ from './components/FAQ';
import CTABand from './components/CTABand';
import { useMagnetic } from './shared/interactions';
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
const GoogleVppPage = lazy(() => import('./pages/GoogleVppPage'));
const ContentFabricPage = lazy(() => import('./pages/ContentFabricPage'));
const NetworksPage = lazy(() => import('./pages/NetworksPage'));
const MembersPage = lazy(() => import('./pages/MembersPage'));
const StatusPage = lazy(() => import('./pages/StatusPage'));
const PortalPage = lazy(() => import('./pages/PortalPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const GlobalFabric = lazy(() => import('./components/GlobalFabric'));

// ── Routing maps (page id ⇄ URL path) ──
const PATH_BY_PAGE: Record<string, string> = {
  home: '/',
  about: '/about',
  services: '/services',
  locations: '/locations',
  networks: '/networks',
  members: '/members',
  stats: '/stats',
  pricing: '/pricing',
  contact: '/contact',
  technical: '/technical',
  lg: '/looking-glass',
  status: '/status',
  'google-vpp': '/resources/google-vpp-program',
  'content-fabric': '/content-fabric',
  portal: '/portal',
  admin: '/admin',
  onboarding: '/onboarding',
  privacy: '/privacy',
  terms: '/terms',
};

const PAGE_BY_PATH: Record<string, string> = {
  '': 'home',
  about: 'about',
  services: 'services',
  locations: 'locations',
  networks: 'networks',
  members: 'members',
  stats: 'stats',
  pricing: 'pricing',
  contact: 'contact',
  technical: 'technical',
  'looking-glass': 'lg',
  status: 'status',
  'resources/google-vpp-program': 'google-vpp',
  'content-fabric': 'content-fabric',
  portal: 'portal',
  admin: 'admin',
  onboarding: 'onboarding',
  privacy: 'privacy',
  terms: 'terms',
};

// SEO-friendly link component: renders a real <a href> for crawlers,
// but intercepts clicks for SPA navigation (no full reload).
const NavLink = ({
  to,
  className,
  children,
  onClick,
  style,
  ...rest
}: {
  to: string;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
  [key: string]: any;
}) => {
  const href = PATH_BY_PAGE[to] || `/${to}`;
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Allow ctrl/cmd+click to open in new tab
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    if (onClick) onClick();
  };
  return (
    <a href={href} className={className} onClick={handleClick} style={style} {...rest}>
      {children}
    </a>
  );
};

const PAGE_TITLES: Record<string, string> = {
  home: 'MX-IX — Carrier-Neutral Internet Exchange & Peering',
  about: 'About — MX-IX Internet Exchange',
  services: 'Services — Peering, Cloud Connect & DDoS Protection | MX-IX',
  locations: 'Locations — MX-IX Points of Presence',
  networks: 'Connected Networks — MX-IX Members',
  members: 'Members — MX-IX Connected Networks',
  stats: 'Traffic Stats — MX-IX',
  pricing: 'Pricing — MX-IX Port & Peering Pricing',
  contact: 'Request a Port — MX-IX',
  technical: 'Technical Requirements — MX-IX',
  lg: 'Looking Glass — MX-IX Route Servers',
  status: 'System Status — MX-IX',
  'google-vpp': 'Google VPP Program — MX-IX',
  'content-fabric': 'Content Fabric — Aggregated Route Reach | MX-IX',
  portal: 'Member Portal — MX-IX',
  onboarding: 'Become a Member — MX-IX Onboarding',
  privacy: 'Privacy Policy — MX-IX',
  terms: 'Terms & Conditions — MX-IX',
};

const PAGE_DESCRIPTIONS: Record<string, string> = {
  home: 'MX-IX is a carrier-neutral Internet Exchange where networks peer directly — lower latency, reduced transit costs and resilient interconnection.',
  about: 'MX-IX is a carrier- and data-center-neutral Internet Exchange. Learn about our mission to make interconnection simple, open and accessible.',
  services: 'Public and private peering, cloud connectivity and DDoS protection on the MX-IX fabric — everything your network needs to interconnect.',
  locations: 'MX-IX points of presence and data centers. Explore route servers, connected ASNs and enabled sites across our locations.',
  networks: 'Browse the networks peering at MX-IX — ASNs, peering policies and session status across our route servers.',
  members: 'The networks connected to MX-IX — ISPs, content, cloud and enterprise networks peering across the exchange.',
  stats: 'Real-time and historical traffic statistics for the MX-IX Internet Exchange.',
  pricing: 'Simple, scalable MX-IX port pricing from 1G to 400G. One connection unlocks the entire peering ecosystem — no traffic charges.',
  contact: 'Request a port at MX-IX. Tell us about your network and our team will share availability and pricing.',
  technical: 'Technical requirements, BGP configuration and operational standards for connecting to the MX-IX shared fabric.',
  lg: 'MX-IX Looking Glass — inspect BGP sessions, route servers and routing tables across the exchange in real time.',
  status: 'Live operational status of MX-IX route servers, peering fabric and locations, plus incident history.',
  'google-vpp': 'Google’s Verified Peering Provider programme explained — what it unlocks, what Google looks for, and how peering at MX-IX supports your application.',
  'content-fabric': 'MX-IX Content Fabric — one managed BGP session that consolidates our peering reach and interconnection capacity into a single RPKI-validated route set.',
  portal: 'MX-IX Member Portal — manage your ports, peering sessions, traffic and account.',
  onboarding: 'Join MX-IX in a few quick steps — set up your member account and request your first port.',
  privacy: 'How MX-IX collects, uses, shares and protects your personal data.',
  terms: 'The terms governing your use of the MX-IX website, member portal and interconnection services.',
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
  const ogImage = `${origin}/assets/logo-mark.png`;
  setMeta('meta[property="og:image"]', 'property', 'og:image', ogImage);
  setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', ogImage);
  setMeta('meta[property="og:site_name"]', 'property', 'og:site_name', 'MX-IX');

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
  const connectMagneticRef = useMagnetic<HTMLAnchorElement>(0.3);

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
    { id: 'members', label: 'MEMBERS' },
    { id: 'pricing', label: 'PRICING' },
  ];

  const resourceItems: { id: string; label: string; type: string; url?: string }[] = [
    { id: 'content-fabric', label: 'Content Fabric', type: 'internal' },
    { id: 'google-vpp', label: 'Google VPP Program', type: 'internal' },
    { id: 'stats', label: 'Network Stats', type: 'internal' },
    { id: 'technical', label: 'Technical Requirements', type: 'internal' },
    { id: 'lg', label: 'Looking Glass', type: 'internal' },
    { id: 'status', label: 'Status Page', type: 'internal' },
  ];

  // Adjust colors based on dark mode and scroll state
  const isDark = isDarkNav;
  const getNavBg = () => {
    // When mobile menu is open, always use solid white background
    if (isMobileMenuOpen) return 'bg-white border-b border-gray-200';
    if (isDark && !scrolled) return 'bg-black/50 backdrop-blur-md border-b border-white/10';
    if (scrolled) return 'bg-white/95 backdrop-blur-md border-b border-gray-200';
    return 'bg-transparent';
  };

  const getTextColor = () => {
    // When mobile menu is open, always use black text for visibility
    if (isMobileMenuOpen) return 'text-black';
    return isDark && !scrolled ? 'text-white' : 'text-black';
  };

  const getNavItemBg = () => {
    if (isDark && !scrolled) return 'bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20';
    return 'bg-white/60 backdrop-blur-md border-gray-100 hover:bg-white/80';
  };

  const getNavItemTextColor = (isActive: boolean) => {
    if (isDark && !scrolled) {
      return isActive ? 'text-[#F20732]' : 'text-gray-300 hover:text-white';
    }
    return isActive ? 'text-[#F20732]' : 'text-gray-500 hover:text-black';
  };

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${getNavBg()} ${scrolled ? 'py-3' : 'py-6 md:py-8'}`}>
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 md:px-12 flex items-center justify-between h-14">
        {/* Logo */}
        <div className="flex-shrink-0 flex items-center justify-start z-50">
          <a href="/" onClick={(e) => { if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); handleLogoClick(); } }} onMouseEnter={handleLogoHover} className="flex items-center gap-1.5 hover-trigger group">
            <div className="flex items-center gap-1.5">
              <img src="/assets/logo-mark.png" alt="MX-IX Logo" width="40" height="40" decoding="async" className="w-9 h-9 sm:w-10 sm:h-10 object-contain" />
              <span className={`text-xl sm:text-2xl font-black tracking-tighter leading-none ${getTextColor()}`}>MX-IX</span>
            </div>
          </a>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex flex-1 items-center justify-center px-4">
          <div className={`flex items-center gap-8 xl:gap-12 px-8 xl:px-12 py-3 rounded-full border shadow-sm transition-all duration-300 hover:shadow-md ${getNavItemBg()}`}>
            {navItems.map((item) => (
              <NavLink
                key={item.id}
                to={item.id}
                onClick={() => setPage(item.id)}
                className={`
                  text-[11px] font-mono font-bold tracking-[0.15em] uppercase transition-all duration-300 hover-trigger relative group
                  ${getNavItemTextColor(currentPage === item.id)}
                `}
              >
                {item.label}
                <span className={`absolute -bottom-1 left-0 w-full h-[2px] bg-[#F20732] transform origin-left transition-transform duration-300 ease-out ${currentPage === item.id ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`}></span>
              </NavLink>
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
                      <NavLink
                        key={item.id}
                        to={item.id}
                        onClick={() => {
                          setPage(item.id);
                        }}
                        className="block w-full text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-50 hover:text-[#F20732] transition-colors"
                      >
                        {item.label}
                      </NavLink>
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
        <div className="hidden lg:flex flex-shrink-0 items-center justify-end gap-4 z-50 min-w-[200px]">
          <NavLink
            to="portal"
            onClick={() => setPage('portal')}
            className={`hover-trigger font-mono text-label-sm font-bold tracking-mono uppercase px-5 py-3 border transition-colors ${isDark && !scrolled ? 'border-white/30 text-white hover:bg-white hover:text-black' : 'border-gray-300 text-black hover:border-black'}`}
          >
            Member Login
          </NavLink>
          <NavLink
            to="contact"
            ref={connectMagneticRef}
            onClick={() => setPage('contact')}
            className="hover-trigger bg-[#F20732] text-white px-6 py-3 font-mono text-label-sm font-bold tracking-mono hover:bg-black transition-[transform,background-color,box-shadow] duration-200 flex items-center gap-3 group shadow-red-glow hover:shadow-elevated uppercase will-change-transform"
          >
            Connect <span className="text-sm leading-none mb-0.5 group-hover:translate-x-1 transition-transform">→</span>
          </NavLink>
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
                  <NavLink
                    key={item.id}
                    to={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`block w-full text-left px-4 py-4 rounded-lg font-mono text-sm font-bold tracking-wider uppercase transition-all duration-300 ${currentPage === item.id
                        ? 'bg-[#F20732] text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                      }`}
                  >
                    {item.label}
                  </NavLink>
                ))}

                {/* Mobile Resources */}
                <div className="pt-2 pb-2 border-t border-gray-100">
                  <p className="px-4 text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">Resources</p>
                  {resourceItems.map((item) => (
                    item.type === 'internal' ? (
                      <NavLink
                        key={item.id}
                        to={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={`block w-full text-left px-4 py-3 rounded-lg font-mono text-sm font-bold tracking-wider uppercase transition-all duration-300 ${currentPage === item.id
                            ? 'bg-[#F20732] text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                          }`}
                      >
                        {item.label}
                      </NavLink>
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
              <NavLink
                to="portal"
                onClick={() => handleNavClick('portal')}
                className="block w-full mb-3 border border-gray-300 text-black px-6 py-4 font-mono text-xs font-bold tracking-[0.2em] hover:border-black transition-colors text-center uppercase rounded-lg"
              >
                Member Login
              </NavLink>
              <NavLink
                to="contact"
                onClick={() => handleNavClick('contact')}
                className="block w-full bg-[#F20732] text-white px-6 py-4 font-mono text-xs font-bold tracking-[0.2em] hover:bg-black transition-colors text-center group shadow-lg shadow-[#F20732]/20 uppercase rounded-lg"
              >
                Connect <span className="text-sm leading-none group-hover:translate-x-1 transition-transform">→</span>
              </NavLink>
            </div>
          </div>
        </>
      )}
    </nav>
  );
};

const Footer = ({ setPage }: { setPage: (p: string) => void }) => {
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
    { label: 'Looking Glass', page: 'lg' },
    { label: 'Peering', url: 'https://www.peeringdb.com/org/43398' },
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

        {/* ── MAIN GRID ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10 pt-16 pb-12">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-5 space-y-5">
            <div className="flex items-center gap-1.5">
              <img src="/assets/logo-mark.png" alt="MX-IX Logo" width="40" height="40" loading="lazy" decoding="async" className="w-10 h-10 object-contain" />
              <span className="text-2xl font-black tracking-tighter leading-none">MX-IX</span>
            </div>
            <p className="max-w-xs text-gray-500 text-sm leading-relaxed font-light">
              The carrier-neutral Internet Exchange where networks meet to peer directly — faster, cheaper and more resilient interconnection.
            </p>
            <div className="flex items-center gap-3 font-mono text-label-sm tracking-label uppercase text-gray-500">
              <span className="text-gray-200">AS141539</span>
              <span className="w-px h-3 bg-white/15" />
              <a href="https://www.peeringdb.com/org/43398" target="_blank" rel="noopener noreferrer" aria-label="MX-IX on PeeringDB" className="inline-block opacity-90 hover:opacity-100 transition-opacity hover-trigger">
                <img src="/assets/peeringdb-logo-white.png" alt="PeeringDB" className="h-5 w-auto" loading="lazy" />
              </a>
            </div>
          </div>

          {/* Company */}
          <div className="lg:col-span-2">
            <h4 className="font-mono font-bold mb-4 uppercase tracking-label text-label-sm text-gray-500">Company</h4>
            <ul className="space-y-2.5 font-mono text-xs text-gray-300">
              {companyLinks.map((l) => (
                <li key={l.page}>
                  <NavLink to={l.page} onClick={() => setPage(l.page)} className="hover:text-[#F20732] transition-colors hover-trigger flex items-center group">
                    <span className="w-0 group-hover:w-3.5 overflow-hidden transition-all duration-300 text-[#F20732]">→</span>
                    <span className="group-hover:translate-x-1 transition-transform">{l.label}</span>
                  </NavLink>
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
                    <NavLink to={l.page!} onClick={() => setPage(l.page!)} className="hover:text-[#F20732] transition-colors hover-trigger flex items-center group">
                      <span className="w-0 group-hover:w-3.5 overflow-hidden transition-all duration-300 text-[#F20732]">→</span>
                      <span className="group-hover:translate-x-1 transition-transform">{l.label}</span>
                    </NavLink>
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

          {/* Office + contact */}
          <div className="lg:col-span-3 space-y-6">
            <div>
              <h4 className="font-mono font-bold mb-4 uppercase tracking-label text-label-sm text-gray-500">Registered Office</h4>
              <p className="font-mono text-xs text-gray-500 leading-relaxed">
                MX-IX Digital Infrastructure Pvt. Ltd.<br />
                Enkay Tower, Udyog Vihar Phase V,<br />
                Sector 19, Gurugram, India 122016
              </p>
            </div>
            <div>
              <h4 className="font-mono font-bold mb-3 uppercase tracking-label text-label-sm text-gray-500">Get in touch</h4>
              <a href="mailto:contact@mx-ix.com" className="font-mono text-xs text-gray-300 hover:text-[#F20732] transition-colors hover-trigger">
                contact@mx-ix.com
              </a>
            </div>
          </div>
        </div>

        {/* ── BOTTOM BAR ─────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 py-6 border-t border-white/10">
          <span className="font-mono text-label-sm text-gray-500 uppercase tracking-label text-center md:text-left">
            © 2026 MX-IX Digital Infrastructure Pvt. Ltd. — All Rights Reserved
          </span>
          <div className="flex items-center gap-5 font-mono text-label-sm uppercase tracking-label text-gray-500">
            <NavLink to="pricing" onClick={() => setPage('pricing')} className="hover:text-[#F20732] transition-colors hover-trigger">Pricing</NavLink>
            <NavLink to="privacy" onClick={() => setPage('privacy')} className="hover:text-[#F20732] transition-colors hover-trigger">Privacy</NavLink>
            <NavLink to="terms" onClick={() => setPage('terms')} className="hover:text-[#F20732] transition-colors hover-trigger">Terms</NavLink>
            <NavLink to="contact" onClick={() => setPage('contact')} className="hover:text-[#F20732] transition-colors hover-trigger">Contact</NavLink>
          </div>
        </div>
      </div>
    </footer>
  );
};

// Internet-exchange workflow visual for the home hero: member networks peer
// through the central MX-IX switch fabric + route servers, with live traffic
// flowing both ways. Monochrome ink/red/gray scheme to match the brand.
const NET_ICONS: Record<string, React.ReactNode> = {
  globe: (<><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 3.5 9 14 14 0 0 1-3.5 9 14 14 0 0 1-3.5-9A14 14 0 0 1 12 3z" /></>),
  server: (<><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01" /><path d="M7 16.5h.01" /></>),
  cloud: (<path d="M6 18a4 4 0 0 1 .6-8 6 6 0 0 1 11.4 1.6A3.5 3.5 0 0 1 17.5 18H6z" />),
  share: (<><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.2 10.9 15.8 7.1" /><path d="M8.2 13.1 15.8 16.9" /></>),
  wifi: (<><path d="M5 12.5a10 10 0 0 1 14 0" /><path d="M2 9a15 15 0 0 1 20 0" /><path d="M8.5 16a6 6 0 0 1 7 0" /><path d="M12 19.5h.01" /></>),
  peer: (<><circle cx="7" cy="6" r="2.5" /><circle cx="7" cy="18" r="2.5" /><circle cx="17" cy="12" r="2.5" /><path d="M7 8.5v7" /><path d="M9.4 16.4A6 6 0 0 0 14.5 12.5" /></>),
};

const ExchangeDiagram: React.FC = () => {
  const SANS = "'Inter', ui-sans-serif, system-ui, sans-serif";
  const left = [
    { y: 160, type: 'ISP', asn: 'AS13335', port: '100G', icon: 'globe', e: 182, live: true },
    { y: 286, type: 'Content', asn: 'AS15169', port: '400G', icon: 'server', e: 286, live: true },
    { y: 412, type: 'Cloud', asn: 'AS8075', port: '100G', icon: 'cloud', e: 390, live: true },
  ];
  const right = [
    { y: 160, type: 'CDN', asn: 'AS54113', port: '100G', icon: 'share', e: 182, live: true },
    { y: 286, type: 'Enterprise', asn: 'AS9498', port: '10G', icon: 'wifi', e: 286, live: true },
    { y: 412, type: 'IX Peer', asn: 'AS4755', port: '10G', icon: 'peer', e: 390, live: false },
  ];
  const CX1 = 234, CX2 = 366;
  const lPath = (n: { y: number; e: number }) => `M172,${n.y} C200,${n.y} 210,${n.e} ${CX1},${n.e}`;
  const rPath = (n: { y: number; e: number }) => `M${CX2},${n.e} C390,${n.e} 400,${n.y} 428,${n.y}`;

  const Chip: React.FC<{ x: number; y: number; type: string; asn: string; icon: string; live: boolean }> = ({ x, y, type, asn, icon, live }) => (
    <g style={{ filter: 'drop-shadow(0 9px 20px rgba(10,10,11,0.06))' }}>
      <rect x={x} y={y - 32} width="168" height="64" rx="14" fill="#fff" stroke="#EEF0F2" strokeWidth="1.5" />
      <rect x={x + 14} y={y - 18} width="36" height="36" rx="10" fill="#FDE8EC" />
      <g transform={`translate(${x + 22},${y - 10}) scale(0.83)`} fill="none" stroke="#F20732" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{NET_ICONS[icon]}</g>
      <text x={x + 60} y={y - 3} fontFamily={SANS} fontSize="14" fontWeight="800" fill="#0A0A0B">{type}</text>
      <text x={x + 60} y={y + 15} fontFamily="monospace" fontSize="9.5" letterSpacing="0.5" fill="#9CA3AF">{asn}</text>
      <circle cx={x + 150} cy={y - 14} r="4" fill={live ? '#10B981' : '#CBD0D6'} />
    </g>
  );

  return (
    <svg viewBox="0 0 600 520" className="w-full max-w-lg xl:max-w-xl 2xl:max-w-2xl" role="img" aria-label="MX-IX internet exchange — networks peering through the switch fabric" style={{ fontFamily: SANS }}>
      <defs>
        <linearGradient id="ixHead" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F20732" />
          <stop offset="100%" stopColor="#C80730" />
        </linearGradient>
      </defs>

      {/* connectors */}
      {left.map((n, i) => <path key={`ll${i}`} d={lPath(n)} fill="none" stroke="#EAD9DC" strokeWidth="1.5" strokeLinecap="round" />)}
      {right.map((n, i) => <path key={`rl${i}`} d={rPath(n)} fill="none" stroke={n.live ? '#EAD9DC' : '#E5E7EB'} strokeWidth="1.5" strokeLinecap="round" />)}

      {/* port-speed tags */}
      {left.map((n, i) => <text key={`lt${i}`} x={203} y={(n.y + n.e) / 2 - 9} textAnchor="middle" fontFamily="monospace" fontSize="9" fill="#9CA3AF">{n.port}</text>)}
      {right.map((n, i) => <text key={`rt${i}`} x={397} y={(n.y + n.e) / 2 - 9} textAnchor="middle" fontFamily="monospace" fontSize="9" fill="#9CA3AF">{n.port}</text>)}

      {/* TX (outbound, ink) + RX (inbound, red) data flow — both directions */}
      {left.map((n, i) => (
        <g key={`lp${i}`}>
          <circle r="3.8" fill="#F20732">
            <animateMotion dur="2s" begin={`${i * 0.5}s`} repeatCount="indefinite" path={lPath(n)} />
            <animate attributeName="opacity" values="0;1;1;0" dur="2s" begin={`${i * 0.5}s`} repeatCount="indefinite" />
          </circle>
          <circle r="3.2" fill="#0A0A0B">
            <animateMotion dur="2s" begin={`${i * 0.5 + 1}s`} repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear" path={lPath(n)} />
            <animate attributeName="opacity" values="0;0.7;0.7;0" dur="2s" begin={`${i * 0.5 + 1}s`} repeatCount="indefinite" />
          </circle>
        </g>
      ))}
      {right.filter((n) => n.live).map((n, i) => (
        <g key={`rp${i}`}>
          <circle r="3.8" fill="#F20732">
            <animateMotion dur="2s" begin={`${i * 0.5 + 0.7}s`} repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear" path={rPath(n)} />
            <animate attributeName="opacity" values="0;1;1;0" dur="2s" begin={`${i * 0.5 + 0.7}s`} repeatCount="indefinite" />
          </circle>
          <circle r="3.2" fill="#0A0A0B">
            <animateMotion dur="2s" begin={`${i * 0.5 + 1.6}s`} repeatCount="indefinite" path={rPath(n)} />
            <animate attributeName="opacity" values="0;0.7;0.7;0" dur="2s" begin={`${i * 0.5 + 1.6}s`} repeatCount="indefinite" />
          </circle>
        </g>
      ))}

      {/* network chips */}
      {left.map((n, i) => <Chip key={`lc${i}`} x={4} y={n.y} type={n.type} asn={n.asn} icon={n.icon} live={n.live} />)}
      {right.map((n, i) => <Chip key={`rc${i}`} x={428} y={n.y} type={n.type} asn={n.asn} icon={n.icon} live={n.live} />)}

      {/* central MX-IX switch fabric */}
      <g style={{ filter: 'drop-shadow(0 18px 40px rgba(242,7,50,0.18))' }}>
        <rect x={CX1} y={116} width={CX2 - CX1} height={336} rx="20" fill="#fff" stroke="#F1D9DE" strokeWidth="1.5" />
      </g>
      {/* header */}
      <path d="M234,134 a18,18 0 0 1 18,-18 h96 a18,18 0 0 1 18,18 v50 h-132 z" fill="url(#ixHead)" />
      <text x={300} y={158} textAnchor="middle" fontFamily={SANS} fontSize="24" fontWeight="900" letterSpacing="0.5" fill="#fff">MX-IX</text>
      <text x={300} y={177} textAnchor="middle" fontFamily="monospace" fontSize="8" letterSpacing="2.5" fill="#FBC9D2">SWITCH FABRIC</text>

      {/* route servers */}
      <text x={300} y={214} textAnchor="middle" fontFamily="monospace" fontSize="8" letterSpacing="2" fill="#9CA3AF">ROUTE SERVERS</text>
      {[{ x: 248, l: 'RS1' }, { x: 302, l: 'RS2' }].map((rs) => (
        <g key={rs.l}>
          <rect x={rs.x} y={224} width="50" height="28" rx="8" fill="#F8F9FA" stroke="#EDEFF2" />
          <text x={rs.x + 12} y={242} fontFamily="monospace" fontSize="10" fontWeight="bold" fill="#0A0A0B">{rs.l}</text>
          <circle cx={rs.x + 39} cy={238} r="3.5" fill="#10B981" />
        </g>
      ))}
      <text x={300} y={278} textAnchor="middle" fontFamily="monospace" fontSize="7.5" letterSpacing="1.5" fill="#9CA3AF">RPKI · BGP · IPv6</text>

      {/* port-LED grid */}
      {Array.from({ length: 9 }).map((_, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        const x = 270 + col * 30, y = 296 + row * 22;
        const hot = (i * 5) % 3 === 0;
        return (
          <rect key={`led${i}`} x={x - 11} y={y - 6} width="22" height="12" rx="3" fill={hot ? '#F20732' : '#FBD7DE'} />
        );
      })}

      {/* TX / RX legend */}
      <g transform="translate(300,420)" textAnchor="middle">
        <circle cx={-26} cy={-3} r="3.5" fill="#F20732" />
        <text x={-16} y={1} fontFamily="monospace" fontSize="8" letterSpacing="1" fill="#9CA3AF" textAnchor="start">RX</text>
        <circle cx={14} cy={-3} r="3.5" fill="#0A0A0B" />
        <text x={24} y={1} fontFamily="monospace" fontSize="8" letterSpacing="1" fill="#9CA3AF" textAnchor="start">TX</text>
      </g>
    </svg>
  );
};

function AppContent() {
  const { locations } = useAdmin();


  // Path-based routing (real URLs so pages are crawlable / shareable)
  const getPageFromPath = () => {
    // Match the full path first so nested routes (e.g. /resources/google-vpp-program)
    // resolve correctly, then fall back to the first segment.
    const full = window.location.pathname.replace(/^\//, '').replace(/\/$/, '');
    if (PAGE_BY_PATH[full]) return PAGE_BY_PATH[full];
    const seg = full.split('/')[0];
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
    // Notify in-page views (e.g. Locations detail) so they can reset on nav.
    window.dispatchEvent(new CustomEvent('app-navigate', { detail: { page: newPage } }));
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
            <section className="relative z-10 flex min-h-[100svh] items-center bg-white px-6 pb-16 pt-32 text-ink sm:px-10 lg:px-14 lg:pt-36 xl:px-20">
              <div className="relative z-10 mx-auto w-full max-w-[1500px]">
                <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10 xl:gap-14">
                  {/* Editorial column */}
                  <div className="min-w-0 lg:col-span-8">
                    <span
                      className="eyebrow animate-reveal-up text-ink"
                      style={{ animationDelay: '0ms', animationFillMode: 'both' }}
                    >
                      Internet Exchange
                    </span>

                    {/* Type scale is tuned per breakpoint so the longest word
                        ("INFRASTRUCTURE") always fits its track — no clipping,
                        no mid-word break, on any laptop or phone width. */}
                    <h1 className="mt-6 text-[clamp(2rem,9.4vw,3.1rem)] font-black uppercase leading-[0.88] tracking-[-0.05em] text-ink sm:mt-8 sm:text-[clamp(2.6rem,7.4vw,4.4rem)] lg:text-[clamp(3rem,6.05vw,5.5rem)]">
                      <span
                        className="block animate-reveal-up"
                        style={{ animationDelay: '110ms', animationFillMode: 'both' }}
                      >
                        Infrastructure
                      </span>
                      <span
                        className="mt-[0.04em] flex animate-reveal-up items-end gap-[0.1em]"
                        style={{ animationDelay: '240ms', animationFillMode: 'both' }}
                      >
                        Evolved
                        <span className="mb-[0.17em] h-[0.1em] w-[0.1em] shrink-0 rounded-full bg-brand-red" aria-hidden="true" />
                      </span>
                    </h1>

                    <p
                      className="mt-8 max-w-xl animate-reveal-up text-sm leading-7 text-gray-600 sm:text-base sm:leading-8"
                      style={{ animationDelay: '360ms', animationFillMode: 'both' }}
                    >
                      Peer directly with ISPs, content and cloud networks across the MX-IX fabric — lower latency, lower transit cost, and one port that reaches the entire ecosystem.
                    </p>

                    <div
                      className="mt-10 flex animate-reveal-up flex-col gap-3 sm:flex-row sm:items-center"
                      style={{ animationDelay: '460ms', animationFillMode: 'both' }}
                    >
                      <NavLink
                        to="contact"
                        onClick={() => handleSetPage('contact')}
                        className="hover-trigger group inline-flex min-h-12 cursor-pointer items-center justify-center gap-3 rounded-full bg-ink px-7 font-mono text-label-sm font-bold uppercase tracking-mono text-white transition-colors duration-200 hover:bg-brand-red"
                      >
                        Request a Port
                        <span className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true">→</span>
                      </NavLink>
                      <NavLink
                        to="locations"
                        onClick={() => handleSetPage('locations')}
                        className="hover-trigger group inline-flex min-h-12 cursor-pointer items-center justify-center gap-3 rounded-full border border-ink/20 bg-white px-7 font-mono text-label-sm font-bold uppercase tracking-mono text-ink transition-colors duration-200 hover:border-ink hover:bg-gray-50"
                      >
                        Explore the Locations
                        <span className="text-brand-red transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true">→</span>
                      </NavLink>
                    </div>
                  </div>

                  {/* Precision fabric dial */}
                  <div
                    className="animate-reveal-up min-w-0 lg:col-span-4"
                    style={{ animationDelay: '300ms', animationFillMode: 'both' }}
                  >
                    <svg
                      viewBox="-40 -20 480 440"
                      className="mx-auto w-full max-w-[300px] sm:max-w-[380px] lg:max-w-none"
                      role="img"
                      aria-label="Networks across the MX-IX fabric connect through a single shared exchange point"
                    >
                      {/* rotating measurement ring */}
                      <g className="animate-[spin_90s_linear_infinite]" style={{ transformOrigin: '200px 200px' }}>
                        <circle cx="200" cy="200" r="190" fill="none" stroke="#E3E4E6" strokeWidth="1" strokeDasharray="2 7" />
                        {Array.from({ length: 24 }).map((_, i) => (
                          <line
                            key={`tick-${i}`}
                            x1="200"
                            y1="12"
                            x2="200"
                            y2="24"
                            stroke={i % 6 === 0 ? '#B9BBBE' : '#DEDFE1'}
                            strokeWidth="1"
                            transform={`rotate(${i * 15} 200 200)`}
                          />
                        ))}
                      </g>

                      {/* registration marks — engineering drawing detail */}
                      <g stroke="#DCDDDF" strokeWidth="1">
                        {[
                          [12, 12],
                          [388, 12],
                          [12, 388],
                          [388, 388],
                        ].map(([cx, cy]) => (
                          <g key={`reg-${cx}-${cy}`}>
                            <line x1={cx - 5} y1={cy} x2={cx + 5} y2={cy} />
                            <line x1={cx} y1={cy - 5} x2={cx} y2={cy + 5} />
                          </g>
                        ))}
                      </g>

                      <circle cx="200" cy="200" r="140" fill="none" stroke="#E7E8EA" strokeWidth="1" />
                      <circle cx="200" cy="200" r="90" fill="none" stroke="#EDEEF0" strokeWidth="1" strokeDasharray="3 6" />

                      {/* implied full mesh between members */}
                      <path
                        d="M340 200 L243.26 333.15 L86.74 282.29 L86.74 117.71 L243.26 66.85 Z"
                        fill="none"
                        stroke="#EBECEE"
                        strokeWidth="1"
                        strokeDasharray="4 6"
                      />

                      {/* spokes into the exchange core */}
                      <g stroke="#E2E3E5" strokeWidth="1">
                        <line x1="200" y1="200" x2="340" y2="200" />
                        <line x1="200" y1="200" x2="243.26" y2="333.15" />
                        <line x1="200" y1="200" x2="86.74" y2="282.29" />
                        <line x1="200" y1="200" x2="86.74" y2="117.71" />
                        <line x1="200" y1="200" x2="243.26" y2="66.85" />
                      </g>

                      {/* active peering arc */}
                      <path
                        d="M243.26 66.85 A140 140 0 0 1 243.26 333.15"
                        fill="none"
                        stroke="#F20732"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />

                      {/* member nodes */}
                      <g fill="#FFFFFF" stroke="#D4D5D8" strokeWidth="1.25">
                        <circle cx="340" cy="200" r="9" />
                        <circle cx="243.26" cy="333.15" r="9" />
                        <circle cx="86.74" cy="282.29" r="9" />
                        <circle cx="86.74" cy="117.71" r="9" />
                        <circle cx="243.26" cy="66.85" r="9" />
                      </g>
                      <g fill="#F20732">
                        <circle cx="340" cy="200" r="3.4" />
                        <circle cx="243.26" cy="66.85" r="3.4" />
                        <circle cx="243.26" cy="333.15" r="3.4" />
                      </g>
                      <g fill="#C3C5C8">
                        <circle cx="86.74" cy="282.29" r="3.4" />
                        <circle cx="86.74" cy="117.71" r="3.4" />
                      </g>

                      {/* exchange core */}
                      <circle cx="200" cy="200" r="46" fill="none" stroke="#EDEEF0" strokeWidth="1" />
                      <circle cx="200" cy="200" r="40" fill="#0A0A0B" />
                      <text x="200" y="196" textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="800" fontFamily="Plus Jakarta Sans, sans-serif" letterSpacing="0.4">
                        MX-IX
                      </text>
                      <text x="200" y="212" textAnchor="middle" fill="#8E9095" fontSize="6.5" letterSpacing="1.6" fontFamily="monospace">
                        FABRIC
                      </text>

                      {/* network class labels */}
                      <g fill="#8E9095" fontSize="8" fontWeight="700" fontFamily="monospace" letterSpacing="1.1">
                        <text x="356" y="203">ISP</text>
                        <text x="250" y="358" textAnchor="middle">CLOUD</text>
                        <text x="64" y="301" textAnchor="end">CONTENT</text>
                        <text x="64" y="107" textAnchor="end">CDN</text>
                        <text x="250" y="46" textAnchor="middle">ENTERPRISE</text>
                      </g>
                    </svg>
                  </div>
                </div>

                {/* Capability hairline */}
                <div
                  className="mt-16 flex animate-reveal-up flex-wrap items-center gap-x-5 gap-y-3 border-t border-black/[0.08] pt-6 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500 sm:mt-20 sm:gap-x-8 sm:text-label-sm"
                  style={{ animationDelay: '560ms', animationFillMode: 'both' }}
                >
                  {['Public Peering', 'Route Servers', 'RPKI Filtering', 'DDoS Blackholing', '1G — 400G Ports'].map((item, i) => (
                    <span key={item} className="flex items-center gap-5 sm:gap-8">
                      {i > 0 && <span className="h-1 w-1 rounded-full bg-brand-red/60" aria-hidden="true" />}
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </section>
            <RealTimeCapacity />
            <Ticker
              items={(() => {
                const cities = locations.length
                  ? locations.map((l) => l.name)
                  : ['Mumbai', 'New Delhi', 'Chennai', 'Bangalore', 'Hyderabad', 'Kolkata', 'Dubai', 'Fujairah', 'Singapore', 'Frankfurt'];
                // duplicate so one row always exceeds the viewport for a seamless, gap-free loop
                return [...cities, ...cities];
              })()}
            />
            <Capabilities />

            {/* Flagship product — Content Fabric */}
            <section className="relative border-b border-gray-200 bg-white">
              <div className="mx-auto max-w-[1400px] px-6 py-20 md:px-12 md:py-24">
                <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
                  <Reveal className="lg:col-span-6">
                    <div className="mb-6 flex flex-wrap items-center gap-4">
                      <span className="inline-flex items-center gap-2 rounded-full bg-brand-red px-4 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-white">
                        Flagship Product
                      </span>
                      <span className="eyebrow text-ink">Content Fabric</span>
                    </div>

                    <h2 className="text-[clamp(2rem,4.4vw,3.6rem)] font-black leading-[0.92] tracking-[-0.05em] text-ink">
                      Aggregated reach and cached content, in one session
                    </h2>

                    <p className="mt-6 max-w-xl text-base leading-8 text-gray-600">
                      Our flagship service consolidates our peering reach, the interconnection capacity we hold
                      and locally cached content into a single validated route set — so the traffic that
                      dominates your bill is answered inside the metro instead of across a paid upstream.
                    </p>

                    <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                      <NavLink
                        to="content-fabric"
                        onClick={() => handleSetPage('content-fabric')}
                        className="hover-trigger group inline-flex min-h-12 cursor-pointer items-center justify-center gap-3 rounded-full bg-ink px-7 font-mono text-label-sm font-bold uppercase tracking-mono text-white transition-colors duration-200 hover:bg-brand-red"
                      >
                        Explore Content Fabric
                        <span className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true">→</span>
                      </NavLink>
                      <NavLink
                        to="contact"
                        onClick={() => handleSetPage('contact')}
                        className="hover-trigger inline-flex min-h-12 cursor-pointer items-center justify-center gap-3 rounded-full border border-ink/20 bg-white px-7 font-mono text-label-sm font-bold uppercase tracking-mono text-ink transition-colors duration-200 hover:border-ink hover:bg-gray-50"
                      >
                        Talk to our team
                      </NavLink>
                    </div>
                  </Reveal>

                  <Reveal className="lg:col-span-6" delay={120}>
                    <div className="grid grid-cols-2 gap-px border border-gray-200 bg-gray-200 sm:grid-cols-4">
                      {['Google', 'Netflix', 'Akamai', 'Microsoft', 'Meta', 'Amazon', 'Cloudflare', 'Apple'].map((n) => (
                        <div
                          key={n}
                          className="bg-white p-5 text-center font-black tracking-[-0.03em] text-ink transition-colors duration-200 hover:text-brand-red"
                        >
                          {n}
                        </div>
                      ))}
                    </div>
                    <div className="mt-px grid grid-cols-1 gap-px border border-gray-200 bg-gray-200 sm:grid-cols-3">
                      {[
                        { l: 'Sessions', v: 'One' },
                        { l: 'Per-bit charges', v: 'None' },
                        { l: 'Cached locally', v: 'In-metro' },
                      ].map((s) => (
                        <div key={s.l} className="bg-white p-5">
                          <span className="font-mono text-[9px] uppercase tracking-label text-gray-500">{s.l}</span>
                          <div className="mt-1.5 text-xl font-light tracking-[-0.04em] text-ink">{s.v}</div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 font-mono text-[9px] uppercase leading-relaxed tracking-label text-gray-400">
                      Cache and on-net availability varies by location and platform programme terms.
                    </p>
                  </Reveal>
                </div>
              </div>
            </section>

            <HowPeering />

            {/* The MX-IX Difference — special highlight band */}
            <section className="relative overflow-hidden bg-ink text-white">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.5]"
                aria-hidden="true"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
                  backgroundSize: '72px 72px',
                  maskImage: 'radial-gradient(110% 80% at 80% 0%, black, transparent 70%)',
                  WebkitMaskImage: 'radial-gradient(110% 80% at 80% 0%, black, transparent 70%)',
                }}
              />
              <div className="pointer-events-none absolute -right-24 -top-24 h-[30rem] w-[30rem] rounded-full bg-[#F20732]/10 blur-[140px]" aria-hidden="true" />

              <div className="relative z-10 mx-auto max-w-[1400px] px-6 py-24 md:px-12 md:py-32">
                <Reveal as="span" className="eyebrow text-white">
                  The MX-IX Difference
                </Reveal>

                <Reveal delay={90}>
                  <h2 className="mt-7 max-w-4xl text-[clamp(2rem,4.6vw,4rem)] font-black leading-[0.95] tracking-[-0.045em]">
                    One connection. Every network. <span className="text-brand-red">Zero compromise.</span>
                  </h2>
                </Reveal>

                <Reveal delay={170}>
                  <p className="mt-7 max-w-2xl text-base leading-8 text-gray-300 md:text-lg md:leading-9">
                    A single port plugs you into the entire MX-IX ecosystem — multilateral peering, secure
                    routing and resilient capacity, with no per-bit fees and no lock-in.
                  </p>
                </Reveal>

                <div className="mt-16 grid grid-cols-1 gap-px border border-white/10 bg-white/10 sm:grid-cols-3">
                  {[
                    { k: '01', t: 'Peer once, reach all', d: 'A single BGP session to the route servers connects you to every member on the fabric.' },
                    { k: '02', t: 'Secure by default', d: 'RPKI + IRR filtering and built-in DDoS blackholing keep your traffic clean and online.' },
                    { k: '03', t: 'Scale on your terms', d: 'Grow from 1G to 400G across locations with flat, predictable, traffic-free port pricing.' },
                  ].map((x, i) => (
                    <Reveal key={x.k} delay={240 + i * 90}>
                      <div className="group relative h-full overflow-hidden bg-ink p-8 transition-colors duration-300 hover:bg-white/[0.035] md:p-10">
                        <div className="absolute left-0 top-0 h-px w-full -translate-x-full bg-brand-red transition-transform duration-500 group-hover:translate-x-0" aria-hidden="true" />
                        <div className="flex items-baseline justify-between">
                          <span className="font-mono text-label-sm font-bold tracking-mono text-white/35">{x.k}</span>
                          <span className="h-1.5 w-1.5 rounded-full bg-white/15 transition-colors duration-300 group-hover:bg-brand-red" aria-hidden="true" />
                        </div>
                        <h3 className="mt-8 text-xl font-bold tracking-[-0.02em] md:text-2xl">{x.t}</h3>
                        <p className="mt-3 text-sm leading-7 text-gray-400">{x.d}</p>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>
            </section>

            <Suspense fallback={null}><GlobalFabric /></Suspense>
            <FAQ />
            <CTABand onNavigate={handleSetPage} />
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
      case 'members':
        return <MembersPage onNavigate={handleSetPage} />;
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
      case 'google-vpp':
        return <GoogleVppPage onNavigate={handleSetPage} />;
      case 'content-fabric':
        return <ContentFabricPage onNavigate={handleSetPage} />;
      case 'portal':
        return <PortalPage onNavigate={handleSetPage} />;
      case 'onboarding':
        return <OnboardingPage onNavigate={handleSetPage} />;
      case 'privacy':
        return <PrivacyPage onNavigate={handleSetPage} />;
      case 'terms':
        return <TermsPage onNavigate={handleSetPage} />;
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

      {/* Hide navigation on admin & portal pages - they have their own chrome */}
      {page !== 'admin' && page !== 'portal' && <Navigation currentPage={page} setPage={handleSetPage} />}

      <main className="relative z-10 min-h-screen">
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#F20732] border-t-transparent rounded-full animate-spin"></div></div>}>
          {renderPage()}
        </Suspense>
      </main>

      {/* Hide footer on admin & portal pages */}
      {page !== 'admin' && page !== 'portal' && <Footer setPage={handleSetPage} />}
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
