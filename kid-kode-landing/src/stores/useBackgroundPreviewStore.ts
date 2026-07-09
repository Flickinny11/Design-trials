// W-BG — transient hover-preview channel for the background picker.
//
// Hovering a catalog card previews that preset LIVE in the real scene without
// touching the source graph: the picker writes {hubId, layers} here and
// HubBackgroundStack / the galaxy backdrop substitute these layers for
// `hub.background` while the hover lasts. Nothing is persisted; clearing on
// mouse-leave restores the hub's own stack. Source writes still go through
// `useGraphSourceStore.updateHub` exclusively (the click path).

import { create } from "zustand";
import type { PrismHubBackgroundLayer } from "@/lib/prism-graph/types";

interface BackgroundPreviewState {
  hubId: string | null;
  layers: PrismHubBackgroundLayer[] | null;
  preview: (hubId: string, layers: PrismHubBackgroundLayer[]) => void;
  clear: () => void;
}

export const useBackgroundPreviewStore = create<BackgroundPreviewState>(
  (set) => ({
    hubId: null,
    layers: null,
    preview: (hubId, layers) => set({ hubId, layers }),
    clear: () => set({ hubId: null, layers: null }),
  }),
);

/** Effective background for a hub: the live hover-preview override when one
 *  is active for this hub, else the hub's own persisted stack. */
export function effectiveHubBackground(
  hubId: string | undefined | null,
  background: PrismHubBackgroundLayer[] | undefined,
  state: Pick<BackgroundPreviewState, "hubId" | "layers">,
): PrismHubBackgroundLayer[] | undefined {
  if (hubId && state.hubId === hubId && state.layers) return state.layers;
  return background;
}
