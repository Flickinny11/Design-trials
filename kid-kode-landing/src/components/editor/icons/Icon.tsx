'use client';

import * as React from 'react';

// Authored icon paths (SVG, y-down, 24x24 viewBox).
// Shared with the 3D extrude system conceptually, rendered with inner gradients to suggest depth.
const PATHS: Record<string, string> = {
  home: 'M12 2 L22 11 L20 11 L20 22 L14 22 L14 14 L10 14 L10 22 L4 22 L4 11 L2 11 L12 2 Z',
  chart: 'M3 21 L8 21 L8 10 L3 10 Z M10 21 L15 21 L15 4 L10 4 Z M17 21 L22 21 L22 14 L17 14 Z',
  user: 'M12 4 A4 4 0 1 1 12 12 A4 4 0 1 1 12 4 Z M4 21 C4 15 8 14 12 14 C16 14 20 15 20 21 Z',
  lock: 'M7 10 L7 7 C7 4 9 2 12 2 C15 2 17 4 17 7 L17 10 L15 10 L15 7 C15 5.5 13.5 4 12 4 C10.5 4 9 5.5 9 7 L9 10 Z M5 11 L19 11 L19 21 L5 21 Z',
  eye: 'M2 12 C5 6 9 4 12 4 C15 4 19 6 22 12 C19 18 15 20 12 20 C9 20 5 18 2 12 Z M12 8 A4 4 0 1 1 12 16 A4 4 0 1 1 12 8 Z',
  code: 'M8 4 L2 12 L8 20 L6 20 L1 13 L1 11 L6 4 Z M16 4 L22 12 L16 20 L18 20 L23 13 L23 11 L18 4 Z',
  play: 'M6 4 L20 12 L6 20 Z',
  pause: 'M6 4 L10 4 L10 20 L6 20 Z M14 4 L18 4 L18 20 L14 20 Z',
  search: 'M10 4 A6 6 0 1 1 10 16 A6 6 0 1 1 10 4 Z M15 15 L22 22 L20 22 L14 16 Z',
  snow: 'M12 2 L14 8 L20 6 L16 11 L22 12 L16 13 L20 18 L14 16 L12 22 L10 16 L4 18 L8 13 L2 12 L8 11 L4 6 L10 8 Z',
  close: 'M5 6 L7 4 L12 9 L17 4 L19 6 L14 11 L19 16 L17 18 L12 13 L7 18 L5 16 L10 11 Z',
  chevron: 'M9 6 L15 12 L9 18 L7 16 L11 12 L7 8 Z',
  sparkle: 'M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z',
  refresh: 'M20 12 A8 8 0 1 0 12 20 L12 17 A5 5 0 1 1 17 12 L14 12 L18 8 L22 12 Z',
  save: 'M4 4 L17 4 L20 7 L20 20 L4 20 Z M7 6 L15 6 L15 10 L7 10 Z M7 13 L17 13 L17 18 L7 18 Z',
  link: 'M8 7 L14 7 L14 9 L8 9 A3 3 0 1 0 8 15 L14 15 L14 17 L8 17 A5 5 0 1 1 8 7 Z M16 7 L16 17 A5 5 0 1 0 16 7 Z',
  server: 'M3 4 L21 4 L21 10 L3 10 Z M3 12 L21 12 L21 18 L3 18 Z M6 6 L8 6 L8 8 L6 8 Z M6 14 L8 14 L8 16 L6 16 Z',
  layers: 'M12 2 L22 8 L12 14 L2 8 Z M2 13 L12 19 L22 13 L22 15 L12 21 L2 15 Z',
  zap: 'M13 2 L4 14 L11 14 L10 22 L20 10 L13 10 Z',
  grid: 'M3 3 L10 3 L10 10 L3 10 Z M14 3 L21 3 L21 10 L14 10 Z M3 14 L10 14 L10 21 L3 21 Z M14 14 L21 14 L21 21 L14 21 Z',
  flow: 'M4 6 L14 6 L14 4 L20 8 L14 12 L14 10 L4 10 Z M20 14 L10 14 L10 12 L4 16 L10 20 L10 18 L20 18 Z',
  check: 'M4 12 L10 18 L20 6 L18 4 L10 14 L6 10 Z',
  pin: 'M12 2 L16 8 L22 10 L18 14 L19 21 L12 18 L5 21 L6 14 L2 10 L8 8 Z',
  edit: 'M3 17 L14 6 L18 10 L7 21 L3 21 Z M15 4 L18 4 L20 6 L20 9 L17 12 L12 7 Z',
  trash: 'M5 6 L19 6 L18 21 L6 21 Z M9 3 L15 3 L15 6 L9 6 Z',
  plus: 'M11 5 L13 5 L13 11 L19 11 L19 13 L13 13 L13 19 L11 19 L11 13 L5 13 L5 11 L11 11 Z',
  arrowRight: 'M4 12 L16 12 L12 7 L14 5 L22 12 L14 19 L12 17 L16 12 Z',
  menu: 'M3 5 L21 5 L21 7 L3 7 Z M3 11 L21 11 L21 13 L3 13 Z M3 17 L21 17 L21 19 L3 19 Z',
  compass: 'M12 2 A10 10 0 1 1 12 22 A10 10 0 1 1 12 2 Z M12 6 L14 12 L20 12 L14 14 L12 20 L10 14 L4 12 L10 12 Z',
  // STEP8 canvas-toolbar glyphs — premium tool icons (24x24, y-down, filled).
  move: 'M11 2 L13 2 L13 11 L11 11 Z M11 13 L13 13 L13 22 L11 22 Z M2 11 L11 11 L11 13 L2 13 Z M13 11 L22 11 L22 13 L13 13 Z M12 0.5 L15.5 4 L8.5 4 Z M12 23.5 L8.5 20 L15.5 20 Z M0.5 12 L4 8.5 L4 15.5 Z M23.5 12 L20 15.5 L20 8.5 Z',
  rotate: 'M12 5 L12 1.5 L17.5 6 L12 10.5 L12 7 A5 5 0 1 0 17 12 L19.5 12 A7.5 7.5 0 1 1 12 5 Z',
  scale: 'M3 3 L21 3 L21 21 L3 21 Z M3 3 L3 9 L5 9 L5 5 L9 5 L9 3 Z M21 21 L15 21 L15 19 L19 19 L19 15 L21 15 Z M9 9 L15 9 L15 15 L9 15 Z',
  image: 'M3 5 L21 5 L21 19 L3 19 Z M3 19 L9 11 L13 15 L16 12 L21 17 L21 19 Z M8 10 A2 2 0 1 1 8 9.99 Z',
  cube: 'M12 2 L21 7 L12 12 L3 7 Z M3 8.5 L11 13 L11 22 L3 17.5 Z M13 13 L21 8.5 L21 17.5 L13 22 Z',
  text: 'M4 4 L20 4 L20 8 L17.5 8 L17.5 6.2 L13.2 6.2 L13.2 17.8 L15.5 17.8 L15.5 20 L8.5 20 L8.5 17.8 L10.8 17.8 L10.8 6.2 L6.5 6.2 L6.5 8 L4 8 Z',
  bulb: 'M12 2 A7 7 0 0 1 16 14.5 L15 16 L9 16 L8 14.5 A7 7 0 0 1 12 2 Z M9 17.5 L15 17.5 L15 19 L9 19 Z M10 20 L14 20 L13 22 L11 22 Z',
  group: 'M3 4 L13 4 L13 14 L3 14 Z M5 6 L11 6 L11 12 L5 12 Z M11 11 L21 11 L21 21 L11 21 Z M13 13 L19 13 L19 19 L13 19 Z',
  ungroup: 'M3 3 L11 3 L11 11 L3 11 Z M14 13 L22 13 L22 21 L14 21 Z',
  wand: 'M4 18 L14 8 L16 10 L6 20 Z M17 3 L18.2 5.8 L21 7 L18.2 8.2 L17 11 L15.8 8.2 L13 7 L15.8 5.8 Z M19 13 L19.8 14.8 L21.6 15.6 L19.8 16.4 L19 18.2 L18.2 16.4 L16.4 15.6 L18.2 14.8 Z',
  diamond: 'M12 2.5 L20 12 L12 21.5 L4 12 Z',
  timeline: 'M2 11 L22 11 L22 13 L2 13 Z M12 5.5 L17 12 L12 18.5 L7 12 Z',
  lockOpen: 'M7 10 L7 7 C7 4 9 2 12 2 C14.4 2 16.4 3.6 17 6 L15 6.5 C14.6 5.1 13.4 4 12 4 C10.5 4 9 5.5 9 7 L9 10 L19 10 L19 21 L5 21 L5 10 Z',
  align: 'M3 2 L5 2 L5 22 L3 22 Z M8 5 L20 5 L20 9 L8 9 Z M8 13 L16 13 L16 17 L8 17 Z',
  palette: 'M12 3 A9 9 0 1 0 12 21 C13.5 21 13.5 19.5 12.6 18.7 C11.5 17.7 12.2 16 13.7 16 L16 16 A5 5 0 0 0 21 11 C21 6.6 17 3 12 3 Z M7 10 A1.5 1.5 0 1 1 7 9.99 Z M11 7 A1.5 1.5 0 1 1 11 6.99 Z M16 8 A1.5 1.5 0 1 1 16 7.99 Z',
  hammer: 'M13.5 3 L21 10.5 L18.5 13 L16 10.5 L6 20.5 L3.5 18 L13.5 8 L11 5.5 Z',
  crop: 'M6 2 L8 2 L8 16 L22 16 L22 18 L8 18 L6 18 Z M2 6 L4 6 L16 6 L16 8 L6 8 L6 22 L4 22 L4 8 L2 8 Z',
  sliders: 'M4 5 L20 5 L20 7 L4 7 Z M4 11 L20 11 L20 13 L4 13 Z M4 17 L20 17 L20 19 L4 19 Z M7 3 L9 3 L9 9 L7 9 Z M14 9 L16 9 L16 15 L14 15 Z M8 15 L10 15 L10 21 L8 21 Z',
  cursor: 'M5 3 L19 11 L12 12 L16 19 L13.5 20.5 L9.5 13.5 L5 17 Z',
};

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: string;
  size?: number | string;
  color?: string;
  accent?: string;
  glow?: boolean;
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
}

