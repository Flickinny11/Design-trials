// PRISM SHELL — CONDUCTOR BUILD BLUEPRINT (SHELL W5, 2026-07-04)
//
// The deterministic planner: an approved Build Brief (W2) → a BuildBlueprint
// (hubs + node specs) the node factory materializes into a real Prism graph.
// This is the dry-run planner (no API key required) — a real, honest app
// structure derived from the brief's archetype, sections, and chosen
// Direction Board. The live model-driven planner (planner.ts) produces the
// SAME BuildBlueprint shape behind its ANTHROPIC_API_KEY gate, so the rest of
// the Conductor is planner-agnostic (and the swarm-dispatch upgrade slots in
// behind this interface — lock H).
//
// A blueprint node is DATA describing WHAT to render (a headline, a CTA, a
// feature card), not code. node-factory.ts turns each into a schema-complete
// PrismNode through the certified additive path (applyPlanRendererDefaults +
// the schema-completeness gate) — never raw code injection (I10/W5-D1).
//
// Layout: nodes are placed in scene units for the PerspectiveCamera(fov 50)
// at (0,0,10) — the frame spans roughly x∈[-3.5,3.5], y∈[-3,2.5]. Each hub
// occupies the frame independently (the hub manager shows one hub at a time).

import type { BuildBrief } from '../../../packages/shared-interfaces/src/prism-intake';
import type { ResolvedDirection } from './directions';
import type { ScenePosition } from '../../lib/prism-graph/types';

/** Which palette tone a node wears. */
export type ColorRole = 'primary' | 'secondary' | 'accent' | 'surface';

/** A text node spec (real MSDF glyphs — no baked asset). */
export interface BlueprintText {
  kind: 'text';
  content: string;
  /** Em height in scene units. */
  fontSize: number;
  fontWeight: number;
  colorRole: ColorRole;
  align: 'left' | 'center' | 'right';
}

/** A solid tinted PBR mesh node spec (meshPrimitive — no baked asset). */
export interface BlueprintMesh {
  kind: 'mesh';
  primitive: 'cube' | 'plane' | 'cylinder' | 'sphere' | 'torus' | 'capsule';
  params?: { width?: number; height?: number; depth?: number; radius?: number };
  colorRole: ColorRole;
}

export interface BlueprintNode {
  id: string;
  subtype: string;
  caption: string;
  scenePosition: Partial<ScenePosition>;
  /** Rough on-hub envelope (scene units) — sizes text scale-to-fit. */
  envelope: { width: number; height: number };
  render: BlueprintText | BlueprintMesh;
  /** Emits/listens wiring for behavioral verification (CTA → nav). */
  emits?: string[];
}

export interface BlueprintHub {
  hubId: string;
  title: string;
  role: 'home' | 'section';
  nodes: BlueprintNode[];
}

export interface BlueprintEdge {
  from: string;
  to: string;
  type: string;
  event?: string;
}

export interface BuildBlueprint {
  appName: string;
  summary: string;
  hubs: BlueprintHub[];
  edges: BlueprintEdge[];
  /** Which planner produced this (honest provenance, like prompt-edit). */
  origin: 'stub' | 'live';
}

// ── Derivation helpers ────────────────────────────────────────────────────────

function briefLine(brief: BuildBrief, key: string): string | undefined {
  const line = brief.lines.find((l) => l.key === key);
  const v = line?.value?.trim();
  return v && v.length > 0 ? v : undefined;
}

/** Split a "Home, Features, Pricing" style line into clean section names. */
function deriveSections(brief: BuildBrief): string[] {
  const raw = briefLine(brief, 'sections');
  const fromLine = raw
    ? raw
        .split(/[,\n•·|/]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.length <= 40)
    : [];
  // Archetype-aware defaults when the brief left sections open.
  const archetype = (briefLine(brief, 'archetype') ?? brief.prompt).toLowerCase();
  const defaults =
    /shop|store|commerce|product/.test(archetype)
      ? ['Featured', 'Catalog', 'Pricing']
      : /portfolio|gallery|studio|agency/.test(archetype)
        ? ['Work', 'About', 'Contact']
        : /dashboard|saas|app|tool/.test(archetype)
          ? ['Features', 'How it works', 'Pricing']
          : ['Features', 'Showcase', 'Pricing'];
  const names = (fromLine.length > 0 ? fromLine : defaults).slice(0, 4);
  return names;
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function hubId(name: string, i: number): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 24);
  return `hub-${slug || `section-${i}`}`;
}

/** A short, brief-derived headline. Prefers the summary line, else the prompt. */
function deriveHeadline(brief: BuildBrief): string {
  const summary = briefLine(brief, 'summary') ?? brief.prompt;
  const first = summary.split(/[.!?\n]/)[0].trim();
  return (first.length > 0 ? first : brief.title).slice(0, 64);
}

function deriveSubhead(brief: BuildBrief, direction: ResolvedDirection): string {
  const tone = direction.tone.slice(0, 3).join(' · ');
  const summary = briefLine(brief, 'summary');
  if (summary) {
    const rest = summary.split(/[.!?\n]/).slice(1).join(' ').trim();
    if (rest.length > 8) return rest.slice(0, 90);
  }
  return `${titleCase(direction.name)} — ${tone}`.slice(0, 90);
}

// ── The deterministic planner ─────────────────────────────────────────────────

