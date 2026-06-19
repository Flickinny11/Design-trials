'use client';

// PrimitiveTile — a picker tile whose preview is a transparent "window" into the
// shared rig canvas (spec §8.3: "a preview tile that plays on hover"). All tiles
// draw through the ONE shared WebGPU context, so a 300-tile grid never exhausts
// GL contexts. A tile freezes at a representative mid-frame until hovered/selected,
// then plays.
//
// Chrome: Chrome-Arc design system. The preview region must stay visually
// TRANSPARENT (the GPU canvas sits behind the page), so the material treatment
// lives on the bezel ring + caption plate around the window — a machined
// instrument bezel, not a solid card. Hover = lift only (translate/scale); tilt
// is forbidden on SharedViewport ancestors (axis-aligned scissor rects).

import { useState } from 'react';
import SharedViewport from './SharedViewport';
import { DS_DIFFICULTY, dsAlpha, DS } from '@/components/editor/design-system';
import type { PrimitiveDefinition } from '@/lib/prism/animatable/contract';

export default function PrimitiveTile({
  def,
  selected,
  onSelect,
}: {
  def: PrimitiveDefinition;
  selected: boolean;
  onSelect: (def: PrimitiveDefinition) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const difficultyTint = DS_DIFFICULTY[def.difficulty] ?? DS.textMid;
  return (
    <button
      type="button"
      data-tile
      data-primitive={def.name}
      data-category={def.category}
      data-playing={hovered || selected ? 'true' : 'false'}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onClick={() => onSelect(def)}
      className={`group relative flex flex-col text-left rounded-ds-md overflow-hidden ds-lift ${
        selected ? 'ds-edge--metal' : 'ds-edge'
      }`}
      style={{
        background: 'transparent',
        boxShadow: selected
          ? `var(--ds-elev-2), var(--ds-glow-arc)`
          : 'var(--ds-elev-1)',
      }}
    >
      {/* Transparent window: the shared rig renders this primitive here. */}
      <div className="relative w-full">
        <SharedViewport
          def={def}
          playing={hovered || selected}
          frozenPhase={0.45}
          className="relative aspect-[4/3] w-full"
        />
        {/* Bezel vignette — inset ring over the live preview (no background,
            the GPU frame stays crisp underneath). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            boxShadow:
              'inset 0 1px 0 rgba(255,252,242,0.07), inset 0 0 18px rgba(0,0,0,0.42), inset 0 -10px 18px -12px rgba(0,0,0,0.6)',
          }}
        />
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
            style={{ color: selected ? 'var(--ds-metal-200)' : 'var(--ds-text-hi)' }}
          >
            {def.label}
          </span>
          <span
            className="ds-chip shrink-0"
            style={{
              color: difficultyTint,
              boxShadow: `inset 0 1px 2px rgba(0,0,0,0.5), inset 0 0 0 1px ${dsAlpha(difficultyTint, 0.26)}`,
            }}
          >
            {def.difficulty}
          </span>
        </span>
        <span className="ds-kicker">{def.category}</span>
      </div>
    </button>
  );
}
