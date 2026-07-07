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
    // cool teal key on deep near-black; lifted cyan shadows, restrained gain.
    lift: [0.97, 1.0, 1.02],
    gamma: 1.05,
    gain: [0.92, 1.04, 1.1],
    saturation: 1.1,
    contrast: 1.15,
    vignette: 0.32,
  },
  backdrop: {
    prompt:
      "moody dark atelier interior at night, deep near-black scene, cool teal " +
      "rim light raking across rippled glass shelves, soft aqueous caustic " +
      "reflections drifting on a dark stone wall, volumetric mist, cinematic " +
      "depth, shallow focus, photoreal, no text, no letters, no labels",
    seed: 31,
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
