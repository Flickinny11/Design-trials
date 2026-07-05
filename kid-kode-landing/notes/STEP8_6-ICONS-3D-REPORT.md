# STEP 8.6 — Icons: overtly 3D / dimensional / premium (custom only)

**Date:** 2026-06-07 · **Branch:** `prism-editor-build` (HEAD unchanged — NOT committed; staged for Logan's design review) · **Model:** claude-opus-4-8

## Directive
The custom icons were good but too flat. Push them to read as overtly 3D, dimensional, and PREMIUM while staying fully custom (no stock icon libs): real depth/extrude, a single consistent KEY-LIGHT direction across ALL icons, specular sheen, soft contact shadow, subtle bevel — one cohesive material/lighting language. Crisp + performant at toolbar sizes. Applied to **every** editor icon.

## What changed (files)
- **`kid-kode-landing/src/components/editor/icons/Icon.tsx`** — the single shared DOM/SVG `Icon` component. Rewrote only the *rendering/lighting* (the `Icon()` function); the glyph vector data (`PATHS`) and the public props API are **unchanged**, so every call site upgrades at once:
  - **toolbar rail + CANVAS badge**, **tool flyouts** (wired + placeholder tiles + flyout header chips), **TopBar** (logo, Scene/Topology, Graph breadcrumb, Add Node, refresh, Search, build progress check), **Inspector** (breadcrumb, close, FE check, Inspect/Edit/refresh/zap, Clone), **mode toggle**, **Minimap**, **HubNav**, toasts, keyframe editor.
- Backup: `Icon.tsx.bak-20260607-130225` (alongside the file).

**Out of scope, untouched:** `IconPrimitives.ts` (the separate in-scene `THREE.ExtrudeGeometry` path), all functionality, the primitive catalog, engine/harness. No new dependencies. `package.json`/`package-lock.json` unchanged.

## The new icon model (back → front)
One shared key-light, top-left (`LIGHT = {dx:0.6, dy:0.8}` — extrusion/shadow recede down-right). Everything derives from this one vector so the whole set reads as a single milled family:
1. **Soft contact shadow** — layered CSS `drop-shadow` cast down-right, grounds the chip (scales with size).
2. **Stepped extruded body** — N offset copies (4–8 by size) stepping down-right, colour-graded from a near-black ambient-occlusion base (`#010209`) up to a lit bounce just under the face (`#0d132c`) → a smooth, visible solid flank that no longer vanishes into the dark glass chrome.
3. **Colored face** (`primary` = `currentColor`/hex/accent).
4. **Directional light wash** — bright top-left → shaded bottom-right, in `userSpaceOnUse` viewBox space so the angle is identical on every glyph.
5. **Specular hotspot** — tight radial gloss near the top-left (glossy enamel sheen).
6. **Directional bevel stroke** — one gradient stroke bright on the top-left edge, dark on the bottom-right → a rounded, catch-the-light bevel.
7. **Hairline rim-light** — keeps edges crisp at toolbar sizes.

Depth, step count, bevel width, rim, and shadow all scale with render size: big icons feel sculptural; small toolbar glyphs stay crisp. All light/shadow overlays are white/black alpha → **color-agnostic** (any tint extrudes correctly).

## Evidence (`notes/verification/step8_6/`)
| File | Shows |
|---|---|
| `zoom-rail-icons.png` | Rail close-up — cube, Selection layers, Lighting bulb, Image read as lit solids with shared key-light |
| `rail-plus-flyout.png` / `icon-rail.png` | Rail + Transform flyout (wired) |
| `flyout-transform.png` | Wired flyout glyphs (move/rotate/scale/align/snap/reset) |
| `flyout-object3d.png` | Placeholder-tile grid + violet glowing header chip (cube) |
| `topbar.png` | TopBar glyphs at small size — still crisp + dimensional |
| `inspector.png` | Inspector (eye/pencil/check/home/refresh/zap) |
| `full-canvas.png` | Whole editor in canvas mode — all surfaces intact |
| `after-move.png` | Post functional-move (built artifacts intact) |
| `report.json` | `functionalMovePass: true`, `consoleErrors: []`, `pageErrors: []` |

## Assertions
- **Still zero stock-icon-lib imports** — `Icon.tsx` imports only `react`; no lucide/react-icons/heroicons/fortawesome/feather/phosphor/tabler anywhere. The dependency-allowlist guard still blocks any re-add.
- **Build/typecheck clean** — `tsc --noEmit` reports **0 errors in `Icon.tsx`** (the only pre-existing `tsc` errors are unrelated test-file `NodeContext.THREE` issues present on baseline).
- **Guard intact** — no forbidden patterns; no `document.*`/`window.*` in the component; `IconPrimitives.ts` untouched; `PATHS` vector data unchanged.
- **Function preserved** — wired tools work: selected `home-headline`, enabled Edit handles, nudged via the toolbar → `scenePosition.x 0 → 0.18` (visible move). Console **zero** new errors. Mode toggle canvas→galaxy→canvas rebuilt nothing (no errors, artifacts stable).

## Reviewer verdict
`prism-criteria-reviewer` (fresh context; diff + criteria only): **PASS on all 6 criteria, zero MUST-FIX.** Confirmed: depth/premium lighting language present and cohesive; custom-only (single React import, `PATHS` unchanged); API unchanged (no call-site edits); SVG/CSS-only + size-scaled (crisp, performant, no new deps, no DOM access); scope locked to `Icon.tsx` (`IconPrimitives.ts` untouched); color-agnostic overlays. The one cosmetic nit (`walls` typing) was applied.

## Scope lock
HEAD stays `prism-editor-build`. **No commit** — `Icon.tsx` left modified in the working tree for Logan's design review. (Unrelated pre-existing dirty files — `notes/ralph-state.json`, `public/prism-assets/mock-app.prism`, retired-loop bookkeeping — were already dirty at session start and are not part of this change; keep them out of any STEP-8.6 commit.)

---

## Plain-language summary for Logan

I rebuilt how every editor icon is *lit and extruded* — the shapes themselves are exactly the ones you already liked, just no longer flat.

Before, each icon was a flat fill with two thin dark plates behind it that basically disappeared against the dark glass panels. Now every icon is built like a little **milled metal/enamel chip lit by one shared light from the top-left**:

- **Real extruded body** — instead of 2 plates, there's a stepped stack (more steps on bigger icons) that grades from near-black at the base up to a faintly lit edge under the face, so you see a genuine solid *side* to the icon.
- **One consistent key-light** — every icon in the whole editor is lit from the same top-left angle, so the rail, TopBar, Inspector, flyouts, minimap and hub-nav all look like one family rather than a grab-bag.
- **Glossy specular highlight** — a tight bright hotspot in the top-left corner gives that premium enamel/glass sheen (most obvious on the cube, the lighting bulb, and the image icon).
- **Soft contact shadow** — a blurred shadow cast down-right grounds each icon so it sits *on* the panel instead of floating flat.
- **Directional bevel** — the top-left edges catch light and the bottom-right edges fall into shadow, reading as a rounded, beveled rim.

The solid-area glyphs (cube, bulb, layers/Selection, image, palette) pop the hardest — they clearly read as lit 3D objects now. The thin-line glyphs (move arrows, plus, hammer, pencil) are more restrained by nature but still share the same light, shadow and bevel so they belong to the set. I kept the depth size-aware so the tiny TopBar/toolbar icons stay sharp and legible rather than turning muddy.

It's all done with layered SVG + gradients + two CSS drop-shadows — no live 3D render per icon — so it's cheap and fast even with dozens on screen. **Nothing functional changed** and I didn't commit; it's sitting in the working tree for you to look at the screenshots (start with `zoom-rail-icons.png`) and tell me whether to push the depth harder, dial it back, or adjust the light angle / sheen intensity.
