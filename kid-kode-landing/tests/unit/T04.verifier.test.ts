// T04 — Static verifier (spec §10 L357-L386).
//
// §10.A L361-L367 — ALLOWED_THREE_IMPORTS list (19 names from `three/webgpu`).
// §10.B L369-L377 — DISALLOWED regex patterns (PixiJS / DOM / window /
//                   innerHTML / TextGeometry / addEventListener / async createNode).
// §10.C L380-L385 — Render-mode-aware structural rules.
//
// The verifier is deterministic, line-aware, and accepts a `renderMode` so it
// can apply the correct mode-specific rules.

import { describe, expect, it } from 'vitest';
import {
  verifyNodeModule,
  ALLOWED_THREE_IMPORTS,
  ALLOWED_IMPORT_SOURCES,
  DISALLOWED_PATTERNS,
} from '@/lib/prism/codegen/verifier';

const SPEC_COMPLIANT_SPRITE = `
import { Group, Mesh, PlaneGeometry, MeshBasicNodeMaterial } from 'three/webgpu';

export default function createNode(config, ctx) {
  const group = new Group();
  group.userData.handlers = {};
  for (const primitive of config.cinematicPrimitives ?? []) {
    ctx.primitives[primitive.name](group, primitive.params);
  }
  for (const text of config.textContent ?? []) {
    if (!text || !text.text) continue;
    const t = ctx.fontAtlas.createText({ text: text.text });
    group.add(t);
  }
  group.userData.cleanup = () => {};
  return group;
}
`;

const SPEC_COMPLIANT_PARALLAX = `
import { Group, Mesh, PlaneGeometry, MeshStandardNodeMaterial } from 'three/webgpu';
import { displacement } from '@/primitives';

export default function createNode(config, ctx) {
  const group = new Group();
  group.userData.handlers = {};
  const geo = new PlaneGeometry(1, 1, 64, 64);
  const mat = new MeshStandardNodeMaterial();
  mat.displacementMap = ctx.textureLoader.loadTexture(config.depthMapUrl);
  group.add(new Mesh(geo, mat));
  for (const primitive of config.cinematicPrimitives ?? []) {
    ctx.primitives[primitive.name](group, primitive.params);
  }
  for (const text of config.textContent ?? []) {
    if (!text || !text.text) continue;
    group.add(ctx.fontAtlas.createText({ text: text.text }));
  }
  group.userData.cleanup = () => {};
  return group;
}
`;

const SPEC_COMPLIANT_MESH = `
import { Group } from 'three/webgpu';

export default function createNode(config, ctx) {
  const group = new Group();
  group.userData.handlers = {};
  ctx.glbLoader.load(config.meshUrl, (gltf) => {
    group.add(gltf.scene);
  });
  for (const primitive of config.cinematicPrimitives ?? []) {
    ctx.primitives[primitive.name](group, primitive.params);
  }
  for (const text of config.textContent ?? []) {
    if (!text || !text.text) continue;
    group.add(ctx.fontAtlas.createText({ text: text.text }));
  }
  group.userData.cleanup = () => {};
  return group;
}
`;

describe('verifier — exported constants (spec §10.A/B)', () => {
  it('ALLOWED_THREE_IMPORTS contains all 19 names from spec §10 L362-L367', () => {
    const expected = [
      'Object3D', 'Group', 'Mesh', 'PlaneGeometry', 'BoxGeometry', 'SphereGeometry',
      'TextureLoader', 'GLTFLoader', 'Vector2', 'Vector3', 'Quaternion', 'Euler',
      'MeshBasicNodeMaterial', 'MeshStandardNodeMaterial', 'AmbientLight', 'DirectionalLight',
      'Color', 'Raycaster', 'Box3', 'Sphere',
    ];
    for (const name of expected) {
      expect(ALLOWED_THREE_IMPORTS).toContain(name);
    }
  });

  it('ALLOWED_IMPORT_SOURCES exposes the 5 codegen specifiers (spec §9.A L257-L258)', () => {
    expect(ALLOWED_IMPORT_SOURCES).toContain('three/webgpu');
    expect(ALLOWED_IMPORT_SOURCES).toContain('three/tsl');
    expect(ALLOWED_IMPORT_SOURCES).toContain('gsap');
    expect(ALLOWED_IMPORT_SOURCES).toContain('@/primitives');
    expect(ALLOWED_IMPORT_SOURCES).toContain('@/text');
  });

  it('DISALLOWED_PATTERNS includes the 7 §10.B regex rules', () => {
    const ruleNames = DISALLOWED_PATTERNS.map((p) => p.rule);
    expect(ruleNames).toContain('PIXI_IMPORT');
    expect(ruleNames).toContain('DOCUMENT_ACCESS');
    expect(ruleNames).toContain('WINDOW_ACCESS');
    expect(ruleNames).toContain('INNER_HTML');
    expect(ruleNames).toContain('TEXT_GEOMETRY');
    expect(ruleNames).toContain('ADD_EVENT_LISTENER');
    expect(ruleNames).toContain('ASYNC_CREATE_NODE');
  });
});

