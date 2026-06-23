'use client';

// ToolbarScene — the R3F scene graph for the liquid-glass toolbar: an
// orthographic camera fit to the canvas, premium studio lighting + an
// Environment (so the transmission glass has crisp reflections), an iridescent
// backdrop the glass refracts, the LiquidGlassBar, and the vertical column of
// ToolButton3D. Isolated WebGL — never touches the unified three/webgpu scene.

import { useRef, useState, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Environment, Lightformer, OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import { LiquidGlassBar } from './LiquidGlassBar';
import { ToolButton3D } from './ToolButton3D';
import { iconFor } from './icons';
import {
  barHeight,
  buttonY,
  accentFor,
  BAR_W,
  BACKDROP_TOP,
  BACKDROP_BOT,
  type LiquidToolGroup,
} from './config';

export interface ToolbarSceneProps {
  groups: LiquidToolGroup[];
  activeGroup: string | null;
  onToggleGroup: (id: string) => void;
  /** report which button (if any) is hovered, for the DOM tooltip layer */
  onHoverButton?: (index: number | null) => void;
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

// Iridescent backdrop plane the glass refracts — a vertical gradient in cool
// soap-film tones with a soft accent bloom toward the center.
function Backdrop({ height }: { height: number }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 512;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, BACKDROP_TOP);
    grad.addColorStop(1, BACKDROP_BOT);
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 512);
    // Iridescent soap-film bands the glass refracts — vivid, so the body glows
    // with colored light rather than reading as a black strip.
    const bands: [number, string][] = [
      [0.12, 'rgba(90,184,255,0.55)'],
      [0.3, 'rgba(169,139,255,0.5)'],
      [0.5, 'rgba(92,224,176,0.5)'],
      [0.7, 'rgba(255,182,92,0.46)'],
      [0.88, 'rgba(255,126,182,0.5)'],
    ];
    for (const [yy, col] of bands) {
      const rad = g.createRadialGradient(64, 512 * yy, 6, 64, 512 * yy, 150);
      rad.addColorStop(0, col);
      rad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rad;
      g.fillRect(0, 0, 128, 512);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <mesh position={[0, 0, -2.0]} raycast={() => null}>
      <planeGeometry args={[BAR_W * 2.4, height * 1.08]} />
      <meshBasicMaterial map={tex} transparent opacity={0.95} toneMapped={false} />
    </mesh>
  );
}

export function ToolbarScene({
  groups,
  activeGroup,
  onToggleGroup,
  onHoverButton,
}: ToolbarSceneProps) {
  const n = groups.length;
  const barH = barHeight(n);
  const [energy, setEnergy] = useState(0);

  return (
    <>
      <CameraFit barH={barH} />

      {/* Studio lighting — a warm key, cool fill, and a bright rim that rakes
          the glass edge so the silhouette and refraction read crisply. */}
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[4, 6, 8]}
        intensity={2.4}
        color="#fff3e0"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={barH / 2 + 1}
        shadow-camera-bottom={-(barH / 2 + 1)}
        shadow-camera-near={0.1}
        shadow-camera-far={40}
        shadow-bias={-0.0006}
      />
      <directionalLight position={[-5, -2, 4]} intensity={1.1} color="#9fc0ff" />
      <pointLight position={[0, 0, 6]} intensity={22} distance={26} color="#cfe4ff" />
      {/* raking rim — grazes the glass edge from behind-right so the volumetric
          silhouette and refraction read as a real 3D object */}
      <spotLight
        position={[6, 2, -3]}
        angle={0.9}
        penumbra={1}
        intensity={42}
        distance={30}
        color="#bcd8ff"
      />
      <spotLight
        position={[-6, -3, -2]}
        angle={0.9}
        penumbra={1}
        intensity={26}
        distance={30}
        color="#d8b6ff"
      />

      {/* Environment for transmission reflections — custom Lightformers give the
          glass premium, controllable highlights (the Glb3DPreview idiom). */}
      <Environment resolution={256} frames={Infinity}>
        <color attach="background" args={['#05070d']} />
        <Lightformer intensity={3} position={[2, 3, 4]} scale={[3, 6, 1]} color="#ffffff" />
        <Lightformer intensity={2} position={[-3, -1, 3]} scale={[2, 5, 1]} color="#88b6ff" />
        <Lightformer intensity={1.4} position={[0, -4, 2]} scale={[5, 2, 1]} color="#c79bff" />
        <Lightformer intensity={1.2} form="ring" position={[0, 2, -3]} scale={2} color="#ffd9a0" />
      </Environment>

      <Backdrop height={barH} />

      <LiquidGlassBar height={barH} energy={energy} />

      {groups.map((g, i) => (
        <ToolButton3D
          key={g.id}
          y={buttonY(i, n)}
          accent={accentFor(g.id)}
          active={activeGroup === g.id}
          wired={g.wired}
          onActivate={() => onToggleGroup(g.id)}
          onHoverChange={(h) => {
            setEnergy(h ? 1 : 0);
            onHoverButton?.(h ? i : null);
          }}
          icon={iconFor(g.id, accentFor(g.id))}
        />
      ))}
    </>
  );
}
