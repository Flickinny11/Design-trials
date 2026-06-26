'use client';

// MaterialPromptPanel — PROMPT-TO-TEXTURE in-canvas (spec §2.4), ZERO DOM. A glass
// pane with a milled prompt SLOT: click it to focus, then type a surface
// description (window-keydown capture — editor chrome, window access allowed). A
// GENERATE worn-cube button (or Enter) POSTs to the server-only /api/material-gen,
// which runs the FLUX pipeline + derives a MATCHED-LATENT + DELIT PBR set; on
// success the new material is registered, its maps load imperatively, and it is
// applied to the displays live. Preset chips fire a few ready descriptions.
//
// Orchestration lives HERE (not the store) so the store never imports the build/
// registry runtime (no import cycle).

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { WornMaps } from '@/components/editor/chassis/materials';
import { applyWornMaterial } from '@/components/editor/chassis/materials';
import { SPIN_DURATION, SPIN_TURNS, easeInOutCubic } from '@/components/editor/chassis/chassis-config';
import { buildCubeGeometry, buildPaneGeometry } from '@/components/editor/primitive/primitive-geometry';
import { EngravedText } from '@/components/editor/primitive/EngravedText';
import { ClickCatcher } from '@/components/editor/primitive/ClickCatcher';
import { FaceGlyph } from '@/components/editor/chassis/FaceGlyph';
import { loadGeneratedMapSet } from './material-build';
import { registerGeneratedMaterial } from './material-registry';
import { useMaterialStore } from './use-material-store';

const PX = -9.1;
const PY = 1.0;
const PW = 4.2;
const PH = 6.4;
const PANEL_DEPTH = 0.4;
const FRONT_Z = PANEL_DEPTH / 2;
const KNOB_Z = FRONT_Z + 0.02;
const LABEL_Z = FRONT_Z - 0.07;
const SLOT_Z = FRONT_Z + 0.015;
const TWO_PI = Math.PI * 2;
const REST_TURNS = Math.max(1, Math.round(SPIN_TURNS));

interface Preset { label: string; prompt: string; kind: string }
const PRESETS: Preset[] = [
  { label: 'HAMMERED BRASS', prompt: 'hammered antique brass with dimpled planished texture', kind: 'metal' },
  { label: 'BLACK SLATE', prompt: 'riven black slate stone with cleaved matte surface', kind: 'stone' },
  { label: 'WOVEN LINEN', prompt: 'natural woven linen fabric with visible thread weave', kind: 'fabric' },
];

// ── orchestration ────────────────────────────────────────────────────────────
async function runGeneration(prompt: string, kind?: string) {
  const st = useMaterialStore.getState();
  const p = prompt.trim();
  if (!p || st.genStatus === 'generating') return;
  st.setGenStatus('generating', p);
  try {
    const res = await fetch('/api/material-gen', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: p, kind }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'generation failed');
    await loadGeneratedMapSet(data.def.maps);
    registerGeneratedMaterial(data.def);
    useMaterialStore.getState().setActiveFamily('Generated');
    useMaterialStore.getState().setMaterial(data.def.id);
    useMaterialStore.getState().setGenStatus('done', data.def.label);
  } catch (e) {
    useMaterialStore.getState().setGenStatus('error', e instanceof Error ? e.message : String(e));
  }
}

// ── worn-cube button (generate / preset) ────────────────────────────────────────
function WornButton({
  maps, position, size = 0.5, glyph, tint, onClick,
}: {
  maps: WornMaps; position: [number, number, number]; size?: number; glyph?: 'wand'; tint?: string; onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const elapsed = useRef(0);
  const spin = useRef({ active: false, start: 0 });
  const geo = useMemo(() => buildCubeGeometry({ width: size, height: size, depth: size, cornerRadius: size * 0.14, bevel: 0.04, radius: 0, segments: 5, cutouts: [] }), [size]);
  useEffect(() => () => geo.dispose(), [geo]);
  const material = useMemo(() => { const m = new THREE.MeshPhysicalMaterial(); applyWornMaterial(m, maps); if (tint) m.color = new THREE.Color(tint); return m; }, [maps, tint]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame((state) => {
    const mesh = meshRef.current; if (!mesh) return;
    elapsed.current = state.clock.elapsedTime;
    const s = spin.current;
    if (s.active) { const t = (elapsed.current - s.start) / SPIN_DURATION; if (t >= 1) { mesh.rotation.x = 0; s.active = false; } else mesh.rotation.x = easeInOutCubic(t) * REST_TURNS * TWO_PI; }
  });
  return (
    <mesh ref={meshRef} geometry={geo} material={material} position={position} castShadow
      onPointerOver={(e) => { e.stopPropagation(); spin.current.active = true; spin.current.start = elapsed.current; document.body.style.cursor = 'pointer'; }}
      onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = ''; }}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(); }}>
      {glyph && <FaceGlyph glyph={glyph} z={size / 2 + 0.002} />}
    </mesh>
  );
}

function Panel() {
  const slot = { id: 'slot', x: 0, y: 1.5, w: PW - 1.0, h: 0.7, r: 0.14 };
  const geo = useMemo(() => buildPaneGeometry({ width: PW, height: PH, depth: PANEL_DEPTH, cornerRadius: 0.3, bevel: 0.05, radius: 0, segments: 24, cutouts: [slot] }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} castShadow receiveShadow raycast={() => null}>
      <meshPhysicalMaterial transmission={1} thickness={0.6} ior={1.5} roughness={0.06} metalness={0} clearcoat={1} clearcoatRoughness={0.18} attenuationColor={'#dbe8f2'} attenuationDistance={1.9} envMapIntensity={1.05} specularIntensity={0.7} transparent />
    </mesh>
  );
}

