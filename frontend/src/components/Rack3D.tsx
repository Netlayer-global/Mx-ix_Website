import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { RackElevation, RackOccupant } from '../services/api';

interface Props {
  elevation: RackElevation;
  height?: number;
  onDeviceClick?: (device: RackOccupant) => void;
}

// 1U = 44.45mm, standard rack width = 482.6mm (19"), depth ≈ 1000mm
const U_HEIGHT = 0.04445; // meters
const RACK_WIDTH = 0.4826;
const RACK_DEPTH = 0.8;
const RAIL_WIDTH = 0.015;
const POST_SIZE = 0.04;

// Device type → color
const DEVICE_COLORS: Record<string, string> = {
  switch: '#F20732',
  router: '#2563EB',
  'route-server': '#059669',
  'patch-panel': '#6B7280',
  server: '#7C3AED',
  pdu: '#D97706',
  'console-server': '#0891B2',
  other: '#4B5563',
};

/** A single rack-mounted device (box spanning N units). */
const DeviceBox: React.FC<{
  occupant: RackOccupant;
  uHeight: number;
  onClick?: () => void;
}> = ({ occupant, uHeight, onClick }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const color = DEVICE_COLORS[occupant.deviceType || 'other'] || DEVICE_COLORS.other;
  const h = occupant.units * U_HEIGHT;
  const y = (occupant.position - 1) * U_HEIGHT + h / 2;
  const isFront = occupant.face === 'front';
  const z = isFront ? RACK_DEPTH * 0.15 : -RACK_DEPTH * 0.15;

  return (
    <group position={[0, y, z]}>
      <RoundedBox
        ref={meshRef}
        args={[RACK_WIDTH - 0.03, h - 0.002, RACK_DEPTH * 0.3]}
        radius={0.003}
        smoothness={4}
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial
          color={hovered ? '#ffffff' : color}
          metalness={0.3}
          roughness={0.6}
          emissive={hovered ? color : '#000000'}
          emissiveIntensity={hovered ? 0.4 : 0}
        />
      </RoundedBox>
      {/* Device label */}
      <Text
        position={[0, 0, RACK_DEPTH * 0.16]}
        fontSize={Math.min(h * 0.5, 0.018)}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        maxWidth={RACK_WIDTH * 0.8}
      >
        {occupant.name}
      </Text>
      {/* Port LEDs (decorative) */}
      {occupant.portCount && occupant.portCount > 0 && (
        <PortLeds count={Math.min(occupant.portCount, 24)} width={RACK_WIDTH - 0.06} y={-h * 0.3} z={RACK_DEPTH * 0.151} />
      )}
    </group>
  );
};

/** Decorative port indicator LEDs. */
const PortLeds: React.FC<{ count: number; width: number; y: number; z: number }> = ({ count, width, y, z }) => {
  const positions = useMemo(() => {
    const pts: [number, number, number][] = [];
    const spacing = width / (count + 1);
    for (let i = 0; i < count; i++) {
      pts.push([-width / 2 + spacing * (i + 1), y, z]);
    }
    return pts;
  }, [count, width, y, z]);

  return (
    <>
      {positions.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.002, 6, 6]} />
          <meshBasicMaterial color={i % 3 === 0 ? '#10B981' : '#6B7280'} />
        </mesh>
      ))}
    </>
  );
};

