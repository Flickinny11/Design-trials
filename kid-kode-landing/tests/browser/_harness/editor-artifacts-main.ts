// HL10 — editor-artifacts harness entrypoint.
//
// Imports the live-graph fixture (the canonical 6-node home hub seed) and
// runs the editor's artifact-resolution pipeline against it: for every node
// whose `hasArtifactData(node)` predicate is true, calls
// `resolveArtifactObject(node)` and counts non-empty Object3Ds. The result
// (totals + per-id breakdown + cache-hit confirmation) is stamped into
// `<pre id="readout">` and the body `data-hl10-ready` flag is flipped on.
//
// This proves the contract surface ArtifactNode sits on top of (delegation
// predicate + cached factory pipeline) without booting React/R3F. The
// React component itself is verified by tsc + the file-existence
// verificationCommand. Full editor canvas smoke is the KripVerify gate.

import liveGraph from '../../../public/prism-mock/home/live-graph.json' with { type: 'json' };
import {
  hasArtifactData,
  resolveArtifactObject,
  __resetArtifactNodeCache,
} from '../../../src/components/editor/graph/ArtifactNode';
import { __resetSharedContext } from '../../../src/lib/prism/runtime/shared-context';

declare global {
  interface Window {
    __hl10ArtifactReadout?: unknown;
  }
}

function main() {
  __resetArtifactNodeCache();
  __resetSharedContext();

  const nodes = (liveGraph as { nodes: any[] }).nodes;
  const artifactNodes = nodes.filter(hasArtifactData);
  const intentOnlyIds = nodes
    .filter((n) => !hasArtifactData(n))
    .map((n) => n.nodeId as string);
  const artifactIds = artifactNodes.map((n) => n.nodeId as string);

  let artifactObjects = 0;
  let cacheHitOnSecondResolve = true;
  for (const node of artifactNodes) {
    let obj;
    try {
      obj = resolveArtifactObject(node);
    } catch (err) {
      console.warn('resolveArtifactObject failed', node.nodeId, err);
      continue;
    }
    if (obj) artifactObjects += 1;
    // Re-resolving the same node should return the same object (cache).
    const obj2 = resolveArtifactObject(node);
    if (obj !== obj2) cacheHitOnSecondResolve = false;
  }

  const readout = {
    totalNodes: nodes.length,
    artifactCount: artifactNodes.length,
    artifactObjects,
    artifactIds,
    intentOnlyIds,
    cacheHitOnSecondResolve,
  };
  window.__hl10ArtifactReadout = readout;
  const pre = document.getElementById('readout');
  if (pre) pre.textContent = JSON.stringify(readout, null, 2);
  document.body.setAttribute('data-hl10-ready', '1');
}

try {
  main();
} catch (err) {
  console.error('[HL10 harness] failed:', err);
  const pre = document.getElementById('readout');
  if (pre) pre.textContent = JSON.stringify({ error: String(err) });
  document.body.setAttribute('data-hl10-ready', '1');
}
