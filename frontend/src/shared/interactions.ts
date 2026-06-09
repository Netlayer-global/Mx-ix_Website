import { useEffect, useRef } from 'react';

const reduceMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const isCoarsePointer = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(pointer: coarse)').matches;

/**
 * useMagnetic
 * Subtly pulls an element toward the cursor when hovering nearby,
 * giving CTAs a premium "magnetic" feel. Writes transforms directly
 * (no React re-render). Disabled on touch + reduced-motion.
 *
 * @param strength how far the element shifts (px-ish multiplier)
 */
export function useMagnetic<T extends HTMLElement>(strength = 0.35) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduceMotion() || isCoarsePointer()) return;

    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - (rect.left + rect.width / 2);
      const y = e.clientY - (rect.top + rect.height / 2);
      el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
    };

    const reset = () => {
      el.style.transform = 'translate(0px, 0px)';
    };

    el.addEventListener('mousemove', handleMove);
    el.addEventListener('mouseleave', reset);
    return () => {
      el.removeEventListener('mousemove', handleMove);
      el.removeEventListener('mouseleave', reset);
    };
  }, [strength]);

  return ref;
}

/**
 * useParallax
 * Applies a subtle counter-cursor translate/tilt to an element based on
 * pointer position over the window, creating depth. Performance-friendly
 * (direct style writes, rAF-throttled). Disabled on touch + reduced-motion.
 *
 * @param intensity max pixel offset
 */
export function useParallax<T extends HTMLElement>(intensity = 18) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduceMotion() || isCoarsePointer()) return;

    let frame = 0;

    const handleMove = (e: MouseEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const nx = e.clientX / window.innerWidth - 0.5; // -0.5..0.5
        const ny = e.clientY / window.innerHeight - 0.5;
        el.style.transform = `translate3d(${-nx * intensity}px, ${-ny * intensity}px, 0)`;
        frame = 0;
      });
    };

    window.addEventListener('mousemove', handleMove);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [intensity]);

  return ref;
}
