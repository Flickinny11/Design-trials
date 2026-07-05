// THREE-D-BACKGROUNDS — preset registry contract (D6).
//
// A background-library entry is a NAMED preset that emits a typed, parameterized
// LAYER STACK (PrismHubBackgroundLayer[]) bound to `PrismHub.background` (A6).
// Each preset declares the customizable controls the Inspector renders and a
// pure `build(params)` that produces the layer stack. Everything is DATA: the
// same schema the editor writes is what the runtime reads (INV-4).

import type { PrismHubBackgroundLayer, BackgroundLayerParams } from '../../prism-graph/types';

export interface BackgroundParamControl {
  id: keyof BackgroundLayerParams | string;
  label: string;
  type: 'knob' | 'slider' | 'select';
  /** knob/slider range. */
  min?: number;
  max?: number;
  step?: number;
  /** select options. */
  options?: { value: string; label: string }[];
  default: number | string;
}

export interface BackgroundPreset {
  id: string;
  name: string;
  description: string;
  /** One-line tag shown on the picker card (e.g. "warm forge nebula"). */
  tagline: string;
  /** Customizable controls the Inspector renders for this preset. */
  controls: BackgroundParamControl[];
  /** Default params (must satisfy the control defaults). */
  defaultParams: BackgroundLayerParams;
  /** Pure: emit the layer stack for the given params. Deterministic — same
   *  params always produce the same (id-stable) stack so re-apply updates in
   *  place and save/reload round-trips. */
  build(params: BackgroundLayerParams): PrismHubBackgroundLayer[];
}
