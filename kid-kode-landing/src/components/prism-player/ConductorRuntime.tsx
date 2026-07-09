"use client";

// PRISM SHELL — CONDUCTOR RUNTIME HOST (SHELL W5, 2026-07-04)
//
// Mounts a Conductor-authored GraphSource in the Prism runtime — the SAME
// three/webgpu scene + synchronous createNode contract PrismHost uses, via the
// `mountFromGraphSource` primitive. This is how "the built graph runs in the
// Prism runtime" (W5 gate) is proven both in the builder preview (the authored
// tenant app) and on the shareable E14 preview URL.
//
// I0 (Prime Boundary): this is a DOM host wrapping a WebGPU canvas interior —
// no shell chrome leaks inside, no engine-interior file at `/` is touched
// (W5-D3). It renders EITHER here OR the certified engine-frame, never both at
// once, so there is one visible scene (FP-R1/FP-R6).

import { useEffect, useMemo, useRef, useState } from "react";
import { Vector3 } from "three";
import {
  getSharedNodeContext,
  getSharedDriverHub,
} from "@/lib/prism/runtime/shared-context";
import {
  mountFromGraphSource,
  type MountGraphResult,
} from "@/lib/prism/runtime/mount-graph";
import {
  mountProceduralBackground,
  type ProceduralBackgroundHandle,
} from "@/lib/prism/runtime/shared/procedural-background";
import { makeNodeDrivers } from "@/lib/prism/runtime/shared/driver-dispatch";
import { viewportFromNdc } from "@/lib/prism/runtime/shared/inview";
import { resolveTextOutlines } from "@/lib/prism/runtime/shared/text-atlas";
import { attachAnimationBindings } from "@/lib/prism/animatable/bindings";
import CustomCursorLayer from "@/components/shell/fx/CustomCursorLayer";
import type { CursorLayerConfig, GraphSource } from "@/lib/prism-graph/types";

// W8 E8/E9 — the shipped preview route is NOT the editor's GraphScene, so nothing
// feeds the shared DriverHub here. Without this feed, scroll/pointer/inview-driven
// animations sit static in the shared preview. This wires real input (pointer,
// wheel→scroll, per-frame tick, per-node in-view projection) into the same hub the
// built scene reads — so the shipped app is as reactive as the canvas preview.
// Uses its own rAF (never touches sceneRoot.setBeforeRender — that's the camera
// rail's slot). DOM-host scope (prism-player), same as useScrollTimeline.
const SCROLL_WHEEL_RANGE = 1400;

