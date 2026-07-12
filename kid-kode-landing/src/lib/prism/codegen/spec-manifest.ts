// W-VIS D2 — spec-manifest completeness gate.
//
// The W-BAKEB defect histogram is led by MISSING_SPEC_ELEMENT (297 of 369
// judged renders). This module makes spec coverage DETERMINISTIC instead of
// hoped-for: generators must end every visual-node module with a
// `@spec-manifest` comment mapping EVERY L3 spec element to the code location
// that implements it, and a pre-render gate rejects unmapped elements back to
// the generator (one retry) before any mount.
//
// Additive only: nothing changes for callers that don't pass spec elements —
// the verifier rule (SPEC_MANIFEST_INCOMPLETE) only fires when a
// `specElements` list is supplied in the VerifierContext.
//
// Manifest wire format (end of module, plain block comment so it survives
// esbuild transforms in source form and strips cleanly):
//
//   /* @spec-manifest
//   {"elements":[{"id":"text.headline.0","where":"buildHeadline()"}, ...]}
//   */

import type { PrismNode } from '@/lib/prism-graph/types';

export interface SpecElement {
  /** Deterministic element id, e.g. "text.headline.0", "color.accent". */
  id: string;
  /** Human-readable description shown to the generator and in gate output. */
  description: string;
}

export interface SpecManifestEntry {
  id: string;
  /** Code location implementing the element — function/section name. */
  where: string;
  how?: string;
}

export interface SpecManifestParse {
  present: boolean;
  entries: SpecManifestEntry[];
  parseError: string | null;
}

export interface SpecManifestGateResult {
  ok: boolean;
  manifestPresent: boolean;
  parseError: string | null;
  required: SpecElement[];
  mapped: string[];
  /** Required elements with no manifest entry, an empty `where`, or a
   *  `where` that names nothing present in the module source. */
  unmapped: SpecElement[];
  /** Manifest ids that match no required element (warning-grade). */
  unknown: string[];
}

const MANIFEST_RE = /\/\*\s*@spec-manifest\s*\n([\s\S]*?)\*\//;

/** Deterministically enumerate every L3 spec element of a visual node.
 *  The id scheme is stable across runs so gate results are comparable. */
export function extractSpecElements(node: PrismNode): SpecElement[] {
  const out: SpecElement[] = [];
  const intent = node.intent ?? ({} as NonNullable<PrismNode['intent']>);
  const vs = (intent.visualSpec ?? {}) as Record<string, unknown>;

  const textContent = Array.isArray(vs.textContent) ? (vs.textContent as Array<Record<string, unknown>>) : [];
  textContent.forEach((t, i) => {
    const role = typeof t.role === 'string' ? t.role : 'text';
    const text = typeof t.text === 'string' ? t.text : '';
    if (text.trim()) out.push({ id: `text.${role}.${i}`, description: `${role} text: "${text.slice(0, 60)}"` });
  });

  const colors = (vs.colors ?? {}) as Record<string, unknown>;
  for (const key of ['background', 'surface', 'ink', 'paper', 'accent']) {
    if (typeof colors[key] === 'string' && (colors[key] as string).trim()) {
      out.push({ id: `color.${key}`, description: `${key} color ${colors[key]}` });
    }
  }
  if (Array.isArray(colors.gradientStops) && colors.gradientStops.length > 0) {
    out.push({ id: 'color.gradient', description: `${(colors.gradientStops as unknown[]).length}-stop gradient` });
  }

  if (typeof vs.effects === 'string' && vs.effects.trim()) {
    out.push({ id: 'effects.spec', description: `effects: ${(vs.effects as string).slice(0, 80)}` });
  } else if (vs.effects && typeof vs.effects === 'object') {
    for (const key of Object.keys(vs.effects as Record<string, unknown>).sort()) {
      out.push({ id: `effects.${key}`, description: `effect ${key}` });
    }
  }

  const layers = Array.isArray(vs.layers) ? (vs.layers as Array<Record<string, unknown>>) : [];
  layers.forEach((l, i) => {
    const kind = typeof l.kind === 'string' ? l.kind : typeof l.type === 'string' ? (l.type as string) : 'layer';
    out.push({ id: `layer.${i}`, description: `layer ${i} (${kind})` });
  });

  const interactions = Array.isArray(intent.behaviorSpec?.interactions) ? intent.behaviorSpec.interactions : [];
  (interactions as unknown[]).forEach((_, i) => {
    out.push({ id: `interaction.${i}`, description: `interaction ${i}` });
  });

  const prims = Array.isArray(node.cinematicPrimitives) ? node.cinematicPrimitives : [];
  prims.forEach((p, i) => {
    const name = (p as { name?: string })?.name ?? `prim-${i}`;
    out.push({ id: `primitive.${name}`, description: `cinematic primitive ${name}` });
  });

  return out;
}

