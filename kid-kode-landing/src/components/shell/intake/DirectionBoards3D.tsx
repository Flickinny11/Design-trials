'use client';

// PRISM SHELL — DIRECTION BOARDS (SHELL W2, S5 / DL10/DL13/DL16)
//
// The intake's showpiece: four-plus LIVE 3D material studies on ONE shared
// canvas (DL8 rider). Each board is a genuinely distinct mini-scene — its own
// material family (machined metal · Carrara marble · brushed copper on stone ·
// smoked-glass sapphire · walnut & brass), geometry, and motion character — so
// no two read alike (generic boards = MUST-FIX). The textured boards load REAL
// baked PBR sets from the product's own texture pipeline (DL13); each sits
// behind its own Suspense with a procedural fallback so a board is never empty.
// DOM overlays carry the name, palette swatches, hit + selection (Prime
// Boundary: text/chrome is DOM).

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { Suspense, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  StudioEnvironment,
  StudioLights,
  usePremiumMaterials,
  type PremiumMaterials,
} from '../showpiece/premium-materials';
import { usePrefersReducedMotion } from '../builder/use-reduced-motion';
import { DIRECTION_BOARDS, type DirectionBoardDef } from '@/lib/shell/intake/intake-model';

// ── Per-scene rendered forms ─────────────────────────────────────────────────

function MachinedForm({ m, spin }: { m: PremiumMaterials; spin: number }) {
  return (
    <group rotation={[0.16, spin, 0]}>
      <mesh material={m.chrome} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[1.0, 1.0, 0.28]} />
      </mesh>
      <mesh material={m.gunmetal} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.16]}>
        <torusGeometry args={[0.42, 0.08, 20, 40]} />
      </mesh>
      <mesh material={m.redJewel} position={[0, 0, 0.28]}>
        <octahedronGeometry args={[0.24, 0]} />
      </mesh>
    </group>
  );
}

function usePbr(dir: string, opts: { metalness: number; roughness: number }) {
  const maps = useTexture({
    map: `${dir}/albedo.png`,
    normalMap: `${dir}/normal.png`,
    roughnessMap: `${dir}/rough.png`,
  });
  return useMemo(() => {
    maps.map.colorSpace = THREE.SRGBColorSpace;
    for (const t of [maps.map, maps.normalMap, maps.roughnessMap]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
    }
    return new THREE.MeshStandardMaterial({
      map: maps.map,
      normalMap: maps.normalMap,
      roughnessMap: maps.roughnessMap,
      metalness: opts.metalness,
      roughness: opts.roughness,
      envMapIntensity: 0.9,
    });
  }, [maps, opts.metalness, opts.roughness]);
}

function MarbleForm({ m, spin }: { m: PremiumMaterials; spin: number }) {
  const marble = usePbr('/prism-mock/editor/textures/generated/carrara-marble', {
    metalness: 0,
    roughness: 0.55,
  });
  const brass = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#b08d4c', metalness: 1, roughness: 0.32 }),
    [],
  );
  return (
    <group rotation={[0.1, spin, 0]}>
      <mesh material={marble} position={[0, -0.32, 0]}>
        <cylinderGeometry args={[0.62, 0.72, 0.5, 48]} />
      </mesh>
      <mesh material={marble} position={[0, 0.34, 0]}>
        <sphereGeometry args={[0.42, 48, 48]} />
      </mesh>
      <mesh material={brass} position={[0, 0.34, 0]} rotation={[Math.PI / 2, 0, spin * 0.6]}>
        <torusGeometry args={[0.6, 0.045, 24, 64]} />
      </mesh>
    </group>
  );
}

