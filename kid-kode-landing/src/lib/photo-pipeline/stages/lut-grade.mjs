// PHOTO-PIPELINE stage — filmic LUT/colour grade (LOCAL, DEV-6).
//
// "Grade-as-curation": a UNIFIED grade across a generated set is what makes an
// editorial gallery read as one shoot rather than N prompts (layered-photo +
// editorial-product-gallery families). A 3D-LUT round-trip adds cost without
// quality for a lift/gamma/gain + saturation/contrast + vignette grade, so this
// is a deterministic local pass (sharp). It bakes the grade into the plate at
// pipeline time so the runtime needs no post chain (DEV-2 — this is how the
// watch at / gets a photoreal grade without touching the engine post path).
//
// Node/build-time only (sharp, BUILD_ALLOW). Never ships to the browser.

import sharp from "sharp";

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Radial vignette overlay as an SVG (multiplied over the image). */
function vignetteSvg(w, h, strength) {
  const s = clamp(strength, 0, 1);
  // inner fully transparent (white=keep), outer darkens by `s`.
  const outer = Math.round(255 * (1 - s));
  const hex = outer.toString(16).padStart(2, "0");
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
       <defs>
         <radialGradient id="v" cx="50%" cy="48%" r="72%">
           <stop offset="45%" stop-color="#ffffff"/>
           <stop offset="100%" stop-color="#${hex}${hex}${hex}"/>
         </radialGradient>
       </defs>
       <rect width="${w}" height="${h}" fill="url(#v)"/>
     </svg>`,
  );
}

/**
 * Apply a filmic grade to an image.
 * @param {string} srcPath
 * @param {string} outPath
 * @param {import('../types').GradeSpec} grade
 */
export async function gradeImage(srcPath, outPath, grade) {
  const { lift, gamma, gain, saturation, contrast, vignette } = grade;
  const meta = await sharp(srcPath).metadata();
  const W = meta.width ?? 1024;
  const H = meta.height ?? 1024;
  const hasAlpha = !!meta.hasAlpha;

  // Per-channel linear: out = in*mul + off. Fold contrast (pivot 128) into the
  // offset, gain (highlight tint) into the multiplier, lift (shadow tint) as a
  // small positive offset. Keep everything in 0..255 space.
  const c = clamp(contrast, 0.5, 2);
  const mul = [gain[0] * c, gain[1] * c, gain[2] * c];
  const pivot = (1 - c) * 128;
  const off = [
    pivot + (lift[0] - 1) * 40,
    pivot + (lift[1] - 1) * 40,
    pivot + (lift[2] - 1) * 40,
  ];

  let img = sharp(srcPath);
  // sharp.gamma accepts 1.0..3.0; clamp (a subtle filmic mid-lift lives here).
  img = img.gamma(clamp(gamma, 1, 3));
  img = img.linear(mul, off);
  img = img.modulate({ saturation: clamp(saturation, 0, 2) });

  let buf = await img.png().toBuffer();
  if (vignette > 0) {
    buf = await sharp(buf)
      .composite([{ input: vignetteSvg(W, H, vignette), blend: "multiply" }])
      .png()
      .toBuffer();
  }
  // Preserve transparency (product/garnish plates) — re-attach alpha if the
  // grade dropped it.
  if (hasAlpha) {
    const alpha = await sharp(srcPath)
      .ensureAlpha()
      .extractChannel(3)
      .toBuffer();
    buf = await sharp(buf).removeAlpha().joinChannel(alpha).png().toBuffer();
  }
  await sharp(buf).toFile(outPath);
  return { width: W, height: H, gamma, contrast: c, vignette };
}

/** A warm-neutral filmic default; per-composite hue keying overrides `gain`. */
export const DEFAULT_GRADE = {
  lift: [1.02, 1.0, 0.98],
  gamma: 1.08,
  gain: [1.04, 1.01, 0.96],
  saturation: 1.08,
  contrast: 1.12,
  vignette: 0.28,
};
