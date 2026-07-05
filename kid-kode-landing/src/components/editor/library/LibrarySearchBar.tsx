'use client';

// PRISM PRIMITIVE SYSTEM — P-6 — the in-canvas SEARCH bar (spec §7.1, NO DOM).
//
// A milled glass bar that, when CLICKED, focuses and captures real keystrokes (the
// MaterialPromptPanel idiom — window keydown, zero DOM input) to build a live query
// string rendered in-engine via MSDF. The query filters the visible palette tiles
// across every section. A pulsing caret marks focus; clicking again blurs. The
// keydown listener itself lives in the scene (so it survives tile re-mounts).

import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { buildPaneGeometry } from '@/components/editor/primitive/primitive-geometry';
import { CompositeText } from '@/components/editor/composite/CompositeText';
import { useLibraryStore } from './use-library-store';

const BAR_W = 4.2;
const BAR_H = 0.62;

const BAR_MAT = new THREE.MeshPhysicalMaterial({
  transmission: 1, thickness: 0.5, ior: 1.5, roughness: 0.07, metalness: 0,
  clearcoat: 1, clearcoatRoughness: 0.2, attenuationColor: new THREE.Color('#cfe0ee'),
  attenuationDistance: 1.3, envMapIntensity: 1.0, specularIntensity: 0.7, transparent: true,
});
const CARET_MAT = new THREE.MeshBasicMaterial({ color: '#9fe9ff', toneMapped: false, transparent: true });
const FOCUS_MAT = new THREE.LineBasicMaterial({ color: '#9fd8ff', toneMapped: false, transparent: true, opacity: 0.9 });

export function LibrarySearchBar({ position }: { position: [number, number, number] }) {
  const query = useLibraryStore((s) => s.query);
  const focused = useLibraryStore((s) => s.searchFocused);
  const focusSearch = useLibraryStore((s) => s.focusSearch);
  const setQuery = useLibraryStore((s) => s.setQuery);
  const caretRef = useRef<THREE.Mesh>(null);

  const geo = useMemo(() => buildPaneGeometry({ width: BAR_W, height: BAR_H, depth: 0.16, cornerRadius: 0.16, bevel: 0.03, radius: 0, segments: 16, cutouts: [] }), []);
  const focusGeo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(BAR_W + 0.06, BAR_H + 0.06, 0.18)), []);

  useFrame((state) => {
    if (caretRef.current) caretRef.current.visible = focused && Math.sin(state.clock.elapsedTime * 4) > 0;
  });

  const hasText = query.length > 0;
  return (
    <group position={position}>
      <mesh
        geometry={geo}
        material={BAR_MAT}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); focusSearch(!focused); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'text'; }}
        onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = ''; }}
      />
      {focused && <lineSegments geometry={focusGeo} material={FOCUS_MAT} renderOrder={6} />}
      <CompositeText position={[-BAR_W / 2 + 0.28, 0, 0.12]} fontSize={0.2} letterSpacing={0.03} anchorX="left" variant={hasText ? 'bright' : 'engraved'}>
        {hasText ? query : 'SEARCH THE LIBRARY'}
      </CompositeText>
      <mesh ref={caretRef} material={CARET_MAT} position={[-BAR_W / 2 + 0.32 + Math.min(query.length, 24) * 0.135, 0, 0.13]}>
        <planeGeometry args={[0.03, 0.34]} />
      </mesh>
      {hasText && (
        <group position={[BAR_W / 2 - 0.34, 0, 0.12]} onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); setQuery(''); }}>
          <CompositeText position={[0, 0, 0]} fontSize={0.18} letterSpacing={0.02} variant="bright">×</CompositeText>
        </group>
      )}
    </group>
  );
}
