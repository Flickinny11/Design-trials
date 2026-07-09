'use client';

// W-2D — the per-hub 2d/3d render-mode toggle. Mounted in the Hub Inspector's
// Visual tab (galaxy planet selection + canvas hub selection); the canvas
// camera HUD carries its own compact chip wired to the same store write.
// Writes PrismHub.renderMode via updateHub (the SceneFxPicker idiom) and fires
// the fire-and-forget render-mode beacon. Non-destructive by law: switching
// modes never touches node z, cameraKeyframes, or any other depth data.

import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import type { HubRenderMode, PrismHub } from '@/lib/prism-graph/types';
import { resolveHubRenderMode } from '@/lib/prism-graph/hub-render-mode';
import { beaconRenderModeEvent } from '@/lib/editor/render-mode-beacon';

const MODE_OPTIONS: ReadonlyArray<{
  mode: HubRenderMode;
  label: string;
  hint: string;
}> = [
  {
    mode: '3d',
    label: '3D Depth',
    hint: 'Perspective composition — depth staging, orbit, camera journeys.',
  },
  {
    mode: '2d',
    label: '2D Flat',
    hint: 'Flat composition in the same renderer — depth data kept, just unused. 3D accents still render.',
  },
];

export function HubRenderModeToggle({
  hub,
  surface = 'hub-inspector',
}: {
  hub: PrismHub;
  surface?: 'hub-inspector' | 'canvas-hud';
}) {
  const updateHub = useGraphSourceStore((s) => s.updateHub);
  const current = resolveHubRenderMode(hub);

  const setMode = (mode: HubRenderMode) => {
    if (mode === current) return;
    updateHub(hub.hubId, { renderMode: mode });
    beaconRenderModeEvent({
      surface,
      hub_ref: hub.hubId,
      from_mode: current,
      to_mode: mode,
      hub_hint: hub.title,
    });
  };

  return (
    <div className="space-y-2" data-render-mode-toggle>
      <div className="ds-kicker pt-1">RENDER MODE (W-2D)</div>
      <div className="flex flex-wrap gap-1.5" data-render-mode-picker>
        {MODE_OPTIONS.map((o) => {
          const active = current === o.mode;
          return (
            <button
              key={o.mode}
              data-testid={`render-mode-${o.mode}`}
              onClick={() => setMode(o.mode)}
              title={o.hint}
              className={`ds-chip ds-press cursor-pointer min-h-[34px] px-2.5 text-[11px] ${
                active ? 'ds-chip--metal' : 'hover:text-ds-text'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <div className="text-[9.5px] text-ds-text-low leading-snug">
        Non-destructive both ways — node depth and camera journeys are
        preserved while 2D, just unused. Depth tools grey out on a 2D hub.
      </div>
    </div>
  );
}
