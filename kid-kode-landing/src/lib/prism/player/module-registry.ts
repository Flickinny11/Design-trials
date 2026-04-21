// Dynamically import node createNode() modules from in-memory source strings.
// Each module is materialized as a blob URL and imported.
//
// The import map for the module (PIXI, gsap, atlas, …) is NOT resolved by the
// module itself — node modules follow the ctx-injection pattern and receive
// dependencies via the ctx argument to createNode(ctx). That lets us keep the
// node modules as pure ES modules with zero external import statements.

export type NodeCtx = {
  PIXI: typeof import('pixi.js');
  gsap: typeof import('gsap').gsap;
  atlas: import('./atlas-loader').Atlas;
  region?: unknown;
  regions?: Record<string, unknown>;
  overlayRegions?: Record<string, unknown>;
  frameRegions?: unknown[];
  transform: { x: number; y: number; width: number; height: number; z: number };
  events: import('./event-bus').EventBus;
  state: import('./state-manager').StateManager;
  backend: { call: (path: string, opts?: { method?: string; body?: unknown; headers?: Record<string, string> }) => Promise<{ status: number; body: unknown }> };
  intent: Record<string, unknown> & { nodeId: string };
  msdfFont: import('./msdf-loader').MsdfFont | null;
};

export type NodeInstance = { container: import('pixi.js').Container; teardown: () => void };
export type CreateNode = (ctx: NodeCtx) => NodeInstance;

// dynamicImport avoids webpack static analysis — Next.js / Turbopack will
// otherwise try to resolve the blob URL at build time and fail. The Function
// constructor creates the import expression at runtime.
const dynamicImport: (url: string) => Promise<Record<string, unknown>> =
  typeof globalThis.Function === 'function'
    ? (new Function('u', 'return import(u)') as (u: string) => Promise<Record<string, unknown>>)
    : ((u: string) => import(/* webpackIgnore: true */ u) as Promise<Record<string, unknown>>);

export async function loadNodeModule(source: string): Promise<{ createNode: CreateNode }> {
  const blob = new Blob([source], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  try {
    const mod = await dynamicImport(url);
    if (typeof mod.createNode !== 'function') {
      throw new Error('node module missing createNode() export');
    }
    return { createNode: mod.createNode as CreateNode };
  } finally {
    URL.revokeObjectURL(url);
  }
}
