import React, { useEffect } from 'react';
import { LogIn, ArrowRight } from 'lucide-react';

interface PortalPageProps {
  onNavigate?: (page: string) => void;
}

/**
 * Placeholder Member Portal login screen.
 * The full customer dashboard (auth + ports + peering + traffic + billing)
 * will be built here.
 */
const PortalPage: React.FC<PortalPageProps> = ({ onNavigate }) => {
  useEffect(() => {
    document.body.classList.add('dark-nav');
    return () => document.body.classList.remove('dark-nav');
  }, []);

  return (
    <div className="min-h-screen bg-ink text-white relative overflow-hidden flex items-center justify-center px-6 pt-32 pb-20">
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#F20732]/15 blur-[120px]"></div>

      <div className="relative w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <LogIn className="w-4 h-4 text-[#F20732]" />
          <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">// Member Portal</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-[0.95] mb-4">
          MEMBER <span className="text-[#F20732]">LOGIN</span>
        </h1>
        <p className="text-gray-400 text-sm leading-relaxed mb-8">
          The MX-IX member portal — manage your ports, peering sessions, traffic and account — is
          coming soon. For onboarding or support, get in touch with our team.
        </p>

        <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
          <input type="email" placeholder="you@network.com" disabled className="w-full bg-white/5 border border-white/15 text-white placeholder-gray-500 px-4 py-3 font-mono text-sm focus:outline-none focus:border-[#F20732] transition-colors disabled:opacity-60" />
          <input type="password" placeholder="••••••••" disabled className="w-full bg-white/5 border border-white/15 text-white placeholder-gray-500 px-4 py-3 font-mono text-sm focus:outline-none focus:border-[#F20732] transition-colors disabled:opacity-60" />
          <button type="button" disabled className="w-full bg-[#F20732]/60 text-white px-6 py-3.5 font-mono text-label-sm font-bold tracking-mono uppercase cursor-not-allowed">
            Sign In — Coming Soon
          </button>
        </form>

        <button
          onClick={() => onNavigate?.('contact')}
          className="mt-6 inline-flex items-center gap-2 font-mono text-label-sm font-bold tracking-mono uppercase text-gray-400 hover:text-[#F20732] transition-colors hover-trigger"
        >
          Request access <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default PortalPage;
