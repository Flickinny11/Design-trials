'use client';

// PrimitiveTile — a picker tile whose preview is a transparent "window" into the
// shared rig canvas (spec §8.3: "a preview tile that plays on hover"). All tiles
// draw through the ONE shared WebGPU context, so a 300-tile grid never exhausts
// GL contexts. A tile freezes at a representative mid-frame until hovered/selected,
// then plays.

import { useState } from 'react';
import SharedViewport from './SharedViewport';
import type { PrimitiveDefinition } from '@/lib/prism/animatable/contract';

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: '#5ad48b',
  medium: '#5d8bff',
  hard: '#a978ff',
};

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
      className="group relative flex flex-col text-left rounded-xl overflow-hidden border transition-colors"
      style={{
        background: 'transparent',
        borderColor: selected ? '#5d8bff' : 'rgba(255,255,255,0.08)',
      }}
    >
      {/* Transparent window: the shared rig renders this primitive here. */}
      <SharedViewport
        def={def}
        playing={hovered || selected}
        frozenPhase={0.45}
        className="relative aspect-[4/3] w-full"
      />
      <div
        className="flex flex-col gap-0.5 px-2.5 py-2"
        style={{ background: 'rgba(10,12,22,0.72)' }}
      >
        <span className="flex items-center justify-between">
          <span className="text-[12px] font-medium text-white/90">{def.label}</span>
          <span
            className="text-[8px] uppercase tracking-wider rounded px-1 py-0.5"
            style={{ color: DIFFICULTY_COLOR[def.difficulty], background: 'rgba(255,255,255,0.05)' }}
          >
            {def.difficulty}
          </span>
        </span>
        <span className="text-[9px] uppercase tracking-wider text-white/35">{def.category}</span>
      </div>
    </button>
  );
}
