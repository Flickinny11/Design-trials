// node-authorship — the runtime half of the PRISM-MASTER-SPEC **Law 0**
// verification corollary ("every artifact is a node", §B Law 0): a success
// criterion for an artifact passes ONLY when a graph node authored it, not
// merely when an object of that name exists in the scene.
//
// The Wave-1 foundation audit (notes/AUDIT-INTEGRITY-REPORT.md C1/C2/C3) found
// three signature artifacts — the configurator watch, the orrery complication,
// and the hub-transition curtain — rendered as hardcoded React/Three
// components mounted OUTSIDE the node map, with no graph node and no codeRef.
// Name/count-only checks passed them. This module is the gate that catches
// them: it walks a built scene and classifies every CONTENT artifact as
//   - node-authored  — mounted from a graph node (carries `userData.prismNodeId`
//                       / `userData.nodeId`, OR is a value in the editor's
//                       `__PRISM_EDITOR_NODE_GROUPS__` registry keyed by nodeId);
//   - hardcoded       — a React/Three component mounted outside the node map
//                       (tagged `userData.prismHardcodedArtifact` at its mount
//                       host, or one of the known-named signature artifacts).
//
// DOM-FREE (FP-05 / INV-15): this module never touches `window`/`document`.
// The browser accessor `window.__PRISM_NODE_AUTHORSHIP__()` is bound in
// GraphScene (the editor shell, dev-gated, alongside `__PRISM_SCENE__`) and
// simply forwards the live `scene` / node-group map / camera into the pure
// `computeSceneAuthorship()` below. The standalone gate
// (`scripts/node-authorship-gate.mjs`) and `/prism-verify` consume its output.

import type { Object3D } from 'three';

/** One classified top-level scene artifact. */
export interface AuthorshipEntry {
  /** Display label: `node:<id>`, `hardcoded:<name>`, or `runtime-host:<name>`. */
  label: string;
  /** Authoring graph node id, or `null` when the artifact is not a graph node
   *  (both `hardcoded` accidental drift AND intentional `runtime-host` infra). */
  nodeId: string | null;
  /** `'node'` = authored by a graph node; `'hardcoded'` = an artifact mounted
   *  outside the node map (accidental Law-0 drift → the violation the gate
   *  exists to catch); `'runtime-host'` = an INTENTIONAL, explicitly-tagged
   *  runtime-behaviour host (e.g. the cross-hub transition) that is sanctioned
   *  infrastructure, NOT a hub artifact and NOT drift (see prismRuntimeHost). */
  kind: 'node' | 'hardcoded' | 'runtime-host';
  /** The Object3D's own `.name` (diagnostic). */
  name: string;
  /** Count of renderable descendants (Mesh/Points/Sprite/Line/InstancedMesh).
   *  A node-authored entry with `renderables === 0` is a node that mounted but
   *  renders nothing — the orphan failure mode (AUDIT C4). */
  renderables: number;
}

export interface AuthorshipReport {
  artifacts: AuthorshipEntry[];
  summary: {
    /** Artifacts produced by a graph node. */
    nodeAuthored: number;
    /** Artifacts mounted outside the node map with NO sanction (accidental
     *  hardcoded drift). This is the count the gate fails on. */
    hardcoded: number;
    /** Intentional, explicitly-tagged runtime-behaviour hosts (sanctioned
     *  infrastructure — e.g. the cross-hub transition). NOT counted as drift. */
    runtimeHost: number;
    /** Node-authored artifacts that mounted but render nothing (orphan smell). */
    emptyNodeAuthored: number;
    total: number;
  };
}

/** KNOWN-but-unmigrated hardcoded signature artifacts (EXPECTED-known drift:
 *  warn, not a fresh-drift failure). A hardcoded artifact NOT in this set is
 *  unsanctioned drift → the gate fails.
 *
 *  THE FOUNDATION IS NOW CLEAN — this set is EMPTY. The three Wave-1 audit
 *  artifacts have all been resolved:
 *    • FIX2 / G1 — configurator watch → graph node `orr-atelier-watch`
 *      (codeRef 'builtin:atelier-watch'). Node-authored.
 *    • FIX3 / G2 — orrery complication → graph node `orr-celestia-orrery`
 *      (codeRef 'builtin:orrery-complication'). Node-authored.
 *    • FIX3 / G3 — hub transition → an INTENTIONAL tagged RUNTIME HOST. The
 *      cross-hub curtain is runtime behaviour (a camera-parented, screen-space
 *      transition orchestrating hub navigation), NOT an artifact pinned to any
 *      hub's node graph — so node-authorship does not apply. It carries
 *      `userData.prismRuntimeHost = 'hub-transition'` and is classified
 *      `kind: 'runtime-host'` (sanctioned infra, not drift). See
 *      docs/spec-deviations-prism.md. */
export const EXPECTED_HARDCODED_ARTIFACTS: readonly string[] = [] as const;

/** Object `.name` → canonical hardcoded-artifact label. EMPTY — no signature
 *  artifact is recognised by name anymore (the hub-transition is now an
 *  explicitly tagged runtime host, recognised by `prismRuntimeHost`, not by a
 *  brittle name match). Retained as the extension point for any future
 *  name-only hardcoded detection. */
const NAMED_HARDCODED: Readonly<Record<string, string>> = {};

interface RenderableLike {
  isMesh?: boolean;
  isPoints?: boolean;
  isSprite?: boolean;
  isLine?: boolean;
  isLineSegments?: boolean;
  isInstancedMesh?: boolean;
}

