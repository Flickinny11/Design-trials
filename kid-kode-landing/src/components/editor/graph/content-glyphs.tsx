'use client';

// PRISM NODE-EDITOR — §3.3 galaxy GLANCE-ICON (POLISH PC). A small premium
// custom 3D glyph badge that tells you, at galaxy zoom, what KIND of content a
// dormant node holds — image / text / 3d-object / integration. This is the
// reusable companion to HubPlanet.tsx's NodeContentIcons (which shows WHICH
// integration brands a node carries); this one shows the content TYPE at a
// glance. Each glyph is a billboard-facing group of cheap three primitives
// (box / sphere / torus / cone / icosahedron — NO imported icons or SVGs),
// Observatory-Brass tinted (graphite/bone/brass/ice — no purple), and
// bloom-friendly: emissive cores use basic materials with toneMapped={false}
// so the scene Bloom lifts them into little glowing badges. Opacity follows
// dimFactor. GraphScene wiring is a separate stage — this file only defines
// the component.

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DS } from '@/components/editor/design-system';

export type NodeContentType = 'image' | 'text' | '3d-object' | 'integration';

// Per-type Observatory-Brass tints. `core` is the bloom-lifted emissive accent;
// `frame` is the cooler structural tint. Brass primary for objects, bone/ice for
// content, ice for links — never purple.
const TYPE_TINT: Record<NodeContentType, { core: string; frame: string }> = {
  image: { core: DS.ice200, frame: DS.brass300 },
  text: { core: DS.textHi, frame: DS.textMid },
  '3d-object': { core: DS.brass200, frame: DS.brass400 },
  integration: { core: DS.ice400, frame: DS.ice300 },
};

// A flat unlit fill used for crisp glyph silhouettes (Bloom lifts it).
function glyphMat(color: THREE.Color, opacity: number) {
  return (
    <meshBasicMaterial color={color} toneMapped={false} transparent opacity={opacity} />
  );
}

export function NodeContentBadge({
  contentType,
  position = [0, 0, 0],
  scale = 1,
  dimFactor = 1,
}: {
  contentType: NodeContentType;
  position?: [number, number, number];
  scale?: number;
  dimFactor?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);

  const tint = TYPE_TINT[contentType];
  const core = new THREE.Color(tint.core);
  const frame = new THREE.Color(tint.frame);
  const o = Math.max(0, Math.min(1, dimFactor)); // glyph opacity scalar
  const coreO = 0.98 * o;
  const frameO = 0.9 * o;

  // Billboard: copy the camera orientation each frame so the glyph always reads
  // face-on at galaxy zoom — the same trick HubLabels uses.
  useFrame(({ camera }, dt) => {
    groupRef.current?.quaternion.copy(camera.quaternion);
    // 3d-object glyph slowly turns to imply volume.
    if (spinRef.current) spinRef.current.rotation.y += dt * 0.9;
  });

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {contentType === 'image' && (
        // Framed-picture glyph: rounded brass frame (open box ring) + a tiny
        // mountain-and-sun motif (two cones + a disc) for the classic photo icon.
        <group>
          <mesh>
            <torusGeometry args={[0.62, 0.07, 8, 4]} /> {/* squared frame */}
            {glyphMat(frame, frameO)}
          </mesh>
          <mesh position={[0.18, 0.2, 0.02]}>
            <circleGeometry args={[0.12, 16]} /> {/* sun */}
            {glyphMat(core, coreO)}
          </mesh>
          <mesh position={[-0.12, -0.16, 0.01]}>
            <coneGeometry args={[0.18, 0.3, 4]} /> {/* far peak */}
            {glyphMat(core, coreO)}
          </mesh>
          <mesh position={[0.14, -0.2, 0.02]}>
            <coneGeometry args={[0.24, 0.36, 4]} /> {/* near peak */}
            {glyphMat(frame, frameO)}
          </mesh>
        </group>
      )}

      {contentType === 'text' && (
        // Paragraph glyph: three stacked thin bars suggesting lines of text;
        // the last is short, like a paragraph's final line.
        <group>
          <mesh position={[0, 0.26, 0]}>
            <boxGeometry args={[0.92, 0.12, 0.04]} />
            {glyphMat(core, coreO)}
          </mesh>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.92, 0.12, 0.04]} />
            {glyphMat(core, coreO)}
          </mesh>
          <mesh position={[-0.21, -0.26, 0]}>
            <boxGeometry args={[0.5, 0.12, 0.04]} />
            {glyphMat(frame, frameO)}
          </mesh>
        </group>
      )}

      {contentType === '3d-object' && (
        // Volume glyph: a brass icosahedron, solid core + wireframe overlay,
        // slowly turning to imply three dimensions.
        <group ref={spinRef}>
          <mesh>
            <icosahedronGeometry args={[0.5, 0]} />
            {glyphMat(frame, frameO * 0.7)}
          </mesh>
          <mesh>
            <icosahedronGeometry args={[0.52, 0]} />
            <meshBasicMaterial color={core} toneMapped={false} wireframe transparent opacity={coreO} />
          </mesh>
        </group>
      )}

      {contentType === 'integration' && (
        // Link glyph: two interlocking torus rings (a chain-link / plug), the
        // ice-tinted accent of a connected platform.
        <group>
          <mesh position={[-0.2, 0, 0]} rotation={[0, 0.5, 0]}>
            <torusGeometry args={[0.34, 0.08, 12, 24]} />
            {glyphMat(core, coreO)}
          </mesh>
          <mesh position={[0.2, 0, 0]} rotation={[0, -0.5, 0]}>
            <torusGeometry args={[0.34, 0.08, 12, 24]} />
            {glyphMat(frame, frameO)}
          </mesh>
        </group>
      )}
    </group>
  );
}

export default NodeContentBadge;
