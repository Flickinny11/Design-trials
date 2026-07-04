'use client';

// VerticalGlassToolbarScene — the R3F scene for the in-canvas vertical glass
// toolbar. Mounts the founder-approved chassis vocabulary (StudioEnv, real
// transmission glass pane, glass cube buttons that raise on hover) in a single
// VERTICAL column, with the engraved section labels above each group. Wired to
// the same activeGroup / onToggleGroup contract as the old LiquidGlassToolbar
// so every editor action is unchanged — pure chrome swap.

import { Suspense, useMemo, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { ContactShadows, OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import { StudioEnv } from '../chassis/StudioEnv';
import { VerticalGlassPane } from './VerticalGlassPane';
import { VerticalGlassCubeButton } from './VerticalGlassCubeButton';
import { VerticalEngravedLabel } from './VerticalEngravedLabel';
import { VLAYOUT } from './vertical-layout';
import type { LiquidToolGroup } from '../overlays/liquid-toolbar/config';

// Editorial dark backdrop the glass pane refracts + the cutouts reveal.
function Backdrop() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 512;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#222a38');
    grad.addColorStop(0.5, '#121826');
    grad.addColorStop(1, '#04060b');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 512);
    const bloom = g.createRadialGradient(32, 300, 8, 32, 300, 300);
    bloom.addColorStop(0, 'rgba(120,150,200,0.18)');
    bloom.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = bloom;
    g.fillRect(0, 0, 64, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <mesh position={[0, 0, -3.6]} raycast={() => null}>
      <planeGeometry args={[VLAYOUT.paneW * 4, VLAYOUT.paneH * 1.5]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

// Fit the orthographic camera so the pane fills ~94% of the canvas height,
// re-reading the live size each frame (cheap; handles resize / collapse).
function CameraFit() {
  const cam = useRef<THREE.OrthographicCamera>(null);
  const { size } = useThree();
  useFrame(() => {
    const c = cam.current;
    if (!c) return;
    const zoom = (size.height * 0.94) / VLAYOUT.paneH;
    if (Math.abs(c.zoom - zoom) > 0.01) {
      c.zoom = zoom;
      c.updateProjectionMatrix();
    }
  });
  return (
    <OrthographicCamera ref={cam} makeDefault position={[0, 0, 14]} near={0.1} far={100} />
  );
}

export interface VerticalGlassToolbarSceneProps {
  groups: LiquidToolGroup[];
  activeGroup: string | null;
  onToggleGroup: (id: string) => void;
  /** report which button (if any) is hovered, for the DOM tooltip layer */
  onHoverButton?: (index: number | null) => void;
}

export function VerticalGlassToolbarScene({
  groups,
  activeGroup,
  onToggleGroup,
  onHoverButton,
}: VerticalGlassToolbarSceneProps) {
  // index lookup so we can report which group (by config index) is hovered
  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    groups.forEach((g, i) => m.set(g.id, i));
    return m;
  }, [groups]);
  // wired lookup (we honor the wired flag from CanvasToolbar)
  const wiredById = useMemo(() => {
    const m = new Map<string, boolean>();
    groups.forEach((g) => m.set(g.id, g.wired));
    return m;
  }, [groups]);

  return (
    <>
      <CameraFit />
      <StudioEnv />
      <Backdrop />

      {/* Premium studio lighting — warm key (soft shadow), cool fill, low raking
          rim spots so the glass edges + cube bevels catch real highlights. */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[2.5, 6.5, 6]}
        intensity={2.0}
        color="#fff3e2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-VLAYOUT.paneW - 1}
        shadow-camera-right={VLAYOUT.paneW + 1}
        shadow-camera-top={VLAYOUT.paneH / 2 + 1}
        shadow-camera-bottom={-(VLAYOUT.paneH / 2 + 1)}
        shadow-camera-near={0.5}
        shadow-camera-far={36}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-5, -1, 5]} intensity={1.0} color="#bcd6ff" />
      <directionalLight position={[-1, 0.5, 8]} intensity={1.1} color="#fff7ec" />
      <spotLight position={[6, 5, -1]} angle={0.85} penumbra={1} intensity={32} distance={48} color="#cfe2ff" />
      <spotLight position={[-6, -3, -1]} angle={0.85} penumbra={1} intensity={22} distance={48} color="#e6c9ff" />

      <Suspense fallback={null}>
        <VerticalGlassPane />
      </Suspense>

      {/* Engraved section labels recessed into the glass */}
      <Suspense fallback={null}>
        {VLAYOUT.labels.map((l) => (
          <VerticalEngravedLabel key={l.sectionId} label={l} />
        ))}
      </Suspense>

      {/* The 14 glass cube buttons, one per placed button */}
      {VLAYOUT.buttons.map((b) => (
        <VerticalGlassCubeButton
          key={b.fn.id}
          fn={b.fn}
          color={b.color}
          y={b.y}
          active={activeGroup === b.fn.id}
          wired={wiredById.get(b.fn.id) ?? true}
          onActivate={() => onToggleGroup(b.fn.id)}
          onHoverChange={(h) =>
            onHoverButton?.(h ? (indexById.get(b.fn.id) ?? null) : null)
          }
        />
      ))}

      <ContactShadows
        position={[0, -VLAYOUT.paneH / 2 - 0.2, 0]}
        opacity={0.5}
        scale={VLAYOUT.paneW + 4}
        blur={2.6}
        far={4}
        resolution={1024}
        color="#000308"
      />
    </>
  );
}
