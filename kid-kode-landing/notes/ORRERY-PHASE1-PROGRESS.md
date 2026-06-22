
## Wave 1+2 — assets + materials + orbit/loupe (auto-ckpt)
- Assets (FLUX.2-pro black-forest-labs/flux-2-pro): studio-hdri.png (2048x1024 equirect studio), guilloche/sunburst/brushed/leather grayscale height maps -> sharp-derived normal+roughness PBR maps in meshes/atelier/textures/.
- A3: scene.environment = studio HDRI for s6-atelier (real specular); MaterialSpec.roughnessMapUrl added; factory + live handle (setNormalMap/setRoughnessMap) + applier wire normal+roughness; guilloche/sunburst/titanium/brushed/leather variants carry maps. Default dial = silver sunburst.
- A4: SceneControlsBridge exempts s6-atelier from the preview-app camera lock — head-on framing, rotation clamped, dolly(loupe) bounded 3..11. AtelierWatchRig reparents the 33 watch parts under a pivot and turntables them (drag azimuth + tilt + idle + momentum); window.__ATELIER_RIG__ probe.
- Watch geometry upgraded: 12 hour markers, 4 lugs (case finish), chapter ring, articulated tapered strap (8 segs) replacing the 2 planks. enhance-watch.mjs.
- A7: live price verified CHF 38,000 -> 60,000 on guilloche. tsc 0-new; 0 console errors; transmission 2/2.
