'use client';

// PRISM SHELL — PREVIEW FRAME CONTROLS (SHELL W2 TASK 0, DL11/DL12/DL14)
//
// The preview frame header's control rail — the Lovable/Claude-Design
// anatomy the founder mandated: the galaxy | canvas | preview mode switch
// (the premium.ts triptych, relocated from the W1 top bar) PLUS the
// intuitive frame controls — refresh/rebuild, device-size toggle,
// fullscreen, open-in-new-tab — as machined objects.
//
// ONE R3F canvas hosts all seven cells (the DL8 rider's shared-canvas
// technique — this rail is the recorded W1→W2 GL-context consolidation:
// where W1 ran a dedicated context for the mode island alone, W2 runs mode
// switch + four frame controls in a single context). DOM buttons overlay
// the cells for interaction + a11y; ortho camera + viewport-derived cell
// positions keep objects pixel-locked to their DOM hits (W0 alignment law).

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
import { CanvasForm, GalaxyForm, PreviewForm } from './ModeSwitch3D';
import { usePrefersReducedMotion } from './use-reduced-motion';

// ── Cell registry ────────────────────────────────────────────────────────────

type ModeCellKey = PrismViewMode;
type ControlCellKey = 'refresh' | 'device' | 'fullscreen' | 'newtab';
type CellKey = ModeCellKey | ControlCellKey;

const CELLS: readonly { key: CellKey; label: string; group: 'mode' | 'control' }[] = [
  { key: 'galaxy', label: 'Galaxy', group: 'mode' },
  { key: 'canvas', label: 'Canvas', group: 'mode' },
  { key: 'preview-app', label: 'Preview', group: 'mode' },
  { key: 'refresh', label: 'Rebuild', group: 'control' },
  { key: 'device', label: 'Device', group: 'control' },
  { key: 'fullscreen', label: 'Expand', group: 'control' },
  { key: 'newtab', label: 'Open', group: 'control' },
];

// ── Control forms (custom geometric objects — black/white/red, DL14) ─────────

/** Refresh/rebuild — a machined 3/4 torus arc with a red bead at its mouth;
 *  the arc spins while the engine is rebooting. */
function RefreshForm({ m, busy, reduced }: { m: PremiumMaterials; busy: boolean; reduced: boolean }) {
  const spin = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    if (!spin.current) return;
    if (busy && !reduced) {
      spin.current.rotation.z -= dt * 3.2;
    } else if (!reduced) {
      // settle back to rest with weight
      const z = spin.current.rotation.z % (Math.PI * 2);
      spin.current.rotation.z = z + (0 - z) * (1 - Math.exp(-dt * 6));
    }
    void clock;
  });
  return (
    <group>
      <mesh material={m.gunmetal}>
        <cylinderGeometry args={[0.16, 0.16, 0.1, 24]} />
      </mesh>
      <group ref={spin}>
        <mesh material={m.chrome} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.52, 0.075, 18, 48, Math.PI * 1.5]} />
        </mesh>
        <mesh material={m.redJewel} position={[0.52, 0.12, 0]}>
          <sphereGeometry args={[0.13, 20, 20]} />
        </mesh>
      </group>
    </group>
  );
}

/** Device-size — a desktop slab and a phone slab; the ACTIVE device carries
 *  the red bead and lifts. */
function DeviceForm({ m, device }: { m: PremiumMaterials; device: 'desktop' | 'mobile' }) {
  const isMobile = device === 'mobile';
  return (
    <group rotation={[0.18, -0.35, 0]}>
      <mesh material={isMobile ? m.gunmetal : m.chrome} position={[-0.16, isMobile ? -0.06 : 0.06, 0]}>
        <boxGeometry args={[0.8, 0.54, 0.07]} />
      </mesh>
      <mesh material={isMobile ? m.chrome : m.gunmetal} position={[0.42, isMobile ? 0.1 : -0.04, 0.22]}>
        <boxGeometry args={[0.3, 0.56, 0.07]} />
      </mesh>
      <mesh
        material={m.redHot}
        position={isMobile ? [0.42, 0.48, 0.22] : [-0.16, 0.43, 0]}
      >
        <sphereGeometry args={[0.07, 16, 16]} />
      </mesh>
    </group>
  );
}

