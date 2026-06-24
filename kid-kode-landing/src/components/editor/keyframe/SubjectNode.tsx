'use client';

// SubjectNode — the bound ARTIFACT: the worn-alloy node whose properties the
// timeline animates. It reads the selected node's interpolated track values at
// the current playhead EVERY FRAME and applies them (rise / scale / spin / fade),
// so scrubbing or playing the timeline visibly animates this object. This is the
// proof that the keyframes drive a real node property.
//
// On-language: a worn jewel-tone rounded cube with an engraved face mark, the
// same finish as the chassis buttons, floating on a soft contact stage above the
// glass timeline.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import { applyWornMaterial, type WornMaps } from '@/components/editor/chassis/materials';
import { FaceGlyph } from '@/components/editor/chassis/FaceGlyph';
import { FONT_URL, LAYOUT } from './keyframe-config';
import { useKeyframeStore } from './use-keyframe-store';

const SIZE = 1.25;

export function SubjectNode({ maps }: { maps: WornMaps }) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  const material = useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial();
    applyWornMaterial(mat, maps);
    mat.transparent = true;
    return mat;
  }, [maps]);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const s = useKeyframeStore.getState();
    const v = s.currentValues();
    g.position.y = LAYOUT.subjectY + (v.posY ?? 0);
    const sc = v.scale ?? 1;
    g.scale.setScalar(sc);
    g.rotation.z = v.rotZ ?? 0;
    material.opacity = v.opacity ?? 1;
    material.depthWrite = (v.opacity ?? 1) > 0.97;
  });

  return (
    <group ref={groupRef} position={[0, LAYOUT.subjectY, 0.2]}>
      <RoundedBox
        ref={meshRef}
        args={[SIZE, SIZE, SIZE]}
        radius={0.11}
        smoothness={6}
        material={material}
        castShadow
        receiveShadow
      >
        <FaceGlyph glyph="sparkle" z={SIZE / 2 + 0.001} />
      </RoundedBox>
      {/* engraved caption beneath the artifact (in-canvas SDF, never DOM) */}
      <Text
        font={FONT_URL}
        fontSize={0.2}
        position={[0, -SIZE / 2 - 0.34, 0.2]}
        anchorX="center"
        anchorY="middle"
        color="#9fb3c8"
        letterSpacing={0.08}
        material-toneMapped={false}
        material-transparent={false}
        material-alphaTest={0.3}
      >
        SELECTED NODE
      </Text>
    </group>
  );
}
