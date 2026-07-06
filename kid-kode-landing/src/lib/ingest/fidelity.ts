// PRISM INGEST — the fidelity ledger (W-IMPORT, D4).
//
// The honest per-feature mapping: carried / adapted / needs-you. This is the
// moment import earns (or loses) trust, so I-HONEST-FIDELITY is load-bearing:
//   • carried   — the feature maps cleanly into the regenerated Prism app.
//   • adapted   — it maps, but changes shape (a React component → a scene node;
//                 the repo palette → the nearest premium direction).
//   • needs-you — Prism cannot auto-carry it; you wire it (a database, an auth
//                 provider, custom server logic). `needs-you` is a FEATURE, not a
//                 failure — it is the truth a developer needs to trust the import.
// A claim of "carried" is never made for something that did not carry.

import type { AnalyzerReport, FidelityFeature, FidelityReport } from '../../../packages/shared-interfaces/src/prism-ingest';
import { PRISM_INGEST_CONTRACT_VERSION } from '../../../packages/shared-interfaces/src/prism-ingest';
import { directionName } from './synthesize';

export function buildFidelityReport(
  report: AnalyzerReport,
  opts: { matchedDirectionId: string | null; sections: string[]; nowIso: string },
): FidelityReport {
  const features: FidelityFeature[] = [];

  // ── Framework ─────────────────────────────────────────────────────────────
  if (report.supported) {
    features.push({
      name: `${report.framework} project`,
      category: 'framework',
      status: 'adapted',
      reason:
        'Prism regenerates your app as a node graph (the graph is the app) — it does not run your framework build. Structure, copy, and brand are carried into the regenerated app.',
      detail: report.frameworkNote,
    });
  } else {
    features.push({
      name: 'Framework',
      category: 'framework',
      status: 'needs-you',
      reason:
        'This framework is not supported for structural import in v1. Import fell back to a prompt-seeded guided build; more frameworks land in v2.',
      detail: report.frameworkNote,
    });
  }

  // ── Routes → hubs ─────────────────────────────────────────────────────────
  const pageRoutes = report.routes.filter((r) => r.kind === 'page');
  if (pageRoutes.length > 0) {
    const dynamic = pageRoutes.filter((r) => r.dynamic);
    features.push({
      name: `${pageRoutes.length} page routes → ${opts.sections.length} hubs`,
      category: 'routes',
      status: 'carried',
      reason: 'Each page route becomes a hub in the regenerated Prism app.',
      detail: opts.sections.join(', '),
    });
    if (dynamic.length > 0) {
      features.push({
        name: `${dynamic.length} dynamic routes (e.g. ${dynamic[0].path})`,
        category: 'routes',
        status: 'adapted',
        reason:
          'A dynamic route becomes one hub template; the per-item data that fills it comes from a data source you connect (needs-you below).',
      });
    }
  } else if (report.components.length > 0) {
    features.push({
      name: 'Sections inferred from components',
      category: 'routes',
      status: 'adapted',
      reason: 'No route files were found, so the sections were inferred from top-level components. Review and edit the sections line in your brief.',
      detail: opts.sections.join(', '),
    });
  }

  const layouts = report.routes.filter((r) => r.kind === 'layout');
  if (layouts.length > 0) {
    features.push({
      name: `${layouts.length} layout(s)`,
      category: 'routes',
      status: 'adapted',
      reason: 'Shared layouts map onto Prism global slots (header/footer/nav), not arbitrary React layout components.',
    });
  }

  // ── Components ────────────────────────────────────────────────────────────
  if (report.components.length > 0) {
    const client = report.components.filter((c) => c.isClient).length;
    features.push({
      name: `${report.components.length} React components`,
      category: 'components',
      status: 'adapted',
      reason:
        'Your components inform the regenerated layout, but Prism authors scene NODES (3D-native), not your React code verbatim — the graph is the app.',
      detail: client > 0 ? `${client} client components ('use client')` : undefined,
    });
  }

  // ── Copy ──────────────────────────────────────────────────────────────────
  const copyCount = report.copy.headings.length + report.copy.cta.length;
  if (copyCount > 0) {
    features.push({
      name: `${copyCount} copy strings (headings, CTAs)`,
      category: 'copy',
      status: 'carried',
      reason: 'Your headings and calls-to-action seed the regenerated text nodes.',
      detail: report.copy.headings.slice(0, 3).join(' · ') || undefined,
    });
  }

  // ── Brand ─────────────────────────────────────────────────────────────────
  if (report.brand.colors.length >= 2) {
    features.push({
      name: `Brand palette (${report.brand.colors.slice(0, 3).join(', ')})`,
      category: 'brand',
      status: 'carried',
      reason: `Your colours carry into the regenerated app, mapped onto the "${directionName(opts.matchedDirectionId)}" material direction.`,
    });
  } else {
    features.push({
      name: 'Brand palette',
      category: 'brand',
      status: 'adapted',
      reason: `Not enough distinct colours were found in the repo, so the "${directionName(opts.matchedDirectionId)}" premium direction supplies the palette. Edit it in your brief.`,
    });
  }
  if (report.brand.fonts.length > 0) {
    features.push({
      name: `Typography (${report.brand.fonts.slice(0, 2).join(', ')})`,
      category: 'brand',
      status: 'adapted',
      reason: 'Your font choices map to the nearest Prism type classification (display/text). Exact webfonts can be wired at ship time.',
    });
  }
  if (report.brand.images.length > 0) {
    features.push({
      name: `${report.brand.images.length} brand image assets`,
      category: 'brand',
      status: 'needs-you',
      reason: 'Image assets are referenced by path; upload them (or connect the repo asset host) so they render in the regenerated app.',
      detail: report.brand.images.slice(0, 3).join(', '),
    });
  }

  // ── Integrations → capability references ──────────────────────────────────
  for (const integ of report.integrations) {
    const isAuth = integ.providerId === 'auth' || integ.providerId === 'clerk';
    features.push({
      name: `${integ.label} integration`,
      category: isAuth ? 'auth' : 'integrations',
      status: isAuth ? 'needs-you' : 'adapted',
      reason: isAuth
        ? 'Auth is re-established in Prism — you connect the provider fresh; no credentials are carried from the repo (secrets never import).'
        : `Becomes a Prism capability reference you authorize. No credentials were read from the repo (${integ.evidence}).`,
    });
  }

  // ── Data models → needs-you ───────────────────────────────────────────────
  if (report.dataModels.length > 0) {
    features.push({
      name: `${report.dataModels.length} data models (${report.dataModels.slice(0, 3).map((m) => m.name).join(', ')})`,
      category: 'data',
      status: 'needs-you',
      reason:
        'Prism does not migrate your database. The models are captured so you can connect your data source; the schema itself stays where it lives.',
    });
  }

  // ── API surface → needs-you ───────────────────────────────────────────────
  if (report.api.length > 0) {
    features.push({
      name: `${report.api.length} API endpoints`,
      category: 'api',
      status: 'needs-you',
      reason:
        'Server routes are not transplanted (contamination-aware: Prism never runs unverified code). They are listed so you can rebuild them as Prism backend capabilities.',
      detail: report.api.slice(0, 3).map((a) => `${a.methods.join('/')} ${a.path}`).join(' · '),
    });
  }

  const summary = {
    carried: features.filter((f) => f.status === 'carried').length,
    adapted: features.filter((f) => f.status === 'adapted').length,
    needsYou: features.filter((f) => f.status === 'needs-you').length,
  };

  return {
    v: PRISM_INGEST_CONTRACT_VERSION,
    repoRef: report.repoRef,
    generatedAt: opts.nowIso,
    features: features.slice(0, 200),
    summary,
  };
}
