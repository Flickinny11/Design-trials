// W-VIS D3 — light-rig library: 14 numeric key/fill/rim rigs, mood-tagged.
// Every color is DL2 palette-safe (whites, warm whites, signal red #ff2a38 —
// never default-blue). Positions are subject-relative (see types.ts).
// Every rig is render-proven: scripts/wvis/d3-proof-bundles.mjs mounts the
// EXACT numbers below on the standard proof subject and commits the thumb.

import type { LightRigPreset } from './types';

export const LIGHT_RIGS: readonly LightRigPreset[] = [
  {
    id: 'rig-studio-neutral',
    name: 'Studio neutral',
    moods: ['clinical', 'product'],
    intent: 'Honest three-point studio baseline — even, readable, no drama.',
    ambientFloor: 0.18,
    lights: [
      { role: 'key', type: 'directional', color: '#fff6ec', intensity: 2.6, position: [2.4, 2.8, 2.2], target: [0, 0.4, 0] },
      { role: 'fill', type: 'directional', color: '#e8ecf2', intensity: 0.7, position: [-2.6, 1.2, 1.8], target: [0, 0.4, 0] },
      { role: 'rim', type: 'directional', color: '#ffffff', intensity: 1.6, position: [-1.2, 2.2, -2.6], target: [0, 0.6, 0] },
    ],
    thumbUrl: '/design-presets/thumbs/rig-studio-neutral.webp',
  },
  {
    id: 'rig-product-hero',
    name: 'Product hero',
    moods: ['product', 'dramatic'],
    intent: 'Flagship product stage: strong 45° key, crisp white rim, low fill so the object owns the frame.',
    ambientFloor: 0.1,
    lights: [
      { role: 'key', type: 'spot', color: '#fff2e0', intensity: 65, position: [2.2, 3.2, 2.4], target: [0, 0.5, 0], angle: 0.5, penumbra: 0.55 },
      { role: 'fill', type: 'point', color: '#d8dde6', intensity: 4, position: [-2.8, 0.9, 2.0], distance: 9, decay: 2 },
      { role: 'rim', type: 'spot', color: '#ffffff', intensity: 48, position: [-1.6, 2.6, -2.2], target: [0, 0.7, 0], angle: 0.6, penumbra: 0.4 },
    ],
    thumbUrl: '/design-presets/thumbs/rig-product-hero.webp',
  },
  {
    id: 'rig-noir-crimson',
    name: 'Noir crimson',
    moods: ['noir', 'dramatic', 'signal'],
    intent: 'Hard white key from the side, signal-red rim carving the silhouette out of near-black.',
    ambientFloor: 0.04,
    lights: [
      { role: 'key', type: 'spot', color: '#f4f0ea', intensity: 58, position: [3.0, 1.8, 0.8], target: [0, 0.5, 0], angle: 0.42, penumbra: 0.3 },
      { role: 'rim', type: 'spot', color: '#ff2a38', intensity: 52, position: [-2.2, 1.4, -2.0], target: [0, 0.6, 0], angle: 0.55, penumbra: 0.5 },
      { role: 'kicker', type: 'point', color: '#ff2a38', intensity: 5, position: [-1.0, 0.2, 1.6], distance: 6, decay: 2 },
    ],
    thumbUrl: '/design-presets/thumbs/rig-noir-crimson.webp',
  },
  {
    id: 'rig-gallery-soft',
    name: 'Gallery soft',
    moods: ['gallery', 'soft', 'quiet'],
    intent: 'Museum wall wash — high soft key, generous fill, shadows that describe rather than hide.',
    ambientFloor: 0.3,
    lights: [
      { role: 'key', type: 'directional', color: '#fff8f0', intensity: 1.9, position: [0.8, 3.4, 2.0], target: [0, 0.5, 0] },
      { role: 'fill', type: 'hemisphere', color: '#f2eee8', intensity: 0.65 },
      { role: 'rim', type: 'directional', color: '#ffffff', intensity: 0.8, position: [0.4, 1.8, -2.8], target: [0, 0.6, 0] },
    ],
    thumbUrl: '/design-presets/thumbs/rig-gallery-soft.webp',
  },
  {
    id: 'rig-ember-glow',
    name: 'Ember glow',
    moods: ['warm', 'dramatic', 'quiet'],
    intent: 'Low warm key like firelight, deep shadow side, faint warm bounce — intimacy without murk.',
    ambientFloor: 0.07,
    lights: [
      { role: 'key', type: 'point', color: '#ffb37a', intensity: 9, position: [1.8, 0.7, 1.9], distance: 10, decay: 2 },
      { role: 'fill', type: 'point', color: '#c9924f', intensity: 3, position: [-2.2, 0.4, 1.2], distance: 8, decay: 2 },
      { role: 'rim', type: 'directional', color: '#fff0dc', intensity: 1.2, position: [-0.8, 2.6, -2.4], target: [0, 0.5, 0] },
    ],
    thumbUrl: '/design-presets/thumbs/rig-ember-glow.webp',
  },
  {
    id: 'rig-tech-clinical',
    name: 'Tech clinical',
    moods: ['clinical', 'kinetic'],
    intent: 'Cold even engineering light — high key + high fill, minimal modeling, everything legible.',
    ambientFloor: 0.34,
    lights: [
      { role: 'key', type: 'directional', color: '#f2f4f6', intensity: 2.2, position: [1.6, 3.0, 2.6], target: [0, 0.4, 0] },
      { role: 'fill', type: 'directional', color: '#e6e9ee', intensity: 1.5, position: [-2.0, 2.4, 2.2], target: [0, 0.4, 0] },
      { role: 'rim', type: 'directional', color: '#ffffff', intensity: 1.0, position: [0, 2.0, -3.0], target: [0, 0.5, 0] },
    ],
    thumbUrl: '/design-presets/thumbs/rig-tech-clinical.webp',
  },
  {
    id: 'rig-spotlight-drama',
    name: 'Spotlight drama',
    moods: ['dramatic', 'monumental', 'noir'],
    intent: 'Single overhead theater spot, near-black surround — one pool of light, one subject.',
    ambientFloor: 0.03,
    lights: [
      { role: 'key', type: 'spot', color: '#fff4e4', intensity: 95, position: [0.4, 4.2, 0.9], target: [0, 0.3, 0], angle: 0.36, penumbra: 0.35 },
      { role: 'kicker', type: 'point', color: '#ff2a38', intensity: 4, position: [2.0, 0.15, -1.2], distance: 5, decay: 2 },
    ],
    thumbUrl: '/design-presets/thumbs/rig-spotlight-drama.webp',
  },
  {
    id: 'rig-rim-silhouette',
    name: 'Rim silhouette',
    moods: ['noir', 'editorial', 'dramatic'],
    intent: 'Backlight-dominant: blazing white rim, whisper of key — the subject reads as a lit edge.',
    ambientFloor: 0.05,
    lights: [
      { role: 'rim', type: 'spot', color: '#ffffff', intensity: 72, position: [-0.6, 2.4, -2.8], target: [0, 0.6, 0], angle: 0.7, penumbra: 0.45 },
      { role: 'key', type: 'point', color: '#efe6da', intensity: 6, position: [2.4, 1.0, 2.2], distance: 10, decay: 2 },
    ],
    thumbUrl: '/design-presets/thumbs/rig-rim-silhouette.webp',
  },
  {
    id: 'rig-underglow-signal',
    name: 'Underglow signal',
    moods: ['signal', 'kinetic', 'dramatic'],
    intent: 'Signal-red floor glow under a clean white key — machine-on-a-lightbox energy.',
    ambientFloor: 0.08,
    lights: [
      { role: 'key', type: 'directional', color: '#f8f4ee', intensity: 2.4, position: [1.4, 3.0, 2.0], target: [0, 0.4, 0] },
      { role: 'practical', type: 'point', color: '#ff2a38', intensity: 14, position: [0, -0.65, 0.6], distance: 6, decay: 2 },
      { role: 'rim', type: 'directional', color: '#ffffff', intensity: 1.3, position: [-1.4, 2.0, -2.4], target: [0, 0.5, 0] },
    ],
    thumbUrl: '/design-presets/thumbs/rig-underglow-signal.webp',
  },
  {
    id: 'rig-split-contrast',
    name: 'Split contrast',
    moods: ['editorial', 'dramatic', 'signal'],
    intent: 'Split lighting: white key on one cheek, signal-red on the other, shadow seam down the middle.',
    ambientFloor: 0.06,
    lights: [
      { role: 'key', type: 'spot', color: '#f6f2ec', intensity: 55, position: [2.9, 1.5, 0.4], target: [0, 0.5, 0], angle: 0.5, penumbra: 0.4 },
      { role: 'kicker', type: 'spot', color: '#ff2a38', intensity: 48, position: [-2.9, 1.5, 0.4], target: [0, 0.5, 0], angle: 0.5, penumbra: 0.4 },
      { role: 'rim', type: 'directional', color: '#ffffff', intensity: 1.1, position: [0, 2.6, -2.6], target: [0, 0.6, 0] },
    ],
    thumbUrl: '/design-presets/thumbs/rig-split-contrast.webp',
  },
  {
    id: 'rig-soft-wrap',
    name: 'Soft wrap',
    moods: ['soft', 'warm', 'gallery'],
    intent: 'Big soft warm key that wraps, gentle everything — skin-flattering portrait light for objects.',
    ambientFloor: 0.24,
    lights: [
      { role: 'key', type: 'directional', color: '#ffefdd', intensity: 2.0, position: [1.8, 2.2, 2.8], target: [0, 0.5, 0] },
      { role: 'fill', type: 'hemisphere', color: '#efe8de', intensity: 0.5 },
      { role: 'rim', type: 'directional', color: '#fff8f0', intensity: 0.9, position: [-1.0, 1.8, -2.4], target: [0, 0.5, 0] },
    ],
    thumbUrl: '/design-presets/thumbs/rig-soft-wrap.webp',
  },
  {
    id: 'rig-top-museum',
    name: 'Top museum',
    moods: ['gallery', 'monumental', 'quiet'],
    intent: 'Overhead museum pin-spot on a pedestal piece, faint architectural fill.',
    ambientFloor: 0.12,
    lights: [
      { role: 'key', type: 'spot', color: '#fff6ea', intensity: 75, position: [0, 4.0, 0.2], target: [0, 0.2, 0], angle: 0.4, penumbra: 0.5 },
      { role: 'fill', type: 'directional', color: '#dcd8d0', intensity: 0.4, position: [-2.0, 1.6, 2.4], target: [0, 0.4, 0] },
      { role: 'rim', type: 'point', color: '#ffffff', intensity: 7, position: [1.4, 1.0, -2.2], distance: 8, decay: 2 },
    ],
    thumbUrl: '/design-presets/thumbs/rig-top-museum.webp',
  },
  {
    id: 'rig-backlit-halo',
    name: 'Backlit halo',
    moods: ['monumental', 'editorial', 'soft'],
    intent: 'Bright halo field behind the subject, modest front fill — icon-on-an-altar read.',
    ambientFloor: 0.1,
    lights: [
      { role: 'rim', type: 'point', color: '#ffffff', intensity: 38, position: [0, 1.4, -2.2], distance: 12, decay: 2 },
      { role: 'key', type: 'directional', color: '#f4eee6', intensity: 1.3, position: [1.6, 2.0, 2.6], target: [0, 0.5, 0] },
      { role: 'fill', type: 'point', color: '#e9e4dc', intensity: 4, position: [-1.8, 0.8, 2.2], distance: 9, decay: 2 },
    ],
    thumbUrl: '/design-presets/thumbs/rig-backlit-halo.webp',
  },
  {
    id: 'rig-dusk-editorial',
    name: 'Dusk editorial',
    moods: ['editorial', 'warm', 'noir'],
    intent: 'Late-light editorial: warm low key raking across, cool-white rim, long shadows.',
    ambientFloor: 0.09,
    lights: [
      { role: 'key', type: 'directional', color: '#ffc890', intensity: 2.8, position: [3.0, 0.9, 1.2], target: [0, 0.4, 0] },
      { role: 'fill', type: 'point', color: '#b9a68e', intensity: 3, position: [-2.4, 0.6, 1.8], distance: 9, decay: 2 },
      { role: 'rim', type: 'directional', color: '#f2f4f6', intensity: 1.7, position: [-1.8, 2.8, -2.0], target: [0, 0.6, 0] },
    ],
    thumbUrl: '/design-presets/thumbs/rig-dusk-editorial.webp',
  },
];

export function getLightRig(id: string): LightRigPreset | undefined {
  return LIGHT_RIGS.find((r) => r.id === id);
}