// ── Unified key-light (shared by EVERY icon in the editor) ───────────────────
// One light, top-left, ~129° — so the whole set reads as a single milled,
// premium family. The extrusion recedes *away* from the light (down-right);
// the lit bevel, specular hotspot, and contact shadow all derive from this
// same vector. All overlays are white/black alpha → color-agnostic: any tint
// (currentColor or a hex accent) extrudes and lights correctly.
const LIGHT = { dx: 0.6, dy: 0.8 }; // extrusion / shadow direction, down-right (unit-ish)

// Wall tones for the extruded body, deepest → just-behind-face. Kept darker
// than the cosmic glass chrome so the solid side reads as a real shadowed
// flank instead of vanishing into the panel.
const WALL_DEEP = [1, 2, 9]; // #010209 — base / ambient-occlusion
const WALL_NEAR = [13, 19, 44]; // #0d132c — lit-side bounce just under the face
const lerp = (a: number[], b: number[], t: number) =>
  `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(
    a[1] + (b[1] - a[1]) * t,
  )},${Math.round(a[2] + (b[2] - a[2]) * t)})`;

/**
 * Prism 3D-premium icon. Each glyph is composited from same-path layers so it
 * reads as an extruded, milled solid lit by ONE shared key-light — never a flat
 * line icon. Back-to-front:
 *
 *   1. a soft contact shadow (CSS drop-shadow, cast down-right) grounds the chip;
 *   2. a stepped extruded body — N offset copies stepping down-right, graded
 *      from a near-black base (ambient occlusion) up to a lit bounce under the
 *      face → a smooth, visible solid flank;
 *   3. the colored face;
 *   4. a directional light wash (bright top-left → shaded bottom-right);
 *   5. a tight specular hotspot near the top-left (glossy enamel sheen);
 *   6. a directional bevel stroke — bright on the top-left edge, dark on the
 *      bottom-right edge → a rounded, catch-the-light bevel;
 *   7. a hairline rim-light keeps edges crisp at toolbar sizes.
 *
 * API is unchanged from the flat version, so every call site (toolbar rail,
 * flyouts, TopBar, Inspector, mode toggle, Minimap, HubNav) upgrades at once.
 */
