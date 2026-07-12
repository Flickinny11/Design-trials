#!/usr/bin/env node
// W-VIS D3 — preset proof-bundle builder (I-V2: no catalog entry without a
// render-proven committed thumb). Bundles the design-presets TS module with
// esbuild, then emits one /bakeoff-lab bundle per preset whose module is
// GENERATED FROM THE PRESET'S EXACT NUMBERS:
//   - light rigs   -> standard subject (sphere + plinth + backdrop) lit by the
//                     rig's lights, standard camera;
//   - camera framings -> standard subject trio, neutral rig, preset camera;
//   - composition layouts -> one labeled plate per region at its exact
//                     rect/depth, face-on camera (accent regions signal-red,
//                     focal region brightest).
// Capture rides scripts/bakeoff/capture-b.mjs unchanged (--index/--frames-root).
//
// Usage: node scripts/wvis/d3-proof-bundles.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { ROOT, WVIS } from './wvis-lib.mjs';

const require_ = createRequire(import.meta.url);
const esbuild = require_(path.join(ROOT, 'node_modules', 'esbuild'));

// Bundle the TS preset catalogs to a temp ESM module and import them — single
// source of truth: the proof renders use the same bytes production uses.
const tmpOut = '/tmp/wvis-design-presets.mjs';
esbuild.buildSync({
  entryPoints: [path.join(ROOT, 'src', 'lib', 'prism', 'design-presets', 'index.ts')],
  bundle: true, format: 'esm', platform: 'neutral', outfile: tmpOut,
  alias: { '@': path.join(ROOT, 'src') },
});
const { LIGHT_RIGS, CAMERA_FRAMINGS, COMPOSITION_LAYOUTS } = await import(pathToFileURL(tmpOut).href);

const BUNDLES_ROOT = path.join(ROOT, 'notes', 'bakeoff', 'renders', 'bundles', 'wvis-presets');
const D3 = path.join(WVIS, 'd3');
mkdirSync(BUNDLES_ROOT, { recursive: true });
mkdirSync(D3, { recursive: true });

const STANDARD_CAMERA = { position: [2.6, 1.7, 3.4], lookAt: [0, 0.45, 0], fov: 38 };
const FACE_ON_CAMERA = { position: [0, 0.5, 6.4], lookAt: [0, 0.5, 0], fov: 40 };

// Standard proof subject: PBR sphere on a plinth with a backdrop — enough
// material response to show every rig honestly.
function subjectSource() {
  return `
  const stage = new T.Group();
  const backdrop = new T.Mesh(new T.PlaneGeometry(14, 8), new T.MeshStandardMaterial({ color: 0x14141a, roughness: 0.92, metalness: 0.0 }));
  backdrop.position.set(0, 1.6, -2.6);
  stage.add(backdrop);
  const floor = new T.Mesh(new T.PlaneGeometry(14, 10), new T.MeshStandardMaterial({ color: 0x0e0e13, roughness: 0.85, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.72;
  stage.add(floor);
  const plinth = new T.Mesh(new T.BoxGeometry(1.5, 0.5, 1.5), new T.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.5, metalness: 0.35 }));
  plinth.position.y = -0.47;
  stage.add(plinth);
  const subject = new T.Mesh(new T.SphereGeometry(0.72, 64, 48), new T.MeshStandardMaterial({ color: 0xb9bec8, roughness: 0.28, metalness: 0.85 }));
  subject.position.y = 0.52;
  stage.add(subject);
  const ring = new T.Mesh(new T.TorusGeometry(0.95, 0.045, 24, 96), new T.MeshStandardMaterial({ color: 0x8a8f99, roughness: 0.35, metalness: 0.9 }));
  ring.position.y = 0.52; ring.rotation.x = Math.PI / 2.6;
  stage.add(ring);
  group.add(stage);`;
}

function lightsSource(rig) {
  const lines = [`  group.add(new T.AmbientLight(0xffffff, ${rig.ambientFloor}));`];
  for (const l of rig.lights) {
    const c = `0x${l.color.replace('#', '')}`;
    if (l.type === 'ambient') { lines.push(`  group.add(new T.AmbientLight(${c}, ${l.intensity}));`); continue; }
    if (l.type === 'hemisphere') { lines.push(`  group.add(new T.HemisphereLight(${c}, 0x0b0b10, ${l.intensity}));`); continue; }
    const ctor = l.type === 'directional' ? 'DirectionalLight' : l.type === 'spot' ? 'SpotLight' : 'PointLight';
    const v = `l_${lines.length}`;
    lines.push(`  { const ${v} = new T.${ctor}(${c}, ${l.intensity});`);
    if (l.position) lines.push(`    ${v}.position.set(${l.position.join(', ')});`);
    if (l.type === 'spot') {
      if (l.angle != null) lines.push(`    ${v}.angle = ${l.angle};`);
      if (l.penumbra != null) lines.push(`    ${v}.penumbra = ${l.penumbra};`);
    }
    if (l.distance != null) lines.push(`    ${v}.distance = ${l.distance};`);
    if (l.decay != null) lines.push(`    ${v}.decay = ${l.decay};`);
    if (l.target && (l.type === 'directional' || l.type === 'spot')) {
      lines.push(`    ${v}.target.position.set(${l.target.join(', ')}); group.add(${v}.target);`);
    }
    lines.push(`    group.add(${v}); }`);
  }
  return lines.join('\n');
}

const NEUTRAL_RIG_SOURCE = `
  group.add(new T.AmbientLight(0xffffff, 0.2));
  { const k = new T.DirectionalLight(0xfff6ec, 2.4); k.position.set(2.4, 2.8, 2.2); group.add(k); }
  { const f = new T.DirectionalLight(0xe8ecf2, 0.7); f.position.set(-2.6, 1.2, 1.8); group.add(f); }
  { const r = new T.DirectionalLight(0xffffff, 1.5); r.position.set(-1.2, 2.2, -2.6); group.add(r); }`;

