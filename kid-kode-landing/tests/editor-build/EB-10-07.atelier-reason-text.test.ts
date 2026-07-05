// EB-10-07 - Atelier reason text must remain a real authored node.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const liveGraph = JSON.parse(readFileSync(
  join(repoRoot, 'public', 'prism-mock', 'home', 'live-graph.json'),
  'utf8',
));
const defaultFactorySrc = readFileSync(
  join(repoRoot, 'src', 'lib', 'prism', 'runtime', 'factories', 'default-factory.ts'),
  'utf8',
);
const atelierApplierSrc = readFileSync(
  join(repoRoot, 'src', 'lib', 'prism', 'atelier', 'applier.ts'),
  'utf8',
);

describe('EB-10-07 - Atelier reason text', () => {
  it('keeps orr-atelier-reason as graph-authored runtime text', () => {
    const reason = liveGraph.nodes.find((node: any) => node.nodeId === 'orr-atelier-reason');
    expect(reason?.parentHubId).toBe('s6-atelier');
    expect(reason?.renderMode).toBe('text');
    expect(reason?.textSpec?.content).toBe('Every pairing is bench-checked for mechanical harmony.');
  });

  it('persists authored text content on the mounted object for live restore', () => {
    expect(defaultFactorySrc).toMatch(/authoredTextContent/);
    expect(defaultFactorySrc).toMatch(/node\.textSpec\?\.content/);
  });

  it('restores the authored resting copy instead of clearing the reason node', () => {
    expect(atelierApplierSrc).toMatch(/null restores the authored resting copy/);
    expect(atelierApplierSrc).toMatch(/content: content \?\? data\.authoredTextContent \?\? ''/);
    expect(atelierApplierSrc).not.toMatch(/REASON_NODE_ID,\s*reason\s*\?\s*`—\s+\$\{reason\}`\s*:\s*''/);
  });
});
