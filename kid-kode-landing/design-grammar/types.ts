// PRISM DESIGN GRAMMAR — corpus schema v1 (W-DG1, founder-directed 2026-07-06).
//
// A structured, machine-usable taxonomy of premium web design TECHNIQUE
// FAMILIES (not templates), distilled from live motion-evidenced analysis of
// the Slider Revolution gallery + Awwwards winners (PRISM-DESIGN-SUPREMACY-
// PLAN.md §3). This corpus is the intelligence layer behind:
//   (a) intake / streaming-chat visual option bubbles,
//   (b) per-node prompt-to-element styling,
//   (c) Conductor whole-app theme composition,
//   (d) Flight Recorder taste links (which options users pick),
//   (e) judge rubrics ("does this hit the family's quality bar?").
//
// LEGAL DOCTRINE (PLAN §2, binding): every field carries DISTILLED PRINCIPLES
// in our own words. No source images, copy text, code, or assets. No
// reproduction of a specific template's composition. Exemplars are ORIGINAL
// renders we generate ourselves, labeled with their real generation source.
// The validator (validate.mjs) mechanically enforces the doctrine where it
// can (exemplar paths, source-url shape, motion-evidence requirement).
//
// Open unions follow the flight-recorder precedent: `| (string & {})` keeps
// the vocabulary extensible without a schema bump while preserving
// autocomplete on the known values.

/** Corpus schema version. Bump on any breaking shape change; every family
 *  document stamps this so a reader can migrate old corpora. */
export const DESIGN_GRAMMAR_SCHEMA_VERSION = "prism-dg-v1" as const;

// ── Rendering routes (PLAN §1, the four industry routes + flat composition) ──

/** Which rendering route(s) a family needs to hit quality parity.
 *  R1 realtime PBR · R2 pre-rendered/pre-baked sequences driven by scroll or
 *  interaction (incl. layered photographic cutout composites) · R3 baked-
 *  lighting hybrids · R4 Gaussian splats · '2d-composition' = flat/graphic
 *  composition in the prism runtime, no photoreal route required. */
export type RenderingRoute = "R1" | "R2" | "R3" | "R4" | "2d-composition";

export const RENDERING_ROUTES: readonly RenderingRoute[] = [
  "R1",
  "R2",
  "R3",
  "R4",
  "2d-composition",
];

// ── Hub render modes (W-2D — per-hub 2d/3d composition) ─────────────────────

/** Which hub composition modes the family is appropriate for. Mirrors
 *  `PrismHub.renderMode` ('3d' perspective / '2d' flat telephoto composition
 *  in the same renderer). Every family renders inside a 3d hub; '2d' is an
 *  AFFIRMATIVE claim that the family reads correctly under the flat
 *  composition (no perspective-depth dependence — e.g. grids, editorial type,
 *  full-bleed plates, screen-space fx). Corpus honesty law: absent → ["3d"]
 *  (2d-appropriateness must be claimed, never assumed). */
export type HubRenderModeTag = "2d" | "3d";

export const HUB_RENDER_MODES: readonly HubRenderModeTag[] = ["2d", "3d"];

// ── Classification axes (the query API filters on these) ────────────────────

/** What kind of element/surface the family produces. Open union. */
export type ElementType =
  | "hero"
  | "carousel"
  | "slider"
  | "gallery"
  | "grid"
  | "bento-grid"
  | "navigation"
  | "background"
  | "page-transition"
  | "section-transition"
  | "cursor"
  | "typography"
  | "product-showcase"
  | "scroll-narrative"
  | "video-hero"
  | "filmstrip"
  | "card-stack"
  | "marquee"
  | "loader"
  | "footer"
  | "cta"
  | "full-page-theme"
  | (string & {});

/** Mood adjectives. Seeded from the intake direction-board tone vocabulary
 *  (intake-model.ts DIRECTION_BOARDS) so grammar moods line up with what the
 *  intake already collects, plus harvest-observed additions. Open union. */
