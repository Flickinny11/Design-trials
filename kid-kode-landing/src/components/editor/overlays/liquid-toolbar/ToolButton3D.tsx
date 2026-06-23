'use client';

// ToolButton3D — a photoreal 3D button sunk INTO the liquid-glass bar. A milled
// metal MEDALLION (real front face / knurled edge / back face — three material
// groups, so the edge reads as machined metal when it tumbles) seated in a
// recessed socket cut into the glass body. At rest the coin sits BELOW the glass
// front face ("sunk in"); on hover it rises out and SPINS.
//
// HOVER-SPIN PHYSICS (DESIGN LAW B.1): hovering kicks an angular-velocity impulse
// of ~3.5 end-over-end rotations on the HORIZONTAL (X) axis; a click adds a
// bigger impulse (it visibly ACCELERATES); friction then SMOOTHLY DECELERATES it
// to a stop and it settles face-forward (round to the nearest full turn) so the
// icon always ends upright. The tumble reveals the coin's real depth, edge and
// lighting. Every button still fires its real handler on press.

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
  /** Bespoke icon mesh (Wave 3). Mounted on the coin's +Z face; tumbles with it. */
  icon?: ReactNode;
}

const TWO_PI = Math.PI * 2;
const REST_Z = FRONT_Z - TOKEN_D * 1.2; // sunk inside the glass
const HOVER_Z = FRONT_Z + TOKEN_D * 0.7; // risen out front
const FRICTION = 1.35; // angular friction (1/s) → smooth spin-down
const HOVER_TURNS = 3.5; // rotations injected on hover
const CLICK_TURNS = 2.6; // extra rotations injected on click (acceleration)
const SETTLE_VEL = 0.85; // below this the coin eases to the nearest full turn

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
  // Spin state: angular velocity (rad/s) + whether we are settling to upright.
  const spin = useRef({ vel: 0, settling: false });

  const impulse = (turns: number) => {
    spin.current.vel += turns * TWO_PI * FRICTION;
    spin.current.settling = false;
  };

  const setHover = (v: boolean) => {
    setHovered(v);
    onHoverChange?.(v);
    if (v) impulse(HOVER_TURNS);
    if (typeof document !== 'undefined') {
      document.body.style.cursor = v ? 'pointer' : '';
    }
  };

  useFrame((_, dtRaw) => {
    const tk = tokenRef.current;
    if (!tk) return;
    const dt = Math.min(dtRaw, 0.05);
    const lit = hovered || active;
    const k = 1 - Math.pow(0.0009, dt);

    // Rise on hover/active (emerge from the glass), settle when idle.
    const targetZ = lit ? HOVER_Z : REST_Z;
    tk.position.z += (targetZ - tk.position.z) * k;
    const targetS = hovered ? 1.14 : active ? 1.06 : 1.0;
    const s = tk.scale.x + (targetS - tk.scale.x) * k;
    tk.scale.setScalar(s);

    // ── Spin integrator (impulse + friction) ──────────────────────────────────
    // Dev-only deterministic capture hook: when __PRISM_TOOLBAR_SPIN_TEST__ is a
    // number, every coin is held at that X rotation (e.g. Math.PI/2 = edge-on)
    // so verification can screenshot a known spin phase. Inert unless a test
    // sets it. (Editor chrome — window access is allowed here.)
    const forced =
      typeof window !== 'undefined'
        ? (window as unknown as { __PRISM_TOOLBAR_SPIN_TEST__?: number })
            .__PRISM_TOOLBAR_SPIN_TEST__
        : undefined;
    if (typeof forced === 'number') {
      tk.rotation.x = forced;
      tk.position.z = HOVER_Z;
      return;
    }
    const sp = spin.current;
    if (Math.abs(sp.vel) > SETTLE_VEL) {
      tk.rotation.x += sp.vel * dt;
      sp.vel -= sp.vel * FRICTION * dt; // exponential-ish decay
      sp.settling = false;
    } else if (sp.vel !== 0 || sp.settling || tk.rotation.x % TWO_PI !== 0) {
      // Below settle threshold: ease the residual rotation to the nearest full
      // turn so the icon ends upright (smooth finish, no snap).
      sp.vel = 0;
      sp.settling = true;
      const target = Math.round(tk.rotation.x / TWO_PI) * TWO_PI;
      tk.rotation.x += (target - tk.rotation.x) * (1 - Math.pow(0.001, dt));
      if (Math.abs(target - tk.rotation.x) < 0.0005) {
        tk.rotation.x = target;
        sp.settling = false;
      }
    }

    // Emissive glow follows the lit state.
    if (faceMat.current) {
      const target = lit ? (hovered ? 0.95 : 0.55) : 0.14;
      faceMat.current.emissiveIntensity +=
        (target - faceMat.current.emissiveIntensity) * k;
    }
    if (ringMat.current) {
      const target = active ? 1.2 : hovered ? 0.8 : 0.2;
      ringMat.current.emissiveIntensity +=
        (target - ringMat.current.emissiveIntensity) * k;
    }
  });

  return (
    <group position={[0, y, 0]}>
      {/* Socket — a recessed dark ring machined into the glass body, accent-lit,
          giving the coin a real seat. */}
      <mesh position={[0, 0, FRONT_Z - TOKEN_D * 0.5]} raycast={() => null}>
        <torusGeometry args={[TOKEN_R * 1.2, TOKEN_R * 0.17, 18, 44]} />
        <meshStandardMaterial
          ref={ringMat}
          color="#0d1220"
          emissive={accent}
          emissiveIntensity={0.2}
          metalness={0.85}
          roughness={0.3}
        />
      </mesh>
      {/* Recess floor — darkens the socket interior + receives the coin's contact
          shadow, so it reads as seated in a well. */}
      <mesh position={[0, 0, FRONT_Z - TOKEN_D * 2.0]} receiveShadow raycast={() => null}>
        <circleGeometry args={[TOKEN_R * 1.16, 40]} />
        <meshStandardMaterial color="#05070d" roughness={0.95} metalness={0.1} />
      </mesh>

      {/* The coin — the interactive button. Owns pointer events + the spin. */}
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
          impulse(CLICK_TURNS); // accelerate on click
          onActivate();
        }}
      >
        {/* Milled medallion: cylinder rotated so its flat faces point ±Z. Three
            material groups → [0]=knurled edge, [1]=front (accent), [2]=back. */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[TOKEN_R, TOKEN_R, TOKEN_D, 64, 1]} />
          {/* edge — brushed metal that catches the rim light when it tumbles */}
          <meshStandardMaterial
            attach="material-0"
            color="#aeb8c8"
            metalness={0.95}
            roughness={0.34}
          />
          {/* front face — dark PBR with an accent emissive that glows when lit */}
          <meshStandardMaterial
            attach="material-1"
            ref={faceMat}
            color="#161d2c"
            emissive={accent}
            emissiveIntensity={0.14}
            metalness={0.78}
            roughness={0.28}
          />
          {/* back face — darker, faint accent so the reverse still reads premium */}
          <meshStandardMaterial
            attach="material-2"
            color="#0c1119"
            emissive={accent}
            emissiveIntensity={0.06}
            metalness={0.85}
            roughness={0.4}
          />
        </mesh>

        {/* Bezel ring on the front face — a thin polished rim that frames the
            icon and reads as a machined chamfer. */}
        <mesh position={[0, 0, TOKEN_D * 0.5]}>
          <torusGeometry args={[TOKEN_R * 0.86, TOKEN_R * 0.07, 14, 48]} />
          <meshStandardMaterial color="#cdd6e6" metalness={1} roughness={0.22} />
        </mesh>

        {/* The icon sits on the coin's +Z face and tumbles with it. Default
            placeholder = an accent stud; Wave 3 replaces with the bespoke icon. */}
        <group position={[0, 0, TOKEN_D * 0.5 + 0.015]}>
          {icon ?? (
            <mesh>
              <sphereGeometry args={[TOKEN_R * 0.32, 24, 24]} />
              <meshStandardMaterial
                color={accent}
                emissive={accent}
                emissiveIntensity={0.65}
                metalness={0.3}
                roughness={0.3}
              />
            </mesh>
          )}
        </group>

        {!wired && (
          <mesh position={[TOKEN_R * 0.7, TOKEN_R * 0.7, TOKEN_D * 0.6]}>
            <sphereGeometry args={[0.04, 12, 12]} />
            <meshStandardMaterial color="#9fd0ff" emissive="#9fd0ff" emissiveIntensity={0.8} />
          </mesh>
        )}
      </group>
    </group>
  );
}
