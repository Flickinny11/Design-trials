"use client";

// CinematicFloorPost — the R1 cinematic-floor FULL-FRAME post chain (W-PHOTO D4),
// applied on an OWNED canvas (DEV-2): bloom + film grain + vignette (+ optional
// depth-of-field / LUT, added below). It NEVER edits the engine SceneRoot /
// LightingRig — it runs only where we own the renderer (this lab route, the
// marketing stack). Built on three r184's node-based PostProcessing + the TSL
// display nodes (BloomNode/FilmNode), the forward path for WebGPU (EffectComposer
// is legacy WebGL-only — research §2).
//
// Perfection reads digital; a faint grain + soft bloom + edge vignette are the
// cheapest "shot on a real sensor" cues. Defaults are tuned subtle — a floor,
// not an effect.

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PostProcessing } from "three/webgpu";
import {
  pass,
  screenUV,
  vec2,
  vec3,
  length as tslLength,
  smoothstep,
  mix,
  saturation,
  float,
} from "three/tsl";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";
import { film } from "three/examples/jsm/tsl/display/FilmNode.js";
import { dof } from "three/examples/jsm/tsl/display/DepthOfFieldNode.js";

export interface CinematicFloorPostProps {
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
  grain?: number;
  /** 0..1 edge darkening. */
  vignette?: number;
  /** Depth-of-field (subtle focus falloff). Set false to disable. */
  dofEnabled?: boolean;
  /** View-space focus distance (product plane sits ~9.4 in front). */
  dofFocus?: number;
  dofBokeh?: number;
  /** Colour grade: warm gain, contrast pivot 0.5, saturation. */
  warmth?: number;
  contrast?: number;
  saturate?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TNode = any;

export function CinematicFloorPost({
  bloomStrength = 0.42,
  bloomRadius = 0.35,
  bloomThreshold = 0.75,
  grain = 0.06,
  vignette = 0.32,
  // DOF is opt-in: the R2 composite bakes its own focus into the plates, so the
  // lab leaves it off; R1 realtime scenes (the watch, D6) turn it on to soften
  // depth beyond the hero. Focus is view-space (negative in front of camera).
  dofEnabled = false,
  dofFocus = -9.4,
  dofBokeh = 1.0,
  warmth = 0.05,
  contrast = 1.06,
  saturate = 1.06,
}: CinematicFloorPostProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const post = useMemo(() => {
    const scenePass = pass(scene as never, camera as never);
    const beauty: TNode = scenePass.getTextureNode();

    // Depth of field: gentle focus falloff so the far backdrop + near garnish
    // soften while the product plane stays sharp (view-space viewZ from the pass).
    let base: TNode = beauty;
    if (dofEnabled) {
      const viewZ: TNode = scenePass.getViewZNode();
      base = dof(beauty, viewZ, float(dofFocus), float(1), float(dofBokeh));
    }

    // Bloom: soft bloomed highlights added over the (possibly DOF'd) beauty.
    const glow: TNode = bloom(base, bloomStrength, bloomRadius, bloomThreshold);
    let out: TNode = base.add(glow);

    // Colour grade (the runtime LUT stand-in): warm gain → contrast (pivot 0.5)
    // → saturation. Kept subtle — a grade, not a filter.
    out = out.mul(vec3(1 + warmth, 1, 1 - warmth * 0.6));
    out = mix(vec3(0.5, 0.5, 0.5), out, float(contrast));
    out = saturation(out, float(saturate));

    // Vignette: darken toward the frame edge (radial, from screen centre).
    const d: TNode = tslLength((screenUV as TNode).sub(vec2(0.5, 0.5)));
    const vig: TNode = smoothstep(float(0.75), float(0.28), d); // 1 centre → 0 edge
    out = out.mul(mix(float(1 - vignette), float(1), vig));

    // Film grain: a faint sensor-noise breakup so perfection doesn't read digital.
    out = film(out, float(grain));

    const p = new PostProcessing(gl as never);
    (p as unknown as { outputNode: TNode }).outputNode = out;
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    gl,
    scene,
    camera,
    bloomStrength,
    bloomRadius,
    bloomThreshold,
    grain,
    vignette,
    dofEnabled,
    dofFocus,
    dofBokeh,
    warmth,
    contrast,
    saturate,
  ]);

  useEffect(() => {
    const p = post as unknown as { setSize?: (w: number, h: number) => void };
    p.setSize?.(size.width, size.height);
  }, [post, size]);

  useEffect(
    () => () => (post as unknown as { dispose?: () => void }).dispose?.(),
    [post],
  );

  // Positive priority → R3F yields the render loop to us; we drive the post pass.
  useFrame(() => {
    (post as unknown as { render: () => void }).render();
  }, 1);

  return null;
}
