# Prism Editor Design System — "Chrome-Arc" (Wave 0, FROZEN 2026-06-09)

The single source of truth for every visual decision in the editor chrome.
Rendered token sheet: `/design-system` (screenshots:
`notes/verification/ui-design/wave0-token-sheet.png`, `wave0-clip-*.png`).

**Language.** Deep-space observatory: machined chrome / titanium / mercury instruments over a near-black
substrate, anodized-blue tint, arc-cyan as the single emissive accent. The chrome must look
like it was built by the same hands as the photoreal engine — every surface is
a material, every edge catches light, nothing sits flat.

**Hard rules (the anti-slop contract).**

1. **NO purple** — anywhere, in any chrome surface, ever. `#a978ff`,
   `prism.violet`, indigo/violet Tailwind classes are all dead.
2. **No flat fills** — surfaces use the gradient ramps (`--ds-grad-*`).
3. **No component-local hex values** — consume `tokens.css` vars, the
   Tailwind `ds` namespace (`bg-ds-graphite`, `text-ds-metal-300`,
   `shadow-ds-2`, `rounded-ds-md`), or `DS`/`dsAlpha()` from
   `@/components/editor/design-system`.
4. **One accent family** — the cool metal ramp (chrome/titanium) with
   ARC-CYAN as the single emissive/active accent (selection, focus, primary
   action). ZERO brass/gold/amber. Ice is for informational/frozen states
   only; status colors (`ok/warn/danger`) for status only. Blue (`#5d8bff`,
   `electric`) is retired from chrome.
5. **Motion is transform/opacity only**, time-based, with the system
   durations/easings. `backdrop-filter` is never animated.
6. **Tilt never wraps a `SharedViewport`** — the shared GPU rig scissors to
   axis-aligned DOM rects; a perspective-rotated ancestor desyncs the preview.
   Tiles with live previews get `.ds-lift` (translate/scale) only.
7. **Tier-gated physics (INV-9)** — `html[data-ds-tier]` (`t0|t1|t2`, stamped
   pre-paint from `layout.tsx`) gates frost and refraction in
   `materials.css`. Low tiers get the SAME palette and geometry with lighter
   physics — never a broken look. `.ds-glass--refract` is hero-surface only
   (≤3 per viewport) and only renders refraction on t2 Chromium.

**Files.**

| File | What |
|---|---|
| `tokens.css` | Every custom property: palette, gradients, edges, elevation, radii, motion, type. |
| `materials.css` | `ds-*` classes: surfaces (`ds-glass`, `ds-smoked`, `ds-metal`, `ds-ceramic`, `ds-well`), edges (`ds-edge`, `ds-edge--metal`), elevation (`ds-elev-0..4`), motion (`ds-lift`, `ds-press`, `ds-sweep`, `ds-reveal`, `ds-reveal-r`), type (`ds-kicker`, `ds-label`, `ds-title`, `ds-title-metal`), controls (`ds-btn` + variants, `ds-chip` + variants, `ds-input`, `ds-select`, `ds-slider`, `ds-toggle`), `ds-grain`, tier gates, touch ergonomics. |
| `tokens.ts` | JS mirror (`DS`, `DS_ACCENT`, `DS_DIFFICULTY`, `DS_CATEGORY_TINTS`, `dsAlpha`, `dsHexNumber`, `DS_MOTION`) for icon tints, three.js colors, inline styles. |
| `tier.ts` | Chrome capability tier (mirrors runtime ceiling logic at the DOM edge) + pre-paint boot script. |
| `RefractionDefs.tsx` | The `#ds-refract` SVG displacement filter (mount once per page using `.ds-glass--refract`). |
| `use-tilt.ts` | `useTilt` pointer-parallax hook (rAF, transform-only). |

**Pseudo-element budget.** `.ds-edge*` owns `::before`; `.ds-grain` and
`.ds-sweep` own `::after`. Don't stack two `::after` owners on one element.

**Recipes.**

- Floating panel over the scene: `ds-glass ds-edge rounded-ds-lg` (+
  `ds-glass--refract ds-edge--metal` if it's the hero surface).
- Toolbar dock / machined fitting: `ds-metal ds-grain ds-edge rounded-ds-md`.
- Card / inspector section: `ds-ceramic ds-edge`.
- Input trough / preview frame: `ds-well`.
- Selected/active state: swap `ds-edge` → `ds-edge--metal`, text →
  `text-ds-arc` / `text-ds-metal-300`, optional `shadow-ds-2` → add `--ds-glow-arc`.
- Hover: `ds-lift` (cards/tiles), `ds-sweep` (metal), `ds-press` (buttons).

**Performance budget.** ≤4 `backdrop-filter` surfaces visible per viewport;
heavy frost (`ds-glass--heavy`) for modals/palettes only; grain/sweep are
static textures + composited transforms. Honor `prefers-reduced-motion`.
