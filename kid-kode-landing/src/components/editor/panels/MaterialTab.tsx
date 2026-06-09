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

  if (!node) {
    return (
      <div className="p-5 space-y-4">
        <div className="rounded-xl border border-white/10 p-4 text-[11px] text-white/50">
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
      <div className="text-[9px] font-mono tracking-widest text-white/40">
        PHYSICAL MATERIAL
      </div>

      <div className="p-4 rounded-xl bg-white/[0.025] border border-white/5 flex flex-col gap-3">
        {MATERIAL_CONTROL_SCHEMA.map((c: Control) => {
          const val = params[c.id];
          return (
            <label
              key={c.id}
              className="flex flex-col gap-1 text-[11px] text-white/70"
            >
              <span className="flex items-center justify-between">
                <span>{c.label}</span>
                <span className="text-white/40 tabular-nums">
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
                  className="w-full disabled:opacity-40"
                />
              )}
              {c.type === 'color' && (
                <input
                  type="color"
                  data-control={c.id}
                  value={typeof val === 'string' ? val : c.default}
                  disabled={frozen}
                  onChange={(e) => writeControl(c.id, e.target.value)}
                  className="disabled:opacity-40"
                />
              )}
            </label>
          );
        })}
      </div>

      {/* §10 Lighting — receivesLighting opt-in. Image planes default UNLIT
          (preserve the diffusion-baked look); mesh defaults LIT. The toggle
          writes to the same preview buffer as the material controls. */}
      <div className="text-[9px] font-mono tracking-widest text-white/40 pt-1">
        LIGHTING
      </div>
      <label className="px-3 py-2.5 rounded-lg bg-white/[0.025] border border-white/5 flex items-center justify-between cursor-pointer">
        <div className="flex flex-col">
          <span className="text-[11px] text-white/85">Receives Lighting</span>
          <span className="text-[9px] font-mono text-white/40 mt-0.5">
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
          className="disabled:opacity-40"
        />
      </label>
    </div>
  );
}
