#!/usr/bin/env node
// W-PCP D6 — materialize the probe's two prompt sets (I-P3: the arms differ
// ONLY in the prompt layers).
//
//   notes/pcp-probe/prompts/old/l1-system.txt  = SHARED_SYSTEM_PROMPT_V1
//     (verified byte-identical to the W-BAKE frozen corpus L1)
//   notes/pcp-probe/prompts/pcp/l1-system.txt  = SHARED_SYSTEM_PROMPT (L1 v2)
//     — pulled from the LIVE compiler module via esbuild bundling, so the
//     probe runs the exact bytes production codegen would send.
//   notes/pcp-probe/prompts/{old,pcp}/l2-world.txt = the frozen corpus L2
//     (byte-copy for BOTH arms — single-variable experiment: the delta is
//     attributable to L1 v2 alone; disclosed in the report).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..', '..');
const require_ = createRequire(import.meta.url);
const esbuild = require_(path.join(ROOT, 'node_modules', 'esbuild'));

const OUT = path.join(ROOT, 'notes', 'pcp-probe', 'prompts');
const CORPUS_FN = path.join(ROOT, 'notes', 'bakeoff', 'corpus', 'functional');

const sha = (s) => createHash('sha256').update(s).digest('hex');

// Bundle a tiny entry that prints the live prompt constants.
const entry = [
  "import { SHARED_SYSTEM_PROMPT, SHARED_SYSTEM_PROMPT_V1 } from '@/lib/prism/codegen/prompts';",
  'process.stdout.write(JSON.stringify({ v2: SHARED_SYSTEM_PROMPT, v1: SHARED_SYSTEM_PROMPT_V1 }));',
].join('\n');

const built = await esbuild.build({
  stdin: {
    contents: entry,
    resolveDir: ROOT,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
  alias: { '@': path.join(ROOT, 'src') },
  logLevel: 'silent',
});
const js = built.outputFiles[0].text;
const tmp = path.join(ROOT, 'node_modules', '.cache', 'wpcp-emit-prompts.cjs');
mkdirSync(path.dirname(tmp), { recursive: true });
writeFileSync(tmp, js);
const { v1, v2 } = JSON.parse(execFileSync('node', [tmp], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));

const frozenL1 = readFileSync(path.join(CORPUS_FN, 'l1-system.txt'), 'utf8');
const frozenL2 = readFileSync(path.join(CORPUS_FN, 'l2-world.txt'), 'utf8');

if (v1 !== frozenL1) {
  console.error('FATAL: SHARED_SYSTEM_PROMPT_V1 no longer matches the frozen corpus L1 — probe arms would not be comparable to W-BAKE.');
  console.error(`live V1 sha256: ${sha(v1)}\nfrozen  sha256: ${sha(frozenL1)}`);
  process.exit(1);
}

mkdirSync(path.join(OUT, 'old'), { recursive: true });
mkdirSync(path.join(OUT, 'pcp'), { recursive: true });
writeFileSync(path.join(OUT, 'old', 'l1-system.txt'), v1);
writeFileSync(path.join(OUT, 'pcp', 'l1-system.txt'), v2);
writeFileSync(path.join(OUT, 'old', 'l2-world.txt'), frozenL2);
writeFileSync(path.join(OUT, 'pcp', 'l2-world.txt'), frozenL2);

const manifest = {
  emittedFrom: 'src/lib/prism/codegen/prompts.ts via esbuild bundle (the LIVE compiler module)',
  invariant: 'I-P3 — arms differ ONLY in L1; L2 byte-copied to both arms; L3 = frozen corpus case strings',
  sha256: {
    'old/l1-system.txt': sha(v1),
    'pcp/l1-system.txt': sha(v2),
    'old/l2-world.txt': sha(frozenL2),
    'pcp/l2-world.txt': sha(frozenL2),
  },
  bytes: {
    'old/l1-system.txt': Buffer.byteLength(v1),
    'pcp/l1-system.txt': Buffer.byteLength(v2),
    'l2-world.txt': Buffer.byteLength(frozenL2),
  },
  v1MatchesFrozenCorpusL1: true,
};
writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
