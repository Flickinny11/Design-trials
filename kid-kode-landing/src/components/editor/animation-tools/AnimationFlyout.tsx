'use client';

// P2 TOOLBAR WIRING (Task B) — the Animation toolbar group flyout
// (canvas-spec §5 Animation group, §8.2 driver model, §8.3 the Primitive
// Catalog picker; criteria 12 + 13).
//
// The payoff: select a node → browse the full Animatable registry as LIVE
// hover-play tiles (the catalog's shared-rig machinery, one WebGPU canvas) →
// click to bind → the binding lands on `node.animationBindings` and is
// editable here (driver chips, ControlSchema params via the catalog's
// ControlPanel — INV-5 one renderer, reorder, remove).
//
// Wiring contract:
//   - Structural binding writes go through useGraphSourceStore updateNode —
//     the toolbar-sanctioned route (FP-15 restricts Inspector tabs, not the
//     toolbar; same write family as the wired Lighting group).
//   - Live previews REUSE the animation-catalog machinery (SharedViewport +
//     the sharedRig singleton). The rig's canvas is body-mounted by
//     flyout-rig.ts (full-viewport, dpr≤2-sharp, clipped to this flyout).
//   - Param edits drive the LIVE preview instance via Animatable.setControl
//     and persist to binding.params through a param-sink proxy around the
//     instance (ControlPanel is reused untouched).
//   - Drivers assign playback input only — never app behavior (§1.3). The
//     canvas stays an editing surface: bindings PLAY in Preview App.
//
// RAISED BAR (Logan directive 2026-06-10): GSAP staggered entrances, magnetic
// elastic hover on tiles (≤6px pointer-proximity translate), Observatory
// Brass machined treatments on every surface — wells, keys, chamfers, brass
// glows, kicker typography. Nothing flat. No purple. Icon component only.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Icon } from '@/components/editor/icons/Icon';
import {
  DS,
  DS_ACCENT,
  DS_CATEGORY_TINTS,
  dsAlpha,
} from '@/components/editor/design-system';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import SharedViewport from '@/components/editor/animation-catalog/SharedViewport';
import ControlPanel from '@/components/editor/animation-catalog/ControlPanel';
import { listPrimitives } from '@/lib/prism/animatable/registry';
import { registerAllPrimitives } from '@/lib/prism/animatable/primitives';
import { PRIMITIVE_CATEGORIES } from '@/lib/prism/animatable/contract';
import type {
  Animatable,
  ParamState,
  PrimitiveCategory,
  PrimitiveDefinition,
} from '@/lib/prism/animatable/contract';
import type {
  AnimationBinding,
  AnimationDriverKind,
  PrismNode,
} from '@/lib/prism-graph/types';
import {
  DRIVER_OPTIONS,
  appendBinding,
  clampPage,
  driverLabel,
  filterPrimitives,
  moveBinding,
  pageCount,
  pageSlice,
  removeBinding,
  setBindingDriver,
  setBindingDriverOptions,
  setBindingParams,
  sortBindings,
} from './binding-helpers';
import { attachMagnetic } from './magnetic';
import { ensureFlyoutRig, setRigClip } from './flyout-rig';
import {
  ChipKey,
  KEY_BG,
  KEY_SHADOW,
  SectionLabel,
  WELL_SHADOW,
  WellInput,
  activeKeyStyle,
} from './ui';

// Populate the Animatable registry (idempotent — same call the catalog makes).
registerAllPrimitives();

const PAGE_SIZE = 9;

// ── Param-sink proxy: lets the reused ControlPanel drive the LIVE preview
// instance while every setControl also persists to binding.params ───────────
function withParamSink(
  inst: Animatable,
  sink: (params: ParamState) => void,
): Animatable {
  return {
    name: inst.name,
    category: inst.category,
    duration: () => inst.duration(),
    seek: (t) => inst.seek(t),
    controls: () => inst.controls(),
    setControl: (id, v) => {
      inst.setControl(id, v);
      sink(inst.getParams());
    },
    getParams: () => inst.getParams(),
    serialize: () => inst.serialize(),
    dispose: () => inst.dispose(),
  };
}

