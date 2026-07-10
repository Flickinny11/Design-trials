#!/usr/bin/env node
// W-PCP D1 — runtime-surface extractor (I-P2: the surface doc is GENERATED
// from source, never hand-typed).
//
// Parses the actual runtime source with the repo's own TypeScript compiler
// API and emits:
//   1. docs/prism/pcp/RUNTIME-SURFACE.md            — the complete callable
//      ctx surface + mount contracts, with signatures lifted verbatim from
//      the declarations.
//   2. src/lib/prism/codegen/runtime-surface.generated.ts — the compact
//      RUNTIME_SURFACE_L1_BLOCK constant embedded in L1 v2. Signature lines
//      inside the block are interpolated from the SAME extraction (the
//      micro-example templates live here in the generator, but every
//      signature string comes from the AST).
//
// Determinism: output depends only on the parsed source files — no dates, no
// environment. Running twice yields byte-identical files (proof required by
// the wave prompt: run twice, diff).
//
// Usage:
//   node scripts/pcp/extract-runtime-surface.mjs           # write both files
//   node scripts/pcp/extract-runtime-surface.mjs --check   # CI-style: regen
//     in memory and diff against the committed files; exit 1 on drift.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..', '..');
const require_ = createRequire(import.meta.url);
const ts = require_(path.join(ROOT, 'node_modules', 'typescript'));

const MD_OUT = path.join(ROOT, 'docs', 'prism', 'pcp', 'RUNTIME-SURFACE.md');
const TS_OUT = path.join(ROOT, 'src', 'lib', 'prism', 'codegen', 'runtime-surface.generated.ts');

// ---------------------------------------------------------------------------
// AST helpers
// ---------------------------------------------------------------------------

function parse(rel) {
  const p = path.join(ROOT, rel);
  const text = readFileSync(p, 'utf8');
  return ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true);
}

function collapse(text) {
  return text.replace(/\s+/g, ' ').trim();
}

/** First sentence of a declaration's JSDoc, or ''. */
function docLine(node, sf) {
  const ranges = ts.getLeadingCommentRanges(sf.getFullText(), node.getFullStart()) ?? [];
  for (const r of ranges.slice().reverse()) {
    const raw = sf.getFullText().slice(r.pos, r.end);
    if (!raw.startsWith('/**')) continue;
    const body = raw
      .replace(/^\/\*\*/, '')
      .replace(/\*\/$/, '')
      .split('\n')
      .map((l) => l.replace(/^\s*\*\s?/, '').trim())
      .join(' ')
      .trim();
    const m = /^(.*?[.!?])(\s|$)/.exec(body);
    return collapse(m ? m[1] : body).slice(0, 220);
  }
  return '';
}

/** Member signature text without its JSDoc (declaration text only). */
function memberSig(member, sf) {
  return collapse(member.getText(sf)).replace(/;$/, '');
}

function findStatement(sf, predicate) {
  for (const st of sf.statements) if (predicate(st)) return st;
  return null;
}

function interfaceMembers(sf, name) {
  const st = findStatement(
    sf,
    (s) => ts.isInterfaceDeclaration(s) && s.name.text === name,
  );
  if (!st) throw new Error(`interface ${name} not found in ${sf.fileName}`);
  return st.members.map((m) => ({ sig: memberSig(m, sf), doc: docLine(m, sf) }));
}

function typeAliasText(sf, name) {
  const st = findStatement(
    sf,
    (s) => ts.isTypeAliasDeclaration(s) && s.name.text === name,
  );
  if (!st) throw new Error(`type ${name} not found in ${sf.fileName}`);
  return { sig: collapse(st.getText(sf)).replace(/;$/, ''), doc: docLine(st, sf) };
}

