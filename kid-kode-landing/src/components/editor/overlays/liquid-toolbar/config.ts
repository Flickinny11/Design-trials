// PHYSICAL GLASS TOOLBAR — shared layout + palette config.
//
// TOOLBAR REDESIGN (2026-06-22, CHROME 1): the canvas-editor toolbar is a
// photoreal 3D glass object (an isolated R3F WebGL canvas, the proven
// Glb3DPreview pattern — it deliberately does NOT touch the unified three/webgpu
// graph scene). Every editor density uses this vertical glass rail; compact
// panes only change the flyout housing, never the toolbar chrome.
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
export const BAR_W = 2.18; // bar width (world units)
export const BAR_D = 1.28; // bar depth (front↔back) — the volumetric body
export const TOKEN_R = 0.39; // button token radius
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

/** Screen-Y projection for DOM hit targets/tooltips aligned to the R3F buttons. */
export function screenYForButton(i: number, n: number, railHeight: number): number {
  const worldY = buttonY(i, n);
  return railHeight / 2 - (worldY / (barHeight(n) / 2)) * (0.46 * railHeight);
}

// ── RED / BLACK / WHITE icon palette (founder mandate 2026-07-01) ──────────────
// The custom 3D icon sculptures are a single, disciplined RED + BLACK + WHITE
// system: identity comes from each tool's distinct FORM, the brand from the
// unified signal red. Every accent below is the same red — the pane, cubes, and
// material kit supply the black (anodized) and white (chrome) around it. The
// accent family now lives in the ONE shared design-system module
// (design-system/premium.ts) that the keyframe editor inherits (FINISH F-1);
// re-exported here so the toolbar API is unchanged.
export { SIGNAL_RED, RED_DEEP, RED_HOT } from '@/components/editor/design-system/premium';
import { SIGNAL_RED } from '@/components/editor/design-system/premium';

export const TOOL_ACCENT: Record<string, string> = {
  transform: SIGNAL_RED,
  selection: SIGNAL_RED,
  add: SIGNAL_RED,
  library: SIGNAL_RED,
  image: SIGNAL_RED,
  object3d: SIGNAL_RED,
  background: SIGNAL_RED,
  changeArtifact: SIGNAL_RED,
  promptEdit: SIGNAL_RED,
  text: SIGNAL_RED,
  animation: SIGNAL_RED,
  function: SIGNAL_RED,
  lighting: SIGNAL_RED,
  build: SIGNAL_RED,
};

/** Accent for a tool id — the signal red (single-accent red/black/white system). */
export function accentFor(id: string): string {
  return TOOL_ACCENT[id] ?? SIGNAL_RED;
}

// Legacy constants are retained for the retired LiquidGlassBar module only. The
// live ToolbarScene uses clear physical glass and local studio reflections.
export const GLASS_TINT = '#dcf1ff';
export const GLASS_ATTENUATION = '#9fd0ee';
export const BACKDROP_TOP = '#33476b';
export const BACKDROP_BOT = '#161f33';
