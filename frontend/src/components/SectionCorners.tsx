import React from 'react';

interface SectionCornersProps {
  /** Which corners to render (default: all four) */
  corners?: Array<'tl' | 'tr' | 'bl' | 'br'>;
}

/**
 * SectionCorners
 * Renders small "+" crosshair marks at the corners of a container,
 * giving a blueprint / technical-schematic accent that matches the
 * brutalist-tech theme.
 *
 * Usage: place inside a `position: relative` element and add the
 * `corner-marks` class to that parent:
 *
 *   <div className="relative corner-marks">
 *     <SectionCorners />
 *     ...content...
 *   </div>
 */
const SectionCorners: React.FC<SectionCornersProps> = ({
  corners = ['tl', 'tr', 'bl', 'br'],
}) => (
  <>
    {corners.map((c) => (
      <span key={c} className={`corner ${c}`} aria-hidden="true" />
    ))}
  </>
);

export default SectionCorners;
