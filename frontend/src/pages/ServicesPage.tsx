import React, { useState, useEffect } from 'react';
import { servicesApi, Service } from '../services/api';

// Icon components for rendering based on backend icon strings
const IconComponents: { [key: string]: React.ReactNode } = {
  'bilateral-peering': (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  'public-peering': (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  'private-interconnect': (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  'shield': (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  'server': (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  ),
  'login': (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  ),
  'globe': (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  'branch': (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  ),
  'cpu': (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  ),
  'star': (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  'cloud': (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  ),
  'ddos-shield': (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),
};

// Default icon if icon string not found
const DefaultIcon = (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

// Icon helper
const getIcon = (iconString: string) => {
  if (!iconString) return DefaultIcon;

  // Use the curated custom icon set
  if (IconComponents[iconString]) {
    return IconComponents[iconString];
  }

  // Fallback
  return DefaultIcon;
};

const ServicesPage = () => {
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add dark nav class on mount, remove on unmount
  useEffect(() => {
    document.body.classList.add('dark-nav');
    return () => {
      document.body.classList.remove('dark-nav');
    };
  }, []);

  // Fetch services from API
  useEffect(() => {
    const fetchServices = async () => {
      setLoading(true);
      const result = await servicesApi.getAll();
      if (result.success && result.data) {
        // Sort by order
        const sorted = result.data.sort((a, b) => (a.order || 0) - (b.order || 0));
        setServices(sorted);
      } else {
        setError(result.error || 'Failed to load services');
      }
      setLoading(false);
    };
    fetchServices();
  }, []);

  const toggleService = (serviceId: string) => {
    setExpandedService(expandedService === serviceId ? null : serviceId);
  };

  // Calculate totals for stats
  const totalItems = services.reduce((acc, s) => acc + s.items.length, 0);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 bg-black text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-[#F20732]/20 via-transparent to-transparent"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 relative z-10">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-2 h-2 rounded-full bg-[#F20732] animate-pulse"></div>
            <span className="font-mono text-xs font-bold tracking-[0.2em] text-[#F20732] uppercase">
              Service Portfolio
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-8xl font-black leading-tight tracking-tighter mb-8">
            OUR <span className="text-[#F20732]">SERVICES</span>
          </h1>

          <p className="max-w-3xl text-gray-300 text-lg md:text-xl leading-relaxed mb-12">
            From public and private peering to cloud connectivity and DDoS protection — everything
            your network needs to interconnect, exchange traffic efficiently and scale across the
            MX-IX fabric.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-12 border-t border-gray-800">
            <div>
              <div className="text-4xl font-light tracking-tighter mb-2">{services.length}</div>
              <div className="font-mono text-xs text-gray-400 uppercase tracking-widest">Service Categories</div>
            </div>
            <div>
              <div className="text-4xl font-light tracking-tighter mb-2">{totalItems}</div>
              <div className="font-mono text-xs text-gray-400 uppercase tracking-widest">Solutions</div>
            </div>
            <div>
              <div className="text-4xl font-light tracking-tighter mb-2">200+</div>
              <div className="font-mono text-xs text-gray-400 uppercase tracking-widest">Global PoPs</div>
            </div>
            <div>
              <div className="text-4xl font-light tracking-tighter mb-2">24/7</div>
              <div className="font-mono text-xs text-gray-400 uppercase tracking-widest">Expert Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-[#F20732] border-t-transparent rounded-full"></div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="max-w-7xl mx-auto px-6 py-20 text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-black text-white font-mono text-xs uppercase tracking-widest hover:bg-[#F20732] transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Services Sections */}
      {!loading && !error && (
        <div className="relative">

          {services.map((service, idx) => (
            <section key={service.id} id={service.id} className="relative py-24 scroll-mt-20">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12">
                {/* Category Header */}
                <div className="mb-16">
                  <div className="flex items-center gap-6 mb-8">
                    <span className="bg-black text-white font-mono text-sm font-bold px-4 py-2 min-w-[60px] text-center">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h2 className="text-5xl md:text-7xl font-black tracking-tighter text-black mb-2">
                        {service.category}
                      </h2>
                      <p className="text-xl text-[#F20732] font-bold">{service.tagline}</p>
                    </div>
                  </div>

                  <p className="text-xl text-gray-600 max-w-3xl mb-8">
                    {service.description}
                  </p>
                </div>

                {/* Service Items */}
                <div className="space-y-6">
                  {service.items.map((item, itemIdx) => {
                    const itemId = `${service.id}-${itemIdx}`;
                    const isExpanded = expandedService === itemId;

                    return (
                      <div
                        key={itemIdx}
                        className={`
                          bg-white border-2 transition-all duration-300 overflow-hidden
                          ${isExpanded ? 'border-[#F20732] shadow-2xl' : 'border-gray-100 hover:border-gray-300'}
                        `}
                      >
                        {/* Item Header - Click to expand */}
                        <button
                          onClick={() => toggleService(itemId)}
                          className="w-full px-8 md:px-12 py-8 flex items-center justify-between text-left group"
                        >
                          <div className="flex items-center gap-6">
                            <div className={`
                              w-16 h-16 flex-shrink-0 flex items-center justify-center transition-all duration-300
                              ${isExpanded ? 'bg-[#F20732] text-white' : 'bg-gray-100 text-[#F20732] group-hover:bg-[#F20732] group-hover:text-white'}
                            `}>
                              {getIcon(item.icon)}
                            </div>
                            <div>
                              <h3 className="text-2xl md:text-3xl font-black tracking-tight text-black">
                                {item.name}
                              </h3>
                              <p className="text-gray-500 mt-1 line-clamp-1">{item.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 flex-shrink-0">
                            <span className={`
                              font-mono text-xs font-bold uppercase tracking-widest px-4 py-2 transition-all duration-300
                              ${isExpanded ? 'bg-[#F20732] text-white' : 'bg-gray-100 text-gray-600 group-hover:bg-black group-hover:text-white'}
                            `}>
                              {isExpanded ? 'Collapse' : 'View Details'}
                            </span>
                          </div>
                        </button>

                        {/* Expanded Content */}
                        <div
                          className={`overflow-hidden transition-all duration-500 ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                            }`}
                        >
                          <div className="px-8 md:px-12 pb-12 pt-4 border-t border-gray-100">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                              {/* Benefits */}
                              <div>
                                <h4 className="text-xl font-black text-black mb-6 flex items-center gap-3">
                                  <div className="w-1 h-6 bg-[#F20732]"></div>
                                  Key Benefits
                                </h4>
                                <ul className="space-y-4">
                                  {item.benefits.map((benefit, bIdx) => (
                                    <li key={bIdx} className="flex items-start gap-3">
                                      <svg className="w-5 h-5 text-[#F20732] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                      </svg>
                                      <span className="text-gray-700 leading-relaxed">{benefit}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              {/* Features */}
                              <div>
                                <h4 className="text-xl font-black text-black mb-6 flex items-center gap-3">
                                  <div className="w-1 h-6 bg-black"></div>
                                  Technical Features
                                </h4>
                                <ul className="space-y-4">
                                  {item.features.map((feature, fIdx) => (
                                    <li key={fIdx} className="flex items-start gap-3">
                                      <svg className="w-5 h-5 text-black flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      <span className="text-gray-700 leading-relaxed">{feature}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            {/* Stats if available */}
                            {item.stats && item.stats.length > 0 && (
                              <div className="mt-12 pt-12 border-t border-gray-100">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                  {item.stats.map((stat, sIdx) => (
                                    <div key={sIdx} className="text-center p-6 bg-gray-50 hover:bg-black hover:text-white transition-all duration-300 group/stat">
                                      <div className="text-4xl font-light tracking-tighter mb-2 group-hover/stat:text-[#F20732]">
                                        {stat.value}
                                      </div>
                                      <div className="font-mono text-xs uppercase tracking-widest text-gray-400 group-hover/stat:text-gray-300">
                                        {stat.label}
                                      </div>
                                      <div className="font-mono text-[10px] text-gray-300 mt-1">
                                        {stat.period}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* CTA */}
                            <div className="mt-8 flex justify-end">
                              <button
                                onClick={() => { window.history.pushState({}, '', '/contact'); window.dispatchEvent(new PopStateEvent('popstate')); }}
                                className="bg-black text-white px-8 py-4 font-mono text-xs font-bold uppercase tracking-widest hover:bg-[#F20732] transition-all duration-300 flex items-center gap-3 group/btn"
                              >
                                Get Started
                                <span className="group-hover/btn:translate-x-1 transition-transform">→</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default ServicesPage;