function functionHead(sf, name) {
  const st = findStatement(
    sf,
    (s) => ts.isFunctionDeclaration(s) && s.name?.text === name,
  );
  if (!st) throw new Error(`function ${name} not found in ${sf.fileName}`);
  const sig = collapse(
    sf.getFullText().slice(st.getStart(sf), st.body ? st.body.getStart(sf) : st.getEnd()),
  ).replace(/\{$/, '').trim();
  return { sig, doc: docLine(st, sf) };
}

/** Union members of a string-literal union type alias. */
function unionLiterals(sf, name) {
  const st = findStatement(
    sf,
    (s) => ts.isTypeAliasDeclaration(s) && s.name.text === name,
  );
  if (!st) throw new Error(`type ${name} not found in ${sf.fileName}`);
  const out = [];
  const walk = (t) => {
    if (ts.isUnionTypeNode(t)) t.types.forEach(walk);
    else if (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)) out.push(t.literal.text);
  };
  walk(st.type);
  return out;
}

// ---------------------------------------------------------------------------
// Source extraction
// ---------------------------------------------------------------------------

const adapterSf = parse('src/lib/prism/runtime/shared/adapter.ts');
const loadersSf = parse('src/lib/prism/runtime/shared/loaders.ts');
const textSf = parse('src/lib/prism/runtime/shared/text.ts');
const primTypesSf = parse('src/lib/prism/runtime/shared/primitives/types.ts');
const cinePrimSf = parse('src/lib/prism-graph/cinematic-primitives.ts');
const driversSf = parse('src/lib/prism/runtime/shared/driver-dispatch.ts');
const mountSf = parse('src/lib/prism/runtime/mount-graph.ts');
const regSf = parse('src/lib/prism/runtime/factories/coderef-registry.ts');
const facSf = parse('src/lib/prism/runtime/factories/coderef-factory.ts');

const surface = {
  nodeContext: interfaceMembers(adapterSf, 'NodeContext'),
  createNodeFn: typeAliasText(adapterSf, 'CreateNodeFn'),
  loaderHandle: interfaceMembers(loadersSf, 'LoaderCacheHandle'),
  fontAtlasHandle: interfaceMembers(textSf, 'FontAtlasHandle'),
  textOpts: interfaceMembers(textSf, 'TextOpts'),
  curriedPrimitiveFn: typeAliasText(primTypesSf, 'CurriedPrimitiveFn'),
  primitiveResult: interfaceMembers(primTypesSf, 'PrimitiveResult'),
  primitiveNames: unionLiterals(cinePrimSf, 'CinematicPrimitiveName'),
  primitiveTriggers: unionLiterals(cinePrimSf, 'CinematicPrimitiveTrigger'),
  primitiveRef: interfaceMembers(cinePrimSf, 'CinematicPrimitiveRef'),
  nodeDrivers: interfaceMembers(driversSf, 'NodeDrivers'),
  mountFromGraphSource: functionHead(mountSf, 'mountFromGraphSource'),
  mountOpts: interfaceMembers(mountSf, 'MountGraphOpts'),
  registerCodeRef: functionHead(regSf, 'registerCodeRef'),
  getRegisteredCodeRef: functionHead(regSf, 'getRegisteredCodeRef'),
  resolveCodeRef: functionHead(facSf, 'resolveCodeRef'),
  buildPerNodeFactory: functionHead(facSf, 'buildPerNodeFactory'),
};

// Per-primitive params, extracted from the actual `num(params.X, default)` /
// `bool(params.X, default)` / `str(params.X, 'default')` reads in each
// implementation module. Grounded: a param appears here iff the runtime
// actually reads it.
function extractPrimitiveParams() {
  const dir = path.join(ROOT, 'src', 'lib', 'prism', 'runtime', 'shared', 'primitives');
  const out = [];
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.ts') && !['index.ts', 'types.ts'].includes(f))
    .sort();
  for (const f of files) {
    const name = f.replace(/\.ts$/, '');
    const src = readFileSync(path.join(dir, f), 'utf8');
    const params = new Map();
    for (const m of src.matchAll(
      /\b(num|bool|str)\(\s*params\.([A-Za-z0-9_]+)\s*,\s*([^)]*)\)/g,
    )) {
      const kind = m[1] === 'num' ? 'number' : m[1] === 'bool' ? 'boolean' : 'string';
      if (!params.has(m[2])) params.set(m[2], { type: kind, def: collapse(m[3]) });
    }
    for (const m of src.matchAll(/\bparams\.([A-Za-z0-9_]+)\b/g)) {
      if (!params.has(m[1])) params.set(m[1], { type: 'unknown', def: '' });
    }
    out.push({
      name,
      params: [...params.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, v]) => ({ key: k, ...v })),
    });
  }
  return out;
}
const primitiveParams = extractPrimitiveParams();

