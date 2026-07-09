// W-BG catalog — Particles & Stars (grammar: particle-field-hero).
//
// Ten scattered-field identities: stars, weather (snow/rain/ash), living
// light (fireflies), and interior atmosphere (dust in beams, motes). Several
// are affirmatively 2d-tagged: a quiet scattered field over a flat wash reads
// natively on data/docs pages (W-2D), unlike depth-led families.

import type { BackgroundPreset } from "../types";
import { makePreset } from "./build-helpers";

export const PARTICLES_PRESETS: readonly BackgroundPreset[] = Object.freeze([
  makePreset({
    id: "quiet-starlight",
    name: "Quiet Starlight",
    description:
      "A sparse, dim starfield over a barely-there graphite wash — night-sky quiet that never competes with content.",
    tagline: "sparse night quiet",
    category: "particles",
    motion: "calm",
    renderModes: ["2d", "3d"],
    perfTier: "T0",
    grammarFamily: "particle-field-hero",
    keywords: ["stars", "quiet", "subtle", "night", "minimal", "dark"],
    defaults: {
      palette: "noir",
      density: 0.3,
      drift: 0.2,
      depthSpread: 0.6,
      intensity: 0.45,
    },
    layers: [
      { suffix: "env", kind: "gradient-volume", params: { variant: "wash" } },
      {
        suffix: "stars",
        kind: "particle-field",
        z: -160,
        params: (p) => ({
          variant: "starfield",
          density: (p.density ?? 0.3) * 0.8,
        }),
      },
    ],
  }),
  makePreset({
    id: "ember-rise",
    name: "Ember Rise",
    description:
      "Live embers climbing through the dark above a warm horizon line — hearth energy without a full nebula.",
    tagline: "rising hearth embers",
    category: "particles",
    motion: "drift",
    renderModes: ["3d"],
    perfTier: "T0",
    grammarFamily: "particle-field-hero",
    keywords: ["embers", "warm", "fire", "orange", "hearth", "cozy"],
    defaults: {
      palette: "ember",
      density: 0.45,
      drift: 0.5,
      depthSpread: 0.6,
      intensity: 0.6,
    },
    layers: [
      {
        suffix: "env",
        kind: "gradient-volume",
        params: { variant: "horizon" },
      },
      {
        suffix: "embers",
        kind: "particle-field",
        z: -110,
        params: { variant: "embers" },
      },
    ],
  }),
  makePreset({
    id: "first-snow",
    name: "First Snow",
    description:
      "Soft snowfall sinking through an ice-blue evening wash — every flake falls in real depth, near flakes drifting past the lens.",
    tagline: "soft evening snowfall",
    category: "particles",
    motion: "calm",
    renderModes: ["2d", "3d"],
    perfTier: "T0",
    grammarFamily: "particle-field-hero",
    keywords: ["snow", "winter", "cold", "gentle", "seasonal", "white"],
    defaults: {
      palette: "ice",
      density: 0.5,
      drift: 0.35,
      depthSpread: 0.65,
      intensity: 0.55,
    },
    layers: [
      { suffix: "env", kind: "gradient-volume", params: { variant: "wash" } },
      {
        suffix: "snow",
        kind: "particle-field",
        z: -90,
        params: { variant: "snow" },
      },
    ],
  }),
  makePreset({
    id: "rainfall",
    name: "Rainfall",
    description:
      "Thin rain streaking down through a blue dusk with a low mist floor — melancholy, cinematic weather.",
    tagline: "blue dusk rain",
    category: "particles",
    motion: "energetic",
    renderModes: ["2d", "3d"],
    perfTier: "T1",
    grammarFamily: "particle-field-hero",
    keywords: ["rain", "weather", "blue", "mood", "streaks", "dusk"],
    defaults: {
      palette: "anodized",
      density: 0.55,
      drift: 0.6,
      depthSpread: 0.6,
      intensity: 0.5,
    },
    layers: [
      {
        suffix: "env",
        kind: "gradient-volume",
        params: { variant: "horizon" },
      },
      {
        suffix: "rain",
        kind: "particle-field",
        z: -70,
        params: { variant: "rain" },
      },
      {
        suffix: "mist",
        kind: "fluid-overlay",
        z: -100,
        opacity: 0.35,
        params: (p) => ({
          variant: "smoke",
          density: (p.density ?? 0.55) * 0.5,
        }),
      },
    ],
  }),
  makePreset({
    id: "firefly-hollow",
    name: "Firefly Hollow",
    description:
      "A handful of large, slow fireflies pulsing green through a dark meadow haze, fine pollen dust behind them.",
    tagline: "green firefly night",
    category: "particles",
    motion: "calm",
    renderModes: ["3d"],
    perfTier: "T0",
    grammarFamily: "particle-field-hero",
    keywords: ["fireflies", "green", "organic", "night", "magical", "nature"],
    defaults: {
      palette: "verdant",
      density: 0.4,
      drift: 0.4,
      depthSpread: 0.55,
      intensity: 0.65,
    },
    layers: [
      { suffix: "env", kind: "gradient-volume", params: { variant: "wash" } },
      {
        suffix: "flies",
        kind: "particle-field",
        z: -60,
        params: { variant: "fireflies" },
      },
      {
        suffix: "pollen",
        kind: "particle-field",
        z: -140,
        opacity: 0.6,
        params: (p) => ({ variant: "dust", density: (p.density ?? 0.4) * 0.6 }),
      },
    ],
  }),
  makePreset({
    id: "ashfall",
    name: "Ashfall",
    description:
      "Grey ash sinking slowly against a dark garnet afterglow — sombre, heavy, quietly dramatic.",
    tagline: "sombre falling ash",
    category: "particles",
    motion: "drift",
    renderModes: ["3d"],
    perfTier: "T0",
    grammarFamily: "particle-field-hero",
    keywords: ["ash", "grey", "sombre", "dramatic", "dark", "aftermath"],
    defaults: {
      palette: "garnet",
      density: 0.42,
      drift: 0.35,
      depthSpread: 0.6,
      intensity: 0.4,
    },
    layers: [
      {
        suffix: "env",
        kind: "gradient-volume",
        params: { variant: "horizon" },
      },
      {
        suffix: "ash",
        kind: "particle-field",
        z: -90,
        params: { variant: "ash" },
      },
    ],
  }),
  makePreset({
    id: "crystal-drift",
    name: "Crystal Drift",
    description:
      "Bright ice crystals hanging in a cold spotlight — crisp, informational sparkle with almost no motion.",
    tagline: "cold crystal sparkle",
    category: "particles",
    motion: "calm",
    renderModes: ["2d", "3d"],
    perfTier: "T0",
    grammarFamily: "particle-field-hero",
    keywords: ["crystal", "ice", "sparkle", "crisp", "clean", "cold"],
    defaults: {
      palette: "ice",
      density: 0.5,
      drift: 0.2,
      depthSpread: 0.7,
      intensity: 0.6,
    },
    layers: [
      { suffix: "env", kind: "gradient-volume", params: { variant: "spot" } },
      {
        suffix: "crystals",
        kind: "particle-field",
        z: -140,
        params: { variant: "crystals" },
      },
    ],
  }),
  makePreset({
    id: "sunlit-dust",
    name: "Sunlit Dust",
    description:
      "Fine dust motes hanging in pale diagonal light shafts — the atrium-at-noon read, calm and architectural.",
    tagline: "dust in light shafts",
    category: "particles",
    motion: "calm",
    renderModes: ["2d", "3d"],
    perfTier: "T0",
    grammarFamily: "editorial-product-gallery",
    keywords: ["dust", "light", "architectural", "interior", "calm", "pale"],
    defaults: {
      palette: "bone",
      density: 0.55,
      drift: 0.25,
      depthSpread: 0.55,
      intensity: 0.6,
    },
    layers: [
      { suffix: "env", kind: "gradient-volume", params: { variant: "beams" } },
      {
        suffix: "dust",
        kind: "particle-field",
        z: -100,
        params: { variant: "dust" },
      },
    ],
  }),
  makePreset({
    id: "constellation-field",
    name: "Constellation Field",
    description:
      "A dense star canopy with a faint cyan signal ring breathing behind it — night sky with intent.",
    tagline: "dense signal stars",
    category: "particles",
    motion: "calm",
    renderModes: ["3d"],
    perfTier: "T1",
    grammarFamily: "particle-field-hero",
    keywords: ["stars", "constellation", "dense", "signal", "space", "cyan"],
    defaults: {
      palette: "arc",
      density: 0.7,
      drift: 0.25,
      depthSpread: 0.8,
      intensity: 0.55,
    },
    layers: [
      {
        suffix: "rings",
        kind: "gradient-volume",
        params: (p) => ({
          variant: "rings",
          intensity: (p.intensity ?? 0.55) * 0.6,
        }),
      },
      {
        suffix: "stars",
        kind: "particle-field",
        z: -170,
        params: { variant: "starfield" },
      },
    ],
  }),
  makePreset({
    id: "mercury-motes",
    name: "Mercury Motes",
    description:
      "Large silver motes floating just past the lens over a soft high-key wash — near-field depth for light rooms.",
    tagline: "silver near motes",
    category: "particles",
    motion: "calm",
    renderModes: ["2d", "3d"],
    perfTier: "T0",
    grammarFamily: "particle-field-hero",
    keywords: ["motes", "silver", "light", "soft", "near", "floating"],
    defaults: {
      palette: "mercury",
      density: 0.4,
      drift: 0.4,
      depthSpread: 0.45,
      intensity: 0.6,
    },
    layers: [
      { suffix: "env", kind: "gradient-volume", params: { variant: "wash" } },
      {
        suffix: "motes",
        kind: "particle-field",
        attachment: "camera-locked",
        z: -30,
        opacity: 0.85,
        parallaxDepth: 0.1,
        params: { variant: "motes" },
      },
    ],
  }),
]);
