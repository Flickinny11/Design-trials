---
name: prism-architecture
description: Prism's 11 immutable architectural invariants. Load when implementing any node, atlas, graph, or runtime logic. Use when you catch yourself about to construct UI from primitives, draw text with PIXI.Text, or fake an element without an atlas image. This is the anti-drift reference.
---

# Prism Architectural Invariants (Canonical Reference)

You are building the mock app for Kriptik's Prism engine. These invariants are IMMUTABLE. Every implementation decision must preserve them. If your current approach violates one of these, STOP and rethink — do not paper over the violation.

## The 11 Invariants

1. **The graph IS the app.** The knowledge graph persists as the runtime representation. No compilation to a different format. The .prism file's graph.json is what the runtime loads and what the editor views.

2. **Nodes are self-contained.** Each node carries its own id, caption, intent, visual spec, behavior spec, code reference, and metadata. Any node can be regenerated independently.

3. **Contamination-aware repair.** Broken node code is DELETED before any repair model regenerates it. The repair model only sees the caption/spec, never the broken code.

4. **Contract-first parallel generation.** Frontend and backend nodes are generated against shared typed contracts (tRPC + Zod) produced during planning.

5. **Builds must never fail.** No circuit breakers. Never-fail retry cascade across providers.

6. **Text rendering is three-method tiered hybrid.**
   - `sharp-svg`: composited into the atlas image at BUILD time. 100% accuracy. Default for functional UI text.
   - `msdf`: runtime-rendered via BitmapText against an MSDF atlas. For DYNAMIC text only (counters, user names, backend data).
   - `diffusion`: text is baked into the FLUX/Ideogram image. For stylized decorative text.
   - NEVER use `PIXI.Text`. It is forbidden.

7. **Bipartite DAG.** Elements and hubs are two disjoint node types with many-to-many edges. Shared elements exist once canonically.

8. **Images ARE the elements; code is behavior.** Diffusion generates images; segmentation decomposes them into element nodes; code is attached per-node for behavior ONLY. Code does NOT construct UI. Every button, icon, card, container, nav link, background — every visible thing — is an atlas image. See mock spec section 1.4.

9. **Wavefront execution.** Pipeline stages overlap per-hub. (Relevant to the engine; the mock app loads everything at once.)

10. **Provider-agnostic inference.** Code generation never depends on a single provider.

11. **Intent is first-class and persistent.** NodeIntent (caption + behaviorSpec + interactions + apiCalls + triggersDownstream) persists at runtime alongside code. This is what the Self-Healing Runtime uses to detect divergence.

## Three Animation Methodologies (mock spec section 1.2.3)

All three coexist. Pick the right one per animation:

1. **i2v frame-based.** Pixels inside the image animate. Frame sequence cycled at runtime. For animated backgrounds, liquid effects, things a transform can't achieve. Each frame is its own atlas region.
2. **Code-based transforms.** GSAP on sprite position/scale/rotation/alpha/tint. For hover lift, press scale, entrance animations.
3. **Hybrid overlay layers (the heart of why Prism looks good).** Transparent image layers sized to match the element, above/below, animated via code. Glows, shadows, shimmers, ripples, state-change bloom — all method 3. Base image stays untouched.

## State Transitions (mock spec section 1.2.4)

Discrete states use LAYER SWAPPING. Each state is its own atlas image. Code swaps visibility. `toggle-off.png` + `toggle-on.png`. `button-default.png` + `button-hover.png` + `button-pressed.png`. Code does NOT draw state changes.

## Forbidden Patterns

If you're about to write any of these, STOP:
- `new PIXI.Graphics()` to represent a visible UI element (allowed only for invisible hit areas, masks, or dev overlays)
- `new PIXI.Text(...)` anywhere — text is sharp-svg-composited at build, diffusion-baked in the image, or msdf BitmapText at runtime
- CSS, HTML, or React primitives to render any visible chrome inside the PixiJS canvas
- Faking an element because its source image is missing — if the image is missing, add it to the provisioning manifest

## The "Every Visible Thing Is An Image" Test

Pick any pixel in the rendered mock app. Can you trace it back to:
- A fal.ai-generated atlas image, possibly with sharp-svg text composited on top? yes
- An MSDF BitmapText showing dynamic data from state/backend? yes
- An overlay layer image from the atlas? yes
- Any other source? no — STOP, this is a violation

Refresh this skill whenever you feel you're drifting toward "just draw a rectangle here" or "just use PIXI.Text for this label."
