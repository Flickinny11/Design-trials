'use client';

// ClusterTile — a library tile whose preview is a transparent "window" into the
// cluster rig canvas (PREBUILT-LIBRARY-CONTRACT §5: "a preview tile that renders
// the REAL cluster ... richer than the single-subject primitive tiles"). All
// tiles draw through the ONE shared WebGPU context (clusterRig), so a large
// grid never exhausts GL contexts. A tile freezes at a representative mid-frame
// until hovered/focused, then plays its INTEGRATED animation.
//
// Chrome: Observatory Brass design system. The preview region stays visually
// TRANSPARENT (the GPU canvas sits behind the page); the material treatment
// lives on the bezel ring + caption plate around the window — a machined
// instrument bezel, not a solid card. Hover = lift only (ds-lift); no tilt
// (axis-aligned scissor rects forbid it). Mirror of
// animation-catalog/PrimitiveTile.tsx, widened for the cluster caption + a
// drag-to-place affordance.

import { useEffect, useRef, useState } from 'react';
import { clusterRig, type ClusterTileHandle } from './cluster-tile-renderer';
import { DS, dsAlpha, DS_CATEGORY_TINTS } from '@/components/editor/design-system';
import {
  ELEMENT_CATEGORY_LABEL,
  type ElementClusterDefinition,
} from '@/lib/editor/elements/contract';

export default function ClusterTile({
  def,
  onPlace,
}: {
  def: ElementClusterDefinition;
  /** Begin drag-to-place / click-to-place for this cluster (closes the browser
   *  and arms placement). The browser owns the store wiring. */
  onPlace: (def: ElementClusterDefinition) => void;
}) {
  const winRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<ClusterTileHandle | null>(null);
  const [hovered, setHovered] = useState(false);
  const playingRef = useRef(false);
  playingRef.current = hovered;

  // Register the transparent preview window with the rig once on mount.
  useEffect(() => {
    const el = winRef.current;
    if (!el) return;
    const handle = clusterRig.register({
      element: el,
      def,
      getPlaying: () => playingRef.current,
    });
    handleRef.current = handle;
    return () => {
      handle.unregister();
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflect hover/focus into the rig's per-tile play flag.
  const setPlaying = (next: boolean) => {
    setHovered(next);
    const el = winRef.current;
    if (el) clusterRig.setPlaying(el, next);
  };

  const tint = DS_CATEGORY_TINTS[def.category] ?? DS.brass300;

  return (
    <button
      type="button"
      data-cluster-tile={def.id}
      data-category={def.category}
      data-playing={hovered ? 'true' : 'false'}
      onMouseEnter={() => setPlaying(true)}
      onMouseLeave={() => setPlaying(false)}
      onFocus={() => setPlaying(true)}
      onBlur={() => setPlaying(false)}
      // Drag-to-place: a pointerdown on the tile begins placement. The browser
      // closes + arms the scene placement layer. Click also lands here
      // (pointerdown fires first) so the click-to-place fallback is the same
      // entry point — criterion 21 works via this path even without scene drag.
      onPointerDown={(e) => {
        e.preventDefault();
        onPlace(def);
      }}
      className="group relative flex flex-col text-left rounded-ds-md overflow-hidden ds-lift ds-edge"
      style={{ background: 'transparent', boxShadow: 'var(--ds-elev-1)' }}
    >
      {/* Transparent window: the cluster rig renders this element's real
          assembled cluster here, integrated animation playing on hover. */}
      <div className="relative w-full">
        <div
          ref={winRef}
          data-cluster-viewport={def.id}
          className="relative aspect-[4/3] w-full"
          style={{ background: 'transparent' }}
        />
        {/* Bezel vignette — inset ring over the live preview (no background, the
            GPU frame stays crisp underneath). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            boxShadow:
              'inset 0 1px 0 rgba(255,252,242,0.07), inset 0 0 18px rgba(0,0,0,0.42), inset 0 -10px 18px -12px rgba(0,0,0,0.6)',
          }}
        />
        {/* Featured pip — brass spark, top-right. */}
        {def.featured && (
          <span
            aria-hidden
            className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full"
            style={{ background: 'var(--ds-grad-brass)', boxShadow: 'var(--ds-glow-brass)' }}
          />
        )}
        {/* Drag affordance hint — appears on hover. Plain language. */}
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-2 left-2 right-2 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <span
            className="ds-chip text-[9px]"
            style={{
              color: 'var(--ds-text-hi)',
              background: 'var(--ds-grad-smoked)',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
            }}
          >
            Drag onto a hub to place
          </span>
        </div>
      </div>

      {/* Caption plate — soft ceramic with a specular top edge. */}
      <div
        className="flex flex-col gap-0.5 px-2.5 py-2"
        style={{
          background: 'var(--ds-grad-ceramic)',
          boxShadow: 'inset 0 1px 0 var(--ds-edge-specular)',
        }}
      >
        <span className="flex items-center justify-between gap-1.5">
          <span
            className="text-[12px] font-medium truncate"
            style={{ color: 'var(--ds-text-hi)' }}
          >
            {def.label}
          </span>
          <span
            className="ds-chip shrink-0"
            style={{
              color: tint,
              boxShadow: `inset 0 1px 2px rgba(0,0,0,0.5), inset 0 0 0 1px ${dsAlpha(tint, 0.26)}`,
            }}
          >
            {ELEMENT_CATEGORY_LABEL[def.category]}
          </span>
        </span>
        <span
          className="text-[9.5px] font-mono leading-snug truncate"
          style={{ color: 'var(--ds-text-mid)' }}
          title={def.description}
        >
          {def.description}
        </span>
      </div>
    </button>
  );
}
