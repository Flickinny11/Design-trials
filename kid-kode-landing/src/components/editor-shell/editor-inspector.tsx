'use client';

// PRISM EDITOR INTEGRATION — I-3: the docked INSPECTOR (edit full schema, live).
//
// Selecting a node on the canvas populates this panel; it exposes the node's FULL
// editable schema PER TYPE — geometry params (width/height/depth/radius/segments),
// material (roughness/metalness/transmission + a base-color swatch row), and a
// universal scale/opacity — using the SAME worn-cube-fader-on-a-milled-rail
// vocabulary as /toolbar-chassis + /keyframe-editor. Editing writes to the LIVE
// app graph (useGraphSourceStore) and the node updates live in the canvas:
//   • transform (scale) → setScenePosition → the realized wrapper rescales live;
//   • geometry / material → updateNode → the realized artifact rebuilds (the
//     EditorGraphViewport keys each node on a content signature, so a schema edit
//     reconstructs that one node — the "save-and-rebuild" made automatic).
//
// Reads of the node for DISPLAY are reactive (faders show the current value);
// WRITES read fresh store state (getState) so rapid drags never act on a stale
// snapshot. ZERO DOM — controls are R3F + MSDF; this is editor chrome (NOT tagged
// prismEditorNode), so the node-authorship gate ignores it.

import { useMemo } from 'react';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { MESH_PRIMITIVE_DEFAULTS } from '@/lib/prism-graph/types';
import type { PrismNode, MeshPrimitiveKind, MaterialSpec } from '@/lib/prism-graph/types';
import { useWornMaps } from '@/components/editor/chassis/materials';
import { CompositeChip } from '@/components/editor/composite/CompositeChip';
import { CompositeText } from '@/components/editor/composite/CompositeText';
import { ClickCatcher } from '@/components/editor/primitive/ClickCatcher';
import { FaderRow, ColorSwatch, SWATCH_COLORS } from './editor-shell-controls';
import { useEditorShellStore } from './use-editor-shell-store';

const FADER_W = 1.95;
const ROW0 = 3.1;
const PITCH = 0.74;

// geometry param keys shown per primitive kind (subset of MeshPrimitive.params)
const GEO_FADERS: Record<MeshPrimitiveKind, { key: string; label: string; min: number; max: number; integer?: boolean }[]> = {
  cube: [
    { key: 'width', label: 'WIDTH', min: 0.2, max: 4 },
    { key: 'height', label: 'HEIGHT', min: 0.2, max: 4 },
    { key: 'depth', label: 'DEPTH', min: 0.2, max: 4 },
  ],
  plane: [
    { key: 'width', label: 'WIDTH', min: 0.2, max: 5 },
    { key: 'height', label: 'HEIGHT', min: 0.2, max: 5 },
  ],
  sphere: [
    { key: 'radius', label: 'RADIUS', min: 0.2, max: 3 },
    { key: 'segments', label: 'SEGMENTS', min: 8, max: 64, integer: true },
  ],
  cylinder: [
    { key: 'radius', label: 'RADIUS', min: 0.2, max: 3 },
    { key: 'length', label: 'LENGTH', min: 0.2, max: 4 },
    { key: 'segments', label: 'SEGMENTS', min: 6, max: 48, integer: true },
  ],
  cone: [
    { key: 'radius', label: 'RADIUS', min: 0.2, max: 3 },
    { key: 'length', label: 'HEIGHT', min: 0.2, max: 4 },
    { key: 'segments', label: 'SEGMENTS', min: 6, max: 48, integer: true },
  ],
  torus: [
    { key: 'radius', label: 'RADIUS', min: 0.2, max: 3 },
    { key: 'tube', label: 'TUBE', min: 0.05, max: 1.2 },
  ],
  capsule: [
    { key: 'radius', label: 'RADIUS', min: 0.2, max: 2 },
    { key: 'length', label: 'LENGTH', min: 0.2, max: 4 },
  ],
};

const MAT_FADERS: { key: keyof MaterialSpec; label: string; min: number; max: number }[] = [
  { key: 'roughness', label: 'ROUGH', min: 0, max: 1 },
  { key: 'metalness', label: 'METAL', min: 0, max: 1 },
  { key: 'transmission', label: 'GLASS', min: 0, max: 1 },
];

