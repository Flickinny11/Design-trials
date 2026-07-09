// W-BG catalog — Nebulae & Volumes (grammar: particle-field-hero cluster).
//
// Six new volumetric identities beyond the launch pair (Brass/Chrome Nebula +
// Ice Field): each is a distinct palette + composition, not a recolor — the
// gas density/drift/glow story and the companion layers differ per entry.

import type { BackgroundPreset } from "../types";
import { makePreset } from "./build-helpers";

export const NEBULAE_PRESETS: readonly BackgroundPreset[] = Object.freeze([
  makePreset({
    id: "emberfall",
    name: "Emberfall",
    description:
      "A slow warm forge cloud in signal-orange over charcoal, live embers scattered through real depth and fine ash sinking near the lens.",
    tagline: "warm ember forge",
    category: "nebulae",
    motion: "drift",
    renderModes: ["3d"],
    perfTier: "T1",
    grammarFamily: "particle-field-hero",
    keywords: ["warm", "orange", "forge", "fire", "embers", "dramatic"],
    defaults: {
      palette: "ember",
      density: 0.52,
      drift: 0.55,
      depthSpread: 0.65,
      intensity: 0.62,
    },
    layers: [
      { suffix: "env", kind: "volumetric-nebula", z: -410 },
      {
        suffix: "embers",
        kind: "particle-field",
        z: -140,
        params: { variant: "embers" },
      },
      {
        suffix: "ash",
        kind: "particle-field",
        attachment: "camera-locked",
        z: -30,
        opacity: 0.7,
        parallaxDepth: 0.1,
        params: (p) => ({ variant: "ash", density: (p.density ?? 0.5) * 0.4 }),
      },
    ],
  }),
  makePreset({
    id: "verdant-veil",
    name: "Verdant Veil",
    description:
      "A thin emerald gas veil breathing over deep ink, with slow fireflies wandering the mid-field — organic and calm.",
    tagline: "emerald firefly veil",
    category: "nebulae",
    motion: "calm",
    renderModes: ["3d"],
    perfTier: "T1",
    grammarFamily: "particle-field-hero",
    keywords: ["green", "organic", "nature", "fireflies", "calm", "living"],
    defaults: {
      palette: "verdant",
      density: 0.34,
      drift: 0.3,
      depthSpread: 0.6,
      intensity: 0.55,
    },
    layers: [
      { suffix: "env", kind: "volumetric-nebula", z: -420 },
      {
        suffix: "fireflies",
        kind: "particle-field",
        z: -90,
        params: { variant: "fireflies" },
      },
    ],
  }),
  makePreset({
    id: "garnet-smoke",
    name: "Garnet Smoke",
    description:
      "Dense noir-red smoke banks with a muted glow — a moody, cinematic void with fine dust hanging in the depth.",
    tagline: "noir red smoke",
    category: "nebulae",
    motion: "drift",
    renderModes: ["3d"],
    perfTier: "T1",
    grammarFamily: "particle-field-hero",
    keywords: ["red", "noir", "moody", "smoke", "dark", "cinematic"],
    defaults: {
      palette: "garnet",
      density: 0.6,
      drift: 0.42,
      depthSpread: 0.7,
      intensity: 0.42,
    },
    layers: [
      { suffix: "env", kind: "volumetric-nebula", z: -420 },
      {
        suffix: "dust",
        kind: "particle-field",
        z: -130,
        opacity: 0.8,
        params: (p) => ({
          variant: "dust",
          density: Math.min(1, (p.density ?? 0.6) * 0.7),
        }),
      },
    ],
  }),
  makePreset({
    id: "mercury-haze",
    name: "Mercury Haze",
    description:
      "A high-key silver haze — thin bright gas over warm charcoal with sparse slow crystals. The light room of the nebula family.",
    tagline: "high-key silver haze",
    category: "nebulae",
    motion: "calm",
    renderModes: ["3d"],
    perfTier: "T1",
    grammarFamily: "particle-field-hero",
    keywords: ["silver", "light", "bright", "clean", "soft", "airy"],
    defaults: {
      palette: "mercury",
      density: 0.3,
      drift: 0.26,
      depthSpread: 0.55,
      intensity: 0.72,
    },
    layers: [
      { suffix: "env", kind: "volumetric-nebula", z: -420 },
      {
        suffix: "crystals",
        kind: "particle-field",
        z: -150,
        opacity: 0.7,
        params: (p) => ({
          variant: "crystals",
          density: (p.density ?? 0.3) * 0.6,
        }),
      },
    ],
  }),
  makePreset({
    id: "anodized-storm",
    name: "Anodized Storm",
    description:
      "A heavy blue storm front: dense anodized gas rolling in depth while thin rain streaks fall through the mid-field.",
    tagline: "blue storm front",
    category: "nebulae",
    motion: "energetic",
    renderModes: ["3d"],
    perfTier: "T1",
    grammarFamily: "particle-field-hero",
    keywords: ["blue", "storm", "rain", "weather", "dramatic", "heavy"],
    defaults: {
      palette: "anodized",
      density: 0.66,
      drift: 0.66,
      depthSpread: 0.72,
      intensity: 0.5,
    },
    layers: [
      { suffix: "env", kind: "volumetric-nebula", z: -420 },
      {
        suffix: "rain",
        kind: "particle-field",
        z: -80,
        opacity: 0.75,
        params: (p) => ({
          variant: "rain",
          density: (p.density ?? 0.66) * 0.75,
        }),
      },
    ],
  }),
  makePreset({
    id: "arc-tempest",
    name: "Arc Tempest",
    description:
      "The electric one: cyan-charged gas with plasma filaments arcing through the veil — high energy for launch moments.",
    tagline: "electric cyan tempest",
    category: "nebulae",
    motion: "energetic",
    renderModes: ["3d"],
    perfTier: "T2",
    grammarFamily: "particle-field-hero",
    keywords: ["electric", "cyan", "energy", "plasma", "bold", "launch"],
    defaults: {
      palette: "arc",
      density: 0.5,
      drift: 0.7,
      depthSpread: 0.7,
      intensity: 0.7,
    },
    layers: [
      { suffix: "env", kind: "volumetric-nebula", z: -420 },
      {
        suffix: "plasma",
        kind: "fluid-overlay",
        z: -70,
        opacity: 0.55,
        params: (p) => ({
          variant: "plasma",
          density: (p.density ?? 0.5) * 0.8,
        }),
      },
      {
        suffix: "sparks",
        kind: "particle-field",
        z: -120,
        params: (p) => ({
          variant: "embers",
          density: (p.density ?? 0.5) * 0.5,
        }),
      },
    ],
  }),
]);
