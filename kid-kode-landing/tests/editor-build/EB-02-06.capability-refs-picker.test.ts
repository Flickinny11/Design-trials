// EB-02-06 — capabilityRefs field on PrismRootNode + PrismNode; inspector
// capability picker; dev-preview vault.resolve returns redacted metadata only.
//
// Spec refs:
//   - §6 Phase 2 SC-009 (line 131): "capabilityRefs field on PrismRootNode
//     (and optionally on PrismNode) holds capability-reference objects
//     pointing at vault entries; raw secret values never appear in graph
//     data."
//   - §7 INV-18 (line 242): "Additive schema growth. No field rename, no
//     field deletion, no required-field addition to PrismNode, PrismHub,
//     PrismRootNode, GraphSource, or any persisted graph type."
//   - §7 INV-19 (line 243): "Raw secret values never enter the client bundle
//     or the visible graph. Only capability references appear in graph
//     data. Resolution happens server-side via the vault."
//   - §8 FP-06 (line 261): raw secret literals forbidden under src/**.
//
// haltCheck (from ralph-state.json):
//   "PrismNode and PrismRootNode expose optional capabilityRefs?:
//    CapabilityRef[]; inspector renders a 'Capabilities' surface listing
//    refs by display label; clicking a ref triggers a vault.resolve in the
//    dev preview and shows redacted resolution metadata only."

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const rootNodeSrc = readFileSync(join(repoRoot, 'src', 'lib', 'prism-graph', 'root-node.ts'), 'utf8');
const typesSrc = readFileSync(join(repoRoot, 'src', 'lib', 'prism-graph', 'types.ts'), 'utf8');
const inspectorSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'panels', 'Inspector.tsx'),
  'utf8',
);

describe('EB-02-06 — capabilityRefs field on PrismRootNode + PrismNode (SC-009, INV-18)', () => {
  it('PrismRootNode.capabilityRefs is OPTIONAL (loosened from required) to align with haltCheck', () => {
    // INV-18: loosening required→optional is additive-safe (no rename, no
    // delete). The haltCheck specifies "optional capabilityRefs?:
    // CapabilityRef[]" on PrismRootNode.
    expect(rootNodeSrc).toMatch(/capabilityRefs\?\s*:\s*CapabilityRef\[\]/);
  });

  it('PrismNode exposes optional capabilityRefs?: CapabilityRef[]', () => {
    // SC-009: "capabilityRefs field on PrismRootNode (and optionally on
    // PrismNode)". Additive (INV-18).
    expect(typesSrc).toMatch(/capabilityRefs\?\s*:\s*CapabilityRef\[\]/);
  });

  it('PrismNode imports/re-exports CapabilityRef so callers can read the field type', () => {
    // The CapabilityRef type lives in root-node.ts; types.ts is the canonical
    // entry for PrismNode consumers. Either an explicit import or a
    // re-export is fine; the test asserts the symbol is reachable.
    expect(typesSrc).toMatch(/CapabilityRef/);
  });

  it('CapabilityRef shape carries refId + scope + optional label (the picker reads label || refId)', () => {
    // The "display label" predicate in haltCheck means the UI shows
    // ref.label when present, falling back to refId. The type contract must
    // permit both.
    expect(rootNodeSrc).toMatch(/refId\s*:\s*string/);
    expect(rootNodeSrc).toMatch(/scope\s*:\s*string/);
    expect(rootNodeSrc).toMatch(/label\?\s*:\s*string/);
  });
});

