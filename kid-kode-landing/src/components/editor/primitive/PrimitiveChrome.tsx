'use client';

// PrimitiveChrome — the in-canvas editor chrome for /primitive-lab, DOGFOODED from
// the primitive library itself (spec §7.4): the instantiate palette and the mode
// toggle are built from the SAME parametric glass Pane + worn-alloy Cube the
// customer uses. Zero DOM (no-dom-ui LAW).
//
//   • InstantiatePalette — a glass bar with one worn-cube button per primitive
//     kind (Pane / Cube / Sphere). Click → store.instantiate(kind): the node is
//     created AND realized in the same action (Node Law §0/§5). Hover spins the
//     cube end-over-end (the chassis signature).
//   • ModeToggle — galaxy (unbuilt) ⇄ canvas (realized) view switch.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { applyWornMaterial, type WornMaps } from '@/components/editor/chassis/materials';
import { SPIN_DURATION, SPIN_TURNS, easeInOutCubic } from '@/components/editor/chassis/chassis-config';
import { FaceGlyph } from '@/components/editor/chassis/FaceGlyph';
import { buildCubeGeometry, buildPaneGeometry } from './primitive-geometry';
import { EngravedText } from './EngravedText';
import { ClickCatcher } from './ClickCatcher';
import { useLabGraphStore, type LabViewMode } from './use-lab-graph-store';
import type { PrimitiveKind } from './primitive-schema';

const TWO_PI = Math.PI * 2;
const REST_TURNS = Math.max(1, Math.round(SPIN_TURNS));

// A glass bar built from the parametric Pane primitive (dogfood).
function GlassBar({
  width,
  height,
  position,
}: {
  width: number;
  height: number;
  position: [number, number, number];
}) {
  const geo = useMemo(
    () =>
      buildPaneGeometry({
        width,
        height,
        depth: 0.34,
        cornerRadius: 0.26,
        bevel: 0.05,
        radius: 0,
        segments: 24,
        cutouts: [],
      }),
    [width, height],
  );
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <>
      <mesh geometry={geo} position={position} castShadow receiveShadow raycast={() => null}>
        <meshPhysicalMaterial
          transmission={1}
          thickness={0.6}
          ior={1.5}
          roughness={0.06}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.18}
          attenuationColor={'#dbe8f2'}
          attenuationDistance={1.8}
          envMapIntensity={1.05}
          specularIntensity={0.7}
          transparent
        />
      </mesh>
      {/* solid catcher so clicking the bar background never deselects */}
      <ClickCatcher width={width} height={height} position={position} />
    </>
  );
}

// A worn-alloy cube button (chassis finish + hover-spin). `glyph` engraves an
// abstract mark on the front; `onClick` fires the action.
function CubeButtonStd({
  maps,
  glyph,
  size = 0.62,
  position,
  onClick,
  tint,
}: {
  maps: WornMaps;
  glyph: 'image' | 'cube' | 'bulb' | 'move' | 'sparkle';
  size?: number;
  position: [number, number, number];
  onClick: () => void;
  tint?: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const elapsed = useRef(0);
  const spin = useRef({ active: false, start: 0 });
  const geo = useMemo(
    () => buildCubeGeometry({ width: size, height: size, depth: size, cornerRadius: size * 0.13, bevel: 0.05, radius: 0, segments: 6, cutouts: [] }),
    [size],
  );
  useEffect(() => () => geo.dispose(), [geo]);
  const material = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial();
    applyWornMaterial(m, maps);
    if (tint) m.color = new THREE.Color(tint);
    return m;
  }, [maps, tint]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    elapsed.current = state.clock.elapsedTime;
    const s = spin.current;
    if (s.active) {
      const t = (elapsed.current - s.start) / SPIN_DURATION;
      if (t >= 1) {
        mesh.rotation.x = 0;
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
    document.body.style.cursor = 'pointer';
  };
  const onOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = '';
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick();
  };

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        geometry={geo}
        material={material}
        castShadow
        receiveShadow
        onPointerOver={onOver}
        onPointerOut={onOut}
        onClick={click}
      >
        <FaceGlyph glyph={glyph} z={size / 2 + 0.002} />
      </mesh>
    </group>
  );
}

