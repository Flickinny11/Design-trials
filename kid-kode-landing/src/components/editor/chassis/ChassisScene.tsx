'use client';

// ChassisScene — the R3F scene graph for the reviewable Toolbar Chassis with the
// founder's refinements: a thick glass pane milled into GRID SECTIONS, each
// section's worn-alloy cubes in one curated jewel-tone, the section name ENGRAVED
// into the glass above it, hover-spin + see-through per cube, and in-canvas hover
// tooltips. Studio environment (real refraction/reflection), editorial dark
// backdrop, premium studio lighting.
//
// Isolated WebGL — editor-chrome chassis; never the unified three/webgpu scene.

import { Suspense, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { StudioEnv } from './StudioEnv';
import { GlassPane } from './GlassPane';
import { CubeButton } from './CubeButton';
import { EngravedLabel } from './EngravedLabel';
import { Tooltip } from './Tooltip';
import { useWornMaps } from './materials';
import { LAYOUT, type PlacedButton } from './chassis-config';

// Loads the worn-alloy PBR sets, then renders the seated cubes, engraved section
// labels, and the hover tooltip. Lives under its own Suspense so the rest of the
// scene paints while the textures stream in.
function ChassisButtons() {
  const wornMaps = useWornMaps();
  const [hovered, setHovered] = useState<PlacedButton | null>(null);
  // Verification hook: force a uniform spin progress across all cubes for
  // deterministic see-through capture. Editor chrome — window access is fine.
  const [forceSpin, setForceSpin] = useState<number | null>(null);
  if (typeof window !== 'undefined') {
    (window as unknown as { __PRISM_CHASSIS_SPIN__?: (p: number | null) => void }).__PRISM_CHASSIS_SPIN__ =
      (p) => setForceSpin(p);
    (window as unknown as { __PRISM_CHASSIS_HOVER__?: (id: string | null) => void }).__PRISM_CHASSIS_HOVER__ =
      (id) => setHovered(id ? LAYOUT.buttons.find((b) => b.fn.id === id) ?? null : null);
  }

  return (
    <>
      {LAYOUT.buttons.map((btn) => (
        <CubeButton
          key={`${btn.sectionId}:${btn.fn.id}`}
          btn={btn}
          maps={wornMaps[btn.textureKey]}
          onHover={setHovered}
          forceSpin={forceSpin}
        />
      ))}
      {LAYOUT.labels.map((label) => (
        <EngravedLabel key={label.sectionId} label={label} />
      ))}
      <Tooltip btn={hovered} />
    </>
  );
}

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
    const bloom = g.createRadialGradient(32, 230, 8, 32, 230, 300);
    bloom.addColorStop(0, 'rgba(120,150,200,0.30)');
    bloom.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = bloom;
    g.fillRect(0, 0, 64, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <mesh position={[0, 0, -3.6]} raycast={() => null}>
      <planeGeometry args={[42, 22]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

export function ChassisScene() {
  const halfW = LAYOUT.paneW / 2;
  return (
    <>
      <SceneProbe />
      <StudioEnv />
      <Backdrop />

      {/* Premium studio lighting — warm key (casts the soft shadow), cool fill,
          and bright raking rims so the worn brushed grain + micro-scratches catch
          light and the glass edge reads. The environment map supplies reflections. */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[6, 8, 7]}
        intensity={2.7}
        color="#fff3e2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-halfW - 1}
        shadow-camera-right={halfW + 1}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-camera-near={0.5}
        shadow-camera-far={36}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-7, -1, 5]} intensity={1.0} color="#bcd6ff" />
      {/* low raking light to rake the brushed grain across the cube faces */}
      <directionalLight position={[0, 0.5, 8]} intensity={0.8} color="#fff7ec" />
      <spotLight position={[9, 4, -2]} angle={0.9} penumbra={1} intensity={70} distance={48} color="#cfe2ff" />
      <spotLight position={[-9, -2, -2]} angle={0.9} penumbra={1} intensity={40} distance={48} color="#e6c9ff" />

      <Suspense fallback={null}>
        <GlassPane />
      </Suspense>
      <Suspense fallback={null}>
        <ChassisButtons />
      </Suspense>

      <ContactShadows
        position={[0, -LAYOUT.paneH / 2 - 0.2, 0]}
        opacity={0.5}
        scale={LAYOUT.paneW + 4}
        blur={2.6}
        far={4}
        resolution={1024}
        color="#000308"
      />
    </>
  );
}
