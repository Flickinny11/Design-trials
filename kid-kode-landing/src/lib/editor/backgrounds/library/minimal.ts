// W-BG catalog — Minimal & Flat (grammar: oversized-type-editorial ground +
// editorial-product-gallery restraint).
//
// Eight 2d-FIRST entries (W-2D): the quiet grounds a flat data/docs/admin hub
// actually wants — near-still washes, one-line accents, faint grain. Every
// entry here is affirmatively '2d'-tagged AND T0. Motion is 'still' or 'calm'
// by design: these must never fight a table.

import type { BackgroundPreset } from "../types";
import { makePreset } from "./build-helpers";

export const MINIMAL_PRESETS: readonly BackgroundPreset[] = Object.freeze([
  makePreset({
    id: "paper",
    name: "Paper",
    description:
      "The lightest ground in the catalog: a pale silver field with the faintest breathing wash — reads as warm paper.",
    tagline: "pale paper ground",
    category: "minimal",
    motion: "still",
    renderModes: ["2d", "3d"],
    perfTier: "T0",
    grammarFamily: "oversized-type-editorial",
    keywords: ["paper", "light", "clean", "minimal", "docs", "quiet"],
    defaults: {
      palette: "mercury",
      density: 0.35,
      drift: 0.1,
      depthSpread: 0.4,
      intensity: 0.45,
    },
    layers: [
      { suffix: "env", kind: "gradient-volume", params: { variant: "wash" } },
    ],
  }),
  makePreset({
    id: "graphite-grain",
    name: "Graphite Grain",
    description:
      "Near-black graphite with sparse slow dust barely catching light — texture you feel more than see.",
    tagline: "dark grain texture",
    category: "minimal",
    motion: "still",
    renderModes: ["2d", "3d"],
    perfTier: "T0",
    grammarFamily: "oversized-type-editorial",
    keywords: ["grain", "dark", "texture", "graphite", "subtle", "admin"],
    defaults: {
      palette: "noir",
      density: 0.3,
      drift: 0.12,
      depthSpread: 0.4,
      intensity: 0.4,
    },
    layers: [
      { suffix: "env", kind: "gradient-volume", params: { variant: "wash" } },
      {
        suffix: "grain",
        kind: "particle-field",
        attachment: "camera-locked",
        z: -30,
        opacity: 0.5,
        parallaxDepth: 0.1,
        params: (p) => ({ variant: "dust", density: (p.density ?? 0.3) * 0.5 }),
      },
    ],
  }),
  makePreset({
    id: "ledger-calm",
    name: "Ledger Calm",
    description:
      "A cool, dim ice wash with one faint horizon line low in frame — built for dashboards and data pages.",
    tagline: "cool dashboard ground",
    category: "minimal",
    motion: "still",
    renderModes: ["2d", "3d"],
    perfTier: "T0",
    grammarFamily: "oversized-type-editorial",
    keywords: ["dashboard", "data", "ledger", "cool", "calm", "table"],
    defaults: {
      palette: "ice",
      density: 0.35,
      drift: 0.1,
      depthSpread: 0.4,
      intensity: 0.4,
    },
    layers: [
      {
        suffix: "env",
        kind: "gradient-volume",
        params: { variant: "horizon" },
      },
    ],
  }),
  makePreset({
    id: "slate",
    name: "Slate",
    description:
      "A single graded slate field, nothing else — the disciplined default for serious tools.",
    tagline: "disciplined slate field",
    category: "minimal",
    motion: "still",
    renderModes: ["2d", "3d"],
    perfTier: "T0",
    grammarFamily: "oversized-type-editorial",
    keywords: ["slate", "neutral", "serious", "tool", "default", "plain"],
    defaults: {
      palette: "deep",
      density: 0.3,
      drift: 0.08,
      depthSpread: 0.4,
      intensity: 0.35,
    },
    layers: [
      { suffix: "env", kind: "gradient-volume", params: { variant: "wash" } },
    ],
  }),
  makePreset({
    id: "linen",
    name: "Linen",
    description:
      "A woven bone-toned sheet at near-zero drift — cloth texture for warm editorial pages.",
    tagline: "woven cloth ground",
    category: "minimal",
    motion: "calm",
    renderModes: ["2d", "3d"],
    perfTier: "T0",
    grammarFamily: "oversized-type-editorial",
    keywords: ["linen", "cloth", "woven", "warm", "editorial", "texture"],
    defaults: {
      palette: "bone",
      density: 0.4,
      drift: 0.08,
      depthSpread: 0.4,
      intensity: 0.45,
    },
    layers: [
      {
        suffix: "weave",
        kind: "fluid-overlay",
        z: -60,
        opacity: 0.5,
        params: { variant: "silk" },
      },
    ],
  }),
  makePreset({
    id: "arc-whisper",
    name: "Arc Whisper",
    description:
      "Black, with one faint cyan line breathing on the horizon — the quietest possible brand accent.",
    tagline: "one cyan whisper",
    category: "minimal",
    motion: "still",
    renderModes: ["2d", "3d"],
    perfTier: "T0",
    grammarFamily: "oversized-type-editorial",
    keywords: ["accent", "cyan", "line", "dark", "brand", "minimal"],
    defaults: {
      palette: "arc",
      density: 0.3,
      drift: 0.12,
      depthSpread: 0.4,
      intensity: 0.45,
    },
    layers: [
      {
        suffix: "line",
        kind: "gradient-volume",
        params: (p) => ({
          variant: "horizon",
          intensity: (p.intensity ?? 0.45) * 0.8,
        }),
      },
    ],
  }),
  makePreset({
    id: "hearth",
    name: "Hearth",
    description:
      "A low warm glow rising from the floor of the frame — hospitality warmth under a dark room.",
    tagline: "low warm floor glow",
    category: "minimal",
    motion: "calm",
    renderModes: ["2d", "3d"],
    perfTier: "T0",
    grammarFamily: "oversized-type-editorial",
    keywords: ["warm", "hospitality", "glow", "floor", "cozy", "restaurant"],
    defaults: {
      palette: "ember",
      density: 0.35,
      drift: 0.15,
      depthSpread: 0.4,
      intensity: 0.45,
    },
    layers: [
      { suffix: "env", kind: "gradient-volume", params: { variant: "spot" } },
    ],
  }),
  makePreset({
    id: "mist-floor",
    name: "Mist Floor",
    description:
      "Thin grey mist pooling at the bottom of a dark field — depth suggested, never insisted on.",
    tagline: "pooling floor mist",
    category: "minimal",
    motion: "calm",
    renderModes: ["2d", "3d"],
    perfTier: "T0",
    grammarFamily: "oversized-type-editorial",
    keywords: ["mist", "fog", "floor", "grey", "soft", "depth"],
    defaults: {
      palette: "noir",
      density: 0.4,
      drift: 0.18,
      depthSpread: 0.45,
      intensity: 0.4,
    },
    layers: [
      { suffix: "env", kind: "gradient-volume", params: { variant: "wash" } },
      {
        suffix: "mist",
        kind: "fluid-overlay",
        z: -70,
        opacity: 0.4,
        params: { variant: "smoke" },
      },
    ],
  }),
]);
