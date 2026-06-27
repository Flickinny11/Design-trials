'use client';

// CubeButton — one rounded-cornered CUBE of worn alloy, seated in its milled
// cutout. Sized (CUBE) so its rotating diagonal stays inside the hole (see
// CUBE_HALF_DIAGONAL < HOLE_HALF in chassis-config) — it never clips the glass.
//
// On HOVER it spins end-over-end on its local X axis (easeInOutCubic, ~3.5→4
// turns) — because the cube is smaller than its cutout you SEE THROUGH the hole
// to the backdrop as it turns edge-on. Hover also raises an in-canvas tooltip via
// the onHover callback.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import {
  CUBE,
  CUBE_CORNER,
  SPIN_DURATION,
  SPIN_TURNS,
  easeInOutCubic,
  type PlacedButton,
} from './chassis-config';
import { applyWornMaterial, type WornMaps } from './materials';
import { FaceGlyph } from './FaceGlyph';

const TWO_PI = Math.PI * 2;
// Land front-face-forward: ease through the nearest whole number of turns (keeps
// the engraved face glyph upright at rest while still passing edge-on repeatedly).
const REST_TURNS = Math.max(1, Math.round(SPIN_TURNS));

export interface CubeButtonProps {
  btn: PlacedButton;
  maps: WornMaps;
  onHover: (btn: PlacedButton | null) => void;
  /** dev/verification: force the spin to a fixed progress (0..1), spec-driven */
  forceSpin?: number | null;
  /** ADDITIVE (editor-integration I-2): fire a click action. The /toolbar-chassis
   *  lab passes nothing, so the lab's hover-only behavior is unchanged; the docked
   *  editor toolbar passes this to drive a real operation on the live app graph. */
  onSelect?: (btn: PlacedButton) => void;
}

export function CubeButton({ btn, maps, onHover, forceSpin = null, onSelect }: CubeButtonProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const elapsed = useRef(0);
  const spin = useRef({ active: false, start: 0 });

  const material = useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial();
    applyWornMaterial(mat, maps);
    return mat;
  }, [maps]);

  // aoMap needs a second UV set; BoxGeometry only ships `uv`. Mirror it to uv1.
  useEffect(() => {
    const geo = meshRef.current?.geometry;
    if (geo && geo.attributes.uv && !geo.attributes.uv1) {
      geo.setAttribute('uv1', geo.attributes.uv);
    }
  }, []);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    elapsed.current = state.clock.elapsedTime;

    if (forceSpin != null) {
      mesh.rotation.x = easeInOutCubic(THREE.MathUtils.clamp(forceSpin, 0, 1)) * REST_TURNS * TWO_PI;
      return;
    }
    const s = spin.current;
    if (s.active) {
      const t = (elapsed.current - s.start) / SPIN_DURATION;
      if (t >= 1) {
        mesh.rotation.x = 0; // REST_TURNS whole turns ≡ 0 — front forward
        s.active = false;
      } else {
        mesh.rotation.x = easeInOutCubic(t) * REST_TURNS * TWO_PI;
      }
    }
  });

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    spin.current.active = true;
    spin.current.start = elapsed.current;
    onHover(btn);
  };
  const onOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHover(null); // let the spin finish on its own
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!onSelect) return; // lab: no click action
    e.stopPropagation();
    onSelect(btn);
  };

  return (
    <group position={[btn.x, btn.y, 0]}>
      <RoundedBox
        ref={meshRef}
        args={[CUBE, CUBE, CUBE]}
        radius={CUBE_CORNER}
        smoothness={6}
        castShadow
        receiveShadow
        material={material}
        onPointerOver={onOver}
        onPointerOut={onOut}
        onClick={onClick}
      >
        {/* engraved abstract face glyph, just proud of the front cube face */}
        <FaceGlyph glyph={btn.fn.glyph} z={CUBE / 2 + 0.001} />
      </RoundedBox>
    </group>
  );
}
