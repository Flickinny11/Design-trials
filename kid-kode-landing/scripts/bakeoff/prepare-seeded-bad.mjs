#!/usr/bin/env node
// W-BAKE D4 — seeded known-bad renders (wave prompt #14): six hand-authored
// node modules, each committing a DELIBERATE Design-Law violation, rendered
// through the SAME harness as contestant output. They anchor the bottom of
// the golden set so critic candidates are tested on detection, not just
// ranking healthy renders.
//
// Violations (one per module, named in the id):
//   bad-1-flat-void        — DL16: a flat featureless near-black void.
//   bad-2-all-black-button — DL12/DL2: an all-black unreadable button blob.
//   bad-3-default-blue     — DL9/DL2: default-blue bootstrap drift.
//   bad-4-dead-lighting    — DL10/DL11: unlit gray box, no materiality.
//   bad-5-broken-composition — spatial composition broken: off-frame pile-up.
//   bad-6-garbled-text     — INV-R11 tell: fake letterforms as noise bars.
//
// Bundled with the sceneSpec of a matched visual case so framing is fair.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from './contestants.mjs';

const require_ = createRequire(import.meta.url);
const esbuild = require_(path.join(ROOT, 'node_modules', 'esbuild'));

const VISUAL = path.join(ROOT, 'notes', 'bakeoff', 'corpus', 'visual');
const BUNDLES_DIR = path.join(ROOT, 'notes', 'bakeoff', 'renders', 'bundles', 'seeded-bad');

const caseOf = (id) => JSON.parse(readFileSync(path.join(VISUAL, 'cases', `${id}.json`), 'utf8'));

