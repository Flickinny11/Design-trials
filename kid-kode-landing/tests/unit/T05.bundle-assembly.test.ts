// T05 — Bundle assembly (spec §11 L389-L445).
//
// `assembleBundle(graph)` MUST emit the file map prescribed by §11 — app.js,
// graph.json, shared/{manager,adapter,state,scene-root,loaders,text}.js,
// shared/primitives/index.js + 9 primitive files, shared/shaders/*.tsl.js
// (6 files), and per-node `nodes/{nodeId}.js` entries.
//
// `buildImportMap()` MUST emit the importmap prescribed by §11 L431-L443 —
// three / three/webgpu / three/tsl / three/addons/ / gsap from a CDN, no pixi.
//
// Acceptance: §17 DoD #1 ("zero PixiJS imports verified by grep -r 'pixi'
// bundle/") — every emitted source string MUST be free of `from 'pixi*'`.

import { describe, expect, it } from 'vitest';
import { assembleBundle, buildImportMap } from '@/lib/prism/runtime/bundle';
import type { CompiledGraph } from '@/lib/prism/runtime/bundle';

function fixtureGraph(): CompiledGraph {
  return {
    version: '1.0',
    hubs: [
      {
        hubId: 'home',
        title: 'Home',
        layout: { viewportWidth: 1920, viewportHeight: 1080, contentHeight: 2400, backgroundColor: '#000000' },
      },
    ],
    nodes: [
      {
        nodeId: 'hero-card',
        subtype: 'card',
        parentHubId: 'home',
        serviceTag: 'visual',
        visual: { transform: { x: 0, y: 0, width: 800, height: 600, z: 0 } },
        intent: { caption: 'Hero card' },
        codeRef: 'nodes/hero-card.js',
      },
      {
        nodeId: 'cta-button',
        subtype: 'button',
        parentHubId: 'home',
        serviceTag: 'visual',
        visual: { transform: { x: 100, y: 700, width: 200, height: 60, z: 1 } },
        intent: { caption: 'CTA' },
        codeRef: 'nodes/cta-button.js',
      },
    ],
    edges: [],
  };
}

describe('T05 — assembleBundle (spec §11 L389-L445)', () => {
  const graph = fixtureGraph();
  const files = assembleBundle(graph);

  describe('top-level entries', () => {
    it('emits app.js entry point', () => {
      expect(typeof files['app.js']).toBe('string');
      expect(files['app.js']!.length).toBeGreaterThan(0);
    });

    it('emits graph.json with serialized graph', () => {
      const parsed = JSON.parse(files['graph.json']!);
      expect(parsed).toEqual(graph);
    });
  });

  describe('shared scene infrastructure (§11 L398-L405)', () => {
    it('emits shared/manager.js (THREE.Group hub manager)', () => {
      expect(typeof files['shared/manager.js']).toBe('string');
      expect(files['shared/manager.js']!.length).toBeGreaterThan(0);
    });

    it('emits shared/adapter.js (graph → THREE scene tree adapter)', () => {
      expect(typeof files['shared/adapter.js']).toBe('string');
    });

    it('emits shared/state.js', () => {
      expect(typeof files['shared/state.js']).toBe('string');
    });

    it('emits shared/scene-root.js (camera + lights + render loop)', () => {
      expect(typeof files['shared/scene-root.js']).toBe('string');
    });

    it('emits shared/loaders.js (TextureLoader + GLTFLoader cache)', () => {
      expect(typeof files['shared/loaders.js']).toBe('string');
    });

    it('emits shared/text.js (MSDF font atlas + render helpers)', () => {
      expect(typeof files['shared/text.js']).toBe('string');
    });
  });

  describe('cinematic primitives (§11 L406-L415, 9 files)', () => {
    it('emits shared/primitives/index.js (registry entrypoint)', () => {
      expect(typeof files['shared/primitives/index.js']).toBe('string');
    });

    const primitives = [
      'orbit',
      'depth-rotate',
      'dissolve-morph',
      'displacement-transition',
      'parallax-scroll',
      'magnetic-cursor',
      'particle-emerge',
      'fly-through',
      'kinetic-text',
    ];
    for (const name of primitives) {
      it(`emits shared/primitives/${name}.js`, () => {
        expect(typeof files[`shared/primitives/${name}.js`]).toBe('string');
        expect(files[`shared/primitives/${name}.js`]!.length).toBeGreaterThan(0);
      });
    }
  });

  describe('TSL shaders (§11 L416-L421, 6 files)', () => {
    const shaders = [
      'displacement',
      'dissolve',
      'voronoi-particle',
      'twisted-wave',
      'radial-blur',
      'rgb-shift',
    ];
    for (const name of shaders) {
      it(`emits shared/shaders/${name}.tsl.js`, () => {
        expect(typeof files[`shared/shaders/${name}.tsl.js`]).toBe('string');
        expect(files[`shared/shaders/${name}.tsl.js`]!.length).toBeGreaterThan(0);
      });
    }
  });

  describe('per-node code (§11 L424-L425)', () => {
    it('emits nodes/hero-card.js for each graph node', () => {
      expect(typeof files['nodes/hero-card.js']).toBe('string');
      expect(typeof files['nodes/cta-button.js']).toBe('string');
    });
  });

  describe('§17 DoD #1 — zero PixiJS in bundle', () => {
    it('no emitted file imports from pixi.js, pixi-filters, or @pixi/*', () => {
      for (const [path, source] of Object.entries(files)) {
        expect(source, `${path} contains pixi import`).not.toMatch(
          /from\s+['"](?:pixi\.js|pixi-filters|@pixi\/[\w-]+)['"]/,
        );
      }
    });

    it('no emitted file references the PIXI global as a typeof import', () => {
      for (const [path, source] of Object.entries(files)) {
        expect(source, `${path} references typeof import('pixi.js')`).not.toMatch(
          /typeof\s+import\(['"]pixi/,
        );
      }
    });
  });
});

describe('T05 — buildImportMap (spec §11 L431-L443)', () => {
  const importmap = buildImportMap();

  it('exposes three from a CDN', () => {
    expect(importmap.imports.three).toMatch(/three@/);
  });

  it('exposes three/webgpu (the runtime entrypoint)', () => {
    expect(importmap.imports['three/webgpu']).toMatch(/three\.webgpu\.js/);
  });

  it('exposes three/tsl (shader DSL)', () => {
    expect(importmap.imports['three/tsl']).toMatch(/three\.tsl\.js/);
  });

  it('exposes three/addons/ (jsm prefix)', () => {
    expect(importmap.imports['three/addons/']).toMatch(/examples\/jsm\//);
  });

  it('exposes gsap', () => {
    expect(importmap.imports.gsap).toMatch(/gsap@/);
  });

  it('does NOT expose pixi (§15 — removed)', () => {
    const json = JSON.stringify(importmap);
    expect(json).not.toMatch(/pixi/i);
  });
});
