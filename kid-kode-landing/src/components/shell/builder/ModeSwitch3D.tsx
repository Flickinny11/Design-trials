'use client';

// PRISM SHELL — MODE SWITCH / INDICATOR ISLAND (SHELL W1, DL11/DL12/DL14)
//
// The top bar's view-mode control: three machined objects — an orbit
// (galaxy), a tile grid (canvas), the prism (preview-app) — in ONE bounded
// orthographic R3F island, DOM labels + real <button>s overlaid for
// interaction and a11y (canvas is presentation; buttons are the control).
// Clicking issues a `set-mode` contract command upstream; the ACTIVE state
// renders from the engine's `mode-changed` events, so this control is also
// the round-trip mode indicator the wave prompt requires.
//
// W0 gotchas honored: orthographic camera + viewport-derived cell positions
// (pixel alignment with the DOM label grid); turntable sway around a 3/4
// pose, never a full spin; local PMREM IBL only.

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import type { PrismViewMode } from '../../../../packages/shared-interfaces/src/prism-shell';
import {
  StudioEnvironment,
  StudioLights,
  usePremiumMaterials,
  type PremiumMaterials,
} from '../showpiece/premium-materials';
import { usePrefersReducedMotion } from './use-reduced-motion';

export const MODE_ORDER: readonly { mode: PrismViewMode; label: string }[] = [
  { mode: 'galaxy', label: 'Galaxy' },
  { mode: 'canvas', label: 'Canvas' },
  { mode: 'preview-app', label: 'Preview' },
];

// ── Forms ────────────────────────────────────────────────────────────────────

function GalaxyForm({ m }: { m: PremiumMaterials }) {
  return (
    <group>
      <mesh material={m.gunmetal}>
        <sphereGeometry args={[0.34, 40, 40]} />
      </mesh>
      <mesh material={m.chrome} rotation={[1.15, 0, 0.32]}>
        <torusGeometry args={[0.62, 0.065, 20, 64]} />
      </mesh>
      <mesh material={m.redJewel} position={[0.52, 0.28, 0.12]}>
        <sphereGeometry args={[0.12, 24, 24]} />
      </mesh>
    </group>
  );
}

function CanvasForm({ m }: { m: PremiumMaterials }) {
  const tiles: { x: number; z: number; mat: keyof PremiumMaterials }[] = [
    { x: -0.3, z: -0.3, mat: 'gunmetal' },
    { x: 0.3, z: -0.3, mat: 'chrome' },
    { x: -0.3, z: 0.3, mat: 'steel' },
    { x: 0.3, z: 0.3, mat: 'gunmetalLit' },
  ];
  return (
    <group rotation={[0.62, 0.6, 0]} position={[0, 0.04, 0]}>
      {tiles.map((t, i) => (
        <mesh key={i} material={m[t.mat] as THREE.Material} position={[t.x, 0, t.z]}>
          <boxGeometry args={[0.5, 0.14, 0.5]} />
        </mesh>
      ))}
      <mesh material={m.redHot} position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.09, 24, 24]} />
      </mesh>
    </group>
  );
}

const PRISM_EDGES = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
function PreviewForm({ m }: { m: PremiumMaterials }) {
  return (
    <group position={[0, 0.02, 0]}>
      <mesh material={m.chrome} position={[0, -0.5, 0]}>
        <cylinderGeometry args={[0.48, 0.52, 0.1, 40]} />
      </mesh>
      <mesh material={m.redHot} position={[0, 0.02, 0]}>
        <tetrahedronGeometry args={[0.2, 0]} />
      </mesh>
      <mesh material={m.smokedGlass}>
        <cylinderGeometry args={[0.52, 0.52, 0.82, 3, 1]} />
      </mesh>
      {PRISM_EDGES.map((a) => (
        <mesh key={a} material={m.chrome} position={[0.52 * Math.sin(a), 0, 0.52 * Math.cos(a)]}>
          <cylinderGeometry args={[0.02, 0.02, 0.83, 10]} />
        </mesh>
      ))}
    </group>
  );
}

const FORMS = [GalaxyForm, CanvasForm, PreviewForm];

// ── Rig ──────────────────────────────────────────────────────────────────────

