'use client';

// PRISM PRIMITIVE SYSTEM — P-6 — A LIBRARY TILE (spec §7.1).
//
// One palette entry rendered as a LIVE, slowly-spinning 3D PREVIEW of exactly what
// dropping it instantiates (the cube-button mechanic generalized to every kind):
//   • primitive  — the real parametric geometry + glass/worn material.
//   • material   — a sphere wearing the registry PBR material (the true skin).
//   • fluid      — a premium transmission-glass slab (the liquid-glass body).
//   • composite  — the real member assembly, scaled to the tile footprint.
// Hover accelerates the spin + lifts; the active idle turn keeps every tile "alive".
// Clicking the tile INSTANTIATES the entry (wave-1 pipeline; wave-2 adds drag). A
// ClickCatcher socket behind the preview keeps near-miss clicks from falling through.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { WornMaps } from '@/components/editor/chassis/materials';
import { SPIN_DURATION, SPIN_TURNS, easeInOutCubic } from '@/components/editor/chassis/chassis-config';
import { buildCubeGeometry, buildPaneGeometry, buildSphereGeometry } from '@/components/editor/primitive/primitive-geometry';
import { buildPrimitiveMaterial } from '@/components/editor/primitive/primitive-materials';
import { buildMaterialFromDef } from '@/components/editor/material/material-build';
import { getMaterial } from '@/components/editor/material/material-registry';
import { buildMemberMaterial } from '@/components/editor/composite/composite-materials';
import { compositeMembers, makeComposite, type CompositeMember, type CompositeTemplateId, type LabHub } from '@/components/editor/composite/composite-schema';
import { makeSchema as makePrimSchema, defaultMaterialPreview } from './tile-helpers';
import { CompositeText } from '@/components/editor/composite/CompositeText';
import type { LibraryEntry, EntrySpec } from './library-catalog';

const TWO_PI = Math.PI * 2;
const REST_TURNS = Math.max(1, Math.round(SPIN_TURNS));
const TILE_FIT = 1.5; // target footprint the preview is scaled into.

const GLASS_SLAB = (() => {
  const m = new THREE.MeshPhysicalMaterial({
    transmission: 1, thickness: 1.2, ior: 1.45, roughness: 0.05, metalness: 0,
    clearcoat: 1, clearcoatRoughness: 0.12, attenuationColor: new THREE.Color('#bfe3ea'),
    attenuationDistance: 1.6, envMapIntensity: 1.15, specularIntensity: 0.9,
    iridescence: 0.3, iridescenceIOR: 1.3, transparent: true,
  });
  return m;
})();

// ── per-spec preview content (the real artifact, miniaturized) ───────────────────
function PrimitivePreview({ kind, wornMaps }: { kind: 'pane' | 'cube' | 'sphere'; wornMaps: Record<string, WornMaps> }) {
  const schema = useMemo(() => makePrimSchema(kind), [kind]);
  const geo = useMemo(() => (kind === 'cube' ? buildCubeGeometry(schema.params) : kind === 'sphere' ? buildSphereGeometry(schema.params) : buildPaneGeometry(schema.params)), [kind, schema]);
  useEffect(() => () => geo.dispose(), [geo]);
  const mat = useMemo(() => buildPrimitiveMaterial(schema.material, wornMaps), [schema, wornMaps]);
  useEffect(() => () => mat.dispose(), [mat]);
  const nominal = kind === 'pane' ? 3.2 : kind === 'cube' ? 1.4 : 1.8;
  const s = TILE_FIT / nominal;
  return <mesh geometry={geo} material={mat} scale={s} />;
}

function MaterialPreview({ materialId, matSets, wornMaps }: { materialId: string; matSets: Record<string, WornMaps>; wornMaps: Record<string, WornMaps> }) {
  const geo = useMemo(() => buildSphereGeometry({ width: 1, height: 1, depth: 1, cornerRadius: 0, bevel: 0, radius: 0.9, segments: 48, cutouts: [] }), []);
  useEffect(() => () => geo.dispose(), [geo]);
  const mat = useMemo(() => {
    const def = getMaterial(materialId);
    if (def) return buildMaterialFromDef(def, matSets);
    return defaultMaterialPreview(wornMaps);
  }, [materialId, matSets, wornMaps]);
  useEffect(() => () => mat.dispose(), [mat]);
  return <mesh geometry={geo} material={mat} scale={TILE_FIT / 1.8} />;
}

function FluidPreview() {
  const geo = useMemo(() => new THREE.PlaneGeometry(2.4, 1.7, 1, 1), []);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={GLASS_SLAB} scale={TILE_FIT / 2.4} />;
}

function CompositePreview({ templateId, hubs, wornMaps }: { templateId: CompositeTemplateId; hubs: LabHub[]; wornMaps: Record<string, WornMaps> }) {
  const members = useMemo(() => compositeMembers(makeComposite(templateId, hubs), hubs), [templateId, hubs]);
  const nominal = templateId === 'footer' ? 9 : templateId === 'nav-header' ? 8 : 4.2;
  const s = TILE_FIT / nominal;
  return (
    <group scale={s}>
      {members.map((m) => (
        <MiniMember key={m.memberId} member={m} wornMaps={wornMaps} />
      ))}
    </group>
  );
}

