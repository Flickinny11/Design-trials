"use client";

// /photo-lab — the REVIEWABLE route for the W-PHOTO R2 photographic composite
// (D2) and, once mounted, the R1 cinematic floor (D4). An OWNED R3F canvas
// (DEV-2): the filmic post chain runs here, never on the engine SceneRoot. It
// renders the layered-photo composite scene — baked cutout + depth + detached
// shadow + graded plates — with differentiated parallax (move the cursor) and
// independent idle float loops. Photoreal by SOURCE IMAGERY, not geometry.
//
//   ?manifest=<id>   composite id under /prism-mock/photo/ (default celestia-hero)
//   ?drive=<-1..1>   pin the parallax drive for deterministic capture
//   ?tone=neutral    Khronos PBR Neutral tone mapping (default AgX)

import { Suspense, useEffect, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";
import { useSearchParams } from "next/navigation";
import { PhotoCompositeScene } from "@/components/photo/PhotoCompositeScene";
import { CinematicFloorPost } from "@/components/photo/CinematicFloorPost";

function makeFactory(tone: "agx" | "neutral") {
  return async function webgpuFactory(
    props: { canvas?: HTMLCanvasElement } & Record<string, unknown>,
  ) {
    const renderer = new WebGPURenderer({
      ...(props as object),
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    } as ConstructorParameters<typeof WebGPURenderer>[0]);
    await renderer.init();
    const r = renderer as unknown as {
      toneMapping: THREE.ToneMapping;
      toneMappingExposure: number;
      outputColorSpace: THREE.ColorSpace;
      setClearColor: (c: number, a: number) => void;
    };
    // Filmic tone mapping (research §2): AgX for HDR/artistic, Khronos PBR
    // Neutral for accurate sRGB base colour. Both first-class in r184.
    r.toneMapping =
      tone === "neutral" ? THREE.NeutralToneMapping : THREE.AgXToneMapping;
    r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.setClearColor(0x040406, 1);
    return renderer as unknown as THREE.WebGLRenderer;
  };
}

function LabRig({ onDrive }: { onDrive: (v: number | null) => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    (window as unknown as { __PHOTO_LAB__?: unknown }).__PHOTO_LAB__ = {
      setDrive: (v: number | null) => onDrive(v),
      backend: (gl as unknown as { backend?: { isWebGPUBackend?: boolean } })
        .backend?.isWebGPUBackend
        ? "webgpu"
        : "webgl2",
    };
  }, [gl, onDrive]);
  return null;
}

function PhotoLabStage() {
  const sp = useSearchParams();
  const manifestId = sp.get("manifest") ?? "celestia-hero";
  const tone = sp.get("tone") === "neutral" ? "neutral" : "agx";
  const urlDrive = sp.get("drive");
  const [drive, setDrive] = useState<number | null>(
    urlDrive != null ? Number(urlDrive) : null,
  );
  const floorOn = sp.get("floor") !== "0"; // R1 filmic floor on by default

  return (
    <div data-photo-stage data-testid="photo-stage">
      <Canvas
        dpr={[1, 2]}
        gl={makeFactory(tone) as never}
        camera={{ position: [0, 0, 7], fov: 42 }}
        data-testid="photo-canvas"
      >
        <color attach="background" args={["#040406"]} />
        <Suspense fallback={null}>
          <PhotoCompositeScene
            manifestUrl={`/prism-mock/photo/${manifestId}/composite.json`}
            driveOverride={drive}
          />
        </Suspense>
        {floorOn && <CinematicFloorPost />}
        <LabRig onDrive={setDrive} />
      </Canvas>
      <div data-photo-caption>
        photo-lab · {manifestId} · R2 composite {floorOn ? "+ R1 floor" : ""} ·{" "}
        {tone.toUpperCase()}
      </div>
    </div>
  );
}

export default function PhotoLabPage() {
  return (
    <Suspense fallback={<div data-photo-stage />}>
      <PhotoLabStage />
    </Suspense>
  );
}
