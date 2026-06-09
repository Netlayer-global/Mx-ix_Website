import React, { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  /** Target value to count up to */
  value: number;
  /** Decimal places to show (default: 0) */
  decimals?: number;
  /** Animation duration in ms */
  duration?: number;
  /** Thousands separator formatting (default: true for integers) */
  locale?: boolean;
  className?: string;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const format = (n: number, decimals: number, locale: boolean) => {
  if (decimals > 0) return n.toFixed(decimals);
  return locale ? Math.floor(n).toLocaleString() : String(Math.floor(n));
};

/**
 * CountUp
 * Animates a number from 0 to `value` once it scrolls into view.
 * Uses tabular figures (via .tabular-nums) so digits don't jitter.
 * Respects prefers-reduced-motion (jumps straight to final value).
 */
const CountUp: React.FC<CountUpProps> = ({
  value,
  decimals = 0,
  duration = 1800,
  locale = true,
  className = '',
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(() => format(0, decimals, locale));
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (prefersReducedMotion()) {
      setDisplay(format(value, decimals, locale));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();

          const tick = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // easeOutExpo for a refined, decelerating finish
            const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            setDisplay(format(value * eased, decimals, locale));
            if (progress < 1) requestAnimationFrame(tick);
            else setDisplay(format(value, decimals, locale));
          };

          requestAnimationFrame(tick);
          observer.unobserve(entries[0].target);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [value, decimals, duration, locale]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`.trim()}>
      {display}
    </span>
  );
};

export default CountUp;
