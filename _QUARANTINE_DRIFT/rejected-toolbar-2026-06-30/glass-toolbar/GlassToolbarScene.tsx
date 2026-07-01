'use client';

// GlassToolbarScene — the premium glass toolbar: the proven thick GLASS PANE
// (real transmission, beveled edges, milled cutouts) with a CLEAR GLASS CUBE
// button per slot, each holding a bespoke 3D icon, all lit by the local studio
// IBL for genuine refraction/reflection. Cubes RAISE on hover. No CSS, no
// glassmorphism, no chrome-layer DOM slabs — this is the real thing in Three.js.
//
// Reuses the locked GlassPane + StudioEnv + layout from the chassis (do not fork
// the geometry language); replaces only the button + icon vocabulary.

import { Suspense, useMemo, useState } from 'react';
import { ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { StudioEnv } from '../chassis/StudioEnv';
import { GlassPane } from '../chassis/GlassPane';
import { GlassCubeButton } from './GlassCubeButton';
import { LAYOUT, type PlacedButton } from '../chassis/chassis-config';

// Editorial dark backdrop the glass refracts + the cutouts reveal (mirrors the
// chassis backdrop so the see-through and refraction read).
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
      <planeGeometry args={[42, 22]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

export function GlassToolbarScene({ onSelect }: { onSelect?: (b: PlacedButton) => void }) {
  const halfW = LAYOUT.paneW / 2;
  const [, setHovered] = useState<PlacedButton | null>(null);

  return (
    <>
      <StudioEnv />
      <Backdrop />

      {/* Premium studio lighting — warm key (soft shadow), cool fill, low raking
          light to skim the glass edges + bevels; off-center rim spots so the
          specular highlight does not blow out the center. */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[5.5, 12.5, 6]}
        intensity={2.0}
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
      <directionalLight position={[-2, 0.5, 8]} intensity={1.1} color="#fff7ec" />
      <spotLight position={[10, 5, -1]} angle={0.85} penumbra={1} intensity={48} distance={48} color="#cfe2ff" />
      <spotLight position={[-10, -3, -1]} angle={0.85} penumbra={1} intensity={30} distance={48} color="#e6c9ff" />

      <Suspense fallback={null}>
        <GlassPane />
      </Suspense>

      {LAYOUT.buttons.map((b) => (
        <GlassCubeButton
          key={`${b.sectionId}:${b.fn.id}`}
          btn={b}
          onHover={setHovered}
          onSelect={onSelect}
        />
      ))}

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
