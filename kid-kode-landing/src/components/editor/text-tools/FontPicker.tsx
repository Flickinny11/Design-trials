'use client';

// P1 TEXT SYSTEM (Task B) — searchable font picker (canvas-spec §7.2).
//
// Full library list from GET /api/prism/fonts (~1,900 Google Fonts families,
// fetched once by TextToolsFlyout via getFontRegistry().listFonts()).
// Composed from DS primitives (no searchable-select exists in the frozen
// design system, so this builds one out of WellInput + a recessed list well).
// Core families carry a CORE chip (pre-baked atlases — instant); everything
// else triggers the on-demand server bake when picked (criterion 27 — the
// flyout surfaces `resolving` while getFontRegistry().resolveAtlas runs).

import { useMemo, useState } from 'react';
import { Icon } from '@/components/editor/icons/Icon';
import { DS, DS_ACCENT, dsAlpha } from '@/components/editor/design-system';
import type { FontManifestEntry } from '@/lib/prism/text/contract';
import { filterFonts } from './text-tool-helpers';
import { KEY_BG, KEY_SHADOW, WELL_BG, WELL_SHADOW, WellInput, activeKeyStyle } from './ui';

export default function FontPicker({
  fonts,
  fontsError,
  family,
  resolving,
  disabled,
  onPick,
}: {
  /** null = manifest still loading. */
  fonts: FontManifestEntry[] | null;
  fontsError: string | null;
  family: string;
  /** Family name whose atlas resolve (server bake for non-core) is in flight. */
  resolving: string | null;
  disabled?: boolean;
  onPick: (entry: FontManifestEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const currentEntry = useMemo(
    () => fonts?.find((f) => f.family === family) ?? null,
    [fonts, family],
  );
  const { entries, total } = useMemo(
    () => (fonts ? filterFonts(fonts, query) : { entries: [], total: 0 }),
    [fonts, query],
  );

  return (
    <div className="flex flex-col gap-1.5">
      {/* Trigger key — shows the active family + CORE chip + chevron. */}
      <button
        type="button"
        disabled={disabled}
        data-action="font-picker-toggle"
        onClick={() => setOpen((v) => !v)}
        className={`w-full h-9 px-2.5 rounded-ds-sm flex items-center gap-2 ds-press transition-all ${
          disabled ? 'opacity-40 cursor-not-allowed' : 'hover:brightness-[1.12]'
        }`}
        style={open ? activeKeyStyle(DS_ACCENT) : { background: KEY_BG, boxShadow: KEY_SHADOW }}
      >
        <Icon name="text" size={12} color={open ? DS_ACCENT : DS.text} />
        <span
          className="flex-1 text-left text-[10.5px] font-mono truncate"
          style={{ color: open ? 'var(--ds-brass-200)' : 'var(--ds-text)' }}
        >
          {family}
        </span>
        {currentEntry?.core && <span className="ds-chip">CORE</span>}
        <span
          className="transition-transform"
          style={{ transform: open ? 'rotate(90deg)' : 'none' }}
        >
          <Icon name="chevron" size={10} color={DS.textMid} />
        </span>
      </button>

      {resolving && (
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-ds-xs ds-reveal"
          style={{
            background: dsAlpha(DS.ice400, 0.1),
            boxShadow: `inset 0 0 0 1px ${dsAlpha(DS.ice400, 0.28)}`,
          }}
        >
          <Icon name="refresh" size={10} color={DS.ice300} />
          <span className="text-[8.5px] font-mono" style={{ color: 'var(--ds-ice-300)' }}>
            Baking MSDF atlas for {resolving}… (cached after first bake)
          </span>
        </div>
      )}

      {open && (
        <div className="flex flex-col gap-1.5">
          <WellInput
            value={query}
            onChange={setQuery}
            placeholder="Search 1,900+ families…"
            testId="font-search"
          />
          {fontsError && (
            <div className="text-[8.5px] font-mono px-1" style={{ color: 'var(--ds-danger)' }}>
              Font manifest failed to load: {fontsError}
            </div>
          )}
          {!fonts && !fontsError && (
            <div className="text-[8.5px] font-mono px-1" style={{ color: 'var(--ds-text-low)' }}>
              Loading font library…
            </div>
          )}
          {fonts && (
            <>
              <div
                className="flex flex-col rounded-ds-sm overflow-y-auto max-h-44"
                style={{ background: WELL_BG, boxShadow: WELL_SHADOW }}
                data-component="font-picker-list"
              >
                {entries.map((f) => {
                  const isActive = f.family === family;
                  return (
                    <button
                      key={f.family}
                      type="button"
                      data-font-option={f.family}
                      onClick={() => {
                        onPick(f);
                        setOpen(false);
                      }}
                      className={`flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors ${
                        isActive ? '' : 'hover:bg-white/[0.05]'
                      }`}
                      style={isActive ? { background: dsAlpha(DS_ACCENT, 0.14) } : undefined}
                    >
                      <span
                        className="flex-1 text-[10px] font-mono truncate"
                        style={{ color: isActive ? 'var(--ds-brass-200)' : 'var(--ds-text)' }}
                      >
                        {f.family}
                      </span>
                      <span className="text-[8px] font-mono" style={{ color: 'var(--ds-text-low)' }}>
                        {f.category}
                      </span>
                      {f.core && <span className="ds-chip">CORE</span>}
                    </button>
                  );
                })}
                {entries.length === 0 && (
                  <div className="px-2.5 py-2 text-[9px] font-mono" style={{ color: 'var(--ds-text-low)' }}>
                    No family matches “{query}”.
                  </div>
                )}
              </div>
              <div className="text-[8px] font-mono px-1" style={{ color: 'var(--ds-text-low)' }}>
                {entries.length} of {total} shown · CORE = pre-baked atlas, instant ·
                others bake on the server on first use, then cache
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