describe('verifier — accepts spec-compliant code', () => {
  it('passes a sprite-mode module', () => {
    const r = verifyNodeModule(SPEC_COMPLIANT_SPRITE, { renderMode: 'sprite' });
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it('passes a parallax-plane module that references displacementMap (spec §10.C L382)', () => {
    const r = verifyNodeModule(SPEC_COMPLIANT_PARALLAX, { renderMode: 'parallax-plane' });
    expect(r.ok).toBe(true);
  });

  it('passes a mesh module that calls ctx.glbLoader.load (spec §10.C L383)', () => {
    const r = verifyNodeModule(SPEC_COMPLIANT_MESH, { renderMode: 'mesh' });
    expect(r.ok).toBe(true);
  });
});

describe('verifier — rejects deviations (§10.B regex rules)', () => {
  it('rejects PixiJS imports (spec §10.B L370)', () => {
    const src = `
      import * as PIXI from 'pixi.js';
      export default function createNode(config, ctx) {
        const g = new PIXI.Container();
        return g;
      }
    `;
    const r = verifyNodeModule(src, { renderMode: 'sprite' });
    expect(r.ok).toBe(false);
    expect(r.violations.find((v) => v.rule === 'PIXI_IMPORT')).toBeTruthy();
  });

  it('rejects general document.* access (spec §10.B L371)', () => {
    const src = `
      export default function createNode(config, ctx) {
        document.body.innerText = 'hi';
        return null;
      }
    `;
    const r = verifyNodeModule(src, { renderMode: 'sprite' });
    expect(r.ok).toBe(false);
    expect(r.violations.find((v) => v.rule === 'DOCUMENT_ACCESS')).toBeTruthy();
  });

  it('allows document.getElementById per §10.B L371 negative lookahead', () => {
    const src = `
      ${SPEC_COMPLIANT_SPRITE}
      // intentional reference: const el = document.getElementById('x');
    `;
    const r = verifyNodeModule(src, { renderMode: 'sprite' });
    expect(r.violations.find((v) => v.rule === 'DOCUMENT_ACCESS')).toBeFalsy();
  });

  it('rejects window.* except devicePixelRatio (spec §10.B L372)', () => {
    const src = `
      export default function createNode(config, ctx) {
        const url = window.location.href;
        return null;
      }
    `;
    const r = verifyNodeModule(src, { renderMode: 'sprite' });
    expect(r.ok).toBe(false);
    expect(r.violations.find((v) => v.rule === 'WINDOW_ACCESS')).toBeTruthy();
  });

  it('allows window.devicePixelRatio (spec §10.B L372)', () => {
    const src = `
      ${SPEC_COMPLIANT_SPRITE}
      // intentional: const dpr = window.devicePixelRatio;
    `;
    const r = verifyNodeModule(src, { renderMode: 'sprite' });
    expect(r.violations.find((v) => v.rule === 'WINDOW_ACCESS')).toBeFalsy();
  });

  it('rejects innerHTML (spec §10.B L373)', () => {
    const src = `
      export default function createNode(config, ctx) {
        const el = {};
        el.innerHTML = '<b>x</b>';
        return null;
      }
    `;
    const r = verifyNodeModule(src, { renderMode: 'sprite' });
    expect(r.violations.find((v) => v.rule === 'INNER_HTML')).toBeTruthy();
  });

  it('rejects TextGeometry (spec §10.B L374)', () => {
    const src = `
      import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
      export default function createNode(config, ctx) {
        const g = new TextGeometry();
        return null;
      }
    `;
    const r = verifyNodeModule(src, { renderMode: 'sprite' });
    expect(r.violations.find((v) => v.rule === 'TEXT_GEOMETRY')).toBeTruthy();
  });

  it('rejects .addEventListener( (spec §10.B L375)', () => {
    const src = `
      export default function createNode(config, ctx) {
        ctx.renderer.domElement.addEventListener('click', () => {});
        return null;
      }
    `;
    const r = verifyNodeModule(src, { renderMode: 'sprite' });
    expect(r.violations.find((v) => v.rule === 'ADD_EVENT_LISTENER')).toBeTruthy();
  });

  it('rejects async createNode (spec §10.B L376)', () => {
    const src = `
      export default async function createNode(config, ctx) {
        return null;
      }
    `;
    const r = verifyNodeModule(src, { renderMode: 'sprite' });
    expect(r.violations.find((v) => v.rule === 'ASYNC_CREATE_NODE')).toBeTruthy();
  });
});

describe('verifier — render-mode structural rules (§10.C L380-L385)', () => {
  it('parallax-plane WITHOUT displacementMap or TSL displacement → flagged (L382)', () => {
    const src = `
      import { Group } from 'three/webgpu';
      export default function createNode(config, ctx) {
        const g = new Group();
        for (const p of config.cinematicPrimitives ?? []) {
          ctx.primitives[p.name](g, p.params);
        }
        for (const t of config.textContent ?? []) {
          if (t && t.text) g.add(ctx.fontAtlas.createText({ text: t.text }));
        }
        g.userData.cleanup = () => {};
        return g;
      }
    `;
    const r = verifyNodeModule(src, { renderMode: 'parallax-plane' });
    expect(r.ok).toBe(false);
    expect(
      r.violations.find((v) => v.rule === 'MISSING_DISPLACEMENT'),
    ).toBeTruthy();
  });

  it('mesh WITHOUT ctx.glbLoader.load → flagged (L383)', () => {
    const src = `
      import { Group } from 'three/webgpu';
      export default function createNode(config, ctx) {
        const g = new Group();
        for (const p of config.cinematicPrimitives ?? []) {
          ctx.primitives[p.name](g, p.params);
        }
        for (const t of config.textContent ?? []) {
          if (t && t.text) g.add(ctx.fontAtlas.createText({ text: t.text }));
        }
        g.userData.cleanup = () => {};
        return g;
      }
    `;
    const r = verifyNodeModule(src, { renderMode: 'mesh' });
    expect(r.ok).toBe(false);
    expect(
      r.violations.find((v) => v.rule === 'MISSING_GLB_LOADER'),
    ).toBeTruthy();
  });

  it('all modes: missing config.cinematicPrimitives iteration → flagged (L384)', () => {
    const src = `
      import { Group } from 'three/webgpu';
      export default function createNode(config, ctx) {
        const g = new Group();
        for (const t of config.textContent ?? []) {
          if (t && t.text) g.add(ctx.fontAtlas.createText({ text: t.text }));
        }
        g.userData.cleanup = () => {};
        return g;
      }
    `;
    const r = verifyNodeModule(src, { renderMode: 'sprite' });
    expect(r.ok).toBe(false);
    expect(
      r.violations.find((v) => v.rule === 'MISSING_PRIMITIVES_LOOP'),
    ).toBeTruthy();
  });

  it('all modes: missing config.textContent + ctx.fontAtlas → flagged when hasTextContent (L385)', () => {
    const src = `
      import { Group } from 'three/webgpu';
      export default function createNode(config, ctx) {
        const g = new Group();
        for (const p of config.cinematicPrimitives ?? []) {
          ctx.primitives[p.name](g, p.params);
        }
        g.userData.cleanup = () => {};
        return g;
      }
    `;
    const r = verifyNodeModule(src, { renderMode: 'sprite', hasTextContent: true });
    expect(r.ok).toBe(false);
    expect(r.violations.find((v) => v.rule === 'MISSING_TEXT_CONTENT')).toBeTruthy();
  });

  it('missing userData.cleanup → flagged (L386)', () => {
    const src = `
      import { Group } from 'three/webgpu';
      export default function createNode(config, ctx) {
        const g = new Group();
        for (const p of config.cinematicPrimitives ?? []) {
          ctx.primitives[p.name](g, p.params);
        }
        for (const t of config.textContent ?? []) {
          if (t && t.text) g.add(ctx.fontAtlas.createText({ text: t.text }));
        }
        return g;
      }
    `;
    const r = verifyNodeModule(src, { renderMode: 'sprite' });
    expect(r.ok).toBe(false);
    expect(r.violations.find((v) => v.rule === 'MISSING_CLEANUP')).toBeTruthy();
  });
});

describe('verifier — line numbers attached to violations', () => {
  it('reports the line number of a PIXI_IMPORT violation', () => {
    const src = [
      'import { Group } from "three/webgpu";',
      "import * as PIXI from 'pixi.js';",
      'export default function createNode() { return null; }',
    ].join('\n');
    const r = verifyNodeModule(src, { renderMode: 'sprite' });
    const v = r.violations.find((x) => x.rule === 'PIXI_IMPORT');
    expect(v?.line).toBe(2);
  });
});
