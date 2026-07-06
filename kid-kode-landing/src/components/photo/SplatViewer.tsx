"use client";

// SplatViewer — the R4 gaussian-splat viewer (W-PHOTO D5). An OWNED WebGL canvas
// (Spark renders under WebGL2 by design → a SECOND owned renderer, never the
// single-WebGPU editor scene, INV-1 / DEV-3). It renders a `SplatMesh`:
//   • from a URL (the LOADER + asset slot: .spz/.ply/.splat/.sog) when `splatUrl`
//     is set — a real capture drops in here in a later wave; or
//   • a procedural gaussian VOLUME (constructSpherePoints) as the shipped demo,
//     so the viewer proves the Spark integration without a captured asset.
// The camera flies THROUGH the volume via OrbitControls (auto-orbit for review).
//
// Spark exposes window.__SPLAT__ { count, source } for verification.

import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Color } from "three";
import {
  SparkRenderer,
  SplatMesh,
  constructSpherePoints,
} from "@sparkjsdev/spark";

export interface SplatViewerProps {
  /** Real capture URL (.spz/.ply/.splat/.sog). When absent → procedural demo. */
  splatUrl?: string | null;
  autoOrbit?: boolean;
}

function SplatScene({ splatUrl, autoOrbit = true }: SplatViewerProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const [ready, setReady] = useState(false);

  const built = useMemo(() => {
    // Spark's sort/accumulate renderer, driven by the owned WebGL renderer.
    const spark = new SparkRenderer({ renderer: gl as never });
    scene.add(spark);

    let mesh: SplatMesh;
    if (splatUrl) {
      mesh = new SplatMesh({ url: splatUrl, onLoad: () => setReady(true) });
    } else {
      // Procedural demo: a dense sphere shell of coloured gaussians — a real
      // 3DGS volume to fly through (constructSplats mutates the PackedSplats).
      mesh = new SplatMesh({
        constructSplats: (splats) => {
          constructSpherePoints({
            splats,
            radius: 1.35,
            maxDepth: 3,
            pointRadius: 0.028,
            color: new Color("#e8c877"),
          });
        },
        onLoad: () => setReady(true),
      });
    }
    scene.add(mesh);
    return { spark, mesh };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, splatUrl]);

  useEffect(() => {
    return () => {
      scene.remove(built.mesh);
      scene.remove(built.spark);
      (built.mesh as unknown as { dispose?: () => void }).dispose?.();
      (built.spark as unknown as { dispose?: () => void }).dispose?.();
    };
  }, [built, scene]);

  useFrame(() => {
    if (typeof window !== "undefined") {
      (window as unknown as { __SPLAT__?: unknown }).__SPLAT__ = {
        source: splatUrl ? "url" : "procedural",
        ready,
        numSplats:
          (built.mesh as unknown as { numSplats?: number }).numSplats ?? null,
      };
    }
  });

  return null;
}

export function SplatViewer({
  splatUrl = null,
  autoOrbit = true,
}: SplatViewerProps) {
  return (
    <Canvas
      // Spark is WebGL2; antialias off is Spark's recommendation for 3DGS perf.
      gl={{ antialias: false, alpha: false }}
      camera={{ position: [0, 0, 3.2], fov: 45 }}
      data-testid="splat-canvas"
    >
      <color attach="background" args={["#050608"]} />
      <Suspense fallback={null}>
        <SplatScene splatUrl={splatUrl} autoOrbit={autoOrbit} />
      </Suspense>
      <OrbitControls
        makeDefault
        autoRotate={autoOrbit}
        autoRotateSpeed={0.9}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={1.2}
        maxDistance={8}
      />
    </Canvas>
  );
}