const KINDS: { kind: PrimitiveKind; label: string; glyph: 'image' | 'cube' | 'bulb' }[] = [
  { kind: 'pane', label: 'PANE', glyph: 'image' },
  { kind: 'cube', label: 'CUBE', glyph: 'cube' },
  { kind: 'sphere', label: 'SPHERE', glyph: 'bulb' },
];

function InstantiatePalette({ maps }: { maps: Record<string, WornMaps> }) {
  const instantiate = useLabGraphStore((s) => s.instantiate);
  const setView = useLabGraphStore((s) => s.setView);
  const y = -3.9;
  const spacing = 2.1;
  const startX = -((KINDS.length - 1) * spacing) / 2;
  const FRONT = 0.34 / 2 + 0.31; // bar front face + cube half

  // Verification convenience: instantiate a kind through the SAME store path the
  // button click uses + publish button world positions so a headless test can
  // project them to screen px and drive a REAL pointer click (editor chrome —
  // window access allowed).
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__PRISM_PRIM_INSTANTIATE__ = (kind: PrimitiveKind) => {
      setView('canvas'); // creating a primitive realizes it — be in canvas to see it
      return instantiate(kind);
    };
    w.__PRISM_PRIM_PALETTE_POS__ = KINDS.map((k, i) => ({
      kind: k.kind,
      pos: [startX + i * spacing, y + 0.05, FRONT] as [number, number, number],
    }));
    return () => {
      delete w.__PRISM_PRIM_INSTANTIATE__;
      delete w.__PRISM_PRIM_PALETTE_POS__;
    };
  }, [instantiate, setView, startX, spacing, FRONT, y]);

  return (
    <group>
      <GlassBar width={spacing * KINDS.length + 1.2} height={1.7} position={[0, y, 0]} />
      <EngravedText position={[0, y + 0.62, 0.34 / 2 - 0.02]} fontSize={0.18} letterSpacing={0.18}>
        ADD PRIMITIVE
      </EngravedText>
      {KINDS.map((k, i) => {
        const x = startX + i * spacing;
        const tex = k.kind === 'pane' ? 'gunmetal' : k.kind === 'cube' ? 'sapphire' : 'bronze';
        return (
          <group key={k.kind}>
            <CubeButtonStd
              maps={maps[tex]}
              glyph={k.glyph}
              position={[x, y + 0.05, FRONT]}
              onClick={() => {
                setView('canvas');
                instantiate(k.kind);
              }}
            />
            <EngravedText position={[x, y - 0.6, 0.34 / 2 - 0.02]} fontSize={0.15} letterSpacing={0.12}>
              {k.label}
            </EngravedText>
          </group>
        );
      })}
    </group>
  );
}

function ModeToggle({ maps }: { maps: Record<string, WornMaps> }) {
  const viewMode = useLabGraphStore((s) => s.viewMode);
  const setView = useLabGraphStore((s) => s.setView);
  const y = 3.95;
  const spacing = 2.0;
  const FRONT = 0.34 / 2 + 0.27;
  const opts: { mode: LabViewMode; label: string; glyph: 'bulb' | 'cube' }[] = [
    { mode: 'galaxy', label: 'GALAXY', glyph: 'bulb' },
    { mode: 'canvas', label: 'CANVAS', glyph: 'cube' },
  ];
  return (
    <group>
      <GlassBar width={spacing * 2 + 1.0} height={1.5} position={[0, y, 0]} />
      {opts.map((o, i) => {
        const x = (i - 0.5) * spacing;
        const active = viewMode === o.mode;
        return (
          <group key={o.mode}>
            <CubeButtonStd
              maps={active ? maps.emerald : maps.gunmetal}
              glyph={o.glyph}
              size={0.54}
              tint={active ? '#9fe7c4' : undefined}
              position={[x, y + 0.12, FRONT]}
              onClick={() => setView(o.mode)}
            />
            <EngravedText position={[x, y - 0.5, 0.34 / 2 - 0.02]} fontSize={0.14} letterSpacing={0.12}>
              {o.label}
            </EngravedText>
          </group>
        );
      })}
    </group>
  );
}

export function PrimitiveChrome({ maps }: { maps: Record<string, WornMaps> }) {
  return (
    <>
      <ModeToggle maps={maps} />
      <InstantiatePalette maps={maps} />
    </>
  );
}