function ModeCell({
  index,
  active,
  pending,
  hovered,
  pressed,
  reduced,
  m,
}: {
  index: number;
  active: boolean;
  pending: boolean;
  hovered: boolean;
  pressed: boolean;
  reduced: boolean;
  m: PremiumMaterials;
}) {
  const { width: vw, height: vh } = useThree((s) => s.viewport);
  const rig = useRef<THREE.Group>(null);
  const lift = useRef(0);
  const scale = useRef(1);
  const beadRef = useRef<THREE.Mesh>(null);
  const cellW = vw / 3;
  const baseScale = Math.min(cellW * 0.5, vh * 0.42);
  const Form = FORMS[index];

  useFrame(({ clock }, dt) => {
    if (!rig.current) return;
    const t = clock.getElapsedTime();
    // Weighted settle toward targets (DL6 — nothing linear).
    const liftTarget = pressed ? -0.06 : hovered ? 0.14 : active ? 0.06 : 0;
    const scaleTarget = active ? 1.16 : hovered ? 1.06 : 1;
    const ease = 1 - Math.exp(-dt * 10);
    lift.current += (liftTarget - lift.current) * ease;
    scale.current += (scaleTarget - scale.current) * ease;
    rig.current.position.y = lift.current * baseScale;
    rig.current.scale.setScalar(baseScale * scale.current);
    // 3/4-pose turntable sway (never a full spin — W0 capture law).
    if (!reduced) {
      rig.current.rotation.y = -0.38 + Math.sin(t * 0.55 + index * 1.1) * 0.3;
      rig.current.rotation.x = 0.13 + Math.sin(t * 0.5 + index * 1.1) * 0.05;
    } else {
      rig.current.rotation.set(0.13, -0.38, 0);
    }
    // Active/pending bead — pending pulses while awaiting mode-changed.
    if (beadRef.current) {
      const pulse = pending && !reduced ? 0.75 + Math.sin(t * 7) * 0.35 : 1;
      beadRef.current.scale.setScalar((active || pending ? 1 : 0.0001) * pulse);
    }
  });

  return (
    <group position={[(index - 1) * cellW, vh * 0.06, 0]}>
      <group ref={rig}>
        <Form m={m} />
      </group>
      {/* active-mode pedestal bead (geometric state cue — no material mutation) */}
      <mesh ref={beadRef} material={m.redHot} position={[0, -vh * 0.34, 0.5]}>
        <sphereGeometry args={[baseScale * 0.075, 20, 20]} />
      </mesh>
    </group>
  );
}

function ModeField(props: {
  activeMode: PrismViewMode;
  pendingMode: PrismViewMode | null;
  hovered: PrismViewMode | null;
  pressed: PrismViewMode | null;
  reduced: boolean;
}) {
  const m = usePremiumMaterials();
  return (
    <>
      {MODE_ORDER.map(({ mode }, i) => (
        <ModeCell
          key={mode}
          index={i}
          active={props.activeMode === mode && !props.pendingMode}
          pending={props.pendingMode === mode}
          hovered={props.hovered === mode}
          pressed={props.pressed === mode}
          reduced={props.reduced}
          m={m}
        />
      ))}
    </>
  );
}

// ── Island ───────────────────────────────────────────────────────────────────

export default function ModeSwitch3D({
  activeMode,
  pendingMode,
  onSelectMode,
}: {
  activeMode: PrismViewMode;
  pendingMode: PrismViewMode | null;
  onSelectMode: (mode: PrismViewMode) => void;
}) {
  const [hovered, setHovered] = useState<PrismViewMode | null>(null);
  const [pressed, setPressed] = useState<PrismViewMode | null>(null);
  const reduced = usePrefersReducedMotion();

  return (
    <div className="bw1-modeswitch" role="group" aria-label="Engine view mode">
      <Canvas
        dpr={[1, 2]}
        orthographic
        camera={{ position: [0, 0, 10], zoom: 40, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true }}
        className="bw1-modeswitch-canvas"
      >
        <StudioEnvironment />
        <StudioLights />
        <ModeField
          activeMode={activeMode}
          pendingMode={pendingMode}
          hovered={hovered}
          pressed={pressed}
          reduced={reduced}
        />
      </Canvas>
      <div className="bw1-modeswitch-hits">
        {MODE_ORDER.map(({ mode, label }) => (
          <button
            key={mode}
            type="button"
            className="bw1-modeswitch-hit"
            data-active={activeMode === mode && !pendingMode ? 'true' : 'false'}
            data-pending={pendingMode === mode ? 'true' : 'false'}
            aria-pressed={activeMode === mode}
            aria-label={`Switch engine to ${label} mode`}
            onMouseEnter={() => setHovered(mode)}
            onMouseLeave={() => {
              setHovered((h) => (h === mode ? null : h));
              setPressed((p) => (p === mode ? null : p));
            }}
            onPointerDown={() => setPressed(mode)}
            onPointerUp={() => setPressed((p) => (p === mode ? null : p))}
            onClick={() => onSelectMode(mode)}
          >
            <span className="bw1-modeswitch-label">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
