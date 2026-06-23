'use client';

// ChassisScene — the R3F scene graph for the reviewable Toolbar Chassis:
// studio environment (for real refraction/reflection), editorial dark backdrop
// (so the see-through cutouts + glass refraction read), premium studio lighting,
// the glass pane, and the centered row of seated stone/metal cubes.
//
// Isolated WebGL — editor-chrome chassis; never the unified three/webgpu scene.

import { Suspense, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { StudioEnv } from './StudioEnv';
import { GlassPane } from './GlassPane';
import { StoneButton } from './StoneButton';
import { CHASSIS_BUTTONS, buttonX, PANE_W } from './chassis-config';

// Dev/verification probe: publishes the live chassis scene so an evaluate_script
// assertion can traverse it. Editor chrome — window access is allowed here (this
// is not runtime/node code, so FP-05 does not apply).
function SceneProbe() {
  const scene = useThree((s) => s.scene);
  if (typeof window !== 'undefined') {
    (window as unknown as { __PRISM_CHASSIS_SCENE__?: THREE.Scene }).__PRISM_CHASSIS_SCENE__ = scene;
  }
  return null;
}

// Editorial dark backdrop the glass refracts and the cutouts reveal. A vertical
// charcoal→near-black gradient with a faint cool center bloom — enough structure
// that the see-through and refraction read, without competing with the chassis.
function Backdrop() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 512;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#262d3a');
    grad.addColorStop(0.5, '#141926');
    grad.addColorStop(1, '#05070c');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 512);
    const bloom = g.createRadialGradient(32, 215, 8, 32, 215, 260);
    bloom.addColorStop(0, 'rgba(120,150,200,0.32)');
    bloom.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = bloom;
    g.fillRect(0, 0, 64, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <mesh position={[0, 0, -3.4]} raycast={() => null}>
      <planeGeometry args={[34, 19]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

export function ChassisScene() {
  const n = CHASSIS_BUTTONS.length;

  return (
    <>
      <SceneProbe />
      <StudioEnv />
      <Backdrop />

      {/* Premium studio lighting — warm key (casts the soft shadow), cool fill,
          and a bright rim that rakes the glass edge so the volumetric silhouette
          and refraction read. The environment map supplies the reflections. */}
      <ambientLight intensity={0.45} />
      <directionalLight
        position={[5, 7, 6]}
        intensity={2.6}
        color="#fff3e2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-PANE_W / 2 - 1}
        shadow-camera-right={PANE_W / 2 + 1}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-6, -1, 4]} intensity={0.9} color="#bcd6ff" />
      <spotLight position={[7, 3, -2]} angle={0.9} penumbra={1} intensity={60} distance={40} color="#cfe2ff" />
      <spotLight position={[-7, -2, -2]} angle={0.9} penumbra={1} intensity={34} distance={40} color="#e6c9ff" />

      <Suspense fallback={null}>
        <GlassPane />
        {CHASSIS_BUTTONS.map((btn, i) => (
          <StoneButton key={btn.id} btn={btn} x={buttonX(i, n)} />
        ))}
      </Suspense>

      <ContactShadows position={[0, -1.35, 0]} opacity={0.5} scale={14} blur={2.6} far={4} resolution={1024} color="#000308" />
    </>
  );
}
