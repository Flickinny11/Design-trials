'use client';

// CatalogGallery — the Animation Picker surface (spec §8.3). Lists every
// registered Animatable primitive as a hover-play tile grouped by category,
// plus a focused detail preview with a live ControlPanel rendered from the
// primitive's ControlSchema.
//
// Every preview (all tiles + the detail) draws through ONE shared WebGPU context
// (SharedCanvas + the SharedTileRenderer): the fixed canvas sits behind the
// content and each preview is a transparent DOM window scissored into it. This
// is the rig the full 300-primitive catalog renders against — zero per-tile GL
// contexts, zero device-lost.
//
// Chrome: Observatory Brass design system. Because previews are transparent
// windows onto the canvas BEHIND the page, no panel may lay a fill or a
// backdrop-filter over a preview rect — the detail rail is therefore a stack
// of machined plates around a bezel-framed window, and only the sticky header
// (which never overlaps the detail preview) carries frosted glass.

import { useEffect, useMemo, useState } from 'react';
import {
  listPrimitives,
  primitiveCount,
} from '@/lib/prism/animatable/registry';
import { registerAllPrimitives } from '@/lib/prism/animatable/primitives';
import type { Animatable, PrimitiveCategory, PrimitiveDefinition } from '@/lib/prism/animatable/contract';
import SharedCanvas from './SharedCanvas';
import SharedViewport from './SharedViewport';
import ControlPanel from './ControlPanel';
import PrimitiveTile from './PrimitiveTile';

// Ensure the registry is populated (idempotent).
registerAllPrimitives();

