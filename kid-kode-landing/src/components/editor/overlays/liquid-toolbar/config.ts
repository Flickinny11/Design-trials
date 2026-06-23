// LIQUID-GLASS TOOLBAR — shared layout + palette config.
//
// TOOLBAR REDESIGN (2026-06-22, CHROME 1): the canvas-editor toolbar is now a
// photoreal 3D LIQUID-GLASS object (an isolated R3F WebGL canvas, the proven
// Glb3DPreview pattern — it deliberately does NOT touch the unified three/webgpu
// graph scene). The brushed-metal DOM dock is retained ONLY for compact/mobile.
//
// This module holds the pure constants both the scene and the React entry share,
// so there is one source of truth for the bar's world dimensions and the per-tool
// accent palette (every icon is its own bespoke color — DESIGN LAW B.1).

/** Minimal structural view of a tool group the 3D toolbar needs. CanvasToolbar's
 *  ToolGroupMeta is structurally assignable to this. */
export interface LiquidToolGroup {
  id: string;
  icon: string;
  label: string;
  wired: boolean;
}

// ── World layout (units; the orthographic camera fits the bar to the canvas) ──
export const SLOT = 1.0; // vertical world height per button slot
export const PAD_Y = 0.62; // top/bottom padding inside the bar
export const BAR_W = 1.7; // bar width (world units)
export const BAR_D = 1.15; // bar depth (front↔back) — the volumetric body
export const TOKEN_R = 0.37; // button token radius
export const TOKEN_D = 0.18; // button token depth
export const FRONT_Z = BAR_D / 2; // z of the glass front face

/** Total bar height in world units for `n` buttons. */
export function barHeight(n: number): number {
  return n * SLOT + PAD_Y * 2;
}

/** World-Y of button `i` (0 = top), top-anchored inside a bar of `n` buttons. */
export function buttonY(i: number, n: number): number {
  return barHeight(n) / 2 - PAD_Y - SLOT / 2 - i * SLOT;
}

// ── Per-tool accent palette ───────────────────────────────────────────────────
// Premium, distinct, jewel-toned. Each tool's 3D icon and its glow read in its
// own color so the bar is legible at a glance (NOT a monochrome row). Keys match
// CanvasToolbar's ToolGroupId.
export const TOOL_ACCENT: Record<string, string> = {
  transform: '#5fb8ff', // axis-blue
  selection: '#a98bff', // amethyst
  add: '#5ce0b0', // mint
  library: '#ffb65c', // amber
  image: '#ff7eb6', // rose
  object3d: '#7cf0e0', // teal
  background: '#c08cff', // orchid
  changeArtifact: '#ffd24a', // gold
  promptEdit: '#7af0c2', // jade
  text: '#9fd0ff', // ice
  animation: '#ff9a5c', // tangerine
  function: '#6ad0ff', // cyan
  lighting: '#ffe27a', // warm light
  build: '#ff8a6a', // forge-orange
};

/** Accent for a tool id, with a brass fallback. */
export function accentFor(id: string): string {
  return TOOL_ACCENT[id] ?? '#d8b46a';
}

// Glass body tints (cool, soap-film leaning — DESIGN-REFERENCES soap-scum look).
export const GLASS_TINT = '#cfe6ff';
export const GLASS_ATTENUATION = '#2a5b7a';
export const BACKDROP_TOP = '#141d2e';
export const BACKDROP_BOT = '#0a0e18';