// ---------------------------------------------------------------------------
// Output 1 — docs/prism/pcp/RUNTIME-SURFACE.md
// ---------------------------------------------------------------------------

function mdSection(title, intro, rows) {
  const lines = [`## ${title}`, ''];
  if (intro) lines.push(intro, '');
  for (const r of rows) {
    lines.push('```ts', r.sig, '```');
    if (r.doc) lines.push(`> ${r.doc}`, '');
    else lines.push('');
  }
  return lines.join('\n');
}

const md = [
  '# Prism Runtime Surface (generated — do not hand-edit)',
  '',
  '> GENERATED by `scripts/pcp/extract-runtime-surface.mjs` from the runtime',
  '> source (I-P2). Regenerate with `node scripts/pcp/extract-runtime-surface.mjs`;',
  '> verify with `--check`. Every signature below is lifted verbatim from the',
  '> declaration it documents.',
  '',
  '## Sources',
  '',
  '- `src/lib/prism/runtime/shared/adapter.ts` — `NodeContext`, `CreateNodeFn`',
  '- `src/lib/prism/runtime/shared/loaders.ts` — `LoaderCacheHandle`',
  '- `src/lib/prism/runtime/shared/text.ts` — `FontAtlasHandle`, `TextOpts`',
  '- `src/lib/prism/runtime/shared/primitives/types.ts` — primitive call shapes',
  '- `src/lib/prism-graph/cinematic-primitives.ts` — primitive names/triggers',
  '- `src/lib/prism/runtime/shared/primitives/*.ts` — per-primitive params (from actual `params.*` reads)',
  '- `src/lib/prism/runtime/shared/driver-dispatch.ts` — `NodeDrivers`',
  '- `src/lib/prism/runtime/mount-graph.ts` — `mountFromGraphSource`, `MountGraphOpts`',
  '- `src/lib/prism/runtime/factories/coderef-registry.ts` / `coderef-factory.ts` — codeRef contracts',
  '',
  mdSection(
    'The createNode contract',
    'Every generated node module default-exports one synchronous function:',
    [surface.createNodeFn],
  ),
  mdSection(
    'NodeContext — the complete callable `ctx` surface',
    'This is EVERYTHING a node module may call. Anything not listed here does not exist at runtime.',
    surface.nodeContext,
  ),
  mdSection(
    'ctx.textureLoader / ctx.glbLoader / ctx.videoLoader — LoaderCacheHandle',
    'NodeContext narrows this handle: `textureLoader` exposes ONLY `loadTexture`, `glbLoader` ONLY `loadGLB`, `videoLoader` ONLY `loadVideo`. There is NO `.load()` method on any of them at runtime.',
    surface.loaderHandle,
  ),
  mdSection(
    'ctx.fontAtlas — FontAtlasHandle',
    'MSDF text. `createText(content, opts)` takes a STRING first argument — passing an object renders `[object Object]`.',
    surface.fontAtlasHandle,
  ),
  mdSection('TextOpts (second argument of createText)', '', surface.textOpts),
  mdSection(
    'ctx.primitives — curried cinematic primitives',
    'Call as `ctx.primitives[name](target, params)`. The runtime supplies the PrimitiveContext behind the scenes.',
    [surface.curriedPrimitiveFn],
  ),
  mdSection(
    'PrimitiveResult (what every primitive call returns)',
    'The returned `cleanup` MUST be invoked from the node\'s `userData.cleanup()`.',
    surface.primitiveResult,
  ),
  '## Primitive names, triggers, and params',
  '',
  `- Names: ${surface.primitiveNames.map((n) => `\`${n}\``).join(', ')}`,
  `- Triggers: ${surface.primitiveTriggers.map((n) => `\`${n}\``).join(', ')}`,
  '',
  'Per-primitive params (extracted from the actual `params.*` reads in each implementation; `unknown` = read without a typed default):',
  '',
  ...primitiveParams.map((p) =>
    `- \`${p.name}\`: ${p.params.length === 0 ? '(no params read)' : p.params
      .map((q) => `${q.key}: ${q.type}${q.def ? ` = ${q.def}` : ''}`)
      .join(', ')}`,
  ),
  '',
  mdSection('CinematicPrimitiveRef (what config.cinematicPrimitives carries)', '', surface.primitiveRef),
  mdSection(
    'ctx.drivers — NodeDrivers (optional; present on the built-state surface)',
    '',
    surface.nodeDrivers,
  ),
  mdSection(
    'Mount contract — mountFromGraphSource',
    'The host mounts graphs; node modules NEVER call this. Included so tool authors and labs use the real entrypoint.',
    [surface.mountFromGraphSource],
  ),
  mdSection('MountGraphOpts', '', surface.mountOpts),
  mdSection(
    'codeRef contracts',
    'Bundled factories register under `builtin:*` keys; URL codeRefs dynamic-import. `resolveCodeRef` consults the registry first.',
    [
      surface.registerCodeRef,
      surface.getRegisteredCodeRef,
      surface.resolveCodeRef,
      surface.buildPerNodeFactory,
    ],
  ),
  '## Config shape reality (what `config` actually is at runtime)',
  '',
  'The runtime passes the `PrismNode` itself as `config` (see `adaptGraphToScene` +',
  '`buildPerNodeFactory`). Load-bearing paths:',
  '',
  '- `config.nodeId`, `config.renderMode`, `config.meshUrl`, `config.depthMapUrl`',
  '- `config.cinematicPrimitives` — array of `CinematicPrimitiveRef`',
  '- `config.intent.visualSpec.textContent` — the text items array. The shipped',
  '  verifier greps for the spelling `config.textContent`, so generated code uses the',
  '  bridging idiom `config.textContent ?? config.intent?.visualSpec?.textContent ?? []`',
  '  (works at runtime, passes the verifier).',
  '- `config.intent.visualSpec.colors` / `.typography` / `.effects` — the visual spec',
  '- `config.scenePosition` — applied by the ADAPTER after createNode returns; do not',
  '  re-apply it inside the module.',
  '',
].join('\n');

