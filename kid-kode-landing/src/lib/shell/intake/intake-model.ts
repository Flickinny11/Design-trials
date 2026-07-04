// PRISM SHELL — GUIDED BUILD DECK + DIRECTION MODEL (SHELL W2)
//
// Presentation model for the intake flow: WHICH cards, WHICH visual options,
// WHICH Direction Boards. Persistence shapes live in the contract
// (packages/shared-interfaces/src/prism-intake.ts); this is shell-side
// presentation the wire never sees.
//
// Deck discipline (spec §3, S5): two interleaved streams — design and
// capability — kept to SIX cards in the common case (never an interrogation).
// Every card is skippable and carries a free-text escape hatch (I6); those
// affordances are rendered by the card shell, so they aren't repeated per
// option here.

import type {
  BuildBrief,
  BuildBriefLine,
  DecisionAnswer,
  DeployTarget,
  DirectionBoardToken,
  IntakeIntegrationRef,
} from '../../../../packages/shared-interfaces/src/prism-intake';
import type { BrandProfile } from '../../../../packages/shared-interfaces/src/prism-brand';
import { intakeHeadTiles } from '../integrations/catalog';

// W3 (task 6): the intake connect-card one-click tiles bind to the SHARED
// curated head catalog (src/lib/shell/integrations/catalog.ts) — one source of
// truth for both the intake card and the /app/integrations surface, never a
// parallel hardcoded list. Long-tail asks still flow through the card's
// "connect anything" request path (decision C rider).
const CONNECT_CARD_OPTIONS: readonly CardOption[] = intakeHeadTiles().map((t) => ({
  id: t.providerId,
  label: t.label,
  hint: t.hint,
  brandMark: t.brandMark,
  providerId: t.providerId,
}));

// ── Direction Boards (real 3D mini-scenes; each distinct) ────────────────────

/** A `scene` key the 3D board component switches on for material + geometry +
 *  motion. `texture` names a baked PBR set under public/ (product pipeline,
 *  DL13) or `null` for a procedural-material board. */
export interface DirectionBoardDef {
  token: DirectionBoardToken;
  scene:
    | 'machined-metal'
    | 'marble-brass'
    | 'copper-stone'
    | 'glass-sapphire'
    | 'walnut-brass';
  /** Baked PBR albedo/normal/rough dir under public/, or null (procedural). */
  textureDir: string | null;
}

export const DIRECTION_BOARDS: readonly DirectionBoardDef[] = [
  {
    scene: 'machined-metal',
    textureDir: null,
    token: {
      id: 'atelier-noir',
      name: 'Atelier Noir',
      character: 'Machined precision — instrument-grade metal, one red signal.',
      palette: { primary: '#16161d', secondary: '#e8ecf2', accent: '#ff2a38', surface: '#0b0b10' },
      materialFamily: 'machined-metal',
      typeDisplay: 'serif',
      typeText: 'mono',
      motion: 'weighted settle',
      tone: ['precise', 'luxury', 'technical'],
    },
  },
  {
    scene: 'marble-brass',
    textureDir: '/prism-mock/editor/textures/generated/carrara-marble',
    token: {
      id: 'carrara',
      name: 'Carrara',
      character: 'Editorial gallery — white marble slabs, warm brass rule.',
      palette: { primary: '#efe9df', secondary: '#b08d4c', accent: '#7d0f18', surface: '#d8d0c2' },
      materialFamily: 'marble-brass',
      typeDisplay: 'serif',
      typeText: 'humanist',
      motion: 'slow drift',
      tone: ['editorial', 'refined', 'timeless'],
    },
  },
  {
    scene: 'copper-stone',
    textureDir: '/prism-mock/editor/textures/generated/brushed-copper',
    token: {
      id: 'foundry',
      name: 'Foundry',
      character: 'Industrial warmth — brushed copper over dark meteorite stone.',
      palette: { primary: '#c67b4a', secondary: '#2a2724', accent: '#ff5a55', surface: '#1a1613' },
      materialFamily: 'copper-stone',
      typeDisplay: 'slab',
      typeText: 'mono',
      motion: 'heavy torque',
      tone: ['bold', 'industrial', 'grounded'],
    },
  },
  {
    scene: 'glass-sapphire',
    textureDir: null,
    token: {
      id: 'aurora-glass',
      name: 'Aurora Glass',
      character: 'Ethereal soft-tech — smoked glass, drifting sapphire refraction.',
      palette: { primary: '#3a5c86', secondary: '#cfe4ff', accent: '#ff2a38', surface: '#06080d' },
      materialFamily: 'glass-sapphire',
      typeDisplay: 'geometric',
      typeText: 'geometric',
      motion: 'drifting refraction',
      tone: ['ethereal', 'calm', 'futuristic'],
    },
  },
  {
    scene: 'walnut-brass',
    textureDir: '/prism-mock/editor/textures/generated/walnut-grain',
    token: {
      id: 'walnut-studio',
      name: 'Walnut Studio',
      character: 'Warm craft — walnut grain, brass fittings, human hand.',
      palette: { primary: '#5a3b26', secondary: '#c9a15a', accent: '#b5472f', surface: '#2a1c12' },
      materialFamily: 'walnut-brass',
      typeDisplay: 'serif',
      typeText: 'humanist',
      motion: 'gentle sway',
      tone: ['warm', 'crafted', 'human'],
    },
  },
] as const;

