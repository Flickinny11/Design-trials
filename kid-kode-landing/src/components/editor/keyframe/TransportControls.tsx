'use client';

// TransportControls — in-canvas worn-metal CUBE buttons for PLAY/PAUSE and CLEAR,
// seated in the bottom band of the glass pane (same worn-alloy finish + engraved
// abstract glyph as the chassis buttons). PLAY toggles the timeline clock (the
// engraved glyph swaps play-triangle ⇄ pause-bars); CLEAR wipes the node's
// keyframes. No DOM — click handling is R3F pointer events on the cube.

import { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { applyWornMaterial, type WornMaps } from '@/components/editor/chassis/materials';
import { CUBE_K, CUBE_K_CORNER, FRONT_Z, LAYOUT, PANE_W, SIDE_PAD } from './keyframe-config';
import { useKeyframeStore } from './use-keyframe-store';

const Z = FRONT_Z - 0.06;
const GLYPH_MAT = new THREE.MeshStandardMaterial({ color: '#0a0d12', roughness: 0.3, metalness: 0.5 });
// FINISH F-1 — the PLAY/PAUSE glyph is the SIGNAL-RED accent on the chrome
// keycap (hot emissive red when playing, signal red at rest); CLEAR keeps the
// engraved black glyph (the black/white side of the system).
const PLAY_MAT = new THREE.MeshStandardMaterial({
  color: '#ff2a38',
  roughness: 0.3,
  metalness: 0.4,
  emissive: '#7d0f18',
  emissiveIntensity: 0.6,
});
const PAUSE_MAT = new THREE.MeshStandardMaterial({
  color: '#ff5a55',
  roughness: 0.3,
  metalness: 0.4,
  emissive: '#ff2a38',
  emissiveIntensity: 0.8,
});

function PlayPauseGlyph({ playing }: { playing: boolean }) {
  const z = CUBE_K / 2 + 0.002;
  if (playing) {
    // two pause bars
    return (
      <group position={[0, 0, z]}>
        <mesh position={[-0.07, 0, 0]} material={PAUSE_MAT}>
          <boxGeometry args={[0.06, 0.24, 0.02]} />
        </mesh>
        <mesh position={[0.07, 0, 0]} material={PAUSE_MAT}>
          <boxGeometry args={[0.06, 0.24, 0.02]} />
        </mesh>
      </group>
    );
  }
  // play triangle (pointing right)
  const tri = new THREE.Shape();
  tri.moveTo(-0.1, 0.13);
  tri.lineTo(0.14, 0);
  tri.lineTo(-0.1, -0.13);
  tri.closePath();
  const geo = new THREE.ExtrudeGeometry(tri, { depth: 0.02, bevelEnabled: false });
  return <mesh position={[-0.02, 0, z]} geometry={geo} material={PLAY_MAT} />;
}

function ClearGlyph() {
  const z = CUBE_K / 2 + 0.002;
  return (
    <group position={[0, 0, z]}>
      <mesh rotation={[0, 0, Math.PI / 4]} material={GLYPH_MAT}>
        <boxGeometry args={[0.26, 0.05, 0.02]} />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 4]} material={GLYPH_MAT}>
        <boxGeometry args={[0.26, 0.05, 0.02]} />
      </mesh>
    </group>
  );
}

function Button({
  x,
  maps,
  onClick,
  children,
}: {
  x: number;
  maps: WornMaps;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const material = useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial();
    applyWornMaterial(mat, maps);
    mat.color = new THREE.Color('#aeb6c2');
    mat.envMapIntensity = 1.0;
    return mat;
  }, [maps]);
  return (
    <group position={[x, LAYOUT.bottomBandY, Z]}>
      <RoundedBox
        args={[CUBE_K, CUBE_K, CUBE_K]}
        radius={CUBE_K_CORNER}
        smoothness={5}
        material={material}
        castShadow
        onPointerDown={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          document.body.style.cursor = '';
        }}
      >
        {children}
      </RoundedBox>
    </group>
  );
}

export function TransportControls({ maps }: { maps: WornMaps }) {
  const playing = useKeyframeStore((s) => s.playing);
  const toggle = useKeyframeStore((s) => s.toggle);
  const clearAll = useKeyframeStore((s) => s.clearAll);
  const setPlayhead = useKeyframeStore((s) => s.setPlayhead);

  const x0 = -PANE_W / 2 + SIDE_PAD + 0.55;
  return (
    <>
      <Button
        x={x0}
        maps={maps}
        onClick={() => {
          if (!playing) setPlayhead(0);
          toggle();
        }}
      >
        <PlayPauseGlyph playing={playing} />
      </Button>
      <Button x={x0 + 0.95} maps={maps} onClick={clearAll}>
        <ClearGlyph />
      </Button>
    </>
  );
}
