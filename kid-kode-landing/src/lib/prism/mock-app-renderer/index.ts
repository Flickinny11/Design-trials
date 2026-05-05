// Mock App Reconstruction (T09) — renderer-era graph source.
//
// Spec ref: PRISM-RENDERER-MIGRATION-SPEC.md §14 L487-L500.
//
// `graph.json` is the canonical source. This module re-exports it through
// the renderer-era `GraphSource` type for typecheck coverage and provides
// the `MockAppRendererGraph` shape consumed by `scripts/build-mock-app.mjs`.
//
// The graph is intentionally hand-authored (no codegen, no fal calls) so
// `scripts/build-mock-app.mjs` is deterministic and runs in <35s without
// network. Per-node `meshUrl` and `depthMapUrl` are pre-baked CDN URLs;
// the build script does NOT call Depth Anything v2 / Hunyuan3D / Trellis-2
// (those live in T06 `pipeline/orchestrator.ts` and run only when the
// pipeline is invoked end-to-end).

import type { GraphSource, PrismHub, PrismNode, PrismEdge } from '@/lib/prism-graph/types.ts';
import graphJson from './graph.json';

export interface MockAppRendererGraph extends GraphSource {
  schemaVersion: string;
  version: string;
  hubs: PrismHub[];
  nodes: PrismNode[];
  edges: PrismEdge[];
}

// Type assertion: `graph.json` is the source of truth and conforms to the
// renderer-era PrismNode schema (additive fields per spec §4 L116-L137).
// The cast is safe because the JSON is hand-authored and validated by the
// T09 Playwright tests.
export const MOCK_APP_RENDERER_GRAPH = graphJson as unknown as MockAppRendererGraph;
