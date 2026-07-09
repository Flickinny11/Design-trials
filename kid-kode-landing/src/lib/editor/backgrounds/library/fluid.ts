// W-BG catalog — Fluid & Silk (grammar: gpu-fluid-overlay cluster, with
// hover-morph-distortion informing the ink pair and glitch-cyber-fx the
// plasma entry).
//
// Eight flowing-media identities. Most are 2d-affirmative: a slow silk or
// ink field behind a flat page is the classic premium-editorial move.

import type { BackgroundPreset } from "../types";
import { makePreset } from "./build-helpers";

export const FLUID_PRESETS: readonly BackgroundPreset[] = Object.freeze([
  makePreset({
    id: "chrome-silk",
    name: "Chrome Silk",
    description:
      "Stretched metal-toned ribbons flowing horizontally over a quiet dark wash — liquid titanium.",
    tagline: "liquid titanium ribbons",
    category: "fluid",
    motion: "flow",
    renderModes: ["2d", "3d"],
    perfTier: "T1",
    grammarFamily: "gpu-fluid-overlay",
    keywords: ["silk", "chrome", "metal", "ribbons", "premium", "flow"],
    defaults: {
      palette: "brass",
      density: 0.55,
      drift: 0.45,
      depthSpread: 0.5,
      intensity: 0.6,
    },
    layers: [
      {
        suffix: "env",
        kind: "gradient-volume",
        opacity: 1,
        params: (p) => ({
          variant: "wash",
          palette: "noir",
          intensity: (p.intensity ?? 0.6) * 0.5,
        }),
      },
      {
        suffix: "silk",
        kind: "fluid-overlay",
        z: -55,
        params: { variant: "silk" },
      },
    ],
  }),
  makePreset({
    id: "glacier-silk",
    name: "Glacier Silk",
    description:
      "Ice-blue silk sheets sliding past each other — cool, slow, and immaculate.",
    tagline: "ice silk sheets",
    category: "fluid",
    motion: "flow",
    renderModes: ["2d", "3d"],
    perfTier: "T1",
    grammarFamily: "gpu-fluid-overlay",
    keywords: ["silk", "ice", "cool", "slow", "elegant", "blue"],
    defaults: {
      palette: "ice",
      density: 0.5,
      drift: 0.35,
      depthSpread: 0.5,
      intensity: 0.6,
    },
    layers: [
      {
        suffix: "env",
        kind: "gradient-volume",
        params: (p) => ({
          variant: "wash",
          intensity: (p.intensity ?? 0.6) * 0.45,
        }),
      },
      {
        suffix: "silk",
        kind: "fluid-overlay",
        z: -55,
        params: { variant: "silk" },
      },
    ],
  }),
  makePreset({
    id: "ink-tide",
    name: "Ink Tide",
    description:
      "Pale marbled ink billowing over near-black — the editorial marbling plate, in constant slow motion.",
    tagline: "editorial ink marble",
    category: "fluid",
    motion: "flow",
    renderModes: ["2d", "3d"],
    perfTier: "T1",
    grammarFamily: "hover-morph-distortion",
    keywords: ["ink", "marble", "editorial", "monochrome", "organic", "print"],
    defaults: {
      palette: "bone",
      density: 0.5,
      drift: 0.3,
      depthSpread: 0.5,
      intensity: 0.5,
    },
    layers: [
      {
        suffix: "ink",
        kind: "fluid-overlay",
        z: -60,
        params: { variant: "ink" },
      },
    ],
  }),
  makePreset({
    id: "garnet-ink",
    name: "Garnet Ink",
    description:
      "Dark red ink blooming through black water — richer and moodier than its editorial sibling.",
    tagline: "red ink in water",
    category: "fluid",
    motion: "flow",
    renderModes: ["2d", "3d"],
    perfTier: "T1",
    grammarFamily: "hover-morph-distortion",
    keywords: ["ink", "red", "moody", "bloom", "dark", "wine"],
    defaults: {
      palette: "garnet",
      density: 0.55,
      drift: 0.28,
      depthSpread: 0.5,
      intensity: 0.55,
    },
    layers: [
      {
        suffix: "ink",
        kind: "fluid-overlay",
        z: -60,
        params: { variant: "ink" },
      },
    ],
  }),
  makePreset({
    id: "poollight",
    name: "Poollight",
    description:
      "Bright caustic webs refracting across the dark — sunlight through water, slowed to a breath.",
    tagline: "underwater light webs",
    category: "fluid",
    motion: "flow",
    renderModes: ["2d", "3d"],
    perfTier: "T1",
    grammarFamily: "gpu-fluid-overlay",
    keywords: ["caustic", "water", "pool", "light", "refraction", "summer"],
    defaults: {
      palette: "ice",
      density: 0.5,
      drift: 0.5,
      depthSpread: 0.5,
      intensity: 0.7,
    },
    layers: [
      {
        suffix: "env",
        kind: "gradient-volume",
        params: (p) => ({
          variant: "wash",
          palette: "anodized",
          intensity: (p.intensity ?? 0.7) * 0.4,
        }),
      },
      {
        suffix: "caustics",
        kind: "fluid-overlay",
        z: -50,
        params: { variant: "caustic" },
      },
    ],
  }),
  makePreset({
    id: "ember-smoke",
    name: "Ember Smoke",
    description:
      "Warm smoke rising through the frame with a few live sparks — the campfire read without the fire.",
    tagline: "rising warm smoke",
    category: "fluid",
    motion: "drift",
    renderModes: ["3d"],
    perfTier: "T1",
    grammarFamily: "gpu-fluid-overlay",
    keywords: ["smoke", "warm", "sparks", "campfire", "cozy", "rising"],
    defaults: {
      palette: "ember",
      density: 0.5,
      drift: 0.4,
      depthSpread: 0.55,
      intensity: 0.55,
    },
    layers: [
      {
        suffix: "smoke",
        kind: "fluid-overlay",
        z: -70,
        params: { variant: "smoke" },
      },
      {
        suffix: "sparks",
        kind: "particle-field",
        z: -100,
        opacity: 0.8,
        params: (p) => ({
          variant: "embers",
          density: (p.density ?? 0.5) * 0.4,
        }),
      },
    ],
  }),
  makePreset({
    id: "plasma-field",
    name: "Plasma Field",
    description:
      "Fast electric bands warping through cyan — the most energetic surface in the catalog. Use loud.",
    tagline: "electric warp bands",
    category: "fluid",
    motion: "energetic",
    renderModes: ["3d"],
    perfTier: "T1",
    grammarFamily: "glitch-cyber-fx",
    keywords: ["plasma", "electric", "energy", "warp", "loud", "cyber"],
    defaults: {
      palette: "arc",
      density: 0.6,
      drift: 0.75,
      depthSpread: 0.5,
      intensity: 0.7,
    },
    layers: [
      {
        suffix: "env",
        kind: "gradient-volume",
        params: (p) => ({
          variant: "wash",
          palette: "noir",
          intensity: (p.intensity ?? 0.7) * 0.4,
        }),
      },
      {
        suffix: "plasma",
        kind: "fluid-overlay",
        z: -55,
        params: { variant: "plasma" },
      },
    ],
  }),
  makePreset({
    id: "verdant-caustics",
    name: "Verdant Caustics",
    description:
      "Dim green light webs crawling slowly — bioluminescence at the bottom of a still sea.",
    tagline: "bioluminescent webs",
    category: "fluid",
    motion: "flow",
    renderModes: ["2d", "3d"],
    perfTier: "T1",
    grammarFamily: "gpu-fluid-overlay",
    keywords: ["caustic", "green", "bioluminescent", "sea", "organic", "dim"],
    defaults: {
      palette: "verdant",
      density: 0.45,
      drift: 0.3,
      depthSpread: 0.5,
      intensity: 0.5,
    },
    layers: [
      {
        suffix: "caustics",
        kind: "fluid-overlay",
        z: -55,
        params: { variant: "caustic" },
      },
    ],
  }),
]);
