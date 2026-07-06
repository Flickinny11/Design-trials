// PRISM INGEST — the analyzer orchestrator (W-IMPORT, D1).
//
// source (RepoSource) → AnalyzerReport (structured facts). Pure over the source:
// no flight-recorder, no server-only imports, so vitest imports it under plain
// node with a LocalDirSource. Every stage is best-effort and fail-open — a
// failure in one extractor degrades that section, never the whole import.

import path from 'node:path';
import type { RepoSource } from './repo-source';
import { extractSourceFacts, importBaseName } from './ast';
import { detectFramework, parsePackageJson } from './framework-detect';
import { extractRoutes, sectionNamesFromRoutes } from './routes';
import { detectIntegrations, extractDataModels, extractBrand } from './extract';
import {
  analyzerReportSchema,
  PRISM_INGEST_CONTRACT_VERSION,
  type AnalyzedComponent,
  type AnalyzedCopy,
  type AnalyzerReport,
  type IngestStreamStage,
} from '../../../packages/shared-interfaces/src/prism-ingest';

/** Progress callback — the route forwards these as stream events (D6). */
export type StageEmit = (stage: IngestStreamStage, status: 'start' | 'ok' | 'error', label: string, detail?: string) => void;

const COMPONENT_DIR_RE = /(?:^|\/)(components?|ui|features?|widgets?|blocks?|sections?|app|pages|src)(?:\/|$)/;
const COMPONENT_EXT_RE = /\.(tsx|jsx)$/;

function noop(): void {}

export interface AnalyzeOpts {
  onStage?: StageEmit;
  /** External brand hint (a url-seed themeColor), optional. */
  themeColorHint?: string | null;
}

export async function analyzeRepo(source: RepoSource, opts: AnalyzeOpts = {}): Promise<AnalyzerReport> {
  const emit = opts.onStage ?? noop;

  // ── Fetch file list ──────────────────────────────────────────────────────
  emit('fetch', 'start', 'Reading repository');
  const files = await source.listFiles();
  emit('fetch', 'ok', `Read ${files.length} files`, `${source.repoRef}`);
  const warnings: string[] = [];
  if (files.length === 0) warnings.push('No readable source files were found in this repository.');

  // ── package.json + framework detect ───────────────────────────────────────
  emit('detect', 'start', 'Detecting framework');
  const pkgFile = files.find((f) => f === 'package.json') ?? files.find((f) => /(?:^|\/)package\.json$/.test(f));
  const pkg = parsePackageJson(pkgFile ? await source.readFile(pkgFile) : null);
  const detection = detectFramework(files, pkg);
  emit('detect', detection.supported ? 'ok' : 'error', detection.framework, detection.note);
  if (!detection.supported) warnings.push(detection.note);

  const readText = (f: string) => source.readFile(f);

  // ── Routes + API ──────────────────────────────────────────────────────────
  emit('routes', 'start', 'Mapping routes');
  const { routes, api } = await extractRoutes(files, readText);
  emit('routes', 'ok', `${routes.filter((r) => r.kind === 'page').length} pages, ${api.length} API routes`);

  // ── Components + copy (AST) ───────────────────────────────────────────────
  emit('components', 'start', 'Analyzing components');
  const { components, copy } = await analyzeComponents(files, readText);
  emit('components', 'ok', `${components.length} components`);

  // ── API detail already gathered above; announce it ───────────────────────
  emit('api', 'ok', api.length ? `${api.length} endpoints` : 'No API routes');

  // ── Data models ───────────────────────────────────────────────────────────
  emit('data', 'start', 'Extracting data models');
  const dataModels = await extractDataModels(files, readText);
  emit('data', 'ok', `${dataModels.length} data models`);

  // ── Integrations + brand ──────────────────────────────────────────────────
  emit('brand', 'start', 'Reading brand tokens');
  const integrations = detectIntegrations(pkg.deps);
  const brand = await extractBrand(files, readText, opts.themeColorHint ?? null);
  brand.name = pkg.name ?? source.meta?.name ?? null;
  emit('brand', 'ok', `${brand.colors.length} colours, ${brand.fonts.length} fonts`);

  // When routes were sparse but components exist, synthesize section names so
  // downstream always has structure (honest: recorded as a warning).
  if (routes.filter((r) => r.kind === 'page').length === 0 && components.length > 0) {
    warnings.push('No route files were found; sections were inferred from top-level components.');
  }

  const report: AnalyzerReport = {
    v: PRISM_INGEST_CONTRACT_VERSION,
    repoRef: source.repoRef,
    sourceKind: source.kind,
    framework: detection.framework,
    supported: detection.supported,
    frameworkNote: detection.note,
    packageName: pkg.name,
    description: pkg.description ?? source.meta?.description ?? null,
    routes,
    components,
    dataModels,
    api,
    integrations,
    brand,
    copy,
    fileCount: files.length,
    warnings: [...new Set(warnings)].slice(0, 40),
  };

  // Validate against the wire contract before returning (fail loud in dev).
  return analyzerReportSchema.parse(report);
}