const ROLE_COLORS = {
  subject: '0x8a909c', headline: '0xe8ecf2', body: '0x707784', caption: '0x555b66',
  cta: '0xff2a38', accent: '0xff2a38', negative: '0x14141a', media: '0x3a3f4a', nav: '0x5a6070',
};

function layoutSource(layout) {
  // Frame plane spans x:[-4,4] y:[-2.25,2.25] at z=0 (16:9-ish). Rects map
  // into it; depth offsets push plates along z (subject radius = 1).
  const lines = [`  group.add(new T.AmbientLight(0xffffff, 0.55));`,
    `  { const k = new T.DirectionalLight(0xffffff, 1.6); k.position.set(1.5, 2.5, 3); group.add(k); }`,
    `  const frame = new T.Mesh(new T.PlaneGeometry(8.2, 4.7), new T.MeshStandardMaterial({ color: 0x0b0b10, roughness: 0.95 }));`,
    `  frame.position.set(0, 0.5, -2.4); group.add(frame);`];
  layout.regions.forEach((rg, i) => {
    const [x, y, w, h] = rg.rect;
    const cx = (x + w / 2 - 0.5) * 8;
    const cy = (0.5 - (y + h / 2)) * 4.5 + 0.5;
    const cz = (rg.depth ?? 0) * 1.0 - 0.5;
    const focal = rg.role === layout.focalRole;
    const color = ROLE_COLORS[rg.role] ?? '0x777777';
    lines.push(`  { const p${i} = new T.Mesh(new T.PlaneGeometry(${(w * 8).toFixed(3)}, ${(h * 4.5).toFixed(3)}),`);
    lines.push(`      new T.MeshStandardMaterial({ color: ${color}, roughness: 0.6, emissive: ${focal ? color : '0x000000'}, emissiveIntensity: ${focal ? 0.35 : 0} }));`);
    lines.push(`    p${i}.position.set(${cx.toFixed(3)}, ${cy.toFixed(3)}, ${cz.toFixed(3)}); group.add(p${i}); }`);
  });
  return lines.join('\n');
}

function moduleSource(body, { neutralizeSceneLights = true } = {}) {
  // Proof-scene isolation: the runtime scene-root mounts default lights
  // (hemisphere 0.6 + directional 0.8 + ambient 0.15) and an environment IBL.
  // A preset proof must show ONLY the preset's numbers, so the proof module
  // zeroes every light outside its own group and nulls the env after mount.
  // This is proof-harness code generated by this script — never production.
  const neutralizer = neutralizeSceneLights ? `
  let tries = 0;
  const neutralize = () => {
    let root = group; while (root.parent) root = root.parent;
    if (root !== group) {
      root.traverse((o) => {
        if (o.isLight) {
          let p = o, mine = false;
          while (p) { if (p === group) { mine = true; break; } p = p.parent; }
          if (!mine) o.intensity = 0;
        }
      });
      if (root.isScene) root.environment = null;
    }
    if (++tries < 12) timers.push(setTimeout(neutralize, 150));
  };
  const timers = [setTimeout(neutralize, 0)];` : '\n  const timers = [];';
  return `import * as T from 'three/webgpu';
export default function createNode(config, ctx) {
  const group = new T.Group();
${body}
${neutralizer}
  group.userData.cleanup = () => {
    for (const t of timers) clearTimeout(t);
    group.traverse((o) => { if (o.geometry) o.geometry.dispose?.(); if (o.material) o.material.dispose?.(); });
  };
  return group;
}`;
}

const index = [];
function emit(kind, id, source, camera) {
  const tag = `${id}-r1`;
  const bundle = {
    id: `wvis-presets/${kind}/${tag}`, contestant: kind, caseId: id, run: 1,
    node: { nodeId: id, subtype: 'preset-proof' },
    sceneSpec: { camera, lights: [], background: '#0b0b10' },
    parsed: true, fenced: false, depGate: { sources: ['three/webgpu'], violations: [] },
    cjs: null, transformError: null,
  };
  try { bundle.cjs = esbuild.transformSync(source, { format: 'cjs', loader: 'ts', target: 'es2022' }).code; }
  catch (err) { bundle.transformError = String(err?.message ?? err).slice(0, 300); }
  const outDir = path.join(BUNDLES_ROOT, kind);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, `${tag}.json`), JSON.stringify(bundle, null, 2));
  index.push({ id: bundle.id, contestant: kind, caseId: id, run: 1, renderable: Boolean(bundle.cjs), parsed: true, fenced: false, depViolations: [], transformError: bundle.transformError });
}

for (const rig of LIGHT_RIGS) emit('light-rigs', rig.id, moduleSource(`${lightsSource(rig)}\n${subjectSource()}`), STANDARD_CAMERA);
for (const cam of CAMERA_FRAMINGS) emit('camera-framings', cam.id, moduleSource(`${NEUTRAL_RIG_SOURCE}\n${subjectSource()}`), { position: cam.position, lookAt: cam.lookAt, fov: cam.fov });
for (const layout of COMPOSITION_LAYOUTS) emit('composition-layouts', layout.id, moduleSource(layoutSource(layout)), FACE_ON_CAMERA);

index.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(path.join(D3, 'proof-bundles-index.json'), JSON.stringify({ bundles: index }, null, 2));
const bad = index.filter((b) => !b.renderable);
console.log(`[d3-proof] ${index.length} preset proof bundles (${bad.length} transform failures${bad.length ? ': ' + bad.map((b) => b.id).join(', ') : ''})`);
if (bad.length) process.exit(1);
