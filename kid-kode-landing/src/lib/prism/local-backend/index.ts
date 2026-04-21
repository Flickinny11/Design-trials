// LocalBackend — in-browser stand-in for a server. Backend modules from the
// .prism archive are dynamically imported as ES modules via blob URLs and
// registered here. Nodes call backend.call(path, options) which routes to the
// right handler(s) based on path match.

import type { StateManager } from '../player/state-manager';
import { createFakeDb, type FakeDb } from './fake-db';

export type BackendRequest = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
};
export type BackendResponse = { status: number; body: unknown };
export type BackendHandler = (req: BackendRequest, ctx: BackendHandlerCtx) => Promise<BackendResponse>;
export type BackendHandlerCtx = {
  fakeDb: FakeDb;
  logger: Console;
  state: StateManager;
  nodeIntent?: unknown;
};

export interface LocalBackend {
  register(name: string, handler: BackendHandler): void;
  registerFromSource(name: string, source: string): Promise<void>;
  call(path: string, options?: { method?: BackendRequest['method']; body?: unknown; headers?: Record<string, string> }): Promise<BackendResponse>;
  readonly fakeDb: FakeDb;
}

export function createLocalBackend(opts: { state: StateManager }): LocalBackend {
  const handlers: Array<{ name: string; handler: BackendHandler }> = [];
  const fakeDb = createFakeDb({ '__session-started-at': Date.now() });

  async function registerFromSource(name: string, source: string) {
    const blob = new Blob([source], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    try {
      const mod: { handler?: BackendHandler } = await import(/* @vite-ignore */ url);
      if (typeof mod.handler !== 'function') throw new Error(`backend "${name}" has no handler export`);
      handlers.push({ name, handler: mod.handler });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function call(path: string, options: { method?: BackendRequest['method']; body?: unknown; headers?: Record<string, string> } = {}) {
    const req: BackendRequest = { method: options.method ?? 'GET', path, body: options.body, headers: options.headers };
    const ctx: BackendHandlerCtx = { fakeDb, logger: console, state: opts.state };
    // Try every handler in registration order; first non-404 wins. Handlers
    // self-identify their path → we let them decide match.
    let last: BackendResponse = { status: 404, body: { error: 'no handler matched', path } };
    for (const { handler } of handlers) {
      try {
        const r = await handler(req, ctx);
        if (r.status !== 404) return r;
        last = r;
      } catch (e) {
        return { status: 500, body: { error: (e as Error).message } };
      }
    }
    return last;
  }

  return {
    register(name, handler) { handlers.push({ name, handler }); },
    registerFromSource,
    call,
    get fakeDb() { return fakeDb; },
  };
}
