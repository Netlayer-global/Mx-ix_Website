import React, { useRef, useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { geoContains } from 'd3-geo';
import { feature } from 'topojson-client';

const INK = '#0A0A0B';
const RED = '#F20732';
const R = 3; // globe radius

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

type Loc = {
  id: string;
  name: string;
  coordinates: [number, number]; // [lng, lat]
  status?: 'current' | 'upcoming';
};

const DEG = Math.PI / 180;

// lat/lng -> point on sphere (shared by land dots and markers so they align)
function latLngToVec3(lat: number, lng: number, radius: number) {
  const phi = (90 - lat) * DEG;
  const theta = (lng + 180) * DEG;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

// Great-circle-ish arc between two surface points, bulging outward
function buildArcBetween(a: THREE.Vector3, b: THREE.Vector3, samples = 54) {
  const an = a.clone().normalize();
  const bn = b.clone().normalize();
  const dist = an.distanceTo(bn);
  const bulge = 0.35 + dist * 0.95;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const dir = new THREE.Vector3().copy(an).lerp(bn, t).normalize();
    pts.push(dir.multiplyScalar(R + Math.sin(Math.PI * t) * bulge));
  }
  return pts;
}

type HoverInfo = { name: string; x: number; y: number } | null;

// centre the globe on the India / UAE region (≈ 70°E) and tilt to show the north
const FOCUS_RY = THREE.MathUtils.degToRad(-160);

const GlobeScene: React.FC<{ reduced: boolean; locations: Loc[]; onHover: (h: HoverInfo) => void }> = ({ reduced, locations, onHover }) => {
  const group = useRef<THREE.Group>(null!);
  const [landDots, setLandDots] = useState<Float32Array | null>(null);

  // Build dotted continents from real world geometry (point-in-polygon)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const topo = await fetch(GEO_URL).then((r) => r.json());
        const land: any = feature(topo, topo.objects.countries);
        const pts: number[] = [];
        const latStep = 2.6;
        for (let lat = -78; lat <= 83; lat += latStep) {
          // keep dots roughly evenly spaced by widening lng step near poles
          const lngStep = Math.max(2.4, latStep / Math.max(0.18, Math.cos(lat * DEG)));
          for (let lng = -180; lng < 180; lng += lngStep) {
            if (geoContains(land, [lng, lat])) {
              const v = latLngToVec3(lat, lng, R);
              pts.push(v.x, v.y, v.z);
            }
          }
        }
        if (!cancelled) setLandDots(new Float32Array(pts));
      } catch {
        /* network failed — globe still renders markers */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const markers = useMemo(
    () =>
      locations
        .filter((l) => Array.isArray(l.coordinates) && l.coordinates.length === 2)
        .map((l) => ({
          ...l,
          vec: latLngToVec3(l.coordinates[1], l.coordinates[0], R + 0.02),
        })),
    [locations]
  );
  const haloRefs = useRef<(THREE.Mesh | null)[]>([]);

  // Glowing connection arcs from the primary hub to every city, with pulses
  const arcs = useMemo(() => {
    if (markers.length < 2) return [];
    const hub = markers.find((m) => m.status !== 'upcoming') || markers[0];
    const hubVec = hub.vec.clone().setLength(R);
    return markers
      .filter((m) => m.id !== hub.id)
      .map((m) => {
        const pts = buildArcBetween(hubVec, m.vec.clone().setLength(R));
        const geometry = new THREE.BufferGeometry().setFromPoints(pts);
        const material = new THREE.LineBasicMaterial({ color: RED, transparent: true, opacity: 0.25 });
        return { pts, line: new THREE.Line(geometry, material), geometry, material, speed: 0.28 + Math.random() * 0.3, offset: Math.random() };
      });
  }, [markers]);
  const pulseRefs = useRef<(THREE.Mesh | null)[]>([]);

  useEffect(
    () => () => {
      arcs.forEach((a) => {
        a.geometry.dispose();
        a.material.dispose();
      });
    },
    [arcs]
  );

  // Custom round-dot shader: soft circular points, depth fade, and a slow
  // red "data sweep" that lights up continents as it rotates past.
  const dotMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(INK) },
          uHi: { value: new THREE.Color(RED) },
          uSize: { value: 0.32 },
          uPR: { value: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2) },
        },
        vertexShader: `
          uniform float uSize; uniform float uPR;
          varying float vAng; varying float vDepth;
          void main(){
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vDepth = -mv.z;
            vAng = atan(position.z, position.x);
            gl_PointSize = clamp(uSize * uPR * (50.0 / vDepth), 1.5, 7.0);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          uniform float uTime; uniform vec3 uColor; uniform vec3 uHi;
          varying float vAng; varying float vDepth;
          void main(){
            vec2 c = gl_PointCoord - 0.5;
            float d = length(c);
            if (d > 0.5) discard;
            float edge = smoothstep(0.5, 0.30, d);
            float sweep = cos(vAng - uTime * 0.5);
            float hi = smoothstep(0.93, 1.0, sweep);
            vec3 col = mix(uColor, uHi, hi);
            float depthFade = smoothstep(12.8, 7.0, vDepth);
            float alpha = edge * (0.5 + hi * 0.5) * depthFade;
            gl_FragColor = vec4(col, alpha);
          }
        `,
      }),
    []
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    dotMaterial.uniforms.uTime.value = t;
    if (group.current) {
      // keep India/UAE in focus, gentle left-right sway instead of a full spin
      group.current.rotation.y = FOCUS_RY + (reduced ? 0 : Math.sin(t * 0.12) * 0.32);
      group.current.rotation.x = -0.2 + Math.sin(t * 0.07) * 0.03;
    }
    markers.forEach((_, i) => {
      const h = haloRefs.current[i];
      if (!h) return;
      const prog = (t * 0.55 + i * 0.22) % 1;
      const s = 1 + prog * 2.8;
      h.scale.setScalar(s);
      (h.material as THREE.Material).opacity = 0.45 * (1 - prog);
    });
    arcs.forEach((arc, i) => {
      const p = pulseRefs.current[i];
      if (!p) return;
      const prog = (t * arc.speed + arc.offset) % 1;
      const v = arc.pts[Math.floor(prog * (arc.pts.length - 1))];
      p.position.set(v.x, v.y, v.z);
    });
  });

  useEffect(() => () => dotMaterial.dispose(), [dotMaterial]);

  return (
    <group ref={group}>
      {/* barely-there glass sphere body for subtle volume (transparent) */}
      <mesh>
        <sphereGeometry args={[R - 0.02, 48, 48]} />
        <meshBasicMaterial color={'#ffffff'} transparent opacity={0.05} />
      </mesh>

      {/* dotted continents */}
      {landDots && (
        <points material={dotMaterial}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={landDots.length / 3} array={landDots} itemSize={3} />
          </bufferGeometry>
        </points>
      )}

      {/* connection arcs hub -> cities */}
      {arcs.map((arc, i) => (
        <primitive key={`arc${i}`} object={arc.line} />
      ))}
      {arcs.map((_, i) => (
        <mesh key={`pulse${i}`} ref={(el) => (pulseRefs.current[i] = el)}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color={RED} emissive={RED} emissiveIntensity={3} toneMapped={false} />
        </mesh>
      ))}

      {/* live location markers */}
      {markers.map((m, i) => {
        const isCurrent = m.status !== 'upcoming';
        const color = isCurrent ? RED : '#9CA3AF';
        return (
          <group key={m.id} position={[m.vec.x, m.vec.y, m.vec.z]}>
            {/* soft static halo */}
            <mesh>
              <sphereGeometry args={[0.14, 16, 16]} />
              <meshBasicMaterial color={color} transparent opacity={0.16} />
            </mesh>
            {/* bright core */}
            <mesh>
              <sphereGeometry args={[0.055, 16, 16]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.8} toneMapped={false} />
            </mesh>
            {/* pulsing ring */}
            {isCurrent && (
              <mesh ref={(el) => (haloRefs.current[i] = el)}>
                <sphereGeometry args={[0.06, 16, 16]} />
                <meshBasicMaterial color={RED} transparent opacity={0.4} />
              </mesh>
            )}
            {/* invisible, easy-to-hit target for hover tooltip */}
            <mesh
              onPointerOver={(e) => {
                e.stopPropagation();
                onHover({ name: m.name, x: e.clientX, y: e.clientY });
                document.body.style.cursor = 'pointer';
              }}
              onPointerMove={(e) => {
                e.stopPropagation();
                onHover({ name: m.name, x: e.clientX, y: e.clientY });
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                onHover(null);
                document.body.style.cursor = '';
              }}
            >
              <sphereGeometry args={[0.22, 12, 12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

const NetworkGlobe: React.FC<{ className?: string; locations?: Loc[] }> = ({ className, locations = [] }) => {
  const [reduced, setReduced] = useState(false);
  const [hover, setHover] = useState<HoverInfo>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.('change', handler);
    return () => {
      mq.removeEventListener?.('change', handler);
      document.body.style.cursor = '';
    };
  }, []);

  return (
    <div className={className}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 8.5], fov: 46 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <fog attach="fog" args={['#ffffff', 8, 13]} />
        <ambientLight intensity={1} />
        <GlobeScene reduced={reduced} locations={locations} onHover={setHover} />
      </Canvas>

      {hover && (
        <div
          className="fixed z-50 pointer-events-none -translate-y-1/2"
          style={{ left: hover.x + 16, top: hover.y }}
        >
          <div className="flex items-center gap-2 bg-ink text-white px-3 py-1.5 rounded-lg shadow-elevated">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F20732]" />
            <span className="font-mono text-[11px] tracking-label uppercase whitespace-nowrap">{hover.name}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkGlobe;
