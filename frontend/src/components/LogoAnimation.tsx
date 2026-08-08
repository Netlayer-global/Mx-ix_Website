import React, { useEffect, useState } from 'react';
import './LogoAnimation.css';

const LogoAnimation: React.FC = () => {
  const [animationComplete, setAnimationComplete] = useState(false);

  useEffect(() => {
    // Mark animation as complete after 3 seconds
    const timer = setTimeout(() => {
      setAnimationComplete(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`logo-animation-wrapper ${animationComplete ? 'complete' : ''}`}>
      <div className="logo-animation-container">
        <svg
          className="animated-logo"
          width="400"
          height="400"
          viewBox="0 0 309.37 309.37"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Define the mask for progressive reveal */}
          <defs>
            <mask id="logoMask">
              <rect 
                className="mask-rect" 
                x="0" 
                y="0" 
                width="0" 
                height="309.37" 
                fill="white"
              />
            </mask>
          </defs>

          {/* Logo content with mask applied */}
          <g mask="url(#logoMask)" className="logo-group">
            {/* Using the actual logo SVG */}
            <image 
              width="309.37" 
              height="309.37" 
              href="/assets/logo svg@4xMorphnove logo elements.svg"
              className="logo-image"
            />
          </g>
        </svg>
      </div>
    </div>
  );
};

export default LogoAnimation;
