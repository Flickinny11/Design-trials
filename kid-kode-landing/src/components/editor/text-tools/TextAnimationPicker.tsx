'use client';

// P1 TEXT SYSTEM (Task B) — text-animation PICKER SURFACE (canvas-spec §7.5).
//
// Lists the text-category primitives from the Animatable registry (the same
// registry the /animation-catalog gallery draws from). P1 ships the picker
// surface ONLY: list + selected highlight held in LOCAL component state. The
// selection is NOT persisted to the node — the animation-binding schema field
// is P2's contract (Toolbar Wiring), and inventing it here would collide.
// The "BINDS IN P2" chip + footnote make that visible and honest.

import { useMemo, useState } from 'react';
import { DS, DS_DIFFICULTY, dsAlpha } from '@/components/editor/design-system';
import { listByCategory } from '@/lib/prism/animatable/registry';
import { registerAllPrimitives } from '@/lib/prism/animatable/primitives';
import { WELL_BG, WELL_SHADOW } from './ui';

// Ensure the registry is populated (idempotent — same pattern as
// CatalogGallery).
registerAllPrimitives();

export default function TextAnimationPicker() {
  const prims = useMemo(() => listByCategory('text'), []);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="ds-chip ds-chip--ice">BINDING LANDS IN P2</span>
        <span className="text-[8px] font-mono" style={{ color: 'var(--ds-text-low)' }}>
          {prims.length} text primitives
        </span>
      </div>

      <div
        className="flex flex-col rounded-ds-sm overflow-y-auto max-h-44"
        style={{ background: WELL_BG, boxShadow: WELL_SHADOW }}
        data-component="text-animation-picker"
      >
        {prims.map((p) => {
          const isActive = selected === p.name;
          return (
            <button
              key={p.name}
              type="button"
              data-text-anim={p.name}
              title={p.description}
              onClick={() => setSelected((cur) => (cur === p.name ? null : p.name))}
              className={`flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors ${
                isActive ? '' : 'hover:bg-white/[0.05]'
              }`}
              style={isActive ? { background: dsAlpha(DS.metal400, 0.14) } : undefined}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{
                  background: DS_DIFFICULTY[p.difficulty] ?? DS.textMid,
                  boxShadow: `0 0 5px ${dsAlpha(DS_DIFFICULTY[p.difficulty] ?? DS.textMid, 0.6)}`,
                }}
              />
              <span
                className="flex-1 text-[10px] font-mono truncate"
                style={{ color: isActive ? 'var(--ds-metal-200)' : 'var(--ds-text)' }}
              >
                {p.label}
              </span>
              <span className="text-[8px] font-mono" style={{ color: 'var(--ds-text-low)' }}>
                {p.defaultDriver}
              </span>
            </button>
          );
        })}
        {prims.length === 0 && (
          <div className="px-2.5 py-2 text-[9px] font-mono" style={{ color: 'var(--ds-text-low)' }}>
            No text primitives registered.
          </div>
        )}
      </div>

      <div className="text-[8px] font-mono leading-tight px-1" style={{ color: 'var(--ds-text-low)' }}>
        Picker surface only — selecting highlights here; binding the primitive
        to this node ships with P2 (Toolbar Wiring). Plays against glyph-unit
        meshes per textSpec.decompose.
      </div>
    </div>
  );
}
