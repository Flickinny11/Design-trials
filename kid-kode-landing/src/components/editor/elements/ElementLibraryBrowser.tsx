'use client';

// ElementLibraryBrowser — the prebuilt-element-library browser (§13,
// PREBUILT-LIBRARY-CONTRACT §1/§5). A premium root-mounted modal (mounted once
// in src/app/page.tsx next to <ChangeArtifactWizard/>): store-driven by
// useGraphEditorStore.libraryOpen. Closes on backdrop / Esc / close key.
//
// Layout: a search box + category chips (from listPopulatedCategories +
// ELEMENT_CATEGORY_LABEL) + a responsive tile grid (one ClusterTile per
// listElements(), filtered). It mounts <ClusterCanvas/> ONCE behind the grid so
// every tile's transparent window shows the real assembled cluster, integrated
// animation playing on hover.
//
// Drag-to-place handoff: a tile's pointerdown (`onPlace`) closes the browser and
// arms placement via useGraphEditorStore.setPlacingCluster(def.id). The scene
// placement layer (ElementPlacementLayer in GraphScene) then renders the live
// tether + ghost and commits on pointer-up. A reliable click-to-place fallback
// lives on the store side: if the user releases without a scene drag, the
// placement is still committed to the active/nearest hub (criterion 21 works via
// at least the click path).
//
// Observatory-Brass chrome, design-tokens only (ds-* + tokens.css). NO purple,
// NO stock icons, never the word "fal". Mobile-aware: responsive grid,
// touch-friendly hit targets, no bottom-band collisions (the modal is centered
// with its own scroll region).

import { useEffect, useMemo, useState } from 'react';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { buildClusterNodeInputs } from '@/lib/editor/elements/instantiate';
import { Icon } from '@/components/editor/icons/Icon';
import { DS, dsAlpha } from '@/components/editor/design-system';
import {
  listElements,
  listPopulatedCategories,
} from '@/lib/editor/elements/registry';
// Side-effect import: registers every prebuilt element on load (§13 barrel).
import '@/lib/editor/elements/catalog';
import {
  ELEMENT_CATEGORY_LABEL,
  type ElementCategory,
  type ElementClusterDefinition,
} from '@/lib/editor/elements/contract';
import ClusterCanvas from './ClusterCanvas';
import ClusterTile from './ClusterTile';

