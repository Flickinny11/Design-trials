'use client';

// Bespoke 3D ICON KIT — shared building blocks every toolbar icon is authored
// from, so the 14 icons are coherent: same scale, same idle-animation grammar,
// same premium PBR materials, and the same photoreal ENGRAVING wrapper.
//
// DESIGN LAW B.1 defect gate: every icon is a bespoke 3D object — extruded
// shapes / composed primitives with bevels, gradients, shadows and idle motion.
// NO emoji, NO Lucide/line-drawings, NO lightning/box/generic glyphs.

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TOKEN_R } from '../config';

// Icons live within ~this radius on the coin face.
export const ICON_S = TOKEN_R * 1.0;

// Hover/active state for the icon under the cursor, provided by ToolButton3D so
// icons (esp. engravings) can react to hover without prop-drilling.
export interface IconState {
  hovered: boolean;
  active: boolean;
}
export const IconStateContext = createContext<IconState>({ hovered: false, active: false });
export const useIconState = () => useContext(IconStateContext);

const hashPhase = (seed: number) => ((Math.sin(seed * 99.13) * 43758.5) % 1) * 6.283;

/** Idle-animated root. Scales the icon onto the coin face and applies a gentle,
 *  smooth idle motion so each icon feels alive without being noisy. */
export function IconRoot({
  children,
  motion = 'sway',
  amp = 1,
  seed = 0,
}: {
  children: ReactNode;
  motion?: 'sway' | 'bob' | 'pulse' | 'spin' | 'none';
  amp?: number;
  seed?: number;
}) {
  const g = useRef<THREE.Group>(null);
  const phase = useMemo(() => hashPhase(seed + 1), [seed]);
  const base = useRef({ y: 0 });
  useFrame((s) => {
    const o = g.current;
    if (!o) return;
    const t = s.clock.elapsedTime + phase;
    if (motion === 'sway') {
      o.rotation.y = Math.sin(t * 0.7) * 0.45 * amp;
      o.rotation.x = Math.sin(t * 0.45 + 0.6) * 0.12 * amp;
    } else if (motion === 'bob') {
      o.position.y = base.current.y + Math.sin(t * 1.4) * 0.04 * amp;
      o.rotation.z = Math.sin(t * 0.9) * 0.07 * amp;
    } else if (motion === 'pulse') {
      o.scale.setScalar(ICON_S * (1 + Math.sin(t * 2.2) * 0.05 * amp));
    } else if (motion === 'spin') {
      o.rotation.y = t * 0.8 * amp;
    }
  });
  return (
    <group ref={g} scale={ICON_S}>
      {children}
    </group>
  );
}

/** Premium emissive-PBR material for raised icon bodies. A self-contained
 *  component (not a returned element) so it can be reused per-mesh. */
export function IconMat({
  color,
  emi = 0.55,
  metalness = 0.55,
  roughness = 0.26,
}: {
  color: string;
  emi?: number;
  metalness?: number;
  roughness?: number;
}) {
  return (
    <meshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={emi}
      metalness={metalness}
      roughness={roughness}
      toneMapped={false}
    />
  );
}

/** Build an ExtrudeGeometry from a 2D Shape builder. Centered + beveled so the
 *  icon has real edges that catch light. */
export function useExtruded(
  build: (s: THREE.Shape) => void,
  depth = 0.22,
  bevel = 0.05,
): THREE.ExtrudeGeometry {
  return useMemo(() => {
    const shape = new THREE.Shape();
    build(shape);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 3,
      steps: 1,
      curveSegments: 24,
    });
    geo.center();
    geo.computeVertexNormals();
    return geo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depth, bevel]);
}

/** Lighten/darken a hex toward white/black by `amt` (-1..1). */
export function shade(hex: string, amt: number): string {
  const c = new THREE.Color(hex);
  if (amt >= 0) c.lerp(new THREE.Color('#ffffff'), amt);
  else c.lerp(new THREE.Color('#000000'), -amt);
  return `#${c.getHexString()}`;
}

// ── Photoreal ENGRAVING ───────────────────────────────────────────────────────
// Renders a symbol as if CUT INTO the coin face: a shallow round recess (darker,
// matte) with the symbol geometry sunk just below the face, its bevel catching
// a rim highlight on top and dropping shadow below — so it reads intaglio. On
// hover the engraved symbol fills with accent light and the whole groove warms;
// the symbol also turns slightly, animating the engraving (DESIGN LAW B.1).
export function EngravedPlate({
  geometry,
  accent,
  recessR = 0.62,
}: {
  geometry: THREE.BufferGeometry;
  accent: string;
  recessR?: number;
}) {
  const { hovered, active } = useIconState();
  const symRef = useRef<THREE.Mesh>(null);
  const symMat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((s, dt) => {
    const lit = hovered || active;
    const k = 1 - Math.pow(0.0015, Math.min(dt, 0.05));
    if (symMat.current) {
      const target = lit ? 0.95 : 0.0; // engraving glows when hovered
      symMat.current.emissiveIntensity += (target - symMat.current.emissiveIntensity) * k;
    }
    if (symRef.current) {
      const t = s.clock.elapsedTime;
      // the engraved symbol animates: a small tilt that sweeps while hovered
      const target = lit ? Math.sin(t * 2.4) * 0.35 : 0;
      symRef.current.rotation.z += (target - symRef.current.rotation.z) * k;
    }
  });
  return (
    <group>
      {/* shallow round recess cut into the face (disc faces +Z) */}
      <mesh position={[0, 0, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[recessR, recessR * 0.96, 0.06, 40]} />
        <meshStandardMaterial color={shade(accent, -0.78)} metalness={0.7} roughness={0.55} />
      </mesh>
      {/* the engraved symbol, sunk below the face plane */}
      <mesh ref={symRef} geometry={geometry} position={[0, 0, -0.06]} scale={0.74}>
        <meshStandardMaterial
          ref={symMat}
          color={shade(accent, -0.5)}
          emissive={accent}
          emissiveIntensity={0}
          metalness={0.85}
          roughness={0.32}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
