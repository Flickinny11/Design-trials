// W-PCP D1 — CI-style checks: (1) the generated runtime-surface outputs match
// the source they were extracted from (drift-proof, I-P2); (2) the verifier's
// MISSING_GLB_LOADER rule accepts the REAL runtime spelling `loadGLB` (the
// W-BAKE crash-cluster alignment) while still accepting the legacy `.load(`.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyNodeModule } from '@/lib/prism/codegen/verifier';
import { RUNTIME_SURFACE_L1_BLOCK } from '@/lib/prism/codegen/runtime-surface.generated';

const ROOT = path.resolve(__dirname, '..', '..');

describe('W-PCP runtime surface (generated, drift-proof)', () => {
  it('extract-runtime-surface --check passes (doc matches source)', () => {
    // Throws (non-zero exit) on drift.
    const out = execFileSync(
      'node',
      [path.join(ROOT, 'scripts', 'pcp', 'extract-runtime-surface.mjs'), '--check'],
      { encoding: 'utf8' },
    );
    expect(out).toContain('runtime-surface check: OK');
  });

  it('L1 block documents the real loader + text surface', () => {
    expect(RUNTIME_SURFACE_L1_BLOCK).toContain('loadTexture(url: string)');
    expect(RUNTIME_SURFACE_L1_BLOCK).toContain('loadGLB(url: string)');
    expect(RUNTIME_SURFACE_L1_BLOCK).toContain('createText(content: string, opts?: TextOpts)');
    expect(RUNTIME_SURFACE_L1_BLOCK).toContain('PLAIN STRING');
    expect(RUNTIME_SURFACE_L1_BLOCK).toContain("ctx.primitives[name](target, params)");
  });
});

describe('W-PCP verifier alignment — MISSING_GLB_LOADER accepts loadGLB', () => {
  const ctx = { renderMode: 'mesh' as const, hasTextContent: false };
  const wrap = (call: string) => [
    'export default function createNode(config, ctx) {',
    '  const g = new ctx.THREE.Group();',
    `  ${call}`,
    '  g.userData.cleanup = () => {};',
    '  return g;',
    '}',
  ].join('\n');

  it('accepts the real runtime spelling ctx.glbLoader.loadGLB(...)', () => {
    const r = verifyNodeModule(wrap('ctx.glbLoader.loadGLB(config.meshUrl).then((x) => g.add(x.scene));'), ctx);
    expect(r.violations.map((v) => v.rule)).not.toContain('MISSING_GLB_LOADER');
  });

  it('still accepts the legacy .load( spelling (additive widening)', () => {
    const r = verifyNodeModule(wrap('ctx.glbLoader.load(config.meshUrl, (x) => g.add(x.scene));'), ctx);
    expect(r.violations.map((v) => v.rule)).not.toContain('MISSING_GLB_LOADER');
  });

  it('still flags a mesh node that never calls the loader', () => {
    const r = verifyNodeModule(wrap('// no loader call'), ctx);
    expect(r.violations.map((v) => v.rule)).toContain('MISSING_GLB_LOADER');
  });
});
