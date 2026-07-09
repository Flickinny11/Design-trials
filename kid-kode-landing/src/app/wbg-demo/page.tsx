"use client";

// W-BG — runtime-proof lab route (verification only, the /w2d-demo idiom).
//
// Mounts the REAL ConductorRuntime (the exact component behind the E14
// /preview route) on a populated template graph whose landing hub carries a
// background: `?preset=<catalog-id>` applies any catalog entry;
// `?stack=generated` fetches the caller's NEWEST prompt-to-background item
// from the library API and applies ITS layers — the direct proof that a
// generated background runs in the prism runtime (DEV-1). The runtime's
// `window.__PRISM_RUNTIME_BG__` handle reports what mounted.

import "./wbg-demo.css";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ConductorRuntime from "@/components/prism-player/ConductorRuntime";
import { scrollHeroGraph } from "@/lib/templates/graphs/scroll-hero";
import { applyBackgroundPreset } from "@/lib/editor/backgrounds/presets";
import type {
  GraphSource,
  PrismHubBackgroundLayer,
} from "@/lib/prism-graph/types";

function WbgDemoInner() {
  const sp = useSearchParams();
  const presetId = sp.get("preset") || "polar-ridge";
  const useGenerated = sp.get("stack") === "generated";

  const [generatedLayers, setGeneratedLayers] = useState<
    PrismHubBackgroundLayer[] | null
  >(null);
  useEffect(() => {
    if (!useGenerated) return;
    let alive = true;
    fetch("/api/prism/background-generate")
      .then((r) => r.json())
      .then((d) => {
        if (alive && d?.ok && Array.isArray(d.items) && d.items[0]?.layers) {
          setGeneratedLayers(d.items[0].layers as PrismHubBackgroundLayer[]);
        }
      })
      .catch(() => {
        /* falls back to the preset */
      });
    return () => {
      alive = false;
    };
  }, [useGenerated]);

  const graph = useMemo<GraphSource>(() => {
    const g = structuredClone(scrollHeroGraph) as GraphSource;
    const layers =
      useGenerated && generatedLayers
        ? generatedLayers
        : applyBackgroundPreset(presetId);
    if (g.hubs[0]) g.hubs[0] = { ...g.hubs[0], background: layers };
    return g;
  }, [presetId, useGenerated, generatedLayers]);

  // In generated mode, wait for the library fetch before mounting so the
  // runtime mounts the generated stack (not a flash of the fallback preset).
  if (useGenerated && !generatedLayers) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#04050a",
          color: "#a5a8ab",
          font: "12px monospace",
          display: "grid",
          placeItems: "center",
        }}
      >
        wbg-demo · loading newest generated background…
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#04050a" }}>
      <ConductorRuntime graph={graph} />
      <div
        style={{
          position: "absolute",
          left: 12,
          top: 10,
          font: "11px monospace",
          color: "#a5a8ab",
          pointerEvents: "none",
        }}
      >
        wbg-demo · runtime player ·{" "}
        {useGenerated ? "newest generated stack" : presetId}
      </div>
    </div>
  );
}

export default function WbgDemoPage() {
  return (
    <Suspense
      fallback={
        <div style={{ position: "fixed", inset: 0, background: "#04050a" }} />
      }
    >
      <WbgDemoInner />
    </Suspense>
  );
}
