// PHOTO-COMPOSITE config — "Meridian" layered-photo landing hero (W-TPL D2).
//
// The catalog's landing-archetype R2 composite: an ORIGINAL subject (handblown
// glass perfume flacon, teal rim-lit on near-black) fully distinct from the
// celestia brass instruments, the W-DG1 cold-brew exemplar, and every analyzed
// source (soda can / seasons / starry night). Single-hue discipline: deep teal.
// Every prompt carries the mandatory negative-text discipline (FP-13).

export default {
  id: "meridian-hero",
  themeHue: "#2fb7c9", // deep teal — one saturated hue per scene
  aspect: "3:2",
  grade: {
    // cool teal key, shadows LIFTED (WTPL D7) so the brighter dawn backdrop
    // survives grading instead of being crushed back toward black; midtones
    // lifted (gamma<1), gentler vignette.
    lift: [1.0, 1.04, 1.07],
    gamma: 0.92,
    gain: [0.95, 1.05, 1.1],
    saturation: 1.12,
    contrast: 1.08,
    vignette: 0.22,
  },
  backdrop: {
    // Brightened for the landing archetype (WTPL D7 fix): the original
    // "deep near-black" prompt rendered at avg luma ~10 and read as pure black
    // behind the flacon. This luminous-teal dawn variant keeps the single-hue
    // teal discipline + moody depth while giving the hero a visible, premium
    // stage. Same teal grade → harmonizes with the existing product/garnish.
    prompt:
      "a serene luminous atelier interior at first light, soft glowing aqua and " +
      "pale-cyan daylight washing across rippled glass shelves, gentle teal " +
      "caustic reflections shimmering on a pale stone wall, soft volumetric haze " +
      "catching bright dawn light, airy cinematic depth, shallow focus, bright " +
      "and clean, photoreal, no text, no letters, no labels",
    seed: 71,
  },
  headline: { text: "MERIDIAN" },
  product: {
    prompt:
      "a photoreal handblown glass perfume flacon with a faceted stopper, " +
      "filled with luminous pale-teal liquid, cool teal rim light tracing the " +
      "glass edges, dramatic single key light from upper right, deep shadow, " +
      "isolated on a pure solid black background, studio product photograph, " +
      "ultra sharp, no text, no letters, no labels",
    seed: 37,
  },
  garnish: [
    {
      id: "sprig",
      prompt:
        "a single fresh eucalyptus sprig with silver-green leaves, cool teal " +
        "rim light, isolated on a pure solid black background, macro product " +
        "shot, photoreal, no text, no letters, no labels",
      seed: 41,
      scale: 0.24,
    },
    {
      id: "seaglass",
      prompt:
        "a small tumbled teal sea-glass pebble, translucent frosted edges " +
        "catching cool light, isolated on a pure solid black background, macro " +
        "photoreal, no text, no letters, no labels",
      seed: 42,
      scale: 0.18,
      blur: 2,
    },
    {
      id: "droplet",
      prompt:
        "a suspended clear water droplet refracting cool teal light, macro " +
        "photograph, isolated on a pure solid black background, photoreal, " +
        "no text, no letters, no labels",
      seed: 43,
      scale: 0.14,
    },
  ],
};
