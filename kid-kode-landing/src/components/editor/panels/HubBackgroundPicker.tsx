'use client';

// THREE-D-BACKGROUNDS — the droppable, customizable 3D-background asset picker
// (D6 / C8 / C9). Lives in the Hub Inspector's Visual tab. Selecting a preset
// applies it to the active hub by writing ONLY `PrismHub.background` (additive,
// INV-2/INV-5 — never touches scenePosition/layout); the live params (palette /
// density / drift / depth / glow) re-apply in real time and round-trip through
// save→reload because they are persisted on the hub's background layer stack.
// Observatory-Brass chrome, NO purple (INV-9).

import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { DS } from '@/components/editor/design-system';
import type { PrismHub, BackgroundLayerParams } from '@/lib/prism-graph/types';
import {
  BACKGROUND_PRESETS,
  getBackgroundPreset,
  applyBackgroundPreset,
  presetIdOfBackground,
  paramsOfBackground,
  mergeParams,
} from '@/lib/editor/backgrounds/presets';
import type { BackgroundParamControl } from '@/lib/editor/backgrounds/types';

export function HubBackgroundPicker({ hub }: { hub: PrismHub }) {
  const updateHub = useGraphSourceStore((s) => s.updateHub);
  const activeId = presetIdOfBackground(hub.background);
  const activePreset = getBackgroundPreset(activeId);
  const params = paramsOfBackground(hub.background) ?? activePreset?.defaultParams ?? {};

  const applyPreset = (presetId: string) => {
    const preset = getBackgroundPreset(presetId);
    if (!preset) return;
    // Carry compatible params over when switching presets; defaults fill the rest.
    updateHub(hub.hubId, { background: applyBackgroundPreset(presetId, mergeParams(preset, params)) });
  };
  const clear = () => updateHub(hub.hubId, { background: [] });
  const setParam = (key: string, value: number | string) => {
    if (!activeId) return;
    updateHub(hub.hubId, {
      background: applyBackgroundPreset(activeId, { ...params, [key]: value } as BackgroundLayerParams),
    });
  };

  return (
    <>
      <div className="ds-kicker pt-2 flex items-center justify-between">
        <span>3D BACKGROUND</span>
        {activeId && (
          <button onClick={clear} className="ds-chip ds-press cursor-pointer !min-h-0 !py-1 !px-2 text-[10px]">
            Clear
          </button>
        )}
      </div>

      {/* Preset cards — droppable assets. Click applies to this hub. */}
      <div className="grid grid-cols-2 gap-2">
        {BACKGROUND_PRESETS.map((preset) => {
          const active = preset.id === activeId;
          return (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset.id)}
              className={`px-3 py-2.5 ds-well ds-edge rounded-ds-md text-left ds-lift ${active ? 'ds-edge--brass' : ''}`}
              style={active ? { boxShadow: `inset 0 0 0 1px ${DS.brass400}` } : undefined}
            >
              <div className={`text-[12px] font-display font-semibold ${active ? 'text-ds-brass-300' : 'text-ds-text'}`}>
                {preset.name}
              </div>
              <div className="text-[10px] text-ds-text-low mt-0.5 leading-snug">{preset.tagline}</div>
            </button>
          );
        })}
      </div>

      {/* Live customization controls for the active preset. */}
      {activePreset && (
        <div className="space-y-2.5 pt-1">
          <div className="ds-kicker">CUSTOMIZE</div>
          {activePreset.controls.map((ctrl) => (
            <ParamControl
              key={String(ctrl.id)}
              ctrl={ctrl}
              value={params[ctrl.id as keyof BackgroundLayerParams] ?? ctrl.default}
              onChange={(v) => setParam(String(ctrl.id), v)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function ParamControl({
  ctrl,
  value,
  onChange,
}: {
  ctrl: BackgroundParamControl;
  value: number | string;
  onChange: (v: number | string) => void;
}) {
  if (ctrl.type === 'select') {
    return (
      <div className="space-y-1">
        <div className="ds-label">{ctrl.label}</div>
        <div className="flex flex-wrap gap-1.5">
          {(ctrl.options ?? []).map((opt) => {
            const active = String(value) === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onChange(opt.value)}
                className={`ds-chip ds-press cursor-pointer !min-h-0 !py-1 !px-2.5 text-[10px] ${active ? 'ds-chip--brass' : ''}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  // knob / slider → a styled range input.
  const num = typeof value === 'number' ? value : Number(value) || (ctrl.default as number);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="ds-label">{ctrl.label}</div>
        <div className="text-[10px] font-mono text-ds-brass-300">{num.toFixed(2)}</div>
      </div>
      <input
        type="range"
        min={ctrl.min ?? 0}
        max={ctrl.max ?? 1}
        step={ctrl.step ?? 0.01}
        value={num}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--ds-brass-400,#cd9f55)] cursor-pointer"
        style={{ accentColor: DS.brass400 }}
      />
    </div>
  );
}
