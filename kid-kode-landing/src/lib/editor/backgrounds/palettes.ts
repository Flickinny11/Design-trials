// THREE-D-BACKGROUNDS — Chrome-Arc background palettes (INV-9: NO purple).
//
// Each palette is a pure DATA description (hex strings drawn from the DS token
// ramp) shared by BOTH the preset layer DATA and the R3F render components, so a
// background's colour identity round-trips through `params.palette` with one
// source of truth. Relative import of the DS tokens keeps this file out of any
// `@/`-alias dependency-guard scope. De-brassed F0 2026-06-19: the warm "brass"
// family is replaced by a cool "chrome" family (metal ramp + arc-cyan core).

import { DS } from '../../../components/editor/design-system/tokens';

export interface BackgroundPalette {
  id: string;
  label: string;
  /** Deepest far-environment base colour. */
  base: string;
  /** Nebula gas tints, dense → mid → wisp (3 stops). */
  gas: [string, string, string];
  /** In-scatter / core glow (hottest point). */
  glow: string;
  /** Depth-scattered particle / star colour. */
  star: string;
}

// Four Chrome-Arc families. The legacy `brass` KEY is retained for saved-graph
// data compatibility but now renders as a cool CHROME family (metal ramp + an
// arc-cyan core); ice = cold informational; deep = graphite void with an arc
// core; bone = neutral pale dust. ZERO brass/gold/amber.
export const BACKGROUND_PALETTES: Readonly<Record<string, BackgroundPalette>> = Object.freeze({
  brass: {
    id: 'brass',
    label: 'Chrome',
    base: DS.void,
    gas: [DS.metal700, DS.metal500, DS.metal200],
    glow: DS.arc,
    star: DS.textHi,
  },
  ice: {
    id: 'ice',
    label: 'Ice',
    base: DS.ink,
    gas: [DS.ice500, DS.ice400, DS.ice200],
    glow: DS.ice200,
    star: DS.textHi,
  },
  deep: {
    id: 'deep',
    label: 'Deep',
    base: DS.void,
    gas: [DS.graphite, DS.steel, DS.anodized],
    glow: DS.arc,
    star: DS.text,
  },
  bone: {
    id: 'bone',
    label: 'Bone',
    base: DS.ink,
    gas: [DS.steel, DS.textLow, DS.textMid],
    glow: DS.textHi,
    star: DS.textHi,
  },
});

export const DEFAULT_PALETTE_ID = 'brass';

export function getBackgroundPalette(id: string | undefined): BackgroundPalette {
  return (id && BACKGROUND_PALETTES[id]) || BACKGROUND_PALETTES[DEFAULT_PALETTE_ID];
}

export const BACKGROUND_PALETTE_IDS: readonly string[] = Object.freeze(
  Object.keys(BACKGROUND_PALETTES),
);
