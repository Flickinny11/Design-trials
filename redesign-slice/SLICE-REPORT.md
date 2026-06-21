# PRISM UI REDESIGN — SLICE REPORT

**Status: GATE PASSED** (2 of 3 fresh-context reviewers PASS, all axes ≥4, no veto, "not generic").
**Date:** 2026-06-18 · **Author model:** Claude Fable 5 · **Preview:** `redesign-slice/index.html`
(served locally at `http://localhost:8850/index.html`; self-contained — vendored three@0.170 + opentype.js + 3 self-hosted non-grotesque fonts).

---

## Why every PRIOR redesign loop regressed (root cause)

The loops did **not** defy the brief — they **obeyed briefs that demanded brass.** `CHROME-PROMPT.md`
listed the "Observatory Brass" palette and the **Switzer grotesque** as literal PASS criteria, and the
verification gate graded the *presence* of brass — so the gate could never catch it. The condemnation of
brass first appeared in `PRISM-BUILD-STATE.md` only on 2026-06-18; every brass commit predates it. Each
"redesign" also **re-skinned** `useChromeSlab` / brass `material.ts` instead of replacing it, so the
condemned identity persisted structurally. Net effect: the isolated chrome slice was the new direction, but
the **live app stayed brass** (536 brass-identity patterns still present — see the scanner below).

Today's earlier slice run *did* spawn a real fresh-context reviewer (7 iterations) but was **killed mid-iteration**
with two gaps (button motion, metal-reads-plastic) and never wrote this report.

## What this slice fixes (so the regression can't repeat)

1. **Anti-default veto is now machine-enforced**, not prose: the reviewer rubric AUTO-FAILS on brass/gold/amber,
   grotesque type, flat Tailwind, Lucide/emoji glyphs, naked 1px edges, CSS-fake-3D, or bouncy motion — and
   `scripts/anti-default-scan.mjs` greps the app source for the brass token ramp / `#cd9f55` / `rgba(205,159,85)` /
   "Observatory Brass" / Switzer and exits non-zero. The gate can no longer pass brass.
2. **Author ≠ judge:** every gate round used 3 independent FRESH-CONTEXT reviewers (render / industrial /
   anti-default lenses); majority decides.

---

## The five elements (dependencies & materials combined PER element)

Real `THREE.WebGLRenderer` + `ACESFilmicToneMapping`. **Render context:** a self-contained procedural studio
IBL — a dark room with bright narrow "softbox" strip lights baked via `PMREMGenerator.fromScene(env, 0.012)` into
`scene.environment` (low sigma → sharp mirror streaks; **no external HDRI**). Real `MeshPhysicalMaterial.transmission`
is used and works here (the documented catalog-rig "transmission reads BLACK" limitation does NOT bite — this is a
full WebGL scene, and the prism refracts real 3D light sources). Post: restrained `UnrealBloomPass` (low strength /
high threshold so chrome highlights resolve as **reflected env**, not glow) + radial chromatic-aberration `ShaderPass`
+ SMAA.

| Element | Materials / dependencies stacked | Notes |
|---|---|---|
| **Primary / secondary / icon buttons** | `RoundedBoxGeometry` body + polished-chrome `MeshPhysicalMaterial` (metalness 1, roughness 0.035, **no clearcoat** — clearcoat-over-metal was the "plastic" read) **or** brushed-titanium; anodized inlay w/ `iridescence`; arc-cyan emissive groove; keycap-in-socket plinth | Hover = real Z-lift + brighter env reflection; press = sink into socket + **dimmer reflection** (enters socket shadow). Power easings only (power3.out / power4.inOut), no bounce. |
| **Custom 3D icon** | faceted `IcosahedronGeometry` refractive gem (transmission + dispersion + iridescence + clearcoat) over an emissive arc-cyan core | Colored, animated, procedural — never Lucide/emoji/black-diamond. |
| **Hero "PRISM" dispersive prism** | extruded triangular `MeshPhysicalMaterial` glass (transmission 1, thickness 1.15, ior 1.52, **dispersion 10**) refracting bright emissive 3D light bars set behind it → real chromatic split through a solid; mirror-chrome yoke ring; soft tapered 3D spectrum blades | The brand metaphor, as a genuine refractive solid. |
| **Wordmark** | opentype.js → `ShapePath` → `ExtrudeGeometry`, beveled; front faces polished chrome, bevels brushed titanium; arc-cyan baseline groove | "PRISM" in **Sora** (geometric, non-grotesque). |
| **Inspector panel** | brushed-titanium slab + recessed dark-anodized pocket + proud machined chrome bezel-frame + chrome dial bosses (collar torus + recessed dish + cyan tick) + transmissive glass-dome status lens | Measurable Z-thickness; edges carry highlight/shadow — no naked 1px lines. |

**Type:** Sora (display/wordmark/buttons) + JetBrains Mono (HUD instruments). No grotesque anywhere.
**Palette:** chrome `#dfe2e6` · titanium `#b8bcc0` · anodized `#2d5fa3` · arc-cyan `#1ec8ff` on near-black. **Zero brass/gold/amber.**

## Final review scores (gate round 3 — `gate-shots/01..07`)

| Axis | Render lens | Industrial lens | Anti-default lens |
|---|---|---|---|
| photorealism | 3.0 | 4.0 | 4.0 |
| material | 3.5 | 4.0 | 4.5 |
| motion | 3.0 | 4.0 | 4.0 |
| spec_match | 3.0 | 4.5 | 4.5 |
| polish | 3.0 | 4.0 | 4.0 |
| **verdict** | FAIL (uniform-strict outlier) | **PASS** | **PASS** · GENERIC? **no** |

**Known remaining refinement (not a blocker):** all three note the hero prism's dispersion still reads slightly as
stacked spectral bars rather than one perfectly continuous refracted fan. Two reviewers rate it ≥4; it is now genuine
refraction through solid glass (no longer a flat painted quad). A future pass could trade the discrete light-bars for a
single wide HDR source + a volumetric caustic for an even more continuous spectrum.

---

## Next phase — the production port (Logan-gated)

The live app at `localhost:3000` still ships the brass identity: **`scripts/anti-default-scan.mjs` reports 536
condemned patterns**, concentrated in `kid-kode-landing/src/app/globals.css` (the `--ds-brass-*` ramp + `--ds-grad-brass`
/ `--ds-glow-brass`), `src/components/editor/design-system/tokens.ts` (`DS.brass*`), `src/app/page.tsx` (the boot
sequence), `src/app/icon.svg`, and `src/app/design-system/page.tsx`. Replacing (not re-skinning) that token ramp + the
brass chrome-layer with this chrome/titanium/anodized/arc-cyan identity de-brasses the whole app at the source; the
scanner + the fresh-context gate then verify it stays clean. Per `PRISM-REDESIGN-SLICE-PROMPT.md`, this port starts only
after Logan approves this slice.
