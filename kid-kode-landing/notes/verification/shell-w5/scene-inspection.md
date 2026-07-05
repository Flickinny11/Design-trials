# SHELL W5 — Conductor render evidence (scene inspection + capture)

## What was driven

A fixture Build Brief (`Nova Atelier`, direction `atelier-noir` — machined-metal,
`#0b0b10` surface, `#ff2a38` accent) was run through the **real Conductor**
(`runConductor`) against a live tenancy store, producing a shareable E14 preview
URL served by the app at `/preview/[projectId]?t=<token>`. The preview route
mounts the Conductor-authored graph in the **Prism runtime** via
`mountFromGraphSource` (the same primitive `PrismHost` uses).

## Functional layer (Chrome DevTools MCP — definitive)

Live scene-graph inspection of the running `/preview` page (`window` handle on
the mounted `MountGraphResult`):

- **Renderer loop running:** `renderer.info.render.calls = 17522` (continuous).
- **58 meshes** mounted; **0 console errors** across the session (only Three.js
  TSL deprecation + a webpack `Critical dependency` warning — both pre-existing,
  unrelated to W5).
- **Camera** `PerspectiveCamera(fov 50)` at `(0,0,10)`, aspect `1.70` — the
  authored graph's default runtime camera.
- **Home-hub node projection** (world → screen, canvas 1320×775) — the app
  composes top-to-bottom like a hero section:
  - `home-headline` (renderMode `text`, textSpec `"Nova Atelier"`) → screen y≈138
  - `home-subhead` (text) → y≈234
  - `home-hero` (renderMode `mesh`, meshPrimitive cube, materialSpec baseColor
    `#ff2a38`, emissive `#ff2a38` @0.8) → centered
  - `home-cta` (mesh, accent slab) → lower
  - `home-cta-label` (text) → on the CTA
- **Direction conformance verified structurally:** all hubs ground on the board
  surface `#0b0b10`; the accent `#ff2a38` appears on the hero + CTA materialSpec;
  the `machined-metal` PBR (metalness 0.85) is expressed on the content panels;
  real MSDF text carries the palette fills.

## §11 verify latch (server, on the shipped graph)

```
behavioral: PASS — 26/26 nodes schema-complete | one PrismRootNode (SC-006)
                    | 3/3 edges resolve | 4 hubs · 26 nodes
visual:     PASS — all 4 hubs on surface #0b0b10 | accent #ff2a38 on 2 nodes
                    | machined-metal PBR on 15 panels (metalness 0.85)
                    | MSDF text nodes with palette fills
deploy:     PASS — preview reachable (prism-cloud), snapshot pinned
verifiedShippable: true (advocate pass gates final "done")
```

## Vision layer (screenshots) — WebGPU capture caveat

`preview-render.png` (Chrome DevTools MCP) shows the running app: the dark
`atelier-noir` ground, the **red accent hero** glowing at center, and MSDF text
— direction-conformant. `control-mockapp.png` is the reference mock-app in the
SAME runtime, captured cleanly, proving the runtime + capture pipeline are
healthy.

**Caveat (project-documented, `kid-kode-landing/CLAUDE.md`):** "Prism renders its
UI into a WebGPU canvas, so DOM/selector testing cannot *see* the built UI."
Single-frame WebGPU capture via the DOM MCP tools is a known blind spot — frames
race the WebGPU present, so a given screenshot may catch a partial/cleared frame
(a post-frame `ctx2d.drawImage(canvas)` reads all-zero — the backing buffer is
not preserved). The **scene-graph inspection above is the reliable functional
proof** that the built graph runs correctly in the Prism runtime; the vision
layer is corroborating, not the sole evidence, exactly as the project's
two-layer verification standard prescribes (KripVerify/Metal-GPU is the
canonical vision layer).

## Honest scope (W5-D2)

The v1 dry-run build authors nodes with **no baked diffusion assets** — real
MSDF text + tinted PBR primitives against the board's dark ground. It is a
correct, verified, direction-conformant runnable app, not a polished flagship;
image/3D asset generation is explicitly out of W5 scope. Follow-up: route the
Conductor preview through `PrismHost`'s full compiled-hub-view path (camera rail
+ background environment + lighting rig) and the asset-generation pipeline for
richer visuals.
