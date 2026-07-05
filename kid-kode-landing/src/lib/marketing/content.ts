// PRISM MARKETING — CONTENT MODEL (SHELL W6, S2 / decision D / E2 / E6)
//
// The public marketing surface is SSR/SEO (decision D). Its copy + gallery +
// pricing structure live here as typed data so the pages stay server-rendered
// (crawlable) and the 3D islands hydrate on top. NO model-id strings live in
// this file (spec 7.4 / FP4) — the pricing page pulls model labels from
// getModelRegistry() at render time. No emoji, no icon-pack names (DL5).
//
// Every claim here is anchored to shipped shell waves (W0–W5): the Conductor
// engine (W5), guided intake (W2), integrations spine (W3), dashboard + E1
// timeline (W4), tenancy isolation (W1A). Marketing never promises a surface
// that isn't built.

export interface HowStep {
  readonly n: string;
  readonly kicker: string;
  readonly title: string;
  readonly body: string;
}

/** The guided path, condensed from spec §3 (Phases 0–6) into the three moves
 *  a first-time visitor needs to believe. */
export const HOW_STEPS: readonly HowStep[] = [
  {
    n: '01',
    kicker: 'Describe',
    title: 'Say what you want to build',
    body: 'One prompt starts it. The guided intake asks a few visual questions — archetype, direction, the capabilities it needs — each with a "describe your own" escape hatch. Skip them all and just build if you already know.',
  },
  {
    n: '02',
    kicker: 'Watch it build',
    title: 'The Conductor authors your app live',
    body: 'A single orchestrator composes your app as a real 3D knowledge graph, streaming each wave into the engine as it lands. You approve the Build Brief before a line is generated — nothing runs without your sign-off.',
  },
  {
    n: '03',
    kicker: 'Ship it',
    title: 'Verified, then live',
    body: 'Every build is checked — it behaves, it looks right, it deploys — before it earns the word "shippable". Then it runs at a real URL, or exports as a portable bundle you own.',
  },
] as const;

export interface Feature {
  readonly icon: 'build' | 'integrate' | 'deploy' | 'project' | 'chat' | 'settings';
  readonly title: string;
  readonly body: string;
}

/** DL5 — each card is fronted by a custom 3D geometric icon from the
 *  premium.ts set (PremiumIconSet), never an icon-pack glyph. */
export const FEATURES: readonly Feature[] = [
  {
    icon: 'build',
    title: 'One engine, one scene',
    body: 'Your app is a single continuous 3D scene — galaxy, canvas, and live preview are states of it, not separate screens. Real WebGPU with an automatic WebGL2 fallback; no video, no mockups.',
  },
  {
    icon: 'chat',
    title: 'Edit by conversation',
    body: 'Talk to the builder or drag a handle — both make the same scoped, additive change. Touch one node and its neighbours stay exactly as they were.',
  },
  {
    icon: 'integrate',
    title: 'Connect virtually anything',
    body: 'A curated one-click catalog for the head, and an agent that authors a new connector for the long tail. If it has an API, you can wire it — one click, one review, secrets never touch the browser.',
  },
  {
    icon: 'deploy',
    title: 'Ship anywhere',
    body: 'Deploy to Prism Cloud in a click, or bring your own host. Every project exports as a portable bundle — the graph, the assets, the manifest. You are never locked in.',
  },
  {
    icon: 'project',
    title: 'Every version, reversible',
    body: 'A visual timeline of your build. Save a checkpoint, restore one in a click, and re-verify it — nothing you make is ever a one-way door.',
  },
  {
    icon: 'settings',
    title: 'Yours alone',
    body: 'Hard per-tenant isolation: your projects, storage, and builds are never visible to another account. Bring a team on the enterprise tier when you want to build together.',
  },
] as const;

export interface Template {
  readonly slug: string;
  readonly name: string;
  readonly tagline: string;
  readonly tags: readonly string[];
  /** Signature accent for the card's 3D thumbnail jewel (a hex the island
   *  reads via THREE.Color). */
  readonly accent: string;
}

