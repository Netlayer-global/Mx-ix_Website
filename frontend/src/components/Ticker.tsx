import React from 'react';

interface TickerProps {
  items: string[];
  /** dark band (default) or light */
  variant?: 'dark' | 'light';
}

/**
 * Ticker
 * An infinite horizontal marquee band of key facts / signals.
 * Uses the `animate-marquee` keyframe (duplicated content for a seamless loop).
 * Pauses on hover and respects prefers-reduced-motion globally.
 */
const Ticker: React.FC<TickerProps> = ({ items, variant = 'dark' }) => {
  const isDark = variant === 'dark';
  const sep = (
    <span className="mx-6 text-[#F20732]" aria-hidden="true">
      ✦
    </span>
  );

  const row = (
    <div className="flex items-center shrink-0">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          <span className="font-mono text-label font-bold tracking-mono uppercase whitespace-nowrap">
            {item}
          </span>
          {sep}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div
      className={`relative w-full overflow-hidden border-y py-4 group ${
        isDark
          ? 'bg-[#0A0A0B] text-white border-white/10'
          : 'bg-white text-[#0A0A0B] border-gray-200'
      }`}
    >
      {/* edge fades */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none bg-gradient-to-r ${
          isDark ? 'from-[#0A0A0B]' : 'from-white'
        } to-transparent`}
      ></div>
      <div
        className={`absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none bg-gradient-to-l ${
          isDark ? 'from-[#0A0A0B]' : 'from-white'
        } to-transparent`}
      ></div>

      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
        {row}
        {row}
      </div>
    </div>
  );
};

export default Ticker;