// ── fresh-state writers (never act on a stale closure snapshot) ──────────────
function freshNode(id: string): PrismNode | undefined {
  return useGraphSourceStore.getState().nodes.find((n) => n.nodeId === id);
}
function writeGeo(id: string, key: string, v: number) {
  const cur = freshNode(id);
  if (!cur) return;
  const mp = cur.meshPrimitive ?? { kind: 'cube' as MeshPrimitiveKind, params: {} };
  // write the FULL effective param set (defaults ⊕ current ⊕ edit) so a single
  // edit never drops the kind's other dimensions when params was unset.
  useGraphSourceStore.getState().updateNode(id, {
    renderMode: 'mesh',
    meshPrimitive: { kind: mp.kind, params: { ...MESH_PRIMITIVE_DEFAULTS[mp.kind], ...(mp.params ?? {}), [key]: v } },
  });
}
function writeMat(id: string, patch: Partial<MaterialSpec>) {
  const cur = freshNode(id);
  if (!cur) return;
  useGraphSourceStore.getState().updateNode(id, { materialSpec: { ...(cur.materialSpec ?? {}), ...patch } });
}
function writeScale(id: string, v: number) {
  useGraphSourceStore.getState().setScenePosition(id, { scaleX: v, scaleY: v, scaleZ: v });
}
// I-4 — assign / clear the node's GLOBAL app slot (header / footer / content).
// Persists via updateNode (round-trips through save/reload); realized in PREVIEW.
function writeSlot(id: string, slot: 'header' | 'footer' | undefined) {
  useGraphSourceStore.getState().updateNode(id, { globalSlot: slot });
}

