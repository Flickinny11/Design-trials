'use client';

// ToolbarScene — the R3F scene graph for the canvas toolbar: an orthographic
// camera fit to the rail, neutral studio lighting + local IBL reflection cards,
// one physical glass pane, and a vertical stack of clear glass cube buttons.
// Isolated WebGL — never touches the unified three/webgpu scene.

import { useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Environment, Lightformer, OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import { GlassRailPane } from './GlassRailPane';
import { GlassCubeToolButton } from './GlassCubeToolButton';
import {
  barHeight,
  buttonY,
  accentFor,
  type LiquidToolGroup,
} from './config';

/** Normalized pointer over the rail host (−1..1 each axis; over eases 0→1). */
export interface RailPointer {
  x: number;
  y: number;
  over: number;
}

export interface ToolbarSceneProps {
  groups: LiquidToolGroup[];
  activeGroup: string | null;
  onToggleGroup: (id: string) => void;
  externalHoverIndex?: number | null;
  /** pressed button (via the DOM hit-target overlay) — drives press weight */
  externalPressIndex?: number | null;
  /** report which button (if any) is hovered, for the DOM tooltip layer */
  onHoverButton?: (index: number | null) => void;
  /** live pointer position over the rail — drives the living-light parallax */
  pointerRef?: React.RefObject<RailPointer>;
}

// Dev/verification probe: publishes the live toolbar scene so an evaluate_script
// assertion can traverse it and confirm every FORM is a GENERATED GLB (meshes
// tagged userData.glbSource) with NO procedural form standing in (spec §7).
// Editor chrome — window access is allowed here.
function SceneProbe() {
  const scene = useThree((s) => s.scene);
  if (typeof window !== 'undefined') {
    (window as unknown as { __PRISM_TOOLBAR_SCENE__?: THREE.Scene }).__PRISM_TOOLBAR_SCENE__ = scene;
  }
  return null;
}

// Fits the orthographic camera so the bar fills ~92% of the canvas height,
// re-reading the live canvas size each frame (cheap; handles resize/collapse).
function CameraFit({ barH }: { barH: number }) {
  const cam = useRef<THREE.OrthographicCamera>(null);
  const { size } = useThree();
  useFrame(() => {
    const c = cam.current;
    if (!c) return;
    const zoom = (size.height * 0.92) / barH;
    if (Math.abs(c.zoom - zoom) > 0.01) {
      c.zoom = zoom;
      c.updateProjectionMatrix();
    }
  });
  return (
    <OrthographicCamera
      ref={cam}
      makeDefault
      position={[0, 0, 14]}
      near={0.1}
      far={100}
    />
  );
}

// Reflection cards live in the local environment only. They give the clear glass
// long softbox streaks and dark-room contrast without painting a visible colored
// backplate behind the toolbar.
//
// MASTERPIECE M-1 living light: the environment re-renders every frame
// (frames={Infinity}), so the hero softbox streak DRIFTS on a slow Lissajous —
// specular catch-lights crawl along the glass and bezel even at idle, and the
// refraction visibly answers the moving light (design-law DL4: if light doesn't
// move, it doesn't ship). The drift is centimeters-slow: alive, never busy.
function DriftingStreak() {
  const rig = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = rig.current;
    if (!g) return;
    const t = clock.elapsedTime;
    g.position.x = 2.2 + Math.sin(t * 0.11) * 1.7;
    g.position.y = 4.5 + Math.cos(t * 0.07) * 2.6;
    g.rotation.z = Math.sin(t * 0.05) * 0.22;
  });
  return (
    <group ref={rig} position={[2.2, 4.5, 0]}>
      <Lightformer intensity={5.2} position={[0, 0, 5]} scale={[0.35, 8, 1]} color="#ffffff" />
    </group>
  );
}

function StudioEnvironment() {
  return (
    <Environment resolution={384} frames={Infinity}>
      <color attach="background" args={['#040507']} />
      <DriftingStreak />
      <Lightformer intensity={2.8} position={[-3.2, -1.5, 4]} scale={[0.45, 6, 1]} color="#d8e6ff" />
      <Lightformer intensity={1.8} position={[0, -5, 2]} scale={[4.5, 0.55, 1]} color="#fff2df" />
      <Lightformer intensity={1.1} form="ring" position={[0, 2, -4]} scale={2.1} color="#ffffff" />
    </Environment>
  );
}

