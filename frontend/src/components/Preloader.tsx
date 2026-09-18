import React, { useEffect, useState } from 'react';

/**
 * Preloader — a cinematic, network-fabric themed entry screen.
 *
 * Visual language: an internet exchange lighting up. Nodes connect,
 * data sweeps across the fabric, and the brand resolves into focus.
 * Runs once per session; skipped for reduced-motion users.
 */

/** Fixed node positions (percent) forming an abstract exchange topology. */
const NODES = [
  { x: 18, y: 26 }, { x: 50, y: 14 }, { x: 82, y: 26 },
  { x: 12, y: 58 }, { x: 50, y: 50 }, { x: 88, y: 58 },
  { x: 22, y: 82 }, { x: 50, y: 88 }, { x: 78, y: 82 },
];

/** Edges between node indices — the peering fabric. */
const EDGES: Array<[number, number]> = [
  [0, 1], [1, 2], [0, 4], [1, 4], [2, 4],
  [3, 4], [4, 5], [3, 0], [5, 2],
  [6, 4], [7, 4], [8, 4], [6, 7], [7, 8], [3, 6], [5, 8],
];

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
      value += Math.max(0.8, (100 - value) * 0.055);
      if (value >= 100) {
        value = 100;
        clearInterval(interval);
        setProgress(100);
        setTimeout(() => setDone(true), 550);
        setTimeout(() => setRemoved(true), 1400);
      } else {
        setProgress(value);
      }
    }, 50);

    return () => clearInterval(interval);
  }, []);

  if (removed) return null;

  // Reveal nodes/edges progressively as loading advances
  const revealed = (i: number, total: number) => progress > (i / total) * 85;

  return (
    <div
      className={`fixed inset-0 z-[200] overflow-hidden bg-[#050506] transition-all duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
        done ? 'opacity-0 pointer-events-none scale-[1.04]' : 'opacity-100 scale-100'
      }`}
      aria-hidden="true"
    >
      {/* Deep radial vignette */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, rgba(242,7,50,0.07) 0%, transparent 55%)' }}
      />

      {/* Fabric topology canvas */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F20732" stopOpacity="0.05" />
            <stop offset="50%" stopColor="#F20732" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#F20732" stopOpacity="0.05" />
          </linearGradient>
          <filter id="nodeGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Edges */}
        {EDGES.map(([a, b], i) => {
          const n1 = NODES[a];
          const n2 = NODES[b];
          const on = revealed(i, EDGES.length);
          return (
            <line
              key={`e${i}`}
              x1={`${n1.x}%`}
              y1={`${n1.y}%`}
              x2={`${n2.x}%`}
              y2={`${n2.y}%`}
              stroke="url(#edgeGrad)"
              strokeWidth="1"
              className="transition-opacity duration-700"
              style={{ opacity: on ? 1 : 0 }}
            />
          );
        })}

        {/* Nodes */}
        {NODES.map((n, i) => {
          const on = revealed(i, NODES.length);
          const isHub = i === 4;
          return (
            <g key={`n${i}`} className="transition-opacity duration-700" style={{ opacity: on ? 1 : 0 }}>
              <circle
                cx={`${n.x}%`}
                cy={`${n.y}%`}
                r={isHub ? 4 : 2.5}
                fill={isHub ? '#F20732' : '#ffffff'}
                fillOpacity={isHub ? 1 : 0.5}
                filter={isHub ? 'url(#nodeGlow)' : undefined}
              />
              {isHub && (
                <circle cx={`${n.x}%`} cy={`${n.y}%`} r="4" fill="none" stroke="#F20732" strokeWidth="1" opacity="0.5">
                  <animate attributeName="r" values="4;22;4" dur="2.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.5;0;0.5" dur="2.6s" repeatCount="indefinite" />
                </circle>
              )}
            </g>
          );
        })}
      </svg>

      {/* Horizontal data sweep */}
      <div
        className="absolute left-0 right-0 h-[1px] pointer-events-none"
        style={{
          top: '50%',
          background: 'linear-gradient(to right, transparent, rgba(242,7,50,0.8), transparent)',
          animation: 'mxSweep 3.2s cubic-bezier(0.4,0,0.2,1) infinite',
        }}
      />

      {/* Center content */}
      <div className="relative h-full flex flex-col items-center justify-center">
        {/* Logo in a glass plate */}
        <div className="relative mb-9">
          <div className="absolute inset-0 rounded-3xl bg-[#F20732]/20 blur-2xl scale-125" />
          <div className="relative w-[104px] h-[104px] rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-md flex items-center justify-center overflow-hidden">
            {/* Inner sheen */}
            <div
              className="absolute inset-0 opacity-40"
              style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.12), transparent 45%)' }}
            />
            <img
              src="/assets/logo.png"
              alt="MX-IX"
              className="relative w-[60px] h-[60px] object-contain drop-shadow-[0_0_24px_rgba(242,7,50,0.5)]"
            />
          </div>
        </div>

        {/* Wordmark with letter reveal */}
        <div className="flex items-baseline gap-[3px] mb-2">
          {'MX-IX'.split('').map((ch, i) => (
            <span
              key={i}
              className={`font-black tracking-tighter text-[42px] md:text-[54px] leading-none transition-all duration-500 ${
                ch === '-' ? 'text-[#F20732]' : 'text-white'
              }`}
              style={{
                opacity: progress > 12 + i * 9 ? 1 : 0,
                transform: progress > 12 + i * 9 ? 'translateY(0)' : 'translateY(8px)',
                transitionDelay: `${i * 40}ms`,
              }}
            >
              {ch}
            </span>
          ))}
          <span
            className="ml-1.5 w-2 h-2 rounded-full bg-[#F20732] shadow-[0_0_16px_#F20732] transition-opacity duration-500"
            style={{ opacity: progress > 60 ? 1 : 0 }}
          />
        </div>

        {/* Tagline */}
        <p
          className="font-mono text-[10px] tracking-[0.35em] uppercase text-white/30 mb-10 transition-opacity duration-700"
          style={{ opacity: progress > 40 ? 1 : 0 }}
        >
          Internet Exchange
        </p>

        {/* Progress */}
        <div className="relative w-[280px]">
          <div className="h-[2px] bg-white/[0.07] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-150 ease-out"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(to right, rgba(242,7,50,0.4), #F20732)',
                boxShadow: '0 0 12px rgba(242,7,50,0.7)',
              }}
            />
          </div>
          {/* Leading edge dot */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white transition-[left] duration-150"
            style={{ left: `calc(${progress}% - 3px)`, boxShadow: '0 0 10px #fff, 0 0 20px #F20732' }}
          />
        </div>

        {/* Status line */}
        <div className="mt-5 flex items-center gap-3 font-mono text-[10px] tracking-[0.25em] uppercase">
          <span className="text-white/35">
            {progress < 30 ? 'Connecting nodes' : progress < 65 ? 'Syncing fabric' : progress < 95 ? 'Establishing peers' : 'Ready'}
          </span>
          <span className="w-8 h-[1px] bg-white/15" />
          <span className="text-[#F20732] tabular-nums font-bold">{String(Math.round(progress)).padStart(3, '0')}</span>
        </div>
      </div>

      {/* Corner frame accents */}
      <div className="absolute top-6 left-6 w-10 h-10 border-l border-t border-white/10" />
      <div className="absolute top-6 right-6 w-10 h-10 border-r border-t border-white/10" />
      <div className="absolute bottom-6 left-6 w-10 h-10 border-l border-b border-white/10" />
      <div className="absolute bottom-6 right-6 w-10 h-10 border-r border-b border-white/10" />

      <style>{`
        @keyframes mxSweep {
          0% { transform: translateY(-46vh); opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translateY(46vh); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default Preloader;