export const DIRECTION_BY_ID = new Map(DIRECTION_BOARDS.map((b) => [b.token.id, b]));

// ── Decision cards (six, interleaved design ⇄ capability) ─────────────────────

export type CardKind = 'options' | 'direction' | 'capability-tiles';

/** A visual option on a card. `glyph` selects a custom 3D geometric object
 *  (OptionGlyph3D); `brandMark` (capability tiles) selects a real 3D brand
 *  mark (DL15). One of the two is set. */
export interface CardOption {
  id: string;
  label: string;
  hint?: string;
  glyph?: string;
  brandMark?: string;
  /** Persisted capability reference when this option is an integration/deploy. */
  providerId?: string;
  deploy?: DeployTarget;
}

export interface CardDef {
  id: string;
  stream: 'design' | 'capability';
  kicker: string;
  question: string;
  helper: string;
  kind: CardKind;
  /** Multi-select (backend needs, integrations) vs single (archetype, tone). */
  multi?: boolean;
  options?: readonly CardOption[];
}

export const DECK: readonly CardDef[] = [
  {
    id: 'archetype',
    stream: 'design',
    kicker: 'Design · 1 of 6',
    question: 'What are we building?',
    helper: 'Pick the closest shape — you can refine every detail later.',
    kind: 'options',
    options: [
      { id: 'saas', label: 'SaaS product', hint: 'Dashboards, accounts, billing', glyph: 'grid' },
      { id: 'commerce', label: 'Storefront', hint: 'Catalog, cart, checkout', glyph: 'cart' },
      { id: 'content', label: 'Content / editorial', hint: 'Publishing, blog, docs', glyph: 'quill' },
      { id: 'community', label: 'Community / social', hint: 'Profiles, feeds, messaging', glyph: 'portal' },
    ],
  },
  {
    id: 'backend',
    stream: 'capability',
    kicker: 'Capability · 2 of 6',
    question: 'What does it need under the hood?',
    helper: 'Choose everything that applies — Prism wires the backend for you.',
    kind: 'options',
    multi: true,
    options: [
      { id: 'auth', label: 'Accounts & auth', hint: 'Sign-in, sessions, roles', glyph: 'key' },
      { id: 'database', label: 'Database', hint: 'Store and query data', glyph: 'stack' },
      { id: 'payments', label: 'Payments', hint: 'Subscriptions, one-off', glyph: 'coin' },
      { id: 'ai', label: 'AI features', hint: 'Generation, search, agents', glyph: 'spark' },
      { id: 'files', label: 'File storage', hint: 'Uploads, media', glyph: 'cloud' },
      { id: 'realtime', label: 'Realtime', hint: 'Live updates, presence', glyph: 'bolt' },
    ],
  },
  {
    id: 'direction',
    stream: 'design',
    kicker: 'Design · 3 of 6',
    question: 'Choose a direction.',
    helper: 'Each board is a live material study — the one you pick seeds your brand.',
    kind: 'direction',
  },
  {
    id: 'connect',
    stream: 'capability',
    kicker: 'Capability · 4 of 6',
    question: 'Connect your world.',
    helper:
      'One-click integrations cover the head; describe anything else and Prism authors the connector. Import an existing repo if you have one.',
    kind: 'capability-tiles',
    multi: true,
    // Bound to the shared curated head catalog (W3 task 6). GitHub has its own
    // App install path (rendered by the card's GitHub toggle), so it is not a
    // one-click catalog tile here.
    options: CONNECT_CARD_OPTIONS,
  },
  {
    id: 'sections',
    stream: 'design',
    kicker: 'Design · 5 of 6',
    question: 'What are the main sections?',
    helper: 'These become the hubs of your app. Add your own with the field below.',
    kind: 'options',
    multi: true,
    options: [
      { id: 'home', label: 'Home / landing', glyph: 'grid' },
      { id: 'dashboard', label: 'Dashboard', glyph: 'graph' },
      { id: 'catalog', label: 'Catalog / library', glyph: 'stack' },
      { id: 'profile', label: 'Profile / account', glyph: 'key' },
      { id: 'settings', label: 'Settings', glyph: 'gear' },
      { id: 'pricing', label: 'Pricing', glyph: 'coin' },
    ],
  },
  {
    id: 'tone',
    stream: 'design',
    kicker: 'Design · 6 of 6',
    question: 'How should it feel?',
    helper: 'Set the voice — it tunes copy, motion, and density.',
    kind: 'options',
    multi: true,
    options: [
      { id: 'confident', label: 'Confident', glyph: 'monolith' },
      { id: 'playful', label: 'Playful', glyph: 'orb' },
      { id: 'editorial', label: 'Editorial', glyph: 'quill' },
      { id: 'technical', label: 'Technical', glyph: 'graph' },
      { id: 'calm', label: 'Calm', glyph: 'wave' },
    ],
  },
] as const;