function MiniMember({ member, wornMaps }: { member: CompositeMember; wornMaps: Record<string, WornMaps> }) {
  const geo = useMemo(() => {
    const params = { width: member.width, height: member.height, depth: member.depth, cornerRadius: member.cornerRadius, bevel: 0.03, radius: 0, segments: 10, cutouts: [] };
    return member.kind === 'cube' ? buildCubeGeometry(params) : buildPaneGeometry(params);
  }, [member]);
  useEffect(() => () => geo.dispose(), [geo]);
  const mat = useMemo(() => buildMemberMaterial(member.material, wornMaps), [member.material, wornMaps]);
  useEffect(() => () => mat.dispose(), [mat]);
  return <mesh geometry={geo} material={mat} position={[member.local.x, member.local.y, member.local.z]} />;
}

function PreviewContent({ spec, wornMaps, matSets, hubs }: { spec: EntrySpec; wornMaps: Record<string, WornMaps>; matSets: Record<string, WornMaps>; hubs: LabHub[] }) {
  if (spec.t === 'primitive') return <PrimitivePreview kind={spec.kind} wornMaps={wornMaps} />;
  if (spec.t === 'material') return <MaterialPreview materialId={spec.materialId} matSets={matSets} wornMaps={wornMaps} />;
  if (spec.t === 'fluid') return <FluidPreview />;
  if (spec.t === 'composite') return <CompositePreview templateId={spec.templateId} hubs={hubs} wornMaps={wornMaps} />;
  return <PrimitivePreview kind="cube" wornMaps={wornMaps} />; // saved fallback icon
}

const SOCKET_MAT = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
// a soft lit backing so transmissive (glass/gem) previews refract something and
// metals catch contrast — each tile sits in a milled socket.
const TILE_BACK_GEO = new THREE.CircleGeometry(0.92, 40);
const TILE_BACK_TEX = (() => {
  if (typeof document === 'undefined') return null;
  const s = 128, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const g = cv.getContext('2d')!;
  const rg = g.createRadialGradient(s / 2, s * 0.42, 4, s / 2, s / 2, s / 2);
  rg.addColorStop(0, '#9fb6d8'); rg.addColorStop(0.5, '#46597a'); rg.addColorStop(1, '#1a2436');
  g.fillStyle = rg; g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const TILE_BACK_MAT = new THREE.MeshBasicMaterial({ map: TILE_BACK_TEX ?? undefined, color: TILE_BACK_TEX ? '#ffffff' : '#46597a', toneMapped: true });

export interface LibraryTileProps {
  entry: LibraryEntry;
  position: [number, number, number];
  wornMaps: Record<string, WornMaps>;
  matSets: Record<string, WornMaps>;
  hubs: LabHub[];
  onActivate: (entry: LibraryEntry) => void;
  onPressStart?: (entry: LibraryEntry, e: ThreeEvent<PointerEvent>) => void;
}

export function LibraryTile({ entry, position, wornMaps, matSets, hubs, onActivate, onPressStart }: LibraryTileProps) {
  const spinRef = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const hover = useRef(false);
  const flip = useRef({ active: false, start: 0 });

  useFrame((state) => {
    const g = spinRef.current;
    if (!g) return;
    elapsed.current = state.clock.elapsedTime;
    // continuous slow idle turn (the "live" tell), accelerating on hover.
    g.rotation.y += (hover.current ? 0.028 : 0.0085);
    const f = flip.current;
    if (f.active) {
      const t = (elapsed.current - f.start) / SPIN_DURATION;
      if (t >= 1) { g.rotation.x = 0; f.active = false; } else g.rotation.x = easeInOutCubic(t) * REST_TURNS * TWO_PI;
    }
  });

  return (
    <group position={position}>
      {/* lit backing socket: glass/gem previews refract it, metals catch contrast. */}
      <mesh geometry={TILE_BACK_GEO} material={TILE_BACK_MAT} position={[0, 0.16, -0.45]} />
      {/* invisible front catcher so a near-miss click doesn't fall through. */}
      <mesh
        material={SOCKET_MAT}
        position={[0, 0.1, 0.5]}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onActivate(entry); }}
        onPointerDown={(e) => { e.stopPropagation(); onPressStart?.(entry, e); }}
        onPointerOver={(e) => { e.stopPropagation(); hover.current = true; flip.current = { active: true, start: elapsed.current }; document.body.style.cursor = 'grab'; }}
        onPointerOut={(e) => { e.stopPropagation(); hover.current = false; document.body.style.cursor = ''; }}
      >
        <planeGeometry args={[1.74, 1.74]} />
      </mesh>
      <group ref={spinRef} position={[0, 0.16, 0]}>
        <PreviewContent spec={entry.spec} wornMaps={wornMaps} matSets={matSets} hubs={hubs} />
      </group>
      <CompositeText position={[0, -0.86, 0.2]} fontSize={0.15} letterSpacing={0.02} variant="bright">
        {entry.label.toUpperCase()}
      </CompositeText>
    </group>
  );
}
