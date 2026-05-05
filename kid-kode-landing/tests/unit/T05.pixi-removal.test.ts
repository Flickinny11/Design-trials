// T05 — PixiJS removal (spec §15 L504-L509 + §17 DoD #1 L531).
//
// After Phase 5 completes:
//   1. `pixi.js` and `pixi-filters` MUST be absent from package.json deps.
//   2. The `.ralph-phase5-pixi-removed` marker MUST exist at the repo root —
//      the migration-forbidden-patterns.sh hook flips strict on its presence.
//   3. The verifier's PIXI_IMPORT pattern MUST still reject pixi imports
//      (regression guard — the rule survives the package removal).

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DISALLOWED_PATTERNS } from '@/lib/prism/codegen/verifier';

const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const PACKAGE_JSON = resolve(__dirname, '..', '..', 'package.json');

describe('T05 — package.json (spec §15 L504)', () => {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf-8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  it('does not declare pixi.js as a dependency', () => {
    expect(pkg.dependencies?.['pixi.js']).toBeUndefined();
  });

  it('does not declare pixi-filters as a dependency', () => {
    expect(pkg.dependencies?.['pixi-filters']).toBeUndefined();
  });

  it('does not declare any @pixi/* add-on', () => {
    const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    const offenders = Object.keys(all).filter((k) => k.startsWith('@pixi/'));
    expect(offenders).toEqual([]);
  });
});

describe('T05 — .ralph-phase5-pixi-removed marker', () => {
  it('exists at repo root once PixiJS is removed', () => {
    expect(existsSync(resolve(REPO_ROOT, '.ralph-phase5-pixi-removed'))).toBe(true);
  });
});

describe('T05 — verifier rejection regression (§10.B L370)', () => {
  const pixiRule = DISALLOWED_PATTERNS.find((r) => r.rule === 'PIXI_IMPORT');

  it('PIXI_IMPORT rule is still defined', () => {
    expect(pixiRule).toBeDefined();
  });

  it('rejects `import * as PIXI from "pixi.js"`', () => {
    expect('import * as PIXI from "pixi.js"').toMatch(pixiRule!.pattern);
  });

  it('rejects `import { DropShadowFilter } from "pixi-filters"`', () => {
    expect('import { DropShadowFilter } from "pixi-filters"').toMatch(pixiRule!.pattern);
  });

  it('rejects `import { Foo } from "@pixi/sprite-tiling"`', () => {
    expect('import { Foo } from "@pixi/sprite-tiling"').toMatch(pixiRule!.pattern);
  });
});
