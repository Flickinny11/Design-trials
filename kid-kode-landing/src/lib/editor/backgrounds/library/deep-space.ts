// W-BG catalog — Deep Space (grammar: parallax-zoom-deep-dive).
//
// Five far-Z travel identities beyond Observatory Deep: dense fields the
// camera journey dives THROUGH — the deep-dive family's depth vocabulary
// (extreme depthSpread, layered far fields), each with a distinct destination
// mood. 3d-only by honest tagging: depth IS the technique here.

import type { BackgroundPreset } from "../types";
import { makePreset } from "./build-helpers";

export const DEEP_SPACE_PRESETS: readonly BackgroundPreset[] = Object.freeze([
  makePreset({
    id: "hyperlane",
    name: "Hyperlane",
    description:
      "A fast star river: high-drift starfield streaming past a thin electric veil — the travel shot of the catalog.",
    tagline: "streaming star travel",
    category: "deep-space",
    motion: "energetic",
    renderModes: ["3d"],
    perfTier: "T1",
    grammarFamily: "parallax-zoom-deep-dive",
    keywords: ["travel", "speed", "stars", "warp", "journey", "electric"],
    defaults: {
      palette: "arc",
      density: 0.65,
      drift: 0.85,
      depthSpread: 0.95,
      intensity: 0.6,
    },
    layers: [
      {
        suffix: "veil",
        kind: "volumetric-nebula",
        z: -430,
        opacity: 0.5,
        params: (p) => ({
          density: 0.2,
          intensity: Math.min(0.5, p.intensity ?? 0.5),
        }),
      },
      {
        suffix: "stream",
        kind: "particle-field",
        z: -170,
        params: { variant: "starfield" },
      },
      {
        suffix: "near",
        kind: "particle-field",
        z: -40,
        opacity: 0.8,
        params: (p) => ({
          variant: "crystals",
          density: (p.density ?? 0.65) * 0.5,
        }),
      },
    ],
  }),
  makePreset({
    id: "void-terminus",
    name: "Void Terminus",
    description:
      "The end of the line: a near-empty noir void, dim far stars, and one faint garnet glow low on the horizon.",
    tagline: "edge-of-nothing void",
    category: "deep-space",
    motion: "calm",
    renderModes: ["3d"],
    perfTier: "T1",
    grammarFamily: "parallax-zoom-deep-dive",
    keywords: ["void", "empty", "dark", "minimal", "lonely", "end"],
    defaults: {
      palette: "noir",
      density: 0.28,
      drift: 0.15,
      depthSpread: 0.9,
      intensity: 0.35,
    },
    layers: [
      { suffix: "env", kind: "volumetric-nebula", z: -440 },
      {
        suffix: "glow",
        kind: "gradient-volume",
        z: -420,
        opacity: 0.5,
        params: { variant: "horizon", palette: "garnet" },
      },
      {
        suffix: "stars",
        kind: "particle-field",
        z: -200,
        opacity: 0.7,
        params: (p) => ({
          variant: "starfield",
          density: (p.density ?? 0.28) * 0.7,
        }),
      },
    ],
  }),
  makePreset({
    id: "binary-dawn",
    name: "Binary Dawn",
    description:
      "Two suns rising through deep graphite gas — a warm bloom and a cold bloom facing off across a dense starfield.",
    tagline: "two-sun deep dawn",
    category: "deep-space",
    motion: "drift",
    renderModes: ["3d"],
    perfTier: "T1",
    grammarFamily: "parallax-zoom-deep-dive",
    keywords: ["dawn", "suns", "contrast", "warm", "cold", "epic"],
    defaults: {
      palette: "deep",
      density: 0.48,
      drift: 0.35,
      depthSpread: 0.85,
      intensity: 0.6,
    },
    layers: [
      { suffix: "env", kind: "volumetric-nebula", z: -440 },
      {
        suffix: "warm",
        kind: "gradient-volume",
        z: -430,
        opacity: 0.55,
        params: { variant: "wash", palette: "ember" },
      },
      {
        suffix: "stars",
        kind: "particle-field",
        z: -180,
        params: { variant: "starfield" },
      },
    ],
  }),
  makePreset({
    id: "graphite-abyss",
    name: "Graphite Abyss",
    description:
      "Heavy graphite gas closing in from every side, faint dust drifting far below — pressure and depth without light.",
    tagline: "heavy pressure depth",
    category: "deep-space",
    motion: "calm",
    renderModes: ["3d"],
    perfTier: "T1",
    grammarFamily: "parallax-zoom-deep-dive",
    keywords: ["abyss", "deep", "heavy", "graphite", "pressure", "dark"],
    defaults: {
      palette: "deep",
      density: 0.72,
      drift: 0.2,
      depthSpread: 0.9,
      intensity: 0.35,
    },
    layers: [
      { suffix: "env", kind: "volumetric-nebula", z: -440 },
      {
        suffix: "dust",
        kind: "particle-field",
        z: -210,
        opacity: 0.6,
        params: (p) => ({
          variant: "dust",
          density: (p.density ?? 0.72) * 0.5,
        }),
      },
    ],
  }),
  makePreset({
    id: "comet-field",
    name: "Comet Field",
    description:
      "Bright ice shards streaming through a cold deep field — crystalline debris the camera threads between.",
    tagline: "streaming ice shards",
    category: "deep-space",
    motion: "drift",
    renderModes: ["3d"],
    perfTier: "T1",
    grammarFamily: "parallax-zoom-deep-dive",
    keywords: ["comet", "ice", "shards", "debris", "cold", "space"],
    defaults: {
      palette: "ice",
      density: 0.55,
      drift: 0.6,
      depthSpread: 0.9,
      intensity: 0.6,
    },
    layers: [
      {
        suffix: "env",
        kind: "volumetric-nebula",
        z: -440,
        params: (p) => ({ density: (p.density ?? 0.55) * 0.55 }),
      },
      {
        suffix: "shards",
        kind: "particle-field",
        z: -160,
        params: { variant: "crystals" },
      },
      {
        suffix: "stars",
        kind: "particle-field",
        z: -220,
        opacity: 0.8,
        params: (p) => ({
          variant: "starfield",
          density: (p.density ?? 0.55) * 0.8,
        }),
      },
    ],
  }),
]);