function CopperForm({ spin }: { spin: number }) {
  const copper = usePbr('/prism-mock/editor/textures/generated/brushed-copper', {
    metalness: 1,
    roughness: 0.34,
  });
  const stone = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#2a2724', metalness: 0.2, roughness: 0.85 }),
    [],
  );
  return (
    <group rotation={[0.14, spin, 0]}>
      <mesh material={stone} position={[0, -0.42, 0]}>
        <boxGeometry args={[1.05, 0.42, 1.05]} />
      </mesh>
      <mesh material={copper} position={[0, 0.24, 0]} rotation={[0.1, 0, 0.12]}>
        <cylinderGeometry args={[0.56, 0.56, 0.16, 56]} />
      </mesh>
      <mesh material={copper} position={[0, 0.24, 0]}>
        <torusGeometry args={[0.66, 0.05, 18, 56]} />
      </mesh>
    </group>
  );
}

function GlassForm({ m, spin }: { m: PremiumMaterials; spin: number }) {
  const sapphire = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#3a5c86',
        metalness: 0,
        roughness: 0.05,
        transmission: 0.9,
        thickness: 1.2,
        ior: 1.7,
        attenuationColor: new THREE.Color('#2b4a7a'),
        attenuationDistance: 1.4,
        emissive: new THREE.Color('#0d2a55'),
        emissiveIntensity: 0.35,
      }),
    [],
  );
  return (
    <group rotation={[spin * 0.5, spin, 0]}>
      <mesh material={m.smokedGlass}>
        <icosahedronGeometry args={[0.62, 0]} />
      </mesh>
      <mesh material={sapphire}>
        <octahedronGeometry args={[0.4, 0]} />
      </mesh>
    </group>
  );
}

function WalnutForm({ spin }: { spin: number }) {
  const walnut = usePbr('/prism-mock/editor/textures/generated/walnut-grain', {
    metalness: 0,
    roughness: 0.5,
  });
  const brass = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#c9a15a', metalness: 1, roughness: 0.3 }),
    [],
  );
  return (
    <group rotation={[0.12, spin, 0]}>
      <mesh material={walnut}>
        <boxGeometry args={[1.0, 0.72, 0.24]} />
      </mesh>
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} material={brass} position={[x, 0, 0.14]}>
          <boxGeometry args={[0.06, 0.72, 0.06]} />
        </mesh>
      ))}
      <mesh material={brass} position={[0, 0, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.12, 24]} />
      </mesh>
    </group>
  );
}

/** Procedural fallback shown while a board's PBR set streams in. */
function FallbackForm({ m }: { m: PremiumMaterials }) {
  return (
    <mesh material={m.gunmetalLit}>
      <icosahedronGeometry args={[0.56, 0]} />
    </mesh>
  );
}

// ── Boards scene + cell rig ──────────────────────────────────────────────────

function BoardsScene({
  selectedId,
  hovered,
  reduced,
}: {
  selectedId: string | null;
  hovered: string | null;
  reduced: boolean;
}) {
  const count = DIRECTION_BOARDS.length;
  const cols = count <= 3 ? count : Math.ceil(count / 2);
  const rows = Math.ceil(count / cols);
  return (
    <>
      {DIRECTION_BOARDS.map((def, i) => (
        <SpinningCell
          key={def.token.id}
          index={i}
          count={count}
          cols={cols}
          rows={rows}
          def={def}
          selected={selectedId === def.token.id}
          hovered={hovered === def.token.id}
          reduced={reduced}
        />
      ))}
    </>
  );
}

