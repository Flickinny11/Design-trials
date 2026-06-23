'use client';

// Shared icon-kit primitives for the liquid-glass toolbar. The toolbar icons are
// now GENERATED 3D GLBs (see IconGlb.tsx) — this module only carries the small
// cross-cutting helpers they need: the hover/active context the button publishes,
// the on-face icon scale, and a hex shade() used for the engraving re-material.
// (The V1 procedural ExtrudeGeometry icon builders were removed with glyphs.tsx.)

import { createContext, useContext } from 'react';
import * as THREE from 'three';
import { TOKEN_R } from '../config';

// Icons live within ~this radius on the coin face.
export const ICON_S = TOKEN_R * 1.0;

// Hover/active state for the icon under the cursor, provided by ToolButton3D so
// icons (esp. engravings) can react to hover without prop-drilling.
export interface IconState {
  hovered: boolean;
  active: boolean;
}
export const IconStateContext = createContext<IconState>({ hovered: false, active: false });
export const useIconState = () => useContext(IconStateContext);

/** Lighten/darken a hex toward white/black by `amt` (-1..1). */
export function shade(hex: string, amt: number): string {
  const c = new THREE.Color(hex);
  if (amt >= 0) c.lerp(new THREE.Color('#ffffff'), amt);
  else c.lerp(new THREE.Color('#000000'), -amt);
  return `#${c.getHexString()}`;
}
