// T04 — Codegen prompt construction.
//
// Spec: PRISM-RENDERER-MIGRATION-SPEC.md §9 L248-L355.
//   §9.A L250-L276 — Shared System Prompt (RadixAttention-cached).
//   §9.B L278-L322 — Per-Node User Prompt template.
//   §9.C L324-L354 — Render-mode-specific sub-prompts (sprite/plane/parallax-plane/mesh).
//
// The shared system prompt MUST be byte-identical across calls so RadixAttention
// produces a prefix cache hit. The per-node prompt encodes the spec's L286-L320
// fields verbatim. Render-mode sub-prompts MUST be appended only for the
// matching renderMode.

import { describe, expect, it } from 'vitest';
import {
  SHARED_SYSTEM_PROMPT,
  buildPerNodePrompt,
  buildRenderModeSubPrompt,
  buildCodegenPrompt,
} from '@/lib/prism/codegen/prompts';
import type { PrismNode } from '@/lib/prism-graph/types';

function fixtureNode(overrides: Partial<PrismNode> = {}): PrismNode {
  return {
    nodeId: 'hero-card',
    subtype: 'card',
    parentHubId: 'home',
    serviceTag: 'visual',
    visual: {
      sourceAsset: 'hero.png',
      transform: { x: 0, y: 0, width: 800, height: 600, z: 0 },
    },
    intent: {
      caption: 'Cinematic hero card with depth',
      behaviorSpec: {
        interactions: [{ event: 'click', effect: 'navigate:about' }],
        apiCalls: [],
        dataBindings: [],
        emits: [],
        listens: [],
        triggersDownstream: [],
      },
      stateEffects: [],
      visualSpec: {
        textContent: [
          {
            text: 'Welcome',
            role: 'headline',
            renderMethod: 'msdf',
            typography: { fontSize: 64, fontWeight: 700 } as any,
          } as any,
        ],
        layers: [],
      },
      contracts: { inputs: {}, outputs: {} },
    },
    codeRef: 'nodes/hero-card.ts',
    backendRef: null,
    renderMode: 'sprite',
    depthMapUrl: null,
    meshUrl: null,
    cinematicPrimitives: [
      { name: 'magnetic-cursor', params: { radius: 200 }, trigger: 'hover' },
    ],
    scenePosition: {
      x: 0,
      y: 1,
      z: -2,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    },
    ...overrides,
  } as PrismNode;
}

