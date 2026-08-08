import React from 'react';
import './OrbitalLogo.css';

const OrbitalLogo: React.FC = () => {
  return (
    <div className="orbital-logo-container">
      <svg
        className="orbital-logo-svg"
        width="60"
        height="60"
        viewBox="0 0 309.37 309.37"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Filter for depth/shadow */}
          <filter id="depthShadow">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
            <feOffset dx="1" dy="1" result="offsetblur"/>
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.3"/>
            </feComponentTransfer>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Logo image */}
        <g className="logo-orbital-group" filter="url(#depthShadow)">
          <image 
            width="309.37" 
            height="309.37" 
            href="/assets/logo svg@4xMorphnove logo elements.svg"
            style={{ transformOrigin: 'center center' }}
          />
        </g>
      </svg>
    </div>
  );
};

export default OrbitalLogo;