export type MoodTag =
  // intake direction-board tones:
  | "precise"
  | "luxury"
  | "technical"
  | "editorial"
  | "refined"
  | "timeless"
  | "bold"
  | "industrial"
  | "grounded"
  | "ethereal"
  | "calm"
  | "futuristic"
  | "warm"
  | "crafted"
  | "human"
  // harvest additions:
  | "cinematic"
  | "playful"
  | "energetic"
  | "organic"
  | "minimal"
  | "brutalist"
  | "retro"
  | "dark"
  | "airy"
  | (string & {});

/** The RULE behind a palette — never specific colors. Open union. */
export type PaletteLogicTag =
  | "monochrome-plus-accent"
  | "duotone"
  | "dark-cinematic"
  | "high-key-airy"
  | "pastel-multi-accent"
  | "neon-on-dark"
  | "editorial-neutral"
  | "earthy-natural"
  | "seasonal-shift"
  | "photographic-derived"
  | "brand-locked"
  | "high-contrast-print"
  | (string & {});

/** Easing/pacing personality of the family's motion. Open union. */
export type MotionCharacterTag =
  | "smooth-luxurious"
  | "snappy-technical"
  | "elastic-playful"
  | "cinematic-slow"
  | "kinetic-energetic"
  | "mechanical-precise"
  | "organic-fluid"
  | "weighty-physical"
  | "ambient-drift"
  | "scroll-locked"
  | (string & {});

/** Hub archetypes, matching the intake deck's archetype card options
 *  (saas/commerce/content/community) plus grammar-level extensions.
 *  'any' means the family is archetype-neutral. Open union. */
export type HubArchetype =
  | "saas"
  | "commerce"
  | "content"
  | "community"
  | "portfolio"
  | "marketing"
  | "any"
  | (string & {});

// ── Capability mapping (our stack) ───────────────────────────────────────────

/** Generation models available through our existing adapters (W10 capability
 *  family + FLUX pipelines). Open union; entries name the REAL adapter/model,
 *  never a vendor platform tile. */
export type GenModel =
  | "flux-2-pro"
  | "tripo-v3.1"
  | "hunyuan3d-3.1"
  | "rodin-gen2"
  | "fal-image"
  | "derive-material-pbr"
  | (string & {});

/** Runtime primitives/systems in our stack a family maps onto: the 9 seed
 *  cinematic primitives (CINEMATIC-PRIMITIVES-LIBRARY.md) + named runtime
 *  systems shipped in prior waves. Open union. */
export type PrimitiveRef =
  // 9 seed cinematic primitives:
  | "orbit"
  | "depth-rotate"
  | "dissolve-morph"
  | "displacement-transition"
  | "parallax-scroll"
  | "magnetic-cursor"
  | "particle-emerge"
  | "fly-through"
  | "kinetic-text"
  // shipped runtime systems:
  | "hub-background"
  | "hub-transition-preset"
  | "custom-cursor-layer"
  | "scroll-scrub-driver"
  | "inview-driver"
  | "msdf-text"
  | "extruded-text"
  | "physics-sim"
  | "fluid-sim"
  | "particle-system"
  | "keyframes"
  | "pbr-material"
  | (string & {});

/** Honesty gate for capability claims: 'ready' only with a demonstrated
 *  exemplar; 'partial' = executable with visible quality gaps; 'gap' = our
 *  stack cannot execute this family at parity yet (feeds the gap report). */
export type Readiness = "ready" | "partial" | "gap";

// ── Provenance / evidence ────────────────────────────────────────────────────

/** 'grounded' requires ≥1 deep-analyzed source with motion evidence
 *  (MOTION-EVIDENCE LAW). 'provisional' = listing-level classification only —
 *  usable for breadth stats, never for option generation. */
export type FamilyStatus = "grounded" | "provisional";

export type SourceType = "sr-template" | "awwwards" | "other";

