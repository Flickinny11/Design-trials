// W-BG — prompt-to-background CORE (pure: no fs, no React, no network).
//
// Everything decidable from data lives here so it is unit-testable: deriving
// a background BRIEF from the user's prompt + the hub's live context
// (elements / palette / mood / render mode), choosing a design-grammar
// FAMILY with anti-repetition (usage-count rotation + cluster diversity —
// the corpus discipline from selectDistinctOptions, re-stated over the
// background-capable pool), and synthesizing the R1 procedural layer stack
// in that family's technique vocabulary. The corpus itself stays OUTSIDE
// src (catalog-types.ts law): the server route reads families/*.json from
// disk as DATA and feeds the lite shapes below.

import type {
  PrismHubBackgroundLayer,
  BackgroundLayerParams,
} from "../../prism-graph/types";
import { BACKGROUND_PALETTES, getBackgroundPalette } from "./palettes";

// ── inputs ───────────────────────────────────────────────────────────────────

export interface HubContextNode {
  caption?: string | null;
  subtype?: string | null;
  baseColor?: string | null;
}

export interface HubGenerateContext {
  hubId: string;
  title?: string | null;
  renderMode: "2d" | "3d";
  identity?: string | null;
  activePalette?: string | null;
  nodes?: HubContextNode[];
}

/** Lite view of a design-grammar family doc (read from disk by the route —
 *  src never imports the corpus module). */
export interface BackgroundFamilyLite {
  id: string;
  clusterId: string;
  renderModes: readonly ("2d" | "3d")[];
}

/** The grammar families a BACKGROUND can be derived from. */
export const BACKGROUND_FAMILY_POOL: readonly string[] = Object.freeze([
  "particle-field-hero",
  "gpu-fluid-overlay",
  "layered-photo-parallax-hero",
  "parallax-zoom-deep-dive",
  "cinematic-video-hero",
  "glitch-cyber-fx",
  "hover-morph-distortion",
  "editorial-product-gallery",
  "oversized-type-editorial",
]);

// ── brief derivation ─────────────────────────────────────────────────────────

export type BriefMotion = "still" | "calm" | "drift" | "flow" | "energetic";

export interface BackgroundBrief {
  renderMode: "2d" | "3d";
  /** Background palette id (palettes.ts vocabulary). */
  palette: string;
  motion: BriefMotion;
  /** True when the prompt asks for a photographic scene. */
  wantsPhoto: boolean;
  /** Matched vocabulary (for the name + telemetry). */
  moodTokens: string[];
}

const PALETTE_HINTS: Record<string, string[]> = {
  ember: [
    "warm",
    "ember",
    "orange",
    "fire",
    "sunset",
    "dusk",
    "hearth",
    "cozy",
    "amber",
  ],
  garnet: ["red", "wine", "crimson", "garnet", "blood", "ruby"],
  verdant: [
    "green",
    "forest",
    "nature",
    "organic",
    "emerald",
    "moss",
    "aurora",
  ],
  ice: ["ice", "cold", "winter", "frost", "arctic", "snow", "glacier"],
  anodized: [
    "blue",
    "ocean",
    "rain",
    "storm",
    "water",
    "sea",
    "harbor",
    "navy",
  ],
  arc: ["electric", "cyan", "neon", "tech", "signal", "laser"],
  mercury: ["silver", "bright", "white", "pale", "airy", "high-key"],
  noir: ["black", "noir", "shadow", "midnight"],
  bone: ["neutral", "beige", "paper", "linen", "editorial", "cream"],
  deep: ["graphite", "slate", "space", "void"],
};

const MOTION_HINTS: Record<BriefMotion, string[]> = {
  still: ["still", "static", "frozen", "motionless", "no motion"],
  calm: [
    "calm",
    "slow",
    "gentle",
    "quiet",
    "subtle",
    "soft",
    "peaceful",
    "reading",
  ],
  flow: ["flow", "flowing", "silk", "liquid", "ink", "stream", "ripple"],
  energetic: [
    "fast",
    "energetic",
    "electric",
    "bold",
    "loud",
    "storm",
    "plasma",
    "intense",
  ],
  drift: ["drift", "float", "breeze"],
};

