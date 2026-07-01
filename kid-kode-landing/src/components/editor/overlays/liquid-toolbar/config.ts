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

// ── Per-tool accent palette ───────────────────────────────────────────────────
// Restrained jewel-metal accents. These tint the proud custom 3D icon sculptures
// only; the pane and cubes stay clear physical glass.
export const TOOL_ACCENT: Record<string, string> = {
  transform: '#7db6d9',
  selection: '#9b91bd',
  add: '#70af92',
  library: '#bc9559',
  image: '#c28398',
  object3d: '#78bcb5',
  background: '#9e88b6',
  changeArtifact: '#c9b15f',
  promptEdit: '#75b49d',
  text: '#9bb9cf',
  animation: '#bf8966',
  function: '#75aec5',
  lighting: '#d2c174',
  build: '#b97869',
};

/** Accent for a tool id, with a brass fallback. */
export function accentFor(id: string): string {
  return TOOL_ACCENT[id] ?? '#d8b46a';
}

// Legacy constants are retained for the retired LiquidGlassBar module only. The
// live ToolbarScene uses clear physical glass and local studio reflections.
export const GLASS_TINT = '#dcf1ff';
export const GLASS_ATTENUATION = '#9fd0ee';
export const BACKDROP_TOP = '#33476b';
export const BACKDROP_BOT = '#161f33';