describe('EB-02-06 — dev-preview vault.resolve endpoint (INV-19, redacted)', () => {
  const routePath = join(repoRoot, 'src', 'app', 'api', 'prism', 'vault', 'resolve', 'route.ts');

  it('route file exists at src/app/api/prism/vault/resolve/route.ts', () => {
    expect(existsSync(routePath)).toBe(true);
  });

  it('route imports the server-only vault and never returns the raw value', () => {
    const src = readFileSync(routePath, 'utf8');
    // Must use the vault, not invent a parallel resolution path.
    expect(src).toMatch(/@\/server\/secrets\/vault|server\/secrets\/vault/);
    // INV-19: redaction. The response body MUST NOT include a `value` field.
    // This is a source-shape check; the runtime endpoint is also gated by
    // SC-010 in EB-02-07's grep over the static bundle.
    expect(src).not.toMatch(/\bvalue\s*:\s*[^,}\n]*\.value/);
    // Defensive: explicit comment or guard naming "redact" or "redacted"
    // makes the intent legible to future readers.
    expect(src).toMatch(/redact/i);
  });

  it('route is a Next.js POST handler with runtime=nodejs (server-only gate)', () => {
    const src = readFileSync(routePath, 'utf8');
    expect(src).toMatch(/export\s+async\s+function\s+POST\s*\(/);
    expect(src).toMatch(/export\s+const\s+runtime\s*=\s*['"]nodejs['"]/);
  });
});

describe("EB-02-06 — inspector 'Capabilities' surface", () => {
  it('Inspector source contains a Capabilities surface (label visible to users)', () => {
    // haltCheck: "inspector renders a 'Capabilities' surface". The word
    // appears as a visible label string somewhere in the inspector tree.
    expect(inspectorSrc).toMatch(/Capabilities/);
  });

  it('Inspector reads capabilityRefs from the selected root node', () => {
    // SC-009: capabilityRefs lives on PrismRootNode. The picker must
    // enumerate root.capabilityRefs.
    expect(inspectorSrc).toMatch(/capabilityRefs/);
  });

  it("Capabilities surface emits a per-ref 'Resolve' affordance wired to the vault dev-preview endpoint", () => {
    // haltCheck: "clicking a ref triggers a vault.resolve in the dev
    // preview". The button must wire through the new POST endpoint.
    expect(inspectorSrc).toMatch(/\/api\/prism\/vault\/resolve/);
  });

  it('Capabilities surface displays the ref by label || refId (display-label predicate)', () => {
    // haltCheck: "listing refs by display label". The render expression
    // falls back to refId when label is absent.
    // Tolerant pattern: matches `ref.label || ref.refId`, `ref.label ?? ref.refId`,
    // or the same with `??`.
    expect(inspectorSrc).toMatch(/label\s*(?:\|\||\?\?)\s*[a-zA-Z_$][\w$]*\.?refId|ref\.label\s*(?:\|\||\?\?)\s*ref\.refId/);
  });

  it('Capabilities surface does NOT surface a raw value field (INV-19)', () => {
    // The redacted resolution payload from the endpoint carries
    // { ok, scope, ref, at, status } — never `value`. The component reads
    // those redacted fields only. This is a guard against a future edit
    // that wires `value` into the panel.
    // Scope the assertion to a window starting at "Capabilities" so we
    // don't false-positive on unrelated `value` usages in the inspector.
    const idx = inspectorSrc.indexOf('Capabilities');
    expect(idx).toBeGreaterThan(-1);
    const window_ = inspectorSrc.slice(idx, idx + 4000);
    expect(window_).not.toMatch(/\.value\b/);
  });
});

describe('EB-02-06 — INV-19 / FP-06 hardening', () => {
  it('Inspector.tsx contains no raw secret-string literals', () => {
    // FP-06 regex (case-insensitive). The Inspector is client-bundle-bound;
    // any secret literal here would leak.
    const fp06 =
      /(api[_-]?key|secret|token|password|client[_-]?secret)\s*[:=]\s*['"][A-Za-z0-9_\-./+]{16,}['"]/i;
    expect(inspectorSrc).not.toMatch(fp06);
  });
});

describe('EB-02-06 — snapshot directory (post-implementation gate)', () => {
  it('EB-02-06 snapshot directory contains outer.png + inner.png + state.json', () => {
    const dir = join(repoRoot, 'notes', 'ralph-snapshots', 'EB-02-06');
    expect(existsSync(dir)).toBe(true);
    const files = readdirSync(dir);
    for (const name of ['outer.png', 'inner.png', 'state.json']) {
      expect(files).toContain(name);
    }
  });
});
