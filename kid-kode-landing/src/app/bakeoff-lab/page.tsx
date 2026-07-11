'use client';

// W-BAKE Axis 2 — /bakeoff-lab: renders ONE contestant-generated node module
// in the REAL Prism runtime (ConductorRuntime mount path: mountFromGraphSource
// + getSharedNodeContext + registerCodeRef), honoring the frozen case's
// sceneSpec (camera / light rig / background). Lab-route idiom (w2d-demo /
// splat-lab): DOM chrome around the runtime canvas; no engine files touched.
//
// The generated module arrives as esbuild-CJS (prepare-axis2-bundles.mjs) and
// executes against the app's OWN bundled dependency instances via a require
// map — one `three` instance (INV-R1), the bundled tsl, the bundled gsap, the
// runtime's primitives API and text utilities. Disallowed requires throw (the
// dependency deny gate; the violation is also recorded at prepare time and
// judged as a MUST-FIX — render still captured, W-2D honesty gate: a black or
// broken frame is a scored artifact, never retouched).
//
// Probe: window.__BAKEOFF__ = { status, error, renderables, nodeMounted }.

import { useEffect, useRef, useState } from 'react';
import * as THREE_WEBGPU from 'three/webgpu';
import * as THREE_TSL from 'three/tsl';
import gsap from 'gsap';
import { getSharedNodeContext } from '@/lib/prism/runtime/shared-context';
import { mountFromGraphSource, type MountGraphResult } from '@/lib/prism/runtime/mount-graph';
import { registerCodeRef } from '@/lib/prism/runtime/factories/coderef-registry';
import * as textUtils from '@/lib/prism/runtime/shared/text';
import { webgl2MSDFTextFactory } from './webgl2-msdf-text';
import type { GraphSource, PrismHub, PrismNode } from '@/lib/prism-graph/types';

interface Bundle {
  id: string;
  contestant: string;
  caseId: string;
  run: string | number;
  node: PrismNode;
  sceneSpec: {
    camera: { position: [number, number, number]; lookAt: [number, number, number]; fov: number };
    lights: Array<{ type: string; color?: string; intensity?: number; position?: [number, number, number] }>;
    background: string;
  };
  cjs: string;
  depGate: { violations: string[] };
}

declare global {
  interface Window {
    __BAKEOFF__?: {
      status: 'loading' | 'ready' | 'error';
      error: string | null;
      renderables: number;
      nodeMounted: boolean;
      bundleId: string | null;
      /** Set when the contestant module THREW at createNode time (the frame
       *  then shows the standard coderef fallback plane). */
      moduleRuntimeError?: string;
    };
  }
}

function countRenderables(root: { traverse: (cb: (o: unknown) => void) => void }): number {
  let n = 0;
  root.traverse((o) => {
    const r = o as { isMesh?: boolean; isPoints?: boolean; isSprite?: boolean; isLine?: boolean; isInstancedMesh?: boolean };
    if (r.isMesh || r.isPoints || r.isSprite || r.isLine || r.isInstancedMesh) n += 1;
  });
  return n;
}

