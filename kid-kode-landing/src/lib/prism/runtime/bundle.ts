// Phase 5 bundle assembly — spec §11 L389-L445.
//
// `assembleBundle(graph)` emits the file map browser-side `assembleBundle`
// is supposed to produce: app.js, graph.json, the shared scene
// infrastructure, the cinematic primitives library, the TSL shaders, and
// per-node code. Renamed from the PixiJS-era assembler; the importmap now
// resolves three / three/webgpu / three/tsl / three/addons/ / gsap from a
// CDN and bundles three-msdf-text-webgpu (small, no stable CDN yet).
//
// Implementation lands in step 7. This stub exists only so the failing
// T05 tests typecheck under §10/§17.

export interface NodeDef {
  nodeId: string;
  subtype: string;
  parentHubId: string;
  serviceTag: string;
  visual: {
    transform: { x: number; y: number; width: number; height: number; z: number };
    [k: string]: unknown;
  };
  intent: Record<string, unknown> & { caption?: string };
  codeRef: string;
  backendRef?: string | null;
}

export interface HubDef {
  hubId: string;
  title: string;
  nodeIds?: string[];
  layout: { viewportWidth: number; viewportHeight: number; contentHeight: number; backgroundColor: string };
}

export interface EdgeDef {
  from: string;
  to: string;
  type: 'triggers' | 'state-update' | 'data-flow' | 'event-bubble';
  event?: string;
}

export interface CompiledGraph {
  version: string;
  hubs: HubDef[];
  nodes: NodeDef[];
  edges: EdgeDef[];
}

export interface ImportMap {
  imports: Record<string, string>;
}

export function assembleBundle(_graph: CompiledGraph): Record<string, string> {
  throw new Error('assembleBundle: not implemented (T05 stub)');
}

export function buildImportMap(): ImportMap {
  throw new Error('buildImportMap: not implemented (T05 stub)');
}
