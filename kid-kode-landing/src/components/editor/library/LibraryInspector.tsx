'use client';

// PRISM PRIMITIVE SYSTEM — P-6 — THE INSPECTOR (spec §7.3).
//
// Select a canvas instance → this in-canvas glass panel EXPOSES ITS FULL SCHEMA and
// edits it live: worn-cube FADER KNOBS riding milled channels drive the geometry /
// fluid params (the P-1 / keyframe vocabulary), a material SWATCH row re-skins a
// primitive (P-2 registry, by id), and SAVE / REMOVE chips manage the instance.
// The panel glass IS the P-1 Pane primitive (buildPaneGeometry) — dogfood by
// construction. A ClickCatcher behind the controls keeps panel clicks from falling
// through to the backdrop (the P-1 lesson). Editor chrome.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { applyWornMaterial, useWornMaps, type WornMaps } from '@/components/editor/chassis/materials';
import { buildCubeGeometry, buildPaneGeometry, buildSphereGeometry } from '@/components/editor/primitive/primitive-geometry';
import { buildMaterialFromDef } from '@/components/editor/material/material-build';
import { getMaterial } from '@/components/editor/material/material-registry';
import { CompositeChip } from '@/components/editor/composite/CompositeChip';
import { CompositeText } from '@/components/editor/composite/CompositeText';
import { useLibraryStore, type LibraryInstance, CHROME_PANE_ID } from './use-library-store';

const PANEL_W = 4.2;
const PANEL_H = 11.6;
const CHANNEL_W = 2.5;
const KNOB_Z = 0.34;
const FADER_TOP = PANEL_H / 2 - 2.0;
const FADER_PITCH = 0.78;

const PANEL_MAT = new THREE.MeshPhysicalMaterial({
  transmission: 1, thickness: 0.7, ior: 1.5, roughness: 0.06, metalness: 0,
  clearcoat: 1, clearcoatRoughness: 0.18, attenuationColor: new THREE.Color('#dbe8f2'),
  attenuationDistance: 1.7, envMapIntensity: 1.05, specularIntensity: 0.7, transparent: true,
});
const CATCHER_MAT = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
const CHANNEL_MAT = new THREE.MeshStandardMaterial({ color: '#0c111b', roughness: 0.7, metalness: 0.3 });
const GRAB_MAT = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

// material swatches shown for primitives (a representative cross-family quick set).
const QUICK_MATERIALS = ['metal.gold', 'gem.ruby', 'gem.emerald', 'gem.sapphire', 'stone.carrara-marble', 'glass.clear'];

interface FaderDef { key: string; label: string; min: number; max: number; value: number; target: 'param' | 'fluid' | 'material'; }

// The FULL editable schema surface (spec §1.3 / §3.2 — ALL params exposed), at parity
// with the P-1 / P-3 inspectors the library supersedes.
function fadersFor(inst: LibraryInstance): FaderDef[] {
  if (inst.kind === 'primitive') {
    const p = inst.schema.params;
    const contrast: FaderDef = { key: 'contrast', label: 'CONTRAST', min: 0.5, max: 1.5, value: inst.schema.material.contrast, target: 'material' };
    if (inst.schema.kind === 'sphere') {
      return [
        { key: 'radius', label: 'RADIUS', min: 0.3, max: 1.8, value: p.radius, target: 'param' },
        { key: 'segments', label: 'SEGMENTS', min: 12, max: 64, value: p.segments, target: 'param' },
        contrast,
      ];
    }
    const geo: FaderDef[] = [
      { key: 'width', label: 'WIDTH', min: 0.6, max: 5, value: p.width, target: 'param' },
      { key: 'height', label: 'HEIGHT', min: 0.6, max: 5, value: p.height, target: 'param' },
      { key: 'depth', label: 'THICKNESS', min: 0.1, max: 2, value: p.depth, target: 'param' },
      { key: 'cornerRadius', label: 'CORNER', min: 0, max: 0.6, value: p.cornerRadius, target: 'param' },
      { key: 'bevel', label: 'BEVEL', min: 0, max: 0.2, value: p.bevel, target: 'param' },
      { key: 'segments', label: 'SUBDIV', min: inst.schema.kind === 'cube' ? 2 : 6, max: inst.schema.kind === 'cube' ? 8 : 48, value: p.segments, target: 'param' },
    ];
    return [...geo, contrast];
  }
  if (inst.kind === 'fluid') {
    const p = inst.schema.params;
    return [
      { key: 'viscosity', label: 'VISCOSITY', min: 0, max: 1, value: p.viscosity, target: 'fluid' },
      { key: 'surfaceTension', label: 'TENSION', min: 0, max: 1, value: p.surfaceTension, target: 'fluid' },
      { key: 'flowSpeed', label: 'FLOW', min: 0, max: 2, value: p.flowSpeed, target: 'fluid' },
      { key: 'flowDirection', label: 'DIRECTION', min: 0, max: Math.PI * 2, value: p.flowDirection, target: 'fluid' },
      { key: 'turbulence', label: 'TURBULENCE', min: 0, max: 1, value: p.turbulence, target: 'fluid' },
      { key: 'thickness', label: 'THICKNESS', min: 0.2, max: 2.4, value: p.thickness, target: 'fluid' },
      { key: 'ior', label: 'IOR', min: 1, max: 2.2, value: p.ior, target: 'fluid' },
      { key: 'damping', label: 'DAMPING', min: 0.9, max: 1, value: p.damping, target: 'fluid' },
      { key: 'opacity', label: 'OPACITY', min: 0, max: 1, value: p.opacity, target: 'fluid' },
    ];
  }
  return [];
}

