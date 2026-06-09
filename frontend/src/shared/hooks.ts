import React, { useState, useEffect, useRef } from 'react';

// --- TYPES ---
interface AppData {
  latency: number;
  peers: number;
  capacity: number;
  locations: LocationData[];
}

interface LocationData {
  id: string;
  name: string;
  region: string;
  status: 'active' | 'maintenance' | 'planned';
  latency: string;
}

// --- MOCK DATA ---
const INITIAL_DATA: AppData = {
  latency: 0.4,
  peers: 4921,
  capacity: 124,
  locations: [
    { id: 'ams', name: 'AMSTERDAM', region: 'EU', status: 'active', latency: '0.8ms' },
    { id: 'nyc', name: 'NEW YORK', region: 'NA', status: 'active', latency: '1.2ms' },
    { id: 'sin', name: 'SINGAPORE', region: 'APAC', status: 'active', latency: '2.1ms' },
    { id: 'frk', name: 'FRANKFURT', region: 'EU', status: 'active', latency: '0.9ms' },
    { id: 'tyo', name: 'TOKYO', region: 'APAC', status: 'active', latency: '1.5ms' },
  ]
};

// --- CUSTOM HOOKS ---
const useCounterAnimation = (end: number, isFloat: boolean = false, duration: number = 2000) => {
  const [count, setCount] = useState('0');
  const elementRef = useRef<HTMLSpanElement>(null);
  const observer = useRef<IntersectionObserver | null>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) {
        setCount(isFloat ? end.toFixed(1) : Math.floor(end).toLocaleString());
        return; 
    }

    if (elementRef.current) {
      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true;
            let start = 0;
            const increment = end / (duration / 16); 
            
            const timer = setInterval(() => {
              start += increment;
              if (start >= end) {
                setCount(isFloat ? end.toFixed(1) : Math.floor(end).toLocaleString());
                clearInterval(timer);
              } else {
                setCount(isFloat ? start.toFixed(1) : Math.floor(start).toLocaleString());
              }
            }, 16);
          }
        },
        { threshold: 0.5 }
      );
      observer.current.observe(elementRef.current);
    }
    return () => observer.current?.disconnect();
  }, [end, duration, isFloat]);

  useEffect(() => {
     if (hasAnimated.current) {
         setCount(isFloat ? end.toFixed(1) : Math.floor(end).toLocaleString());
     }
  }, [end, isFloat]);

  return { count, elementRef };
};

const useMousePosition = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const updateMousePosition = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', updateMousePosition);
    return () => window.removeEventListener('mousemove', updateMousePosition);
  }, []);
  return mousePosition;
};

// Continue in next file due to size...
export { useCounterAnimation, useMousePosition, INITIAL_DATA };
export type { AppData, LocationData };
