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
    <div className="relative min-h-screen w-full text-white" style={{ background: '#04050a' }}>
      {/* The one shared-context canvas every preview draws through. */}
      <SharedCanvas />

      <div className="relative" style={{ zIndex: 1 }}>
        <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between sticky top-0 z-10" style={{ background: 'rgba(4,5,10,0.85)', backdropFilter: 'blur(8px)' }}>
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold">Animation Primitive Catalog</h1>
            <p className="text-[11px] text-white/45">
              Animatable contract · shared-context preview rig · live ControlSchema
            </p>
          </div>
          <span data-component="primitive-count" className="text-[12px] text-white/60 tabular-nums">
            {primitiveCount()} primitives
          </span>
        </header>

        <div className="flex">
          {/* Tile grid */}
          <main data-component="animation-picker" className="flex-1 px-6 py-5 flex flex-col gap-7">
            {byCategory.map(([cat, items]) => (
              <section key={cat} data-category-section={cat} className="flex flex-col gap-2.5">
                <h2 className="text-[11px] uppercase tracking-[0.2em] text-white/40">{cat}</h2>
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
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

          {/* Focused detail + controls */}
          <aside
            data-component="primitive-detail"
            data-focused={focused?.name ?? ''}
            className="w-[320px] shrink-0 border-l border-white/10 p-4 flex flex-col gap-4 sticky top-[61px] self-start"
            style={{ height: 'calc(100vh - 61px)' }}
          >
            {focused ? (
              <>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{focused.label}</span>
                  <span className="text-[10px] uppercase tracking-wider text-white/40">
                    {focused.category} · {focused.difficulty} · {focused.defaultDriver} driver
                  </span>
                  <p className="text-[11px] text-white/55 mt-1">{focused.description}</p>
                </div>
                {/* Transparent window into the shared canvas. The viewport fills
                    an aspect-sized box via absolute inset-0 so it always has a
                    real height (a percentage-height child of an aspect box can
                    collapse to 0 and get culled by the rig). */}
                <div
                  data-component="detail-preview"
                  className="relative w-full rounded-lg overflow-hidden border border-white/10"
                  style={{ background: 'transparent', aspectRatio: '4 / 3' }}
                >
                  <SharedViewport
                    def={focused}
                    playing={detailPlaying}
                    onInstance={setInst}
                    className="absolute inset-0"
                    style={{ background: 'transparent' }}
                  />
                </div>
                <button
                  type="button"
                  data-action="detail-playpause"
                  data-playing={detailPlaying ? 'true' : 'false'}
                  onClick={() => setDetailPlaying((p) => !p)}
                  className="self-start text-[11px] rounded px-2 py-1 bg-white/10 hover:bg-white/20 text-white/80"
                >
                  {detailPlaying ? 'Pause' : 'Play'}
                </button>
                <div className="overflow-y-auto pr-1">
                  <ControlPanel inst={inst} />
                </div>
              </>
            ) : (
              <p className="text-white/40 text-sm">No primitives registered.</p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
