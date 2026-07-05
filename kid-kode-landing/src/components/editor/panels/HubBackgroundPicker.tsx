'use client';

// THREE-D-BACKGROUNDS — the droppable, customizable 3D-background asset picker
// (D6 / C8 / C9). Mounted in TWO places: the Hub Inspector's Visual tab AND the
// Canvas toolbar's Background group (EDITOR-EXP P6 / C30 — a first-timer in
// canvas should find it without digging into the Inspector). Selecting a preset
// applies it to the active hub by writing ONLY `PrismHub.background` (additive,
// INV-2/INV-5 — never touches scenePosition/layout); the live params (palette /
// density / drift / depth / glow) re-apply in real time and round-trip through
// save→reload because they are persisted on the hub's background layer stack.
// Each preset card carries a zero-WebGPU CSS PREVIEW SWATCH (C29) so the look is
// self-explanatory before applying. Chrome-Arc chrome, NO purple (INV-9).

import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { DS, dsAlpha } from '@/components/editor/design-system';
import { Icon } from '@/components/editor/icons/Icon';
import type {
  PrismHub,
  BackgroundLayerParams,
  BackgroundLayerKind,
} from '@/lib/prism-graph/types';
import {
  BACKGROUND_PRESETS,
  getBackgroundPreset,
  applyBackgroundPreset,
  presetIdOfBackground,
  paramsOfBackground,
  mergeParams,
} from '@/lib/editor/backgrounds/presets';
import { getBackgroundPalette } from '@/lib/editor/backgrounds/palettes';
import type { BackgroundPreset, BackgroundParamControl } from '@/lib/editor/backgrounds/types';

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
      {/* Plain-language flow (C29/C31) — what the controls do, in order. */}
      <div className="text-[10px] text-ds-text-low leading-snug">
        Pick a look below (live preview) → tune it with the sliders → it applies
        to <span className="text-ds-text-mid">{hub.title}</span> instantly — no
        Build needed.
      </div>

      {/* Preset cards — droppable assets. Each card now carries a live CSS
          PREVIEW SWATCH (C29) so a first-timer SEES the look (nebula vs
          particle field vs photoreal plate vs splat) before applying — not
          just a name. The swatch is a zero-WebGPU pure-CSS gradient derived
          from the preset's real palette + dominant layer kind (no extra
          canvases — perf-safe). Click applies to this hub. */}
      <div className="grid grid-cols-2 gap-2">
        {BACKGROUND_PRESETS.map((preset) => {
          const active = preset.id === activeId;
          return (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset.id)}
              className={`p-1.5 ds-well ds-edge rounded-ds-md text-left ds-lift ${active ? 'ds-edge--metal' : ''}`}
              style={active ? { boxShadow: `inset 0 0 0 1px ${DS.metal400}` } : undefined}
            >
              <BackgroundPreviewSwatch preset={preset} active={active} />
              <div className="px-1.5 pt-1.5 pb-1">
                <div className={`text-[12px] font-display font-semibold flex items-center gap-1 ${active ? 'text-ds-metal-300' : 'text-ds-text'}`}>
                  {preset.name}
                  {active && <span className="text-[9px] font-mono text-ds-metal-300">· on</span>}
                </div>
                <div className="text-[10px] text-ds-text-low mt-0.5 leading-snug">{preset.tagline}</div>
              </div>
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

          {/* GENERATE (honest, C29) — the photoreal-plate / splat presets ship
              a fal FLUX-2 + depth plate that is generated at BUILD time (public
              asset URLs, INV-7). There is no live in-editor generation; faking a
              "Generate" button would be dishonest, so we disclose instead. */}
          {(activeId === 'cosmic-drift' || activeId === 'captured-observatory') && (
            <div
              className="px-2.5 py-2 rounded-ds-sm flex items-start gap-2"
              style={{
                background: dsAlpha(DS.ice400, 0.1),
                boxShadow: `inset 0 0 0 1px ${dsAlpha(DS.ice400, 0.26)}`,
              }}
            >
              <Icon name="sparkle" size={12} color={DS.ice300} glow />
              <div className="leading-tight">
                <div className="text-[10px] text-ds-text">Photoreal plate</div>
                <div className="text-[9px] text-ds-text-mid">
                  Ships a fal FLUX-2 + depth plate generated at build time. Live
                  custom generation comes with the asset pipeline.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Per-card preview swatch (C29) ───────────────────────────────────────────
// A self-explanatory, representative thumbnail of the preset's LOOK, built from
// pure CSS over the preset's REAL palette (one source of truth with the render
// layer) + a motif chosen by its dominant layer `kind`:
//   volumetric-nebula → soft radial gas glow (warm/cold by palette)
//   particle-field    → scattered star/ember dots over the base void
//   parallax-plane    → photoreal horizon plate band with depth fade
//   splat             → clustered gaussian-point field (captured scene)
// Zero WebGPU: no canvas, no GL context — just gradients + a handful of
// absolutely-positioned dots. The whole picker spins up exactly ZERO extra
// render surfaces (perf), unlike mounting 5 live background canvases.
function dominantKind(preset: BackgroundPreset): BackgroundLayerKind {
  // The first non-image layer is the dominant visual (env nebula / plate /
  // splat); fall back to the first layer's kind, else 'volumetric-nebula'.
  const layers = preset.build(preset.defaultParams);
  const lead =
    layers.find((l) => l.kind === 'parallax-plane' || l.kind === 'splat') ??
    layers[0];
  return lead?.kind ?? 'volumetric-nebula';
}

function BackgroundPreviewSwatch({ preset, active }: { preset: BackgroundPreset; active: boolean }) {
  const paletteId = (preset.defaultParams.palette as string | undefined) ?? 'brass';
  const pal = getBackgroundPalette(paletteId);
  const kind = dominantKind(preset);

  // Deterministic scatter so the swatch is stable across renders (no jitter
  // between paints). Seeded from the preset id length so each preset differs.
  const seed = preset.id.length * 7 + (paletteId.charCodeAt(0) || 0);
  const rand = (n: number) => {
    const x = Math.sin(seed + n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };

  // Base: the palette's deep void with a subtle gas wash.
  let base: React.CSSProperties = {
    background: `radial-gradient(120% 90% at 50% 110%, ${dsAlpha(pal.gas[0], 0.55)}, ${pal.base} 70%)`,
  };
  let dots: React.ReactNode = null;

  if (kind === 'volumetric-nebula') {
    // Two soft gas blooms + a hot core — the raymarched nebula look.
    base = {
      background:
        `radial-gradient(60% 55% at 32% 38%, ${dsAlpha(pal.glow, 0.9)}, transparent 60%), ` +
        `radial-gradient(75% 70% at 70% 64%, ${dsAlpha(pal.gas[1], 0.85)}, transparent 62%), ` +
        `radial-gradient(120% 100% at 50% 50%, ${dsAlpha(pal.gas[0], 0.6)}, ${pal.base} 78%)`,
    };
  } else if (kind === 'particle-field') {
    // Deep base + a brass core hint; a scattered star/ember field on top.
    base = {
      background: `radial-gradient(80% 70% at 50% 50%, ${dsAlpha(pal.gas[0], 0.5)}, ${pal.base} 72%)`,
    };
    dots = (
      <>
        {Array.from({ length: 22 }).map((_, i) => {
          const sz = 1 + Math.round(rand(i) * 2);
          return (
            <span
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${Math.round(rand(i + 1) * 96) + 2}%`,
                top: `${Math.round(rand(i + 2) * 90) + 4}%`,
                width: sz,
                height: sz,
                background: i % 4 === 0 ? pal.glow : pal.star,
                opacity: 0.45 + rand(i + 3) * 0.5,
                boxShadow: `0 0 ${2 + sz}px ${dsAlpha(pal.glow, 0.7)}`,
              }}
            />
          );
        })}
      </>
    );
  } else if (kind === 'parallax-plane') {
    // Photoreal depth PLATE: a horizon band with a depth-faded foreground +
    // a few foreground stars so it reads "image plate, parallaxed".
    base = {
      background:
        `linear-gradient(178deg, ${dsAlpha(pal.gas[2], 0.85)} 0%, ${dsAlpha(pal.glow, 0.7)} 32%, ${dsAlpha(pal.gas[0], 0.8)} 56%, ${pal.base} 100%)`,
    };
    dots = (
      <>
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1/3"
          style={{ background: `linear-gradient(0deg, ${dsAlpha(pal.base, 0.9)}, transparent)` }}
        />
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${Math.round(rand(i + 5) * 94) + 3}%`,
              top: `${Math.round(rand(i + 6) * 42) + 4}%`,
              width: 1.5,
              height: 1.5,
              background: pal.star,
              opacity: 0.7,
            }}
          />
        ))}
      </>
    );
  } else if (kind === 'splat') {
    // Captured 3D gaussian scene: a clustered point cloud reading as a
    // volumetric hall you fly through, over a deep base.
    base = {
      background: `radial-gradient(90% 80% at 50% 46%, ${dsAlpha(pal.gas[1], 0.55)}, ${pal.base} 76%)`,
    };
    dots = (
      <>
        {Array.from({ length: 30 }).map((_, i) => {
          // Cluster toward center for a "captured volume" read.
          const cx = 50 + (rand(i) - 0.5) * 70;
          const cy = 50 + (rand(i + 1) - 0.5) * 64;
          const sz = 1.5 + rand(i + 2) * 2.5;
          return (
            <span
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${cx}%`,
                top: `${cy}%`,
                width: sz,
                height: sz,
                background: i % 3 === 0 ? pal.glow : pal.gas[1],
                opacity: 0.3 + rand(i + 3) * 0.45,
                filter: 'blur(0.3px)',
              }}
            />
          );
        })}
      </>
    );
  }

  return (
    <div
      aria-hidden
      className="relative w-full h-12 rounded-ds-sm overflow-hidden"
      style={{
        ...base,
        boxShadow: active
          ? `inset 0 0 0 1px ${dsAlpha(DS.metal400, 0.5)}, inset 0 1px 4px rgba(0,0,0,0.5)`
          : 'inset 0 0 0 1px rgba(255,252,242,0.06), inset 0 1px 4px rgba(0,0,0,0.5)',
      }}
    >
      {dots}
    </div>
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
                className={`ds-chip ds-press cursor-pointer !min-h-0 !py-1 !px-2.5 text-[10px] ${active ? 'ds-chip--metal' : ''}`}
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
        <div className="text-[10px] font-mono text-ds-metal-300">{num.toFixed(2)}</div>
      </div>
      <input
        type="range"
        min={ctrl.min ?? 0}
        max={ctrl.max ?? 1}
        step={ctrl.step ?? 0.01}
        value={num}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--ds-metal-400,#b8bcc0)] cursor-pointer"
        style={{ accentColor: DS.metal400 }}
      />
    </div>
  );
}