export default function AnimationFlyout({
  node,
  multiCount = 0,
  onToast,
  keyframeOpen,
  onToggleKeyframe,
  onComing,
}: {
  /** Currently selected node (or null → contextual empty state). */
  node: PrismNode | null;
  /** Size of the multi-selection (no anchor → still gated; copy explains). */
  multiCount?: number;
  onToast: (msg: string) => void;
  /** §8.4 keyframe editor slide-up toggle (owned by CanvasToolbar). */
  keyframeOpen: boolean;
  onToggleKeyframe: () => void;
  /** Coming-state surface for the still-deferred bespoke authoring lane. */
  onComing: (tool: string) => void;
}) {
  const setViewMode = useGraphEditorStore((s) => s.setViewMode);

  const defs = useMemo(() => listPrimitives(), []);
  const defByName = useMemo(() => {
    const m = new Map<string, PrimitiveDefinition>();
    for (const d of defs) m.set(d.name, d);
    return m;
  }, [defs]);

  // ── Picker state ───────────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<PrimitiveCategory | null>(null);
  const [page, setPage] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInst, setEditInst] = useState<Animatable | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => filterPrimitives(defs, query, category),
    [defs, query, category],
  );
  const safePage = clampPage(page, filtered.length, PAGE_SIZE);
  const pages = pageCount(filtered.length, PAGE_SIZE);
  const visible = useMemo(
    () => pageSlice(filtered, safePage, PAGE_SIZE),
    [filtered, safePage],
  );

  useEffect(() => setPage(0), [query, category]);
  // Selection change: collapse any open param editor (it belongs to the node).
  useEffect(() => {
    setEditingId(null);
    setEditInst(null);
  }, [node?.nodeId]);

  // ── Shared rig lifecycle: body-mounted canvas + per-frame clip to this
  // flyout's content rect (previews can never bleed past the glass) ──────────
  useEffect(() => {
    ensureFlyoutRig();
    let raf = 0;
    const track = () => {
      raf = requestAnimationFrame(track);
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRigClip({ top: r.top, right: r.right, bottom: r.bottom, left: r.left }, 10);
    };
    track();
    return () => {
      cancelAnimationFrame(raf);
      setRigClip(null);
    };
  }, []);

  // ── RAISED BAR: GSAP open choreography — staggered section reveal ──────────
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const sections = root.querySelectorAll('[data-anim-section]');
    if (!sections.length) return;
    const tween = gsap.fromTo(
      sections,
      { y: 10, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.4,
        stagger: 0.06,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
      },
    );
    return () => {
      tween.kill();
    };
    // Re-choreograph when the empty state swaps to the working surface.
  }, [node ? 'node' : 'empty']);

  // Tile-grid entrance: springy stagger on every page / filter change. y +
  // scale only (no opacity — the GPU windows paint at full alpha above the
  // chrome, and the per-frame rect read makes them TRACK the spring).
  const gridKey = `${category ?? 'all'}|${query}|${safePage}`;
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const tiles = grid.querySelectorAll('[data-anim-tile]');
    if (!tiles.length) return;
    const tween = gsap.fromTo(
      tiles,
      { y: 12, scale: 0.92 },
      {
        y: 0,
        scale: 1,
        duration: 0.45,
        stagger: 0.035,
        ease: 'back.out(1.8)',
        overwrite: 'auto',
        clearProps: 'transform',
      },
    );
    return () => {
      tween.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridKey, node ? 'node' : 'empty']);

  // ── Binding writes — toolbar-sanctioned source-store route. Reads the
  // freshest list from the store so rapid fader drags never race a stale
  // render snapshot. ─────────────────────────────────────────────────────────
  const mutateBindings = useCallback(
    (fn: (cur: AnimationBinding[]) => AnimationBinding[]) => {
      if (!node) return;
      const st = useGraphSourceStore.getState();
      const live = st.nodes.find((n) => n.nodeId === node.nodeId);
      st.updateNode(node.nodeId, {
        animationBindings: fn(sortBindings(live?.animationBindings ?? [])),
      });
    },
    [node],
  );

  const apply = useCallback(
    (def: PrimitiveDefinition) => {
      if (!node) return;
      mutateBindings((cur) => appendBinding(cur, def.name));
      onToast(`Bound “${def.label}” · plays on ${driverLabel('time')}`);
    },
    [node, mutateBindings, onToast],
  );

  const bindings = useMemo(
    () => sortBindings(node?.animationBindings ?? []),
    [node],
  );
  const appliedCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of bindings) m.set(b.primitive, (m.get(b.primitive) ?? 0) + 1);
    return m;
  }, [bindings]);

  const editingBinding = editingId
    ? bindings.find((b) => b.id === editingId) ?? null
    : null;
  const editingDef = editingBinding
    ? defByName.get(editingBinding.primitive) ?? null
    : null;
  const sinkInst = useMemo(() => {
    if (!editInst || !editingId) return null;
    return withParamSink(editInst, (params) =>
      mutateBindings((cur) => setBindingParams(cur, editingId, params)),
    );
  }, [editInst, editingId, mutateBindings]);

  const caption =
    node?.intent?.caption?.split(' · ')[0] || node?.subtype || node?.nodeId || '';

  return (
    <div
      ref={rootRef}
      data-component="animation-flyout"
      className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2.5 pr-0.5"
    >
      {!node ? (
        // ── Contextual empty state (DS-styled, like the other gated groups) ──
        <div data-anim-section className="flex flex-col items-center text-center gap-2.5 py-5 px-3">
          <div className="w-10 h-10 ds-well flex items-center justify-center">
            <Icon name="wand" size={17} color={DS.metal300} glow />
          </div>
          <span className="text-[10px] font-mono leading-relaxed" style={{ color: 'var(--ds-text)' }}>
            {multiCount >= 2
              ? `${multiCount} elements selected — narrow to ONE`
              : 'Select a built element on the canvas'}
          </span>
          <span className="text-[9px] font-mono leading-relaxed" style={{ color: 'var(--ds-text-low)' }}>
            {multiCount >= 2
              ? 'Animation binds per element. Click a single element (or marquee just one) to browse and bind.'
              : `Then browse ${defs.length} live primitives, click one to bind it, and assign its driver — Load/Time, Scroll, Pointer, State or Event.`}
          </span>
        </div>
      ) : (
        <>
          {/* ── Selection plate ── */}
          <div data-anim-section className="flex items-center gap-2 px-2.5 py-2 ds-well">
            <Icon name="wand" size={12} color={DS_ACCENT} />
            <span className="flex-1 text-[10px] font-mono truncate" style={{ color: 'var(--ds-text)' }}>
              {caption}
            </span>
            <span className="text-[9px] font-mono tabular-nums" style={{ color: 'var(--ds-text-low)' }}>
              {bindings.length} bound
            </span>
          </div>

          {/* ── Picker: search + category chips + LIVE tile grid (§8.3) ── */}
          <div data-anim-section className="flex flex-col gap-1.5">
            <SectionLabel>Catalog · {defs.length} primitives · hover plays</SectionLabel>
            <WellInput
              value={query}
              onChange={setQuery}
              placeholder={`Search ${defs.length} primitives…`}
              testId="anim-search"
            />
            <div className="flex gap-1 overflow-x-auto pb-1 -mb-1" style={{ scrollbarWidth: 'none' }}>
              <ChipKey
                label="All"
                active={category === null}
                onClick={() => setCategory(null)}
                testId="anim-cat-all"
              />
              {PRIMITIVE_CATEGORIES.map((c) => (
                <ChipKey
                  key={c}
                  label={c}
                  active={category === c}
                  onClick={() => setCategory((cur) => (cur === c ? null : c))}
                  testId={`anim-cat-${c}`}
                />
              ))}
            </div>
          </div>

          <div data-anim-section className="flex flex-col gap-1.5">
            {visible.length === 0 ? (
              <div className="px-2.5 py-3 ds-well text-[9px] font-mono text-center" style={{ color: 'var(--ds-text-low)' }}>
                No primitive matches “{query}”{category ? ` in ${category}` : ''}.
              </div>
            ) : (
              <div ref={gridRef} className="grid grid-cols-3 gap-1.5">
                {visible.map((d) => (
                  <PickerTile
                    key={d.name}
                    def={d}
                    appliedCount={appliedCounts.get(d.name) ?? 0}
                    onApply={apply}
                  />
                ))}
              </div>
            )}
            {/* Pager — machined keys + recessed readout */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                data-action="anim-page-prev"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className={`w-6 h-6 rounded-ds-xs ds-press transition-all flex items-center justify-center ${safePage === 0 ? 'opacity-40 cursor-not-allowed' : 'hover:brightness-[1.2]'}`}
                style={{ background: KEY_BG, boxShadow: KEY_SHADOW }}
              >
                <Icon name="chevron" size={10} color={DS.text} style={{ transform: 'rotate(180deg)' }} />
              </button>
              <span
                className="flex-1 text-center text-[9px] font-mono tabular-nums px-1 py-1 rounded-ds-xs"
                style={{ color: 'var(--ds-metal-300)', background: 'var(--ds-grad-well)', boxShadow: WELL_SHADOW }}
              >
                {filtered.length === 0 ? 'no matches' : `${safePage + 1} / ${pages} · ${filtered.length} match${filtered.length === 1 ? '' : 'es'}`}
              </span>
              <button
                type="button"
                data-action="anim-page-next"
                disabled={safePage >= pages - 1}
                onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
                className={`w-6 h-6 rounded-ds-xs ds-press transition-all flex items-center justify-center ${safePage >= pages - 1 ? 'opacity-40 cursor-not-allowed' : 'hover:brightness-[1.2]'}`}
                style={{ background: KEY_BG, boxShadow: KEY_SHADOW }}
              >
                <Icon name="chevron" size={10} color={DS.text} />
              </button>
            </div>
          </div>

          {/* ── Bound list: driver chips, params, reorder, remove ── */}
          <div data-anim-section className="flex flex-col gap-1.5">
            <SectionLabel>On this element · stack order</SectionLabel>
            {bindings.length === 0 ? (
              <div className="text-[8.5px] font-mono leading-tight px-1 py-1" style={{ color: 'var(--ds-text-low)' }}>
                Nothing bound yet — click a tile above to bind it. Multiple
                primitives stack and compose.
              </div>
            ) : (
              bindings.map((b, i) => {
                const def = defByName.get(b.primitive) ?? null;
                const editing = editingId === b.id;
                const tint = DS_CATEGORY_TINTS[def?.category ?? ''] ?? DS_CATEGORY_TINTS.default;
                return (
                  <div
                    key={b.id}
                    data-binding-id={b.id}
                    className="flex flex-col gap-1.5 px-2 py-1.5 rounded-ds-sm"
                    style={
                      editing
                        ? activeKeyStyle(DS_ACCENT)
                        : { background: 'var(--ds-grad-ceramic)', boxShadow: 'var(--ds-chamfer-soft), 0 1px 2px rgba(0, 0, 0, 0.4)' }
                    }
                  >
                    <div className="flex items-center gap-1.5">
                      {/* Reorder arrows (criterion 13 — stacking order) */}
                      <div className="flex flex-col">
                        <button
                          type="button"
                          data-action="binding-up"
                          disabled={i === 0}
                          onClick={() => mutateBindings((cur) => moveBinding(cur, b.id, -1))}
                          className={`w-4 h-3 flex items-center justify-center ${i === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:brightness-[1.4]'}`}
                          title="Move earlier in the stack"
                        >
                          <Icon name="chevron" size={8} color={DS.textMid} style={{ transform: 'rotate(-90deg)' }} />
                        </button>
                        <button
                          type="button"
                          data-action="binding-down"
                          disabled={i === bindings.length - 1}
                          onClick={() => mutateBindings((cur) => moveBinding(cur, b.id, 1))}
                          className={`w-4 h-3 flex items-center justify-center ${i === bindings.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:brightness-[1.4]'}`}
                          title="Move later in the stack"
                        >
                          <Icon name="chevron" size={8} color={DS.textMid} style={{ transform: 'rotate(90deg)' }} />
                        </button>
                      </div>
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: tint, boxShadow: `0 0 5px ${dsAlpha(tint, 0.7)}` }}
                      />
                      <div className="flex-1 min-w-0 leading-tight">
                        <div className="text-[10px] font-mono truncate" style={{ color: editing ? 'var(--ds-text-hi)' : 'var(--ds-text)' }}>
                          {def?.label ?? b.primitive}
                        </div>
                        <div className="text-[7.5px] font-mono tracking-[0.14em] uppercase" style={{ color: 'var(--ds-text-low)' }}>
                          {def?.category ?? 'unregistered'} · {driverLabel(b.driver)}
                        </div>
                      </div>
                      <button
                        type="button"
                        data-action="binding-edit"
                        onClick={() => {
                          setEditInst(null);
                          setEditingId((cur) => (cur === b.id ? null : b.id));
                        }}
                        title={editing ? 'Close controls' : 'Tune params (ControlSchema)'}
                        className="w-5 h-5 rounded-ds-xs ds-press hover:bg-white/[0.06] flex items-center justify-center transition-colors"
                      >
                        <Icon name="sliders" size={10} color={editing ? DS_ACCENT : DS.textMid} glow={editing} />
                      </button>
                      <button
                        type="button"
                        data-action="binding-remove"
                        onClick={() => {
                          if (editingId === b.id) {
                            setEditingId(null);
                            setEditInst(null);
                          }
                          mutateBindings((cur) => removeBinding(cur, b.id));
                          onToast(`Removed “${def?.label ?? b.primitive}”`);
                        }}
                        title="Remove binding"
                        className="w-5 h-5 rounded-ds-xs ds-press hover:bg-white/[0.06] flex items-center justify-center transition-colors"
                      >
                        <Icon name="trash" size={10} color={DS.textMid} />
                      </button>
                    </div>

                    {/* Driver chips (§5 trigger buttons → §8.2 — swaps driver ONLY) */}
                    <div className="flex gap-1 flex-wrap">
                      {DRIVER_OPTIONS.map((opt) => (
                        <ChipKey
                          key={opt.driver}
                          label={opt.label}
                          active={b.driver === opt.driver}
                          testId={`driver-${opt.driver}`}
                          onClick={() =>
                            mutateBindings((cur) => setBindingDriver(cur, b.id, opt.driver as AnimationDriverKind))
                          }
                        />
                      ))}
                    </div>

                    {/* W8 E8 — driver-level options: section-relative scrub
                        (scroll) / replay-on-exit (inview). Only shown for the
                        driver they apply to; never touch keyframes (INV-6). */}
                    {(b.driver === 'scroll' || b.driver === 'inview') && (
                      <div className="flex gap-1 flex-wrap pl-0.5" data-anim-driver-opts>
                        {b.driver === 'scroll' && (
                          <ChipKey
                            label="Per-section"
                            active={b.driverOptions?.section === true}
                            testId={`driveropt-section-${b.id}`}
                            onClick={() =>
                              mutateBindings((cur) =>
                                setBindingDriverOptions(cur, b.id, {
                                  section: !b.driverOptions?.section,
                                }),
                              )
                            }
                          />
                        )}
                        {b.driver === 'inview' && (
                          <ChipKey
                            label="Replay"
                            active={b.driverOptions?.replay === true}
                            testId={`driveropt-replay-${b.id}`}
                            onClick={() =>
                              mutateBindings((cur) =>
                                setBindingDriverOptions(cur, b.id, {
                                  replay: !b.driverOptions?.replay,
                                }),
                              )
                            }
                          />
                        )}
                      </div>
                    )}

                    {/* Expanded: LIVE preview window + the reused ControlPanel */}
                    {editing && (
                      <div className="flex flex-col gap-1.5 pt-0.5">
                        {def ? (
                          <>
                            <div
                              className="relative w-full rounded-[6px] overflow-hidden"
                              style={{ aspectRatio: '16 / 7', boxShadow: WELL_SHADOW }}
                            >
                              <SharedViewport
                                key={b.id}
                                def={def}
                                params={b.params}
                                playing
                                onInstance={setEditInst}
                                className="absolute inset-0"
                              />
                            </div>
                            {sinkInst ? (
                              <ControlPanel inst={sinkInst} />
                            ) : (
                              <div className="text-[8.5px] font-mono px-1" style={{ color: 'var(--ds-text-low)' }}>
                                Spinning up the preview rig…
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-[8.5px] font-mono px-1" style={{ color: 'var(--ds-warn)' }}>
                            “{b.primitive}” is not in the registry — params can’t be
                            tuned, but the binding is preserved.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ── Keyframe editor toggle (§8.4 — real) + bespoke lane (deferred) ── */}
      <div data-anim-section className="flex flex-col gap-1.5">
        <SectionLabel>Timeline · authoring</SectionLabel>
        <button
          type="button"
          data-action="keyframe-toggle"
          onClick={onToggleKeyframe}
          className="w-full h-9 rounded-ds-sm flex items-center justify-center gap-2 ds-press hover:brightness-[1.12] transition-all"
          style={keyframeOpen ? activeKeyStyle(DS_ACCENT) : { background: KEY_BG, boxShadow: KEY_SHADOW }}
        >
          <Icon name="timeline" size={13} color={keyframeOpen ? DS_ACCENT : DS.text} glow={keyframeOpen} />
          <span className="text-[11px] font-mono" style={{ color: keyframeOpen ? 'var(--ds-metal-200)' : 'var(--ds-text)' }}>
            {keyframeOpen ? 'Hide Keyframe Editor' : 'Keyframe Editor'}
          </span>
        </button>
        <button
          type="button"
          data-action="anim-scratch"
          onClick={() => onComing('Create From Scratch')}
          className="w-full h-8 rounded-ds-sm flex items-center justify-center gap-1.5 ds-press hover:brightness-[1.15] transition-all"
          style={{ background: KEY_BG, boxShadow: KEY_SHADOW }}
        >
          <Icon name="wand" size={11} color={DS.metal300} />
          <span className="text-[9.5px] font-mono" style={{ color: 'var(--ds-text)' }}>From Scratch — bespoke</span>
        </button>
      </div>

      {/* ── Honest playback note + Preview App jump ── */}
      <div data-anim-section className="flex flex-col gap-1.5">
        <div className="text-[8px] font-mono leading-tight" style={{ color: 'var(--ds-text-low)' }}>
          Animations play in Preview — the canvas stays still while you edit.
          Triggers control animation only; making elements act (links, data)
          happens in the node editor.
        </div>
        <button
          type="button"
          data-action="jump-preview-app"
          onClick={() => setViewMode('preview-app')}
          className="ds-btn w-full h-8"
        >
          <Icon name="play" size={11} color={DS.metal200} />
          <span className="text-[10px] font-mono">Preview App</span>
          <Icon name="arrowRight" size={10} color={DS.textMid} />
        </button>
      </div>
    </div>
  );
}

// ── Live picker tile — reuses the catalog's SharedViewport window inside an
// Chrome-Arc instrument bezel. Hover = the tile PLAYS (shared rig) and
// leans magnetically toward the cursor (GSAP, axis-aligned only). ───────────
function PickerTile({
  def,
  appliedCount,
  onApply,
}: {
  def: PrimitiveDefinition;
  appliedCount: number;
  onApply: (def: PrimitiveDefinition) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return attachMagnetic(el, { maxShift: 6, scale: 1.04 });
  }, []);
  const tint = DS_CATEGORY_TINTS[def.category] ?? DS_CATEGORY_TINTS.default;
  return (
    <button
      ref={ref}
      type="button"
      data-anim-tile
      data-primitive={def.name}
      data-playing={hovered ? 'true' : 'false'}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onClick={() => onApply(def)}
      title={`${def.label} — click to bind (${def.category} · ${def.difficulty})`}
      className="group relative flex flex-col text-left rounded-ds-sm ds-press transition-shadow"
      style={{
        background: 'var(--ds-grad-ceramic)',
        boxShadow: hovered
          ? `var(--ds-chamfer-soft), var(--ds-elev-2), 0 0 14px ${dsAlpha(DS_ACCENT, 0.14)}`
          : 'var(--ds-chamfer-soft), var(--ds-elev-1)',
      }}
    >
      {/* Recessed live window — the shared rig paints this rect (clipped to
          the flyout). The well shadow ring sits OUTSIDE the GPU rect so the
          machining stays visible around the live frame. */}
      <div
        className="relative mx-1 mt-1 rounded-[5px] overflow-hidden"
        style={{ boxShadow: WELL_SHADOW }}
      >
        <SharedViewport
          def={def}
          playing={hovered}
          frozenPhase={0.45}
          className="relative w-full aspect-[4/3]"
        />
      </div>
      {/* Caption plate — engraved label + category kicker + applied lamp */}
      <div className="flex flex-col gap-px px-1.5 py-1 w-full">
        <span className="flex items-center justify-between gap-1">
          <span className="text-[8.5px] font-medium truncate" style={{ color: 'var(--ds-text-hi)' }}>
            {def.label}
          </span>
          {appliedCount > 0 && (
            <span
              className="shrink-0 w-1.5 h-1.5 rounded-full"
              title={`Bound ×${appliedCount}`}
              style={{ background: 'var(--ds-grad-metal)', boxShadow: 'var(--ds-glow-arc)' }}
            />
          )}
        </span>
        <span
          className="text-[6.5px] font-mono tracking-[0.16em] uppercase truncate"
          style={{ color: tint }}
        >
          {def.category}
        </span>
      </div>
    </button>
  );
}
