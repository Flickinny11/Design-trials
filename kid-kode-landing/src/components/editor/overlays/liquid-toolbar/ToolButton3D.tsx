'use client';

// ToolButton3D — a photoreal 3D button sunk INTO the liquid-glass bar. A recessed
// socket (machined into the glass body) holds a raised token disc carrying the
// tool's bespoke 3D icon. The token sits below the glass front face at rest
// ("sunk in"), and rises + lights in its accent on hover.
//
// WAVE 1: real sunk 3D form + wiring (every button calls its real handler) +
//         hover lift/glow + active (flyout-open) state.
// WAVE 2 adds the hover-spin physics; WAVE 3 swaps the placeholder face for the
// bespoke animated 3D icon. The icon is a render slot so later waves drop in.

import { useRef, useState, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { TOKEN_R, TOKEN_D, FRONT_Z } from './config';

export interface ToolButton3DProps {
  y: number; // world-Y center of the button slot
  accent: string;
  active: boolean;
  wired: boolean;
  onActivate: () => void;
  onHoverChange?: (hovered: boolean) => void;
  /** Bespoke icon mesh (Wave 3). Receives nothing; reads its own clock. */
  icon?: ReactNode;
}

// Rest z: token mostly inside the glass (sunk). Hover z: risen toward the viewer.
const REST_Z = FRONT_Z - TOKEN_D * 1.15;
const HOVER_Z = FRONT_Z + TOKEN_D * 0.55;

export function ToolButton3D({
  y,
  accent,
  active,
  wired,
  onActivate,
  onHoverChange,
  icon,
}: ToolButton3DProps) {
  const tokenRef = useRef<THREE.Group>(null);
  const faceMat = useRef<THREE.MeshStandardMaterial>(null);
  const ringMat = useRef<THREE.MeshStandardMaterial>(null);
  const [hovered, setHovered] = useState(false);
  const accentColor = useRef(new THREE.Color(accent));
  accentColor.current.set(accent);

  const setHover = (v: boolean) => {
    setHovered(v);
    onHoverChange?.(v);
    if (typeof document !== 'undefined') {
      document.body.style.cursor = v ? 'pointer' : '';
    }
  };

  useFrame((_, dt) => {
    const tk = tokenRef.current;
    if (!tk) return;
    const lit = hovered || active;
    const k = 1 - Math.pow(0.0009, dt);
    // Rise on hover/active (emerge from the glass), settle when idle.
    const targetZ = lit ? HOVER_Z : REST_Z;
    tk.position.z += (targetZ - tk.position.z) * k;
    const targetS = hovered ? 1.12 : active ? 1.05 : 1.0;
    const s = tk.scale.x + (targetS - tk.scale.x) * k;
    tk.scale.setScalar(s);

    // Emissive glow follows the lit state.
    if (faceMat.current) {
      const target = lit ? (hovered ? 0.9 : 0.5) : 0.12;
      faceMat.current.emissiveIntensity +=
        (target - faceMat.current.emissiveIntensity) * k;
    }
    if (ringMat.current) {
      const target = active ? 1.1 : hovered ? 0.7 : 0.18;
      ringMat.current.emissiveIntensity +=
        (target - ringMat.current.emissiveIntensity) * k;
    }
  });

  return (
    <group position={[0, y, 0]}>
      {/* Socket — a recessed dark ring machined into the glass body, giving the
          token a real "sunk in" seat with an accent-lit inner bezel. */}
      <mesh position={[0, 0, FRONT_Z - TOKEN_D * 0.6]} raycast={() => null}>
        <torusGeometry args={[TOKEN_R * 1.16, TOKEN_R * 0.18, 16, 40]} />
        <meshStandardMaterial
          ref={ringMat}
          color="#10151f"
          emissive={accent}
          emissiveIntensity={0.18}
          metalness={0.7}
          roughness={0.35}
        />
      </mesh>
      {/* Recess floor — darkens the socket interior so the token reads as seated
          in a well, not floating. */}
      <mesh position={[0, 0, FRONT_Z - TOKEN_D * 1.8]} raycast={() => null}>
        <circleGeometry args={[TOKEN_R * 1.1, 36]} />
        <meshStandardMaterial color="#070a11" roughness={0.9} metalness={0.2} />
      </mesh>

      {/* The token — the interactive button. This group owns pointer events and
          (Wave 2) the spin. */}
      <group
        ref={tokenRef}
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
        {/* Token body — a beveled disc with a premium PBR face. */}
        <mesh castShadow>
          <cylinderGeometry args={[TOKEN_R, TOKEN_R * 0.94, TOKEN_D, 48]} />
          <meshStandardMaterial
            ref={faceMat}
            color="#1a2233"
            emissive={accent}
            emissiveIntensity={0.12}
            metalness={0.85}
            roughness={0.26}
          />
        </mesh>
        {/* The icon sits on the token's +Z face. Default placeholder = a small
            accent stud; Wave 3 replaces with the bespoke 3D icon. */}
        <group position={[0, 0, TOKEN_D * 0.5 + 0.01]} rotation={[Math.PI / 2, 0, 0]}>
          {icon ?? (
            <mesh>
              <sphereGeometry args={[TOKEN_R * 0.34, 24, 24]} />
              <meshStandardMaterial
                color={accent}
                emissive={accent}
                emissiveIntensity={0.6}
                metalness={0.3}
                roughness={0.3}
              />
            </mesh>
          )}
        </group>
        {!wired && (
          // "coming with subsystem" marker — a tiny ice dot (parity with the
          // DOM dock's unwired indicator). All groups are wired today, so this
          // is dormant.
          <mesh position={[TOKEN_R * 0.7, TOKEN_R * 0.7, TOKEN_D * 0.6]}>
            <sphereGeometry args={[0.04, 12, 12]} />
            <meshStandardMaterial color="#9fd0ff" emissive="#9fd0ff" emissiveIntensity={0.8} />
          </mesh>
        )}
      </group>
    </group>
  );
}
