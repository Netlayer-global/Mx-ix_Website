import React, { useEffect } from 'react';

const NotFoundPage: React.FC = () => {
  const goHome = () => {
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const goBack = () => {
    window.history.back();
  };

  // Hide navigation on this page
  useEffect(() => {
    // Scroll to top
    window.scrollTo(0, 0);
    
    // Add a class to body to indicate we're on 404 page
    document.body.classList.add('page-404');
    
    return () => {
      document.body.classList.remove('page-404');
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black text-white flex items-center justify-center overflow-hidden z-[9999]">
      
      {/* Content */}
      <div className="relative z-10 text-center px-4">
        {/* 404 Number */}
        <div className="mb-8">
          <h1 className="text-[200px] md:text-[300px] font-black leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-[#F20732] via-white to-[#F20732] animate-gradient">
            404
          </h1>
        </div>

        {/* Error Message */}
        <div className="max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4">
            PAGE NOT <span className="text-[#F20732]">FOUND</span>
          </h2>
          <p className="text-gray-400 text-lg md:text-xl leading-relaxed">
            The page you're looking for doesn't exist or has been moved.
            Let's get you back on track.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={goHome}
            className="group px-8 py-4 bg-[#F20732] hover:bg-white text-white hover:text-black font-mono text-sm font-bold uppercase tracking-widest transition-all duration-300 flex items-center gap-3"
          >
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Go Home
          </button>
          
          <button
            onClick={goBack}
            className="px-8 py-4 bg-transparent border-2 border-white hover:bg-white hover:text-black text-white font-mono text-sm font-bold uppercase tracking-widest transition-all duration-300"
          >
            Go Back
          </button>
        </div>

        {/* Quick Links */}
        <div className="mt-16 pt-8 border-t border-gray-800">
          <p className="text-gray-500 text-sm font-mono uppercase tracking-widest mb-4">Quick Links</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a href="/services" className="text-gray-400 hover:text-[#F20732] transition-colors text-sm">Services</a>
            <span className="text-gray-700">•</span>
            <a href="/locations" className="text-gray-400 hover:text-[#F20732] transition-colors text-sm">Locations</a>
            <span className="text-gray-700">•</span>
            <a href="/contact" className="text-gray-400 hover:text-[#F20732] transition-colors text-sm">Contact</a>
            <span className="text-gray-700">•</span>
            <a href="/about" className="text-gray-400 hover:text-[#F20732] transition-colors text-sm">About</a>
          </div>
        </div>
      </div>

      {/* Floating elements */}
      <div className="absolute top-20 left-10 w-20 h-20 border-2 border-[#F20732]/20 rotate-45 animate-spin-slow"></div>
      <div className="absolute bottom-20 right-10 w-32 h-32 border-2 border-white/10 rounded-full animate-pulse"></div>
      
      <style>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes spin-slow {
          from { transform: rotate(45deg); }
          to { transform: rotate(405deg); }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default NotFoundPage;
