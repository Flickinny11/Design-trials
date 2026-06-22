# ORRERY No.7 — FLAGSHIP VISION SPEC

> Companion to `ORRERY-NO7-PROTOTYPE-SPEC.md`. That spec proved the skeleton (6 hubs, 11-category
> configurator, running price, dimensional hero). THIS spec defines the **flagship target** — what the
> app must become to be a showpiece — and the verifiable **SC-V criteria** the harness grades it against.
>
> Crystallized: 2026-06-22 · Branch: `prism-editor-build` · App: `kid-kode-landing/`
> Graph (runtime): `kid-kode-landing/public/prism-mock/home/live-graph.json`
> Verify with the chrome-devtools `/prism-verify` loop (NOT Playwright). Evidence-based done only.

---

## 0. NORTH STAR

ORRERY No.7 is the flagship web app of a fictional haute-horology *maison* — a maison storefront **and**
a bespoke atelier where a visitor designs a one-of-one mechanical watch in true photoreal 3D, inspects it
from any angle, and acquires it. It is set in a celestial/astronomical universe (an *orrery* is a
clockwork model of the solar system) — that theme is the soul of the brand and the unlock for the single
most impressive 3D moment in the build (§3).

It exists for one reason beyond itself: **it is a live demo of the Prism canvas editor's 3D + animation
capabilities.** Every surface must earn its place by showing something a flat site cannot — real material
physics, a movement that actually breathes, a watch you assemble in your hands. If a technique is good
enough to sell to Prism customers, it must appear here (dogfooding). The bar is not "looks fine." The bar
is "a watch journalist and a Prism prospect both stop scrolling."

**Reality check (honest baseline):** the current build is a competent v0, not a flagship. It has the
bones; it lacks photoreal materials, drag-to-assemble, the movement in motion, true any-angle inspect,
the cinematic motion layer, the orrery complication, and the supporting maison sections. This spec closes
that gap.

---

## 1. DESIGN LAW (inherited, non-negotiable — MUST-FIX on violation)

1. **Dogfood.** Any technique sold to customers appears in Prism's own chrome.
2. **No flatness.** No 2D-skew-faking-3D, no flat AI-default panels. Real depth, real lighting, real PBR.
3. **No stock or emoji icons, ever.** All icons custom, dimensional, premium. No Lucide/Feather/emoji.
4. **Photoreal materials.** Metals, dials, gems, straps render with real light response (see §2, §7).
5. **Cinematic motion.** Scenes, not cuts. Everything eases per `DESIGN-REFERENCES.md` + the motion
   primitives in `CINEMATIC-PRIMITIVES-LIBRARY.md`. Nothing snaps.
6. **"Enough = not enough."** Sparse / generic / first-draft output fails the user-advocate gate.
7. **Evidence over assertion.** Done is proven with a rendered screenshot or interaction trace, never claimed.

---

## 2. THE HERO — THE ATELIER (bespoke configurator at flagship grade)

The centerpiece. Today it is swatch-grid -> preview -> price. The flagship is **assemble, inspect, acquire.**

**Experience:**
- **Assemble, don't select.** Parts live in a bin; the visitor drags a case / dial / bezel / hands /
  strap onto the build and the watch **constructs in 3D** with a physics settle. Removing a part
  disassembles it. (The award-winning "scroll/drag watch-construction" pattern.)
