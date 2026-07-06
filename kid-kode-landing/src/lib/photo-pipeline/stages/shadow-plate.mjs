// PHOTO-PIPELINE stage — detached soft shadow-plate synthesis (LOCAL, DEV-6).
//
// A product hero "sells weight" with a SEPARATE soft shadow plate beneath it
// (layered-photo observation §4). A hosted shadow model adds cost without
// quality when the input already has a clean alpha, so this is a deterministic
// local pass: take the cutout's alpha silhouette, foreshorten it (vertical
// squash, as a shadow cast on the ground), blur it soft, tint near-black, dim to
// a believable density, and place it on a transparent full-size plate at the
// product's contact line. Output is a transparent PNG the runtime composites as
// its own layer with its own (near-zero) parallax rate.
//
// Node/build-time only (uses sharp, a BUILD_ALLOW dep). Never ships to browser.

import sharp from "sharp";

/**
 * @param {string} cutoutPath  transparent product cutout (alpha = silhouette)
 * @param {string} outPath     output transparent shadow plate (same dimensions)
 * @param {object} [opts]
 * @param {number} [opts.squash=0.34]   vertical foreshorten factor (ground cast)
 * @param {number} [opts.blur=24]       gaussian sigma (softness)
 * @param {number} [opts.opacity=0.5]   shadow density 0..1
 * @param {{r:number,g:number,b:number}} [opts.tint]  shadow colour (near-black)
 * @param {number} [opts.yOffset=0.02]  push below contact line (fraction of H)
 */
export async function synthesizeShadowPlate(cutoutPath, outPath, opts = {}) {
  const squash = opts.squash ?? 0.34;
  const blur = opts.blur ?? 24;
  const opacity = opts.opacity ?? 0.5;
  const tint = opts.tint ?? { r: 3, g: 4, b: 8 }; // near-black, faintly cool
  const yOffset = opts.yOffset ?? 0.02;

  const meta = await sharp(cutoutPath).metadata();
  const W = meta.width ?? 1024;
  const H = meta.height ?? 1024;
  const shadowH = Math.max(1, Math.round(H * squash));

  // Silhouette = cutout alpha, foreshortened + blurred soft.
  const sil = await sharp(cutoutPath)
    .ensureAlpha()
    .extractChannel(3)
    .resize(W, shadowH, { fit: "fill" })
    .blur(blur)
    .toBuffer();

  // Dim the silhouette to the target density (this becomes the plate's alpha).
  const alpha = await sharp(sil).linear(opacity, 0).toBuffer();

  // Near-black RGB fill, silhouette as alpha → a soft dark cast.
  const darkRGB = await sharp({
    create: { width: W, height: shadowH, channels: 3, background: tint },
  })
    .png()
    .toBuffer();
  const shadow = await sharp(darkRGB).joinChannel(alpha).png().toBuffer();

  // Place near the bottom contact line on a transparent full-size plate.
  const top = Math.max(0, Math.round(H - shadowH - H * yOffset));
  await sharp({
    create: {
      width: W,
      height: H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: shadow, top, left: 0 }])
    .png()
    .toFile(outPath);

  return { width: W, height: H, shadowH, blur, opacity };
}
