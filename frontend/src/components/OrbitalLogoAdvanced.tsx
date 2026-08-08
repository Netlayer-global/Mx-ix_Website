import React from 'react';
import './OrbitalLogoAdvanced.css';

interface OrbitalLogoAdvancedProps {
  isAnimating?: boolean;
}

const OrbitalLogoAdvanced: React.FC<OrbitalLogoAdvancedProps> = ({ isAnimating = false }) => {
  return (
    <div className="orbital-logo-advanced">
      <svg
        className="orbital-logo-svg-advanced"
        width="40"
        height="40"
        viewBox="0 0 309.37 309.37"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Advanced depth and glow filters */}
          <filter id="orbitalGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
            <feOffset dx="0" dy="0" result="offsetblur"/>
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.4"/>
            </feComponentTransfer>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          {/* Depth shadow for 3D effect */}
          <filter id="depthShadow" x="-50%" y="-50%" width="200%" height="200%">
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

        <g 
          className={isAnimating ? 'orbital-group' : 'orbital-group-paused'}
          filter="url(#depthShadow)"
        >
          <image
            width="309.37"
            height="309.37"
            href="/assets/logo.png"
            style={{ 
              transformOrigin: 'center center',
              filter: 'url(#orbitalGlow)'
            }}
          />
        </g>
      </svg>
    </div>
  );
};

export default OrbitalLogoAdvanced;
