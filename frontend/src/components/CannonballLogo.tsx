import React from 'react';
import './CannonballLogo.css';

const CannonballLogo: React.FC = () => {
  return (
    <div className="cannonball-logo-wrapper">
      <div className="cannonball-logo-container">
        <svg
          className="cannonball-svg"
          width="200"
          height="200"
          viewBox="0 0 200 200"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Defs for masks and gradients */}
          <defs>
            {/* Rounded shape mask for the rolling illusion */}
            <mask id="roundedMask">
              <circle 
                cx="100" 
                cy="100" 
                r="0" 
                fill="white"
                className="rounded-mask-circle"
              />
            </mask>

            {/* Gradient for 3D depth illusion */}
            <radialGradient id="depthGradient">
              <stop offset="0%" stopColor="white" stopOpacity="1" />
              <stop offset="50%" stopColor="white" stopOpacity="0.8" />
              <stop offset="100%" stopColor="white" stopOpacity="0.6" />
            </radialGradient>
          </defs>

          {/* Main logo group - sharp star initial state */}
          <g className="logo-main-group">
            {/* Sharp star shape (initial state) */}
            <path
              className="star-shape"
              d="M100,20 L115,70 L170,70 L125,105 L145,155 L100,120 L55,155 L75,105 L30,70 L85,70 Z"
              fill="white"
              stroke="none"
            />

            {/* Rounded shape (revealed during rotation) */}
            <circle
              className="rounded-shape"
              cx="100"
              cy="100"
              r="60"
              fill="url(#depthGradient)"
              mask="url(#roundedMask)"
              opacity="0"
            />
          </g>
        </svg>
      </div>
    </div>
  );
};

export default CannonballLogo;
