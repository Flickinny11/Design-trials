// W-TPL D3 — catalog authoring helpers layered over the proven W8
// node-helpers (which stay untouched). These add the W-PHOTO lanes the new
// templates lean on: the R2 layered-photo composite scene, the single-plate
// depth-parallax plane, and a couple of ergonomic wrappers.

import type { PrismNode } from '@/lib/prism-graph/types';
import { bind, fxNode, imageNode, type NodeSpec } from './node-helpers';

export {
  bind,
  fxNode,
  glbNode,
  imageNode,
  meshNode,
  templateHub,
  textNode,
  type NodeSpec,
  type TextOpts,
  type HubSpec,
} from './node-helpers';

/** An R2 layered-photo composite scene node (W-PHOTO D2): an fx anchor whose
 *  `layered-photo-scene` binding assembles the given CompositeManifest's baked
 *  plates as a differentiated-parallax diorama. Driven by scroll with an idle
 *  sway fallback, so it is alive even before the user scrolls. */
export function compositeSceneNode(
  spec: NodeSpec,
  manifestUrl: string,
  params: { parallaxDepth?: number; floatAmount?: number; driftSpeed?: number } = {},
): PrismNode {
  const node = fxNode({
    serviceTag: 'ui-visual',
    subtype: 'photo-composite-scene',
    ...spec,
    bindings: [
      bind('layered-photo-scene', 'scroll', {
        params: {
          manifestUrl,
          parallaxDepth: params.parallaxDepth ?? 1.2,
          floatAmount: params.floatAmount ?? 1,
          driftSpeed: params.driftSpeed ?? 0.35,
        },
      }),
      ...(spec.bindings ?? []),
    ],
  });
  return node;
}

/** A single-plate depth-parallax hero (the R2 lane's cheapest form): one
 *  photographic plate + its depth map on the runtime's parallax-plane
 *  displacement lane, tilting to the pointer for a true-depth read. */
export function depthPlateNode(
  spec: NodeSpec,
  sourceAsset: string,
  depthMapUrl: string,
): PrismNode {
  const node = imageNode(
    { subtype: 'depth-plate', ...spec },
    sourceAsset,
  );
  node.renderMode = 'parallax-plane';
  node.depthMapUrl = depthMapUrl;
  return node;
}
