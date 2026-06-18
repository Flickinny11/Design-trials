'use client';

// ObjectFlyout — the 3D Object toolbar group's wired surface (canvas-spec §5
// 3D object tools; P4 Task B).
//
// Wiring contract (mirrors ImageFlyout / TextToolsFlyout / AddElementFlyout):
//   - STRUCTURAL creation goes through useGraphSourceStore.getState()
//     .addNode(buildMeshPrimitiveNode({ parentHubId, kind })) — the node
//     builder is the frozen cross-agent seam owned by ./create-object-node;
//     this file never builds its own node shape. A primitive node is BORN
//     Populated: its geometry IS its artifact (meshPrimitive { kind },
//     renderMode 'mesh').
//   - SHAPE faders write node.meshPrimitive via updateNode as a whole-object
//     replacement (withMeshParamPatch — the sanctioned toolbar route, same
//     rule Transform/Lighting/Image use). The renderer's live primitive
//     handle rebuilds the geometry from the new params instantly — no
//     Save-and-Rebuild needed.
//   - MATERIAL is edited INLINE here (EDITOR-EXP C9 architecture-inversion
//     fix). The §11 editor is now the SHARED `shared-editors/MaterialEditor`
//     component, mounted by BOTH this flyout and the node-editor Inspector.
//     The flyout shows a read-only summary chip row (color swatch +
//     metalness % + roughness %) plus an expander that reveals the real
//     editor in place — no Inspector pop, no `openInspector('material')`
//     delegation. The editor routes writes through usePreviewStateStore
//     (FP-15), so canvas edits stage on the overlay (live ghost), commit on
//     Save, and re-realize on Build — exactly like the Inspector.
//   - LIGHTING: primitive meshes are lit by the hub's light rig out of the
//     box (receivesLighting defaults true for renderMode 'mesh'). The
//     per-node lit/unlit switch already lives in the Lighting group — this
//     flyout only points at it in copy, never builds a second toggle.
//
// Chrome: Observatory Brass (raised-bar directive) — machined KEY faces +
// recessed wells + engraved kicker labels reused from animation-tools/ui,
// GSAP open choreography, native magnetic hover on the shape keys
// (animation-tools/magnetic). Honors prefers-reduced-motion. The 7 shape
// glyphs are hand-drawn inline line-art outlines (24×24, stroke paths) — no
// stock icon libraries. Plain-language copy throughout (no machine ids, no
// spec citations).

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Icon } from '@/components/editor/icons/Icon';
import { DS, DS_ACCENT, dsAlpha } from '@/components/editor/design-system';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import MaterialEditor from '@/components/editor/shared-editors/MaterialEditor';
import { attachMagnetic } from '@/components/editor/animation-tools/magnetic';
import {
  KEY_BG,
  KEY_SHADOW,
  SectionLabel,
  WELL_BG,
  WELL_SHADOW,
} from '@/components/editor/animation-tools/ui';
import type { MeshPrimitiveKind, PrismHub, PrismNode } from '@/lib/prism-graph/types';
import { buildMeshPrimitiveNode } from './create-object-node';
import {
  MESH_KINDS,
  effectiveMeshParams,
  faderConfigsFor,
  isMeshBearingNode,
  isMeshPrimitiveNode,
  materialSummary,
  meshKindLabel,
  pctLabel,
  withMeshParamPatch,
  type MeshFaderConfig,
} from './object-helpers';

// Plain-language copy (constants keep apostrophes typographic and the strings
// greppable — no spec citations, no machine ids).
const NO_HUB_HINT = 'Open a hub on the canvas first — new shapes attach to it.';
const NO_SHAPE_SELECTED = 'Select a shape on the canvas (or add one above) to change its size.';
const NOT_A_SHAPE = "The selected element isn't a basic shape — its size lives in Transform.";
const MATERIAL_HINT =
  'Color, shine, glass and glow — edit them right here. Changes preview live; Save keeps them.';
const LIGHTING_NOTE =
  'Shapes catch the hub’s lights out of the box. To make one ignore them, use the Receives Light switch in the Lighting tools.';
const RESHAPE_HINT = 'Changes show on the canvas instantly.';

const fmt = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Native magnetic hover on a key face (reuses animation-tools/magnetic). */
function useMagnetic<T extends HTMLElement>(maxShift = 4, scale = 1.03) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    return attachMagnetic(el, { maxShift, scale });
  }, [maxShift, scale]);
  return ref;
}