/** Fullscreen — four chrome corner brackets around a smoked-glass pane; the
 *  brackets spread on hover / in the expanded state. */
function FullscreenForm({
  m,
  active,
  hovered,
  reduced,
}: {
  m: PremiumMaterials;
  active: boolean;
  hovered: boolean;
  reduced: boolean;
}) {
  const rig = useRef<THREE.Group>(null);
  const spread = useRef(0);
  useFrame((_, dt) => {
    const target = active ? 0.2 : hovered ? 0.12 : 0;
    const ease = reduced ? 1 : 1 - Math.exp(-dt * 9);
    spread.current += (target - spread.current) * ease;
    if (rig.current) {
      rig.current.children.forEach((child, i) => {
        const sx = i % 2 === 0 ? -1 : 1;
        const sy = i < 2 ? 1 : -1;
        child.position.x = sx * (0.42 + spread.current);
        child.position.y = sy * (0.42 + spread.current);
      });
    }
  });
  const corners = [0, 1, 2, 3];
  return (
    <group rotation={[0.1, -0.25, 0]}>
      <mesh material={m.smokedGlass}>
        <boxGeometry args={[0.66, 0.66, 0.1]} />
      </mesh>
      <group ref={rig}>
        {corners.map((i) => {
          const sx = i % 2 === 0 ? -1 : 1;
          const sy = i < 2 ? 1 : -1;
          return (
            <group key={i} position={[sx * 0.42, sy * 0.42, 0.08]}>
              <mesh material={m.chrome} position={[sx * -0.12, 0, 0]}>
                <boxGeometry args={[0.3, 0.09, 0.09]} />
              </mesh>
              <mesh material={m.chrome} position={[0, sy * -0.12, 0]}>
                <boxGeometry args={[0.09, 0.3, 0.09]} />
              </mesh>
            </group>
          );
        })}
      </group>
      <mesh material={m.redJewel} position={[0, 0, 0.09]}>
        <octahedronGeometry args={[0.1, 0]} />
      </mesh>
    </group>
  );
}

/** Open-in-new-tab — a gunmetal base pane with a chrome pane breaking out
 *  above it and a red arrowhead marking the departure. */
function NewTabForm({ m }: { m: PremiumMaterials }) {
  return (
    <group rotation={[0.16, -0.3, 0]}>
      <mesh material={m.gunmetal} position={[-0.08, -0.1, 0]}>
        <boxGeometry args={[0.72, 0.56, 0.08]} />
      </mesh>
      <mesh material={m.brushed} position={[0.26, 0.22, 0.16]}>
        <boxGeometry args={[0.5, 0.4, 0.07]} />
      </mesh>
      <mesh material={m.redHot} position={[0.5, 0.46, 0.22]} rotation={[0, 0, -Math.PI / 4]}>
        <coneGeometry args={[0.11, 0.26, 4]} />
      </mesh>
    </group>
  );
}

// ── Cell rig (shared hover/press/active physics — DL6 weighted settle) ──────

