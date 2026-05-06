// HL03 — Eager init swap: bundled home-hub.json → live-graph.json fetch.
//
// Spec refs:
//   - Plan §P4 (live-graph.json swap)
//   - Spec invariant 1 (the graph is the app)
//
// Acceptance:
//   1. src/stores/useGraphSourceStore.ts contains no `import homeHubJson`
//      (or any other static import of home-hub.json).
//   2. The legacy bundled JSON has been moved to home-hub.legacy.json; the
//      old path no longer resolves.
//   3. On module load in a window-having env, the store fires a fetch for
//      `/prism-mock/home/live-graph.json` and reaches `ready: true` once
//      the fetch resolves — no synchronous bundled-JSON load remains.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const STORE_PATH = join(REPO_ROOT, 'src', 'stores', 'useGraphSourceStore.ts');
const HUBS_DIR = join(REPO_ROOT, 'src', 'lib', 'prism', 'mock-app-source', 'hubs');
const LIVE_GRAPH_PATH = join(REPO_ROOT, 'public', 'prism-mock', 'home', 'live-graph.json');

describe('HL03 — useGraphSourceStore eager-init source', () => {
  it('does not statically import the bundled home-hub.json', () => {
    const src = readFileSync(STORE_PATH, 'utf8');
    expect(src).not.toMatch(/import\s+homeHubJson\s+from/);
    expect(src).not.toMatch(/from\s+['"]@\/lib\/prism\/mock-app-source\/hubs\/home-hub\.json['"]/);
  });

  it('eager-init invokes loadFromHomeHubFile against the live-graph.json public path', () => {
    const src = readFileSync(STORE_PATH, 'utf8');
    expect(src).toMatch(/loadFromHomeHubFile\(\s*['"]\/prism-mock\/home\/live-graph\.json['"]\s*\)/);
  });

  it('archived bundled JSON: legacy file exists, live path is gone', () => {
    expect(existsSync(join(HUBS_DIR, 'home-hub.legacy.json'))).toBe(true);
    expect(existsSync(join(HUBS_DIR, 'home-hub.json'))).toBe(false);
  });
});

describe('HL03 — runtime: store reaches ready after live-graph.json fetch', () => {
  const ORIGINAL_FETCH = globalThis.fetch;
  const ORIGINAL_WINDOW = (globalThis as { window?: unknown }).window;

  beforeEach(() => {
    vi.resetModules();
    (globalThis as { window?: unknown }).window = globalThis as unknown as Window;
  });

  afterEach(() => {
    if (ORIGINAL_WINDOW === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = ORIGINAL_WINDOW;
    }
    if (ORIGINAL_FETCH === undefined) {
      delete (globalThis as { fetch?: unknown }).fetch;
    } else {
      globalThis.fetch = ORIGINAL_FETCH;
    }
  });

  it('fetches /prism-mock/home/live-graph.json on module load and ends ready=true', async () => {
    const liveGraphText = readFileSync(LIVE_GRAPH_PATH, 'utf8');
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (!url.endsWith('/prism-mock/home/live-graph.json')) {
        throw new Error(`HL03 fetch contract: unexpected URL ${url}`);
      }
      return new Response(liveGraphText, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const mod = await import('@/stores/useGraphSourceStore');
    const { useGraphSourceStore } = mod as {
      useGraphSourceStore: { getState: () => { ready: boolean; error: string | null; nodes: Array<{ nodeId: string }>; hubs: Array<{ hubId: string }> } };
    };

    // Allow the eager-init microtask + fetch to resolve.
    for (let i = 0; i < 20; i++) {
      if (useGraphSourceStore.getState().ready) break;
      await new Promise((r) => setTimeout(r, 5));
    }

    const state = useGraphSourceStore.getState();
    expect(state.error).toBeNull();
    expect(state.ready).toBe(true);
    expect(state.hubs.length).toBeGreaterThan(0);
    expect(state.nodes.length).toBeGreaterThanOrEqual(6);
    expect(fetchSpy).toHaveBeenCalled();
    const calledUrl = String(fetchSpy.mock.calls[0]?.[0] ?? '');
    expect(calledUrl.endsWith('/prism-mock/home/live-graph.json')).toBe(true);
  });
});