describe('SHARED_SYSTEM_PROMPT (spec §9.A L250-L276)', () => {
  it('is a non-empty string', () => {
    expect(typeof SHARED_SYSTEM_PROMPT).toBe('string');
    expect(SHARED_SYSTEM_PROMPT.length).toBeGreaterThan(200);
  });

  it('is byte-identical across calls (RadixAttention-cacheable, spec §9.A L275)', () => {
    // Spec L275: "This prompt is identical across all containers → RadixAttention
    // prefix cache hit". Re-importing must not produce a different string.
    expect(SHARED_SYSTEM_PROMPT).toBe(SHARED_SYSTEM_PROMPT);
  });

  it('lists the five allowed import sources verbatim (spec §9.A L257-L258)', () => {
    expect(SHARED_SYSTEM_PROMPT).toContain("'three/webgpu'");
    expect(SHARED_SYSTEM_PROMPT).toContain("'three/tsl'");
    expect(SHARED_SYSTEM_PROMPT).toContain("'gsap'");
    expect(SHARED_SYSTEM_PROMPT).toContain("'@/primitives'");
    expect(SHARED_SYSTEM_PROMPT).toContain("'@/text'");
  });

  it('declares the createNode signature exactly (spec §9.A L259)', () => {
    expect(SHARED_SYSTEM_PROMPT).toContain(
      'createNode(config: NodeConfig, ctx: NodeContext): THREE.Object3D',
    );
  });

  it('requires synchronous createNode (spec §9.A L260)', () => {
    expect(SHARED_SYSTEM_PROMPT).toMatch(/MUST be synchronous/);
  });

  it('requires every primitive be applied via ctx.primitives[name] (spec §9.A L262-L263)', () => {
    expect(SHARED_SYSTEM_PROMPT).toContain(
      'ctx.primitives[primitive.name](targetObject, primitive.params)',
    );
    expect(SHARED_SYSTEM_PROMPT).toMatch(/DO NOT inline primitive logic/);
  });

  it('requires text via ctx.fontAtlas, not TextGeometry/HTML (spec §9.A L264-L265)', () => {
    expect(SHARED_SYSTEM_PROMPT).toContain('ctx.fontAtlas');
    expect(SHARED_SYSTEM_PROMPT).toMatch(/never render text into Three\.js TextGeometry/);
  });

  it('requires event handlers attach to userData.handlers, not domElement (spec §9.A L266-L267)', () => {
    expect(SHARED_SYSTEM_PROMPT).toContain('userData.handlers');
    expect(SHARED_SYSTEM_PROMPT).toMatch(/never call\s*\n?\s*renderer\.domElement\.addEventListener/);
  });

  it('requires userData.cleanup() that disposes resources and kills GSAP timelines (spec §9.A L268-L269)', () => {
    expect(SHARED_SYSTEM_PROMPT).toMatch(/userData\.cleanup\(\)/);
    expect(SHARED_SYSTEM_PROMPT).toMatch(/disposes/);
    expect(SHARED_SYSTEM_PROMPT).toMatch(/GSAP timelines/);
  });

  it('forbids HTML/CSS/DOM and window.* except devicePixelRatio (spec §9.A L270)', () => {
    expect(SHARED_SYSTEM_PROMPT).toMatch(/DO NOT use HTML, CSS, the DOM/);
    expect(SHARED_SYSTEM_PROMPT).toMatch(/window\.devicePixelRatio/);
  });

  it('does NOT re-encode the rescinded primitives-cage shader line; TSL stays the only shader lane via the import allowlist (SPEC-INDEX S4 / canvas §2 decision 6)', () => {
    // The migration-era line "DO NOT author bespoke shader code — use TSL
    // through ctx.primitives or three/tsl built-ins" encoded the rescinded
    // no-bespoke-animation posture (animation/shading locked to the fixed
    // primitives library). PRISM-CANVAS-EDITOR-SPEC §2 decision 6 rescinds it
    // and SPEC-INDEX "pending code changes" §2 recorded the removal from
    // prompts.ts. Re-introducing the line is drift — this assertion fails if
    // it comes back.
    expect(SHARED_SYSTEM_PROMPT).not.toMatch(/DO NOT author bespoke shader code/);
    // TSL-only (PRISM-RUNTIME-SPEC §9, carried-forward renderer foundation)
    // is enforced structurally: the closed import allowlist names
    // 'three/tsl' as the shader lane. (A future prompt line forbidding raw
    // GLSL WITHOUT the ctx.primitives cage would be legitimate — this test
    // only pins the rescinded cage phrasing and the allowlist's presence.)
    expect(SHARED_SYSTEM_PROMPT).toContain("'three/tsl'");
    expect(SHARED_SYSTEM_PROMPT).toMatch(/Import only from:/);
  });

  it('output instruction: only JS code, no markdown fences (spec §9.A L273)', () => {
    expect(SHARED_SYSTEM_PROMPT).toMatch(/Only the JavaScript code/);
    expect(SHARED_SYSTEM_PROMPT).toMatch(/No markdown fences/);
  });
});

describe('buildPerNodePrompt (spec §9.B L278-L322)', () => {
  const node = fixtureNode();
  const neighbors = {
    parent: { id: 'home-hub', type: 'hub' },
    siblings: [{ id: 'cta-button', type: 'button' }],
    children: [],
  };
  const atlas = { atlasIndex: 0, x: 4, y: 8, width: 800, height: 600 };

  it('embeds ELEMENT SPECIFICATION caption (spec §9.B L283)', () => {
    const out = buildPerNodePrompt(node, neighbors, atlas);
    expect(out).toContain('ELEMENT SPECIFICATION');
    expect(out).toContain('Cinematic hero card with depth');
  });

  it('exposes RENDER MODE field (spec §9.B L285)', () => {
    const out = buildPerNodePrompt(node, neighbors, atlas);
    expect(out).toMatch(/RENDER MODE: sprite/);
  });

  it('lists imageUrl/depthMapUrl/meshUrl assets (spec §9.B L286-L290)', () => {
    const out = buildPerNodePrompt(
      fixtureNode({
        renderMode: 'mesh',
        meshUrl: 'https://cdn/mesh.glb',
        depthMapUrl: null,
      }),
      neighbors,
      atlas,
    );
    expect(out).toContain('imageUrl:');
    expect(out).toContain('depthMapUrl: (none)');
    expect(out).toContain('meshUrl: https://cdn/mesh.glb');
  });

  it('lists CINEMATIC PRIMITIVES TO APPLY with name + trigger + params (spec §9.B L308-L312)', () => {
    const out = buildPerNodePrompt(node, neighbors, atlas);
    expect(out).toContain('CINEMATIC PRIMITIVES TO APPLY');
    expect(out).toContain('magnetic-cursor');
    expect(out).toContain('hover');
    expect(out).toMatch(/radius/);
  });

  it('emits SCENE PLACEMENT block with x/y/z/rotation/scale (spec §9.B L301-L306)', () => {
    const out = buildPerNodePrompt(node, neighbors, atlas);
    expect(out).toContain('SCENE PLACEMENT');
    expect(out).toMatch(/Position: \(0, 1, -2\)/);
    expect(out).toMatch(/Rotation: \(0, 0, 0\)/);
    expect(out).toMatch(/Scale: \(1, 1, 1\)/);
  });

  it('lists TEXT CONTENT entries with role + typography (spec §9.B L294-L295)', () => {
    const out = buildPerNodePrompt(node, neighbors, atlas);
    expect(out).toContain('TEXT CONTENT');
    expect(out).toContain('Welcome');
    expect(out).toContain('headline');
    expect(out).toContain('64px');
  });

  it('lists NEIGHBORS Parent/Siblings/Children (spec §9.B L314-L317)', () => {
    const out = buildPerNodePrompt(node, neighbors, atlas);
    expect(out).toContain('NEIGHBORS');
    expect(out).toContain('Parent: home-hub');
    expect(out).toContain('cta-button');
  });

  it('lists ATLAS REGION fields (spec §9.B L319-L321)', () => {
    const out = buildPerNodePrompt(node, neighbors, atlas);
    expect(out).toContain('ATLAS REGION');
    expect(out).toMatch(/Atlas: 0/);
    expect(out).toMatch(/Source rect: 4, 8, 800, 600/);
  });
});

