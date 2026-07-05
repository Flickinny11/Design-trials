// Hand-authored codeRef module for the home-cta-hero node.
// Spec contract: PRISM-RUNTIME-SPEC.md §9 (INV-R9) — createNode(config, ctx)
// returns THREE.Object3D synchronously, with userData.cleanup + userData.handlers.
// All async loading happens via cached ctx loaders (textureLoader, glbLoader,
// fontAtlas). Cinematic primitives are applied via
// ctx.primitives[name](target, params).
//
// THREE classes come from `ctx.THREE` — the single bundled `three` instance
// (RT-SC-02 / INV-R1). This module is loaded via a native `import(url)`, so a
// bare `import … from 'three'`/`'three/webgpu'` here would resolve through the
// browser import-map to a SECOND `three` from a CDN — the multiple-instances
// crash. Reading from ctx.THREE keeps everything on the one bundled instance.
//
// Behavior: loads the smartwatch GLB at meshUrl, applies scenePosition,
// adds an MSDF text label below the mesh, runs depth-rotate (idle slow Y
// rotation), runs kinetic-text wave on label entrance. Click anywhere on
// the mesh emits 'cta-clicked' via ctx.emit.

export default function createNode(config, ctx) {
  const { Box3, Group, Vector3 } = ctx.THREE;
  const root = new Group();
  root.name = `node:${config.nodeId}`;

  const cleanups = [];
  let cleaned = false;

  // Apply scenePosition. The runtime adapter normally does this for
  // default-factory output, but codeRef modules own their full transform.
  const sp = config.scenePosition;
  if (sp) {
    root.position.set(sp.x ?? 0, sp.y ?? 0, sp.z ?? 0);
    root.rotation.set(sp.rotationX ?? 0, sp.rotationY ?? 0, sp.rotationZ ?? 0);
    root.scale.set(sp.scaleX ?? 1, sp.scaleY ?? 1, sp.scaleZ ?? 1);
  }

  // Mount the mesh asynchronously inside the cached glbLoader. The
  // `loadGLB` Promise is URL-keyed and memoized; if the editor mounts
  // this node in both panes, the GLB is parsed once.
  let meshObj = null;
  if (config.meshUrl && ctx.glbLoader?.loadGLB) {
    ctx.glbLoader.loadGLB(config.meshUrl).then((gltf) => {
      if (cleaned) return;
      const scene = gltf?.scene ?? gltf?.scenes?.[0];
      if (!scene) return;
      meshObj = scene;
      // Center the loaded mesh — Trellis tends to emit meshes off-origin.
      meshObj.position.set(0, 0, 0);
      // Scale to fit the visual.transform width if obviously oversized.
      const bbox = new Box3().setFromObject(meshObj);
      const size = new Vector3();
      bbox.getSize(size);
      const targetW = config.visual?.transform?.width ?? 1.5;
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        const s = targetW / maxDim;
        meshObj.scale.setScalar(s);
      }
      root.add(meshObj);

      // Apply depth-rotate primitive once the mesh is in the tree.
      if (ctx.primitives?.['depth-rotate']) {
        const r = ctx.primitives['depth-rotate'](meshObj, {
          axis: 'y',
          period: 12,
          intensity: 0.6,
          easing: 'sine.inOut',
        });
        if (r?.cleanup) cleanups.push(r.cleanup);
      }
    }).catch((err) => {
      console.warn('[cta-hero] glbLoader.loadGLB failed:', err);
    });
  }

  // MSDF label below the mesh. fontAtlas may not be ready yet; the
  // factory returns a placeholder Group that swaps to the real text
  // mesh once loaded.
  const textContent = config.intent?.visualSpec?.textContent?.[0];
  if (textContent && ctx.fontAtlas?.createText) {
    try {
      const label = ctx.fontAtlas.createText(textContent.text, {
        fontSize: textContent.typography?.fontSize ?? 28,
        color: textContent.typography?.color ?? '#9bd4ff',
        align: 'center',
      });
      label.position.set(0, -1.0, 0.05);
      root.add(label);
      // Apply kinetic-text wave on entrance.
      if (ctx.primitives?.['kinetic-text']) {
        const r = ctx.primitives['kinetic-text'](label, {
          stagger: 0.04,
          duration: 0.6,
          effect: 'wave',
          easing: 'power2.out',
          mode: 'chars',
        });
        if (r?.cleanup) cleanups.push(r.cleanup);
      }
    } catch (err) {
      // Font atlas not warmed yet; swallow — placeholder Group from
      // createText acts as fallback per text.ts:128-143 contract.
      console.warn('[cta-hero] createText failed (likely atlas unwarmed):', err.message);
    }
  }

  // userData.handlers.onClick — runtime adapter or hub manager wires DOM
  // pointer events to this. emits 'cta-clicked' for downstream listeners.
  root.userData = root.userData ?? {};
  root.userData.handlers = {
    onClick: () => {
      if (ctx.emit) ctx.emit('cta-clicked', { nodeId: config.nodeId });
    },
    onPointerOver: () => {
      // Future: subtle hover affordance via material emissive ramp.
    },
  };

  // userData.cleanup — walked by HubManager.disposeHubGroup on hub
  // deactivation. MUST dispose all owned resources + kill any active
  // animations.
  root.userData.cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    for (const fn of cleanups) {
      try { fn(); } catch (err) { console.warn('[cta-hero] cleanup', err); }
    }
    cleanups.length = 0;
    if (meshObj) {
      // Dispose mesh geometries + materials. Textures are owned by the
      // loader cache (URL-keyed memoization) — don't dispose them here.
      meshObj.traverse((o) => {
        if (o.geometry?.dispose) o.geometry.dispose();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
        else if (o.material?.dispose) o.material.dispose();
      });
    }
  };

  return root;
}
