// PRISM INGEST — plan synthesis: AnalyzerReport → BuildBrief (W-IMPORT, D2).
//
// Import is a PLAN SOURCE, not a second engine (ROADMAP-TO-SHIP.md). To emit the
// EXACT plan format guided-build produces, this builds an `IntakeWorking` from the
// analysis and runs the REAL `deriveBrief` — so a synthesized brief is structurally
// identical to a guided-build brief and is editable at the same gate. The repo's
// analyzed routes ride the `sections` line (the Conductor's `deriveSections` turns
// them into hubs); archetype/tone/backend/integrations ride their keyed lines; the
// nearest Direction Board is matched for material + type, and the repo's OWN palette
// is preserved on top of it (brand = "adapted", honestly).

import {
  DIRECTION_BOARDS,
  DIRECTION_BY_ID,
  deriveBrief,
  type IntakeWorking,
} from '../shell/intake/intake-model';
import type { BuildBrief, IntakeIntegrationRef } from '../../../packages/shared-interfaces/src/prism-intake';
import type { AnalyzerReport } from '../../../packages/shared-interfaces/src/prism-ingest';
import { inferSectionNames } from './analyze';

export interface SynthesisResult {
  brief: BuildBrief;
  working: IntakeWorking;
  /** The board the analysis matched (for the fidelity ledger). */
  matchedDirectionId: string | null;
  /** Section names the plan encodes (drives the Conductor's hubs). */
  sections: string[];
}

/** Map an analyzed archetype guess from routes/deps/description → intake vocab. */
function inferArchetype(report: AnalyzerReport): string {
  const hay = [
    report.description ?? '',
    report.packageName ?? '',
    ...report.routes.map((r) => r.path),
    ...report.integrations.map((i) => i.providerId),
  ]
    .join(' ')
    .toLowerCase();
  if (/shop|store|commerce|product|cart|checkout|catalog|stripe/.test(hay)) return 'Storefront / commerce';
  if (/dashboard|admin|analytics|saas|app|console|billing|auth/.test(hay)) return 'SaaS product / dashboard';
  if (/blog|post|article|docs|content|cms|editorial|sanity|contentful/.test(hay)) return 'Content / editorial';
  if (/profile|feed|social|community|message|chat|forum/.test(hay)) return 'Community / social';
  return 'Web app';
}