/** The empty rack frame (4 posts + rails). */
const RackFrame: React.FC<{ uHeight: number }> = ({ uHeight }) => {
  const totalH = uHeight * U_HEIGHT;
  const postPositions: [number, number, number][] = [
    [-RACK_WIDTH / 2, totalH / 2, RACK_DEPTH / 2],
    [RACK_WIDTH / 2, totalH / 2, RACK_DEPTH / 2],
    [-RACK_WIDTH / 2, totalH / 2, -RACK_DEPTH / 2],
    [RACK_WIDTH / 2, totalH / 2, -RACK_DEPTH / 2],
  ];

  return (
    <group>
      {/* Posts */}
      {postPositions.map((pos, i) => (
        <mesh key={`post-${i}`} position={pos}>
          <boxGeometry args={[POST_SIZE, totalH, POST_SIZE]} />
          <meshStandardMaterial color="#1F2937" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      {/* Front rails */}
      {[-RACK_WIDTH / 2 + RAIL_WIDTH, RACK_WIDTH / 2 - RAIL_WIDTH].map((x, i) => (
        <mesh key={`frail-${i}`} position={[x, totalH / 2, RACK_DEPTH / 2 - 0.01]}>
          <boxGeometry args={[RAIL_WIDTH, totalH, 0.005]} />
          <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      {/* Unit markers (every 5U on the left rail) */}
      {Array.from({ length: Math.floor(uHeight / 5) }, (_, i) => (i + 1) * 5).map((u) => (
        <Text
          key={`u-${u}`}
          position={[-RACK_WIDTH / 2 - 0.04, (u - 0.5) * U_HEIGHT, RACK_DEPTH / 2]}
          fontSize={0.012}
          color="#6B7280"
          anchorX="right"
          anchorY="middle"
        >
          {`U${u}`}
        </Text>
      ))}
      {/* Base plate */}
      <mesh position={[0, -0.01, 0]}>
        <boxGeometry args={[RACK_WIDTH + 0.08, 0.02, RACK_DEPTH + 0.08]} />
        <meshStandardMaterial color="#111827" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Top plate */}
      <mesh position={[0, totalH + 0.01, 0]}>
        <boxGeometry args={[RACK_WIDTH + 0.04, 0.015, RACK_DEPTH + 0.04]} />
        <meshStandardMaterial color="#1F2937" metalness={0.4} roughness={0.5} />
      </mesh>
    </group>
  );
};

/** Slow ambient rotation when not interacting. */
const AutoRotate: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const ref = useRef<any>(null);
  useFrame(() => {
    if (ref.current && enabled) {
      ref.current.rotation.y += 0.001;
    }
  });
  return <group ref={ref} />;
};

/**
 * Rack3D — Three.js 3D visualization of a server cabinet.
 *
 * Shows the rack frame with devices mounted at their correct U positions,
 * color-coded by device type, with port LED indicators. Orbit controls allow
 * rotating/zooming. Clicking a device fires onDeviceClick.
 */
const Rack3D: React.FC<Props> = ({ elevation, height = 500, onDeviceClick }) => {
  const totalH = elevation.cabinet.uHeight * U_HEIGHT;
  const cameraY = totalH / 2;

  return (
    <div style={{ height, width: '100%' }} className="rounded-lg overflow-hidden bg-gray-950 border border-gray-700">
      <Canvas
        camera={{ position: [0.8, cameraY, 1.2], fov: 45 }}
        gl={{ antialias: true }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[2, 3, 2]} intensity={0.8} castShadow />
        <directionalLight position={[-1, 2, -1]} intensity={0.3} />
        <pointLight position={[0, totalH + 0.5, 0.5]} intensity={0.5} color="#F20732" />

        <group position={[0, 0, 0]}>
          <RackFrame uHeight={elevation.cabinet.uHeight} />
          {elevation.occupants.map((occ) => (
            <DeviceBox
              key={occ.id}
              occupant={occ}
              uHeight={elevation.cabinet.uHeight}
              onClick={() => onDeviceClick?.(occ)}
            />
          ))}
        </group>

        <OrbitControls
          target={[0, cameraY, 0]}
          enableDamping
          dampingFactor={0.05}
          minDistance={0.5}
          maxDistance={3}
          maxPolarAngle={Math.PI * 0.85}
        />

        {/* Floor grid */}
        <gridHelper args={[2, 20, '#1F2937', '#111827']} position={[0, -0.02, 0]} />
      </Canvas>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 text-[9px] font-mono uppercase tracking-wider">
        {Object.entries(DEVICE_COLORS).slice(0, 5).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1 text-gray-400">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
            {type}
          </span>
        ))}
      </div>
    </div>
  );
};

export default Rack3D;
