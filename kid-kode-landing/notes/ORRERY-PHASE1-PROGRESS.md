
## Wave 1+2 — assets + materials + orbit/loupe (auto-ckpt)
- Assets (FLUX.2-pro black-forest-labs/flux-2-pro): studio-hdri.png (2048x1024 equirect studio), guilloche/sunburst/brushed/leather grayscale height maps -> sharp-derived normal+roughness PBR maps in meshes/atelier/textures/.
- A3: scene.environment = studio HDRI for s6-atelier (real specular); MaterialSpec.roughnessMapUrl added; factory + live handle (setNormalMap/setRoughnessMap) + applier wire normal+roughness; guilloche/sunburst/titanium/brushed/leather variants carry maps. Default dial = silver sunburst.
- A4: SceneControlsBridge exempts s6-atelier from the preview-app camera lock — head-on framing, rotation clamped, dolly(loupe) bounded 3..11. AtelierWatchRig reparents the 33 watch parts under a pivot and turntables them (drag azimuth + tilt + idle + momentum); window.__ATELIER_RIG__ probe.
- Watch geometry upgraded: 12 hour markers, 4 lugs (case finish), chapter ring, articulated tapered strap (8 segs) replacing the 2 planks. enhance-watch.mjs.
- A7: live price verified CHF 38,000 -> 60,000 on guilloche. tsc 0-new; 0 console errors; transmission 2/2.

## Wave A (v2) — photoreal watch hero (mandate-v2 rebuild)
- Removed 33 procedural meshPrimitive watch nodes (the rejected edge-on disc); rebuilt AtelierWatchRig.tsx as a declarative photoreal watch reading useConfiguratorStore.
- Generated assets: case-concept.png+case-hero.glb (FLUX.2→TRELLIS; GLB bloated→kept on disk for Tripo-segmentation upgrade), dial-tex-orrery.png (FLUX.2 orrery complication art — the SC-V-O3 signature dial + hero).
- Watch = precision-turned Lathe steel case (generated brushed/polished steel PBR maps + studio HDRI) + 12/6 lugs + fluted crown + bezel + generated orrery dial + applied gold indices + sweeping hands + sapphire transmission crystal + (hidden) tourbillon caseback.
- config.ts: added 'orrery' dial variant (default) baseColorMapUrl=dial-tex-orrery.png.
- Evidence: wA-05 head-on, wA-06 orbit (A3 specular sweep), wA-07 loupe (A4 macro legible), wA-08 final. tsc 0-new(9); 0 console err; transmission 2/2.

## Wave B (v2) — part swaps wired to new watch
- The declarative watch reads useConfiguratorStore directly; every layer's material derives via config.ts variant specs (useMemo per layer) → swaps reflect in real time without the graph-node applier.
- Verified live: case-metal steel/rose-gold/titanium (+bezel gold), dial orrery/guilloche/aventurine (texture-based finishes load: dial-tex-*.png), hands rhodium/blued, lume blue (emissive overlay).
- Re-added articulated STRAP: CatmullRom-curved tapered band (9 segs/side) from the 12/6 lugs, leather/alligator/rubber/bracelet finish (strap variant).
- Price + summary live + correct (CHF 87,200 rose-gold/gold/guilloche/blued; CHF 80,000 titanium/aventurine/alligator/lume — every priceDelta incl strap accounted).
- Evidence: wB-01 (rose-gold+guilloche), wB-02 (default+strap), wB-04 (aventurine head-on). 0 console err; tsc 0-new(9).

## Wave C (v2) — inspect system (A5 caseback-flip + A6 exploded view)
- A5: rig.flip() spins watch 180° to the exhibition caseback; tourbillon.glb movement becomes visible (rotation samples confirm IN MOTION). Opened the lathe caseback aperture (ring not closed disc) so the movement shows; movement enlarged to fill the back.
- A6: rig.explode() eases (dt*5 lerp) the major components apart along the case axis — crystal lifts furthest, dial-face forward, case anchored, movement recedes, strap drops + hides near full-explode; reassembles on explode(false). Evidence: wC-02 (angled explode) shows dial/case/movement clearly separated.
- Fixed cold-load price placeholder: AtelierApplier re-applies at 180/600/1200/2500/4000ms so "CHF 80,000" (orrery default) lands once the late-mounting text nodes exist (was lingering on graph-authored "CHF 38,000").
- Evidence: wC-01 explode head-on, wC-02 explode angle, wC-03 caseback movement. tsc 0-new(9); 0 console err; tx 2/2.

## Wave D (v2) — drag-assemble (A1) + dimensional chrome (A8)
- A1: AtelierDragController repointed at the new watch — overWatch() raycasts window.__ATELIER_RIG__.pivot (the watch was no longer orr-atelier-watch-* nodes); WATCH_CENTER = PIVOT_CENTER. Verified: simulated drag of the rose-gold case chip onto the watch applied case=rose-gold.
- A8 chrome: (1) 45 swatch chips re-materialed to real per-layer PBR (metals metalness1/rough0.2; dial gloss+clearcoat; strap matte leather; lume emissive) → a premium material tray, not flat squares; (2) price panel plane→box (depth 0.16), premium dark plaque, shifted +0.55 off the watch + softened (no spotlight hot-reflection); (3) milled CASEBACK + EXPLODE control buttons added + wired (runAtelierAction flip/explode → rig); (4) SAVE/RESET rebuilt clean — root-caused the white "brush smear" to polished-metal specular blooming under the spotlight; brushed-matte finish (metalness0.55/rough0.62/no-clearcoat) eliminates it.
- A7 SAVE verified end-to-end: SAVE button click → runAtelierAction('save') → localStorage 'orrery-no7-build' persisted + clipboard + reason.
- Evidence: wD-04/wD-05 (clean chrome), drag + save eval traces. tsc 0-new(9); 0 console err; tx 2/2.

## RUN COMPLETE
All 8 SC-V-A PASS with cited evidence; tsc green; art-fidelity 11/11; prism-criteria-reviewer PASS; user-advocate PLEASED/PASS; prod build EXIT=0; 0 console err; no regression (5 other hubs render). Marker written to notes/ORRERY-PHASE1-REPORT.md.