/** E2 — starter gallery of .prism template graphs. "Remix" forks one into the
 *  visitor's account (handoff = sign-in → build, same as the prompt bar). */
export const TEMPLATES: readonly Template[] = [
  {
    slug: 'atelier-commerce',
    name: 'Atelier',
    tagline: 'A configurable-product storefront with a photoreal hero and a live 3D configurator.',
    tags: ['Commerce', 'Configurator', 'Scroll journey'],
    accent: '#ff2a38',
  },
  {
    slug: 'observatory-saas',
    name: 'Observatory',
    tagline: 'A SaaS marketing site with a cursor-reactive hero and a pricing that reads as instrument panel.',
    tags: ['SaaS', 'Marketing', 'Cursor-reactive'],
    accent: '#7db4ff',
  },
  {
    slug: 'orrery-portfolio',
    name: 'Orrery',
    tagline: 'A portfolio that orbits — projects as planets, each opening into its own world.',
    tags: ['Portfolio', 'Navigation', 'Particle field'],
    accent: '#ffb257',
  },
  {
    slug: 'ledger-dashboard',
    name: 'Ledger',
    tagline: 'A data dashboard with real chart nodes, a filter rail, and a dark instrument aesthetic.',
    tags: ['Dashboard', 'Data', 'Instrument'],
    accent: '#6ad1a8',
  },
  {
    slug: 'signal-launch',
    name: 'Signal',
    tagline: 'A product launch page — countdown, waitlist capture, and a particle showpiece over the fold.',
    tags: ['Launch', 'Waitlist', 'Showpiece'],
    accent: '#ff5a55',
  },
  {
    slug: 'kinetic-editorial',
    name: 'Kinetic',
    tagline: 'An editorial long-read with kinetic type, depth-parallax plates, and a reading-progress rail.',
    tags: ['Editorial', 'Kinetic type', 'Parallax'],
    accent: '#c9a2ff',
  },
] as const;

export interface PricingTier {
  readonly id: 'free' | 'pro' | 'enterprise';
  readonly name: string;
  readonly price: string;
  readonly cadence: string;
  readonly summary: string;
  readonly featured: boolean;
  readonly cta: string;
  readonly ctaHref: string;
  readonly limits: readonly { label: string; value: string }[];
  readonly perks: readonly string[];
}

/** E6 — "schema now, Stripe later". Prices are stubs, honestly labelled on the
 *  page; the limits mirror the real per-tier quotas the usage meter enforces
 *  (src/lib/shell/usage-config.ts). No model-id strings here (FP4). */