/** How deeply a source was analyzed. 'deep' = live browser with the motion
 *  protocol (scroll sequence, hover states, slider interaction, and/or video
 *  frames). 'listing' = classified from gallery metadata only. */
export type AnalysisDepth = "deep" | "listing";

/** Where the ground truth came from. 'monitor-observation' = the founder's
 *  interactive monitor session seeds; 'founder-plan' = live analysis recorded
 *  in PRISM-DESIGN-SUPREMACY-PLAN.md §1; 'orchestrator-protocol' = this
 *  session's own Playwright motion-protocol run. */
export type GroundTruthKind =
  "monitor-observation" | "founder-plan" | "orchestrator-protocol";

/** One analyzed source behind a family. Descriptive citation only — title,
 *  URL, and OUR observations. Never carries source assets. */
export interface FamilySource {
  /** Template/site title, for citation. */
  title: string;
  /** Public URL analyzed. */
  url: string;
  sourceType: SourceType;
  analysisDepth: AnalysisDepth;
  /** REQUIRED for 'deep': how motion was observed (e.g. "live browser:
   *  scripted scroll in 6 steps + nav/card hover + slider arrows; classified
   *  from the sequence"). The motion-evidence law makes a deep analysis
   *  invalid without this. */
  motionEvidence?: string;
  /** Scratch observation seed this distillation drew from (filename only —
   *  the seed itself is ephemeral working notes, deleted at wave end). */
  observationRef?: string;
}

export type ExemplarMode = "live" | "demo-fixture";

/** An ORIGINAL render we generated ourselves illustrating the family.
 *  I-PROVENANCE: `generator`/`model`/`mode` state the REAL generation source. */
export interface FamilyExemplar {
  /** Repo-relative path under design-grammar/exemplars/. The validator
   *  rejects anything outside that directory. */
  path: string;
  /** Adapter used, e.g. 'replicate', 'tripo', 'fal', 'prism-runtime'. */
  generator: string;
  /** Model id, e.g. 'flux-2-pro'. */
  model: GenModel;
  /** 'live' = real spend through the adapter; 'demo-fixture' = deterministic
   *  demo-mode output. Never claim live for a fixture. */
  mode: ExemplarMode;
  /** OUR prompt, summarized. Original composition — never a recreation of a
   *  specific source template. */
  promptSummary: string;
  /** ISO date. */
  generatedAt: string;
  notes?: string;
}

// ── The family document ──────────────────────────────────────────────────────

/** What makes the family work — the distilled principles. Each axis is a list
 *  of standalone principle statements in our own words. */
export interface FamilyPrinciples {
  /** Grid, asymmetry, whitespace strategy, type-scale logic. */
  composition: string[];
  /** Foreground/midground/background strategy, cutouts, plates, depth cues. */
  layering: string[];
  /** Lighting recipes: glows, shadows, vignettes, rays, gradients-as-light. */
  lighting: string[];
  /** Type personality + kinetic behavior (serif/sans/mono, weight contrast,
   *  scale relationships — never font-name guessing). */
  typography: string[];
}

export interface FamilyPalette {
  logic: PaletteLogicTag[];
  /** The palette RULES in prose (e.g. "darkest color spent only on type"). */
  rules: string[];
}

export interface FamilyMotion {
  character: MotionCharacterTag[];
  /** Easing-character notes (e.g. "long expo-out settles, no bounce"). */
  easing: string[];
  /** Pacing notes (e.g. "multi-second ambient loops, no discrete cuts"). */
  pacing: string[];
  /** Choreography: stagger patterns, sequencing, what leads/follows. */
  choreography: string[];
}

/** Capability requirements mapped to OUR stack. */
export interface FamilyCapabilities {
  renderingRoutes: RenderingRoute[];
  /** W-2D — hub composition modes the family suits ('2d' is an affirmative
   *  claim; absent → ["3d"], the honest legacy default). */
  renderModes?: HubRenderModeTag[];
  genModels: GenModel[];
  primitives: PrimitiveRef[];
  /** Post-processing requirements (bloom, grain, DOF, LUT, vignette…). */
  postFx: string[];
  readiness: Readiness;
  /** What W-PHOTO or a future wave must add for parity. Required when
   *  readiness != 'ready'; feeds notes/DESIGN-GRAMMAR-GAP-REPORT.md. */
  gapNotes: string[];
}