function startDriverFeed(
  el: HTMLElement,
  result: MountGraphResult,
  graph: GraphSource,
): () => void {
  const hub = getSharedDriverHub();
  const camera = result.sceneRoot.camera;
  const nodes = result.adapterResult.nodes;
  let scrollProgress = 0;
  const probe = new Vector3();

  // W8 — play each node's animationBindings (E8/E9 drivers) in the shipped app,
  // exactly the way the canvas does (attachAnimationBindings). Without this the
  // shared preview would render but sit static. Mounted-artifact target = the
  // Object3D the adapter registered for that node.
  const bindingDetachers: Array<() => void> = [];
  const drivers = makeNodeDrivers(hub);
  for (const node of graph.nodes) {
    if (!node.animationBindings || node.animationBindings.length === 0)
      continue;
    const root = nodes.get(node.nodeId);
    if (!root) continue;
    try {
      bindingDetachers.push(attachAnimationBindings({ node, root, drivers }));
    } catch {
      /* one bad binding set must not break the mount */
    }
  }

  const onPointerMove = (e: PointerEvent) => {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    hub.pointer.set({ x, y }, true);
  };
  const onPointerLeave = () => hub.pointer.set(hub.pointer.ndc, false);
  const onWheel = (e: WheelEvent) => {
    const next = scrollProgress + e.deltaY / SCROLL_WHEEL_RANGE;
    scrollProgress = next < 0 ? 0 : next > 1 ? 1 : next;
    hub.scroll.set(scrollProgress);
    result.setScrollProgress(scrollProgress);
  };
  el.addEventListener("pointermove", onPointerMove, { passive: true });
  el.addEventListener("pointerleave", onPointerLeave);
  el.addEventListener("wheel", onWheel, { passive: true });

  // Verification handle for the shipped preview (mirrors the editor's
  // __prismDrivers): lets a verifier prove reactivity — scroll, pointer,
  // in-view, and frame-tick count — without reaching into the scene graph.
  (
    window as unknown as { __prismPreviewDrivers?: unknown }
  ).__prismPreviewDrivers = {
    hub,
    ticks: 0,
    setScroll: (p: number) => {
      hub.scroll.set(p);
      result.setScrollProgress(p);
    },
    setPointer: (x: number, y: number) => hub.pointer.set({ x, y }, true),
    scroll: () => hub.scroll.progress,
    frameSize: () => hub.frame.size(),
    inview: (id: string) => ({ ...hub.inview.get(id) }),
  };

  let raf = 0;
  let last = performance.now();
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const dt = now - last;
    last = now;
    const dh = (
      window as unknown as { __prismPreviewDrivers?: { ticks: number } }
    ).__prismPreviewDrivers;
    if (dh) dh.ticks += 1;
    hub.frame.tick(dt);
    nodes.forEach((obj, nodeId) => {
      obj.updateWorldMatrix(true, false);
      obj.getWorldPosition(probe);
      probe.project(camera);
      hub.inview.set(
        nodeId,
        viewportFromNdc({ x: probe.x, y: probe.y, z: probe.z }),
      );
    });
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    el.removeEventListener("pointermove", onPointerMove);
    el.removeEventListener("pointerleave", onPointerLeave);
    el.removeEventListener("wheel", onWheel);
    for (const d of bindingDetachers) {
      try {
        d();
      } catch {
        /* ignore */
      }
    }
  };
}

/** Warm the extruded-text outline cache for every renderMode:'text' node so the
 *  factory's 3D-text path resolves synchronously (no flat-MSDF fallback). Groups
 *  the requested chars per (family, weight) and awaits all resolves. */
async function warmTemplateOutlines(graph: GraphSource): Promise<void> {
  const byKey = new Map<
    string,
    { family: string; weight: number; chars: Set<string> }
  >();
  for (const node of graph.nodes) {
    if (node.renderMode !== "text") continue;
    const content = node.textSpec?.content;
    if (typeof content !== "string" || content.length === 0) continue;
    const family = node.textSpec?.fontFamily ?? "Playfair Display";
    const weight = node.textSpec?.fontWeight ?? 600;
    const key = `${family}|${weight}`;
    let e = byKey.get(key);
    if (!e) {
      e = { family, weight, chars: new Set() };
      byKey.set(key, e);
    }
    for (const ch of content) e.chars.add(ch);
  }
  await Promise.all(
    [...byKey.values()].map((e) =>
      resolveTextOutlines(e.family, e.weight, [...e.chars].join("")),
    ),
  );
}

/** The cursor layer for the shipped app = the FIRST hub that declares one
 *  (landing hub). Templates are effectively single-hub; multi-hub apps get the
 *  landing hub's cursor. */
function resolveCursor(graph: GraphSource): CursorLayerConfig | null {
  for (const hub of graph.hubs) if (hub.cursor) return hub.cursor;
  return null;
}

