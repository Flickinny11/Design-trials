# PREBUILT ELEMENT LIBRARY — CATALOG PLAN (Phase 2)

Each element = one `ElementClusterDefinition` file in
`src/lib/editor/elements/catalog/<id>.ts`, registered in the barrel
`catalog/index.ts`. Build against the FROZEN contract: read
`notes/PREBUILT-LIBRARY-CONTRACT.md` §6 (author checklist) first. Copy the
shape of the two SEED elements (the reference templates):
`catalog/carousel-photoreal-ring.ts` + `catalog/hero-photoreal-monolith.ts`.

## THE BAR
Photorealistic, premium, smooth, robust. Must decisively SMASH Slider
Revolution (morph-through-3D, photoreal rotating 3D carousels). A senior 3D
designer must call each best-in-class. Photorealism comes from real
`materialSpec` (metalness/roughness/transmission/clearcoat/iridescence/
envMapIntensity) + `lightingSpec` opt-in (the preview rig supplies studio IBL +
3-point) — NOT from textures alone. fal hero imagery only where it genuinely
elevates (most elements need none).

## GUARDRAILS (hard)
- Members are PrismNodes built by the EXISTING factory; animations are EXISTING
  catalog primitives (bind by real registry `name`). NO new renderer, NO new
  npm dep, NO PixiJS, NO second canvas, NO purple, design-tokens only, never the
  word "fal" in user copy. Additive schema only.
- `animationBindings[].primitive` MUST be a real name from the palette below.
- INV-9: full fidelity at `tier` (T1/T2); MUST still read clean at T0.
- INV-11: text members use `renderMode:'text'` + `textSpec` (real MSDF); never
  bake letters into images.

## PRIMITIVE PALETTE (407 real names, by category — bind these)
- **transform(45)**: spin, float, cube-rotate, cylinder-unroll, card-fold, flip-3d, depth-pop, scale-pop, drop-bounce, drop-squash, elastic, jelly, overshoot, perspective-tilt-in, spiral-in, weightless-drift, zoom-rotate-in, domino-cascade, tumble-settle, swing, pendulum-settle, unfold, door-open, accordion-y, …
- **pointer(28)**: magnetic, magnet-snap, hover-lift, pointer-tilt-3d, pointer-orbit, parallax-layers, spotlight-follow, proximity-rim-glow, pointer-press, charge-release, cursor-trail, throw-physics, drag-elastic-warp(displacement), velocity-skew-follow, repel, pointer-shine, …
- **scroll(30)**: scroll-orbit-scrub, scroll-rotate-3d, scroll-stagger-rise, scroll-snap-sections, horizontal-scroll, parallax, pin-reveal, scroll-progress-fill, scroll-depth-dolly, scroll-marquee, scroll-velocity-stretch, scrub-morph, scroll-fold-scrub, …
- **glass(22)**: iridescent-glass, dispersion, glass-refraction, crystal-facet, gemstone-cut, bevel-glass, frosted-glass, liquid-glass, soap-bubble, fresnel-glow, holo-glass, fluted-glass, smoked-glass, …
- **shimmer(21)**: liquid-metal-flow, brushed-metal, metallic-sheen, pearlescent, gold-glint, light-sweep, glint-streak, holographic, iridescence, rainbow-fresnel-edge, neon-edge-pulse, satin-band, velvet-sheen, diamond-sparkle, …
- **displacement(35)**: displacement-transition, liquefy-reveal, swirl-warp, wave-distort-in, ripple-displace, lens-bulge, melt, shatter-assemble, tiles-assemble, splat-reveal, morph (see mask), pointer-loupe, heat-haze-refract, …
- **mask(23)**: morph-into-card, sdf-shape-morph, mask-iris-morph, metaball-merge, pill-morph, ring-wipe, iris-wipe, wipe-linear, spiral-wipe, …
- **text(36)**: text-fade-up-each, split-3d, text-counter-roll, text-wave-3d, text-extrude-rotate, text-gradient-sweep, text-glow-pulse, text-magnetic-in, text-mask-reveal, kinetic via split-stagger, decode-text, scramble, …
- **particles(59)**: orbit-rings, constellation-net, image-to-particles, particle-assemble, galaxy-particles, comet-orbit, fireflies, bokeh-drift, confetti, embers, dust-particles, …
- **wave(33)**: flag-wind-sim, flag-wave, banner-flutter, curtain-wave, cloth-sway, jelly-surface, ripple, water-surface, sail-bulge, …
- **volumetric(22)**: godray, light-shafts, aurora, nebula, fireball-burst, plasma, fog, clouds, … (T2; degrade gracefully)
- Also: caustics(12), smoke(16), blur(10), fade(15). Full list in `src/lib/prism/animatable/primitives/`.

## ROSTER (~30 NEW + 2 seeds = comprehensive; one subagent per element)
Each line: id | category | concept (the SR-smashing move) | suggested bindings.