function CellRig({
  index,
  count,
  cell,
  active,
  pending,
  hovered,
  pressed,
  reduced,
  children,
}: {
  index: number;
  count: number;
  cell: (typeof CELLS)[number];
  active: boolean;
  pending: boolean;
  hovered: boolean;
  pressed: boolean;
  reduced: boolean;
  children: React.ReactNode;
}) {
  const { width: vw, height: vh } = useThree((s) => s.viewport);
  const rig = useRef<THREE.Group>(null);
  const beadRef = useRef<THREE.Mesh>(null);
  const lift = useRef(0);
  const scale = useRef(1);
  const m = usePremiumMaterials();
  const cellW = vw / count;
  const baseScale = Math.min(cellW * 0.46, vh * 0.4);

  useFrame(({ clock }, dt) => {
    if (!rig.current) return;
    const t = clock.getElapsedTime();
    const liftTarget = pressed ? -0.06 : hovered ? 0.14 : active ? 0.06 : 0;
    const scaleTarget = active ? 1.14 : hovered ? 1.06 : 1;
    const ease = 1 - Math.exp(-dt * 10);
    lift.current += (liftTarget - lift.current) * ease;
    scale.current += (scaleTarget - scale.current) * ease;
    rig.current.position.y = lift.current * baseScale;
    rig.current.scale.setScalar(baseScale * scale.current);
    if (!reduced) {
      rig.current.rotation.y = -0.34 + Math.sin(t * 0.5 + index * 1.15) * 0.24;
      rig.current.rotation.x = 0.12 + Math.sin(t * 0.45 + index * 1.15) * 0.04;
    } else {
      rig.current.rotation.set(0.12, -0.34, 0);
    }
    if (beadRef.current) {
      const pulse = pending && !reduced ? 0.75 + Math.sin(t * 7) * 0.35 : 1;
      beadRef.current.scale.setScalar((active || pending ? 1 : 0.0001) * pulse);
    }
  });

  return (
    <group position={[-vw / 2 + cellW * (index + 0.5), vh * 0.06, 0]}>
      <group ref={rig}>{children}</group>
      {cell.group === 'mode' ? (
        <mesh ref={beadRef} material={m.redHot} position={[0, -vh * 0.34, 0.5]}>
          <sphereGeometry args={[baseScale * 0.075, 20, 20]} />
        </mesh>
      ) : null}
    </group>
  );
}

function RailScene(props: {
  activeMode: PrismViewMode;
  pendingMode: PrismViewMode | null;
  device: 'desktop' | 'mobile';
  isFullscreen: boolean;
  engineBusy: boolean;
  hovered: CellKey | null;
  pressed: CellKey | null;
  reduced: boolean;
}) {
  const m = usePremiumMaterials();
  const count = CELLS.length;
  return (
    <>
      {CELLS.map((cell, i) => {
        const isMode = cell.group === 'mode';
        const active = isMode
          ? props.activeMode === cell.key && !props.pendingMode
          : cell.key === 'fullscreen'
            ? props.isFullscreen
            : cell.key === 'device'
              ? props.device === 'mobile'
              : false;
        return (
          <CellRig
            key={cell.key}
            index={i}
            count={count}
            cell={cell}
            active={active}
            pending={isMode && props.pendingMode === cell.key}
            hovered={props.hovered === cell.key}
            pressed={props.pressed === cell.key}
            reduced={props.reduced}
          >
            {cell.key === 'galaxy' && <GalaxyForm m={m} />}
            {cell.key === 'canvas' && <CanvasForm m={m} />}
            {cell.key === 'preview-app' && <PreviewForm m={m} />}
            {cell.key === 'refresh' && (
              <RefreshForm m={m} busy={props.engineBusy} reduced={props.reduced} />
            )}
            {cell.key === 'device' && <DeviceForm m={m} device={props.device} />}
            {cell.key === 'fullscreen' && (
              <FullscreenForm
                m={m}
                active={props.isFullscreen}
                hovered={props.hovered === 'fullscreen'}
                reduced={props.reduced}
              />
            )}
            {cell.key === 'newtab' && <NewTabForm m={m} />}
          </CellRig>
        );
      })}
    </>
  );
}

// ── Rail island ──────────────────────────────────────────────────────────────