/** Tone descriptors inferred from copy + fonts. Honest heuristic, not invented. */
function inferTone(report: AnalyzerReport): string[] {
  const tones: string[] = [];
  const copy = [...report.copy.headings, ...report.copy.cta].join(' ').toLowerCase();
  if (report.brand.fonts.some((f) => /serif|playfair|lora|merriweather|georgia/i.test(f))) tones.push('editorial');
  if (report.brand.fonts.some((f) => /mono|code|jetbrains|fira/i.test(f))) tones.push('technical');
  if (/fast|instant|power|scale|build|ship/.test(copy)) tones.push('confident');
  if (/simple|calm|clean|minimal/.test(copy)) tones.push('calm');
  if (tones.length === 0) tones.push('confident');
  return [...new Set(tones)].slice(0, 4);
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function colorDistance(a: string, b: string): number {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return Number.POSITIVE_INFINITY;
  return Math.sqrt((ra[0] - rb[0]) ** 2 + (ra[1] - rb[1]) ** 2 + (ra[2] - rb[2]) ** 2);
}

/** Match the nearest Direction Board by palette proximity + type-classification
 *  affinity. Returns null when the repo surfaced no usable colours (→ default). */
function matchDirection(report: AnalyzerReport): string | null {
  const colors = report.brand.colors.filter((c) => /^#[0-9a-f]{6}$/i.test(c));
  if (colors.length === 0) return null;
  const repoPrimary = colors[0];
  const wantsSerif = report.brand.fonts.some((f) => /serif|playfair|lora|georgia/i.test(f));
  const wantsMono = report.brand.fonts.some((f) => /mono|code/i.test(f));

  let best: { id: string; score: number } | null = null;
  for (const board of DIRECTION_BOARDS) {
    const p = board.token.palette;
    // Distance from the repo's dominant colour to the board's nearest token.
    const dist = Math.min(
      colorDistance(repoPrimary, p.primary),
      colorDistance(repoPrimary, p.accent),
      colorDistance(repoPrimary, p.surface),
    );
    let score = dist;
    if (wantsSerif && board.token.typeDisplay === 'serif') score -= 60;
    if (wantsMono && board.token.typeText === 'mono') score -= 60;
    if (!best || score < best.score) best = { id: board.token.id, score };
  }
  return best?.id ?? null;
}

/** Build a human synthesis prompt (also the summary-line source). */
function synthPrompt(report: AnalyzerReport, sections: string[]): string {
  const desc = report.description?.trim();
  const pages = report.routes.filter((r) => r.kind === 'page').length;
  const bits: string[] = [];
  bits.push(
    `Imported from ${report.repoRef} — a ${frameworkLabel(report.framework)} app` +
      (desc ? `: ${desc}` : '') + '.',
  );
  if (sections.length) bits.push(`Main sections: ${sections.join(', ')}.`);
  const stats: string[] = [];
  if (pages) stats.push(`${pages} pages`);
  if (report.components.length) stats.push(`${report.components.length} components`);
  if (report.api.length) stats.push(`${report.api.length} API routes`);
  if (report.dataModels.length) stats.push(`${report.dataModels.length} data models`);
  if (stats.length) bits.push(`Structure: ${stats.join(', ')}.`);
  return bits.join(' ').slice(0, 8000);
}

function frameworkLabel(fw: AnalyzerReport['framework']): string {
  switch (fw) {
    case 'nextjs-app': return 'Next.js (App Router)';
    case 'nextjs-pages': return 'Next.js (Pages Router)';
    case 'nextjs-mixed': return 'Next.js';
    case 'react': return 'React';
    default: return 'web';
  }
}

export function synthesizeBrief(report: AnalyzerReport): SynthesisResult {
  const sections = inferSectionNames(report);
  const matchedDirectionId = matchDirection(report);
  const archetype = inferArchetype(report);
  const tone = inferTone(report);

  const integrations: IntakeIntegrationRef[] = report.integrations.map((i) => ({
    providerId: i.providerId,
    label: i.label,
  }));

  const backendBits: string[] = [];
  if (report.dataModels.length) backendBits.push(`Database (${report.dataModels.length} models detected)`);
  if (report.integrations.some((i) => i.providerId === 'auth' || i.providerId === 'clerk')) backendBits.push('Accounts & auth');
  if (report.integrations.some((i) => i.providerId === 'stripe')) backendBits.push('Payments');
  if (report.integrations.some((i) => i.providerId === 'ai')) backendBits.push('AI features');
  if (report.api.length) backendBits.push(`${report.api.length} API endpoints`);

  const working: IntakeWorking = {
    prompt: synthPrompt(report, sections),
    brandSeed: {
      name: report.brand.name ?? report.packageName ?? report.repoRef,
      palette: paletteFromColors(report.brand.colors),
      toneDescriptors: tone,
    },
    answers: {
      archetype: { cardId: 'archetype', stream: 'design', freeText: archetype },
      sections: { cardId: 'sections', stream: 'design', freeText: sections.join(', ') },
      tone: { cardId: 'tone', stream: 'design', freeText: tone.join(', ') },
      backend: { cardId: 'backend', stream: 'capability', freeText: backendBits.join(', ') || 'Decided during planning' },
    },
    chosenDirectionId: matchedDirectionId,
    integrations,
    githubImport: { requested: true, repo: report.repoRef },
    deployTarget: 'undecided',
    seedsUsed: [{ kind: 'url', detail: `Imported from ${report.repoRef}` }],
    branchCount: 0,
    fastPath: true,
  };

  const brief = deriveBrief(working);

  // Preserve the repo's OWN palette on top of the matched board's material/type
  // (brand = "adapted", honestly): the direction gives premium material + type,
  // the repo keeps its actual colours where it surfaced enough of them.
  const repoPalette = paletteFromColors(report.brand.colors);
  if (repoPalette) {
    brief.brandProfile = { ...brief.brandProfile, palette: { ...brief.brandProfile.palette, ...repoPalette } };
  }
  // The imported app's name titles the project.
  const title = (report.brand.name ?? report.packageName ?? report.repoRef.split('/').pop() ?? report.repoRef).slice(0, 200);
  brief.title = title || brief.title;

  return { brief, working, matchedDirectionId, sections };
}

/** Turn the extracted colour list into a {primary,secondary,accent} palette,
 *  or undefined when there aren't enough distinct colours to be honest. */
export function paletteFromColors(
  colors: string[],
): { primary: string; secondary: string; accent: string } | undefined {
  const hexes = colors.filter((c) => /^#[0-9a-f]{6}$/i.test(c));
  if (hexes.length < 2) return undefined;
  return {
    primary: hexes[0],
    secondary: hexes[1] ?? hexes[0],
    accent: hexes[2] ?? hexes[1] ?? hexes[0],
  };
}

/** Whether a valid board id was matched (used by the fidelity ledger). */
export function directionName(id: string | null): string {
  if (!id) return 'Prism Premium default';
  return DIRECTION_BY_ID.get(id)?.token.name ?? 'Prism Premium default';
}
