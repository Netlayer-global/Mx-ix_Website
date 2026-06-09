import React, { useEffect, useState } from 'react';

/**
 * Preloader
 * A brief, branded entry screen shown on first load that fades out
 * smoothly. Gives the site a polished, premium first impression.
 * Only runs once per session and is skipped for reduced-motion users.
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
      // ease toward 100 with slight randomness
      value += Math.max(1, (100 - value) * 0.08);
      if (value >= 100) {
        value = 100;
        clearInterval(interval);
        setProgress(100);
        setTimeout(() => setDone(true), 350);
        setTimeout(() => setRemoved(true), 1100);
      } else {
        setProgress(value);
      }
    }, 60);

    return () => clearInterval(interval);
  }, []);

  if (removed) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#0A0A0B] transition-opacity duration-700 ease-out ${
        done ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-hidden="true"
    >
      <div className="relative flex items-center gap-3 mb-10">
        <span className="text-white font-black tracking-tighter text-4xl md:text-5xl">MX-IX</span>
        <span className="w-2 h-2 rounded-full bg-[#F20732] animate-pulse"></span>
      </div>

      {/* progress bar */}
      <div className="relative w-48 h-px bg-white/15 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-[#F20732] transition-[width] duration-150 ease-out"
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      <div className="mt-4 font-mono text-label-sm tracking-mono uppercase text-white/40">
        Initializing Fabric // {Math.round(progress)}%
      </div>
    </div>
  );
};

export default Preloader;
