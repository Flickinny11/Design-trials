'use client';

// P1 TEXT SYSTEM (Task B) — font picker rebuilt as a SCROLLABLE PREVIEW GALLERY
// (canvas-spec §7.2 / LOGAN-INBOX).
//
// The user picks a typeface by SCROLLING a gallery where EACH ROW is rendered
// IN ITS OWN FONT — so they SEE the face before committing. A search box filters
// the ~1,935-family library by family + category; the list is WINDOWED (only the
// visible rows + a small overscan mount, never 1,935 DOM nodes) and scrolls with
// premium Lenis momentum (DESIGN-REFERENCES §6).
//
// Preview faces are lazy-loaded per VISIBLE family via injected Google-Fonts
// @font-face (font-preview-loader.ts). There is NO Content-Security-Policy in
// this app (no `headers()` in next.config.mjs, no middleware, no CSP header
// anywhere in src/), so fonts.googleapis.com / fonts.gstatic.com are not
// blocked. Until a row's webfont lands (or permanently, if a future CSP ever
// blocks those hosts), the row falls back to a representative system stack keyed
// by the family's category (serif / sans / mono / display / handwriting) so the
// gallery still differentiates shapes — see font-preview-loader.ts.
//
// Core families carry a CORE chip (pre-baked MSDF atlases — instant on pick);
// everything else triggers the on-demand server bake when picked (criterion 27 —
// the flyout surfaces `resolving` while getFontRegistry().resolveAtlas runs).
//
// This is EDITOR React chrome, so DOM access is allowed here (unlike the DOM-free
// src/lib/prism/** runtime). Styling is design-system tokens ONLY — no purple,
// no component-local hues.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/editor/icons/Icon';
import { DS, DS_ACCENT, dsAlpha } from '@/components/editor/design-system';
import { useLenis } from '@/components/editor/design-system/use-lenis';
import type { FontManifestEntry } from '@/lib/prism/text/contract';
import { filterFonts } from './text-tool-helpers';
import { ensurePreviewFont, fontStackFor } from './font-preview-loader';
import { KEY_BG, KEY_SHADOW, WELL_BG, WELL_SHADOW, WellInput, activeKeyStyle } from './ui';

