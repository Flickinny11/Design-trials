// P1 TEXT SYSTEM (Task B) — pure helpers for the Text toolbar group
// (canvas-spec §5 Text tools, §7.2-7.5).
//
// Everything here is DOM-free and side-effect-free so it unit-tests in
// vitest's node env (tests/text/text-tools-helpers.test.ts). The React
// surfaces (TextToolsFlyout + subcomponents) consume these.
//
// COLOR DATA NOTE — the hex values in TEXT_PRESETS / coerceFill defaults are
// SCENE DATA written into `node.textSpec` and consumed by the renderer (the
// same sanctioned-hex exception as LIGHT_COLOR_DEFAULT in CanvasToolbar.tsx).
// They are physical fill pigments, not UI chrome — chrome styling stays
// 100% design-system tokens. No purple anywhere (DS invariant).

import { TEXT_SPEC_DEFAULT } from '@/lib/prism-graph/types';
import type { TextFill, TextSpec } from '@/lib/prism-graph/types';
import type { FontManifestEntry } from '@/lib/prism/text/contract';

// ── Spec resolution ─────────────────────────────────────────────────────────

/** Display-resolved spec: defaults ⊕ (preview ?? source). The preview buffer
 *  wholesale-replaces the source sub-object (matching MaterialTab's
 *  `previewPatch?.materialSpec ?? node.materialSpec` read and the
 *  whole-field-replacement contract of usePreviewStateStore). */
export function effectiveTextSpec(
  source?: TextSpec,
  preview?: TextSpec,
): TextSpec {
  return { ...TEXT_SPEC_DEFAULT, ...(preview ?? source ?? {}) };
}

/** The raw base the next preview write should merge onto (unexpanded — unset
 *  fields stay unset so downstream defaulting keeps working). */
export function rawTextSpec(source?: TextSpec, preview?: TextSpec): TextSpec {
  return { ...(preview ?? source ?? {}) };
}

// ── Fill-kind switching (carries pigment across kinds where sensible) ───────

export function coerceFill(
  kind: TextFill['kind'],
  prev?: TextFill,
): TextFill {
  switch (kind) {
    case 'solid':
      return {
        kind: 'solid',
        color:
          prev?.kind === 'solid'
            ? prev.color
            : prev?.kind === 'gradient'
              ? prev.from
              : '#e8e4da',
      };
    case 'gradient':
      return {
        kind: 'gradient',
        from:
          prev?.kind === 'gradient'
            ? prev.from
            : prev?.kind === 'solid'
              ? prev.color
              : '#f4d58a',
        to: prev?.kind === 'gradient' ? prev.to : '#3fa7c4',
        angleDeg: prev?.kind === 'gradient' ? (prev.angleDeg ?? 0) : 0,
      };
    case 'texture':
      return {
        kind: 'texture',
        url:
          prev?.kind === 'texture'
            ? prev.url
            : prev?.kind === 'ai-texture' && prev.url
              ? prev.url
              : '',
      };
    case 'ai-texture':
      return {
        kind: 'ai-texture',
        prompt: prev?.kind === 'ai-texture' ? prev.prompt : '',
        ...(prev?.kind === 'ai-texture' && prev.url ? { url: prev.url } : {}),
      };
  }
}

// ── Font search (manifest is ~1,900 families — cap the rendered window) ─────

export interface FontFilterResult {
  entries: FontManifestEntry[];
  total: number;
}

/** Case-insensitive substring filter over family + category. Empty query
 *  surfaces core families first (they render instantly — pre-baked atlases),
 *  then the manifest order. Capped for render performance. */
export function filterFonts(
  fonts: FontManifestEntry[],
  query: string,
  cap = 80,
): FontFilterResult {
  const q = query.trim().toLowerCase();
  let matched: FontManifestEntry[];
  if (q.length === 0) {
    const core = fonts.filter((f) => f.core);
    const rest = fonts.filter((f) => !f.core);
    matched = [...core, ...rest];
  } else {
    matched = fonts.filter(
      (f) =>
        f.family.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q),
    );
  }
  return { entries: matched.slice(0, cap), total: matched.length };
}

