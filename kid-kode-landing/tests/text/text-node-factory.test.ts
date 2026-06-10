// Text System P1/W2 (Task A) — renderMode:'text' in the unified scene
// (canvas-spec criterion 26 core).
//
//   - buildTextNode returns a shape useGraphSourceStore.addNode accepts
//     (renderMode 'text', textSpec defaults, §7.6 self-caption).
//   - defaultRenderModeFactory's 'text' branch builds glyph-* unit meshes
//     from an injected preloaded atlas (real Inter metrics + stub Texture —
//     same fixture pattern as text-object.test.ts).
//   - cleanup() disposes unit geometries but NEVER the shared atlas texture.
//   - setSpec via group.userData.textHandle re-renders IN PLACE (same Group
//     identity — criterion 26: no artifact re-render).
//   - cold-cache path: the group populates when resolveAtlas lands, and a
//     cleanup() issued before the resolve cancels the mount.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { Group, Mesh, Texture, type Object3D } from 'three';
import { buildTextNode, textNodeCaption } from '@/lib/prism/text/create-text-node';
import { defaultRenderModeFactory } from '@/lib/prism/runtime/factories/default-factory';
import { setTextAtlasRegistry } from '@/lib/prism/runtime/shared/text-atlas';
import { TEXT_OBJECT_NAME, textUnitName } from '@/lib/prism/text/contract';
import type {
  FontRegistry,
  LoadedFontAtlas,
  MsdfFontData,
} from '@/lib/prism/text/contract';
import { TEXT_SPEC_DEFAULT, type PrismNode } from '@/lib/prism-graph/types';
import { applyPlanRendererDefaults } from '@/lib/prism/codegen/plan-output-hook';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import type { NodeContext } from '@/lib/prism/runtime/shared/adapter';

const data = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../public/prism-assets/font-inter.msdf.json', import.meta.url)),
    'utf8',
  ),
) as MsdfFontData;

function makeAtlas(): LoadedFontAtlas {
  return { family: 'Inter', weight: 400, texture: new Texture(), data, source: 'core' };
}

/** Stub registry with a warm cache — the factory's peek path hits. */
function warmRegistry(atlas: LoadedFontAtlas): FontRegistry {
  return {
    listFonts: async () => [],
    resolveAtlas: async () => atlas,
    peekAtlas: () => atlas,
    dispose: () => {},
  };
}

/** Stub registry with a COLD cache — peek misses; resolve is deferred until
 *  the test releases it. */
function coldRegistry(atlas: LoadedFontAtlas): { registry: FontRegistry; release: () => void } {
  let releaseFn: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    releaseFn = resolve;
  });
  return {
    registry: {
      listFonts: async () => [],
      resolveAtlas: async () => {
        await gate;
        return atlas;
      },
      peekAtlas: () => undefined,
      dispose: () => {},
    },
    release: releaseFn,
  };
}

/** Minimal NodeContext (mirrors tests/integration/default-factory fixture). */
function makeCtx(): NodeContext {
  return {
    THREE: THREE as NodeContext['THREE'],
    textureLoader: {
      loadTexture: async () => new Texture(),
    } as unknown as NodeContext['textureLoader'],
    glbLoader: {
      loadGLB: async () => ({ scene: new Group() }),
    } as unknown as NodeContext['glbLoader'],
    fontAtlas: {
      ready: true,
      load: async () => {},
      createText: (content: string) => {
        const g = new Group();
        g.name = `text:${content}`;
        return g;
      },
      dispose: () => {},
    } as unknown as NodeContext['fontAtlas'],
    primitives: {} as NodeContext['primitives'],
    emit: () => {},
  };
}

/** A full PrismNode for the factory, built from the frozen helper's output. */
function makeTextNode(content?: string, nodeId = 'text-1'): PrismNode {
  const seeded = applyPlanRendererDefaults({
    ...buildTextNode({ parentHubId: 'home-hub', ...(content !== undefined ? { content } : {}) }),
    nodeId,
  });
  return seeded as PrismNode;
}

