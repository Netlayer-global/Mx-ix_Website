import React from 'react';

const HeroNetworkMap: React.FC = () => {
  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* High-quality static world map image */}
      <img 
        src="/assets/world-map-dots.png"
        alt="Global Network Map" 
        className="w-full h-full object-cover opacity-90"
        style={{ 
          objectFit: 'cover',
          objectPosition: 'center right',
        }}
        onError={(e) => {
          console.error('Failed to load world map image');
          e.currentTarget.style.display = 'none';
        }}
      />
    </div>
  );
};

export default HeroNetworkMap;