// Windowing geometry — fixed row height so the visible range is a pure function
// of scrollTop (no measurement pass; thousands of rows stay cheap).
const ROW_H = 38; // px — tall enough to show the face legibly in the narrow panel
const VIEWPORT_H = 264; // px — the scroll well height (≈7 rows visible)
const OVERSCAN = 4; // rows rendered above/below the viewport to hide scroll seams

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
  const [scrollTop, setScrollTop] = useState(0);

  // Lenis-driven momentum on the gallery well (DESIGN-REFERENCES §6). The hook
  // attaches to the scroll wrapper and drives its native scrollTop, so our
  // windowing `onScroll` reads the same value whether Lenis is active (fine
  // pointer) or it has bowed out (touch / reduced-motion → native scroll).
  const { ref: scrollRef } = useLenis<HTMLDivElement>({ lerp: 0.1, enabled: open });

  const currentEntry = useMemo(
    () => fonts?.find((f) => f.family === family) ?? null,
    [fonts, family],
  );

  // No cap here — the gallery is windowed, so the full filtered set is fair game
  // (filterFonts also surfaces core families first on an empty query). We pass a
  // cap larger than the library so nothing is truncated.
  const { entries, total } = useMemo(
    () => (fonts ? filterFonts(fonts, query, Number.MAX_SAFE_INTEGER) : { entries: [], total: 0 }),
    [fonts, query],
  );

  // Visible window — pure function of scrollTop. Clamp to the entry count.
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const endIndex = Math.min(
    entries.length,
    Math.ceil((scrollTop + VIEWPORT_H) / ROW_H) + OVERSCAN,
  );
  const visible = entries.slice(startIndex, endIndex);

  // Lazy-load the preview webfont for the families currently on screen only.
  useEffect(() => {
    if (!open) return;
    for (const f of visible) ensurePreviewFont(f.family, f.weights);
    // visible identity changes whenever the window moves or the query changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, startIndex, endIndex, entries]);

  // Reset scroll + re-home on the active family each time the gallery opens, and
  // when the query changes (the old offset would point at a stale row).
  useLayoutEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
    setScrollTop(0);
  }, [open, query, scrollRef]);

  return (
    <div className="flex flex-col gap-1.5">
      {/* Trigger key — shows the active family (in its own face) + CORE chip. */}
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
          className="flex-1 text-left text-[12px] truncate"
          style={{
            color: open ? 'var(--ds-metal-200)' : 'var(--ds-text)',
            fontFamily: currentEntry ? fontStackFor(family, currentEntry.category) : undefined,
          }}
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
            <div
              className="flex items-center gap-1.5 px-2 py-3 rounded-ds-sm"
              style={{ background: WELL_BG, boxShadow: WELL_SHADOW }}
            >
              <Icon name="refresh" size={11} color={DS.textMid} />
              <span className="text-[9px] font-mono" style={{ color: 'var(--ds-text-low)' }}>
                Loading font library…
              </span>
            </div>
          )}
          {fonts && (
            <>
              {/* The windowed scroll gallery. A recessed well (machined trough)
                  framed in a hairline brass edge; rows are absolutely positioned
                  inside a full-height spacer so only the visible slice mounts. */}
              <div
                ref={scrollRef}
                onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
                className="relative rounded-ds-sm overflow-y-auto overflow-x-hidden"
                style={{
                  height: VIEWPORT_H,
                  background: WELL_BG,
                  boxShadow: `${WELL_SHADOW}, inset 0 0 0 1px ${dsAlpha(DS.metal400, 0.12)}`,
                }}
                data-component="font-picker-gallery"
              >
                {/* Full-height spacer drives the scrollbar to the true list
                    length; rows render only for the visible window. This is also
                    the Lenis `content` element (wrapper.firstElementChild). */}
                <div style={{ height: entries.length * ROW_H, position: 'relative' }}>
                  {visible.map((f, i) => {
                    const index = startIndex + i;
                    const isActive = f.family === family;
                    const isResolving = resolving === f.family;
                    return (
                      <button
                        key={f.family}
                        type="button"
                        data-font-option={f.family}
                        onClick={() => {
                          onPick(f);
                          setOpen(false);
                        }}
                        className="absolute left-0 right-0 flex items-center gap-2 px-2.5 text-left transition-colors group"
                        style={{
                          top: index * ROW_H,
                          height: ROW_H,
                          ...(isActive
                            ? {
                                background: `linear-gradient(90deg, ${dsAlpha(DS_ACCENT, 0.2)}, ${dsAlpha(DS_ACCENT, 0.06)})`,
                                boxShadow: `inset 2px 0 0 ${DS_ACCENT}, inset 0 0 0 1px ${dsAlpha(DS_ACCENT, 0.22)}`,
                              }
                            : undefined),
                        }}
                      >
                        {/* The name, rendered IN ITS OWN FACE — the point of the
                            gallery. Falls back to the category system stack until
                            the webfont swaps in. */}
                        <span
                          className="flex-1 text-[15px] leading-none truncate transition-colors"
                          style={{
                            fontFamily: fontStackFor(f.family, f.category),
                            color: isActive
                              ? 'var(--ds-metal-100)'
                              : 'var(--ds-text-hi)',
                          }}
                        >
                          {f.family}
                        </span>
                        {/* Category — small secondary label, machined caps. */}
                        <span
                          className="text-[7.5px] font-mono uppercase tracking-[0.14em] shrink-0"
                          style={{ color: 'var(--ds-text-low)' }}
                        >
                          {f.category === 'sans-serif' ? 'sans' : f.category}
                        </span>
                        {isResolving ? (
                          <span className="shrink-0">
                            <Icon name="refresh" size={9} color={DS.ice300} />
                          </span>
                        ) : f.core ? (
                          <span className="ds-chip shrink-0">CORE</span>
                        ) : isActive ? (
                          <span className="shrink-0">
                            <Icon name="check" size={10} color={DS_ACCENT} />
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                  {entries.length === 0 && (
                    <div
                      className="absolute inset-x-0 top-0 px-2.5 py-3 text-[9px] font-mono"
                      style={{ color: 'var(--ds-text-low)' }}
                    >
                      No family matches “{query}”.
                    </div>
                  )}
                </div>
              </div>
              <div className="text-[8px] font-mono px-1" style={{ color: 'var(--ds-text-low)' }}>
                {query.trim()
                  ? `${total} match${total === 1 ? '' : 'es'}`
                  : `${total} families`}{' '}
                · scroll to browse · CORE = pre-baked atlas, instant · others bake
                on first use, then cache
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
