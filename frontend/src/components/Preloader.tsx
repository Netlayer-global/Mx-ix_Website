import React, { useEffect, useState } from 'react';

/**
 * Preloader — a clean, static entry screen matching the site header brand lockup.
 * No motion beyond the progress fill. Runs once per session and is skipped
 * for reduced-motion users.
 */
const Preloader: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const seen = sessionStorage.getItem('mxix-loaded');

    if (reduce || seen) {
      setDone(true);
      setRemoved(true);
      return;
    }

    sessionStorage.setItem('mxix-loaded', '1');

    let value = 0;
    const interval = setInterval(() => {
      value += Math.max(1, (100 - value) * 0.08);
      if (value >= 100) {
        value = 100;
        clearInterval(interval);
        setProgress(100);
        setTimeout(() => setDone(true), 300);
        setTimeout(() => setRemoved(true), 1000);
      } else {
        setProgress(value);
      }
    }, 50);

    return () => clearInterval(interval);
  }, []);

  if (removed) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-ink transition-opacity duration-700 ease-out ${
        done ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-hidden="true"
    >
      {/* Brand lockup — matches the site header */}
      <div className="flex items-center gap-2">
        <img
          src="/assets/logo-mark.png"
          alt="MX-IX"
          width="56"
          height="56"
          className="w-12 h-12 sm:w-14 sm:h-14 object-contain"
        />
        <span className="text-3xl sm:text-4xl font-black tracking-tighter leading-none text-white">MX-IX</span>
      </div>

      {/* Progress */}
      <div className="mt-10 w-56 h-[2px] bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#F20732] rounded-full transition-[width] duration-150 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Percentage */}
      <div className="mt-4 font-mono text-[11px] tracking-[0.25em] uppercase text-white/35 tabular-nums">
        {Math.round(progress)}%
      </div>
    </div>
  );
};

export default Preloader;
