'use client';

// ToolButton3D — a GENERATED photoreal 3D button (its own Tripo GLB,
// btn-<id>.glb, wave 1) sunk INTO the liquid-glass bar (spec TB-3). The machined
// medallion FORM is the loaded GLB (we keep its baked PBR metal); it is seated in
// a recessed socket cut into the glass. At rest the coin sits BELOW the glass
// front face ("sunk in"); on hover it rises out and SPINS.
//
// HOVER-SPIN PHYSICS (spec TB-4/5/6): hovering kicks an angular-velocity impulse
// of ~3.5 end-over-end rotations on the HORIZONTAL (X) axis; a click adds a
// bigger impulse (it visibly ACCELERATES); friction then SMOOTHLY DECELERATES it
// and it settles face-forward. The tumble reveals the GLB coin's real depth, edge
// and lighting. Every button still fires its real handler on press (TB-9).

import { Suspense, useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { TOKEN_R, FRONT_Z } from './config';
import { IconStateContext } from './icons/kit';
import { IconGlb } from './icons/IconGlb';
import { useToolGlb, btnUrl } from './glb';

export interface ToolButton3DProps {
  id: string; // tool id → selects btn-<id>.glb + ic-<id>.glb
  y: number; // world-Y center of the button slot
  accent: string;
  active: boolean;
  wired: boolean;
  onActivate: () => void;
  onHoverChange?: (hovered: boolean) => void;
}

const TWO_PI = Math.PI * 2;
const BTN_TARGET = TOKEN_R * 2.0; // longest-axis world size of the coin GLB
const FRICTION = 1.35; // angular friction (1/s) → smooth spin-down
const HOVER_TURNS = 3.5; // rotations injected on hover
const CLICK_TURNS = 2.6; // extra rotations injected on click (acceleration)
const SETTLE_VEL = 0.85; // below this the coin eases to the nearest full turn

// A FEW buttons present their icon as a photoreal ENGRAVING (intaglio cut into
// the coin face, animated on hover) instead of a raised icon (spec TB-8).
const ENGRAVED = new Set<string>(['changeArtifact', 'text', 'build']);

// The generated coin GLB + a per-instance accent-emissive driver, mounted inside
// the spinning token group. Kept separate so it can Suspend on its own.
function CoinGlb({ id, accent, lit }: { id: string; accent: string; lit: boolean }) {
  const prepared = useToolGlb(btnUrl(id), BTN_TARGET, 'auto');
  const accentColor = useRef(new THREE.Color(accent));
  useEffect(() => {
    accentColor.current.set(accent);
    for (const m of prepared.materials) {
      m.emissive = accentColor.current.clone();
      m.emissiveIntensity = 0.0;
      m.needsUpdate = true;
    }
  }, [prepared.materials, accent]);
  useFrame((_, dt) => {
    const k = 1 - Math.pow(0.0009, Math.min(dt, 0.05));
    // DE-MURK (TBITER F1): a small accent-glow floor so the coins are never pure
    // black behind the glass; brighter when lit. Still reads as metal.
    const target = lit ? 0.34 : 0.12;
    for (const m of prepared.materials) m.emissiveIntensity += (target - m.emissiveIntensity) * k;
  });
  return <primitive object={prepared.object} />;
}

export function ToolButton3D({
  id,
  y,
  accent,
  active,
  wired,
  onActivate,
  onHoverChange,
}: ToolButton3DProps) {
  const tokenRef = useRef<THREE.Group>(null);
  const ringMat = useRef<THREE.MeshStandardMaterial>(null);
  const [hovered, setHovered] = useState(false);
  const spin = useRef({ vel: 0, settling: false });

  // Seat the coin in its socket at the glass front (body set INTO the glass,
  // face proud) so the icon sits IN FRONT of the front face and reads crisply
  // (not refracted to mush); on hover it rises well out for the spin.
  const REST_Z = FRONT_Z - TOKEN_R * 0.1;
  const HOVER_Z = FRONT_Z + TOKEN_R * 0.7;

  const impulse = (turns: number) => {
    spin.current.vel += turns * TWO_PI * FRICTION;
    spin.current.settling = false;
  };

  const setHover = (v: boolean) => {
    setHovered(v);
    onHoverChange?.(v);
    if (v) impulse(HOVER_TURNS);
    if (typeof document !== 'undefined') document.body.style.cursor = v ? 'pointer' : '';
  };

  useFrame((_, dtRaw) => {
    const tk = tokenRef.current;
    if (!tk) return;
    const dt = Math.min(dtRaw, 0.05);
    const lit = hovered || active;
    const k = 1 - Math.pow(0.0009, dt);

    const targetZ = lit ? HOVER_Z : REST_Z;
    tk.position.z += (targetZ - tk.position.z) * k;
    const targetS = hovered ? 1.14 : active ? 1.06 : 1.0;
    const s = tk.scale.x + (targetS - tk.scale.x) * k;
    tk.scale.setScalar(s);

    // Dev-only deterministic capture hook: hold every coin at a fixed X rotation.
    const forced =
      typeof window !== 'undefined'
        ? (window as unknown as { __PRISM_TOOLBAR_SPIN_TEST__?: number }).__PRISM_TOOLBAR_SPIN_TEST__
        : undefined;
    if (typeof forced === 'number') {
      tk.rotation.x = forced;
      tk.position.z = HOVER_Z;
      return;
    }

    const sp = spin.current;
    if (Math.abs(sp.vel) > SETTLE_VEL) {
      tk.rotation.x += sp.vel * dt;
      sp.vel -= sp.vel * FRICTION * dt;
      sp.settling = false;
    } else if (sp.vel !== 0 || sp.settling || tk.rotation.x % TWO_PI !== 0) {
      sp.vel = 0;
      sp.settling = true;
      const target = Math.round(tk.rotation.x / TWO_PI) * TWO_PI;
      tk.rotation.x += (target - tk.rotation.x) * (1 - Math.pow(0.001, dt));
      if (Math.abs(target - tk.rotation.x) < 0.0005) {
        tk.rotation.x = target;
        sp.settling = false;
      }
    }

    if (ringMat.current) {
      const target = active ? 1.2 : hovered ? 0.8 : 0.2;
      ringMat.current.emissiveIntensity += (target - ringMat.current.emissiveIntensity) * k;
    }
  });

  const lit = hovered || active;

  return (
    <group position={[0, y, 0]}>
      {/* Socket — a recessed dark ring machined into the glass body, accent-lit. */}
      <mesh position={[0, 0, FRONT_Z - TOKEN_R * 0.3]} raycast={() => null}>
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
      {/* Recess floor — darkens the socket interior + receives the coin's shadow. */}
      <mesh position={[0, 0, FRONT_Z - TOKEN_R * 1.1]} receiveShadow raycast={() => null}>
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
          impulse(CLICK_TURNS);
          onActivate();
        }}
      >
        {/* GENERATED machined-medallion GLB (the button FORM, spec TB-3). */}
        <Suspense fallback={null}>
          <CoinGlb id={id} accent={accent} lit={lit} />
        </Suspense>

        {/* GENERATED bespoke icon GLB, on the coin face; tumbles with it. A few
            tools render the icon ENGRAVED (intaglio) instead of raised (TB-8). */}
        <group position={[0, 0, TOKEN_R * 0.55]}>
          <IconStateContext.Provider value={{ hovered, active }}>
            <Suspense fallback={null}>
              <IconGlb id={id} accent={accent} engraved={ENGRAVED.has(id)} />
            </Suspense>
          </IconStateContext.Provider>
        </group>

        {!wired && (
          <mesh position={[TOKEN_R * 0.7, TOKEN_R * 0.7, TOKEN_R * 0.6]}>
            <sphereGeometry args={[0.04, 12, 12]} />
            <meshStandardMaterial color="#9fd0ff" emissive="#9fd0ff" emissiveIntensity={0.8} />
          </mesh>
        )}
      </group>
    </group>
  );
}
