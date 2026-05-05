// T04 — Sample-module fixtures.
//
// Acceptance: 5 sample node modules generated correctly. Each represents a
// canonical spec §9.C render mode (sprite, plane, parallax-plane, mesh) plus
// one text-heavy sprite variant to exercise the §10.C "All modes → MSDF text"
// rule when textContent is present.
//
// The fixtures are raw text (`.codegen.txt`) so tsc does not try to compile
// them — codegen output is a STRING, not a runtime module. The verifier
// consumes that string.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { verifyNodeModule } from '@/lib/prism/codegen/verifier';
import type { RenderMode } from '@/lib/prism-graph/types';

const FIXTURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'fixtures',
  'codegen-samples',
);

const SAMPLES: Array<{
  file: string;
  renderMode: RenderMode;
  hasTextContent: boolean;
  description: string;
}> = [
  {
    file: 'sprite-button.codegen.txt',
    renderMode: 'sprite',
    hasTextContent: true,
    description: 'sprite billboard button (§9.C L326-L331)',
  },
  {
    file: 'plane-card.codegen.txt',
    renderMode: 'plane',
    hasTextContent: true,
    description: 'plane card with explicit pose (§9.C L334-L337)',
  },
  {
    file: 'parallax-plane-hero.codegen.txt',
    renderMode: 'parallax-plane',
    hasTextContent: true,
    description: 'parallax-plane hero with TSL displacement (§9.C L340-L344)',
  },
  {
    file: 'mesh-product.codegen.txt',
    renderMode: 'mesh',
    hasTextContent: false,
    description: 'mesh product with GLB load (§9.C L347-L353)',
  },
  {
    file: 'sprite-headline-text.codegen.txt',
    renderMode: 'sprite',
    hasTextContent: true,
    description: 'sprite headline driven by MSDF text (§10.C L385)',
  },
];

describe('T04 sample modules — 5 fixtures, all render modes (acceptance: 5 samples generated correctly)', () => {
  it.each(SAMPLES)('$description', ({ file, renderMode, hasTextContent }) => {
    const src = readFileSync(join(FIXTURES_DIR, file), 'utf-8');
    expect(src.length).toBeGreaterThan(50);
    const r = verifyNodeModule(src, { renderMode, hasTextContent });
    if (!r.ok) {
      const detail = r.violations
        .map((v) => `[${v.rule}] ${v.message}`)
        .join('\n');
      throw new Error(`Sample ${file} failed verifier:\n${detail}`);
    }
    expect(r.ok).toBe(true);
  });

  it('covers all 4 render modes in §9.C', () => {
    const modes = new Set(SAMPLES.map((s) => s.renderMode));
    expect(modes).toContain('sprite');
    expect(modes).toContain('plane');
    expect(modes).toContain('parallax-plane');
    expect(modes).toContain('mesh');
  });
});