/** Section names for the brief — routes first, else top-level component names. */
export function inferSectionNames(report: AnalyzerReport): string[] {
  const fromRoutes = sectionNamesFromRoutes(report.routes);
  if (fromRoutes.length > 0) return fromRoutes;
  // React SPA fallback: use exported page-ish components as sections.
  const names = report.components
    .filter((c) => c.exported && /page|screen|view|home|dashboard|about|contact|pricing|feature/i.test(c.name))
    .map((c) => c.name.replace(/(Page|Screen|View)$/,'').trim())
    .filter(Boolean);
  return [...new Set(['Home', ...names])].slice(0, 6);
}

async function analyzeComponents(
  files: string[],
  readText: (f: string) => Promise<string | null>,
): Promise<{ components: AnalyzedComponent[]; copy: AnalyzedCopy }> {
  const components: AnalyzedComponent[] = [];
  const headings: string[] = [];
  const cta: string[] = [];
  const body: string[] = [];

  const candidates = files.filter(
    (f) => COMPONENT_EXT_RE.test(f) && COMPONENT_DIR_RE.test(f) && !/\.(test|spec|stories)\./.test(f),
  );

  for (const file of candidates) {
    if (components.length >= 500) break;
    const text = await readText(file);
    if (!text) continue;
    const facts = extractSourceFacts(file, text);
    const name = facts.componentName ?? componentNameFromFile(file);
    if (name) {
      const localImportNames = facts.localImports.map(importBaseName).filter((n) => /^[A-Z]/.test(n));
      components.push({
        name,
        file,
        isClient: facts.isClient,
        imports: [...new Set(localImportNames)].slice(0, 40),
        exported: facts.exports.includes(name) || facts.componentName === name,
      });
    }
    headings.push(...facts.headings);
    cta.push(...facts.cta);
    body.push(...facts.body);
  }

  const copy: AnalyzedCopy = {
    headings: dedupe(headings).slice(0, 40),
    cta: dedupe(cta).slice(0, 20),
    body: dedupe(body).slice(0, 40),
  };
  return { components, copy };
}

function componentNameFromFile(file: string): string | null {
  const base = path.basename(file).replace(COMPONENT_EXT_RE, '');
  if (!base || base === 'index') {
    // Use the parent dir name for index files.
    const parent = path.basename(path.dirname(file));
    if (/^[A-Za-z]/.test(parent)) return pascal(parent);
    return null;
  }
  if (/^(page|layout|route|template|loading|error|not-found|default)$/.test(base)) {
    const parent = path.basename(path.dirname(file));
    return pascal(parent === 'app' || parent === 'pages' ? base : `${parent} ${base}`);
  }
  return /^[A-Z]/.test(base) ? base : pascal(base);
}

function pascal(s: string): string {
  return s
    .replace(/[-_./]+/g, ' ')
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join('');
}

function dedupe(xs: string[]): string[] {
  return [...new Set(xs.map((x) => x.trim()).filter((x) => x.length >= 2))];
}