describe('buildRenderModeSubPrompt (spec §9.C L324-L354)', () => {
  it('sprite mode: billboard plane + atlas UVs + MeshBasicNodeMaterial (spec §9.C L326-L331)', () => {
    const sub = buildRenderModeSubPrompt('sprite');
    expect(sub).toMatch(/billboards toward the camera/);
    expect(sub).toMatch(/PlaneGeometry/);
    expect(sub).toMatch(/MeshBasicNodeMaterial/);
  });

  it('plane mode: explicit pose + MeshBasicNodeMaterial baseline (spec §9.C L334-L337)', () => {
    const sub = buildRenderModeSubPrompt('plane');
    expect(sub).toMatch(/explicit position\/rotation/);
    expect(sub).toMatch(/MeshBasicNodeMaterial/);
    expect(sub).toMatch(/MeshStandardNodeMaterial/);
  });

  it('parallax-plane mode: tessellated 64x64 + TSL displacement + cursor parallax (spec §9.C L340-L344)', () => {
    const sub = buildRenderModeSubPrompt('parallax-plane');
    expect(sub).toMatch(/displacement-mapped/);
    expect(sub).toMatch(/64x64/);
    expect(sub).toMatch(/TSL displacement/);
    expect(sub).toMatch(/cursor or camera movement/);
  });

  it('mesh mode: ctx.glbLoader + scenePosition + GLB textures (spec §9.C L347-L353)', () => {
    const sub = buildRenderModeSubPrompt('mesh');
    expect(sub).toMatch(/ctx\.glbLoader/);
    expect(sub).toMatch(/meshUrl/);
    expect(sub).toMatch(/PBR/);
  });
});

describe('buildCodegenPrompt (full assembled prompt)', () => {
  const node = fixtureNode();
  const neighbors = {
    parent: { id: 'home-hub', type: 'hub' },
    siblings: [],
    children: [],
  };
  const atlas = { atlasIndex: 0, x: 0, y: 0, width: 100, height: 100 };

  it('returns { system, user } where system === SHARED_SYSTEM_PROMPT', () => {
    const out = buildCodegenPrompt(node, neighbors, atlas);
    expect(out.system).toBe(SHARED_SYSTEM_PROMPT);
  });

  it('user prompt contains the per-node block AND the matching render-mode sub-prompt', () => {
    const out = buildCodegenPrompt(
      fixtureNode({ renderMode: 'parallax-plane', depthMapUrl: 'd.png' }),
      neighbors,
      atlas,
    );
    expect(out.user).toContain('RENDER MODE: parallax-plane');
    expect(out.user).toMatch(/64x64/);
  });

  it('user prompt does NOT include sub-prompts for OTHER render modes', () => {
    const out = buildCodegenPrompt(
      fixtureNode({ renderMode: 'sprite' }),
      neighbors,
      atlas,
    );
    expect(out.user).not.toMatch(/displacement-mapped/);
    expect(out.user).not.toMatch(/ctx\.glbLoader/);
  });
});
