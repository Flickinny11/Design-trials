'use client';

// PRISM EDITOR INTEGRATION — I-1: the docked panel zones.
//
// Four glass docks framing the viewport — the toolbar, library, inspector, and
// keyframe panel zones. They are PLACEHOLDERS this phase (the real panels dock in
// I-2/I-3), but they are built from the SAME founder-approved vocabulary as
// /toolbar-chassis + /keyframe-editor so the shell MATCHES the labs by
// construction: real transmission glass (the P-1 Pane primitive with milled
// cutouts), worn-metal accents (the chassis worn alloy), and engraved MSDF labels
// (CompositeText). ZERO DOM.

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { buildPaneGeometry, buildCubeGeometry } from '@/components/editor/primitive/primitive-geometry';
import { applyWornMaterial, useWornMaps, type WornMaps } from '@/components/editor/chassis/materials';
import { CompositeText } from '@/components/editor/composite/CompositeText';
import { makeDockGlass, makeGlowTexture } from './editor-shell-glass';
import type { PrimitiveParams, Cutout } from '@/components/editor/primitive/primitive-schema';

// One shared soft-glow texture refracted by every dock (disposed on app teardown).
const GLOW_TEX = makeGlowTexture();

const PARAM_BASE: Omit<PrimitiveParams, 'width' | 'height' | 'cutouts'> = {
  depth: 0.4,
  cornerRadius: 0.3,
  bevel: 0.05,
  radius: 0.5,
  segments: 24,
};

let CUT = 0;
const cut = (x: number, y: number, w: number, h: number, r: number): Cutout => ({
  id: `dock-cut-${CUT++}`,
  x,
  y,
  w,
  h,
  r,
});

function pane(width: number, height: number, cutouts: Cutout[] = [], cornerRadius = 0.3): PrimitiveParams {
  return { ...PARAM_BASE, width, height, cornerRadius, cutouts };
}

/** A worn-metal accent cube (the chassis alloy) seated on a dock. */
function WornNub({
  maps,
  position,
  size = 0.5,
  tint,
}: {
  maps: WornMaps | undefined;
  position: [number, number, number];
  size?: number;
  tint?: string;
}) {
  const geo = useMemo(
    () => buildCubeGeometry({ ...PARAM_BASE, width: size, height: size, depth: size, cornerRadius: size * 0.16, cutouts: [] }),
    [size],
  );
  const mat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial();
    if (maps) applyWornMaterial(m, maps);
    m.roughness = 1;
    m.clearcoat = 0.1;
    m.envMapIntensity = 0.95;
    if (tint) m.color = new THREE.Color(tint);
    return m;
  }, [maps, tint]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  return <mesh geometry={geo} material={mat} position={position} />;
}

/** A thin worn-metal bar (shelf divider / channel rail). */
function WornBar({ maps, position, width, height = 0.06 }: { maps: WornMaps | undefined; position: [number, number, number]; width: number; height?: number }) {
  const geo = useMemo(
    () => buildCubeGeometry({ ...PARAM_BASE, width, height, depth: 0.12, cornerRadius: 0.03, cutouts: [] }),
    [width, height],
  );
  const mat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial();
    if (maps) applyWornMaterial(m, maps);
    m.roughness = 1;
    m.clearcoat = 0.08;
    m.envMapIntensity = 0.9;
    m.color = new THREE.Color('#b8c4d2');
    return m;
  }, [maps]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  return <mesh geometry={geo} material={mat} position={position} />;
}

/** One dock: a glass pane (optionally milled) + an engraved label + accents. */
function Dock({
  position,
  params,
  label,
  labelPos,
  labelSize = 0.36,
  tone = 'clear',
  children,
}: {
  position: [number, number, number];
  params: PrimitiveParams;
  label: string;
  labelPos: [number, number, number];
  labelSize?: number;
  tone?: 'clear' | 'smoke';
  children?: React.ReactNode;
}) {
  const geo = useMemo(() => buildPaneGeometry(params), [params]);
  const mat = useMemo(() => makeDockGlass(tone), [tone]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  return (
    <group position={position}>
      {/* soft glow behind the dock → the glass refracts a bright lobe (chassis read) */}
      <mesh position={[0, 0, -1.4]}>
        <planeGeometry args={[params.width * 1.18, params.height * 1.32]} />
        <meshBasicMaterial
          map={GLOW_TEX}
          transparent
          toneMapped={false}
          opacity={0.42}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh geometry={geo} material={mat} />
      <CompositeText position={labelPos} fontSize={labelSize} variant="engraved" anchorX="left">
        {label}
      </CompositeText>
      {children}
    </group>
  );
}

const Z = 1.0; // docks sit in front of the viewport so they refract it + the backdrop

export function EditorDocks() {
  const wornMaps = useWornMaps();
  const gun = wornMaps['gunmetal'];
  const bronze = wornMaps['bronze'];

  // INSPECTOR (right) — milled fader channels (the keyframe/inspector idiom).
  const inspectorParams = useMemo(() => {
    const channels: Cutout[] = [];
    for (let i = 0; i < 4; i++) channels.push(cut(0, 1.7 - i * 1.15, 2.1, 0.34, 0.15));
    return pane(3.1, 9.6, channels, 0.3);
  }, []);

  // KEYFRAMES (bottom) — one long milled timeline channel.
  const keyframeParams = useMemo(() => pane(22, 1.75, [cut(0.6, -0.18, 18, 0.42, 0.2)], 0.34), []);

  // LIBRARY (left) — clean glass shelf.
  const libraryParams = useMemo(() => pane(2.8, 9.6, [], 0.3), []);

  return (
    <group>
      {/* TOOLBAR zone — the REAL chassis toolbar is docked here by
          EditorToolbarDock (I-2). LIBRARY zone is filled by EditorLibraryDock. */}

      {/* LIBRARY dock */}
      <Dock position={[-11.7, -0.1, Z]} params={libraryParams} label="LIBRARY" labelPos={[-1.15, 4.35, 0.32]} labelSize={0.3}>
        <WornBar maps={gun} position={[0, 2.6, 0.22]} width={2.2} />
        <WornBar maps={gun} position={[0, 0.7, 0.22]} width={2.2} />
        <WornBar maps={gun} position={[0, -1.2, 0.22]} width={2.2} />
        <WornBar maps={gun} position={[0, -3.1, 0.22]} width={2.2} />
      </Dock>

      {/* INSPECTOR dock */}
      <Dock position={[11.7, -0.1, Z]} params={inspectorParams} label="INSPECTOR" labelPos={[-1.35, 4.35, 0.32]} labelSize={0.3}>
        <WornNub maps={gun} position={[0.7, 1.7, 0.22]} size={0.34} />
        <WornNub maps={gun} position={[-0.3, 0.55, 0.22]} size={0.34} />
        <WornNub maps={bronze} position={[0.5, -0.6, 0.22]} size={0.34} tint="#caa06a" />
      </Dock>

      {/* KEYFRAMES dock */}
      <Dock position={[0, -5.8, Z]} params={keyframeParams} label="KEYFRAMES" labelPos={[-10.1, 0.42, 0.32]} labelSize={0.3}>
        <WornNub maps={gun} position={[-3.5, -0.18, 0.2]} size={0.46} tint="#cdd6e2" />
      </Dock>
    </group>
  );
}
