'use client';

// Inspector — the in-canvas, NO-DOM schema editor for the selected primitive
// (spec §1.3 / §7). Built fully in wave w-inspector. Stub for now (renders nothing
// until a primitive is selected); the full fader-channel + material-swatch editor
// lands next wave.

import type { WornMaps } from '@/components/editor/chassis/materials';

export function Inspector(_: { maps: Record<string, WornMaps> }) {
  return null;
}