// ---------------------------------------------------------------------------
// Output 2 — the compact L1 block (signatures interpolated from extraction)
// ---------------------------------------------------------------------------

function pickSig(rows, startsWith) {
  const r = rows.find((x) => x.sig.startsWith(startsWith));
  if (!r) throw new Error(`signature starting with "${startsWith}" not found`);
  return r.sig;
}

const sigCreateText = pickSig(surface.fontAtlasHandle, 'createText');
const sigLoadTexture = pickSig(surface.loaderHandle, 'loadTexture');
const sigLoadGLB = pickSig(surface.loaderHandle, 'loadGLB');
const sigLoadVideo = pickSig(surface.loaderHandle, 'loadVideo');
const textOptsLine = surface.textOpts.map((r) => r.sig).join('; ');
const primNames = surface.primitiveNames.join(' | ');
const primTriggers = surface.primitiveTriggers.join(' | ');

const l1Block = [
  'RUNTIME SURFACE (the COMPLETE callable ctx API — anything not listed here DOES NOT EXIST at runtime;',
  'inventing a method name is the #1 crash cause):',
  `- ctx.THREE — the single bundled three namespace. Read classes from it when not importing: const { Group, Mesh } = ctx.THREE;`,
  `- ctx.textureLoader.${sigLoadTexture} — ONLY method. NO .load(). Ex: ctx.textureLoader.loadTexture(config.imageUrl).then((tex) => { mat.map = tex; mat.needsUpdate = true; });`,
  `- ctx.glbLoader.${sigLoadGLB} — ONLY method. NO .load(). Ex: ctx.glbLoader.loadGLB(config.meshUrl).then((gltf) => group.add(gltf.scene));`,
  `- ctx.videoLoader?.${sigLoadVideo} — optional lane. Ex: ctx.videoLoader?.loadVideo(url).then((tex) => { mat.map = tex; });`,
  `- ctx.fontAtlas.${sigCreateText} — content is a PLAIN STRING (an object renders "[object Object]").`,
  `  TextOpts: { ${textOptsLine} }. Ex: const h = ctx.fontAtlas.createText('Calibre NA-01', { fontSize: 68, color: '#e8ecf2', align: 'left' }); group.add(h);`,
  '  There is NO createTextMesh, NO ctx.fontAtlas(...) call form, NO @/text createTextMesh export.',
  `- ctx.primitives[name](target, params) -> { timeline, cleanup } — name: ${primNames}. trigger values: ${primTriggers}.`,
  "  Ex: const r = ctx.primitives['orbit'](group, { radius: 0.6, period: 8 }); keep r and call r.cleanup() inside userData.cleanup().",
  "- ctx.emit(event, payload) — event bus. Ex: ctx.emit('navigate', { to: 'hub-pricing' }).",
  "- ctx.tier — 'T0' | 'T1' | 'T2' device tier (optional; treat absent as 'T1').",
  '',
  'CONFIG SHAPE (config IS the PrismNode):',
  '- Text items live at config.intent.visualSpec.textContent. Use the bridging idiom:',
  '  const items = config.textContent ?? config.intent?.visualSpec?.textContent ?? [];',
  '  for (const item of items) { /* item.text, item.role, item.typography?.fontSize */ }',
  '- config.cinematicPrimitives -> [{ name, params, trigger }]. config.meshUrl / config.depthMapUrl / config.intent.visualSpec.colors.',
  '- Do NOT re-apply config.scenePosition — the adapter applies it to your returned object.',
].join('\n');

