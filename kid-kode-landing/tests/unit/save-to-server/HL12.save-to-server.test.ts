// HL12 — Save / Save & Verify / Preview-in-App-UI buttons.
//
// Spec ref: Plan §P12 — Inspector gains:
//   - "Save"            (data-role="save")            → saveToServer()
//   - "Preview in App UI" (data-role="preview-in-app-ui") → setViewMode('preview') + flyToHub
// useGraphEditorStore gains a setViewMode action; viewMode lives on the store
// so the Inspector button can drive a top-level pane swap.
//
// Save & Verify (existing on VisualPreview) is widened to include `codeModule`
// in the regen body — already implemented in regen-api.ts; this suite pins
// the wire shape so future refactors can't drop it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  PrismEdge,
  PrismHub,
  PrismIntent,
  PrismNode,
} from '@/lib/prism-graph/types';
import { saveAndVerify } from '@/components/editor/panels/visual-preview/regen-api';

// Mirror of the source-store contract used by the Inspector's Save button.
type SourceStore = {
  hubs: PrismHub[];
  nodes: PrismNode[];
  edges: PrismEdge[];
  isDirty: boolean;
  savedAt: string | null;
  load: (json: unknown) => void;
  saveToServer: () => Promise<{ ok: boolean; error?: string; regeneratedAt?: string }>;
};

// Mirror of the editor-store surface this task adds.
type EditorStore = {
  viewMode: 'preview' | 'editor' | 'split';
  flyToHubId: string | null;
  activeHubId: string | null;
  setViewMode: (m: 'preview' | 'editor' | 'split') => void;
  flyToHub: (hubId: string) => void;
};

const minimalHub: PrismHub = {
  hubId: 'home',
  type: 'application',
  intent: { caption: 'home' } as PrismIntent,
  layout: {
    viewport: 'desktop',
    grid: { columns: 12, gutter: 24 },
    arrangement: 'home-grid',
    viewportWidth: 1280,
    viewportHeight: 720,
  } as PrismHub['layout'],
  flowOrder: [],
};

const minimalNode = (id: string): PrismNode =>
  ({
    nodeId: id,
    parentHubId: 'home',
    subtype: 'element',
    serviceTag: 'static',
    intent: { caption: 'a node' } as PrismIntent,
    visual: {} as unknown as PrismNode['visual'],
    codeRef: null,
    backendRef: null,
    renderMode: 'sprite',
    depthMapUrl: null,
    meshUrl: null,
    cinematicPrimitives: [],
    scenePosition: {
      x: 0, y: 0, z: 0,
      rotationX: 0, rotationY: 0, rotationZ: 0,
      scaleX: 1, scaleY: 1, scaleZ: 1,
    },
  } as unknown as PrismNode);

const minimalSource = {
  schemaVersion: '0.1.0',
  hub: minimalHub,
  nodes: [minimalNode('home-greeting')],
  edges: [] as PrismEdge[],
};

beforeEach(async () => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HL12 — useGraphSourceStore.saveToServer (Inspector Save button)', () => {
  it('POSTs { action:"persist", graph } to /api/prism/regen and clears isDirty', async () => {
    const captured: { url?: string; init?: RequestInit } = {};
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      captured.url = url;
      captured.init = init;
      return new Response(
        JSON.stringify({ ok: true, regeneratedAt: '2026-05-06T12:00:00Z' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const { useGraphSourceStore } = (await import('@/stores/useGraphSourceStore')) as {
      useGraphSourceStore: { getState: () => SourceStore };
    };
    useGraphSourceStore.getState().load(minimalSource);
    // Mark dirty by mutating something the user would edit:
    // here we simulate by reading back and setting via store API.
    (useGraphSourceStore.getState() as SourceStore & { markDirty: (b?: boolean) => void }).markDirty(true);
    expect(useGraphSourceStore.getState().isDirty).toBe(true);

    const result = await useGraphSourceStore.getState().saveToServer();

    expect(result.ok).toBe(true);
    expect(result.regeneratedAt).toBe('2026-05-06T12:00:00Z');
    expect(captured.url).toBe('/api/prism/regen');
    expect(captured.init?.method).toBe('POST');
    const body = JSON.parse(String(captured.init?.body ?? '{}'));
    expect(body.action).toBe('persist');
    expect(body.graph?.hub?.hubId).toBe('home');
    expect(Array.isArray(body.graph?.nodes)).toBe(true);
    // Post-success state.
    expect(useGraphSourceStore.getState().isDirty).toBe(false);
    expect(useGraphSourceStore.getState().savedAt).toBe('2026-05-06T12:00:00Z');
  });

  it('reports an error when the server returns non-200', async () => {
    const fetchMock = vi.fn(async () => new Response('boom', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    const { useGraphSourceStore } = (await import('@/stores/useGraphSourceStore')) as {
      useGraphSourceStore: { getState: () => SourceStore };
    };
    useGraphSourceStore.getState().load(minimalSource);

    const result = await useGraphSourceStore.getState().saveToServer();
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/HTTP 500/);
  });
});

describe('HL12 — useGraphEditorStore.setViewMode (Preview in App UI button)', () => {
  it('exposes viewMode + setViewMode (default split)', async () => {
    const { useGraphEditorStore } = (await import('@/stores/useGraphEditorStore')) as {
      useGraphEditorStore: { getState: () => EditorStore };
    };
    expect(useGraphEditorStore.getState().viewMode).toBe('split');
    useGraphEditorStore.getState().setViewMode('preview');
    expect(useGraphEditorStore.getState().viewMode).toBe('preview');
    useGraphEditorStore.getState().setViewMode('editor');
    expect(useGraphEditorStore.getState().viewMode).toBe('editor');
  });

  it('Preview-in-App-UI driver: setViewMode("preview") + flyToHub(hubId)', async () => {
    const { useGraphEditorStore } = (await import('@/stores/useGraphEditorStore')) as {
      useGraphEditorStore: { getState: () => EditorStore };
    };
    const s = useGraphEditorStore.getState();
    s.setViewMode('preview');
    s.flyToHub('home');
    const after = useGraphEditorStore.getState();
    expect(after.viewMode).toBe('preview');
    expect(after.flyToHubId).toBe('home');
    expect(after.activeHubId).toBe('home');
  });
});

describe('HL12 — saveAndVerify wire shape (Save & Verify on VisualPreview)', () => {
  it('forwards codeModule into the verify-node body when supplied', async () => {
    const captured: { url?: string; init?: RequestInit } = {};
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      captured.url = url;
      captured.init = init;
      return new Response(
        JSON.stringify({ ok: true, verifierStatus: 'clean' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const node = minimalNode('home-cta');
    const result = await saveAndVerify(node, {
      fetch: fetchMock as unknown as typeof fetch,
      codeModule: "export default function createNode() { return new THREE.Group(); }",
    });

    expect(result.ok).toBe(true);
    expect(captured.url).toBe('/api/prism/regen');
    const body = JSON.parse(String(captured.init?.body ?? '{}'));
    expect(body.action).toBe('verify-node');
    expect(body.node?.nodeId).toBe('home-cta');
    expect(typeof body.codeModule).toBe('string');
    expect(body.codeModule.length).toBeGreaterThan(0);
  });
});