// ── Hand-drawn primitive glyphs (line-art outlines, 24×24, stroke paths) ─────
// Simple milled-wireframe look: one outline + one or two construction lines
// per shape, all stroke (never fills) so they read as schematic line art next
// to the extruded Icon family without competing with it.
function PrimitiveGlyph({
  kind,
  size = 18,
  color,
}: {
  kind: MeshPrimitiveKind;
  size?: number;
  color: string;
}) {
  const shared = {
    fill: 'none',
    stroke: color,
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const faint = { ...shared, opacity: 0.45 };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {kind === 'cube' && (
        <>
          <path {...shared} d="M12 3 L20 7.5 L20 16.5 L12 21 L4 16.5 L4 7.5 Z" />
          <path {...faint} d="M4 7.5 L12 12 L20 7.5 M12 12 L12 21" />
        </>
      )}
      {kind === 'sphere' && (
        <>
          <circle {...shared} cx="12" cy="12" r="8" />
          <path {...faint} d="M4 12 A8 3.1 0 0 0 20 12" />
          <path {...faint} d="M4 12 A8 3.1 0 0 1 20 12" />
        </>
      )}
      {kind === 'plane' && (
        <>
          <path {...shared} d="M5 16.5 L9.5 7.5 L19 7.5 L14.5 16.5 Z" />
          <path {...faint} d="M7.25 12 L16.75 12" />
        </>
      )}
      {kind === 'cylinder' && (
        <>
          <ellipse {...shared} cx="12" cy="7" rx="7" ry="2.6" />
          <path {...shared} d="M5 7 L5 17 A7 2.6 0 0 0 19 17 L19 7" />
        </>
      )}
      {kind === 'cone' && (
        <>
          <path {...shared} d="M12 4 L19 17 A7 2.6 0 0 1 5 17 Z" />
          <path {...faint} d="M5 17 A7 2.6 0 0 1 19 17" />
        </>
      )}
      {kind === 'torus' && (
        <>
          <ellipse {...shared} cx="12" cy="12" rx="8.5" ry="5" />
          <ellipse {...faint} cx="12" cy="11.4" rx="3.4" ry="1.6" />
        </>
      )}
      {kind === 'capsule' && (
        <>
          <path {...shared} d="M8 8 A4 4 0 0 1 16 8 L16 16 A4 4 0 0 1 8 16 Z" />
          <path {...faint} d="M8 12 A4 1.5 0 0 0 16 12" />
        </>
      )}
    </svg>
  );
}

// ── Fader (same machined range pattern as the Lighting / Image flyouts) ──────
function FaderRow({
  label, value, onChange, min = 0, max = 1, step = 0.01, accent, testId, readout,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; accent?: string; testId?: string;
  readout?: string;
}) {
  const a = accent ?? DS_ACCENT;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[9.5px] font-mono" style={{ color: 'var(--ds-text-mid)' }}>{label}</span>
        <span
          className="text-[9.5px] font-mono tabular-nums px-1.5 py-0.5 rounded-ds-xs"
          style={{ color: a, background: WELL_BG, boxShadow: WELL_SHADOW }}
        >
          {readout ?? fmt(value)}
        </span>
      </div>
      <input
        type="range"
        data-control={testId}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="ds-slider w-full cursor-pointer"
      />
    </div>
  );
}

// ── Shape picker key (machined face + hand-drawn glyph + magnetic hover) ─────
function ShapeKey({
  kind,
  disabled,
  onAdd,
}: {
  kind: MeshPrimitiveKind;
  disabled: boolean;
  onAdd: (kind: MeshPrimitiveKind) => void;
}) {
  const ref = useMagnetic<HTMLButtonElement>(3, 1.04);
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      data-action={`object-add-${kind}`}
      onClick={() => onAdd(kind)}
      title={disabled ? NO_HUB_HINT : `Add a ${meshKindLabel(kind).toLowerCase()} to the scene`}
      className={`flex flex-col items-center justify-center gap-1 h-14 rounded-ds-sm ds-press transition-all ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'hover:brightness-[1.15]'
      }`}
      style={
        disabled
          ? { background: 'var(--ds-grad-ceramic)', boxShadow: 'var(--ds-chamfer-soft)' }
          : { background: KEY_BG, boxShadow: KEY_SHADOW }
      }
    >
      <PrimitiveGlyph kind={kind} color={disabled ? DS.textMid : DS.text} />
      <span
        className="text-[8.5px] font-mono tracking-wide"
        style={{ color: disabled ? 'var(--ds-text-low)' : 'var(--ds-text-mid)' }}
      >
        {meshKindLabel(kind)}
      </span>
    </button>
  );
}