export default function CatalogGallery() {
  const defs = useMemo(() => listPrimitives(), []);
  const [focused, setFocused] = useState<PrimitiveDefinition | null>(defs[0] ?? null);
  const [inst, setInst] = useState<Animatable | null>(null);
  const [detailPlaying, setDetailPlaying] = useState(true);

  // Verification hooks (driven by scripts/verify-catalog.mjs). Focusing via
  // these drives the ONE detail viewport; no extra GL contexts are created.
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__catalogFocus = (name: string) => {
      const d = defs.find((x) => x.name === name);
      if (d) {
        setDetailPlaying(true);
        setFocused(d);
      }
    };
    w.__catalogSetPlaying = (v: boolean) => setDetailPlaying(!!v);
    return () => {
      delete w.__catalogFocus;
      delete w.__catalogSetPlaying;
    };
  }, [defs]);

  const byCategory = useMemo(() => {
    const map = new Map<PrimitiveCategory, PrimitiveDefinition[]>();
    for (const d of defs) {
      const arr = map.get(d.category) ?? [];
      arr.push(d);
      map.set(d.category, arr);
    }
    return [...map.entries()];
  }, [defs]);

  return (
    <div className="relative min-h-screen w-full" style={{ background: 'var(--ds-void)', color: 'var(--ds-text)' }}>
      {/* The one shared-context canvas every preview draws through. */}
      <SharedCanvas />

      <div className="relative" style={{ zIndex: 1 }}>
        {/* Frosted-glass instrument header — the one backdrop surface on this
            page; it frosts the tiles scrolling beneath it. */}
        <header className="ds-glass sticky top-0 z-10 flex items-center justify-between px-6 py-3.5 rounded-none">
          <div className="flex flex-col gap-0.5">
            <span className="ds-kicker">prism editor · animatable contract · shared-context rig</span>
            <h1 className="ds-title ds-title-brass text-[19px]">Animation Primitive Catalog</h1>
          </div>
          <span data-component="primitive-count" className="ds-chip ds-chip--brass tabular-nums">
            {primitiveCount()} primitives
          </span>
        </header>

        <div className="flex flex-col lg:flex-row">
          {/* Tile grid */}
          <main data-component="animation-picker" className="flex-1 px-4 lg:px-6 py-6 flex flex-col gap-8 min-w-0">
            {byCategory.map(([cat, items]) => (
              <section key={cat} data-category-section={cat} className="flex flex-col gap-3">
                {/* Engraved category rule — label + machined etch line */}
                <h2 className="flex items-center gap-3">
                  <span className="ds-label" style={{ color: 'var(--ds-brass-300)' }}>{cat}</span>
                  <span
                    aria-hidden
                    className="h-px flex-1"
                    style={{
                      background:
                        'linear-gradient(90deg, rgba(var(--ds-brass-400-rgb),0.4), rgba(255,252,242,0.07) 30%, rgba(255,252,242,0.03) 70%, transparent)',
                    }}
                  />
                  <span className="ds-kicker tabular-nums">{items.length}</span>
                </h2>
                <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                  {items.map((d) => (
                    <PrimitiveTile
                      key={d.name}
                      def={d}
                      selected={focused?.name === d.name}
                      onSelect={(def) => {
                        if (focused?.name === def.name) return;
                        setInst(null);
                        setDetailPlaying(true);
                        setFocused(def);
                      }}
                    />
                  ))}
                </div>
              </section>
            ))}
          </main>

          {/* Focused detail + controls — a rail of machined plates around the
              bezel-framed live window (no fill may cover the preview rect). */}
          <aside
            data-component="primitive-detail"
            data-focused={focused?.name ?? ''}
            className="w-full lg:w-[324px] shrink-0 px-4 py-4 flex flex-col gap-3.5 order-first lg:order-none lg:sticky lg:top-[64px] lg:self-start lg:h-[calc(100vh-64px)] lg:border-l"
            style={{ borderColor: 'var(--ds-edge-side)' }}
          >
            {focused ? (
              <>
                {/* Title plate */}
                <div className="ds-ceramic ds-edge px-3.5 py-3 flex flex-col gap-1">
                  <span className="ds-title text-[15px]">{focused.label}</span>
                  <span className="ds-kicker" style={{ color: 'var(--ds-brass-300)' }}>
                    {focused.category} · {focused.difficulty} · {focused.defaultDriver} driver
                  </span>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--ds-text-mid)' }}>
                    {focused.description}
                  </p>
                </div>

                {/* Bezel-framed live window. The viewport fills an aspect-sized
                    box via absolute inset-0 so it always has a real height (a
                    percentage-height child of an aspect box can collapse to 0
                    and get culled by the rig). The frame is shadow-only — the
                    GPU frame stays crisp and untinted. */}
                <div
                  data-component="detail-preview"
                  className="relative w-full rounded-ds-md overflow-hidden ds-edge--brass"
                  style={{ background: 'transparent', aspectRatio: '4 / 3', boxShadow: 'var(--ds-elev-2)' }}
                >
                  <SharedViewport
                    def={focused}
                    playing={detailPlaying}
                    onInstance={setInst}
                    className="absolute inset-0"
                    style={{ background: 'transparent' }}
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-ds-md"
                    style={{
                      boxShadow:
                        'inset 0 1px 0 rgba(255,252,242,0.09), inset 0 0 22px rgba(0,0,0,0.38), inset 0 -12px 22px -14px rgba(0,0,0,0.65)',
                    }}
                  />
                </div>

                <button
                  type="button"
                  data-action="detail-playpause"
                  data-playing={detailPlaying ? 'true' : 'false'}
                  onClick={() => setDetailPlaying((p) => !p)}
                  className="ds-btn ds-btn--ghost self-start"
                >
                  {detailPlaying ? 'Pause' : 'Play'}
                </button>

                {/* Controls plate */}
                <div className="ds-ceramic ds-edge flex-1 min-h-0 overflow-y-auto px-3.5 py-3">
                  <ControlPanel inst={inst} />
                </div>
              </>
            ) : (
              <p className="text-sm" style={{ color: 'var(--ds-text-low)' }}>No primitives registered.</p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
