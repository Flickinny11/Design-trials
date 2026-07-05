// THREE-D-BACKGROUNDS — depth-displaced parallax plate (A2 / C6), the "image
// half" of the hybrid given real depth.
//
// A subdivided plane textured with a base image (`sourceUrl`) and DISPLACED in Z
// by a depth map (`depthMapUrl`, fal depth-anything/v2): bright depth = nearer
// the camera. Because the displacement is real GEOMETRY, the plate PARALLAXES
// with the camera-journey — near image regions shift more than far ones — vs a
// flat plate that shifts uniformly (the C6 control). Edge-feathered (radial uv
// falloff) so it composites behind the procedural layers with no hard seam /
// pasted-oval edge; corners read as atmosphere (C5). One renderer, TSL only.

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  texture as tslTexture,
  uv,
  vec2,
  vec3,
  float,
  positionLocal,
  smoothstep,
  length as tslLength,
  clamp as tslClamp,
} from 'three/tsl';
import type { BackgroundLayerParams } from '@/lib/prism-graph/types';

type TNode = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const PLANE_W = 96;
const PLANE_H = 56;

function useImageTexture(url: string | null | undefined): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!url) {
      setTex(null);
      return;
    }
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (t) => {
        if (cancelled) {
          t.dispose();
          return;
        }
        t.colorSpace = THREE.SRGBColorSpace;
        setTex((prev) => {
          prev?.dispose();
          return t;
        });
      },
      undefined,
      () => !cancelled && setTex(null),
    );
    return () => {
      cancelled = true;
    };
  }, [url]);
  useEffect(() => () => tex?.dispose(), [tex]);
  return tex;
}

export interface ParallaxPlaneLayerProps {
  sourceUrl: string;
  depthMapUrl?: string | null;
  params: BackgroundLayerParams;
  z?: number;
  opacity?: number;
  /** Disable depth displacement (the flat-plate control for the C6 measurement). */
  flat?: boolean;
  renderOrder?: number;
}

export function ParallaxPlaneLayer({
  sourceUrl,
  depthMapUrl,
  params,
  z = -40,
  opacity = 1,
  flat = false,
  renderOrder = -2,
}: ParallaxPlaneLayerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const imageTex = useImageTexture(sourceUrl);
  const depthTex = useImageTexture(depthMapUrl);

  const depthSpread = typeof params.depthSpread === 'number' ? params.depthSpread : 0.6;
  const amplitude = (flat ? 0 : 1) * (8 + depthSpread * 22); // world-Z displacement range.

  const material = useMemo(() => {
    const mat = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    return mat;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-wire the nodes once both textures are present (depth displacement needs
  // the depth texture; color needs the image). Done in an effect so the
  // material can mount before textures finish loading.
  useEffect(() => {
    if (!imageTex) return;
    const u = uv() as TNode;
    // Radial edge feather → corners fade into atmosphere (no hard seam, C5).
    const d: TNode = tslLength(u.sub(vec2(0.5, 0.5)));
    const feather: TNode = smoothstep(float(0.72), float(0.34), d);
    (material as unknown as { colorNode: unknown }).colorNode = (tslTexture(imageTex) as TNode).rgb;
    (material as unknown as { opacityNode: unknown }).opacityNode = feather.mul(float(opacity));
    if (depthTex && !flat) {
      const depthVal: TNode = (tslTexture(depthTex, u) as TNode).r;
      // Center the displacement so the plate straddles its z (near pulls toward
      // camera, far pushes away) → symmetric parallax about the plane.
      const disp: TNode = depthVal.sub(0.5).mul(amplitude * 2);
      (material as unknown as { positionNode: unknown }).positionNode = (positionLocal as TNode).add(
        vec3(0, 0, disp),
      );
    } else {
      (material as unknown as { positionNode: unknown }).positionNode = positionLocal;
    }
    (material as unknown as { needsUpdate: boolean }).needsUpdate = true;
    void tslClamp;
  }, [imageTex, depthTex, flat, amplitude, opacity, material]);

  useEffect(() => () => material.dispose(), [material]);

  // WORLD-ANCHORED (no camera follow): the plate is fixed in scene Z so the
  // camera flies PAST it → near displaced regions parallax more than far ones
  // (C6). Large size + edge feather keep the plate covering the frame across the
  // bounded camera journey without exposing an edge.
  const geometry = useMemo(() => new THREE.PlaneGeometry(PLANE_W, PLANE_H, 160, 96), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  if (!imageTex) return null;
  return (
    <mesh
      ref={meshRef}
      position={[0, 0, z]}
      renderOrder={renderOrder}
      frustumCulled={false}
      geometry={geometry}
      material={material}
    />
  );
}
