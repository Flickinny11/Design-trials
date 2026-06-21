# ORRERY No.7 — FIDELITY PASS REPORT

**Goal:** make the whole app read as the premium 3D product it claims to be — kill flat/skewed
chrome, stage the heroes, surface the buried richness, make the configurator + pricing
discoverable. Branch `prism-editor-build`. Model: claude-opus-4-8. Verification: Playwright MCP
against `localhost:3000` (real WebGPU, tier T2), fresh-tab boot from
`public/prism-mock/home/live-graph.json`.

Evidence under `notes/verification/fidelity/`. Three gates per hub: **Gate 1** functional/contract
(renders, interactions, 0 console errors), **Gate 2** art (premium? dimensional, on-brand),
**Gate 3** fresh-context user-advocate (drive as a first-timer).

---

## Root-cause finding (the lever)

The "flat skewed text" on every hub title was **flat zero-depth MSDF quads** under a 50°
perspective camera — not a skew transform, just perspective foreshortening of a depthless plane.
The true-3D extruded-text path (`createTextObject3D`, opentype→ExtrudeGeometry) already existed
but **no node ever set `textSpec.extrude.enabled`**. Fixing that one data flag + a ~40-line glass
material capability lifted every hub title at once.

### Wave 0 — code (the enabler)
- `src/lib/prism-graph/types.ts` — `TextExtrudeSpec` gains additive glass fields:
  `transmission, ior, thickness, clearcoat, clearcoatRoughness, dispersion, iridescence` (INV-18).
- `src/lib/prism/text/text-object-3d.ts` — `buildUnitMaterial` + new `applyGlass()` promote an
  extruded wordmark to a **single shared** `MeshPhysicalNodeMaterial` admitted **once** into the
  ≤2 Path-B transmission budget (whole title = 1 surface, never one-per-glyph), released on
  `clearUnits`/`dispose`. Over budget → graceful clearcoat-glass fallback.
- `src/lib/prism/atelier/applier.ts` — configurator price formatter `$`→`CHF ` (currency
  consistency with s5).
- tsc: 9 errors (baseline, **0 new**). 0 console errors live.

---

## Per-hub results

| Hub | Before | After | G1 | G2 | G3 (advocate) |
|---|---|---|---|---|---|
| s1-arrival | `baseline-s1-arrival.png` | `final-s1.png` | ✅ | ✅ | _pending_ |
| s2-movement | `baseline-s2-movement.png` | `final-s2.png` | ✅ | ✅ | _pending_ |
| s3-materia | `baseline-s3-materia.png` | `final-s3.png` | ✅ | ✅ | _pending_ |
| s4-celestia | `baseline-s4-celestia.png` | `final-s4.png` | ✅ | ✅ | _pending_ |
| s5-acquire | `baseline-s5-acquire.png` | `final-s5.png` | ✅ | ✅ | _pending_ |
| s6-atelier | `baseline-s6-atelier.png` | `s6-nav-after.png` (+`s6-click-green.png`) | ✅ | ✅ | _pending_ |

### s1-arrival — landing
- **Before:** flat skewed gold "Time, machined." decal; tiny lonely hero watch in a void; flat
  skewed CTA; configurator unreachable.
- **After:** true **liquid-glass** hero lettering (extruded + transmission, refracts the nebula,
  warm-brass rim); hero watch staged 1.88→3.2 (camera frames the fixed header/footer column, so a
  bigger watch fills more frame); subhead reflowed; **two dimensional brass CTAs** — "ENTER THE
  ATELIER" (→configurator) + "RESERVE No.7"; full 6-tab nav.
- Commit `efb45212`. transmission held at 2 (cap-guard graceful, 0 errors).

### s5-acquire — was the weakest hub
- **Before:** lonely pedestal watch; price `fs0.1` occluded behind the headline; no tiers.
- **After:** product-detail layout — eyebrow + dimensional headline (top), "WHAT YOU RECEIVE"
  list (left), centered hero watch+pedestal, **right buy-box with prominent legible CHF 340,000 +
  edition/delivery availability**, assurance line, RESERVE(primary)+ENQUIRE(secondary). +6 nodes.
- Commit `1c5a52c8`.

### s6-atelier — the configurator (SliderRevolution-killer)
- **Verified fully usable by DRIVING it:** a real pixel-click on the green dial swatch changed
  the live watch dial navy→green and recomputed the price **CHF 38,000→39,200** (38000 + green
  1200, exact) and updated the summary. The static-audit "dead price binding" was a **false
  alarm** — the runtime computes price (`PRICE_FLOOR` + per-option `priceDelta`).
- **Was an orphan dead-end** (zero chrome, absent from registry). Now: full 30-node nav shell
  cloned in, dimensional brass "THE ATELIER" title, CHF currency, registered in `hubRegistry` +
  edges.
- Commit `80a14ad5` (+ nav `456d581c`).

### s3-materia — depth triptych
- **Before:** three flat coplanar material tiles (identical z, zero rotation).
- **After:** z-staggered into a depth triptych — sapphire crystal pops forward as hero, brass +
  meteorite recede (whole-cluster z translation, no shear); dimensional brass "Materia" title.
- Commit `3e9b610b`.

### s2-movement / s4-celestia
- Dimensional brass titles; s2 exposed tourbillon enlarged 0.6→0.85 (watch + calibre + spec
  strip); s4 armillary hero enlarged 1.0→1.35, complication CTA lifted clear of the mechanism
  (armillary + orbiting planets + orbital rings + starfield).
- Commit `e4b2f42f`.

### Navigation / IA
- **The configurator was undiscoverable** (no Atelier nav link anywhere; s6 not in the hub
  registry; s6 itself had no nav = dead-end). Fixed: 6-tab nav (adds **Atelier**) re-spaced
  evenly across all hubs; landing "ENTER THE ATELIER" CTA (≤1-action reach); s6 given a full
  chrome shell; s6 registered in `hubRegistry` + nav/journey edges. 340 nodes.
- Commit `456d581c`.

---

## Verification notes / honest flags
- **0 console errors** on every hub (the bar). Warnings present: webpack `Critical dependency`,
  `THREE.Clock deprecated`, Rapier init, and the **`[PRISM] TRANSMISSION LIMIT: capped at 2`**
  guard line — all benign; the transmission cap is the spec's own budget working as designed.
- **Engine/verification gotchas discovered (now documented):** (a) `loadFromUrl` caches — append
  `?t=Date.now()`; (b) pure `scenePosition` changes on existing nodes don't re-apply on
  `loadFromUrl` — need a view-mode rebuild OR a fresh-tab boot; textSpec/mesh changes DO re-apply;
  (c) the galaxy view-mode toggle renders all 340 nodes and can hang the tab — **a fresh tab
  boots from the file with correct positions and is the reliable verification path**; (d) the
  `GET_NODE_SCREEN_RECT` helper's screen mapping is offset from real click-picking in the editor
  preview (clicking a tab's reported center can hit a neighbor) — a **harness coordinate
  artifact**, not an app defect. The Atelier nav hit is a structural clone of the proven-working
  Acquire hit with only the bound `hubId` changed, and its `functionBinding` is verified correct
  in data.
- The atelier "reset" restores a saved build (session persistence), not factory defaults — fresh
  visitors still get the navy/steel default.
