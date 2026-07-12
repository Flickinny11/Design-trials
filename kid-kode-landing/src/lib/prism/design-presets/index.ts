// W-VIS D3 — design-preset registries + the director/generator contract.
//
// Contract change (D3 item 8): the design director emits preset SELECTIONS
// (+ optional numeric overrides); the generation prompt then carries the
// preset's EXACT numbers via buildPresetSelectionPromptBlock. Freeform
// lighting/camera numbers remain a fallback when no selection is present —
// never the default for visual nodes.

import { LIGHT_RIGS, getLightRig } from './light-rigs';
import { CAMERA_FRAMINGS, getCameraFraming } from './camera-framings';
import { COMPOSITION_LAYOUTS, getCompositionLayout } from './composition-layouts';
import type {
  LightRigPreset, CameraFramingPreset, CompositionLayoutPreset,
  PrismPresetSelections, PresetMood,
} from './types';

export * from './types';
export { LIGHT_RIGS, getLightRig } from './light-rigs';
export { CAMERA_FRAMINGS, getCameraFraming } from './camera-framings';
export { COMPOSITION_LAYOUTS, getCompositionLayout } from './composition-layouts';

export interface ResolvedPresets {
  lightRig?: LightRigPreset;
  cameraFraming?: CameraFramingPreset;
  compositionLayout?: CompositionLayoutPreset;
  overrides?: Record<string, unknown>;
  /** Selection ids that matched no catalog entry (surfaced, never silent). */
  unknownIds: string[];
}

export function resolvePresetSelections(sel: PrismPresetSelections | undefined | null): ResolvedPresets {
  const unknownIds: string[] = [];
  const out: ResolvedPresets = { unknownIds, overrides: sel?.overrides };
  if (sel?.lightRig) {
    out.lightRig = getLightRig(sel.lightRig);
    if (!out.lightRig) unknownIds.push(sel.lightRig);
  }
  if (sel?.cameraFraming) {
    out.cameraFraming = getCameraFraming(sel.cameraFraming);
    if (!out.cameraFraming) unknownIds.push(sel.cameraFraming);
  }
  if (sel?.compositionLayout) {
    out.compositionLayout = getCompositionLayout(sel.compositionLayout);
    if (!out.compositionLayout) unknownIds.push(sel.compositionLayout);
  }
  return out;
}

/** Compact catalog digest the DIRECTOR reads when selecting (ids + moods +
 *  intent only — numbers stay out of the director's context). */
export function buildPresetCatalogDigest(): string {
  const lines: string[] = ['DESIGN PRESET CATALOG (select by id):', '', 'LIGHT RIGS:'];
  for (const r of LIGHT_RIGS) lines.push(`- ${r.id} [${r.moods.join(',')}] — ${r.intent}`);
  lines.push('', 'CAMERA FRAMINGS:');
  for (const c of CAMERA_FRAMINGS) lines.push(`- ${c.id} [${c.moods.join(',')}] — ${c.intent}`);
  lines.push('', 'COMPOSITION LAYOUTS:');
  for (const l of COMPOSITION_LAYOUTS) lines.push(`- ${l.id} [${l.span}] [${l.moods.join(',')}] — ${l.intent}`);
  return lines.join('\n');
}

/** The numeric block the GENERATOR receives for a selection — exact preset
 *  numbers inlined so lighting/camera/composition are executed, not invented. */
export function buildPresetSelectionPromptBlock(sel: PrismPresetSelections | undefined | null): string {
  const resolved = resolvePresetSelections(sel);
  const parts: string[] = [];
  if (resolved.lightRig) {
    const r = resolved.lightRig;
    parts.push(
      `LIGHT RIG (preset ${r.id} — ${r.name}): build EXACTLY these lights (positions are subject-relative,`,
      `multiply by your subject's bounding radius; ambient floor ${r.ambientFloor}):`,
      ...r.lights.map((l) => `- ${l.role}: ${l.type} color ${l.color} intensity ${l.intensity}` +
        (l.position ? ` at [${l.position.join(', ')}]` : '') +
        (l.target ? ` aimed at [${l.target.join(', ')}]` : '') +
        (l.angle != null ? ` angle ${l.angle}` : '') +
        (l.penumbra != null ? ` penumbra ${l.penumbra}` : '') +
        (l.distance != null ? ` distance ${l.distance}` : '') +
        (l.decay != null ? ` decay ${l.decay}` : '')),
    );
  }
  if (resolved.cameraFraming) {
    const c = resolved.cameraFraming;
    parts.push(
      `CAMERA FRAMING (preset ${c.id} — ${c.name}): fov ${c.fov}°, position [${c.position.join(', ')}]`,
      `(subject-relative), lookAt [${c.lookAt.join(', ')}]. The subject must occupy ~${Math.round(c.subjectHeightFraction * 100)}% of frame height.`,
    );
  }
  if (resolved.compositionLayout) {
    const l = resolved.compositionLayout;
    parts.push(
      `COMPOSITION LAYOUT (preset ${l.id} — ${l.name}, ${l.span}): place elements at these normalized`,
      `frame rects [x, y, w, h] (origin top-left); the FOCAL element is "${l.focalRole}" — it gets the brightest read:`,
      ...l.regions.map((rg) => `- ${rg.role}: [${rg.rect.join(', ')}]` +
        (rg.depth != null ? ` depth ${rg.depth}` : '') + (rg.note ? ` — ${rg.note}` : '')),
    );
  }
  if (resolved.unknownIds.length) {
    parts.push(`(unknown preset ids ignored: ${resolved.unknownIds.join(', ')})`);
  }
  if (resolved.overrides && Object.keys(resolved.overrides).length) {
    parts.push(`DIRECTOR OVERRIDES (apply after the preset numbers): ${JSON.stringify(resolved.overrides)}`);
  }
  return parts.join('\n');
}

/** Deterministic fallback selection by mood keywords — used when no director
 *  selection exists. Prefers coverage of the doctrine trio over cleverness. */
export function selectPresetsByMood(moods: PresetMood[], is3d: boolean): PrismPresetSelections {
  const score = (presetMoods: readonly PresetMood[]) => presetMoods.filter((m) => moods.includes(m)).length;
  const rig = [...LIGHT_RIGS].sort((a, b) => score(b.moods) - score(a.moods))[0];
  const cam = [...CAMERA_FRAMINGS].sort((a, b) => score(b.moods) - score(a.moods))[0];
  const layouts = COMPOSITION_LAYOUTS.filter((l) => l.span === 'both' || l.span === (is3d ? '3d' : '2d'));
  const layout = [...layouts].sort((a, b) => score(b.moods) - score(a.moods))[0];
  return { lightRig: rig?.id, cameraFraming: cam?.id, compositionLayout: layout?.id };
}

export const PRESET_COUNTS = {
  lightRigs: LIGHT_RIGS.length,
  cameraFramings: CAMERA_FRAMINGS.length,
  compositionLayouts: COMPOSITION_LAYOUTS.length,
} as const;
