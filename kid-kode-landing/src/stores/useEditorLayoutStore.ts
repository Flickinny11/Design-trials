'use client';

/**
 * useEditorLayoutStore — CONTAINER-aware editor density (UI-WOW-2 P0).
 *
 * The editor is the preview pane of an AI app-builder: it can be full-browser,
 * a half-screen pane next to a streaming chat, or a phone. Responsiveness must
 * therefore key off the editor's OWN box width, not `window.innerWidth` — the
 * latter is blind to a narrow pane inside a wide browser (the embedded case).
 *
 * A single ResizeObserver on `<main>` (wired by useEditorLayoutObserver, called
 * once in page.tsx) publishes the measured width/height here; every consumer
 * reads `density` instead of a viewport media query. This is the one change
 * that makes the editor correct at any pane width.
 *
 * Additive (INV-18): a brand-new store; touches no existing schema or store.
 * Density is orthogonal to viewMode — it is NOT a 4th mode (FP-12/FP-14 safe).
 */

import { create } from 'zustand';

export type EditorDensity = 'compact' | 'regular' | 'wide';

/** Breakpoints on CONTAINER width (the <main> box in CSS px), not viewport. */
export const DENSITY_COMPACT_MAX = 820; // < this → compact: phone / narrow embedded pane
export const DENSITY_REGULAR_MAX = 1180; // < this → regular: tablet / half-screen pane; ≥ → wide

export function densityForWidth(w: number): EditorDensity {
  if (w < DENSITY_COMPACT_MAX) return 'compact';
  if (w < DENSITY_REGULAR_MAX) return 'regular';
  return 'wide';
}

interface EditorLayoutStore {
  /** Measured CONTAINER width in CSS px (the <main> box). */
  width: number;
  /** Measured CONTAINER height in CSS px. */
  height: number;
  density: EditorDensity;
  /** false until the first real measurement lands (lets callers avoid acting on the SSR guess). */
  ready: boolean;
  setSize: (width: number, height: number) => void;
}

export const useEditorLayoutStore = create<EditorLayoutStore>((set, get) => ({
  width: 1440,
  height: 900,
  density: 'wide',
  ready: false,
  setSize: (width, height) => {
    const density = densityForWidth(width);
    const prev = get();
    if (prev.ready && prev.width === width && prev.height === height && prev.density === density) return;
    set({ width, height, density, ready: true });
  },
}));

/** Sugar selectors — keep subscriptions narrow so a width tick that doesn't
 *  cross a breakpoint never re-renders a density-only consumer. */
export const useEditorDensity = (): EditorDensity => useEditorLayoutStore((s) => s.density);
export const useIsCompact = (): boolean => useEditorLayoutStore((s) => s.density === 'compact');
export const useEditorWidth = (): number => useEditorLayoutStore((s) => s.width);