// MASTERPIECE M-1 — the rail answers the hand. The pointer's position over the
// rail host tilts the whole glass assembly a few degrees (critically damped, so
// it has weight and settle, never a linear track) and nudges the key light, so
// refraction and specular streaks sweep across the pane and cubes as the hand
// moves. Pointer-off eases back to the resting pose.
const RIG_BASE = { x: 0.035, y: -0.18, z: -0.012 };
function RailRig({
  pointerRef,
  children,
}: {
  pointerRef?: React.RefObject<RailPointer>;
  children: React.ReactNode;
}) {
  const rig = useRef<THREE.Group>(null);
  const keyLight = useRef<THREE.DirectionalLight>(null);
  useFrame(({ clock }, dtRaw) => {
    const g = rig.current;
    if (!g) return;
    const dt = Math.min(dtRaw, 0.05);
    const t = clock.elapsedTime;
    const p = pointerRef?.current ?? { x: 0, y: 0, over: 0 };
    // breathing — barely-there idle drift so the glass is never a still image
    const breatheY = Math.sin(t * 0.4) * 0.006;
    const breatheX = Math.sin(t * 0.31) * 0.004;
    const targetX = RIG_BASE.x + breatheX + -p.y * 0.045 * p.over;
    const targetY = RIG_BASE.y + breatheY + p.x * 0.07 * p.over;
    const k = 1 - Math.pow(0.004, dt); // damped settle (~90% in ~0.4s)
    g.rotation.x += (targetX - g.rotation.x) * k;
    g.rotation.y += (targetY - g.rotation.y) * k;
    const l = keyLight.current;
    if (l) {
      const lx = 4 + p.x * 1.7 * p.over;
      const ly = 6 - p.y * 2.3 * p.over;
      l.position.x += (lx - l.position.x) * k;
      l.position.y += (ly - l.position.y) * k;
    }
  });
  return (
    <>
      <directionalLight
        ref={keyLight}
        position={[4, 6, 8]}
        intensity={2.15}
        color="#fff4e6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={0.1}
        shadow-camera-far={40}
        shadow-bias={-0.0006}
      />
      <group ref={rig} rotation={[RIG_BASE.x, RIG_BASE.y, RIG_BASE.z]}>{children}</group>
    </>
  );
}

export function ToolbarScene({
  groups,
  activeGroup,
  onToggleGroup,
  externalHoverIndex,
  externalPressIndex,
  onHoverButton,
  pointerRef,
}: ToolbarSceneProps) {
  const n = groups.length;
  const barH = barHeight(n);

  return (
    <>
      <SceneProbe />
      <CameraFit barH={barH} />

      {/* Studio lighting: restrained ambient, warm key (living, inside RailRig),
          cool fill, and hard rims. The pane/cubes are clear; their visibility
          comes from reflected light, bevels, cast shadows, and edge glints, not
          colored UI fill. */}
      <ambientLight intensity={0.34} />
      <directionalLight position={[-5, -2, 5]} intensity={1.15} color="#c9ddff" />
      <pointLight position={[0, 0, 4.2]} intensity={10} distance={16} color="#ffffff" />
      <spotLight
        position={[6, 2, -2.5]}
        angle={0.72}
        penumbra={1}
        intensity={36}
        distance={30}
        color="#dbeaff"
      />
      <spotLight
        position={[-6, -3, -2.5]}
        angle={0.72}
        penumbra={1}
        intensity={20}
        distance={30}
        color="#fff0dc"
      />
      <StudioEnvironment />

      {/* The real transmission GLASS PANE: flat, beveled edges, milled sockets,
          and clear cubes seated into the cutouts. The resting yaw makes the
          sidewalls visible so the rail reads as a physical object; RailRig
          tilts the assembly toward the pointer and sweeps the key light so the
          material answers the hand (living light, M-1). */}
      <RailRig pointerRef={pointerRef}>
        <GlassRailPane n={n} />

        {groups.map((g, i) => (
          <GlassCubeToolButton
            key={g.id}
            id={g.id}
            y={buttonY(i, n)}
            accent={accentFor(g.id)}
            active={activeGroup === g.id}
            externallyHovered={externalHoverIndex === i}
            externallyPressed={externalPressIndex === i}
            wired={g.wired}
            onActivate={() => onToggleGroup(g.id)}
            onHoverChange={(h) => {
              onHoverButton?.(h ? i : null);
            }}
          />
        ))}
      </RailRig>
    </>
  );
}