export default function BakeoffLabPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<MountGraphResult | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [detail, setDetail] = useState<string>('');

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    let cancelled = false;

    const probe: NonNullable<Window['__BAKEOFF__']> = {
      status: 'loading', error: null, renderables: 0, nodeMounted: false, bundleId: null,
    };
    window.__BAKEOFF__ = probe;

    (async () => {
      try {
        const bundleId = new URLSearchParams(window.location.search).get('bundle');
        if (!bundleId) throw new Error('missing ?bundle=');
        probe.bundleId = bundleId;
        const res = await fetch(`/api/bakeoff/bundle?id=${encodeURIComponent(bundleId)}`);
        if (!res.ok) throw new Error(`bundle fetch ${res.status}`);
        const bundle = (await res.json()) as Bundle;

        // Dependency map — the app's OWN instances (INV-R1: one three).
        const ctx = getSharedNodeContext({ runPrimitives: true });
        // MEASUREMENT-INTEGRITY FIX (2026-07-10): the shared atlas's default
        // factory only compiles on WebGPU and silently returns an invisible
        // placeholder Group on the WebGL2 capture backend — which blinded the
        // design judge to EVERY contestant's text (see webgl2-msdf-text.ts).
        // The lab builds its own atlas handle with a WebGL2-compatible TSL
        // median-MSDF factory (same BMFont atlas, same call contract) and
        // hands THAT to contestant modules. Lab-route only; no product-path
        // change.
        const labFontAtlas = textUtils.createFontAtlas({ msdfTextFactory: webgl2MSDFTextFactory });
        try {
          await labFontAtlas.load(
            '/prism-assets/font-inter.msdf.png',
            '/prism-assets/font-inter.msdf.json',
          );
        } catch { /* best-effort */ }

        // gsap interop shim (W-BAKE-B, lab-only — disclosed): the app's ESM
        // default `import gsap from 'gsap'` (line 22) lacks the `.gsap` /
        // `.default` self-references the npm CJS entry carries, so a bundled
        // module's NAMED `import { gsap } from 'gsap'` compiles to
        // `require('gsap').gsap` === undefined and crashes at the first
        // `gsap.timeline()` — a harness-interop artifact (W-PCP §9.3), NOT a
        // model error, that otherwise confounds the design axis (gsap animates
        // nearly every node). Add the self-references so BOTH import forms
        // resolve to the real gsap object. Idempotent; no effect if already set.
        const gsapDep = gsap as unknown as Record<string, unknown>;
        try {
          if (!gsapDep.gsap) gsapDep.gsap = gsap;
          if (!gsapDep.default) gsapDep.default = gsap;
        } catch { /* frozen — fall back to bare (default-form only) */ }
        const DEPS: Record<string, unknown> = {
          'three/webgpu': THREE_WEBGPU,
          'three/tsl': THREE_TSL,
          // 'three' is NOT an allowed source (dep gate records the violation),
          // but the render is still judged — serve the same single instance.
          three: THREE_WEBGPU,
          gsap: gsapDep,
          '@/primitives': ctx.primitives,
          // '@/text' is promised by L1 as "MSDF text utilities" but no such
          // module exists in the product — the harness implements the alias
          // as the shared text module PLUS a `createText` binding delegating
          // to the live fontAtlas (the one real MSDF text entry point).
          // Hallucinated names (createTextMesh etc.) still fail honestly.
          '@/text': { ...textUtils, createText: (content: string, opts?: unknown) => labFontAtlas.createText(content, opts as never) },
        };
        const requireShim = (spec: string) => {
          if (spec in DEPS) return DEPS[spec];
          throw new Error(`DEP_DENIED: ${spec}`);
        };

        // Execute the CJS module.
        const moduleObj: { exports: Record<string, unknown> } = { exports: {} };
        const fn = new Function('require', 'module', 'exports', bundle.cjs);
        fn(requireShim, moduleObj, moduleObj.exports);
        const factory = (moduleObj.exports as { default?: unknown }).default;
        if (typeof factory !== 'function') throw new Error('module did not default-export a function');

        const codeRefKey = `bakeoff:${bundle.id}`;
        // Wrap the contestant factory so a RUNTIME crash is RECORDED on the
        // probe before the standard coderef fallback grafts the default
        // plane — otherwise a crashing module silently renders as a white
        // placeholder and the failure is mis-attributed to composition.
        type FactoryFn = Parameters<typeof registerCodeRef>[1];
        const recordingFactory: FactoryFn = (n, c) => {
          try {
            // Contestant ctx rides the runtime's own context, with only the
            // fontAtlas swapped for the WebGL2-visible lab atlas (above).
            return (factory as FactoryFn)(n, { ...c, fontAtlas: labFontAtlas });
          } catch (err) {
            probe.moduleRuntimeError = err instanceof Error ? `${err.name}: ${err.message}`.slice(0, 300) : String(err).slice(0, 300);
            throw err;
          }
        };
        registerCodeRef(codeRefKey, recordingFactory);

        const hub: PrismHub = {
          hubId: 'hub-visual-stage',
          title: 'Bakeoff visual stage',
          caption: 'W-BAKE Axis 2 render stage',
          layout: {
            viewportWidth: 1280,
            viewportHeight: 720,
            contentHeight: 720,
            backgroundColor: bundle.sceneSpec.background ?? '#0b0b10',
          },
        } as unknown as PrismHub;

        const node: PrismNode = { ...bundle.node, codeRef: codeRefKey, parentHubId: 'hub-visual-stage' };
        const graph: GraphSource = { hubs: [hub], nodes: [node], edges: [] };

        const rect = container.getBoundingClientRect();
        const result = await mountFromGraphSource(canvas, graph, ctx, {
          width: rect.width > 0 ? rect.width : 1280,
          height: rect.height > 0 ? rect.height : 720,
          entryHubId: 'hub-visual-stage',
        });
        if (cancelled) { result.unmount(); return; }
        resultRef.current = result;

        // Apply the frozen case's sceneSpec: camera + authored light rig
        // (identical for every contestant of this case).
        const cam = result.sceneRoot.camera;
        const cs = bundle.sceneSpec.camera;
        if (cs) {
          cam.position.set(cs.position[0], cs.position[1], cs.position[2]);
          cam.fov = cs.fov;
          cam.updateProjectionMatrix();
          cam.lookAt(cs.lookAt[0], cs.lookAt[1], cs.lookAt[2]);
        }
        const scene = result.sceneRoot.scene;
        for (const l of bundle.sceneSpec.lights ?? []) {
          const color = new THREE_WEBGPU.Color(l.color ?? '#ffffff');
          const intensity = l.intensity ?? 1;
          let light: InstanceType<typeof THREE_WEBGPU.Object3D> | null = null;
          if (l.type === 'ambient') light = new THREE_WEBGPU.AmbientLight(color, intensity);
          else if (l.type === 'directional') light = new THREE_WEBGPU.DirectionalLight(color, intensity);
          else if (l.type === 'point') light = new THREE_WEBGPU.PointLight(color, intensity);
          else if (l.type === 'spot') light = new THREE_WEBGPU.SpotLight(color, intensity);
          if (!light) continue;
          if (l.position) light.position.set(l.position[0], l.position[1], l.position[2]);
          light.userData.prismRuntimeHost = 'bakeoff-scene-spec-light';
          scene.add(light);
        }
        try { scene.background = new THREE_WEBGPU.Color(bundle.sceneSpec.background ?? '#0b0b10'); } catch { /* keep */ }

        // codeRef grafting is async — poll until the node group has content
        // (or accept an honest empty mount after the deadline).
        const t0 = Date.now();
        const poll = () => {
          if (cancelled) return;
          const mounted = result.adapterResult.nodes.get(node.nodeId) ?? null;
          const group = (mounted ?? null) as { children?: unknown[]; traverse?: (cb: (o: unknown) => void) => void } | null;
          const grafted = Boolean(group?.children && group.children.length > 0);
          if (group?.traverse) probe.renderables = countRenderables(group as { traverse: (cb: (o: unknown) => void) => void });
          probe.nodeMounted = grafted;
          if (grafted || Date.now() - t0 > 8000) {
            probe.status = 'ready';
            setStatus('ready');
            setDetail(`${bundle.id} — renderables: ${probe.renderables}`);
            return;
          }
          setTimeout(poll, 150);
        };
        poll();
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        probe.status = 'error';
        probe.error = msg;
        setStatus('error');
        setDetail(msg);
      }
    })();

    return () => {
      cancelled = true;
      delete window.__BAKEOFF__;
      try { resultRef.current?.unmount(); } catch { /* ignore */ }
      resultRef.current = null;
    };
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'fixed', inset: 0, background: '#0b0b10' }}>
      <canvas ref={canvasRef} data-bakeoff-canvas style={{ width: '100%', height: '100%', display: 'block' }} />
      <div data-bakeoff-status style={{ position: 'absolute', left: 8, bottom: 8, font: '11px monospace', color: '#556', pointerEvents: 'none' }}>
        bakeoff-lab {status} {detail}
      </div>
    </div>
  );
}
