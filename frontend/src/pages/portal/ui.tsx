import React from 'react';
import CountUp from '../../components/CountUp';

/** Eyebrow label in the brutalist style. */
export const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="font-mono text-label-sm tracking-mono uppercase text-[#F20732]">{children}</span>
);

/** Section heading. */
export const PageHeading: React.FC<{ title: string; subtitle?: string; eyebrow?: string }> = ({
  title,
  subtitle,
  eyebrow,
}) => (
  <div className="mb-8">
    {eyebrow && (
      <div className="mb-3">
        <Eyebrow>{eyebrow}</Eyebrow>
      </div>
    )}
    <h2 className="text-3xl md:text-4xl font-black tracking-tighter leading-[0.95] text-ink">{title}</h2>
    {subtitle && <p className="text-gray-500 text-sm mt-3 max-w-2xl leading-relaxed">{subtitle}</p>}
  </div>
);

/** Stat card with sliding red top-bar on hover. */
export const StatCard: React.FC<{
  label: string;
  value: number;
  suffix?: string;
  hint?: string;
}> = ({ label, value, suffix, hint }) => (
  <div className="group relative bg-white border border-gray-200 p-6 overflow-hidden hover:border-gray-300 transition-colors">
    <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732] -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
    <span className="font-mono text-label-sm tracking-label uppercase text-gray-400 group-hover:text-ink transition-colors">
      {label}
    </span>
    <div className="text-4xl font-light tracking-tighter text-ink mt-3 flex items-baseline">
      <CountUp value={value} />
      {suffix && <span className="text-sm ml-2 text-gray-400 font-mono font-bold tracking-label">{suffix}</span>}
    </div>
    {hint && <p className="text-xs text-gray-400 mt-2 font-mono">{hint}</p>}
  </div>
);

type Tone = 'green' | 'amber' | 'orange' | 'red' | 'gray';

const TONE: Record<Tone, string> = {
  green: 'bg-green-500/10 text-green-700 border-green-500/30',
  amber: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  orange: 'bg-orange-500/10 text-orange-700 border-orange-500/30',
  red: 'bg-[#F20732]/10 text-[#F20732] border-[#F20732]/30',
  gray: 'bg-gray-100 text-gray-600 border-gray-200',
};

/** Status pill. */
export const Badge: React.FC<{ tone: Tone; children: React.ReactNode }> = ({ tone, children }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 border font-mono text-label-sm tracking-mono uppercase ${TONE[tone]}`}
  >
    {children}
  </span>
);

/** Map a port status to a tone + label. */
export const portStatusTone = (status: string): { tone: Tone; label: string } => {
  switch (status) {
    case 'active':
      return { tone: 'green', label: 'Active' };
    case 'provisioning':
      return { tone: 'amber', label: 'Provisioning' };
    case 'maintenance':
      return { tone: 'orange', label: 'Maintenance' };
    case 'down':
      return { tone: 'red', label: 'Down' };
    default:
      return { tone: 'gray', label: status };
  }
};

/** Map a BGP session state to a tone. */
export const sessionStateTone = (state: string): { tone: Tone; label: string } => {
  const s = String(state).toLowerCase();
  if (s === 'up' || s === 'established') return { tone: 'green', label: 'Up' };
  if (s === 'down') return { tone: 'red', label: 'Down' };
  if (s.includes('start') || s.includes('connect') || s.includes('active'))
    return { tone: 'amber', label: state };
  return { tone: 'gray', label: state || 'Unknown' };
};

/** Map an incident impact to a tone. */
export const impactTone = (impact: string): Tone => {
  switch (impact) {
    case 'critical':
      return 'red';
    case 'major':
      return 'orange';
    case 'maintenance':
      return 'amber';
    default:
      return 'amber';
  }
};

/** Empty/placeholder state block. */
export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; hint?: string }> = ({
  icon,
  title,
  hint,
}) => (
  <div className="border border-dashed border-gray-300 bg-white py-16 flex flex-col items-center justify-center text-center px-6">
    {icon && <div className="text-gray-300 mb-4">{icon}</div>}
    <p className="font-mono text-label tracking-label uppercase text-gray-500">{title}</p>
    {hint && <p className="text-sm text-gray-400 mt-2 max-w-md">{hint}</p>}
  </div>
);