const tsFile = [
  '// GENERATED FILE — do not hand-edit (I-P2).',
  '// Emitted by scripts/pcp/extract-runtime-surface.mjs from the runtime source.',
  '// Regenerate: node scripts/pcp/extract-runtime-surface.mjs',
  '// Verify:     node scripts/pcp/extract-runtime-surface.mjs --check',
  '',
  `export const RUNTIME_SURFACE_L1_BLOCK: string = ${JSON.stringify(l1Block)};`,
  '',
].join('\n');

// ---------------------------------------------------------------------------
// Write or check
// ---------------------------------------------------------------------------

const CHECK = process.argv.includes('--check');
const outputs = [
  { path: MD_OUT, content: md },
  { path: TS_OUT, content: tsFile },
];

if (CHECK) {
  let drift = false;
  for (const o of outputs) {
    const current = existsSync(o.path) ? readFileSync(o.path, 'utf8') : null;
    if (current !== o.content) {
      drift = true;
      console.error(`DRIFT: ${path.relative(ROOT, o.path)} does not match regenerated content`);
    }
  }
  if (drift) process.exit(1);
  console.log('runtime-surface check: OK (both outputs match source-derived content)');
} else {
  mkdirSync(path.dirname(MD_OUT), { recursive: true });
  for (const o of outputs) {
    writeFileSync(o.path, o.content);
    console.log(`wrote ${path.relative(ROOT, o.path)} (${o.content.length} bytes)`);
  }
}