CAROUSELS (seed: carousel-photoreal-ring):
- carousel-coverflow-depth | carousel | curved row of cards, center in focus, depth blur | scroll-orbit-scrub or pointer drag; cards depth-pop
- carousel-cylinder-billboard | carousel | panels wrapped on a rotating cylinder | cylinder-unroll + spin
WHEELS:
- wheel-radial-menu | wheel | icon spokes on a hub, snap-to-segment | pointer-orbit + magnet-snap
- wheel-fortune-spinner | wheel | segmented disc that spins + settles | spin + pendulum-settle
SLIDERS:
- slider-morph-through | slider | full-bleed panels morph THROUGH 3D between slides (SR-killer) | displacement-transition / liquefy-reveal
- slider-depth-parallax | slider | layered parallax slides w/ depth | parallax-layers + scroll
- slider-distortion-fade | slider | swirl/ripple distortion crossfade | swirl-warp / wave-distort-in
HEROES (seed: hero-photoreal-monolith):
- hero-liquid-metal | hero | molten chrome centerpiece + kinetic headline | liquid-metal-flow + text-fade-up-each
- hero-glass-prism | hero | dispersive glass prism + godray + headline | dispersion/iridescent-glass + godray + split-3d
- hero-particle-emerge | hero | logo/mark assembles from particles + text | particle-assemble/image-to-particles + text-mask-reveal
BANNERS:
- banner-silk-flag | banner | cloth banner rippling in wind + text | flag-wind-sim + text
- banner-light-sweep | banner | metallic plate w/ sweeping specular + text | light-sweep + metallic-sheen
- banner-ticker | banner | 3D ticker strip | scroll-marquee / ticker-tape
GALLERIES:
- gallery-depth-wall | gallery | tilt-reactive depth grid | pointer-tilt-3d + parallax
- gallery-masonry-reveal | gallery | staggered scroll reveal | scroll-stagger-rise + mask wipe
CARD-STACK:
- cardstack-swipe-deck | card-stack | physics swipe deck | throw-physics / drag-elastic-warp
- cardstack-fan-spread | card-stack | fanned card spread on hover | card-fold + hover-lift
NAVIGATION:
- nav-glass-dock | navigation | magnetic glass dock pills | magnetic + hover-lift + frosted-glass
- nav-orbital-ring | navigation | nav items on an orbital ring | pointer-orbit
SHOWCASE:
- showcase-turntable | showcase | product on a brushed-metal turntable + spotlight | spin + spotlight-follow + brushed-metal
- showcase-exploded | showcase | parts explode + reassemble | shatter-assemble / explode-reassemble-sim
MARQUEE:
- marquee-ticker-3d | marquee | 3D extruded ticker | scroll-marquee + text-extrude
- marquee-ribbon-flow | marquee | flowing ribbon of words | flow-ribbon + text
FEATURE-GRID:
- featuregrid-tilt-cards | feature-grid | tilt + rim-glow cards | pointer-tilt-3d + proximity-rim-glow
- featuregrid-depth-pop | feature-grid | cards pop on scroll | depth-pop + scroll-stagger-rise
TESTIMONIAL:
- testimonial-orbit-quotes | testimonial | avatars orbit a central quote | orbit-rings + text
- testimonial-float-glass | testimonial | floating glass quote cards | float + frosted-glass
PRICING:
- pricing-pillars-3d | pricing | 3D pillars w/ gold accents + rolling prices | scale-pop + gold-glint + text-counter-roll
- pricing-glass-tiers | pricing | glass tier cards w/ sweep | bevel-glass + light-sweep
STAT-COUNTER:
- stats-odometer | stat-counter | brushed-metal odometer counters | text-counter-roll + brushed-metal
- stats-ring-progress | stat-counter | progress rings fill | scroll-progress-fill
CTA:
- cta-magnetic-pedestal | cta | magnetic button on a lit pedestal | magnetic + charge-release + neon-edge-pulse
- cta-glass-banner | cta | glass CTA bar w/ sweep + headline | bevel-glass + light-sweep + text
LOGO-CLOUD:
- logocloud-orbital | logo-cloud | logos orbit in 3D | orbit-rings
- logocloud-constellation | logo-cloud | logos linked as a constellation | constellation-net + parallax-layers

## PER-ELEMENT CHECKLIST
1. id/label/category/caption/description set; `tier` (T1 default, T2 for volumetric/GI).
2. members: 3–8, each with pose (local, cluster origin), footprint, renderMode,
   meshPrimitive+materialSpec (premium PBR) OR textSpec (MSDF) OR sourceAsset.
3. ≥1 member carries a default integrated `animationBindings` (real palette name).
4. preview: camera framing (distance/polar/azimuth) that frames all members; frozenPhase; loopSeconds.
5. designRefs: list the DESIGN-REFERENCES techniques shown (for the report table).
6. Register in catalog/index.ts barrel.
7. Verify: tsc ≤9 (0 new); element appears in the browser; preview renders + plays; drag-to-place lands a grouped, hub-tethered subtree.
