import React from 'react';

interface StatusIndicatorProps {
  /** Label text shown next to the dot */
  label?: string;
  /** Visual state */
  status?: 'operational' | 'maintenance' | 'down';
  /** Render on a dark background (lighter text) */
  dark?: boolean;
  /** Size of label text */
  size?: 'sm' | 'md';
  className?: string;
}

const DOT: Record<NonNullable<StatusIndicatorProps['status']>, string> = {
  operational: 'bg-green-500',
  maintenance: 'bg-amber-500',
  down: 'bg-[#F20732]',
};

const TEXT_DARK: Record<NonNullable<StatusIndicatorProps['status']>, string> = {
  operational: 'text-green-400',
  maintenance: 'text-amber-400',
  down: 'text-[#F20732]',
};

const TEXT_LIGHT: Record<NonNullable<StatusIndicatorProps['status']>, string> = {
  operational: 'text-green-600',
  maintenance: 'text-amber-600',
  down: 'text-[#F20732]',
};

/**
 * StatusIndicator
 * The pulsing-dot + monospace label pattern used across the site,
 * extracted into one reusable, consistent component.
 */
const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  label = 'ALL SYSTEMS OPERATIONAL',
  status = 'operational',
  dark = false,
  size = 'sm',
  className = '',
}) => {
  const textColor = dark ? TEXT_DARK[status] : TEXT_LIGHT[status];
  const textSize = size === 'sm' ? 'text-label-sm' : 'text-label';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="relative flex items-center">
        <span className={`w-1.5 h-1.5 rounded-full ${DOT[status]}`}></span>
        <span className={`w-1.5 h-1.5 rounded-full absolute animate-ping ${DOT[status]}`}></span>
      </span>
      <span className={`font-mono font-bold tracking-mono uppercase whitespace-nowrap ${textSize} ${textColor}`}>
        {label}
      </span>
    </div>
  );
};

export default StatusIndicator;
