'use client';

// PRISM SHELL — AUTH PROVIDER OBJECT ROW (SHELL W1A, DL11/DL12/DL14)
//
// The sign-in surface's primary actions as REAL rendered objects — three
// machined forms from the shared premium-materials canon on one pedestal
// row: GOOGLE (chrome faceted orb), GITHUB (smoked-glass cube over a steel
// core), EMAIL (the signal-red jewel octahedron). ONE canvas hosts all
// three (the DL8 rider's shared-canvas technique — this surface does not
// repeat W1's context-per-button pattern). DOM overlay buttons carry
// interaction + a11y; labels are DOM mono type (engine-free text).
//
// Alignment: ORTHOGRAPHIC camera + viewport-derived cell positions (the W0
// advocate MUST-FIX lesson — perspective drifts edge cells off their DOM
// labels). Motion: hover-lift / press-dip with physical ease (DL6), 3/4
// sway never full spin (W0 lesson), all off under reduced motion.
//
// An UNCONFIGURED provider (OAuth env keys absent) renders powered-down —
// gunmetal instead of its live material, disabled hit, "AWAITING KEYS"
// label — per the 7.1 discipline: never presented as available when it
// isn't.

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import {
  StudioEnvironment,
  StudioLights,
  usePremiumMaterials,
  type PremiumMaterials,
} from '../showpiece/premium-materials';
import { usePrefersReducedMotion } from '../builder/use-reduced-motion';

export type AuthProviderKey = 'google' | 'github' | 'email';

export interface AuthProviderCell {
  key: AuthProviderKey;
  label: string;
  sublabel: string;
  enabled: boolean;
  busy?: boolean;
  onActivate: () => void;
}

interface CellVisualState {
  hovered: boolean;
  pressed: boolean;
}

function ProviderForm({
  cell,
  m,
  state,
  x,
  reduced,
}: {
  cell: AuthProviderCell;
  m: PremiumMaterials;
  state: CellVisualState;
  x: number;
  reduced: boolean;
}) {
  const rig = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const lift = useRef(0);

  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime();
    const ease = 1 - Math.exp(-dt * 9);
    const liftTarget = state.pressed ? -0.1 : state.hovered && cell.enabled ? 0.16 : 0;
    lift.current += (liftTarget - lift.current) * ease;
    if (rig.current) {
      rig.current.position.x = x;
      rig.current.position.y = 0.16 + lift.current;
      rig.current.scale.setScalar(cell.enabled ? 1 : 0.88);
      if (!reduced) {
        // 3/4 sway around a fixed pose — forms never turn edge-on.
        rig.current.rotation.y = -0.3 + Math.sin(t * 0.55 + x) * 0.22;
        rig.current.rotation.x = 0.12 + Math.sin(t * 0.45 + x) * 0.04;
      } else {
        rig.current.rotation.set(0.12, -0.3, 0);
      }
    }
    if (spin.current && !reduced && cell.enabled) {
      spin.current.rotation.y = t * (cell.busy ? 2.2 : 0.6);
    }
  });

  // Powered-down providers render in gunmetal — visibly inert, still
  // present (honest availability, not a dead lookalike).
  const live = cell.enabled;

  return (
    <group ref={rig} position={[x, 0, 0]}>
      {/* shared machined pedestal */}
      <mesh material={m.gunmetal} position={[0, -0.66, 0]}>
        <cylinderGeometry args={[0.58, 0.64, 0.16, 48]} />
      </mesh>
      <mesh material={live ? m.chrome : m.gunmetalLit} position={[0, -0.56, 0]}>
        <cylinderGeometry args={[0.46, 0.46, 0.05, 48]} />
      </mesh>
      <group ref={spin} position={[0, 0.06, 0]}>
        {cell.key === 'google' && (
          <mesh material={live ? m.chrome : m.gunmetal}>
            <icosahedronGeometry args={[0.42, 0]} />
          </mesh>
        )}
        {cell.key === 'github' && (
          <>
            <mesh material={live ? m.steel : m.gunmetal} scale={0.55}>
              <octahedronGeometry args={[0.5, 0]} />
            </mesh>
            <mesh material={live ? m.smokedGlass : m.gunmetal}>
              <boxGeometry args={[0.6, 0.6, 0.6]} />
            </mesh>
          </>
        )}
        {cell.key === 'email' && (
          <mesh material={live ? m.redJewel : m.gunmetal}>
            <octahedronGeometry args={[0.44, 0]} />
          </mesh>
        )}
      </group>
    </group>
  );
}

function RowScene({
  cells,
  states,
  reduced,
}: {
  cells: readonly AuthProviderCell[];
  states: readonly CellVisualState[];
  reduced: boolean;
}) {
  const m = usePremiumMaterials();
  const { viewport } = useThree();
  // Viewport-derived thirds — cells stay pixel-locked to their DOM columns
  // at every card width (ortho camera, W0 alignment idiom).
  const third = viewport.width / cells.length;
  return (
    <>
      {cells.map((cell, i) => (
        <ProviderForm
          key={cell.key}
          cell={cell}
          m={m}
          state={states[i]}
          x={-viewport.width / 2 + third * (i + 0.5)}
          reduced={reduced}
        />
      ))}
    </>
  );
}

export default function AuthObjectRow({
  cells,
  zoom = 44,
}: {
  cells: readonly AuthProviderCell[];
  /** Ortho zoom — compact hosts (dashboard create) pass a smaller value so
   *  the object clears its DOM label inside a shorter canvas. */
  zoom?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const [states, setStates] = useState<CellVisualState[]>(() =>
    cells.map(() => ({ hovered: false, pressed: false })),
  );

  const setCell = (i: number, patch: Partial<CellVisualState>) =>
    setStates((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <div className="aw1-objectrow">
      <Canvas
        dpr={[1, 2]}
        orthographic
        camera={{ position: [0, 0, 10], zoom, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true }}
        className="aw1-objectrow-canvas"
      >
        <StudioEnvironment />
        <StudioLights />
        <RowScene cells={cells} states={states} reduced={reduced} />
      </Canvas>
      <div
        className="aw1-objectrow-hits"
        style={{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }}
      >
        {cells.map((cell, i) => (
          <button
            key={cell.key}
            type="button"
            className="aw1-objectrow-hit"
            data-provider={cell.key}
            data-enabled={cell.enabled ? 'true' : 'false'}
            disabled={!cell.enabled || cell.busy}
            aria-label={cell.label}
            onMouseEnter={() => setCell(i, { hovered: true })}
            onMouseLeave={() => setCell(i, { hovered: false, pressed: false })}
            onPointerDown={() => setCell(i, { pressed: true })}
            onPointerUp={() => setCell(i, { pressed: false })}
            onClick={cell.onActivate}
          >
            <span className="aw1-objectrow-label">{cell.label}</span>
            <span
              className="aw1-objectrow-sublabel"
              data-live={cell.enabled ? 'true' : 'false'}
            >
              {cell.sublabel}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