/** Build a coherent multi-hub app blueprint from the brief + direction. */
export function buildDeterministicBlueprint(
  brief: BuildBrief,
  direction: ResolvedDirection,
): BuildBlueprint {
  const appName = brief.title.slice(0, 120) || direction.name;
  const sections = deriveSections(brief);
  const headline = deriveHeadline(brief);
  const subhead = deriveSubhead(brief, direction);
  const ctaLabel = /shop|store|buy/.test((briefLine(brief, 'archetype') ?? '').toLowerCase())
    ? 'Shop now'
    : 'Get started';

  const hubs: BlueprintHub[] = [];
  const edges: BlueprintEdge[] = [];

  // ── Home hub — hero composition ─────────────────────────────────────────────
  const homeId = 'hub-home';
  const heroKind = direction.materialFamily === 'glass-sapphire' ? 'torus' : direction.materialFamily === 'marble-brass' ? 'sphere' : 'cube';
  const home: BlueprintHub = {
    hubId: homeId,
    title: 'Home',
    role: 'home',
    // A frame-filling hero section: big headline / subhead up top, a prominent
    // 3D centerpiece, and a clear CTA button below. Positions fan across the
    // camera frame (z=10, fov50 → ~9 units tall, ~16 wide) so it reads as a
    // landing page, not floating debris.
    nodes: [
      {
        id: 'home-headline',
        subtype: 'hero-headline',
        caption: 'Hero headline',
        scenePosition: { x: 0, y: 3, z: 0 },
        envelope: { width: 9, height: 1.6 },
        render: { kind: 'text', content: headline, fontSize: 1, fontWeight: 700, colorRole: 'secondary', align: 'center' },
      },
      {
        id: 'home-subhead',
        subtype: 'hero-subhead',
        caption: 'Hero subhead',
        scenePosition: { x: 0, y: 1.85, z: 0 },
        envelope: { width: 8, height: 0.9 },
        render: { kind: 'text', content: subhead, fontSize: 0.42, fontWeight: 400, colorRole: 'secondary', align: 'center' },
      },
      {
        id: 'home-hero',
        subtype: 'hero-showpiece',
        caption: 'Hero showpiece',
        scenePosition: { x: 0, y: -0.35, z: -0.6 },
        envelope: { width: 2.6, height: 2.6 },
        render: {
          kind: 'mesh',
          primitive: heroKind,
          params: { width: 2.4, height: 2.4, depth: 2.4, radius: heroKind === 'torus' ? 1.2 : 1.3 },
          colorRole: 'accent',
        },
      },
      {
        id: 'home-cta',
        subtype: 'primary-cta',
        caption: 'Primary CTA',
        scenePosition: { x: 0, y: -2.85, z: 0.2 },
        envelope: { width: 3, height: 0.9 },
        render: { kind: 'mesh', primitive: 'plane', params: { width: 3, height: 0.82 }, colorRole: 'accent' },
        emits: ['cta-click'],
      },
      {
        id: 'home-cta-label',
        subtype: 'cta-label',
        caption: 'CTA label',
        scenePosition: { x: 0, y: -2.85, z: 0.26 },
        envelope: { width: 2.6, height: 0.6 },
        render: { kind: 'text', content: ctaLabel, fontSize: 0.34, fontWeight: 600, colorRole: 'secondary', align: 'center' },
      },
    ],
  };
  hubs.push(home);

  // ── Section hubs — title + content cards ────────────────────────────────────
  sections.forEach((name, i) => {
    const id = hubId(name, i);
    const title = titleCase(name);
    const nodes: BlueprintNode[] = [
      {
        id: `${id}-title`,
        subtype: 'section-title',
        caption: `${title} title`,
        scenePosition: { x: 0, y: 3, z: 0 },
        envelope: { width: 8, height: 1.4 },
        render: { kind: 'text', content: title, fontSize: 0.78, fontWeight: 700, colorRole: 'secondary', align: 'center' },
      },
    ];
    // Three content cards in a row (mesh panel + a label each).
    const cardXs = [-3.2, 0, 3.2];
    cardXs.forEach((x, c) => {
      nodes.push({
        id: `${id}-card-${c}`,
        subtype: 'content-card',
        caption: `${title} card ${c + 1}`,
        scenePosition: { x, y: -0.3, z: 0 },
        envelope: { width: 2.6, height: 3.4 },
        render: {
          kind: 'mesh',
          primitive: 'plane',
          params: { width: 2.5, height: 3.3 },
          colorRole: c === 1 ? 'primary' : 'surface',
        },
      });
      nodes.push({
        id: `${id}-card-${c}-label`,
        subtype: 'card-label',
        caption: `${title} card ${c + 1} label`,
        scenePosition: { x, y: 1, z: 0.06 },
        envelope: { width: 2.3, height: 0.6 },
        render: {
          kind: 'text',
          content: `${title} ${c + 1}`,
          fontSize: 0.32,
          fontWeight: 600,
          colorRole: 'secondary',
          align: 'center',
        },
      });
    });
    hubs.push({ hubId: id, title, role: 'section', nodes });
    // Nav edge home → section.
    edges.push({ from: homeId, to: id, type: 'navigation', event: 'navigate' });
  });

  return {
    appName,
    summary: deriveHeadline(brief),
    hubs,
    edges,
    origin: 'stub',
  };
}