/** The prompt block appended to a visual node's L3 turn: lists the exact
 *  element ids the manifest MUST cover. Generators fill locations, never ids. */
export function buildSpecManifestPromptBlock(elements: SpecElement[]): string {
  if (elements.length === 0) return '';
  const lines = [
    'SPEC MANIFEST (REQUIRED):',
    'End your module with a block comment mapping EVERY element id below to the',
    'function or section of YOUR code that implements it. A pre-render gate',
    'deterministically rejects the module if any id is missing or maps to a',
    'location that does not exist in the code. Format (must parse as JSON):',
    '/* @spec-manifest',
    '{"elements":[{"id":"<id>","where":"<functionOrSectionName>","how":"<≤10 words>"}]}',
    '*/',
    'Element ids to map (ALL of them):',
    ...elements.map((e) => `- ${e.id} — ${e.description}`),
  ];
  return lines.join('\n');
}

export function parseSpecManifest(source: string): SpecManifestParse {
  const m = (source ?? '').match(MANIFEST_RE);
  if (!m) return { present: false, entries: [], parseError: null };
  try {
    const parsed = JSON.parse(m[1].trim()) as { elements?: SpecManifestEntry[] };
    const entries = Array.isArray(parsed.elements) ? parsed.elements.filter((e) => e && typeof e.id === 'string') : [];
    return { present: true, entries, parseError: null };
  } catch (err) {
    return { present: true, entries: [], parseError: String((err as Error)?.message ?? err).slice(0, 200) };
  }
}

/** Token check: at least one identifier-like token (length >= 3) named in
 *  `where` must appear in the module source OUTSIDE the manifest comment —
 *  prevents trivially fabricated manifests. */
function whereExistsInSource(where: string, strippedSource: string): boolean {
  const tokens = (where ?? '').match(/[A-Za-z_$][\w$]{2,}/g) ?? [];
  return tokens.some((t) => strippedSource.includes(t));
}

export function checkSpecManifestSource(source: string, required: SpecElement[]): SpecManifestGateResult {
  const parse = parseSpecManifest(source);
  const stripped = (source ?? '').replace(MANIFEST_RE, '');
  const byId = new Map(parse.entries.map((e) => [e.id, e]));
  const mapped: string[] = [];
  const unmapped: SpecElement[] = [];
  for (const el of required) {
    const entry = byId.get(el.id);
    if (entry && typeof entry.where === 'string' && entry.where.trim() && whereExistsInSource(entry.where, stripped)) {
      mapped.push(el.id);
    } else {
      unmapped.push(el);
    }
  }
  const requiredIds = new Set(required.map((e) => e.id));
  const unknown = parse.entries.map((e) => e.id).filter((id) => !requiredIds.has(id));
  return {
    ok: parse.present && parse.parseError == null && unmapped.length === 0,
    manifestPresent: parse.present,
    parseError: parse.parseError,
    required,
    mapped,
    unmapped,
    unknown,
  };
}

export function checkSpecManifest(source: string, node: PrismNode): SpecManifestGateResult {
  return checkSpecManifestSource(source, extractSpecElements(node));
}

/** One-retry feedback string for the generator when the gate rejects. */
export function buildManifestRetryFeedback(result: SpecManifestGateResult): string {
  const lines = [
    'SPEC MANIFEST GATE REJECTED your module before render.',
  ];
  if (!result.manifestPresent) lines.push('No @spec-manifest comment was found at the end of the module.');
  if (result.parseError) lines.push(`The manifest JSON failed to parse: ${result.parseError}`);
  if (result.unmapped.length) {
    lines.push('These required spec elements are unmapped (missing, empty where, or where names nothing in your code):');
    for (const el of result.unmapped) lines.push(`- ${el.id} — ${el.description}`);
  }
  lines.push('Return the COMPLETE corrected module implementing and mapping EVERY element.');
  return lines.join('\n');
}
