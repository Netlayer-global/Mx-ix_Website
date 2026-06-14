import React, { useState, useRef } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  Line,
  ZoomableGroup,
} from "react-simple-maps";
import { Map, Network, Clock, Globe2 } from "lucide-react";
import { useAdmin } from "../contexts/AdminContext";

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

type Location = {
  id: string;
  name: string;
  coordinates: [number, number];
  code: string;
  region: string;
  asns: number;
  sites: number;
};

// Locations now come from AdminContext

// Connection lines between major hubs (admin configurable - disabled for now)
// const connections = [
//   ["nyc", "lon"],
//   ["nyc", "sfo"],
//   ["lon", "ams"],
//   ["lon", "frk"],
//   ["ams", "frk"],
//   ["frk", "bom"],
//   ["bom", "sgp"],
//   ["sgp", "tyo"],
//   ["tyo", "sfo"],
//   ["sfo", "syd"],
//   ["ams", "syd"],
//   ["tyo", "syd"],
//   ["sgp", "syd"],
// ];

const GlobalFabricMap = () => {
  const { locations, globalFabricStats } = useAdmin();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([10, 20]);
  const [cardPosition, setCardPosition] = useState<{ x: number; y: number } | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const isVisible = (id: string) => activeId === id || hoveredId === id;

  const handleReset = () => {
    setZoom(1);
    setCenter([10, 20]);
    setActiveId(null);
    setHoveredId(null);
    setCardPosition(null);
  };

  // Handle marker hover - capture position for card overlay
  const handleMarkerHover = (loc: any, e: React.MouseEvent) => {
    setHoveredId(loc.id);
    if (mapContainerRef.current) {
      const rect = mapContainerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setCardPosition({ x, y });
    }
  };

  // Handle marker leave
  const handleMarkerLeave = () => {
    if (!activeId) {
      setHoveredId(null);
      setCardPosition(null);
    }
  };

  // Handle marker click
  const handleMarkerClick = (loc: any, e: React.MouseEvent) => {
    if (activeId === loc.id) {
      setActiveId(null);
      setCardPosition(null);
    } else {
      setActiveId(loc.id);
      if (mapContainerRef.current) {
        const rect = mapContainerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setCardPosition({ x, y });
      }
    }
  };

  // Removed for now - can be enabled via admin panel later
  // const getConnectionCoordinates = (id1: string, id2: string) => {
  //   const loc1 = locations.find(l => l.id === id1);
  //   const loc2 = locations.find(l => l.id === id2);
  //   if (loc1 && loc2) {
  //     return { from: loc1.coordinates, to: loc2.coordinates };
  //   }
  //   return null;
  // };

  return (
    <section className="relative w-full bg-gradient-to-br from-gray-50 via-white to-gray-50 py-16 overflow-hidden">
      {/* Background Grid */}

      <div className="relative max-w-[1800px] mx-auto px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-3">
            <div className="relative w-12 h-12 bg-[#F20732] flex items-center justify-center shadow-lg shadow-[#F20732]/50">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-5xl font-black text-black tracking-tight leading-none">
                MX-IX Global Map
              </h2>
              <p className="text-[#F20732] text-xs font-bold tracking-[0.2em] uppercase mt-1">
                {locations.length} ACTIVE LOCATIONS WORLDWIDE
              </p>
            </div>
          </div>
        </div>

        {/* Map Container */}
        <div className="relative bg-white border-2 border-gray-200 rounded-xl overflow-hidden">
          {/* Top Stats Bar */}
          <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-20">
            <div className="flex items-center gap-4">
              <div className="bg-white/90 backdrop-blur-md border border-gray-200 rounded-lg px-4 py-2 shadow-sm">
                <span className="text-gray-700 text-xs font-mono font-semibold">UPTIME: 99.99%</span>
              </div>
            </div>

            {/* Zoom Controls */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setZoom(z => Math.min(z * 1.5, 4))}
                className="w-10 h-10 bg-white/90 backdrop-blur-md border border-gray-200 rounded-lg flex items-center justify-center text-black hover:border-[#F20732] hover:text-[#F20732] transition-all shadow-sm"
              >
                <span className="text-xl font-bold">+</span>
              </button>
              <button
                onClick={() => setZoom(z => Math.max(z / 1.5, 1))}
                className="w-10 h-10 bg-white/90 backdrop-blur-md border border-gray-200 rounded-lg flex items-center justify-center text-black hover:border-[#F20732] hover:text-[#F20732] transition-all shadow-sm"
              >
                <span className="text-xl font-bold">−</span>
              </button>
              <button
                onClick={handleReset}
                className="w-10 h-10 bg-white/90 backdrop-blur-md border border-gray-200 rounded-lg flex items-center justify-center text-black hover:border-[#F20732] hover:text-[#F20732] transition-all shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </button>
            </div>
          </div>

          {/* Map */}
          <div className="relative" ref={mapContainerRef}>
            <ComposableMap
              projection="geoMercator"
              className="w-full h-[500px]"
              projectionConfig={{ scale: 140, center: center }}
            >
              <ZoomableGroup zoom={zoom} center={center}>
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map((geo) => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill="#f5f5f5"
                        stroke="#d1d5db"
                        strokeWidth={0.5}
                        style={{
                          default: { outline: "none" },
                          hover: { outline: "none", fill: "#e5e7eb" },
                          pressed: { outline: "none" },
                        }}
                      />
                    ))
                  }
                </Geographies>

                {/* Location Markers - Active marker renders last to appear on top */}
                {locations
                  .sort((a, b) => {
                    // Active or hovered marker should render last (on top)
                    const aIsActive = a.id === activeId || a.id === hoveredId;
                    const bIsActive = b.id === activeId || b.id === hoveredId;
                    if (aIsActive && !bIsActive) return 1;
                    if (!aIsActive && bIsActive) return -1;
                    return 0;
                  })
                  .map((loc) => (
                  <Marker
                    key={loc.id}
                    coordinates={loc.coordinates}
                    onMouseEnter={(e) => handleMarkerHover(loc, e as any)}
                    onMouseLeave={handleMarkerLeave}
                    onClick={(e) => handleMarkerClick(loc, e as any)}
                  >
                    <g className="cursor-pointer">
                      {/* Pulse rings on hover */}
                      {isVisible(loc.id) && (
                        <>
                          <circle
                            r={20}
                            fill="none"
                            stroke={loc.status === 'current' ? "#F20732" : "#9CA3AF"}
                            strokeWidth={2}
                            opacity={0.6}
                            className="animate-ping"
                          />
                          <circle
                            r={15}
                            fill="none"
                            stroke={loc.status === 'current' ? "#F20746" : "#6B7280"}
                            strokeWidth={1.5}
                            opacity={0.4}
                            className="animate-ping"
                            style={{ animationDelay: '0.2s' }}
                          />
                        </>
                      )}
                      
                      {/* Glow circle */}
                      {isVisible(loc.id) && (
                        <circle r={10} fill={loc.status === 'current' ? "#F20732" : "#9CA3AF"} opacity={0.3} />
                      )}
                      
                      {/* Main marker */}
                      <circle
                        r={isVisible(loc.id) ? 6 : 5}
                        fill={loc.status === 'current' ? "#F20732" : "#9CA3AF"}
                        className="transition-all duration-300"
                      />
                      <circle
                        r={isVisible(loc.id) ? 3 : 2.5}
                        fill="#ffffff"
                        className="transition-all duration-300"
                      />
                    </g>
                  </Marker>
                ))}
              </ZoomableGroup>
            </ComposableMap>

            {/* Info Card - Rendered outside ComposableMap to maintain fixed size on zoom */}
            {(activeId || hoveredId) && cardPosition && (() => {
              const loc = locations.find(l => l.id === (activeId || hoveredId));
              if (!loc) return null;
              return (
                <div
                  className="absolute z-50 animate-fadeIn pointer-events-auto"
                  style={{
                    left: `${cardPosition.x + 15}px`,
                    top: `${cardPosition.y - 85}px`,
                  }}
                >
                  <div className="relative">
                    {/* Glow effect */}
                    <div className={`absolute -inset-1 rounded-lg blur-md opacity-50 ${loc.status === 'current' ? 'bg-[#F20732]' : 'bg-gray-400'}`} />
                    
                    {/* Card */}
                    <div className="relative bg-white border-2 border-gray-200 shadow-2xl rounded-lg overflow-hidden w-[200px]">
                      {/* Header */}
                      <div className="bg-white border-b border-gray-200 px-4 py-2">
                        <div className="flex items-center justify-between">
                          <p className="text-black text-sm font-black uppercase tracking-tight">
                            {loc.name}
                          </p>
                          {loc.status === 'upcoming' && (
                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[7px] font-bold uppercase tracking-wider rounded">
                              Soon
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 text-[9px] tracking-wide">
                          MX-IX Exchange
                        </p>
                      </div>

                      {/* Content */}
                      <div className="px-4 py-3 space-y-1.5">
                        {/* Connected ASNs - Clickable link */}
                        <div 
                          className="flex justify-between text-[10px] cursor-pointer hover:bg-gray-50 px-1 py-0.5 -mx-1 rounded transition-colors group"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.dispatchEvent(new CustomEvent('navigateToLocations', { 
                              detail: { locationId: loc.id, locationName: loc.name, section: 'asns' } 
                            }));
                          }}
                        >
                          <span className="text-gray-600 group-hover:text-[#F20732] transition-colors">Connected ASNs:</span>
                          <span className="text-black font-bold group-hover:text-[#F20732] transition-colors flex items-center gap-1">
                            {loc.asnList?.length || 0}
                            <span className="text-gray-400 group-hover:text-[#F20732]">→</span>
                          </span>
                        </div>
                        {/* Enabled sites - Clickable link */}
                        <div 
                          className="flex justify-between text-[10px] cursor-pointer hover:bg-gray-50 px-1 py-0.5 -mx-1 rounded transition-colors group"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.dispatchEvent(new CustomEvent('navigateToLocations', { 
                              detail: { locationId: loc.id, locationName: loc.name, section: 'sites' } 
                            }));
                          }}
                        >
                          <span className="text-gray-600 group-hover:text-[#F20732] transition-colors">Enabled sites:</span>
                          <span className="text-black font-bold group-hover:text-[#F20732] transition-colors flex items-center gap-1">
                            {loc.enabledSites?.length || 0}
                            <span className="text-gray-400 group-hover:text-[#F20732]">→</span>
                          </span>
                        </div>
                        <p className="text-gray-500 text-[9px] tracking-wide">Cloud providers</p>
                        
                        {/* CTA Button */}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            window.dispatchEvent(new CustomEvent('navigateToLocations', { 
                              detail: { locationId: loc.id, locationName: loc.name, section: 'overview' } 
                            }));
                          }}
                          className="w-full mt-2 bg-[#F20732] text-white text-[10px] font-bold uppercase tracking-wider py-2 rounded hover:bg-[#C00628] transition-colors flex items-center justify-center gap-2"
                        >
                          VIEW DETAILS
                          <span className="text-xs">→</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Bottom stats bar */}
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="font-mono text-[9px] text-gray-600 tracking-widest uppercase bg-white/60 backdrop-blur-sm px-3 py-1.5 rounded border border-gray-200 shadow-sm">
                PROJECTION: MERCATOR
              </div>
              <div className="font-mono text-[9px] text-gray-600 tracking-widest uppercase bg-white/60 backdrop-blur-sm px-3 py-1.5 rounded border border-gray-200 shadow-sm">
                LAYER: GLOBAL FABRIC
              </div>
            </div>
            
            <div className="flex items-center gap-2 bg-white/60 backdrop-blur-sm px-3 py-1.5 rounded border border-gray-200 shadow-sm">
              <div className="w-1.5 h-1.5 bg-[#F20732] rounded-full animate-pulse" />
              <span className="font-mono text-[9px] text-[#F20732] tracking-widest uppercase font-bold">
                LIVE NETWORK
              </span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </section>
  );
};

export default GlobalFabricMap;