// A cell that owns its own spin clock so the form actually rotates.
function SpinningCell(props: {
  index: number;
  count: number;
  cols: number;
  rows: number;
  def: DirectionBoardDef;
  selected: boolean;
  hovered: boolean;
  reduced: boolean;
}) {
  const { width: vw, height: vh } = useThree((s) => s.viewport);
  const rig = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const lift = useRef(0);
  const scale = useRef(1);
  const m = usePremiumMaterials();
  const { index, cols, rows, def, selected, hovered, reduced } = props;

  const cellW = vw / cols;
  const cellH = vh / rows;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const cx = -vw / 2 + cellW * (col + 0.5);
  // Board sits high in the cell; name + character + swatches occupy the lower
  // third of the DOM hit below it.
  const cy = vh / 2 - cellH * (row + 0.5) + cellH * 0.2;
  const base = Math.min(cellW * 0.42, cellH * 0.4);
  const speed =
    def.scene === 'copper-stone'
      ? 0.85
      : def.scene === 'glass-sapphire'
        ? 0.26
        : def.scene === 'machined-metal'
          ? 0.5
          : def.scene === 'walnut-brass'
            ? 0.2
            : 0.36;

  useFrame((_, dt) => {
    if (rig.current) {
      const liftTarget = hovered ? 0.14 : selected ? 0.08 : 0;
      const scaleTarget = selected ? 1.12 : hovered ? 1.06 : 1;
      const ease = 1 - Math.exp(-dt * 9);
      lift.current += (liftTarget - lift.current) * ease;
      scale.current += (scaleTarget - scale.current) * ease;
      // Parent group is already at the cell centre; offset only by the lift.
      rig.current.position.y = lift.current * base;
      rig.current.scale.setScalar(base * scale.current);
    }
    if (inner.current && !reduced) inner.current.rotation.y += dt * speed;
  });

  return (
    <group position={[cx, cy, 0]}>
      <group ref={rig}>
        <group ref={inner}>
          <Suspense fallback={<FallbackForm m={m} />}>
            <BoardFormStatic def={def} />
          </Suspense>
        </group>
      </group>
      {selected ? (
        <mesh material={m.redHot} position={[0, -cellH * 0.36, 0.6]}>
          <sphereGeometry args={[base * 0.12, 20, 20]} />
        </mesh>
      ) : null}
    </group>
  );
}

// Forms without an internal spin prop — the parent SpinningCell rotates them.
function BoardFormStatic({ def }: { def: DirectionBoardDef }) {
  const m = usePremiumMaterials();
  switch (def.scene) {
    case 'machined-metal':
      return <MachinedForm m={m} spin={0} />;
    case 'marble-brass':
      return <MarbleForm m={m} spin={0} />;
    case 'copper-stone':
      return <CopperForm spin={0} />;
    case 'glass-sapphire':
      return <GlassForm m={m} spin={0} />;
    case 'walnut-brass':
      return <WalnutForm spin={0} />;
    default:
      return <FallbackForm m={m} />;
  }
}

export default function DirectionBoards3D({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const reduced = usePrefersReducedMotion();
  const count = DIRECTION_BOARDS.length;
  const cols = count <= 3 ? count : Math.ceil(count / 2);

  return (
    <div className="iv-boards" style={{ ['--iv-cols' as string]: cols }}>
      <Canvas
        dpr={[1, 2]}
        orthographic
        camera={{ position: [0, 0, 10], zoom: 40, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true }}
        className="iv-boards-canvas"
        style={{ position: 'absolute', inset: 0 }}
      >
        <StudioEnvironment />
        <StudioLights />
        <BoardsScene selectedId={selectedId} hovered={hovered} reduced={reduced} />
      </Canvas>
      <div className="iv-boards-hits">
        {DIRECTION_BOARDS.map((def) => {
          const on = selectedId === def.token.id;
          const p = def.token.palette;
          return (
            <button
              key={def.token.id}
              type="button"
              className="iv-board-hit"
              data-selected={on ? 'true' : 'false'}
              aria-pressed={on}
              onMouseEnter={() => setHovered(def.token.id)}
              onMouseLeave={() => setHovered((h) => (h === def.token.id ? null : h))}
              onClick={() => onSelect(def.token.id)}
            >
              <span className="iv-board-name">{def.token.name}</span>
              <span className="iv-board-character">{def.token.character}</span>
              <span className="iv-board-swatches" aria-hidden>
                {[p.primary, p.secondary, p.accent].map((c, i) => (
                  <span key={i} className="iv-board-swatch" style={{ background: c }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