export default function ConductorRuntime({ graph }: { graph: GraphSource }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    let result: MountGraphResult | null = null;
    let cancelled = false;
    let feedTeardown: (() => void) | null = null;
    let bgHandle: ProceduralBackgroundHandle | null = null;
    let bgRaf = 0;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) result?.resize(width, height);
    });
    observer.observe(container);

    (async () => {
      try {
        const rect = container.getBoundingClientRect();
        const ctx = getSharedNodeContext({ runPrimitives: true });
        try {
          await ctx.fontAtlas.load(
            "/prism-assets/font-inter.msdf.png",
            "/prism-assets/font-inter.msdf.json",
          );
        } catch {
          // Atlas warm is best-effort; text nodes soft-fail like a missing asset.
        }
        // W8 — PRE-WARM extruded-text OUTLINES for every text node before mount.
        // The factory's 3D-text path resolves outlines async and, on a cold
        // cache, falls back to the flat MSDF atlas which does not bind reliably
        // in this host (garbled glyphs). Warming the (family,weight) outline set
        // here makes the extrude path resolve synchronously → clean 3D text.
        try {
          await warmTemplateOutlines(graph);
        } catch {
          /* best-effort */
        }
        if (cancelled) return;
        // DEV-WUXV-1: the runtime player renders on the WebGL2 backend by
        // default (WebGPU backend red-dithers in current Chromium);
        // `?webgpu=1` opts back into the WebGPU backend.
        const wantWebGPU =
          typeof window !== 'undefined' &&
          new URLSearchParams(window.location.search).get('webgpu') === '1';
        result = await mountFromGraphSource(canvas, graph, ctx, {
          width: rect.width > 0 ? rect.width : 1280,
          height: rect.height > 0 ? rect.height : 720,
          forceWebGL: !wantWebGPU,
        });
        if (cancelled) {
          result.unmount();
          return;
        }
        // W8 — wire real driver input now that the scene + node map exist.
        try {
          feedTeardown = startDriverFeed(container, result, graph);
        } catch {
          /* input feed is best-effort; a static preview still renders */
        }
        // W-BG — mount the landing hub's procedural background in the SHIPPED
        // runtime (same law as resolveCursor: the first hub that declares
        // one). Renders through the shared render-core so it matches the
        // editor pixel-for-pixel; splat layers stay editor-only. Best-effort:
        // a background failure never blocks the app mount.
        try {
          const bgHub = graph.hubs.find((h) =>
            (h.background ?? []).some((l) => !!l.kind && l.kind !== "splat"),
          );
          if (bgHub?.background && result) {
            bgHandle = mountProceduralBackground(
              result.sceneRoot.scene,
              result.sceneRoot.camera,
              bgHub.background,
            );
            (
              window as unknown as { __PRISM_RUNTIME_BG__?: unknown }
            ).__PRISM_RUNTIME_BG__ = {
              hubId: bgHub.hubId,
              layerCount: bgHandle.layerCount,
              kinds: bgHandle.kinds,
            };
            let bgLast = performance.now();
            const bgLoop = (now: number) => {
              bgRaf = requestAnimationFrame(bgLoop);
              bgHandle?.tick((now - bgLast) / 1000);
              bgLast = now;
            };
            bgRaf = requestAnimationFrame(bgLoop);
          }
        } catch {
          /* background is best-effort; the app still renders */
        }
        setStatus("ready");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "runtime mount failed");
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      observer.disconnect();
      try {
        feedTeardown?.();
      } catch {
        /* ignore */
      }
      cancelAnimationFrame(bgRaf);
      try {
        bgHandle?.dispose();
      } catch {
        /* ignore */
      }
      try {
        result?.unmount();
      } catch {
        /* ignore */
      }
    };
  }, [graph]);

  const cursor = useMemo(() => resolveCursor(graph), [graph]);

  return (
    <div ref={containerRef} className="cr-runtime" data-status={status}>
      <canvas ref={canvasRef} className="cr-canvas" />
      {status === "ready" && cursor ? (
        <CustomCursorLayer config={cursor} />
      ) : null}
      {status === "loading" ? (
        <div className="cr-overlay" role="status">
          <span className="cr-bead" aria-hidden />
          Booting the Prism runtime…
        </div>
      ) : null}
      {status === "error" ? (
        <div className="cr-overlay cr-overlay--error" role="alert">
          Preview could not render{error ? `: ${error}` : ""}.
        </div>
      ) : null}
    </div>
  );
}
