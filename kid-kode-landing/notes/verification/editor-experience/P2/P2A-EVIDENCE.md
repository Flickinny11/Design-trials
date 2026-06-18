# P2a Evidence — C10 floating/animated toolbar + C11 glass-kill (2026-06-18)

Two disjoint-file agents (workflow `p2a-chrome-uplift`), then verified in real Chrome (DevTools MCP) at tier t2, DPR-2.
tsc held at baseline **9** (0 new). 0 console errors. Pre-existing webpack warning (coderef-factory dynamic require) unrelated.

## C10 — CanvasToolbar is now FLOATING / MOVABLE / GSAP-ANIMATED
File: `src/components/editor/overlays/CanvasToolbar.tsx` (+195). Desktop-only path; compact phone dock byte-identical.
- **Movable (drag):** drag-spine = the CANVAS nameplate (`[data-dock-handle]`, grip ridges + grab cursor). Live proof:
  dragged spine +240,+132 → dock moved (12,56)→(252,188) exactly; `data-floating="true"` set; brushed-metal slab
  tracked the dock to its new position (rect read per frame). Tool-button clicks do NOT start a drag (handlers only on spine).
  Clamped so ≥44px always on-screen. Frame: `p2a-dock-dragged.png`.
- **Animated collapse (real GSAP timeline, not CSS):** clicking `[data-action="dock-collapse"]` ran a power3.inOut tween —
  sampled dock height **697→697→524→200** over ~168–224ms (smooth mid-frames prove interpolation, not a snap), settles to a
  compact rail (spine stays visible). Frame: `p2a-dock-collapsed.png`.
- **Animated expand:** toggle back ran expo.out — height **200→331→605→678→693→697** over ~300ms (decelerating = expo.out).
- prefers-reduced-motion → gsap.set instant (per agent report).
- Slab/ds-* fallbacks untouched (INV-9); no 2nd renderer, no backdrop-filter, no purple.

## C11 — remaining flat / backdrop-filter glassmorphism panels → real chrome-layer glass slabs
- `HolographicDetailCard.tsx` (LIVE via OverlayHost): added `useChromeSlab({material:'glass',radius:18,frost:0.55,accent:1})`;
  **removed** the pure `backdrop-filter: blur(20px)` panel-surface declarations (confirmed gone at line ~168). ds-* fallback kept.
- `FunctionBindingPopup.tsx` (LIVE modal): glass slab on the popup body (frost 0.6, accent 1); dim scrim left as-is.
- `ElementLibraryBrowser.tsx` (LIVE §13 browser): glass slab on the header/controls block (radius [18,18,0,0] to match the
  rounded-top + square-bottom against the transparent tile grid); backdrop scrim left as-is.
- `PrismHost.tsx`: confirmed **DEAD** (page.tsx mounts only GraphScene) — not slabbed; trivially stripped its
  `backdrop-filter: blur(20px)` + single drop-shadow (kept opaque rgba 0.92).
- `ObjectFlyout.tsx`: correctly NOT modified — it is already slab-hosted by its container (CanvasToolbar's
  ToolFlyoutContainer wraps it in a glass slab). Avoids a double-slab.
- Live: 38 slabs registered in canvas mode, tier t2, 0 console errors.

## Remaining P2 → P2b
C9 Inspector↔Canvas decouple (extract ColorPicker/MaterialTab/VisualPreview as shared editors; cut the
`openInspector('material')` seam) + deferred P1 C8-A orphan-color reroute through usePreviewStateStore + NE-SC-14
(retire VisualPreview regen 2nd path). C13 perf held implicitly (slab cap 64/family; 38 now).
