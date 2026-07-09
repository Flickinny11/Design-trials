"use client";

// THREE-D-BACKGROUNDS / W-BG — the categorized, searchable 60-entry background
// catalog picker + PROMPT-TO-BACKGROUND. Mounted in TWO places: the Hub
// Inspector's Visual tab AND the Canvas toolbar's Background group. Behaviors:
//   • Search + category chips over the full catalog (catalog.ts query layer).
//   • HOVER = LIVE PREVIEW: the real scene renders the hovered preset through
//     the transient useBackgroundPreviewStore channel — nothing persists until
//     click (which writes ONLY `PrismHub.background` via updateHub, additive
//     INV-2/INV-5 as before).
//   • W-2D honesty gate: a flat (renderMode '2d') hub is offered only entries
//     affirmatively tagged '2d'; a note says so.
//   • Cards carry a baked REAL-RENDER thumb (public/three-d-bg/thumbs/<id>);
//     the CSS palette swatch remains the loading/absent fallback.
//   • GENERATE: a prompt goes to /api/prism/background-generate with the hub's
//     live context (elements/palette/mood/renderMode); the server picks a
//     grammar family (anti-repetition), plans R1/R2/R3, returns a layer stack
//     that applies immediately and lands in MY LIBRARY (per-tenant store).

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useGraphSourceStore } from "@/stores/useGraphSourceStore";
import { useBackgroundPreviewStore } from "@/stores/useBackgroundPreviewStore";
import { DS, dsAlpha } from "@/components/editor/design-system";
import { Icon } from "@/components/editor/icons/Icon";
import type {
  PrismHub,
  PrismNode,
  BackgroundLayerParams,
  BackgroundLayerKind,
  PrismHubBackgroundLayer,
} from "@/lib/prism-graph/types";
import {
  BACKGROUND_PRESETS,
  getBackgroundPreset,
  applyBackgroundPreset,
  presetIdOfBackground,
  paramsOfBackground,
  mergeParams,
} from "@/lib/editor/backgrounds/presets";
import { getBackgroundPalette } from "@/lib/editor/backgrounds/palettes";
import {
  hubRenderModeOf,
  catalogForRenderMode,
  groupByCategory,
  searchCatalog,
} from "@/lib/editor/backgrounds/catalog";
import type {
  BackgroundPreset,
  BackgroundParamControl,
  BackgroundCategoryId,
} from "@/lib/editor/backgrounds/types";
import { BACKGROUND_CATEGORY_LABELS } from "@/lib/editor/backgrounds/types";

/** A generated background saved to the tenant library (server shape). */
export interface SavedBackgroundItem {
  id: string;
  name: string;
  prompt: string;
  route: "R1" | "R2" | "R3";
  grammarFamily: string;
  palette: string;
  renderMode: "2d" | "3d";
  createdAt: string;
  layers: PrismHubBackgroundLayer[];
  downgraded?: boolean;
  notice?: string;
}

const HOVER_DELAY_MS = 110;

