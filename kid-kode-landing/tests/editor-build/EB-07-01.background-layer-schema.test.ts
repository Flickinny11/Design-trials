// EB-07-01 — PrismHubBackgroundLayer type + PrismHub.background field (additive).
//
// Spec refs:
//   §7 SC-036  "PrismHubBackgroundLayer type exists with attachment mode:
//               'viewport-fixed' | 'camera-locked' | 'parallax' | 'world' |
//               'infinite-environment'."
//   §7 SC-037  "PrismHub.background?: PrismHubBackgroundLayer[] field added;
//               layout.mockupUrl retained as legacy single-layer reader."
//   §8 INV-18  Additive schema growth — no rename/delete/required-field-addition
//              to PrismHub.
//
// haltCheck:
//   types.ts exports PrismHubBackgroundLayer with the 5-member attachment union;
//   PrismHub gains an optional `background?: PrismHubBackgroundLayer[]` field;
//   layout.mockupUrl is retained; tsc passes.
//
// Strategy: source-text assertions only — this avoids importing a stub type
// during the failing-test step (which would force the hook-enforced typecheck
// to live with whatever stub shape we add). Once the implementation lands,
// every assertion below resolves against the real types.ts.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const TYPES_PATH = resolve(REPO_ROOT, 'src', 'lib', 'prism-graph', 'types.ts');

function typesSource(): string {
  return readFileSync(TYPES_PATH, 'utf8');
}

describe('EB-07-01 — PrismHubBackgroundLayer type (SC-036)', () => {
  it('types.ts exports PrismHubBackgroundLayer', () => {
    const src = typesSource();
    expect(src).toMatch(/export\s+interface\s+PrismHubBackgroundLayer\b/);
  });

  it('attachment union enumerates the five canonical SC-036 modes', () => {
    const src = typesSource();
    for (const mode of [
      'viewport-fixed',
      'camera-locked',
      'parallax',
      'world',
      'infinite-environment',
    ]) {
      expect(src).toMatch(new RegExp(`'${mode}'`));
    }
  });

  it('attachment field is required on PrismHubBackgroundLayer (not optional)', () => {
    const src = typesSource();
    // Match the attachment declaration inside the PrismHubBackgroundLayer
    // interface and ensure no `?` precedes the colon. Captures the line so a
    // failure surfaces the offending shape.
    const m = src.match(
      /interface\s+PrismHubBackgroundLayer\b[\s\S]*?\battachment(\??)\s*:/,
    );
    expect(m).not.toBeNull();
    expect(m![1]).toBe('');
  });
});

describe('EB-07-01 — PrismHub.background optional field (SC-037 + INV-18)', () => {
  it('PrismHub declares an optional background field of PrismHubBackgroundLayer[]', () => {
    const src = typesSource();
    // Locate the PrismHub interface body and assert the background? field is
    // present, optional, and typed against PrismHubBackgroundLayer.
    const body = src.match(/export\s+interface\s+PrismHub\s*\{([\s\S]*?)\n\}/);
    expect(body).not.toBeNull();
    expect(body![1]).toMatch(/\bbackground\?\s*:[^;]*PrismHubBackgroundLayer/);
  });

  it('PrismHubLayout retains mockupUrl as the legacy single-layer reader (SC-037)', () => {
    const src = typesSource();
    const body = src.match(/export\s+interface\s+PrismHubLayout\s*\{([\s\S]*?)\n\}/);
    expect(body).not.toBeNull();
    expect(body![1]).toMatch(/mockupUrl\??\s*:\s*string/);
  });

  it('PrismHub still has the required existing fields (INV-18 — no rename/delete)', () => {
    const src = typesSource();
    const body = src.match(/export\s+interface\s+PrismHub\s*\{([\s\S]*?)\n\}/);
    expect(body).not.toBeNull();
    // hubId / title / layout existed before; INV-18 forbids rename or deletion.
    expect(body![1]).toMatch(/\bhubId\s*:\s*string/);
    expect(body![1]).toMatch(/\btitle\s*:\s*string/);
    expect(body![1]).toMatch(/\blayout\s*:\s*PrismHubLayout/);
  });
});