export function EditorInspector({ position }: { position: [number, number, number] }) {
  const selectedId = useEditorShellStore((s) => s.selectedId);
  const node = useGraphSourceStore((s) => (selectedId ? s.nodes.find((n) => n.nodeId === selectedId) ?? null : null));
  const maps = useWornMaps();
  const gun = maps['gunmetal'];
  const bronze = maps['bronze'];

  // expose the selected node's live schema for the headless pass
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__PRISM_EDITOR_INSPECTOR__ = () => {
      const n = selectedId ? freshNode(selectedId) : undefined;
      if (!n) return { nodeId: null };
      const eff = n.meshPrimitive
        ? { ...MESH_PRIMITIVE_DEFAULTS[n.meshPrimitive.kind], ...(n.meshPrimitive.params ?? {}) }
        : null;
      return {
        nodeId: n.nodeId,
        subtype: n.subtype,
        kind: n.meshPrimitive?.kind ?? null,
        params: eff,
        materialSpec: n.materialSpec ?? null,
        scenePosition: n.scenePosition ?? null,
        globalSlot: n.globalSlot ?? null,
      };
    };
    // I-4 — assign the GLOBAL slot of any node (header/footer/content) for the
    // headless pass. slot===null/'content' clears it.
    (window as unknown as Record<string, unknown>).__PRISM_EDITOR_SET_SLOT__ = (id: string, slot: 'header' | 'footer' | 'content' | null) => {
      if (!id) return false;
      writeSlot(id, slot === 'header' || slot === 'footer' ? slot : undefined);
      return true;
    };
    (window as unknown as Record<string, unknown>).__PRISM_EDITOR_FADER_LIST__ = () => {
      const w = window as unknown as { __PRISM_EDITOR_FADERS__?: Map<string, unknown> };
      return w.__PRISM_EDITOR_FADERS__ ? Array.from(w.__PRISM_EDITOR_FADERS__.values()) : [];
    };
    (window as unknown as Record<string, unknown>).__PRISM_EDITOR_SWATCH_LIST__ = () => {
      const w = window as unknown as { __PRISM_EDITOR_SWATCHES__?: Map<string, [number, number, number]> };
      return w.__PRISM_EDITOR_SWATCHES__ ? Array.from(w.__PRISM_EDITOR_SWATCHES__.entries()).map(([color, world]) => ({ color, world })) : [];
    };
  }

  const rows = useMemo(() => {
    if (!node) return [];
    const out: { kind: 'geo' | 'mat' | 'scale' | 'opacity'; key: string; label: string; min: number; max: number; integer?: boolean; value: number; tint?: string }[] = [];
    const mp = node.meshPrimitive;
    const ms = node.materialSpec ?? {};
    // GEOMETRY (mesh primitives) — effective params = per-kind defaults ⊕ overrides
    if (mp) {
      const eff = { ...MESH_PRIMITIVE_DEFAULTS[mp.kind], ...((mp.params as Record<string, number>) ?? {}) } as Record<string, number>;
      for (const f of GEO_FADERS[mp.kind] ?? []) {
        const v = eff[f.key];
        out.push({ kind: 'geo', key: f.key, label: f.label, min: f.min, max: f.max, integer: f.integer, value: typeof v === 'number' ? v : (f.min + f.max) / 2, tint: '#7fb0e0' });
      }
    }
    // MATERIAL
    if (mp || node.materialSpec) {
      for (const f of MAT_FADERS) {
        const v = (ms as Record<string, number>)[f.key as string];
        out.push({ kind: 'mat', key: f.key as string, label: f.label, min: f.min, max: f.max, value: typeof v === 'number' ? v : 0.5, tint: '#caa06a' });
      }
    }
    // UNIVERSAL — scale (live via scenePosition) + opacity
    const sc = node.scenePosition?.scaleX ?? 1;
    out.push({ kind: 'scale', key: 'scale', label: 'SCALE', min: 0.2, max: 3, value: sc, tint: '#cdd6e2' });
    out.push({ kind: 'opacity', key: 'opacity', label: 'OPACITY', min: 0.1, max: 1, value: (ms as Record<string, number>).opacity ?? 1, tint: '#d68a8a' });
    return out;
  }, [node]);

  return (
    <group position={position}>
      {/* solid backstop so a click on the panel never deselects (the P-1 lesson) */}
      <ClickCatcher width={2.9} height={9.2} position={[0, 0, 0.12]} />

      {!node && (
        <CompositeText position={[0, 1.2, 0.3]} fontSize={0.26} variant="engraved">
          SELECT A NODE
        </CompositeText>
      )}

      {node && (
        <>
          {/* node caption + type header */}
          <CompositeText position={[0, 4.05, 0.3]} fontSize={0.2} variant="bright">
            {(node.intent?.caption ?? node.subtype ?? 'NODE').slice(0, 22).toUpperCase()}
          </CompositeText>
          <CompositeText position={[0, 3.66, 0.3]} fontSize={0.12} variant="engraved">
            {(node.meshPrimitive?.kind ?? node.subtype ?? '').toString().toUpperCase()}
          </CompositeText>

          {rows.map((r, i) => (
            <FaderRow
              key={r.kind + ':' + r.key}
              y={ROW0 - i * PITCH}
              width={FADER_W}
              value={r.value}
              min={r.min}
              max={r.max}
              integer={r.integer}
              label={r.label}
              maps={gun}
              tint={r.tint}
              probeId={'insp:' + r.key}
              onChange={(v) => {
                if (!selectedId) return;
                if (r.kind === 'geo') writeGeo(selectedId, r.key, v);
                else if (r.kind === 'scale') writeScale(selectedId, v);
                else writeMat(selectedId, { [r.key]: v } as Partial<MaterialSpec>);
              }}
            />
          ))}

          {/* base-color swatch row */}
          <CompositeText position={[-1.3, ROW0 - rows.length * PITCH - 0.02, 0.3]} fontSize={0.12} anchorX="left" variant="engraved">
            TINT
          </CompositeText>
          {SWATCH_COLORS.map((c, i) => (
            <ColorSwatch
              key={c}
              x={-0.85 + i * 0.36}
              y={ROW0 - rows.length * PITCH - 0.4}
              color={c}
              active={(node.materialSpec?.baseColor ?? '').toLowerCase() === c.toLowerCase()}
              onPick={() => selectedId && writeMat(selectedId, { baseColor: c })}
            />
          ))}

          {/* actions */}
          {gun && (
            <CompositeChip
              maps={gun}
              position={[-0.7, ROW0 - rows.length * PITCH - 1.05, 0.2]}
              size={0.42}
              label="DESELECT"
              onClick={() => useEditorShellStore.getState().select(null)}
            />
          )}
          {bronze && (
            <CompositeChip
              maps={bronze}
              position={[0.7, ROW0 - rows.length * PITCH - 1.05, 0.2]}
              size={0.42}
              tint="#c98a8a"
              label="DELETE"
              onClick={() => {
                if (!selectedId) return;
                useGraphSourceStore.getState().removeNode(selectedId);
                useEditorShellStore.getState().select(null);
              }}
            />
          )}

          {/* I-4 — GLOBAL SLOT selector: pin the node as the app HEADER / FOOTER
              (realized in PREVIEW, across every page), or CONTENT (clear). */}
          <CompositeText position={[-1.3, ROW0 - rows.length * PITCH - 1.62, 0.3]} fontSize={0.12} anchorX="left" variant="engraved">
            SLOT
          </CompositeText>
          {gun && (
            <>
              <CompositeChip
                maps={gun}
                position={[-0.78, ROW0 - rows.length * PITCH - 2.04, 0.2]}
                size={0.36}
                tint={node.globalSlot === 'header' ? '#caa06a' : undefined}
                active={node.globalSlot === 'header'}
                label="HEADER"
                onClick={() => selectedId && writeSlot(selectedId, node.globalSlot === 'header' ? undefined : 'header')}
              />
              <CompositeChip
                maps={gun}
                position={[0, ROW0 - rows.length * PITCH - 2.04, 0.2]}
                size={0.36}
                tint={node.globalSlot === 'footer' ? '#caa06a' : undefined}
                active={node.globalSlot === 'footer'}
                label="FOOTER"
                onClick={() => selectedId && writeSlot(selectedId, node.globalSlot === 'footer' ? undefined : 'footer')}
              />
              <CompositeChip
                maps={gun}
                position={[0.78, ROW0 - rows.length * PITCH - 2.04, 0.2]}
                size={0.36}
                active={!node.globalSlot}
                label="CONTENT"
                onClick={() => selectedId && writeSlot(selectedId, undefined)}
              />
            </>
          )}
        </>
      )}
    </group>
  );
}