const MODULES = {
  'bad-1-flat-void': {
    caseId: 'v-19-empty-state',
    src: `
import { Group, Mesh, PlaneGeometry, MeshBasicNodeMaterial, Color } from 'three/webgpu';
export default function createNode(config, ctx) {
  const g = new Group();
  const m = new Mesh(new PlaneGeometry(6, 4), new MeshBasicNodeMaterial());
  m.material.color = new Color('#0c0c0e');
  g.add(m);
  g.userData.handlers = {};
  g.userData.cleanup = () => { m.geometry.dispose(); m.material.dispose(); };
  return g;
}`,
  },
  'bad-2-all-black-button': {
    caseId: 'v-11-gradient-cta',
    src: `
import { Group, Mesh, BoxGeometry, MeshBasicNodeMaterial, Color } from 'three/webgpu';
export default function createNode(config, ctx) {
  const g = new Group();
  const btn = new Mesh(new BoxGeometry(2.4, 0.7, 0.1), new MeshBasicNodeMaterial());
  btn.material.color = new Color('#000000');
  g.add(btn);
  const label = new Mesh(new BoxGeometry(1.6, 0.18, 0.02), new MeshBasicNodeMaterial());
  label.material.color = new Color('#0a0a0a');
  label.position.z = 0.06;
  g.add(label);
  g.userData.handlers = {};
  g.userData.cleanup = () => { btn.geometry.dispose(); btn.material.dispose(); label.geometry.dispose(); label.material.dispose(); };
  return g;
}`,
  },
  'bad-3-default-blue': {
    caseId: 'v-14-pricing-card',
    src: `
import { Group, Mesh, PlaneGeometry, BoxGeometry, MeshBasicNodeMaterial, Color } from 'three/webgpu';
export default function createNode(config, ctx) {
  const g = new Group();
  const card = new Mesh(new PlaneGeometry(2.6, 3.4), new MeshBasicNodeMaterial());
  card.material.color = new Color('#ffffff');
  g.add(card);
  const header = new Mesh(new PlaneGeometry(2.6, 0.7), new MeshBasicNodeMaterial());
  header.material.color = new Color('#0d6efd');
  header.position.y = 1.35; header.position.z = 0.01;
  g.add(header);
  const cta = new Mesh(new BoxGeometry(1.8, 0.4, 0.02), new MeshBasicNodeMaterial());
  cta.material.color = new Color('#0d6efd');
  cta.position.y = -1.3; cta.position.z = 0.01;
  g.add(cta);
  g.userData.handlers = {};
  g.userData.cleanup = () => g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return g;
}`,
  },
  'bad-4-dead-lighting': {
    caseId: 'v-05-pedestal-material-study',
    src: `
import { Group, Mesh, BoxGeometry, CylinderGeometry, MeshStandardNodeMaterial, Color } from 'three/webgpu';
export default function createNode(config, ctx) {
  const g = new Group();
  const pedestal = new Mesh(new CylinderGeometry(1.2, 1.2, 0.3, 8), new MeshStandardNodeMaterial());
  pedestal.material.color = new Color('#808080');
  pedestal.material.roughness = 1.0; pedestal.material.metalness = 0.0;
  pedestal.position.y = -1.2;
  g.add(pedestal);
  const subject = new Mesh(new BoxGeometry(1.4, 1.4, 1.4), new MeshStandardNodeMaterial());
  subject.material.color = new Color('#7a7a7a');
  subject.material.roughness = 1.0; subject.material.metalness = 0.0;
  g.add(subject);
  g.userData.handlers = {};
  g.userData.cleanup = () => g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return g;
}`,
  },
  'bad-5-broken-composition': {
    caseId: 'v-10-bento-metrics',
    src: `
import { Group, Mesh, PlaneGeometry, MeshBasicNodeMaterial, Color } from 'three/webgpu';
export default function createNode(config, ctx) {
  const g = new Group();
  const colors = ['#14141a', '#1a1a22', '#101016', '#181820'];
  for (let i = 0; i < 4; i += 1) {
    const tile = new Mesh(new PlaneGeometry(1.6, 1.1), new MeshBasicNodeMaterial());
    tile.material.color = new Color(colors[i]);
    tile.position.set(3.4 + i * 0.35, -2.6 - i * 0.5, i * 0.01);
    tile.rotation.z = 0.6 + i * 0.4;
    g.add(tile);
  }
  g.userData.handlers = {};
  g.userData.cleanup = () => g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return g;
}`,
  },
  'bad-6-garbled-text': {
    caseId: 'v-09-editorial-oversized-type',
    src: `
import { Group, Mesh, PlaneGeometry, MeshBasicNodeMaterial, Color } from 'three/webgpu';
export default function createNode(config, ctx) {
  const g = new Group();
  const bg = new Mesh(new PlaneGeometry(6.4, 3.6), new MeshBasicNodeMaterial());
  bg.material.color = new Color('#101014');
  g.add(bg);
  // Fake letterforms: random noise bars pretending to be a headline.
  let seed = 42;
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let i = 0; i < 26; i += 1) {
    const bar = new Mesh(new PlaneGeometry(0.08 + rand() * 0.2, 0.2 + rand() * 0.5), new MeshBasicNodeMaterial());
    bar.material.color = new Color('#e8ecf2');
    bar.position.set(-2.6 + i * 0.21, 0.4 + (rand() - 0.5) * 0.3, 0.01);
    bar.rotation.z = (rand() - 0.5) * 0.5;
    g.add(bar);
  }
  g.userData.handlers = {};
  g.userData.cleanup = () => g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return g;
}`,
  },
};

mkdirSync(BUNDLES_DIR, { recursive: true });
for (const [id, def] of Object.entries(MODULES)) {
  const c = caseOf(def.caseId);
  const out = esbuild.transformSync(def.src.trim(), { format: 'cjs', loader: 'ts', target: 'es2022' });
  const bundle = {
    id: `seeded-bad/${id}-r1`,
    contestant: 'seeded-bad',
    caseId: def.caseId,
    seededDefect: id,
    run: 1,
    node: c.node,
    sceneSpec: c.sceneSpec,
    parsed: true,
    fenced: false,
    depGate: { sources: ['three/webgpu'], violations: [] },
    cjs: out.code,
    transformError: null,
  };
  writeFileSync(path.join(BUNDLES_DIR, `${id}-r1.json`), JSON.stringify(bundle, null, 2));
  console.log(`seeded ${id} (against ${def.caseId})`);
}