/** Weights available for a family per the manifest (fallback 400). */
export function weightsFor(
  fonts: FontManifestEntry[] | null,
  family: string,
): number[] {
  const entry = fonts?.find((f) => f.family === family);
  return entry && entry.weights.length > 0 ? entry.weights : [400];
}

/** Clamp a desired weight to a family's available set: keep it when present,
 *  else 400 when present, else the family's first listed weight. */
export function clampWeight(available: number[], desired: number): number {
  if (available.includes(desired)) return desired;
  if (available.includes(400)) return 400;
  return available[0] ?? 400;
}

// ── Presets (canvas-spec §7.5 — P1 ships a modest chip row; the full
//    hover-play preset gallery is backlog) ──────────────────────────────────

export interface TextPreset {
  id: string;
  label: string;
  /** Merged ONTO the node's current textSpec (content is never touched). */
  spec: Partial<TextSpec>;
}

export const TEXT_PRESETS: TextPreset[] = [
  {
    id: 'display-brass',
    label: 'Display / Brass',
    spec: {
      fontFamily: 'Bebas Neue',
      fontWeight: 400,
      fontSize: 0.6,
      letterSpacing: 0.04,
      fill: { kind: 'gradient', from: '#f4d58a', to: '#9a6b1f', angleDeg: 90 },
      decompose: 'glyph',
    },
  },
  {
    id: 'mono-terminal',
    label: 'Mono / Terminal',
    spec: {
      fontFamily: 'JetBrains Mono',
      fontWeight: 400,
      fontSize: 0.3,
      letterSpacing: 0.08,
      fill: { kind: 'solid', color: '#7dffb0' },
      glow: { color: '#34d27b', intensity: 1.2 },
    },
  },
  {
    id: 'serif-editorial',
    label: 'Serif / Editorial',
    spec: {
      fontFamily: 'Playfair Display',
      fontWeight: 400,
      fontSize: 0.45,
      lineHeight: 1.25,
      letterSpacing: 0,
      fill: { kind: 'solid', color: '#efe9dc' },
    },
  },
  {
    id: 'gradient-sunrise',
    label: 'Gradient / Sunrise',
    spec: {
      fontFamily: 'Space Grotesk',
      fontWeight: 400,
      fill: { kind: 'gradient', from: '#ffd07a', to: '#ff5e62', angleDeg: 75 },
    },
  },
  {
    id: 'outline-wire',
    label: 'Outline / Wire',
    spec: {
      fontFamily: 'Inter',
      fontWeight: 400,
      fill: { kind: 'solid', color: '#0c0d12' },
      outline: { color: '#e8e4da', width: 0.35 },
    },
  },
  {
    id: 'glow-neon',
    label: 'Glow / Neon',
    spec: {
      fontFamily: 'Inter',
      fontWeight: 400,
      fill: { kind: 'solid', color: '#bffcff' },
      glow: { color: '#27e9f6', intensity: 2.2 },
    },
  },
  {
    id: 'shadow-poster',
    label: 'Shadow / Poster',
    spec: {
      fontFamily: 'Lora',
      fontWeight: 400,
      fontSize: 0.5,
      fill: { kind: 'solid', color: '#f3ead1' },
      shadow: { color: '#000000', offsetX: 0.05, offsetY: -0.05, opacity: 0.6 },
    },
  },
];

/** Merge a preset onto the node's current (raw) spec. Shallow by design:
 *  fill/outline/glow/shadow sub-objects the preset carries replace wholesale;
 *  fields it omits (content!) survive. */
export function applyPreset(
  current: TextSpec | undefined,
  preset: TextPreset,
): TextSpec {
  return { ...(current ?? {}), ...preset.spec };
}