function FaderKnob({ def, y, panelWorldX, panelWorldY, instId, maps }: {
  def: FaderDef; y: number; panelWorldX: number; panelWorldY: number; instId: string; maps: WornMaps;
}) {
  const { camera, gl, controls } = useThree();
  const knobRef = useRef<THREE.Mesh>(null);
  const dragging = useRef(false);
  const geo = useMemo(() => buildCubeGeometry({ width: 0.32, height: 0.32, depth: 0.32, cornerRadius: 0.06, bevel: 0.02, radius: 0, segments: 5, cutouts: [] }), []);
  useEffect(() => () => geo.dispose(), [geo]);
  const mat = useMemo(() => { const m = new THREE.MeshPhysicalMaterial(); applyWornMaterial(m, maps); return m; }, [maps]);
  useEffect(() => () => mat.dispose(), [mat]);

  const xForValue = (v: number) => THREE.MathUtils.mapLinear(THREE.MathUtils.clamp(v, def.min, def.max), def.min, def.max, -CHANNEL_W / 2, CHANNEL_W / 2);

  useFrame(() => {
    if (knobRef.current && !dragging.current) knobRef.current.position.x = xForValue(def.value);
  });

  useEffect(() => {
    if (knobRef.current) knobRef.current.position.x = xForValue(def.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ray = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), -(KNOB_Z)), []);

  // map a WORLD x along the channel → schema value, move the knob, write the store.
  const onMoveTo = (worldX: number) => {
    const localX = THREE.MathUtils.clamp(worldX - panelWorldX, -CHANNEL_W / 2, CHANNEL_W / 2);
    let v = THREE.MathUtils.mapLinear(localX, -CHANNEL_W / 2, CHANNEL_W / 2, def.min, def.max);
    if (def.key === 'segments') v = Math.round(v);
    if (knobRef.current) knobRef.current.position.x = localX;
    const st = useLibraryStore.getState();
    if (def.target === 'param') st.updatePrimParam(instId, { [def.key]: v });
    else if (def.target === 'material') st.updatePrimMaterial(instId, { [def.key]: v });
    else st.updateFluidParam(instId, { [def.key]: v });
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = new THREE.Vector3();
      if (!ray.ray.intersectPlane(plane, hit)) return;
      onMoveTo(hit.x);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      const c = controls as unknown as { enabled: boolean } | null;
      if (c) c.enabled = true;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def.key, def.min, def.max, def.target, instId, panelWorldX]);

  return (
    <group position={[0, y, 0]}>
      <CompositeText position={[-CHANNEL_W / 2 - 0.15, 0.26, 0.18]} fontSize={0.12} letterSpacing={0.02} anchorX="left" variant="engraved">
        {def.label}
      </CompositeText>
      <CompositeText position={[CHANNEL_W / 2 + 0.15, 0.26, 0.18]} fontSize={0.12} letterSpacing={0.02} anchorX="right" variant="bright">
        {def.key === 'segments' ? String(Math.round(def.value)) : def.value.toFixed(2)}
      </CompositeText>
      <mesh material={CHANNEL_MAT} position={[0, 0, 0.14]}>
        <boxGeometry args={[CHANNEL_W + 0.2, 0.1, 0.08]} />
      </mesh>
      {/* the worn-cube knob rides the channel, tracked at prismLibFader for verify. */}
      <mesh ref={knobRef} geometry={geo} material={mat} position={[0, 0, KNOB_Z]} userData={{ prismLibFader: def.key }} />
      {/* a generous invisible grab plane spanning the channel so the knob is easy to seize. */}
      <mesh
        material={GRAB_MAT}
        position={[0, 0, KNOB_Z + 0.05]}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          dragging.current = true;
          const c = controls as unknown as { enabled: boolean } | null;
          if (c) c.enabled = false;
          // seize immediately at the press X so a click jumps the knob there too.
          onMoveTo(e.point.x);
        }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'grab'; }}
        onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = ''; }}
      >
        <planeGeometry args={[CHANNEL_W + 0.5, 0.6]} />
      </mesh>
    </group>
  );
}

