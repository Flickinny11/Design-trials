"use client";

// /splat-lab — the REVIEWABLE route for the R4 gaussian-splat viewer (W-PHOTO
// D5). An OWNED WebGL canvas running Spark (WebGL2) — a second renderer, never
// the single-WebGPU editor scene (INV-1 / DEV-3). Renders a procedural gaussian
// volume by default; ?url=<.spz/.ply> loads a real capture through the same
// SplatMesh loader (the asset slot; capture generation is a later wave).
//
//   ?url=/prism-mock/splat/<file>   load a real capture
//   ?orbit=0                        disable auto-orbit

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SplatViewer } from "@/components/photo/SplatViewer";
import "./splat-lab.css";

function SplatLabStage() {
  const sp = useSearchParams();
  const url = sp.get("url");
  const autoOrbit = sp.get("orbit") !== "0";
  return (
    <div className="splat-lab-root" data-testid="splat-stage">
      <SplatViewer splatUrl={url} autoOrbit={autoOrbit} />
      <div className="splat-caption">
        splat-lab · R4 gaussian splat ·{" "}
        {url ? `capture: ${url}` : "procedural volume"} · Spark/WebGL2
      </div>
    </div>
  );
}

export default function SplatLabPage() {
  return (
    <Suspense fallback={<div className="splat-lab-root" />}>
      <SplatLabStage />
    </Suspense>
  );
}
