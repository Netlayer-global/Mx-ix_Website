import React, { useEffect, useState } from 'react';

/**
 * Preloader
 * A premium, branded entry screen shown on first load that fades out
 * smoothly. Features the MX-IX logo, animated glow, orbital rings and a
 * fabric-style progress indicator. Runs once per session and is skipped
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
      value += Math.max(1, (100 - value) * 0.07);
      if (value >= 100) {
        value = 100;
        clearInterval(interval);
        setProgress(100);
        setTimeout(() => setDone(true), 450);
        setTimeout(() => setRemoved(true), 1200);
      } else {
        setProgress(value);
      }
    }, 55);

    return () => clearInterval(interval);
  }, []);

  if (removed) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden bg-[#060607] transition-opacity duration-700 ease-out ${
        done ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-hidden="true"
    >
      {/* Ambient background glows */}
      <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-[#F20732]/12 blur-[140px] animate-[pulse_4s_ease-in-out_infinite]" />
      <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-[#F20732]/8 blur-[140px] animate-[pulse_5s_ease-in-out_infinite]" />

      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Logo with orbital rings */}
      <div className="relative flex items-center justify-center mb-12">
        {/* Rotating orbital rings */}
        <div className="absolute w-40 h-40 rounded-full border border-[#F20732]/20 animate-[spin_8s_linear_infinite]">
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#F20732] shadow-[0_0_12px_#F20732]" />
        </div>
        <div className="absolute w-56 h-56 rounded-full border border-white/5 animate-[spin_14s_linear_infinite_reverse]">
          <span className="absolute top-1/2 -right-1 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/40" />
        </div>

        {/* Logo mark */}
        <div className="relative w-24 h-24 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm animate-[pulse_2.5s_ease-in-out_infinite]">
          <img
            src="/assets/logo.png"
            alt="MX-IX"
            className="w-14 h-14 object-contain drop-shadow-[0_0_20px_rgba(242,7,50,0.4)]"
          />
        </div>
      </div>

      {/* Wordmark */}
      <div className="relative flex items-center gap-2 mb-8">
        <span className="text-white font-black tracking-tighter text-4xl md:text-5xl">
          MX<span className="text-[#F20732]">-</span>IX
        </span>
        <span className="w-2.5 h-2.5 rounded-full bg-[#F20732] shadow-[0_0_14px_#F20732] animate-pulse" />
      </div>

      {/* Progress bar with glow */}
      <div className="relative w-64 h-[3px] bg-white/8 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#F20732]/60 to-[#F20732] rounded-full transition-[width] duration-150 ease-out shadow-[0_0_10px_#F20732]"
          style={{ width: `${progress}%` }}
        />
        {/* Moving shimmer */}
        <div
          className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/40 to-transparent transition-[left] duration-150"
          style={{ left: `calc(${progress}% - 4rem)` }}
        />
      </div>

      {/* Status text */}
      <div className="mt-5 flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] uppercase text-white/45">
        <span className="w-1.5 h-1.5 rounded-full bg-[#F20732] animate-pulse" />
        Initializing Fabric
        <span className="text-white/70 tabular-nums">{Math.round(progress)}%</span>
      </div>
    </div>
  );
};

export default Preloader;