export default function ElementLibraryBrowser() {
  const open = useGraphEditorStore((s) => s.libraryOpen);
  const closeLibrary = useGraphEditorStore((s) => s.closeLibrary);
  const setPlacingCluster = useGraphEditorStore((s) => s.setPlacingCluster);
  const setViewMode = useGraphEditorStore((s) => s.setViewMode);
  const hubs = useGraphSourceStore((s) => s.hubs);
  const addNodesBatch = useGraphSourceStore((s) => s.addNodesBatch);
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);
  const drillIntoHub = useGraphEditorStore((s) => s.drillIntoHub);
  const selectNode = useGraphEditorStore((s) => s.selectNode);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ElementCategory | 'all'>('all');

  // Esc closes; reset filters whenever the browser opens.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCategory('all');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLibrary();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeLibrary]);

  const all = useMemo(() => listElements(), [open]);
  const categories = useMemo(() => listPopulatedCategories(), [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((d) => {
      if (category !== 'all' && d.category !== category) return false;
      if (!q) return true;
      return (
        d.label.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.caption.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
      );
    });
  }, [all, category, query]);

  // CLICK-TO-PLACE (primary, reliable): place the cluster IMMEDIATELY at the
  // active hub (or the first hub), frame it in canvas, select it, close the
  // browser. The user then repositions with the gizmo — a bulletproof "drop
  // then position" flow (no mode-switch race, no second click). Criterion 21:
  // every member is tethered to the hub + shares a groupId (buildClusterNodeInputs).
  const placeNow = (def: ElementClusterDefinition) => {
    if (hubs.length === 0) {
      closeLibrary();
      return;
    }
    const hubId = activeHubId ?? hubs[0].hubId;
    const ids = addNodesBatch(buildClusterNodeInputs(def, hubId, { x: 0, y: 0, z: 0 }));
    closeLibrary();
    // drillIntoHub frames the hub in canvas (viewMode := 'canvas', activeHub := hubId)
    // so the freshly-placed cluster is immediately visible — never dropped into an
    // off-screen hub.
    drillIntoHub(hubId);
    if (ids.length > 0) selectNode(ids[0]);
  };

  // DRAG-TO-PLACE (positioned): a real drag from the tile arms the galaxy
  // placement layer so the user can drop the cluster onto a chosen hub with a
  // live tether. Closes the browser + switches to galaxy; ElementPlacementLayer
  // commits on canvas pointer-up.
  const beginPlacement = (def: ElementClusterDefinition) => {
    if (hubs.length === 0) {
      closeLibrary();
      return;
    }
    closeLibrary();
    setViewMode('galaxy');
    setPlacingCluster(def.id);
  };

  if (!open) return null;

  // ── Z-STACK (real-GPU fix, Phase 1) ───────────────────────────────────────
  // The shared-rig technique requires the rig canvas to sit ABOVE the modal's
  // dim backdrop but BELOW the panel chrome, with the tile preview windows as
  // TRUE transparent holes down to the rig. The bug it fixes: the canvas was
  // page-level zIndex:0, so the modal's opaque/frosted panel (z-50) painted
  // OVER it and every tile "hole" revealed the dark panel, not the rig frame.
  //
  // Layers, all inside the `fixed inset-0 z-50` modal stacking context:
  //   • backdrop   — absolute inset-0, z-0  (dim/frost; the dismiss target)
  //   • ClusterCanvas — fixed inset-0, z-10 (the rig, ABOVE backdrop)
  //   • panel      — relative z-20          (chrome ABOVE the rig)
  // The panel OUTER frame is transparent (no ds-glass fill) — only the brass
  // edge + the header/controls sub-block carry opaque chrome. The tile-grid
  // region is transparent, so the rig shows through the tile windows (each
  // cleared to its own dark TILE_BG by the rig) and the gaps reveal the
  // backdrop. Mirror of the animation-catalog gallery's transparent content
  // pattern (SharedCanvas behind, ds-glass only on the header).
  return (
    <div
      data-component="element-library-browser"
      role="dialog"
      aria-modal="true"
      aria-label="Element library"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeLibrary();
      }}
    >
      {/* (a) Dim backdrop — BOTTOM layer. A separate element (not the
          container's own background) so the rig canvas can sit ABOVE it.
          Clicking it dismisses. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          zIndex: 0,
          background: dsAlpha(DS.void, 0.62),
          backdropFilter: 'var(--ds-frost-light)',
          WebkitBackdropFilter: 'var(--ds-frost-light)',
        }}
        onMouseDown={closeLibrary}
      />

      {/* (b) The shared GPU rig canvas — ABOVE the backdrop, BELOW the panel.
          The tile windows are transparent holes down to this layer. */}
      <ClusterCanvas zIndex={10} />

      {/* (c) Panel chrome — TOP layer. Outer frame is transparent (brass edge
          only); the tile grid region is transparent so the rig shows through. */}
      <div
        className="relative ds-edge--brass rounded-ds-lg ds-reveal flex flex-col w-full max-h-[92vh] overflow-hidden"
        style={{ zIndex: 20, maxWidth: 1080 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header + controls — the ONE opaque ds-glass chrome block (it frosts
            nothing behind it; the rig lives below the tiles, not here). */}
        <div className="ds-glass shrink-0 flex flex-col rounded-none">
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 pt-4 pb-3"
            style={{ borderBottom: `1px solid ${dsAlpha(DS.brass400, 0.16)}` }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-8 h-8 rounded-ds-xs flex items-center justify-center shrink-0"
                style={{
                  background: 'var(--ds-grad-brass-soft)',
                  boxShadow: `inset 0 0 0 1px ${dsAlpha(DS.brass400, 0.34)}, var(--ds-chamfer-soft)`,
                }}
              >
                <Icon name="layers" size={16} color={DS.brass200} glow />
              </div>
              <div className="min-w-0">
                <div className="ds-headline tracking-tight truncate">Element Library</div>
                <div className="ds-body mt-0.5 text-[12px] truncate" style={{ color: 'var(--ds-text-mid)' }}>
                  Ready-made 3D pieces — drag one onto a hub to place it
                </div>
              </div>
            </div>
            <button
              type="button"
              data-role="library-close"
              onClick={closeLibrary}
              className="ds-btn ds-btn--quiet ds-press w-8 h-8 px-0 text-[18px] leading-none shrink-0"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Controls: search + category chips */}
          <div className="px-5 pt-3 pb-3 flex flex-col gap-2.5">
            <label className="relative block">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <Icon name="search" size={13} color={DS.textMid} />
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search elements…"
                data-role="library-search"
                className="w-full h-9 pl-8 pr-3 rounded-ds-sm text-[12px] font-ui outline-none"
                style={{
                  background: 'var(--ds-grad-well)',
                  color: 'var(--ds-text-hi)',
                  boxShadow:
                    'inset 0 2px 5px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(255,252,242,0.05)',
                }}
              />
            </label>

            <div className="flex items-center gap-1.5 flex-wrap">
              <CategoryChip
                label="All"
                active={category === 'all'}
                onClick={() => setCategory('all')}
              />
              {categories.map((c) => (
                <CategoryChip
                  key={c}
                  label={ELEMENT_CATEGORY_LABEL[c]}
                  active={category === c}
                  onClick={() => setCategory(c)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Tile grid — TRANSPARENT region (no background fill / no glass) so the
            rig canvas shows through each tile's transparent preview window.
            Scrolls within the modal. */}
        <div
          className="flex-1 overflow-y-auto px-5 py-4 ds-scroll min-h-0"
          style={{ background: 'transparent' }}
        >
          {filtered.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-2 py-16 text-center"
              style={{ color: 'var(--ds-text-mid)' }}
            >
              <Icon name="layers" size={22} color={DS.textMid} />
              <span className="text-[12px] font-ui">
                {all.length === 0
                  ? 'No elements registered yet.'
                  : 'Nothing matches that search.'}
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((def) => (
                <ClusterTile key={def.id} def={def} onClickPlace={placeNow} onDragPlace={beginPlacement} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
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
      type="button"
      onClick={onClick}
      data-role="library-category"
      data-active={active ? 'true' : 'false'}
      className="px-2.5 h-7 rounded-full text-[11px] font-ui font-semibold tracking-normal ds-press transition-all"
      style={
        active
          ? {
              background: 'var(--ds-grad-brass-soft)',
              color: 'var(--ds-brass-200)',
              boxShadow: `inset 0 0 0 1px ${dsAlpha(DS.brass400, 0.4)}, var(--ds-chamfer-soft)`,
            }
          : {
              background: 'var(--ds-grad-smoked)',
              color: 'var(--ds-text-mid)',
              boxShadow: 'var(--ds-chamfer-soft)',
            }
      }
    >
      {label}
    </button>
  );
}
