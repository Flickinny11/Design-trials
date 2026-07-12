// W-VIS D4 — reference-frame conditioning. Per visual node, a composition
// frame (existing FLUX pipeline — .assetgen Replicate FLUX-2-pro plate client,
// the W-BG/OD10 path) rides the generation call for multimodal models;
// text-only models receive a STRUCTURED FRAME DESCRIPTION fallback derived
// from the same spec, and the flight recorder labels which arm ran
// (`prism.design.reference_frame`: 'image' | 'text-fallback' | 'none').
//
// This module owns the prompt sides: the FLUX prompt that produces the frame
// and the deterministic text fallback. Frame EXECUTION (calling FLUX, caching
// the image) stays in the lane harness / background-generate route — this
// module never touches keys (INV-19).

import type { PrismNode } from '@/lib/prism-graph/types';
import { resolvePresetSelections } from '@/lib/prism/design-presets';

export type ReferenceFrameArm = 'image' | 'text-fallback' | 'none';

/** FLUX prompt for a node's composition frame: palette + composition +
 *  subject, no text (letterforms never come from diffusion — INV-11). */
export function buildCompositionFramePrompt(node: PrismNode): string {
  const vs = (node.intent?.visualSpec ?? {}) as Record<string, unknown>;
  const colors = (vs.colors ?? {}) as Record<string, string>;
  const sel = resolvePresetSelections(node.intent?.visualSpec?.presetSelections);
  const parts: string[] = [];
  parts.push(`Cinematic composition reference for: ${node.intent?.caption ?? node.subtype ?? 'visual node'}.`);
  if (colors.background) parts.push(`Deep ${colors.background} stage`);
  if (colors.accent) parts.push(`single ${colors.accent} signal accent`);
  if (typeof vs.effects === 'string' && vs.effects) parts.push(String(vs.effects).slice(0, 200));
  if (sel.lightRig) parts.push(`lighting: ${sel.lightRig.intent}`);
  if (sel.cameraFraming) parts.push(`camera: ${sel.cameraFraming.intent}`);
  if (sel.compositionLayout) parts.push(`layout: ${sel.compositionLayout.intent}`);
  parts.push('dark-first, engineered precision, rendered materiality, rich atmospheric depth');
  parts.push('no text, no letters, no labels, no watermarks');
  return parts.join('. ');
}

/** Deterministic structured description of the intended composition — the
 *  text-only conditioning arm. Derived from the same spec fields the image
 *  arm renders, so both arms condition on the same intent. */
export function buildFrameDescriptionFallback(node: PrismNode): string {
  const vs = (node.intent?.visualSpec ?? {}) as Record<string, unknown>;
  const colors = (vs.colors ?? {}) as Record<string, unknown>;
  const sel = resolvePresetSelections(node.intent?.visualSpec?.presetSelections);
  const lines: string[] = ['REFERENCE COMPOSITION (structured description — no image available on this channel):'];
  lines.push(`- Stage: background ${colors.background ?? '#0b0b10'}, surfaces ${colors.surface ?? 'dark ink'}, graded depth — never a flat void.`);
  if (colors.accent) lines.push(`- Signal: exactly one ${colors.accent} accent element; everything else stays in the ink/paper range.`);
  if (sel.compositionLayout) {
    lines.push(`- Layout (${sel.compositionLayout.name}): ${sel.compositionLayout.intent}`);
    for (const rg of sel.compositionLayout.regions) {
      lines.push(`  - ${rg.role} occupies frame rect [${rg.rect.join(', ')}]${rg.depth != null ? ` at depth ${rg.depth}` : ''}${rg.note ? ` — ${rg.note}` : ''}`);
    }
    lines.push(`  - Focal element: ${sel.compositionLayout.focalRole} (the single brightest read).`);
  }
  if (sel.cameraFraming) lines.push(`- Camera (${sel.cameraFraming.name}): fov ${sel.cameraFraming.fov}, position [${sel.cameraFraming.position.join(', ')}], subject ~${Math.round(sel.cameraFraming.subjectHeightFraction * 100)}% of frame height.`);
  if (sel.lightRig) lines.push(`- Light (${sel.lightRig.name}): ${sel.lightRig.intent}`);
  if (typeof vs.effects === 'string' && vs.effects) lines.push(`- Effects: ${String(vs.effects).slice(0, 220)}`);
  return lines.join('\n');
}

/** The generation-prompt block for whichever arm is live. `framePathNote` is
 *  a human-readable pointer (the actual image bytes ride the message content
 *  as an image part on multimodal routes). */
export function buildReferenceFrameBlock(arm: ReferenceFrameArm, node: PrismNode): string {
  if (arm === 'image') {
    return [
      'REFERENCE COMPOSITION FRAME: the attached image is the art-directed composition',
      'reference for this node — match its framing, palette weighting, lighting mood, and',
      'focal hierarchy. It is a REFERENCE, not a texture: build the scene with real geometry,',
      'lights, and materials. Never bake text from the image (INV-11).',
    ].join('\n');
  }
  if (arm === 'text-fallback') return buildFrameDescriptionFallback(node);
  return '';
}

/** Critic-side addendum: score render-vs-frame fidelity alongside the DL
 *  rubric (D4 item 10). Appended to the judge prompt when a reference frame
 *  exists for the case. */
export const FRAME_FIDELITY_RUBRIC_ADDENDUM = [
  'REFERENCE-FRAME FIDELITY: for frames that list a REFERENCE image, additionally score',
  '"frameFidelity" 0-100 — how faithfully the RENDER realizes the reference composition',
  '(framing, palette weighting, lighting mood, focal hierarchy). This is a separate axis',
  'from the DL score: a beautiful render that ignores its reference scores high on DL and',
  'low on frameFidelity. Add "frameFidelity" to each such frame object.',
].join('\n');