export const DEPLOY_OPTIONS: readonly { id: DeployTarget; label: string; mark: string }[] = [
  { id: 'prism-cloud', label: 'Prism Cloud', mark: 'prism' },
  { id: 'vercel', label: 'Vercel', mark: 'vercel' },
  { id: 'cloudflare', label: 'Cloudflare', mark: 'cloudflare' },
  { id: 'netlify', label: 'Netlify', mark: 'netlify' },
] as const;

// ── Working state → Build Brief derivation ───────────────────────────────────

const DEFAULT_PALETTE = { primary: '#16161d', secondary: '#e8ecf2', accent: '#ff2a38' };

/** The default project title from the prompt (first strong phrase). */
export function titleFromPrompt(prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) return 'Untitled build';
  const firstLine = trimmed.split('\n')[0].replace(/^(build|make|create|i want|a|an)\s+/i, '');
  const words = firstLine.split(/\s+/).slice(0, 6).join(' ');
  return (words.charAt(0).toUpperCase() + words.slice(1)).slice(0, 60) || 'Untitled build';
}

function optionLabels(card: CardDef, ids: string[] | undefined): string[] {
  if (!ids || !card.options) return [];
  return ids
    .map((id) => card.options?.find((o) => o.id === id)?.label)
    .filter((l): l is string => Boolean(l));
}

/** Fold the chosen Direction's tokens into a Brand Profile (S5: "selection
 *  demonstrably seeds the build"). URL/screenshot seeds may have pre-filled
 *  name/palette; the Direction overrides palette + type + tone. */
export function seedBrandProfile(
  base: Partial<BrandProfile>,
  direction: DirectionBoardToken | null,
): BrandProfile {
  const palette = direction
    ? { primary: direction.palette.primary, secondary: direction.palette.secondary, accent: direction.palette.accent }
    : base.palette ?? DEFAULT_PALETTE;
  const tone = direction ? direction.tone : (base.toneDescriptors ?? []);
  return {
    v: 1,
    name: base.name?.slice(0, 120) || 'Untitled brand',
    logo: base.logo,
    palette,
    typePrefs: direction
      ? {
          display: { classification: direction.typeDisplay },
          text: { classification: direction.typeText },
        }
      : base.typePrefs,
    toneDescriptors: tone.slice(0, 16),
  };
}