export default function ObjectFlyout({
  node,
  hub,
  onToast,
}: {
  /** Currently selected node (or null). */
  node: PrismNode | null;
  /** Active hub resolution shared with the other wired groups (active hub →
   *  selected node's parent hub → first hub). New shapes tether here. */
  hub: PrismHub | null;
  onToast: (msg: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const materialRef = useMagnetic<HTMLButtonElement>(5, 1.03);
  // EDITOR-EXP C9 — the §11 Material editor is mounted INLINE here (shared with
  // the Inspector). This toggles the in-flyout expander; no Inspector pop.
  const [materialOpen, setMaterialOpen] = useState(false);
  // EDITOR-EXP C9 — frozen mirrors the Inspector's per-node freeze so the
  // canvas editor honours the same AI-cannot-edit gate.
  const frozen = useGraphEditorStore((s) =>
    node ? s.frozenNodeIds.has(node.nodeId) : false,
  );

  const hubName = hub?.title ?? 'this hub';
  const isPrimitive = isMeshPrimitiveNode(node);
  const isMesh = isMeshBearingNode(node);
  const selectionName = node
    ? node.intent?.caption?.split(' · ')[0] || node.subtype || 'selected element'
    : null;

  // Open choreography — staggered reveal with a spring ease (raised bar).
  // Transform/opacity only; skipped under prefers-reduced-motion.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;
    const els = root.querySelectorAll('[data-ob-reveal]');
    if (els.length === 0) return;
    const tween = gsap.fromTo(
      els,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.45, ease: 'back.out(1.6)', stagger: 0.05 },
    );
    return () => {
      tween.kill();
    };
  }, []);

  // ── Node creation (structural — source-store addNode is the sanctioned
  //    path; the builder is the frozen ./create-object-node seam) ─────────────
  const addObject = (kind: MeshPrimitiveKind) => {
    if (!hub) return;
    const id = useGraphSourceStore
      .getState()
      .addNode(buildMeshPrimitiveNode({ parentHubId: hub.hubId, kind }));
    useGraphEditorStore.getState().selectNode(id);
    onToast(`${meshKindLabel(kind)} added to ${hubName}`);
  };

  // ── Shape reshape (whole-object meshPrimitive replacement; live) ───────────
  const reshape = (cfg: MeshFaderConfig, v: number) => {
    if (!node?.meshPrimitive) return;
    useGraphSourceStore.getState().updateNode(node.nodeId, {
      meshPrimitive: withMeshParamPatch(node.meshPrimitive, { [cfg.param]: v }),
    });
  };

  // ── Material editing is INLINE (EDITOR-EXP C9) — the shared §11 editor is
  //    mounted in the expander below; this just toggles its visibility. The
  //    `openInspector('material')` delegation seam is cut.
  const toggleMaterial = () => {
    if (!node) return;
    setMaterialOpen((v) => !v);
  };

  const summary = materialSummary(node?.materialSpec);
  const prim = node?.meshPrimitive;
  const params = prim ? effectiveMeshParams(prim) : null;

  return (
    <div ref={rootRef} data-component="object-flyout" className="flex flex-col gap-2.5">
      {/* ── Add a shape — the 7-key primitive picker ───────────────────────── */}
      <div data-ob-reveal>
        <SectionLabel>Add a shape</SectionLabel>
        <div className="grid grid-cols-3 gap-1.5">
          {MESH_KINDS.map((kind) => (
            <ShapeKey key={kind} kind={kind} disabled={!hub} onAdd={addObject} />
          ))}
        </div>
        <div className="text-[8px] font-mono leading-tight mt-1.5" style={{ color: 'var(--ds-text-low)' }}>
          {hub
            ? `New shapes land in ${hubName}, ready to move and restyle.`
            : NO_HUB_HINT}
        </div>
      </div>

      {/* ── Shape — per-kind dimension faders on the selected primitive ────── */}
      <div data-ob-reveal>
        <SectionLabel>Shape</SectionLabel>
        {isPrimitive && node && prim && params ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-2.5 py-2 ds-well">
              <PrimitiveGlyph kind={prim.kind} size={14} color={DS_ACCENT} />
              <span className="flex-1 text-[10px] font-mono truncate" style={{ color: 'var(--ds-text)' }}>
                {selectionName}
              </span>
              <span className="text-[8.5px] font-mono" style={{ color: 'var(--ds-text-low)' }}>
                {meshKindLabel(prim.kind)}
              </span>
            </div>
            {faderConfigsFor(prim.kind).map((cfg) => (
              <FaderRow
                key={cfg.param}
                label={cfg.label}
                value={params[cfg.param]}
                min={cfg.min}
                max={cfg.max}
                step={cfg.step}
                accent={cfg.integer ? DS.ice300 : undefined}
                testId={`object-${cfg.param}`}
                readout={cfg.integer ? `${Math.round(params[cfg.param])}` : undefined}
                onChange={(v) => reshape(cfg, v)}
              />
            ))}
            <div className="text-[8px] font-mono leading-tight" style={{ color: 'var(--ds-text-low)' }}>
              {RESHAPE_HINT}
            </div>
          </div>
        ) : (
          <div className="text-[8.5px] font-mono leading-relaxed px-1" style={{ color: 'var(--ds-text-low)' }}>
            {node ? NOT_A_SHAPE : NO_SHAPE_SELECTED}
          </div>
        )}
      </div>

      {/* ── Material — read-only summary + jump to the real editor ─────────── */}
      <div data-ob-reveal>
        <SectionLabel>Material</SectionLabel>
        {isMesh && node ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              {/* Color swatch chip (scene data readout, not chrome paint). */}
              <span
                data-control="object-material-color"
                title="Base color"
                className="flex items-center gap-1.5 px-2 h-6 rounded-ds-xs"
                style={{ background: WELL_BG, boxShadow: WELL_SHADOW }}
              >
                <span
                  className="w-3 h-3 rounded-full"
                  style={{
                    background: summary.baseColor,
                    border: '1px solid rgba(255, 252, 242, 0.3)',
                    boxShadow: 'inset 0 1px 1px rgba(255, 252, 242, 0.3), 0 1px 2px rgba(0, 0, 0, 0.5)',
                  }}
                />
                <span className="text-[8.5px] font-mono" style={{ color: 'var(--ds-text-mid)' }}>Color</span>
              </span>
              <span
                data-control="object-material-metalness"
                title="How metallic the surface is"
                className="px-2 h-6 rounded-ds-xs flex items-center text-[8.5px] font-mono tabular-nums"
                style={{ background: WELL_BG, boxShadow: WELL_SHADOW, color: 'var(--ds-text-mid)' }}
              >
                Metal {pctLabel(summary.metalness)}
              </span>
              <span
                data-control="object-material-roughness"
                title="How matte vs polished the surface is"
                className="px-2 h-6 rounded-ds-xs flex items-center text-[8.5px] font-mono tabular-nums"
                style={{ background: WELL_BG, boxShadow: WELL_SHADOW, color: 'var(--ds-text-mid)' }}
              >
                Matte {pctLabel(summary.roughness)}
              </span>
            </div>
            <button
              ref={materialRef}
              type="button"
              data-action="object-open-material"
              aria-expanded={materialOpen}
              onClick={toggleMaterial}
              className="w-full h-9 rounded-ds-sm flex items-center justify-center gap-2 ds-press hover:brightness-[1.12] transition-all"
              style={{
                background: `linear-gradient(178deg, ${dsAlpha(DS_ACCENT, 0.2)}, ${dsAlpha(DS_ACCENT, 0.06)}), ${KEY_BG}`,
                boxShadow: `inset 0 0 0 1px ${dsAlpha(DS_ACCENT, 0.4)}, ${KEY_SHADOW}, 0 0 14px ${dsAlpha(DS_ACCENT, 0.14)}`,
              }}
            >
              <Icon name="palette" size={13} color={DS.brass200} glow />
              <span className="text-[10.5px] font-mono font-semibold" style={{ color: 'var(--ds-brass-200)' }}>
                {materialOpen ? 'Hide Material' : 'Edit Material'}
              </span>
              <Icon name="chevron" size={11} color={DS.brass200} className={materialOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            <div className="text-[8px] font-mono leading-tight" style={{ color: 'var(--ds-text-low)' }}>
              {MATERIAL_HINT}
            </div>
            {/* EDITOR-EXP C9 — the SHARED §11 material editor, mounted inline.
                Writes route through usePreviewStateStore (FP-15), so canvas
                edits stage on the overlay (live ghost), commit on Save, and
                re-realize on Build — identical to the Inspector's Material
                tab. The editor brings its own slab-hosted ceramic chrome. */}
            {materialOpen && (
              <div data-component="object-material-editor" className="pt-1">
                <MaterialEditor node={node} frozen={frozen} compact />
              </div>
            )}
          </div>
        ) : (
          <div className="text-[8.5px] font-mono leading-relaxed px-1" style={{ color: 'var(--ds-text-low)' }}>
            Select a 3D shape to see its surface — color, shine and glass live
            in the Material tab.
          </div>
        )}
      </div>

      {/* ── Lighting note (the lit/unlit switch lives in the Lighting group) ── */}
      {isMesh && node && (
        <div
          data-ob-reveal
          data-control="object-lighting-note"
          className="px-2.5 py-2 rounded-ds-sm flex items-start gap-2"
          style={{
            background: dsAlpha(DS.ice400, 0.1),
            boxShadow: `inset 0 0 0 1px ${dsAlpha(DS.ice400, 0.28)}, var(--ds-chamfer-soft)`,
          }}
        >
          <Icon name="bulb" size={12} color={DS.ice300} glow />
          <span className="text-[8.5px] font-mono leading-relaxed" style={{ color: 'var(--ds-text)' }}>
            {LIGHTING_NOTE}
          </span>
        </div>
      )}
    </div>
  );
}