- **A real part system** (deeper than today's 11 rows): case (shape, size, metal, finish), bezel
  (type, insert, gem-set), lugs, crown, **dial** (guilloché, sunburst, grand-feu enamel, meteorite,
  aventurine, mother-of-pearl, skeletonized), indices/numerals, hands, **complications**,
  **movement/caliber**, caseback (solid/exhibition/engraved), strap or bracelet, deployant, lume, engraving.
- **Photoreal materials in real time** — the differentiator. Brushed vs polished steel; rose/yellow/white
  gold; titanium; ceramic. Dial finishes catch light as the watch turns (sunburst sweep, aventurine
  sparkle, enamel depth). PBR/TSL + HDRI — the exact stack Prism sells.
- **Inspect from any angle** — free orbit; **macro loupe** to read guilloché and hallmarks; **exploded
  view** that reassembles; **caseback flip** to a live exhibition movement; the **heartbeat** (balance
  wheel oscillates, escapement ticks). **Day/night toggle** to see the lume glow.
- **Live everything** — price updates per part; save / name / share / compare builds; **AR wrist try-on**;
  caseback engraving with live preview; **guided mode** (a few taste questions -> a suggested build)
  alongside the expert free-build.

**SC-V ATELIER criteria:**
- **SC-V-A1** Parts are added by drag from a bin onto the 3D build (not a flat list toggle); the watch
  visibly assembles. Evidence: interaction trace + before/after frames.
- **SC-V-A2** At least the dial, case-metal, bezel, hands, and strap are swappable and the change is
  reflected in the 3D model in real time.
- **SC-V-A3** Materials are photoreal: at least one dial finish (e.g. sunburst/guilloché) demonstrably
  changes its specular highlight as the watch is orbited. Evidence: two frames at different angles.
- **SC-V-A4** The user can orbit the watch a full 360° AND zoom to a macro/loupe level where fine detail
  (indices, engraving, guilloché lines) is legible.
- **SC-V-A5** Caseback flip reveals a movement, and the movement is **in motion** (balance/rotor animates).
- **SC-V-A6** An exploded view separates the major components and reassembles them with eased motion.
- **SC-V-A7** Running price updates correctly as parts change, and a build can be saved/named.
- **SC-V-A8** No flat/2D-default UI in the atelier chrome; bins, controls, and HUD are dimensional and
  on-brand (DESIGN LAW). Custom icons only.

---

## 3. THE SIGNATURE — THE ORRERY COMPLICATION (brand soul + the ultimate flex)

The dial *is* a working 3D orrery — a miniature solar system. This is the maison's identity and the single
most impressive thing the Prism editor could render. No flat site can touch it.

- Spin time and the planets orbit; the moonphase tracks.
- Set a date and the complication shows that night's real sky.
- It anchors the brand's "eleven years in the making" story and recurs as a motif across hubs.

**SC-V ORRERY criteria:**
- **SC-V-O1** A celestial complication renders in 3D on (or as) a dial with orbiting bodies — not a flat
  graphic. Evidence: frames at two time states showing motion.
- **SC-V-O2** The complication responds to a time/date control (scrub or set) and updates believably.
- **SC-V-O3** The orrery motif appears in at least one other surface (nav, loader, or hub transition) so
  the brand reads as coherent, not bolted-on.

---

## 4. PER-HUB TARGETS + CRITERIA

The six existing hubs are the right bones. Each must rise to flagship grade; criteria below are per-hub.

### s1 — ARRIVAL (cinematic hero)
**Target:** the watch emerges from the cosmos; liquid-glass maison lettering; an unmistakable "this is
special" first three seconds. Establishes the celestial universe and routes to the Atelier.
- **SC-V-S1.1** Hero lettering is dimensional (beveled/refractive liquid-glass), not flat text.
- **SC-V-S1.2** A real 3D watch (or the orrery motif) is present and lit, not a static image.
- **SC-V-S1.3** Entrance is cinematic (eased reveal/camera move), and a clear CTA leads into the build.

### s2 — THE MOVEMENT (the caliber as showpiece)
**Target:** the mechanism is the star — exploded, annotated, and **in motion**, with an open-heart
aperture revealing the beating movement (the Frédérique-Constant signature move).
- **SC-V-S2.1** A movement renders in 3D with animated components (balance/escapement/rotor).
- **SC-V-S2.2** An exploded or open-heart view exposes internal parts with eased motion.
- **SC-V-S2.3** Hotspots or annotations explain at least 3 components (custom UI, no stock icons).

### s3 — MATERIA (the materials library)
**Target:** an interactive library where each finish is shown photoreal and reacts to light on tap/orbit
(guilloché, sunburst, enamel, meteorite, aventurine, MOP, brushed/polished metals, côte de Genève).
- **SC-V-S3.1** At least 5 materials are presented as real, light-reactive 3D samples (not flat swatches).
- **SC-V-S3.2** Selecting/hovering a material visibly changes its specular/anisotropic response.
- **SC-V-S3.3** Layout is premium and dimensional; no flat grid-of-squares default.

### s4 — CELESTIA (the complication / celestial showcase)
**Target:** home of the orrery complication (§3) and other astronomical features (moonphase, sky).
- **SC-V-S4.1** The orrery complication (SC-V-O1..O3) is featured and interactive here.
- **SC-V-S4.2** The hub's title/treatment is dimensional (no flat-title trade-off).

### s5 — ACQUIRE (pricing, checkout, concierge)
**Target:** premium tiers, a clear made-to-order path, concierge/appointment, and a checkout that feels
like a maison, not a cart.
- **SC-V-S5.1** Pricing/tiers render cleanly with on-brand dimensional treatment; no HDRI hotspot blowout.
- **SC-V-S5.2** A built watch from the Atelier can be carried into Acquire with its spec + price intact.
- **SC-V-S5.3** Checkout/concierge UI is premium and legible (custom controls, no stock icons).

### s6 — ATELIER (the hero)
Governed by §2 (SC-V-A1..A8). This is the flagship's center of gravity.

### Future maison sections (Phase 4 — not yet built, listed for completeness)
Collections gallery · Maison/Heritage · Savoir-faire/Craftsmanship · Boutique/Concierge (3D boutique +
appointment) · My Atelier (account + saved builds) · Provenance/authenticity (digital twin) · The Journal.

---

## 5. THE 3D + ANIMATION SHOWPIECES (cross-hub — what flexes Prism)

Scroll-triggered assembly/disassembly · the movement in motion · materials catching light on orbit ·
exploded-view reassembly · caseback / open-heart reveal · liquid-glass hero lettering · a cosmic particle
ambiance with subtle orbital drift · **cinematic camera moves between hubs** (eased transitions, not cuts)
· day/night + lume reveal · cursor-tracked specular, magnetic cursor, physics press on controls ·
**sound design** (the tick, the winding click, ambient pads — restrained, on-brand, mutable).

- **SC-V-FX1** Hub-to-hub navigation uses an eased camera/scene transition, not an instant cut.
- **SC-V-FX2** At least one ambient 3D layer (cosmic/orbital) is alive on load without tanking perf.
- **SC-V-FX3** Interactive controls have premium micro-response (specular/magnetic/physics), not default hover.
- **SC-V-FX4** Day/night (lume) state is demonstrable somewhere in the experience.

## 6. NAVIGATION / CHROME / MENUS (all animated)

An orbital/celestial primary nav that fits the theme; animated part bins with clear drag affordances; a
persistent **build HUD** (current spec + price, always visible in the Atelier); smooth mode transitions
(gallery <-> atelier <-> inspect); the loupe. Nothing snaps.

- **SC-V-NAV1** Primary navigation is on-theme and dimensional (custom, no stock chrome).
- **SC-V-NAV2** The Atelier shows a persistent, legible build summary + price.
- **SC-V-NAV3** Mode/section transitions are eased and coherent.

## 7. ASSET-GENERATION PIPELINE (the premium look) — API KEY GOES HERE

To make every surface look manufactured (real watch parts, PBR materials, HDRIs, marketing imagery, hero
video), the build generates assets from a hosted multi-model platform. fal.ai is the usual one-key-for-all
choice but is **currently unavailable**, so the pipeline targets:

**PRIMARY (one key — the fal-equivalent): Replicate.** Single API, pay-per-use, broadest catalog. Covers:
- **Image / textures / HDRIs / marketing:** FLUX.2 [pro] (studio photoreal), Nano Banana 2 / Pro.
- **Video (hero loops):** Veo 3.1 (cinematic + audio) and/or Kling v3 (4K, value).
- **3D (fallback / non-hero parts):** Hunyuan3D 3.0 Pro, TRELLIS 2, Tripo.

**HERO 3D (optional 2nd key — best-in-class for watch parts): Hyper3D / Rodin (Gen-2).** The 2026
production-quality leader: clean quad topology, proper UVs, auto PBR (albedo/roughness/metallic/normal),
crisp engravings — exactly what precision cases/dials/movements need. Add when hero-3D fidelity matters.

**Where the keys live (matches the `.constellation/` pattern):**
- Dir: `/Users/loganbaird/Prototype_Prism/Design-trials/.assetgen/` (gitignored, chmod 600 — NEVER committed).
- `REPLICATE_API_TOKEN` (required) · `HYPER3D_API_KEY` (optional, for hero 3D).
- Generated assets land in `kid-kode-landing/public/prism-mock/orrery/assets/` and are referenced by node schema.

**Precision principle:** the most exact watch geometry is built procedurally (Three.js) and dressed with
**AI-generated PBR materials + HDRIs**; AI 3D-gen (Rodin) is used for organic/complex parts and rapid
exploration. AI never ships rough — every asset clears the art-fidelity gate before it lands.

## 8. PHASING (decomposed for the harness — one run per phase, not one mega-run)

- **Phase 1 — The Atelier to flagship grade:** drag-assemble + photoreal materials + any-angle inspect +
  movement-in-motion + live price (SC-V-A1..A8). *This is the next run.*
- **Phase 2 — The orrery complication** (SC-V-O1..O3) on the Celestia dial.
- **Phase 3 — The cinematic motion layer + showpieces** (SC-V-FX1..FX4, SC-V-NAV1..NAV3).
- **Phase 4 — The supporting maison sections** (collections, heritage, savoir-faire, boutique, account, journal).

## 9. VERIFICATION

Graded by the chrome-devtools `/prism-verify` two-layer evidence loop (NOT Playwright). Per hub: three
gates — (1) prism-criteria-reviewer against the SC-V criteria with cited frames, (2) tsc gate (0 new vs
baseline) + art-fidelity reviewer, (3) user-advocate capstone (non-technical first-timer, evidence-backed,
MUST-FIX power, anti-rubber-stamp). A criterion is met only with a cited rendered screenshot or interaction
trace. "Enough = not enough."

---
*End ORRERY No.7 Flagship Vision Spec.*
