'use client';

// GlassCubeToolButton — a clear GLASS CUBE button (real transmission) seated in
// the GlassRail, holding the tool's bespoke 3D icon sculpture proud on its front
// face.
// On hover the cube RAISES toward the viewer (the founder-agreed glass styling,
// replacing the metallic spinning coin). Same props / wiring as the old
// ToolButton3D, so layout + every button handler is unchanged — surface only.

import { useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Edges, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { TOKEN_R, FRONT_Z } from './config';
import { PrismIcon3D } from './icons/PrismIcon3D';

const CUBE = TOKEN_R * 2.12; // glass cube side
const CUBE_R = CUBE * 0.052; // small bevel: cube, not rounded tile
const REST_Z = FRONT_Z - TOKEN_R * 0.08; // seated just into the rail
const HOVER_Z = FRONT_Z + TOKEN_R * 1.02; // rises proud of the glass on hover
const REST_ROT_X = -0.08;
const REST_ROT_Y = -0.2;
const HOVER_ROT_Y = -0.31;

export interface GlassCubeToolButtonProps {
  id: string;
  y: number;
  accent: string;
  active: boolean;
  externallyHovered?: boolean;
  wired: boolean;
  onActivate: () => void;
  onHoverChange?: (hovered: boolean) => void;
}

function makeCubeGlass(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    transmission: 1,
    thickness: 0.92,
    ior: 1.52,
    roughness: 0.045,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    attenuationColor: '#edf7ff',
    attenuationDistance: 5.8,
    envMapIntensity: 2.25,
    specularIntensity: 1,
    opacity: 0.74,
    transparent: true,
    depthWrite: false,
  });
}

function makeSocketShadow(): THREE.Texture {
  if (typeof document === 'undefined') {
    const transparent = new Uint8Array([0, 0, 0, 0]);
    const t = new THREE.DataTexture(transparent, 1, 1, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 96;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(48, 48, 15, 48, 48, 48);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.09)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 96, 96);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function GlassCubeToolButton({
  id,
  y,
  accent,
  active,
  externallyHovered = false,
  wired,
  onActivate,
  onHoverChange,
}: GlassCubeToolButtonProps) {
  const grp = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const glass = useMemo(() => makeCubeGlass(), []);
  const shadow = useMemo(makeSocketShadow, []);

  useFrame((_, dtRaw) => {
    const g = grp.current;
    if (!g) return;
    const dt = Math.min(dtRaw, 0.05);
    const lit = hovered || externallyHovered || active;
    const k = 1 - Math.pow(0.0009, dt);
    g.position.z += ((lit ? HOVER_Z : REST_Z) - g.position.z) * k;
    const targetS = hovered || externallyHovered ? 1.12 : active ? 1.05 : 1.0;
    g.scale.setScalar(g.scale.x + (targetS - g.scale.x) * k);
    g.rotation.x += (REST_ROT_X - g.rotation.x) * k;
    g.rotation.y += (((hovered || externallyHovered) ? HOVER_ROT_Y : REST_ROT_Y) - g.rotation.y) * k;
  });

  const setHover = (v: boolean) => {
    setHovered(v);
    onHoverChange?.(v);
    if (typeof document !== 'undefined') document.body.style.cursor = v ? 'pointer' : '';
  };

  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, 0, FRONT_Z + 0.004]} raycast={() => null}>
        <planeGeometry args={[CUBE * 1.55, CUBE * 1.55]} />
        <meshBasicMaterial
          map={shadow}
          transparent
          opacity={hovered || externallyHovered || active ? 0.12 : 0.08}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <group
        ref={grp}
        position={[0, 0, REST_Z]}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={() => setHover(false)}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onActivate();
        }}
      >
        <RoundedBox args={[CUBE, CUBE, CUBE]} radius={CUBE_R} smoothness={6} material={glass} castShadow receiveShadow>
          <Edges
            scale={1.008}
            threshold={9}
            color={hovered || externallyHovered || active ? '#ffffff' : '#dcecff'}
          />
        </RoundedBox>

        {/* the bespoke 3D icon sculpture, proud on the glass cube's front face */}
        <group position={[0, 0, CUBE * 0.5 + 0.11]} scale={2.45}>
          <PrismIcon3D id={id} accent={accent} hovered={hovered || externallyHovered} active={active} />
        </group>

        {!wired && (
          <mesh position={[TOKEN_R * 0.6, TOKEN_R * 0.6, CUBE * 0.5 + 0.06]}>
            <sphereGeometry args={[0.04, 12, 12]} />
            <meshStandardMaterial color="#9fd0ff" emissive="#9fd0ff" emissiveIntensity={0.8} />
          </mesh>
        )}
      </group>
    </group>
  );
}