export default function FrameControls3D({
  activeMode,
  pendingMode,
  device,
  isFullscreen,
  engineBusy,
  onSelectMode,
  onRefresh,
  onToggleDevice,
  onToggleFullscreen,
  onOpenTab,
}: {
  activeMode: PrismViewMode;
  pendingMode: PrismViewMode | null;
  device: 'desktop' | 'mobile';
  isFullscreen: boolean;
  engineBusy: boolean;
  onSelectMode: (mode: PrismViewMode) => void;
  onRefresh: () => void;
  onToggleDevice: () => void;
  onToggleFullscreen: () => void;
  onOpenTab: () => void;
}) {
  const [hovered, setHovered] = useState<CellKey | null>(null);
  const [pressed, setPressed] = useState<CellKey | null>(null);
  const reduced = usePrefersReducedMotion();

  const activate = (key: CellKey) => {
    switch (key) {
      case 'galaxy':
      case 'canvas':
      case 'preview-app':
        onSelectMode(key);
        return;
      case 'refresh':
        onRefresh();
        return;
      case 'device':
        onToggleDevice();
        return;
      case 'fullscreen':
        onToggleFullscreen();
        return;
      case 'newtab':
        onOpenTab();
        return;
    }
  };

  const hitAria: Record<CellKey, string> = {
    galaxy: 'Switch engine to Galaxy mode',
    canvas: 'Switch engine to Canvas mode',
    'preview-app': 'Switch engine to Preview mode',
    refresh: 'Rebuild the preview (remount the engine)',
    device: device === 'mobile' ? 'Switch preview to desktop size' : 'Switch preview to phone size',
    fullscreen: isFullscreen ? 'Exit fullscreen preview' : 'Expand preview to fullscreen',
    newtab: 'Open the live prototype in a new tab',
  };

  return (
    <div className="bw2-framerail" role="group" aria-label="Preview frame controls">
      <Canvas
        dpr={[1, 2]}
        orthographic
        camera={{ position: [0, 0, 10], zoom: 34, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true }}
        className="bw2-framerail-canvas"
      >
        <StudioEnvironment />
        <StudioLights />
        <RailScene
          activeMode={activeMode}
          pendingMode={pendingMode}
          device={device}
          isFullscreen={isFullscreen}
          engineBusy={engineBusy}
          hovered={hovered}
          pressed={pressed}
          reduced={reduced}
        />
      </Canvas>
      <div className="bw2-framerail-hits">
        {CELLS.map((cell) => {
          const isMode = cell.group === 'mode';
          const modeActive = isMode && activeMode === cell.key && !pendingMode;
          return (
            <button
              key={cell.key}
              type="button"
              className="bw2-framerail-hit"
              data-group={cell.group}
              data-cell={cell.key}
              data-active={
                modeActive ||
                (cell.key === 'device' && device === 'mobile') ||
                (cell.key === 'fullscreen' && isFullscreen)
                  ? 'true'
                  : 'false'
              }
              data-pending={isMode && pendingMode === cell.key ? 'true' : 'false'}
              aria-pressed={isMode ? activeMode === cell.key : undefined}
              aria-label={hitAria[cell.key]}
              onMouseEnter={() => setHovered(cell.key)}
              onMouseLeave={() => {
                setHovered((h) => (h === cell.key ? null : h));
                setPressed((p) => (p === cell.key ? null : p));
              }}
              onPointerDown={() => setPressed(cell.key)}
              onPointerUp={() => setPressed((p) => (p === cell.key ? null : p))}
              onClick={() => activate(cell.key)}
            >
              <span className="bw2-framerail-label">{cell.label}</span>
            </button>
          );
        })}
      </div>
      {/* screen-reader mode announcements travel with the frame header */}
      <span className="bw1-visually-hidden" aria-live="polite">
        Engine mode: {CELLS.find((c) => c.key === activeMode)?.label ?? activeMode}
        {pendingMode
          ? ` — switching to ${CELLS.find((c) => c.key === pendingMode)?.label ?? pendingMode}`
          : ''}
      </span>
    </div>
  );
}