function textObjectOf(group: Object3D): Object3D | undefined {
  return group.children.find((c) => c.name === TEXT_OBJECT_NAME);
}

afterEach(() => {
  setTextAtlasRegistry(null);
  useGraphSourceStore.getState().reset();
});

describe('buildTextNode (frozen helper)', () => {
  it('returns the renderMode:text node shape with textSpec defaults', () => {
    const input = buildTextNode({ parentHubId: 'home-hub' });
    expect(input.parentHubId).toBe('home-hub');
    expect(input.renderMode).toBe('text');
    expect(input.subtype).toBe('text');
    // Spawn defaults (advocate MUST-FIX 2026-06-10): schema defaults except
    // the fill, which spawns as legible DS ink over the light hub viewport
    // (TEXT_SPEC_DEFAULT's warm-white measured ~1.48:1 there).
    expect(input.textSpec).toEqual({
      ...TEXT_SPEC_DEFAULT,
      fill: { kind: 'solid', color: '#1d212b' },
    });
    expect(input.codeRef).toBe('');
    expect(input.backendRef).toBeNull();
    expect(input.serviceTag).toBe('main');
    expect(input.visual?.transform).toBeDefined();
    // The TextObject IS the text artifact — the §13 runtime-label loop must
    // not double-render, so textContent stays empty.
    expect(input.intent?.visualSpec?.textContent).toEqual([]);
    expect(input.intent?.behaviorSpec?.interactions).toEqual([]);
  });

  it('self-captions from its properties per §7.6', () => {
    expect(buildTextNode({ parentHubId: 'h', content: 'Hello' }).intent?.caption).toBe(
      'Text: "Hello" (Inter 400)',
    );
    // Default content
    expect(buildTextNode({ parentHubId: 'h' }).intent?.caption).toBe('Text: "Text" (Inter 400)');
    expect(textNodeCaption({ content: 'Hi', fontFamily: 'Lora', fontWeight: 700 })).toBe(
      'Text: "Hi" (Lora 700)',
    );
  });

  it('content overrides the default string without clobbering other defaults', () => {
    const input = buildTextNode({ parentHubId: 'h', content: 'PRISM' });
    expect(input.textSpec?.content).toBe('PRISM');
    expect(input.textSpec?.fontFamily).toBe(TEXT_SPEC_DEFAULT.fontFamily);
    expect(input.textSpec?.fontSize).toBe(TEXT_SPEC_DEFAULT.fontSize);
  });

  it('is accepted by useGraphSourceStore.addNode and seeds renderer defaults', () => {
    const store = useGraphSourceStore.getState();
    const nodeId = store.addNode(buildTextNode({ parentHubId: 'home-hub', content: 'Hello' }));
    const node = useGraphSourceStore.getState().nodes.find((n) => n.nodeId === nodeId);
    expect(node).toBeDefined();
    expect(node!.renderMode).toBe('text');
    expect(node!.textSpec?.content).toBe('Hello');
    // applyPlanRendererDefaults ran: identity pose, no primitives, and text
    // defaults UNLIT (receivesLightingDefault('text') === false).
    // Spawn placement (advocate MUST-FIX 2026-06-10): clear lower-center
    // band, nudged toward camera — never occluded behind the hub's center.
    expect(node!.scenePosition).toMatchObject({ x: 0, y: -0.8, z: 0.2, scaleX: 1 });
    expect(node!.cinematicPrimitives).toEqual([]);
    expect(node!.receivesLighting).toBe(false);
  });
});

