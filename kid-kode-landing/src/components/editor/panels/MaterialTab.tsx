'use client';

// ═══════════════════════════════════════════════════════════════════
// MATERIAL TAB — schema-driven MeshPhysicalNodeMaterial editor
// (canvas-spec §11 Material). Renders the MATERIAL_CONTROL_SCHEMA from
// the frozen material-system contract using the SAME widget vocabulary
// as the animation catalog's ControlPanel (INV-5: one renderer for all
// knobs/faders/colors).
//
// FP-15 — this file matches **/panels/*Tab.tsx, so it MUST NOT call
// useGraphSourceStore.updateNode. Every edit routes through the
// ephemeral per-node preview buffer (usePreviewStateStore.set); the
// renderer reads sourceNode ⊕ preview overlay for live update. The
// Inspector's existing Save / Save-and-Rebuild buttons commit the
// buffer → source store via commitPreviewToSource.
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

export default function MaterialTab({
  node,
  frozen,
}: {
  node: PrismNode | null;
  frozen: boolean;
}) {
  // Force a re-read of the seeded params after each control write so the
  // numeric read-out tracks the preview buffer.
  const [, bump] = useState(0);

  // UI-FIDELITY-2 — the instrument plates render as real fired ceramic at t2
  // (hooks before the early return — hooks rule; the slab layer SDF-clips
  // them to the Inspector's scrolling tab region).
  const plateSlab = useChromeSlab({ material: 'ceramic', radius: 18 });
  const lightingSlab = useChromeSlab({ material: 'ceramic', radius: 13 });

  if (!node) {
    return (
      <div className="p-5 space-y-4">
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
    <div className="p-5 space-y-4">
      <div className="ds-label text-ds-brass-300">
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
                <span className="font-mono tabular-nums text-ds-brass-300">
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
      <div className="ds-label text-ds-brass-300 pt-1">
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
