// W-VIS D3 — composition-layout library: 12 numeric layouts spanning 2D and
// 3D. Regions are normalized frame rects [x, y, w, h] (origin top-left);
// 3D layouts add per-region depth offsets in subject radii. Every layout is
// render-proven with a committed thumb (proof scene renders each region as a
// labeled plate at its exact rect + depth).

import type { CompositionLayoutPreset } from './types';

export const COMPOSITION_LAYOUTS: readonly CompositionLayoutPreset[] = [
  {
    id: 'layout-type-sandwich',
    name: 'Type sandwich',
    span: '3d',
    moods: ['editorial', 'monumental'],
    intent: 'Oversized display word BEHIND the subject, caption in front — depth via typography.',
    focalRole: 'subject',
    regions: [
      { role: 'headline', rect: [0.06, 0.18, 0.88, 0.34], depth: -1.6, note: 'display word behind subject plane' },
      { role: 'subject', rect: [0.3, 0.22, 0.4, 0.58], depth: 0 },
      { role: 'caption', rect: [0.38, 0.82, 0.24, 0.06], depth: 0.8 },
      { role: 'negative', rect: [0, 0.9, 1, 0.1] },
    ],
  },
  {
    id: 'layout-hero-left-copy-right',
    name: 'Hero left, copy right',
    span: 'both',
    moods: ['product', 'editorial'],
    intent: 'Subject owns the left half; headline + body + CTA stack on the right.',
    focalRole: 'subject',
    regions: [
      { role: 'subject', rect: [0.05, 0.15, 0.42, 0.7], depth: 0 },
      { role: 'headline', rect: [0.54, 0.22, 0.4, 0.18] },
      { role: 'body', rect: [0.54, 0.44, 0.36, 0.2] },
      { role: 'cta', rect: [0.54, 0.7, 0.18, 0.08], depth: 0.4 },
    ],
  },
  {
    id: 'layout-hero-right-copy-left',
    name: 'Hero right, copy left',
    span: 'both',
    moods: ['product', 'editorial'],
    intent: 'Mirror twin of hero-left — keeps spread pairs from repeating.',
    focalRole: 'subject',
    regions: [
      { role: 'subject', rect: [0.53, 0.15, 0.42, 0.7], depth: 0 },
      { role: 'headline', rect: [0.06, 0.22, 0.4, 0.18] },
      { role: 'body', rect: [0.06, 0.44, 0.36, 0.2] },
      { role: 'cta', rect: [0.06, 0.7, 0.18, 0.08], depth: 0.4 },
    ],
  },
  {
    id: 'layout-centered-monolith',
    name: 'Centered monolith',
    span: 'both',
    moods: ['monumental', 'quiet'],
    intent: 'Dead-center subject, headline above, caption below — formal symmetry.',
    focalRole: 'subject',
    regions: [
      { role: 'headline', rect: [0.15, 0.06, 0.7, 0.12] },
      { role: 'subject', rect: [0.33, 0.24, 0.34, 0.52], depth: 0 },
      { role: 'caption', rect: [0.35, 0.84, 0.3, 0.05] },
      { role: 'negative', rect: [0, 0.24, 0.2, 0.52], note: 'breathing room is load-bearing' },
    ],
  },
  {
    id: 'layout-bento-grid',
    name: 'Bento grid',
    span: '2d',
    moods: ['clinical', 'kinetic'],
    intent: '2x3 metric board: one double-width hero cell, four support cells.',
    focalRole: 'media',
    regions: [
      { role: 'media', rect: [0.04, 0.08, 0.6, 0.42], note: 'hero cell' },
      { role: 'accent', rect: [0.68, 0.08, 0.28, 0.42] },
      { role: 'body', rect: [0.04, 0.54, 0.28, 0.38] },
      { role: 'body', rect: [0.36, 0.54, 0.28, 0.38] },
      { role: 'cta', rect: [0.68, 0.54, 0.28, 0.38] },
    ],
  },
  {
    id: 'layout-editorial-column',
    name: 'Editorial column',
    span: '2d',
    moods: ['editorial', 'quiet'],
    intent: 'Single reading column with oversized drop headline — magazine long-form.',
    focalRole: 'headline',
    regions: [
      { role: 'headline', rect: [0.08, 0.08, 0.84, 0.26] },
      { role: 'body', rect: [0.3, 0.4, 0.4, 0.44] },
      { role: 'caption', rect: [0.3, 0.88, 0.24, 0.04] },
      { role: 'accent', rect: [0.08, 0.4, 0.14, 0.02], note: 'signal rule line' },
    ],
  },
  {
    id: 'layout-filmstrip-row',
    name: 'Filmstrip row',
    span: '2d',
    moods: ['kinetic', 'gallery'],
    intent: 'Horizontal strip of media cards with a headline band above.',
    focalRole: 'media',
    regions: [
      { role: 'headline', rect: [0.06, 0.1, 0.6, 0.14] },
      { role: 'media', rect: [0.04, 0.34, 0.28, 0.42] },
      { role: 'media', rect: [0.36, 0.34, 0.28, 0.42] },
      { role: 'media', rect: [0.68, 0.34, 0.28, 0.42] },
      { role: 'caption', rect: [0.06, 0.82, 0.4, 0.05] },
    ],
  },
  {
    id: 'layout-diagonal-sweep',
    name: 'Diagonal sweep',
    span: 'both',
    moods: ['kinetic', 'dramatic'],
    intent: 'Energy line from lower-left to upper-right; subject rides the line, type counterweights.',
    focalRole: 'subject',
    regions: [
      { role: 'subject', rect: [0.42, 0.18, 0.38, 0.5], depth: 0 },
      { role: 'accent', rect: [0.06, 0.62, 0.34, 0.26], depth: -0.6, note: 'lower-left mass' },
      { role: 'headline', rect: [0.08, 0.1, 0.36, 0.16] },
      { role: 'cta', rect: [0.74, 0.78, 0.2, 0.08], depth: 0.4 },
    ],
  },
  {
    id: 'layout-footer-band',
    name: 'Footer band',
    span: '2d',
    moods: ['quiet', 'clinical'],
    intent: 'Colophon strip: nav columns over a hairline, legal whisper at the bottom.',
    focalRole: 'nav',
    regions: [
      { role: 'nav', rect: [0.06, 0.16, 0.2, 0.5] },
      { role: 'nav', rect: [0.32, 0.16, 0.2, 0.5] },
      { role: 'nav', rect: [0.58, 0.16, 0.2, 0.5] },
      { role: 'accent', rect: [0.06, 0.74, 0.88, 0.01], note: 'hairline' },
      { role: 'caption', rect: [0.06, 0.82, 0.5, 0.05] },
    ],
  },
  {
    id: 'layout-pedestal-stage',
    name: 'Pedestal stage',
    span: '3d',
    moods: ['gallery', 'monumental', 'product'],
    intent: 'Object on a plinth, graded floor, label plate low — the museum vitrine.',
    focalRole: 'subject',
    regions: [
      { role: 'subject', rect: [0.34, 0.2, 0.32, 0.44], depth: 0 },
      { role: 'media', rect: [0.3, 0.64, 0.4, 0.2], depth: 0, note: 'plinth mass' },
      { role: 'caption', rect: [0.42, 0.88, 0.16, 0.05], depth: 0.6, note: 'label plate' },
      { role: 'negative', rect: [0, 0.05, 1, 0.12], note: 'headroom' },
    ],
  },
  {
    id: 'layout-triptych',
    name: 'Triptych',
    span: '2d',
    moods: ['gallery', 'editorial'],
    intent: 'Three equal panels, center panel carries the focal weight.',
    focalRole: 'media',
    regions: [
      { role: 'media', rect: [0.04, 0.18, 0.28, 0.6] },
      { role: 'media', rect: [0.36, 0.12, 0.28, 0.72], note: 'center panel — focal' },
      { role: 'media', rect: [0.68, 0.18, 0.28, 0.6] },
      { role: 'caption', rect: [0.36, 0.88, 0.28, 0.05] },
    ],
  },
  {
    id: 'layout-orbital-field',
    name: 'Orbital field',
    span: '3d',
    moods: ['kinetic', 'dramatic'],
    intent: 'Central mass with satellite elements distributed on a depth ring around it.',
    focalRole: 'subject',
    regions: [
      { role: 'subject', rect: [0.36, 0.3, 0.28, 0.4], depth: 0 },
      { role: 'accent', rect: [0.12, 0.16, 0.12, 0.16], depth: -1.2 },
      { role: 'accent', rect: [0.74, 0.2, 0.12, 0.16], depth: 0.9 },
      { role: 'accent', rect: [0.16, 0.66, 0.12, 0.16], depth: 0.7 },
      { role: 'accent', rect: [0.72, 0.62, 0.12, 0.16], depth: -0.9 },
      { role: 'headline', rect: [0.3, 0.06, 0.4, 0.1], depth: -0.4 },
    ],
  },
];

export function getCompositionLayout(id: string): CompositionLayoutPreset | undefined {
  return COMPOSITION_LAYOUTS.find((l) => l.id === id);
}