export const PRICING_TIERS: readonly PricingTier[] = [
  {
    id: 'free',
    name: 'Studio',
    price: '$0',
    cadence: 'to start',
    summary: 'Everything you need to build your first real app and ship it.',
    featured: false,
    cta: 'Start building',
    ctaHref: '/sign-up?next=%2Fapp%2Fbuild',
    limits: [
      { label: 'Projects', value: 'Up to 3' },
      { label: 'Verified builds', value: '20 / mo' },
      { label: 'Build credits', value: '100 / mo' },
      { label: 'Seats', value: '1' },
    ],
    perks: [
      'The full builder — guided intake, canvas, node editor',
      'One-click integrations from the curated catalog',
      'Deploy to Prism Cloud + portable export',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$29',
    cadence: '/ mo · stub',
    summary: 'For builders shipping real products, with room to scale.',
    featured: true,
    cta: 'Go Pro',
    ctaHref: '/sign-up?next=%2Fapp%3Fpanel%3Dtemplates',
    limits: [
      { label: 'Projects', value: 'Up to 50' },
      { label: 'Verified builds', value: '500 / mo' },
      { label: 'Build credits', value: '2,000 / mo' },
      { label: 'Seats', value: '3' },
    ],
    perks: [
      'Everything in Studio',
      'Agent-authored connectors for the long tail',
      'Custom domains + priority build lane',
      'Full version timeline with one-click restore',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Talk to us',
    cadence: '',
    summary: 'Multiple seats under one org, real-time multiplayer, and shared builds.',
    featured: false,
    cta: 'Contact sales',
    ctaHref: '/legal#contact',
    limits: [
      { label: 'Projects', value: 'Unlimited' },
      { label: 'Verified builds', value: 'Unlimited' },
      { label: 'Build credits', value: 'Unlimited' },
      { label: 'Seats', value: 'Your whole org' },
    ],
    perks: [
      'Everything in Pro',
      'Live multiplayer — presence, shared selection, co-editing',
      'A shared org dashboard and collective builds',
      'SSO, audit, and dedicated support',
    ],
  },
] as const;

export interface ChangeEntry {
  readonly version: string;
  readonly date: string;
  readonly title: string;
  readonly notes: readonly string[];
}

/** Changelog shell (E-context: competitors ship a changelog). Entries mirror
 *  the shipped shell waves so the timeline is truthful. */
export const CHANGELOG: readonly ChangeEntry[] = [
  {
    version: 'W5',
    date: '2026-07-04',
    title: 'The Conductor — prompt to live app',
    notes: [
      'A single orchestrator authors your app as a certified node graph, streaming each wave into the engine.',
      'Interruptible and resumable; every build checkpoints to the version timeline.',
      'A token-guarded live preview runs your graph in the real Prism runtime.',
    ],
  },
  {
    version: 'W4',
    date: '2026-07-04',
    title: 'Dashboard + version timeline',
    notes: [
      'A launchpad that starts a guided build from one prompt.',
      'Project gallery with real 3D thumbnails; rename, duplicate, delete.',
      'A global 3D slide-out navigation and a per-tenant usage meter.',
    ],
  },
  {
    version: 'W3',
    date: '2026-07-04',
    title: 'Connect anything',
    notes: [
      'A connect-anything catalog: curated one-click integrations plus agent-authored connectors on a miss.',
      'A GitHub App sandbox — install, import repos, and edit via reviewed pull requests.',
      'Secrets stay server-side as capability references; nothing sensitive reaches the browser.',
    ],
  },
  {
    version: 'W2',
    date: '2026-07-04',
    title: 'Guided intake',
    notes: [
      'Interleaved decision cards with visual options and a universal describe-your-own escape hatch.',
      '3D direction boards that seed your build brief.',
      'A "skip the questions, just build" fast path.',
    ],
  },
] as const;

export interface Stat {
  readonly value: string;
  readonly label: string;
}

export const STATS: readonly Stat[] = [
  { value: 'WebGPU', label: 'real-time renderer, WebGL2 fallback' },
  { value: '5 modes', label: 'one continuous scene, never a mockup' },
  { value: '1-click', label: 'deploy or portable export — no lock-in' },
  { value: '100%', label: 'per-tenant isolation by default' },
] as const;

/** FAQ for the landing / how-it-works foot. */
export const FAQ: readonly { q: string; a: string }[] = [
  {
    q: 'Is the 3D real, or a video?',
    a: 'Real. Every scene you see — the hero, your app, the preview — renders live in the browser on the same WebGPU engine that powers the product, with an automatic WebGL2 fallback for older devices.',
  },
  {
    q: 'Do I own what I build?',
    a: 'Yes. Deploy to Prism Cloud in a click, or export a portable bundle — the graph, the assets, the manifest — and host it yourself. There is no lock-in.',
  },
  {
    q: 'Can I connect my existing tools?',
    a: 'A curated catalog covers the popular integrations in one click, and when something is not on the list the agent authors a connector for it. If it has an API, you can wire it.',
  },
  {
    q: 'Is my work private?',
    a: 'By default your account is fully isolated — your projects and builds are never visible to anyone else. Bring a team together on the enterprise tier when you want to.',
  },
] as const;