export interface IntakeWorking {
  prompt: string;
  brandSeed: Partial<BrandProfile>;
  answers: Record<string, DecisionAnswer>;
  chosenDirectionId: string | null;
  integrations: IntakeIntegrationRef[];
  githubImport?: { requested: boolean; repo?: string };
  deployTarget: DeployTarget;
  seedsUsed: { kind: 'prompt' | 'screenshot' | 'logo' | 'url'; detail: string }[];
  branchCount: number;
  fastPath: boolean;
}

/** Build the editable Brief from working state. Lines are seeded from answers
 *  but become free-text the moment the user edits them. */
export function deriveBrief(w: IntakeWorking): BuildBrief {
  const direction = w.chosenDirectionId ? DIRECTION_BY_ID.get(w.chosenDirectionId)?.token ?? null : null;
  const brandProfile = seedBrandProfile(w.brandSeed, direction);

  const archetype = w.answers['archetype'];
  const backend = w.answers['backend'];
  const sections = w.answers['sections'];
  const tone = w.answers['tone'];

  const archLabels = optionLabels(DECK[0], archetype?.optionIds);
  const backendLabels = optionLabels(DECK[1], backend?.optionIds);
  const sectionLabels = optionLabels(DECK[4], sections?.optionIds);
  const toneLabels = optionLabels(DECK[5], tone?.optionIds);

  const lines: BuildBriefLine[] = [
    {
      id: 'l-summary',
      key: 'summary',
      label: 'What Prism will build',
      value: w.prompt.trim() || 'A premium app, guided from your answers below.',
    },
    {
      id: 'l-archetype',
      key: 'archetype',
      label: 'App type',
      value: [archLabels.join(', '), archetype?.freeText].filter(Boolean).join(' — ') || 'General web app',
    },
    {
      id: 'l-direction',
      key: 'direction',
      label: 'Design direction',
      value: direction ? `${direction.name} — ${direction.character}` : 'Prism Premium default (Atelier Noir)',
    },
    {
      id: 'l-sections',
      key: 'sections',
      label: 'Main sections',
      value: [sectionLabels.join(', '), sections?.freeText].filter(Boolean).join(', ') || 'Home, primary workspace',
    },
    {
      id: 'l-tone',
      key: 'tone',
      label: 'Tone',
      value: [toneLabels.join(', '), tone?.freeText].filter(Boolean).join(', ') || brandProfile.toneDescriptors.join(', ') || 'Confident, premium',
    },
    {
      id: 'l-backend',
      key: 'backend',
      label: 'Backend & data',
      value: [backendLabels.join(', '), backend?.freeText].filter(Boolean).join(', ') || 'Decided during planning',
    },
    {
      id: 'l-integrations',
      key: 'integrations',
      label: 'Integrations',
      value: w.integrations.length
        ? w.integrations.map((i) => (i.requested ? `${i.label} (Prism authors)` : i.label)).join(', ')
        : 'None yet — add anytime',
    },
    {
      id: 'l-github',
      key: 'github',
      label: 'GitHub import',
      value: w.githubImport?.requested ? w.githubImport.repo || 'Import an existing repo' : 'Starting fresh',
    },
    {
      id: 'l-deploy',
      key: 'deploy',
      label: 'Deploy target',
      value: DEPLOY_OPTIONS.find((d) => d.id === w.deployTarget)?.label ?? 'Decide at ship time',
    },
  ];

  const seedsUsed = w.seedsUsed.slice(0, 12).map((s) => ({ kind: s.kind, detail: s.detail }));
  if (direction) {
    seedsUsed.unshift({ kind: 'prompt', detail: `Direction “${direction.name}” seeded the palette & type` });
  }

  return {
    v: 1,
    title: titleFromPrompt(brandProfile.name !== 'Untitled brand' ? brandProfile.name : w.prompt),
    prompt: w.prompt,
    brandProfile,
    chosenDirectionId: w.chosenDirectionId,
    lines,
    integrations: w.integrations,
    githubImport: w.githubImport,
    deployTarget: w.deployTarget,
    seedsUsed,
    answers: Object.values(w.answers),
    branchCount: w.branchCount,
    fastPath: w.fastPath,
  };
}