describe("defaultRenderModeFactory renderMode:'text'", () => {
  it('builds glyph-* unit meshes synchronously from a cached atlas', () => {
    const atlas = makeAtlas();
    setTextAtlasRegistry(warmRegistry(atlas));
    const group = defaultRenderModeFactory(makeTextNode('PRISM'), makeCtx());

    expect(group.userData.nodeId).toBe('text-1');
    const textObj = textObjectOf(group);
    expect(textObj).toBeDefined();
    expect(textObj!.children).toHaveLength(5); // P R I S M
    textObj!.children.forEach((child, i) => {
      expect(child.name).toBe(textUnitName(i));
      expect((child as Mesh).isMesh).toBe(true);
    });
    expect(group.userData.textHandle).toBeDefined();
    expect(group.userData.textHandle.units).toHaveLength(5);
  });

  it('applies scenePosition to the returned group generically', () => {
    setTextAtlasRegistry(warmRegistry(makeAtlas()));
    const node = makeTextNode('Hi');
    node.scenePosition = {
      x: 3, y: -2, z: 1,
      rotationX: 0, rotationY: 0, rotationZ: 0,
      scaleX: 2, scaleY: 2, scaleZ: 2,
    };
    const group = defaultRenderModeFactory(node, makeCtx());
    expect(group.position.toArray()).toEqual([3, -2, 1]);
    expect(group.scale.toArray()).toEqual([2, 2, 2]);
  });

  it('cleanup() disposes unit geometries but NOT the shared atlas texture', () => {
    const atlas = makeAtlas();
    const atlasDispose = vi.spyOn(atlas.texture, 'dispose');
    setTextAtlasRegistry(warmRegistry(atlas));
    const group = defaultRenderModeFactory(makeTextNode('PRISM'), makeCtx());
    const handle = group.userData.textHandle;
    const geoDisposes = handle.units.map((m: Mesh) => vi.spyOn(m.geometry, 'dispose'));
    const matDisposes = handle.units.map((m: Mesh) =>
      vi.spyOn(m.material as THREE.Material, 'dispose'),
    );

    (group.userData.cleanup as () => void)();

    for (const spy of geoDisposes) expect(spy).toHaveBeenCalled();
    for (const spy of matDisposes) expect(spy).toHaveBeenCalled();
    expect(atlasDispose).not.toHaveBeenCalled();
    expect(handle.object.children).toHaveLength(0);
  });

  it('setSpec via userData.textHandle re-renders IN PLACE (criterion 26)', () => {
    setTextAtlasRegistry(warmRegistry(makeAtlas()));
    const group = defaultRenderModeFactory(makeTextNode('PRISM'), makeCtx());
    const handle = group.userData.textHandle;
    const inner = handle.object;

    handle.setSpec({ ...TEXT_SPEC_DEFAULT, content: 'PR' });

    expect(handle.object).toBe(inner); // SAME Group identity
    expect(inner.parent).toBe(group); // still mounted in the factory group
    expect(handle.units).toHaveLength(2);
    expect(inner.children.map((c: Object3D) => c.name)).toEqual([
      textUnitName(0),
      textUnitName(1),
    ]);
  });

  it('cold cache: group populates when resolveAtlas lands', async () => {
    const { registry, release } = coldRegistry(makeAtlas());
    setTextAtlasRegistry(registry);
    const group = defaultRenderModeFactory(makeTextNode('Hi'), makeCtx());

    expect(textObjectOf(group)).toBeUndefined(); // sync return, atlas pending
    release();
    await new Promise((r) => setTimeout(r, 0));
    expect(textObjectOf(group)).toBeDefined();
    expect(group.userData.textHandle.units).toHaveLength(2);
  });

  it('cold cache: cleanup() before the resolve cancels the mount', async () => {
    const { registry, release } = coldRegistry(makeAtlas());
    setTextAtlasRegistry(registry);
    const group = defaultRenderModeFactory(makeTextNode('Hi'), makeCtx());

    (group.userData.cleanup as () => void)();
    release();
    await new Promise((r) => setTimeout(r, 0));
    expect(textObjectOf(group)).toBeUndefined();
    expect(group.userData.textHandle).toBeUndefined();
  });
});