export function MaterialPromptPanel({ mapSets }: { mapSets: Record<string, WornMaps> }) {
  const buffer = useMaterialStore((s) => s.promptBuffer);
  const focused = useMaterialStore((s) => s.promptFocused);
  const status = useMaterialStore((s) => s.genStatus);
  const message = useMaterialStore((s) => s.genMessage);
  const setBuffer = useMaterialStore((s) => s.setPromptBuffer);
  const setFocused = useMaterialStore((s) => s.setPromptFocused);
  const caret = useRef(true);

  // window keydown capture (only when the slot is focused).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!useMaterialStore.getState().promptFocused) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const st = useMaterialStore.getState();
      if (e.key === 'Enter') { e.preventDefault(); runGeneration(st.promptBuffer); }
      else if (e.key === 'Backspace') { e.preventDefault(); st.setPromptBuffer(st.promptBuffer.slice(0, -1)); }
      else if (e.key === 'Escape') { e.preventDefault(); st.setPromptFocused(false); }
      else if (e.key.length === 1) { e.preventDefault(); st.setPromptBuffer(st.promptBuffer + e.key); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // caret blink (engraved underscore).
  useFrame((state) => { caret.current = Math.floor(state.clock.elapsedTime * 1.6) % 2 === 0; });

  // verification hook (editor chrome).
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__PRISM_MAT_PROMPT__ = {
      focus: () => useMaterialStore.getState().setPromptFocused(true),
      blur: () => useMaterialStore.getState().setPromptFocused(false),
      setBuffer: (s: string) => useMaterialStore.getState().setPromptBuffer(s),
      generate: (prompt?: string, kind?: string) => runGeneration(prompt ?? useMaterialStore.getState().promptBuffer, kind),
      status: () => { const st = useMaterialStore.getState(); return { status: st.genStatus, message: st.genMessage, buffer: st.promptBuffer }; },
      slotWorld: [PX, PY + 1.5, SLOT_Z],
      generateWorld: [PX + 1.2, PY - 0.3, KNOB_Z],
      presets: PRESETS.map((p, i) => ({ label: p.label, prompt: p.prompt, world: [PX, PY - 1.3 - i * 0.95, KNOB_Z] })),
    };
    return () => { delete w.__PRISM_MAT_PROMPT__; };
  }, []);

  const statusText = status === 'generating' ? 'GENERATING…'
    : status === 'done' ? `DONE · ${message.toUpperCase()}`
    : status === 'error' ? 'ERROR · TRY AGAIN'
    : 'READY';

  const display = (focused ? buffer + (caret.current ? '_' : ' ') : buffer) || 'CLICK · TYPE A SURFACE';

  return (
    <group position={[PX, PY, 0]}>
      <Panel />
      <ClickCatcher width={PW} height={PH} position={[0, 0, FRONT_Z]} />

      <EngravedText position={[0, PH / 2 - 0.55, LABEL_Z]} fontSize={0.2} letterSpacing={0.08}>
        PROMPT · TEXTURE
      </EngravedText>

      {/* the prompt slot (focusable) */}
      <mesh position={[0, 1.5, SLOT_Z - 0.16]} raycast={undefined}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); setFocused(true); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'text'; }}
        onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = ''; }}>
        <boxGeometry args={[PW - 1.0, 0.7, 0.08]} />
        <meshStandardMaterial color={focused ? '#1a2230' : '#10151e'} roughness={0.5} metalness={0.2} />
      </mesh>
      <EngravedText position={[0, 1.5, SLOT_Z]} fontSize={0.135} letterSpacing={0.01} maxWidth={PW - 1.2}>
        {display}
      </EngravedText>

      {/* generate */}
      <group position={[1.2, -0.3, 0]}>
        <WornButton maps={mapSets['worn:emerald']} position={[0, 0, KNOB_Z]} glyph="wand" tint="#9fe7c4" onClick={() => runGeneration(useMaterialStore.getState().promptBuffer)} />
        <EngravedText position={[0, -0.5, LABEL_Z]} fontSize={0.12} letterSpacing={0.06}>
          GENERATE
        </EngravedText>
      </group>
      <EngravedText position={[-1.0, -0.3, LABEL_Z]} fontSize={0.115} letterSpacing={0.05} maxWidth={1.8}>
        {statusText}
      </EngravedText>

      {/* preset chips */}
      <EngravedText position={[0, -0.95, LABEL_Z]} fontSize={0.12} letterSpacing={0.18}>
        PRESETS
      </EngravedText>
      {PRESETS.map((p, i) => (
        <group key={p.label} position={[0, -1.3 - i * 0.95, 0]}>
          <WornButton maps={mapSets[i % 2 === 0 ? 'worn:bronze' : 'worn:sapphire']} position={[-1.3, 0, KNOB_Z]} size={0.42} onClick={() => runGeneration(p.prompt, p.kind)} />
          <EngravedText position={[0.25, 0, LABEL_Z]} fontSize={0.12} letterSpacing={0.04} anchorX="left" maxWidth={2.6}>
            {p.label}
          </EngravedText>
        </group>
      ))}
    </group>
  );
}
