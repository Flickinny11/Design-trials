
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