export function Icon({
  name,
  size = 16,
  color,
  accent,
  glow = false,
  className,
  style,
}: IconProps) {
  const path = PATHS[name] || PATHS.sparkle;
  const primary = color || 'currentColor';
  const sheen = accent || 'rgba(255,255,255,0.95)';
  const uid = React.useId();

  // Depth, step count, and bevel scale with render size: big icons feel chunkier
  // and more sculptural; small toolbar glyphs stay crisp and legible.
  const px = typeof size === 'number' ? size : 16;
  const steps = px >= 30 ? 8 : px >= 20 ? 6 : px >= 14 ? 5 : 4;
  const spread = px >= 30 ? 3.4 : px >= 20 ? 2.7 : px >= 14 ? 2.1 : 1.6; // deepest-wall offset (viewBox units)
  const bevelW = px >= 30 ? 1.0 : px >= 18 ? 0.8 : 0.62; // bevel stroke width (viewBox units)
  const rimW = px >= 28 ? 0.5 : 0.38;

  // Build the stepped extruded body, deepest first so nearer (lighter) walls
  // paint over it.
  const walls: React.ReactElement[] = [];
  for (let i = steps; i >= 1; i--) {
    const t = i / steps; // 1 = deepest, →0 = nearest the face
    const off = t * spread;
    walls.push(
      <path
        key={i}
        d={path}
        transform={`translate(${off * LIGHT.dx} ${off * LIGHT.dy})`}
        fill={lerp(WALL_NEAR, WALL_DEEP, t)}
        fillRule="evenodd"
        opacity={0.95 - 0.12 * t}
      />,
    );
  }

  // Soft contact shadow cast down-right (opposite the key-light), grounding the
  // chip; scales gently with size. Glow prepends the accent halo.
  const sh = px >= 28 ? 1 : 0.7;
  const seat =
    `drop-shadow(${0.8 * sh}px ${1.5 * sh}px ${1.6 * sh}px rgba(0,1,8,0.55)) ` +
    `drop-shadow(${0.3 * sh}px ${0.5 * sh}px ${0.6 * sh}px rgba(0,1,6,0.5))`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{
        filter: glow ? `drop-shadow(0 0 6px ${primary}) ${seat}` : seat,
        overflow: 'visible',
        ...style,
      }}
      aria-hidden
    >
      <defs>
        {/* Directional light wash across the face: lit top-left → shaded
            bottom-right, in viewBox space so the angle is identical on every
            glyph regardless of its silhouette. */}
        <linearGradient id={`if-${uid}`} gradientUnits="userSpaceOnUse" x1="4" y1="3" x2="20" y2="21">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="0.34" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.62" stopColor="#000308" stopOpacity="0" />
          <stop offset="1" stopColor="#000308" stopOpacity="0.5" />
        </linearGradient>
        {/* Tight specular hotspot near the top-left → glossy enamel sheen. */}
        <radialGradient id={`sp-${uid}`} gradientUnits="userSpaceOnUse" cx="7.5" cy="6" r="13">
          <stop offset="0" stopColor={sheen} stopOpacity="0.8" />
          <stop offset="0.45" stopColor={sheen} stopOpacity="0.14" />
          <stop offset="1" stopColor={sheen} stopOpacity="0" />
        </radialGradient>
        {/* Directional bevel: bright lit edge top-left, dark edge bottom-right
            — one stroke gives a rounded, milled bevel. */}
        <linearGradient id={`bv-${uid}`} gradientUnits="userSpaceOnUse" x1="3" y1="3" x2="21" y2="21">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.92" />
          <stop offset="0.4" stopColor="#ffffff" stopOpacity="0.04" />
          <stop offset="0.6" stopColor="#000000" stopOpacity="0.04" />
          <stop offset="1" stopColor="#000208" stopOpacity="0.62" />
        </linearGradient>
      </defs>

      {/* 1 — stepped extruded body (deepest → nearest the face) */}
      {walls}

      {/* 2 — colored face */}
      <path d={path} fill={primary} fillRule="evenodd" />
      {/* 3 — directional light wash */}
      <path d={path} fill={`url(#if-${uid})`} fillRule="evenodd" />
      {/* 4 — specular hotspot (gloss) */}
      <path d={path} fill={`url(#sp-${uid})`} fillRule="evenodd" />
      {/* 5 — directional bevel: lit top-left / dark bottom-right edge */}
      <path
        d={path}
        fill="none"
        stroke={`url(#bv-${uid})`}
        strokeWidth={bevelW}
        strokeLinejoin="round"
        fillRule="evenodd"
      />
      {/* 6 — hairline rim-light keeps edges crisp at toolbar sizes */}
      <path
        d={path}
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.16"
        strokeWidth={rimW}
        strokeLinejoin="round"
        fillRule="evenodd"
      />
    </svg>
  );
}
