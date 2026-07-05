# LOGAN INBOX — mid-run directives (the build agent reads this BEFORE each wave and obeys it)

Drop instructions here any time the run is going; the agent checks this file at every wave boundary.
Newest directives go at the TOP, under the line.

----------------------------------------------------------------------
## [2026-06-22] TRIPO FUNDED + model-selection refinement (NEWEST — obey)
- Tripo is now FUNDED (2500 credits). The Tripo path is live again.
- Do NOT use Tripo exclusively. For EACH 3D object, pick the BEST model for THAT object — Tripo
  (v3.1 / P1; PBR + part SEGMENTATION + rigging) OR Replicate (Hunyuan3D 3.0 Pro / TRELLIS 2) —
  whichever yields the cleanest photoreal mesh. ALWAYS use the most recent model versions available
  as of now; web-search the current version/slug before generating if unsure.
- FIX the case: earlier it bloated because TRELLIS got a SINGLE image (depth hallucination), so it
  fell back to procedural-turned geometry. Now that Tripo is funded, REGENERATE the case (and any
  other parts that would benefit) as a real photoreal GLB using MULTI-VIEW input (front/side/top)
  and/or Tripo image-to-3D + part SEGMENTATION to split into swappable case/dial/bezel/hands/crown/
  movement. The goal is generated photoreal GLB parts, not procedural geometry.

----------------------------------------------------------------------
## STANDING MANDATE (active — see ORRERY-PHASE1-ATELIER-PROMPT.md "MID-RUN MANDATE v2" for full text)
1. The prototype app is a FULL PHOTOREALISTIC 3D SCENE — most UI elements (headers, footers, nav, boxes,
   containers, sections + the watch) are GENERATED photoreal 3D objects, lit + animated via the primitives.
   Menus/fine text may be premium 3D-styled UI but NEVER flat. Nothing flat, ever. Tailwind-style = MUST-FIX.
2. GENERATE objects, don't hand-build them: best-per-object 3D (Tripo v3.1/P1 OR Replicate Hunyuan3D/TRELLIS,
   latest versions); textures/HDRIs via Replicate FLUX.2; motion via Replicate video.
3. OVER-USE design_references.md + REUSE this repo's verified primitives (volumetric nebula, transmission
   glass, Rapier physics, magnetic cursor/GSAP/Lenis, IBL PBR + Bloom). SMOKE Slider Revolution.
4. Keep ALL functionality (drag-assemble, swap, orbit/loupe, caseback/exploded, price, save).
----------------------------------------------------------------------
