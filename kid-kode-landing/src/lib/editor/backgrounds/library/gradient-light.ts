// W-BG catalog — Gradient Light (grammar: cinematic-video-hero light grammar +
// editorial-product-gallery studio vocabulary).
//
// Nine gradient-light volumes: the T0-capable, 2d-affirmative workhorses.
// Every entry is a distinct light STORY (aurora / dawn / studio / cathedral /
// signal), not a hue swap — variant + palette + composition all differ.

import type { BackgroundPreset } from "../types";
import { makePreset } from "./build-helpers";

export const GRADIENT_LIGHT_PRESETS: readonly BackgroundPreset[] =
  Object.freeze([
    makePreset({
      id: "north-aurora",
      name: "North Aurora",
      description:
        "Green aurora curtains flowing across the upper sky with a quiet dark ground — the polar night, art-directed.",
      tagline: "green polar curtains",
      category: "gradient-light",
      motion: "flow",
      renderModes: ["2d", "3d"],
      perfTier: "T0",
      grammarFamily: "cinematic-video-hero",
      keywords: ["aurora", "green", "polar", "night", "curtains", "nature"],
      defaults: {
        palette: "verdant",
        density: 0.55,
        drift: 0.5,
        depthSpread: 0.5,
        intensity: 0.7,
      },
      layers: [
        {
          suffix: "env",
          kind: "gradient-volume",
          params: { variant: "aurora" },
        },
      ],
    }),
    makePreset({
      id: "arc-aurora",
      name: "Arc Aurora",
      description:
        "Electric cyan curtains — the aurora technique retold in the arc palette for product-launch energy.",
      tagline: "electric cyan curtains",
      category: "gradient-light",
      motion: "flow",
      renderModes: ["2d", "3d"],
      perfTier: "T0",
      grammarFamily: "cinematic-video-hero",
      keywords: ["aurora", "cyan", "electric", "launch", "bold", "energy"],
      defaults: {
        palette: "arc",
        density: 0.6,
        drift: 0.6,
        depthSpread: 0.5,
        intensity: 0.75,
      },
      layers: [
        {
          suffix: "env",
          kind: "gradient-volume",
          params: { variant: "aurora" },
        },
      ],
    }),
    makePreset({
      id: "dawnline",
      name: "Dawnline",
      description:
        'One warm horizon line burning low under a deep sky — the quietest way to say "beginning".',
      tagline: "warm horizon dawn",
      category: "gradient-light",
      motion: "calm",
      renderModes: ["2d", "3d"],
      perfTier: "T0",
      grammarFamily: "cinematic-video-hero",
      keywords: ["dawn", "horizon", "warm", "sunrise", "minimal", "hope"],
      defaults: {
        palette: "ember",
        density: 0.5,
        drift: 0.3,
        depthSpread: 0.5,
        intensity: 0.65,
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
      id: "cold-dawn",
      name: "Cold Dawn",
      description:
        "The ice-blue counterpart: a pale cold band on the horizon, still air above — clean and composed.",
      tagline: "ice horizon calm",
      category: "gradient-light",
      motion: "calm",
      renderModes: ["2d", "3d"],
      perfTier: "T0",
      grammarFamily: "cinematic-video-hero",
      keywords: ["dawn", "ice", "cold", "horizon", "clean", "calm"],
      defaults: {
        palette: "ice",
        density: 0.45,
        drift: 0.25,
        depthSpread: 0.5,
        intensity: 0.6,
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
      id: "studio-wash",
      name: "Studio Wash",
      description:
        "Three soft silver blooms breathing over charcoal — the seamless-paper product studio, alive but silent.",
      tagline: "silver studio blooms",
      category: "gradient-light",
      motion: "calm",
      renderModes: ["2d", "3d"],
      perfTier: "T0",
      grammarFamily: "editorial-product-gallery",
      keywords: ["studio", "product", "clean", "silver", "editorial", "soft"],
      defaults: {
        palette: "mercury",
        density: 0.55,
        drift: 0.3,
        depthSpread: 0.5,
        intensity: 0.6,
      },
      layers: [
        { suffix: "env", kind: "gradient-volume", params: { variant: "wash" } },
      ],
    }),
    makePreset({
      id: "stage-light",
      name: "Stage Light",
      description:
        "A single tight spotlight with a soft floor bounce and a deep vignette — one hero, one light.",
      tagline: "single hero spotlight",
      category: "gradient-light",
      motion: "still",
      renderModes: ["2d", "3d"],
      perfTier: "T0",
      grammarFamily: "editorial-product-gallery",
      keywords: ["spotlight", "stage", "hero", "dramatic", "focus", "theatre"],
      defaults: {
        palette: "noir",
        density: 0.5,
        drift: 0.15,
        depthSpread: 0.5,
        intensity: 0.7,
      },
      layers: [
        { suffix: "env", kind: "gradient-volume", params: { variant: "spot" } },
      ],
    }),
    makePreset({
      id: "cathedral-beams",
      name: "Cathedral Beams",
      description:
        "Pale diagonal shafts sweeping slowly through haze with dust hanging in the light — vertical, sacred, architectural.",
      tagline: "sacred light shafts",
      category: "gradient-light",
      motion: "calm",
      renderModes: ["2d", "3d"],
      perfTier: "T0",
      grammarFamily: "cinematic-video-hero",
      keywords: [
        "beams",
        "cathedral",
        "architectural",
        "light",
        "shafts",
        "pale",
      ],
      defaults: {
        palette: "bone",
        density: 0.5,
        drift: 0.3,
        depthSpread: 0.55,
        intensity: 0.65,
      },
      layers: [
        {
          suffix: "env",
          kind: "gradient-volume",
          params: { variant: "beams" },
        },
        {
          suffix: "dust",
          kind: "particle-field",
          z: -110,
          opacity: 0.7,
          params: (p) => ({
            variant: "dust",
            density: (p.density ?? 0.5) * 0.6,
          }),
        },
      ],
    }),
    makePreset({
      id: "signal-rings",
      name: "Signal Rings",
      description:
        "Concentric cyan rings breathing out from a focal point — radar calm, a pulse without an alarm.",
      tagline: "breathing radar rings",
      category: "gradient-light",
      motion: "pulse",
      renderModes: ["2d", "3d"],
      perfTier: "T0",
      grammarFamily: "glitch-cyber-fx",
      keywords: ["rings", "radar", "signal", "pulse", "tech", "cyan"],
      defaults: {
        palette: "arc",
        density: 0.5,
        drift: 0.5,
        depthSpread: 0.5,
        intensity: 0.6,
      },
      layers: [
        {
          suffix: "env",
          kind: "gradient-volume",
          params: { variant: "rings" },
        },
      ],
    }),
    makePreset({
      id: "noir-wash",
      name: "Noir Wash",
      description:
        "Deep red blooms barely rising out of black — the moody lounge wash for dark, confident brands.",
      tagline: "deep red lounge",
      category: "gradient-light",
      motion: "still",
      renderModes: ["2d", "3d"],
      perfTier: "T0",
      grammarFamily: "cinematic-video-hero",
      keywords: ["noir", "red", "moody", "lounge", "dark", "luxury"],
      defaults: {
        palette: "garnet",
        density: 0.45,
        drift: 0.18,
        depthSpread: 0.5,
        intensity: 0.5,
      },
      layers: [
        { suffix: "env", kind: "gradient-volume", params: { variant: "wash" } },
      ],
    }),
  ]);