export interface FamilyUsage {
  whenToUse: string[];
  whenNotToUse: string[];
  archetypeFit: HubArchetype[];
  moods: MoodTag[];
}

export interface FamilyPairing {
  /** Family ids that reinforce this one in the same composition. */
  pairsWith: string[];
  /** Family ids that clash with this one. */
  avoidWith: string[];
  notes: string[];
}

/** Anti-repetition law support (PLAN §3): option sets MUST draw from distinct
 *  families — and families in the same cluster are too similar to co-offer.
 *  The query API's selectDistinctOptions enforces one-per-cluster. */
export interface FamilyAntiRepetition {
  /** Similarity cluster, e.g. 'product-hero', 'filmstrip'. */
  clusterId: string;
  notes?: string;
}

export interface FamilyProvenance {
  groundTruth: GroundTruthKind[];
  /** ISO date of distillation. */
  distilledAt: string;
  /** e.g. 'wdg1-orchestrator'. */
  distilledBy: string;
}

/** One technique family — the unit of the corpus.
 *  Stored as design-grammar/families/<id>.json. */
export interface FamilyDoc {
  schemaVersion: typeof DESIGN_GRAMMAR_SCHEMA_VERSION;
  /** Stable kebab-case id; MUST equal the filename stem. Downstream systems
   *  (flight-recorder taste links, usage rotation) key on this — never rename
   *  a shipped family; add a new one and cluster them instead. */
  id: string;
  /** Human display name. */
  name: string;
  status: FamilyStatus;
  /** 1-2 sentences: what the family is. */
  summary: string;
  elementTypes: ElementType[];
  whatMakesItWork: FamilyPrinciples;
  palette: FamilyPalette;
  motion: FamilyMotion;
  capabilities: FamilyCapabilities;
  usage: FamilyUsage;
  pairing: FamilyPairing;
  antiRepetition: FamilyAntiRepetition;
  sources: FamilySource[];
  exemplars: FamilyExemplar[];
  provenance: FamilyProvenance;
}

// ── Loader/query result shapes (implemented in index.ts) ────────────────────

export interface GrammarLoadError {
  file: string;
  errors: string[];
}

export interface DesignGrammar {
  families: FamilyDoc[];
  byId: Map<string, FamilyDoc>;
  /** Invalid documents are reported here and excluded from `families`
   *  (fail-soft: one bad doc never takes down the corpus). */
  errors: GrammarLoadError[];
}

/** Filter criteria for the query API. All axes optional and AND-combined;
 *  array-valued axes match if the family carries ANY of the given tags. */
export interface GrammarQuery {
  elementType?: ElementType | ElementType[];
  mood?: MoodTag | MoodTag[];
  paletteLogic?: PaletteLogicTag | PaletteLogicTag[];
  archetype?: HubArchetype;
  motionCharacter?: MotionCharacterTag | MotionCharacterTag[];
  readiness?: Readiness | Readiness[];
  status?: FamilyStatus;
  /** W-2D — only families appropriate for this hub composition mode. A
   *  family with no `renderModes` counts as ["3d"] (honesty default). */
  renderMode?: HubRenderModeTag;
}

/** Options for anti-repetition selection. `usageCounts` is the rotation seam:
 *  callers (intake, Conductor) pass per-user or global pick counts keyed by
 *  family id and the selector prefers least-used. Wiring is a later wave;
 *  the seam ships now so ids are load-bearing from day one. */
export interface SelectOptions {
  usageCounts?: Record<string, number>;
  /** Family ids to exclude (e.g. already shown this session). */
  exclude?: string[];
}
