// PHOTO-COMPOSITE config — "Celestia" layered-photo hero (W-PHOTO D2 example).
//
// The canonical R2 composite: it proves the full pipeline (gen → cutout → depth
// → shadow → grade → scene) AND drops into the watch app's celestial scene as a
// photoreal environment layer that COMPLEMENTS the R1 configurator watch (the
// watch itself stays realtime PBR; this composite is the surrounding tableau, so
// no photoreal duplicate of the hero watch is generated — route-planner logic).
//
// Subjects are ORIGINAL brass astronomical instruments (armillary/orrery), NOT
// the product watch — an original composition per the legal doctrine (W-DG1).
// Every prompt carries the mandatory negative-text discipline (FP-13): no text,
// no letters, no labels — FLUX must never bake letterforms into a plate.

export default {
  id: "celestia-hero",
  themeHue: "#c9962f", // orrery gold — one saturated hue per state
  aspect: "3:2",
  grade: {
    // warm brass-gold key on deep near-black; single-hue discipline.
    lift: [1.0, 0.99, 0.97],
    gamma: 1.06,
    gain: [1.08, 1.02, 0.9],
    saturation: 1.12,
    contrast: 1.14,
    vignette: 0.34,
  },
  backdrop: {
    prompt:
      "moody dark observatory dome interior at night, deep near-black scene, " +
      "warm brass rim light raking across a curved wall, a soft starfield bokeh " +
      "glowing through the open aperture, volumetric haze, cinematic depth, " +
      "shallow focus, photoreal, no text, no letters, no labels",
    seed: 11,
  },
  headline: { text: "CELESTIA" },
  product: {
    prompt:
      "a photoreal antique brass armillary sphere and orrery, intricate concentric " +
      "rings and tiny planet spheres, polished aged brass with fine machined detail, " +
      "dramatic single warm key light from upper left, deep shadow, isolated on a " +
      "pure solid black background, studio product photograph, ultra sharp, " +
      "no text, no letters, no labels",
    seed: 7,
  },
  garnish: [
    {
      id: "gear",
      prompt:
        "a single polished aged brass watch gear, macro product shot, warm rim light, " +
        "isolated on a pure solid black background, photoreal, no text, no letters, no labels",
      seed: 21,
      scale: 0.22,
    },
    {
      id: "globe",
      prompt:
        "a small antique glass celestial globe with faint gold constellation lines, " +
        "soft warm light, isolated on a pure solid black background, photoreal, " +
        "no text, no letters, no labels",
      seed: 22,
      scale: 0.26,
      blur: 2,
    },
    {
      id: "moon",
      prompt:
        "a small pale luminous crescent moon fragment, subtle craters, warm gold edge " +
        "light, isolated on a pure solid black background, photoreal, no text, no letters, no labels",
      seed: 23,
      scale: 0.18,
    },
  ],
};
