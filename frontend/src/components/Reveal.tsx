import React, { useEffect, useRef, useState } from 'react';

interface RevealProps {
  children: React.ReactNode;
  /** Stagger delay in milliseconds */
  delay?: number;
  /** Extra classes for the wrapper */
  className?: string;
  /** Render as a different element (default: div) */
  as?: keyof JSX.IntrinsicElements;
  /** Only reveal once (default: true) */
  once?: boolean;
}

/**
 * Reveal
 * Fades + rises its children into view when scrolled into the viewport.
 * Uses IntersectionObserver and the global [data-reveal] CSS in index.css,
 * so it automatically respects prefers-reduced-motion.
 */
const Reveal: React.FC<RevealProps> = ({
  children,
  delay = 0,
  className = '',
  as = 'div',
  once = true,
}) => {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            setVisible(false);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [once]);

  const Tag = as as React.ElementType;

  return (
    <Tag
      ref={ref as React.Ref<HTMLElement>}
      data-reveal=""
      className={`${visible ? 'is-visible' : ''} ${className}`.trim()}
      style={{ ['--reveal-delay' as string]: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
};

export default Reveal;
