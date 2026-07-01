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

export interface ToolbarSceneProps {
  groups: LiquidToolGroup[];
  activeGroup: string | null;
  onToggleGroup: (id: string) => void;
  externalHoverIndex?: number | null;
  /** report which button (if any) is hovered, for the DOM tooltip layer */
  onHoverButton?: (index: number | null) => void;
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
function StudioEnvironment() {
  return (
    <Environment resolution={384} frames={Infinity}>
      <color attach="background" args={['#040507']} />
      <Lightformer intensity={5.2} position={[2.2, 4.5, 5]} scale={[0.35, 8, 1]} color="#ffffff" />
      <Lightformer intensity={2.8} position={[-3.2, -1.5, 4]} scale={[0.45, 6, 1]} color="#d8e6ff" />
      <Lightformer intensity={1.8} position={[0, -5, 2]} scale={[4.5, 0.55, 1]} color="#fff2df" />
      <Lightformer intensity={1.1} form="ring" position={[0, 2, -4]} scale={2.1} color="#ffffff" />
    </Environment>
  );
}

export function ToolbarScene({
  groups,
  activeGroup,
  onToggleGroup,
  externalHoverIndex,
  onHoverButton,
}: ToolbarSceneProps) {
  const n = groups.length;
  const barH = barHeight(n);

  return (
    <>
      <SceneProbe />
      <CameraFit barH={barH} />

      {/* Studio lighting: restrained ambient, warm key, cool fill, and hard rims.
          The pane/cubes are clear; their visibility comes from reflected light,
          bevels, cast shadows, and edge glints, not colored UI fill. */}
      <ambientLight intensity={0.34} />
      <directionalLight
        position={[4, 6, 8]}
        intensity={2.15}
        color="#fff4e6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={barH / 2 + 1}
        shadow-camera-bottom={-(barH / 2 + 1)}
        shadow-camera-near={0.1}
        shadow-camera-far={40}
        shadow-bias={-0.0006}
      />
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
          and clear cubes seated into the cutouts. The slight yaw makes the
          sidewalls visible at rest, so the rail reads as a physical object
          rather than a front-facing translucent UI strip. */}
      <group rotation={[0.035, -0.18, -0.012]}>
        <GlassRailPane n={n} />

        {groups.map((g, i) => (
          <GlassCubeToolButton
            key={g.id}
            id={g.id}
            y={buttonY(i, n)}
            accent={accentFor(g.id)}
            active={activeGroup === g.id}
            externallyHovered={externalHoverIndex === i}
            wired={g.wired}
            onActivate={() => onToggleGroup(g.id)}
            onHoverChange={(h) => {
              onHoverButton?.(h ? i : null);
            }}
          />
        ))}
      </group>
    </>
  );
}