const PHOTO_HINTS = [
  "photo",
  "photograph",
  "photoreal",
  "realistic",
  "landscape",
  "mountain",
  "city",
  "skyline",
  "forest",
  "ocean",
  "beach",
  "desert",
  "coast",
  "harbor",
  "scenery",
  "scene of",
  "vista",
];

const IDENTITY_PALETTE: Record<string, string> = {
  "brass-gas-giant": "brass",
  "bone-rock": "bone",
  "ice-crystal": "ice",
  "deep-ocean": "anodized",
  "ember-forge": "ember",
};

function matchTokens(text: string, hints: string[]): string[] {
  // Word-boundary matching — plain substring matching false-positives on
  // fragments ("something nICE" is not a request for the ice palette).
  return hints.filter((h) =>
    new RegExp(`\\b${h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text),
  );
}

/** Nearest background palette to a set of node base colours (average hue /
 *  lightness buckets over the DS-token palette identities). */
export function paletteFromColors(colors: string[]): string | null {
  const parsed = colors
    .map((c) => /^#?([0-9a-f]{6})$/i.exec(c.trim())?.[1])
    .filter((v): v is string => !!v)
    .map((hex) => {
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 2;
      const d = max - min;
      let h = 0;
      if (d > 0.001) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h = (h * 60 + 360) % 360;
      }
      return { h, s: d < 0.001 ? 0 : d / (1 - Math.abs(2 * l - 1)), l };
    });
  if (parsed.length === 0) return null;
  // Chromatic votes beat greys; greys vote by lightness.
  const chroma = parsed.filter((c) => c.s > 0.14);
  if (chroma.length > 0) {
    const h = chroma.reduce((s, c) => s + c.h, 0) / chroma.length;
    if (h < 20 || h >= 340) return "garnet";
    if (h < 65) return "ember";
    if (h < 170) return "verdant";
    if (h < 210) return "arc";
    if (h < 270) return "anodized";
    return "garnet"; // 270-340 magenta band — nearest sanctioned identity is red
  }
  const l = parsed.reduce((s, c) => s + c.l, 0) / parsed.length;
  if (l > 0.7) return "mercury";
  if (l < 0.2) return "noir";
  return "deep";
}

export function deriveBackgroundBrief(
  prompt: string,
  hub: HubGenerateContext,
): BackgroundBrief {
  const text = `${prompt}`.toLowerCase();
  const moodTokens: string[] = [];

  // 1. Palette: prompt words → node colours → active palette → planet identity.
  let palette: string | null = null;
  for (const [id, hints] of Object.entries(PALETTE_HINTS)) {
    const hit = matchTokens(text, hints);
    if (hit.length > 0) {
      moodTokens.push(...hit);
      palette = id;
      break;
    }
  }
  if (!palette) {
    const colors = (hub.nodes ?? [])
      .map((n) => n.baseColor)
      .filter((c): c is string => typeof c === "string" && c.length > 0);
    palette = paletteFromColors(colors);
  }
  if (!palette && hub.activePalette && BACKGROUND_PALETTES[hub.activePalette]) {
    palette = hub.activePalette;
  }
  if (!palette && hub.identity && IDENTITY_PALETTE[hub.identity]) {
    palette = IDENTITY_PALETTE[hub.identity];
  }
  if (!palette) palette = "deep";

  // 2. Motion: prompt wins; a flat hub defaults quieter (W-2D taste law).
  let motion: BriefMotion | null = null;
  for (const m of [
    "still",
    "energetic",
    "flow",
    "calm",
    "drift",
  ] as BriefMotion[]) {
    const hit = matchTokens(text, MOTION_HINTS[m]);
    if (hit.length > 0) {
      moodTokens.push(...hit);
      motion = m;
      break;
    }
  }
  if (!motion) motion = hub.renderMode === "2d" ? "calm" : "drift";

  const photoHits = matchTokens(text, PHOTO_HINTS);
  moodTokens.push(...photoHits);

  return {
    renderMode: hub.renderMode,
    palette,
    motion,
    wantsPhoto: photoHits.length > 0,
    moodTokens: [...new Set(moodTokens)],
  };
}

// ── family choice (anti-repetition) ──────────────────────────────────────────

const FAMILY_AFFINITY: Record<string, string[]> = {
  "particle-field-hero": [
    "particle",
    "star",
    "ember",
    "snow",
    "rain",
    "dust",
    "firefl",
    "sparkle",
    "field",
  ],
  "gpu-fluid-overlay": [
    "fluid",
    "silk",
    "liquid",
    "water",
    "caustic",
    "smoke",
    "wave",
    "flow",
  ],
  "layered-photo-parallax-hero": PHOTO_HINTS,
  "parallax-zoom-deep-dive": [
    "deep",
    "space",
    "travel",
    "dive",
    "journey",
    "warp",
    "void",
  ],
  "cinematic-video-hero": [
    "dawn",
    "dusk",
    "horizon",
    "light",
    "beam",
    "ray",
    "glow",
    "cinematic",
    "sunrise",
    "sunset",
  ],
  "glitch-cyber-fx": [
    "glitch",
    "cyber",
    "radar",
    "signal",
    "ring",
    "pulse",
    "tech",
  ],
  "hover-morph-distortion": ["ink", "morph", "distort", "marble", "ripple"],
  "editorial-product-gallery": [
    "studio",
    "product",
    "spotlight",
    "stage",
    "showroom",
    "clean",
  ],
  "oversized-type-editorial": [
    "minimal",
    "paper",
    "quiet",
    "plain",
    "simple",
    "subtle",
    "editorial",
  ],
};

export interface FamilyChoice {
  familyId: string;
  clusterId: string;
  affinity: number;
}

/** Pick the grammar family for this generation. Anti-repetition mirrors the
 *  corpus selectDistinctOptions discipline: least-used first, avoid repeating
 *  the previous generation's antiRepetition CLUSTER, break ties by prompt
 *  affinity then id. A strong prompt affinity (>=2 hits) overrides rotation —
 *  when the user literally asks for silk, silk wins. */
export function chooseBackgroundFamily(
  families: readonly BackgroundFamilyLite[],
  brief: BackgroundBrief,
  prompt: string,
  usageCounts: Record<string, number> = {},
  lastClusterId?: string | null,
): FamilyChoice | null {
  const text = prompt.toLowerCase();
  const pool = families.filter(
    (f) =>
      BACKGROUND_FAMILY_POOL.includes(f.id) &&
      (brief.renderMode === "3d" || f.renderModes.includes("2d")),
  );
  if (pool.length === 0) return null;

  const scored = pool.map((f) => ({
    familyId: f.id,
    clusterId: f.clusterId,
    affinity: matchTokens(text, FAMILY_AFFINITY[f.id] ?? []).length,
    usage: usageCounts[f.id] ?? 0,
  }));

  const maxAffinity = Math.max(...scored.map((s) => s.affinity));
  if (maxAffinity >= 2) {
    // Explicit ask — honor it (rotation applies within the tied set).
    const top = scored
      .filter((s) => s.affinity === maxAffinity)
      .sort(
        (a, b) => a.usage - b.usage || a.familyId.localeCompare(b.familyId),
      );
    return top[0];
  }

  // Rotation: least-used, cluster-diverse vs the previous generation.
  const sorted = [...scored].sort(
    (a, b) =>
      a.usage - b.usage ||
      b.affinity - a.affinity ||
      a.familyId.localeCompare(b.familyId),
  );
  const diverse = sorted.find(
    (s) => !lastClusterId || s.clusterId !== lastClusterId,
  );
  return diverse ?? sorted[0];
}

// ── R1 synthesis ─────────────────────────────────────────────────────────────

const MOTION_PARAMS: Record<
  BriefMotion,
  { density: number; drift: number; intensity: number }
> = {
  still: { density: 0.32, drift: 0.08, intensity: 0.42 },
  calm: { density: 0.4, drift: 0.25, intensity: 0.5 },
  drift: { density: 0.5, drift: 0.45, intensity: 0.55 },
  flow: { density: 0.5, drift: 0.5, intensity: 0.6 },
  energetic: { density: 0.6, drift: 0.75, intensity: 0.7 },
};

function layer(
  idPrefix: string,
  suffix: string,
  kind: PrismHubBackgroundLayer["kind"],
  brief: BackgroundBrief,
  overrides: Partial<PrismHubBackgroundLayer> & {
    params?: Partial<BackgroundLayerParams>;
  } = {},
): PrismHubBackgroundLayer {
  const m = MOTION_PARAMS[brief.motion];
  const { params: paramOverrides, ...layerOverrides } = overrides;
  return {
    id: `${idPrefix}-${suffix}`,
    attachment:
      kind === "volumetric-nebula" || kind === "gradient-volume"
        ? "infinite-environment"
        : "world",
    kind,
    z: kind === "volumetric-nebula" || kind === "gradient-volume" ? -430 : -100,
    opacity: 1,
    parallaxDepth: 0.7,
    params: {
      palette: brief.palette,
      density: m.density,
      drift: m.drift,
      depthSpread: brief.renderMode === "2d" ? 0.4 : 0.65,
      intensity: m.intensity,
      ...paramOverrides,
    },
    ...layerOverrides,
  };
}

function particleVariantFor(brief: BackgroundBrief): string {
  const t = brief.moodTokens.join(" ");
  if (t.includes("snow")) return "snow";
  if (t.includes("rain") || t.includes("storm")) return "rain";
  if (brief.palette === "ember") return "embers";
  if (brief.palette === "verdant") return "fireflies";
  if (brief.palette === "garnet") return "ash";
  if (brief.palette === "ice") return "crystals";
  if (brief.palette === "mercury" || brief.palette === "bone") return "dust";
  return "starfield";
}

function fluidVariantFor(brief: BackgroundBrief): string {
  const t = brief.moodTokens.join(" ");
  if (brief.motion === "energetic") return "plasma";
  if (t.includes("caustic") || t.includes("water") || t.includes("pool"))
    return "caustic";
  if (t.includes("ink") || t.includes("marble")) return "ink";
  if (t.includes("smoke")) return "smoke";
  return "silk";
}

function gradientVariantFor(brief: BackgroundBrief, prompt: string): string {
  const t = `${prompt.toLowerCase()} ${brief.moodTokens.join(" ")}`;
  if (t.includes("aurora")) return "aurora";
  if (
    t.includes("dawn") ||
    t.includes("dusk") ||
    t.includes("horizon") ||
    t.includes("sunset") ||
    t.includes("sunrise")
  )
    return "horizon";
  if (t.includes("beam") || t.includes("ray") || t.includes("shaft"))
    return "beams";
  if (t.includes("spotlight") || t.includes("stage")) return "spot";
  if (t.includes("ring") || t.includes("radar") || t.includes("pulse"))
    return "rings";
  return "wash";
}

/** Synthesize the R1 procedural stack for a family, in the hub's brief. Every
 *  layer id is prefixed with the generation id (stable per saved item). */
export function synthesizeR1Stack(
  familyId: string,
  brief: BackgroundBrief,
  prompt: string,
  idPrefix: string,
): PrismHubBackgroundLayer[] {
  const flat = brief.renderMode === "2d";
  switch (familyId) {
    case "particle-field-hero": {
      const env = flat
        ? layer(idPrefix, "env", "gradient-volume", brief, {
            params: { variant: "wash" },
          })
        : layer(idPrefix, "env", "volumetric-nebula", brief);
      return [
        env,
        layer(idPrefix, "field", "particle-field", brief, {
          z: -120,
          params: { variant: particleVariantFor(brief) },
        }),
      ];
    }
    case "gpu-fluid-overlay":
      return [
        layer(idPrefix, "env", "gradient-volume", brief, {
          params: {
            variant: "wash",
            intensity: MOTION_PARAMS[brief.motion].intensity * 0.5,
          },
        }),
        layer(idPrefix, "fluid", "fluid-overlay", brief, {
          z: -55,
          params: { variant: fluidVariantFor(brief) },
        }),
      ];
    case "parallax-zoom-deep-dive":
      return [
        layer(idPrefix, "env", "volumetric-nebula", brief, {
          params: { depthSpread: 0.9 },
        }),
        layer(idPrefix, "stars", "particle-field", brief, {
          z: -170,
          params: { variant: "starfield", depthSpread: 0.95 },
        }),
      ];
    case "glitch-cyber-fx":
      return [
        layer(idPrefix, "rings", "gradient-volume", brief, {
          params: { variant: "rings" },
        }),
        layer(idPrefix, "plasma", "fluid-overlay", brief, {
          z: -55,
          opacity: 0.6,
          params: { variant: "plasma" },
        }),
      ];
    case "hover-morph-distortion":
      return [
        layer(idPrefix, "ink", "fluid-overlay", brief, {
          z: -60,
          params: { variant: "ink" },
        }),
      ];
    case "editorial-product-gallery":
      return [
        layer(idPrefix, "spot", "gradient-volume", brief, {
          params: { variant: "spot" },
        }),
        layer(idPrefix, "dust", "particle-field", brief, {
          z: -100,
          opacity: 0.6,
          params: {
            variant: "dust",
            density: MOTION_PARAMS[brief.motion].density * 0.6,
          },
        }),
      ];
    case "oversized-type-editorial":
      return [
        layer(idPrefix, "wash", "gradient-volume", brief, {
          params: {
            variant: "wash",
            intensity: MOTION_PARAMS[brief.motion].intensity * 0.8,
          },
        }),
      ];
    case "cinematic-video-hero":
    default:
      return [
        layer(idPrefix, "light", "gradient-volume", brief, {
          params: { variant: gradientVariantFor(brief, prompt) },
        }),
      ];
  }
}

/** Procedural accents layered IN FRONT of a generated R2/R3 photo plate so it
 *  reads as a scene, not a wallpaper (same doctrine as the plates category). */
export function synthesizePlateAccents(
  brief: BackgroundBrief,
  idPrefix: string,
): PrismHubBackgroundLayer[] {
  return [
    layer(idPrefix, "accent", "particle-field", brief, {
      z: -110,
      opacity: 0.55,
      params: {
        variant: particleVariantFor(brief),
        density: MOTION_PARAMS[brief.motion].density * 0.6,
      },
    }),
  ];
}

// ── naming ───────────────────────────────────────────────────────────────────

const FAMILY_NOUN: Record<string, string> = {
  "particle-field-hero": "Field",
  "gpu-fluid-overlay": "Flow",
  "layered-photo-parallax-hero": "Scene",
  "parallax-zoom-deep-dive": "Depths",
  "cinematic-video-hero": "Light",
  "glitch-cyber-fx": "Signal",
  "hover-morph-distortion": "Ink",
  "editorial-product-gallery": "Studio",
  "oversized-type-editorial": "Ground",
};

export function nameForGeneration(
  brief: BackgroundBrief,
  familyId: string,
): string {
  const paletteLabel = getBackgroundPalette(brief.palette).label;
  const noun = FAMILY_NOUN[familyId] ?? "Background";
  return `${paletteLabel} ${noun}`;
}
