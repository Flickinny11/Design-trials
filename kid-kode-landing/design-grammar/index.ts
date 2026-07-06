// PRISM DESIGN GRAMMAR — typed loader + query API (W-DG1).
//
// Server-side entry point for the corpus. Consumers (intake option bubbles,
// prompt-to-node styling, Conductor theme composition, judge rubrics) load
// the grammar once and query it with the pure functions below. Wiring into
// those surfaces is a LATER wave — this module ships the corpus contract.
//
// Loading is fs-based (server-only usage, mirroring how build scripts read
// mock-app-source). `loadGrammarFromDocs` exists for tests and for callers
// that bundle the JSON themselves.

import fs from 'node:fs';
import path from 'node:path';
import { validateFamilyDoc, validateCorpus } from './validate.mjs';
import type {
  DesignGrammar,
  FamilyDoc,
  GrammarLoadError,
  GrammarQuery,
  HubArchetype,
  Readiness,
  SelectOptions,
} from './types';

export * from './types';
export { validateFamilyDoc, validateCorpus };

/** Default corpus root: the directory this module lives in. */
const GRAMMAR_ROOT = path.join(process.cwd(), 'design-grammar');

// ── Loading ──────────────────────────────────────────────────────────────────

/** Build a DesignGrammar from already-parsed documents (validates each;
 *  invalid docs are excluded and reported — fail-soft). */
export function loadGrammarFromDocs(docs: unknown[]): DesignGrammar {
  const families: FamilyDoc[] = [];
  const errors: GrammarLoadError[] = [];
  docs.forEach((doc, i) => {
    const errs = validateFamilyDoc(doc);
    const id = (doc as { id?: string })?.id ?? `#${i}`;
    if (errs.length > 0) errors.push({ file: id, errors: errs });
    else families.push(doc as FamilyDoc);
  });
  const corpus = validateCorpus(families);
  if (corpus.errors.length > 0) errors.push({ file: '(corpus)', errors: corpus.errors });
  families.sort((a, b) => a.id.localeCompare(b.id));
  return { families, byId: new Map(families.map((f) => [f.id, f])), errors };
}

/** Load every families/*.json under rootDir (default: ./design-grammar
 *  relative to process.cwd()). Server-side only. */
export function loadGrammar(rootDir: string = GRAMMAR_ROOT): DesignGrammar {
  const famDir = path.join(rootDir, 'families');
  if (!fs.existsSync(famDir)) return { families: [], byId: new Map(), errors: [] };
  const files = fs
    .readdirSync(famDir)
    .filter((f) => f.endsWith('.json'))
    .sort();
  const docs: unknown[] = [];
  const errors: GrammarLoadError[] = [];
  for (const f of files) {
    try {
      docs.push(JSON.parse(fs.readFileSync(path.join(famDir, f), 'utf8')));
    } catch (e) {
      errors.push({ file: f, errors: [`invalid JSON: ${(e as Error).message}`] });
    }
  }
  const grammar = loadGrammarFromDocs(docs);
  grammar.errors.unshift(...errors);
  return grammar;
}

// ── Query API ────────────────────────────────────────────────────────────────

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

/** True when the family carries ANY of the wanted tags on the given axis. */
function matchesAny(have: readonly string[], want: string[]): boolean {
  if (want.length === 0) return true;
  return want.some((w) => have.includes(w));
}

/** Archetype match honours the 'any' wildcard on the family side. */
function matchesArchetype(fit: readonly HubArchetype[], want: HubArchetype | undefined): boolean {
  if (!want) return true;
  return fit.includes('any') || fit.includes(want);
}

export function getFamily(grammar: DesignGrammar, id: string): FamilyDoc | undefined {
  return grammar.byId.get(id);
}

/** Filter families on the query axes (AND across axes; ANY within an axis). */
export function queryFamilies(grammar: DesignGrammar, q: GrammarQuery = {}): FamilyDoc[] {
  const readiness = asArray<Readiness>(q.readiness);
  return grammar.families.filter(
    (f) =>
      (q.status === undefined || f.status === q.status) &&
      matchesAny(f.elementTypes, asArray(q.elementType)) &&
      matchesAny(f.usage.moods, asArray(q.mood)) &&
      matchesAny(f.palette.logic, asArray(q.paletteLogic)) &&
      matchesAny(f.motion.character, asArray(q.motionCharacter)) &&
      matchesArchetype(f.usage.archetypeFit, q.archetype) &&
      (readiness.length === 0 || readiness.includes(f.capabilities.readiness))
  );
}

/**
 * Anti-repetition selection (PLAN §3 law: option sets MUST draw from distinct
 * families, and families in the same antiRepetition cluster are too similar
 * to co-offer). Deterministic given the same inputs:
 *   1. filter by the query (grounded families only — provisional docs never
 *      generate options),
 *   2. rank by usageCounts ascending (the rotation seam; missing = 0),
 *      tie-broken by family id,
 *   3. greedily take families whose clusterId has not been taken yet.
 */
export function selectDistinctOptions(
  grammar: DesignGrammar,
  q: GrammarQuery,
  count: number,
  opts: SelectOptions = {}
): FamilyDoc[] {
  const exclude = new Set(opts.exclude ?? []);
  const usage = opts.usageCounts ?? {};
  const candidates = queryFamilies(grammar, { ...q, status: 'grounded' })
    .filter((f) => !exclude.has(f.id))
    .sort((a, b) => (usage[a.id] ?? 0) - (usage[b.id] ?? 0) || a.id.localeCompare(b.id));
  const picked: FamilyDoc[] = [];
  const takenClusters = new Set<string>();
  for (const f of candidates) {
    if (picked.length >= count) break;
    if (takenClusters.has(f.antiRepetition.clusterId)) continue;
    takenClusters.add(f.antiRepetition.clusterId);
    picked.push(f);
  }
  return picked;
}

// ── Corpus stats (report + evidence) ─────────────────────────────────────────

export interface GrammarStats {
  total: number;
  grounded: number;
  provisional: number;
  byReadiness: Record<Readiness, number>;
  byElementType: Record<string, number>;
  clusters: number;
  deepAnalyzedSources: number;
  listingSources: number;
  exemplars: number;
  loadErrors: number;
}

export function grammarStats(grammar: DesignGrammar): GrammarStats {
  const byReadiness: Record<Readiness, number> = { ready: 0, partial: 0, gap: 0 };
  const byElementType: Record<string, number> = {};
  const clusters = new Set<string>();
  let deep = 0;
  let listing = 0;
  let exemplars = 0;
  for (const f of grammar.families) {
    byReadiness[f.capabilities.readiness] += 1;
    for (const t of f.elementTypes) byElementType[t] = (byElementType[t] ?? 0) + 1;
    clusters.add(f.antiRepetition.clusterId);
    for (const s of f.sources) (s.analysisDepth === 'deep' ? (deep += 1) : (listing += 1));
    exemplars += f.exemplars.length;
  }
  return {
    total: grammar.families.length,
    grounded: grammar.families.filter((f) => f.status === 'grounded').length,
    provisional: grammar.families.filter((f) => f.status === 'provisional').length,
    byReadiness,
    byElementType,
    clusters: clusters.size,
    deepAnalyzedSources: deep,
    listingSources: listing,
    exemplars,
    loadErrors: grammar.errors.length,
  };
}
