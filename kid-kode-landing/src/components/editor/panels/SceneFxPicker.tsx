'use client';

// SceneFxPicker (W8 E9 + E10) — the canvas one-click surface for a hub's
// custom-cursor layer and its scene-transition preset. Writes onto
// PrismHub.cursor / PrismHub.transitionPreset via the source store's updateHub
// (the same route HubBackgroundPicker uses). Editor-chrome scope (Tailwind DS).

import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import type {
  CursorLayerStyle,
  HubTransitionKind,
  PrismHub,
} from '@/lib/prism-graph/types';
import { TRANSITION_PRESETS } from '@/lib/prism-graph/transition-presets';

const CURSOR_OPTIONS: ReadonlyArray<{ style: CursorLayerStyle | 'off'; label: string }> = [
  { style: 'off', label: 'OS' },
  { style: 'ring', label: 'Ring' },
  { style: 'halo', label: 'Halo' },
  { style: 'dot', label: 'Dot' },
  { style: 'beam', label: 'Beam' },
];

export function SceneFxPicker({ hub }: { hub: PrismHub }) {
  const updateHub = useGraphSourceStore((s) => s.updateHub);
  const cursorStyle = hub.cursor?.style ?? 'off';
  const transitionKind = hub.transitionPreset?.kind ?? 'curtain';

  const setCursor = (style: CursorLayerStyle | 'off') => {
    updateHub(hub.hubId, {
      cursor: style === 'off' ? undefined : { style, magnetic: style === 'ring' },
    });
  };
  const setTransition = (kind: HubTransitionKind) => {
    updateHub(hub.hubId, { transitionPreset: { kind } });
  };

  return (
    <div className="space-y-3" data-scene-fx>
      <div className="ds-kicker pt-1">CURSOR (E9)</div>
      <div className="flex flex-wrap gap-1.5" data-cursor-picker>
        {CURSOR_OPTIONS.map((o) => {
          const active = cursorStyle === o.style;
          return (
            <button
              key={o.style}
              data-testid={`cursor-${o.style}`}
              onClick={() => setCursor(o.style)}
              className={`ds-chip ds-press cursor-pointer min-h-[34px] px-2.5 text-[11px] ${
                active ? 'ds-chip--metal' : 'hover:text-ds-text'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      <div className="ds-kicker pt-1">SCENE TRANSITION (E10)</div>
      <div className="flex flex-wrap gap-1.5" data-transition-picker>
        {TRANSITION_PRESETS.map((p) => {
          const active = transitionKind === p.kind;
          return (
            <button
              key={p.kind}
              data-testid={`transition-${p.kind}`}
              onClick={() => setTransition(p.kind)}
              title={p.description}
              className={`ds-chip ds-press cursor-pointer min-h-[34px] px-2.5 text-[11px] ${
                active ? 'ds-chip--metal' : 'hover:text-ds-text'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="text-[9.5px] text-ds-text-low leading-snug">
        The cursor + transition play in the built app (Preview / share URL).
      </div>
    </div>
  );
}
