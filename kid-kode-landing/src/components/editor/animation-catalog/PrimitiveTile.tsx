'use client';

// PrimitiveTile — a picker tile that plays its primitive on hover (spec §8.3:
// "a preview tile that plays on hover"). The mini WebGPU canvas mounts only
// while hovered, so at most ~1–2 GPU contexts are live at once.

import { useState } from 'react';
import AnimatableStage from './AnimatableStage';
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
      data-playing={hovered ? 'true' : 'false'}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onClick={() => onSelect(def)}
      className="group relative flex flex-col text-left rounded-xl overflow-hidden border transition-colors"
      style={{
        background: '#0a0c16',
        borderColor: selected ? '#5d8bff' : 'rgba(255,255,255,0.08)',
      }}
    >
      <div className="relative aspect-[4/3] w-full" style={{ background: 'radial-gradient(ellipse at 50% 40%, #11162a 0%, #05060c 100%)' }}>
        {hovered ? (
          <AnimatableStage def={def} playing />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/25 text-[10px] uppercase tracking-wider">
            hover to play
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-2.5 py-2">
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
