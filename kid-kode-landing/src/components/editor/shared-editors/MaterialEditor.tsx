'use client';

// ═══════════════════════════════════════════════════════════════════
// MATERIAL EDITOR — SHARED schema-driven MeshPhysicalNodeMaterial editor
// (canvas-spec §11 Material).
//
// EDITOR-EXP C9 (architecture inversion fix): this editor was previously
// trapped in the node-editor Inspector (`panels/MaterialTab.tsx`, sole
// importer = Inspector.tsx), and the CanvasToolbar object flyout DELEGATED
// material editing back to the Inspector via `openInspector('material')`.
// It now lives in `shared-editors/` and is mounted INLINE by BOTH:
//   (a) the CanvasToolbar object flyout (ObjectFlyout) — canvas editing, and
//   (b) the node-editor Inspector (via the `panels/MaterialTab.tsx`
//       re-export shim).
// No Inspector pop is needed to recolor/re-material a node on the canvas.
//
// FP-15 — every edit routes through the ephemeral per-node preview buffer
// (usePreviewStateStore.set); the renderer reads sourceNode ⊕ preview
// overlay for live update. Save (commitPreviewToSource) commits the buffer
// → source store; Save-and-Rebuild (rebuildNode) re-realizes the artifact.
// This file never calls useGraphSourceStore.updateNode directly.
//
// Chrome: Chrome-Arc — the instrument plates render as real fired
// ceramic slabs at t2 (useChromeSlab), with the ds-ceramic CSS as the
// t0/t1 fallback (INV-9). No flat fills, no backdrop-filter.
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react';
import type { Control } from '@/lib/prism/animatable/contract';
import {
  MATERIAL_CONTROL_SCHEMA,
  materialSpecToParams,
  paramsToMaterialSpec,
} from '@/lib/prism/runtime/shared/material-system';
import type { PrismNode } from '@/lib/prism-graph/types';
import { receivesLightingDefault } from '@/lib/prism-graph/types';
import { usePreviewStateStore } from '@/stores/usePreviewStateStore';
import { useChromeSlab } from '@/components/editor/chrome-layer';

export default function MaterialEditor({
  node,
  frozen,
  /** Optional compactness flag — the canvas flyout mounts a tighter pad than
   *  the Inspector tab. Layout only; the write contract is identical. */
  compact = false,
}: {
  node: PrismNode | null;
  frozen: boolean;
  compact?: boolean;
}) {
  // Force a re-read of the seeded params after each control write so the
  // numeric read-out tracks the preview buffer.
  const [, bump] = useState(0);

  // UI-FIDELITY-2 — the instrument plates render as real fired ceramic at t2
  // (hooks before the early return — hooks rule; the slab layer SDF-clips
  // them to the host's scrolling region).
  const plateSlab = useChromeSlab({ material: 'ceramic', radius: 18 });
  const lightingSlab = useChromeSlab({ material: 'ceramic', radius: 13 });

  if (!node) {
    return (
      <div className={compact ? 'space-y-3' : 'p-5 space-y-4'}>
        <div className="ds-ceramic ds-edge rounded-ds-lg p-4 text-[11px] text-ds-text-mid">
          No source node available for this selection.
        </div>
      </div>
    );
  }

  // Seed from source ⊕ preview overlay so the panel reflects in-flight edits.
  const previewPatch = usePreviewStateStore.getState().peek(node.nodeId);
  const effectiveSpec = previewPatch?.materialSpec ?? node.materialSpec;
  const params = materialSpecToParams(effectiveSpec);

  const effectiveReceivesLighting =
    previewPatch?.receivesLighting ??
    node.receivesLighting ??
    receivesLightingDefault(node.renderMode);

  // EBR2-E-02 / §R2-E SC-072 + FP-15 — every write lands on the preview
  // buffer. Build the patched spec from the merged params then store it
  // whole (whole-field replacement, matching usePreviewStateStore's
  // shallow-merge contract).
  const writeControl = (id: string, value: number | string) => {
    if (frozen) return;
    const nextParams = { ...params, [id]: value };
    const patchedSpec = paramsToMaterialSpec(nextParams);
    usePreviewStateStore.getState().set(node.nodeId, { materialSpec: patchedSpec });
    bump((n) => n + 1);
  };

  const writeReceivesLighting = (next: boolean) => {
    if (frozen) return;
    usePreviewStateStore.getState().set(node.nodeId, { receivesLighting: next });
    bump((n) => n + 1);
  };

  return (
    <div className={compact ? 'space-y-3' : 'p-5 space-y-4'}>
      <div className="ds-label text-ds-metal-300">
        PHYSICAL MATERIAL
      </div>

      {/* Ceramic instrument plate — engraved labels, machined ds-slider
          grooves, brass tabular readouts. */}
      <div ref={plateSlab.ref} className="p-4 ds-ceramic ds-edge rounded-ds-lg flex flex-col gap-3">
        {MATERIAL_CONTROL_SCHEMA.map((c: Control) => {
          const val = params[c.id];
          return (
            <label
              key={c.id}
              className="flex flex-col gap-1 text-[11px] text-ds-text"
            >
              <span className="flex items-center justify-between">
                <span>{c.label}</span>
                <span className="font-mono tabular-nums text-ds-metal-300">
                  {typeof val === 'number' ? val.toFixed(2) : String(val)}
                  {('unit' in c && c.unit) || ''}
                </span>
              </span>
              {(c.type === 'knob' || c.type === 'fader') && (
                <input
                  type="range"
                  data-control={c.id}
                  min={c.min}
                  max={c.max}
                  step={c.step ?? (c.max - c.min) / 100}
                  value={typeof val === 'number' ? val : c.default}
                  disabled={frozen}
                  onChange={(e) => writeControl(c.id, parseFloat(e.target.value))}
                  className="ds-slider w-full disabled:opacity-40"
                />
              )}
              {c.type === 'color' && (
                <span className="ds-well inline-flex self-start rounded-ds-xs p-[3px]">
                  <input
                    type="color"
                    data-control={c.id}
                    value={typeof val === 'string' ? val : c.default}
                    disabled={frozen}
                    onChange={(e) => writeControl(c.id, e.target.value)}
                    className="disabled:opacity-40 h-6 w-10 cursor-pointer rounded-[4px]"
                  />
                </span>
              )}
            </label>
          );
        })}
      </div>

      {/* §10 Lighting — receivesLighting opt-in. Image planes default UNLIT
          (preserve the diffusion-baked look); mesh defaults LIT. The toggle
          writes to the same preview buffer as the material controls. */}
      <div className="ds-label text-ds-metal-300 pt-1">
        LIGHTING
      </div>
      <label ref={lightingSlab.ref} className="px-3 py-2.5 ds-ceramic ds-edge rounded-ds-md flex items-center justify-between cursor-pointer">
        <div className="flex flex-col">
          <span className="text-[11px] text-ds-text-hi">Receives Lighting</span>
          <span className="ds-kicker mt-0.5 normal-case tracking-normal">
            {`renderMode: ${node.renderMode ?? 'sprite'} · default ${
              receivesLightingDefault(node.renderMode) ? 'lit' : 'unlit'
            }`}
          </span>
        </div>
        <input
          type="checkbox"
          data-control="receivesLighting"
          checked={effectiveReceivesLighting}
          disabled={frozen}
          onChange={(e) => writeReceivesLighting(e.target.checked)}
          className="ds-toggle disabled:opacity-40"
        />
      </label>
    </div>
  );
}