function isRenderable(o: Object3D): boolean {
  const r = o as unknown as RenderableLike;
  return Boolean(
    r.isMesh || r.isPoints || r.isSprite || r.isLine || r.isLineSegments || r.isInstancedMesh,
  );
}

/** Count renderable descendants (inclusive). The content signal that separates
 *  a real artifact from an empty placeholder Group. */
function countRenderables(root: Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if (isRenderable(o)) n += 1;
  });
  return n;
}

/** Read a node id off an object's userData, tolerating both the explicit
 *  authorship tag (`prismNodeId`) and the factory's internal `nodeId`. */
function readNodeId(o: Object3D): string | null {
  const ud = o.userData as { prismNodeId?: unknown; nodeId?: unknown } | undefined;
  const id = ud?.prismNodeId ?? ud?.nodeId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/**
 * Classify every top-level CONTENT artifact in a built scene by authorship.
 *
 * @param scene       the live `THREE.Scene` (`window.__PRISM_SCENE__`).
 * @param nodeGroups  the editor's `__PRISM_EDITOR_NODE_GROUPS__` map
 *                    (nodeId → mounted artifact root). When present it is the
 *                    authoritative node-authored registry; the scene walk only
 *                    adds hardcoded/untagged content on top of it.
 * @param camera      optional camera whose subtree is also scanned — the
 *                    hub-transition curtain is camera-parented
 *                    (HubSceneTransition mounts onto `camera`).
 */
export function computeSceneAuthorship(
  scene: Object3D | null | undefined,
  nodeGroups?: Map<string, Object3D> | null,
  camera?: Object3D | null,
): AuthorshipReport {
  const artifacts: AuthorshipEntry[] = [];
  const authoredRoots = new Set<Object3D>();

  // 1) Node-authored artifacts — the editor's nodeId → root map is the
  //    ground truth. Key IS the authoring nodeId; value is the mounted root.
  if (nodeGroups) {
    for (const [nodeId, obj] of nodeGroups) {
      if (!obj) continue;
      authoredRoots.add(obj);
      artifacts.push({
        label: `node:${nodeId}`,
        nodeId,
        kind: 'node',
        name: obj.name ?? '',
        renderables: countRenderables(obj),
      });
    }
  }

  // Helper: is `o` inside (or equal to) any already-counted authored root?
  const insideAuthored = (o: Object3D): boolean => {
    let cur: Object3D | null = o;
    while (cur) {
      if (authoredRoots.has(cur)) return true;
      cur = cur.parent;
    }
    return false;
  };

  // 2) Non-node artifacts — walk the scene (and the camera subtree) for objects
  //    that are NOT inside a node-authored root and carry one of two tags:
  //      • `prismRuntimeHost` → an INTENTIONAL runtime-behaviour host (sanctioned
  //        infra; e.g. the camera-parented cross-hub transition). NOT drift.
  //      • `prismHardcodedArtifact` (or a NAMED_HARDCODED signature name) → an
  //        accidental hardcoded artifact mounted outside the node map. Its
  //        nodeId === null IS the Law-0 violation the gate exists to surface.
  //    Runtime hosts are checked FIRST so a host is never mis-flagged as drift.
  const reportedHardcoded = new Set<Object3D>();
  const reportedRuntimeHost = new Set<Object3D>();
  const roots: Object3D[] = [];
  if (scene) roots.push(scene);
  if (camera) roots.push(camera);

  for (const r of roots) {
    r.traverse((o) => {
      const ud = o.userData as
        | { prismHardcodedArtifact?: unknown; prismRuntimeHost?: unknown }
        | undefined;
      const host = typeof ud?.prismRuntimeHost === 'string' ? ud.prismRuntimeHost : null;
      const tag =
        typeof ud?.prismHardcodedArtifact === 'string' ? ud.prismHardcodedArtifact : null;
      const named = NAMED_HARDCODED[o.name] ?? null;
      // Cheap early bail: most scene objects carry none of these tags.
      if (!host && !tag && !named) return;
      if (insideAuthored(o)) return; // a node legitimately authored it

      // Intentional tagged runtime host — sanctioned, distinct from drift.
      if (host) {
        if (reportedRuntimeHost.has(o)) return;
        reportedRuntimeHost.add(o);
        artifacts.push({
          label: `runtime-host:${host}`,
          nodeId: null,
          kind: 'runtime-host',
          name: o.name ?? '',
          renderables: countRenderables(o),
        });
        return;
      }

      // Accidental hardcoded artifact — the violation.
      const label = tag ?? named;
      if (!label) return;
      if (reportedHardcoded.has(o)) return;
      reportedHardcoded.add(o);
      artifacts.push({
        label: `hardcoded:${label}`,
        nodeId: null,
        kind: 'hardcoded',
        name: o.name ?? '',
        renderables: countRenderables(o),
      });
    });
  }

  const nodeAuthored = artifacts.filter((a) => a.kind === 'node');
  const hardcoded = artifacts.filter((a) => a.kind === 'hardcoded');
  const runtimeHost = artifacts.filter((a) => a.kind === 'runtime-host');
  return {
    artifacts,
    summary: {
      nodeAuthored: nodeAuthored.length,
      hardcoded: hardcoded.length,
      runtimeHost: runtimeHost.length,
      emptyNodeAuthored: nodeAuthored.filter((a) => a.renderables === 0).length,
      total: artifacts.length,
    },
  };
}