export function HubBackgroundPicker({ hub }: { hub: PrismHub }) {
  const updateHub = useGraphSourceStore((s) => s.updateHub);
  const nodes = useGraphSourceStore((s) => s.nodes);
  const previewBg = useBackgroundPreviewStore((s) => s.preview);
  const clearPreview = useBackgroundPreviewStore((s) => s.clear);

  const activeId = presetIdOfBackground(hub.background);
  const activePreset = getBackgroundPreset(activeId);
  const params =
    paramsOfBackground(hub.background) ?? activePreset?.defaultParams ?? {};

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | BackgroundCategoryId>("all");

  const mode = hubRenderModeOf(hub);
  const fitting = useMemo(() => catalogForRenderMode(mode), [mode]);
  const visible = useMemo(() => {
    const pool =
      category === "all"
        ? fitting
        : fitting.filter((p) => p.category === category);
    return searchCatalog(query, pool);
  }, [fitting, category, query]);
  const groups = useMemo(() => groupByCategory(visible), [visible]);
  const chipCategories = useMemo(() => groupByCategory(fitting), [fitting]);

  // ── hover live preview (transient — see useBackgroundPreviewStore) ────────
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPreview = useCallback(
    (layers: PrismHubBackgroundLayer[]) => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      hoverTimer.current = setTimeout(
        () => previewBg(hub.hubId, layers),
        HOVER_DELAY_MS,
      );
    },
    [hub.hubId, previewBg],
  );
  const endPreview = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    clearPreview();
  }, [clearPreview]);
  // Leaving the picker entirely (unmount) must never strand a preview.
  useEffect(() => endPreview, [endPreview]);

  const applyPreset = (presetId: string) => {
    const preset = getBackgroundPreset(presetId);
    if (!preset) return;
    clearPreview();
    // Carry compatible params over when switching presets; defaults fill the rest.
    updateHub(hub.hubId, {
      background: applyBackgroundPreset(presetId, mergeParams(preset, params)),
    });
  };
  const clear = () => {
    clearPreview();
    updateHub(hub.hubId, { background: [] });
  };
  const setParam = (key: string, value: number | string) => {
    if (!activeId) return;
    updateHub(hub.hubId, {
      background: applyBackgroundPreset(activeId, {
        ...params,
        [key]: value,
      } as BackgroundLayerParams),
    });
  };

  // ── prompt-to-background ───────────────────────────────────────────────────
  const [genPrompt, setGenPrompt] = useState("");
  const [genBusy, setGenBusy] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genNotice, setGenNotice] = useState<string | null>(null);
  const [library, setLibrary] = useState<SavedBackgroundItem[]>([]);

  useEffect(() => {
    let alive = true;
    fetch("/api/prism/background-generate")
      .then((r) => r.json())
      .then((d) => {
        if (alive && d?.ok && Array.isArray(d.items)) setLibrary(d.items);
      })
      .catch(() => {
        /* library list is best-effort */
      });
    return () => {
      alive = false;
    };
  }, []);

  const generate = async () => {
    const prompt = genPrompt.trim();
    if (!prompt || genBusy) return;
    setGenBusy(true);
    setGenError(null);
    setGenNotice(null);
    try {
      const hubNodes = nodes.filter(
        (n: PrismNode) => n.parentHubId === hub.hubId,
      );
      const res = await fetch("/api/prism/background-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "generate",
          prompt,
          hub: {
            hubId: hub.hubId,
            title: hub.title,
            renderMode: mode,
            identity: hub.identity ?? null,
            activePalette: (params.palette as string) ?? null,
            nodes: hubNodes.slice(0, 32).map((n: PrismNode) => ({
              caption: n.intent?.caption ?? null,
              subtype: n.subtype ?? null,
              baseColor: n.materialSpec?.baseColor ?? null,
            })),
          },
        }),
      });
      const data = await res.json();
      if (!data?.ok || !data.item) {
        setGenError(String(data?.error ?? "Generation failed."));
        return;
      }
      const item = data.item as SavedBackgroundItem;
      updateHub(hub.hubId, { background: item.layers });
      setLibrary((prev) => [item, ...prev.filter((x) => x.id !== item.id)]);
      if (item.notice) setGenNotice(item.notice);
      setGenPrompt("");
    } catch {
      setGenError("Generation request failed — is the dev server up?");
    } finally {
      setGenBusy(false);
    }
  };

  const applyLibraryItem = (item: SavedBackgroundItem) => {
    clearPreview();
    updateHub(hub.hubId, { background: item.layers });
  };

  return (
    <>
      <div className="ds-kicker pt-2 flex items-center justify-between">
        <span>3D BACKGROUND</span>
        {(activeId || (hub.background?.length ?? 0) > 0) && (
          <button
            onClick={clear}
            className="ds-chip ds-press cursor-pointer !min-h-0 !py-1 !px-2 text-[10px]"
          >
            Clear
          </button>
        )}
      </div>
      <div className="text-[10px] text-ds-text-low leading-snug">
        Hover a card to preview it live on{" "}
        <span className="text-ds-text-mid">{hub.title}</span> → click to apply →
        tune with the sliders. Or describe your own below — Generate reads
        what&apos;s already on this hub.
        {/* UXV-F8: on hubs with a full-bleed hero the background layer sits
            BEHIND the hero, so the live hover-preview can be invisible —
            say so instead of letting the promise read as broken. */}
        <span className="block pt-0.5 opacity-80">
          Backgrounds sit behind everything — on a hub with a full-bleed hero
          the preview may only peek around its edges.
        </span>
      </div>

      {/* Search + category chips */}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${fitting.length} backgrounds…`}
        className="ds-input w-full font-ui text-[12px] px-2.5 py-1.5 rounded-ds-sm"
        aria-label="Search backgrounds"
      />
      <div className="flex flex-wrap gap-1.5">
        <CategoryChip
          label={`All · ${fitting.length}`}
          active={category === "all"}
          onClick={() => setCategory("all")}
        />
        {chipCategories.map((g) => (
          <CategoryChip
            key={g.category}
            label={`${BACKGROUND_CATEGORY_LABELS[g.category]} · ${g.entries.length}`}
            active={category === g.category}
            onClick={() =>
              setCategory(category === g.category ? "all" : g.category)
            }
          />
        ))}
      </div>

      {/* W-2D honesty note */}
      {mode === "2d" && (
        <div
          className="px-2.5 py-1.5 rounded-ds-sm text-[10px] text-ds-text-mid"
          style={{
            background: dsAlpha(DS.ice400, 0.08),
            boxShadow: `inset 0 0 0 1px ${dsAlpha(DS.ice400, 0.2)}`,
          }}
        >
          Flat hub — showing the {fitting.length} of {BACKGROUND_PRESETS.length}{" "}
          backgrounds tagged 2D-native. Switch the hub to 3D Depth for the full
          catalog.
        </div>
      )}

      {/* Catalog groups */}
      {groups.length === 0 && (
        <div className="text-[11px] text-ds-text-low py-2">
          Nothing matches “{query}”. Try a mood (calm, electric), a colour, or a
          family (silk, aurora, plate).
        </div>
      )}
      {groups.map((group) => (
        <div key={group.category} className="space-y-1.5">
          <div className="ds-kicker flex items-center justify-between">
            <span>{BACKGROUND_CATEGORY_LABELS[group.category]}</span>
            <span className="text-ds-text-low font-mono text-[9px]">
              {group.entries.length}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {group.entries.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                active={preset.id === activeId}
                onApply={() => applyPreset(preset.id)}
                onEnter={() =>
                  startPreview(
                    applyBackgroundPreset(
                      preset.id,
                      mergeParams(preset, params),
                    ),
                  )
                }
                onLeave={endPreview}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Live customization controls for the active preset. */}
      {activePreset && (
        <div className="space-y-2.5 pt-1">
          <div className="ds-kicker">CUSTOMIZE — {activePreset.name}</div>
          {activePreset.controls.map((ctrl) => (
            <ParamControl
              key={String(ctrl.id)}
              ctrl={ctrl}
              value={
                params[ctrl.id as keyof BackgroundLayerParams] ?? ctrl.default
              }
              onChange={(v) => setParam(String(ctrl.id), v)}
            />
          ))}
        </div>
      )}

      {/* PROMPT-TO-BACKGROUND */}
      <div className="space-y-1.5 pt-2">
        <div className="ds-kicker flex items-center gap-1.5">
          <Icon name="sparkle" size={11} color={DS.arc} glow />
          <span>GENERATE — PROMPT TO BACKGROUND</span>
        </div>
        <div className="text-[10px] text-ds-text-low leading-snug">
          Describes a look → Prism reads this hub&apos;s elements, palette and
          mood, picks a design-grammar family, and builds it as a real
          background (procedural or a generated photo plate).
        </div>
        <textarea
          value={genPrompt}
          onChange={(e) => setGenPrompt(e.target.value)}
          rows={2}
          placeholder="e.g. slow warm dusk with drifting embers, quiet enough for reading"
          className="ds-input w-full font-ui text-[12px] px-2.5 py-1.5 rounded-ds-sm resize-none"
          aria-label="Describe the background to generate"
        />
        <button
          onClick={generate}
          disabled={genBusy || !genPrompt.trim()}
          className="ds-chip ds-chip--metal ds-press cursor-pointer w-full !py-1.5 text-[11px] disabled:opacity-40 disabled:cursor-default"
        >
          {genBusy
            ? "Generating — reading hub + planning route…"
            : "Generate background"}
        </button>
        {genError && (
          <div
            className="px-2.5 py-1.5 rounded-ds-sm text-[10px]"
            style={{
              color: DS.danger,
              background: dsAlpha(DS.danger, 0.08),
              boxShadow: `inset 0 0 0 1px ${dsAlpha(DS.danger, 0.25)}`,
            }}
          >
            {genError}
          </div>
        )}
        {genNotice && (
          <div
            className="px-2.5 py-1.5 rounded-ds-sm text-[10px] text-ds-text-mid"
            style={{
              background: dsAlpha(DS.ice400, 0.08),
              boxShadow: `inset 0 0 0 1px ${dsAlpha(DS.ice400, 0.2)}`,
            }}
          >
            {genNotice}
          </div>
        )}
      </div>

      {/* MY LIBRARY — saved generations */}
      {library.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="ds-kicker flex items-center justify-between">
            <span>MY LIBRARY</span>
            <span className="text-ds-text-low font-mono text-[9px]">
              {library.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {library.map((item) => (
              <button
                key={item.id}
                onClick={() => applyLibraryItem(item)}
                onMouseEnter={() => startPreview(item.layers)}
                onMouseLeave={endPreview}
                className="w-full p-2 ds-well ds-edge rounded-ds-md text-left ds-lift"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-display font-semibold text-ds-text truncate">
                    {item.name}
                  </span>
                  <span className="text-[9px] font-mono text-ds-metal-300 shrink-0">
                    {item.route} ·{" "}
                    {item.grammarFamily.split("-").slice(0, 2).join("-")}
                  </span>
                </div>
                <div className="text-[10px] text-ds-text-low truncate mt-0.5">
                  “{item.prompt}”
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`ds-chip ds-press cursor-pointer !min-h-0 !py-1 !px-2 text-[10px] ${active ? "ds-chip--metal" : ""}`}
    >
      {label}
    </button>
  );
}

// ── Preset card: baked real-render thumb with CSS-swatch fallback ───────────
function PresetCard({
  preset,
  active,
  onApply,
  onEnter,
  onLeave,
}: {
  preset: BackgroundPreset;
  active: boolean;
  onApply: () => void;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const showThumb = !!preset.thumbUrl && !thumbFailed;
  return (
    <button
      onClick={onApply}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      className={`p-1.5 ds-well ds-edge rounded-ds-md text-left ds-lift ${active ? "ds-edge--metal" : ""}`}
      style={
        active ? { boxShadow: `inset 0 0 0 1px ${DS.metal400}` } : undefined
      }
    >
      {showThumb ? (
        <div className="relative w-full h-12 rounded-ds-sm overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element -- baked catalog
              thumb, fixed tiny size; next/image adds nothing here */}
          <img
            src={preset.thumbUrl}
            alt=""
            aria-hidden
            loading="lazy"
            onError={() => setThumbFailed(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
      ) : (
        <BackgroundPreviewSwatch preset={preset} active={active} />
      )}
      <div className="px-1.5 pt-1.5 pb-1">
        <div
          className={`text-[12px] font-display font-semibold flex items-center gap-1 ${active ? "text-ds-metal-300" : "text-ds-text"}`}
        >
          {preset.name}
          {active && (
            <span className="text-[9px] font-mono text-ds-metal-300">· on</span>
          )}
        </div>
        <div className="text-[10px] text-ds-text-low mt-0.5 leading-snug">
          {preset.tagline}
        </div>
        <div className="flex items-center gap-1 mt-1 text-[8px] font-mono text-ds-text-low">
          <span>{preset.motion}</span>
          <span>·</span>
          <span>{preset.perfTier}</span>
          {preset.renderModes.includes("2d") && (
            <>
              <span>·</span>
              <span style={{ color: DS.ice300 }}>2D-OK</span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Per-card CSS fallback swatch (kept from the launch picker, C29) ─────────
// Used while a baked thumb is loading/missing. Pure CSS over the preset's real
// palette + a motif from its dominant layer kind — zero extra GL surfaces.
function dominantKind(preset: BackgroundPreset): BackgroundLayerKind {
  const layers = preset.build(preset.defaultParams);
  const lead =
    layers.find((l) => l.kind === "parallax-plane" || l.kind === "splat") ??
    layers[0];
  return lead?.kind ?? "volumetric-nebula";
}

function BackgroundPreviewSwatch({
  preset,
  active,
}: {
  preset: BackgroundPreset;
  active: boolean;
}) {
  const paletteId =
    (preset.defaultParams.palette as string | undefined) ?? "brass";
  const pal = getBackgroundPalette(paletteId);
  const kind = dominantKind(preset);

  const seed = preset.id.length * 7 + (paletteId.charCodeAt(0) || 0);
  const rand = (n: number) => {
    const x = Math.sin(seed + n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };

  let base: React.CSSProperties = {
    background: `radial-gradient(120% 90% at 50% 110%, ${dsAlpha(pal.gas[0], 0.55)}, ${pal.base} 70%)`,
  };
  let dots: React.ReactNode = null;

  if (
    kind === "volumetric-nebula" ||
    kind === "gradient-volume" ||
    kind === "fluid-overlay"
  ) {
    base = {
      background:
        `radial-gradient(60% 55% at 32% 38%, ${dsAlpha(pal.glow, 0.9)}, transparent 60%), ` +
        `radial-gradient(75% 70% at 70% 64%, ${dsAlpha(pal.gas[1], 0.85)}, transparent 62%), ` +
        `radial-gradient(120% 100% at 50% 50%, ${dsAlpha(pal.gas[0], 0.6)}, ${pal.base} 78%)`,
    };
  } else if (kind === "particle-field") {
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
  } else if (kind === "parallax-plane") {
    base = {
      background: `linear-gradient(178deg, ${dsAlpha(pal.gas[2], 0.85)} 0%, ${dsAlpha(pal.glow, 0.7)} 32%, ${dsAlpha(pal.gas[0], 0.8)} 56%, ${pal.base} 100%)`,
    };
  } else if (kind === "splat") {
    base = {
      background: `radial-gradient(90% 80% at 50% 46%, ${dsAlpha(pal.gas[1], 0.55)}, ${pal.base} 76%)`,
    };
  }

  return (
    <div
      aria-hidden
      className="relative w-full h-12 rounded-ds-sm overflow-hidden"
      style={{
        ...base,
        boxShadow: active
          ? `inset 0 0 0 1px ${dsAlpha(DS.metal400, 0.5)}, inset 0 1px 4px rgba(0,0,0,0.5)`
          : "inset 0 0 0 1px rgba(255,252,242,0.06), inset 0 1px 4px rgba(0,0,0,0.5)",
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
  if (ctrl.type === "select") {
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
                className={`ds-chip ds-press cursor-pointer !min-h-0 !py-1 !px-2.5 text-[10px] ${active ? "ds-chip--metal" : ""}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  const num =
    typeof value === "number"
      ? value
      : Number(value) || (ctrl.default as number);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="ds-label">{ctrl.label}</div>
        <div className="text-[10px] font-mono text-ds-metal-300">
          {num.toFixed(2)}
        </div>
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
