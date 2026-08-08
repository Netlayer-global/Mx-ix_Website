import React from 'react';

/**
 * SectionEyebrow
 * The single source of truth for section labels across the site.
 *
 * Visual language: hairline rule -> wide-tracked mono label -> brand red dot,
 * implemented by the `.eyebrow` class in index.css. The rule inherits
 * currentColor, so the same markup reads correctly on light and dark sections.
 */
const SectionEyebrow: React.FC<{
  children: React.ReactNode;
  /** Kept for readability at call sites; colour is inherited automatically. */
  tone?: 'light' | 'dark';
  className?: string;
}> = ({ children, tone = 'light', className = '' }) => (
  <span className={`eyebrow ${tone === 'dark' ? 'text-white' : 'text-ink'} ${className}`.trim()}>
    {children}
  </span>
);

export default SectionEyebrow;