function Swatch({ materialId, x, matSets, onPick }: { materialId: string; x: number; matSets: Record<string, WornMaps>; onPick: (id: string) => void }) {
  const geo = useMemo(() => buildSphereGeometry({ width: 1, height: 1, depth: 1, cornerRadius: 0, bevel: 0, radius: 0.26, segments: 28, cutouts: [] }), []);
  useEffect(() => () => geo.dispose(), [geo]);
  const mat = useMemo(() => { const d = getMaterial(materialId); return d ? buildMaterialFromDef(d, matSets) : new THREE.MeshStandardMaterial(); }, [materialId, matSets]);
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh
      geometry={geo}
      material={mat}
      position={[x, 0, 0.2]}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onPick(materialId); }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = ''; }}
    />
  );
}

const FLOW_PATTERNS = ['directional', 'swirl', 'turbulent', 'radial'] as const;
const FLUID_TINTS = ['#bfe3ea', '#a9d6ff', '#c8b6ff', '#bfead1'];

export function LibraryInspector({ position, matSets }: { position: [number, number, number]; matSets: Record<string, WornMaps> }) {
  const wornMaps = useWornMaps();
  const inst = useLibraryStore((s) => s.instances.find((i) => i.id === s.selectedId));
  const remove = useLibraryStore((s) => s.remove);
  const saveSelected = useLibraryStore((s) => s.saveSelectedAsTemplate);
  const applyMaterial = useLibraryStore((s) => s.applyMaterial);
  const addCutout = useLibraryStore((s) => s.addCutout);
  const removeCutout = useLibraryStore((s) => s.removeCutout);
  const updateFluidParam = useLibraryStore((s) => s.updateFluidParam);
  useLibraryStore((s) => s.rev); // re-render on edits so fader value text updates

  const panelGeo = useMemo(() => buildPaneGeometry({ width: PANEL_W, height: PANEL_H, depth: 0.3, cornerRadius: 0.3, bevel: 0.05, radius: 0, segments: 18, cutouts: [] }), []);

  if (!inst) return null;
  const faders = fadersFor(inst);
  const caption = inst.schema.caption;
  const isChrome = inst.id === CHROME_PANE_ID;
  const isPrimitive = inst.kind === 'primitive';
  const isPane = inst.kind === 'primitive' && inst.schema.kind === 'pane';
  const wornKnob = wornMaps.sapphire ?? Object.values(wornMaps)[0];
  const afterFadersY = FADER_TOP - faders.length * FADER_PITCH - 0.2;

  return (
    <group position={position}>
      <mesh geometry={panelGeo} material={PANEL_MAT} />
      <mesh material={CATCHER_MAT} position={[0, 0, -0.1]} onClick={(e: ThreeEvent<MouseEvent>) => e.stopPropagation()}>
        <planeGeometry args={[PANEL_W, PANEL_H]} />
      </mesh>

      <CompositeText position={[0, PANEL_H / 2 - 0.7, 0.18]} fontSize={0.27} letterSpacing={0.05} variant="bright">
        {caption.toUpperCase()}
      </CompositeText>
      <CompositeText position={[0, PANEL_H / 2 - 1.18, 0.18]} fontSize={0.13} letterSpacing={0.16} variant="engraved">
        {inst.kind === 'composite' ? 'INSPECTOR · SUBGRAPH' : 'INSPECTOR · SCHEMA'}
      </CompositeText>

      {/* FADERS — the FULL live editable schema surface (geometry / material / fluid). */}
      {faders.map((f, i) => (
        <FaderKnob key={f.key} def={f} y={FADER_TOP - i * FADER_PITCH} panelWorldX={position[0]} panelWorldY={position[1]} instId={inst.id} maps={wornKnob} />
      ))}

      {/* PANE CUTOUTS — parametric rounded-rect holes (spec §1.2 / §1.3). */}
      {isPane && (
        <group position={[0, afterFadersY, 0.2]}>
          <CompositeText position={[-PANEL_W / 2 + 0.4, 0.0, 0]} fontSize={0.13} letterSpacing={0.02} anchorX="left" variant="engraved">
            {`CUTOUTS ${inst.kind === 'primitive' ? inst.schema.params.cutouts.length : 0}`}
          </CompositeText>
          <CompositeChip maps={wornMaps.bronze ?? wornKnob} position={[0.45, 0, 0]} size={0.42} onClick={() => addCutout(inst.id)} label="+ HOLE" labelVariant="bright" />
          <CompositeChip maps={wornMaps.gunmetal ?? wornKnob} position={[1.5, 0, 0]} size={0.42} onClick={() => removeCutout(inst.id)} label="− HOLE" labelVariant="bright" />
        </group>
      )}

      {/* FLUID extras — pattern / reacts / tint (the remaining §3.2 params). */}
      {inst.kind === 'fluid' && (
        <group position={[0, afterFadersY, 0.2]}>
          <CompositeChip maps={wornMaps.sapphire ?? wornKnob} position={[-1.5, 0, 0]} size={0.42}
            onClick={() => { const cur = inst.schema.params.pattern; const next = FLOW_PATTERNS[(FLOW_PATTERNS.indexOf(cur) + 1) % FLOW_PATTERNS.length]; updateFluidParam(inst.id, { pattern: next }); }}
            label={inst.schema.params.pattern.toUpperCase()} labelVariant="bright" />
          <CompositeChip maps={inst.schema.params.reactsToInteraction ? (wornMaps.emerald ?? wornKnob) : (wornMaps.gunmetal ?? wornKnob)} position={[-0.1, 0, 0]} size={0.42}
            onClick={() => updateFluidParam(inst.id, { reactsToInteraction: !inst.schema.params.reactsToInteraction })}
            label="REACTS" labelVariant="bright" active={inst.schema.params.reactsToInteraction} />
          <CompositeChip maps={wornMaps.bronze ?? wornKnob} position={[1.3, 0, 0]} size={0.42}
            onClick={() => { const cur = FLUID_TINTS.indexOf(inst.schema.params.tint); updateFluidParam(inst.id, { tint: FLUID_TINTS[(cur + 1) % FLUID_TINTS.length] }); }}
            label="TINT" labelVariant="bright" />
        </group>
      )}

      {/* MATERIAL SWATCHES — re-skin a primitive (P-2 registry; full library in palette). */}
      {isPrimitive && (
        <group position={[0, afterFadersY - (isPane ? 0.95 : 0.55), 0.18]}>
          <CompositeText position={[-PANEL_W / 2 + 0.4, 0.38, 0]} fontSize={0.13} letterSpacing={0.02} anchorX="left" variant="engraved">
            MATERIAL
          </CompositeText>
          {QUICK_MATERIALS.map((id, i) => (
            <Swatch key={id} materialId={id} x={-1.5 + i * 0.6} matSets={matSets} onPick={(matId) => applyMaterial(inst.id, matId)} />
          ))}
        </group>
      )}

      {inst.kind === 'composite' && (
        <CompositeText position={[0, afterFadersY, 0.18]} fontSize={0.15} letterSpacing={0.03} variant="engraved">
          {`${inst.schema.templateId.toUpperCase()} · ${(inst.schema.staticMembers.length || 'derived')} MEMBERS`}
        </CompositeText>
      )}

      {/* ACTIONS */}
      <group position={[0, -PANEL_H / 2 + 0.9, 0.2]}>
        <CompositeChip maps={wornMaps.emerald ?? wornKnob} position={[-0.95, 0, 0]} size={0.5} onClick={() => saveSelected()} label="SAVE" labelVariant="bright" />
        {!isChrome && (
          <CompositeChip maps={wornMaps.oxblood ?? wornKnob} position={[0.95, 0, 0]} size={0.5} onClick={() => remove(inst.id)} label="REMOVE" labelVariant="bright" />
        )}
      </group>
    </group>
  );
}
