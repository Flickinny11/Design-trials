// Load the MSDF BMFont atlas into PixiJS v8's BitmapFont cache.
//
// Prefer loading from the static path under /prism-assets/ (the build-msdf.mjs
// writes font-inter.msdf.{fnt,png} there AND bundles them into the .prism
// archive). Static-path loading lets Pixi's BMFont parser resolve the .png
// reference inside the XML automatically.
//
// We also accept in-memory bytes (the .prism's own copy) as a fallback for
// fully self-contained deployments that don't ship the assets as static files.

import * as PIXI from "pixi.js";

export interface MsdfFont {
  family: string;
  installed: boolean;
}

const STATIC_FNT_URL = "/prism-assets/font-inter.msdf.fnt";

export async function loadMsdfFont(
  fntXml: string,
  _pngBuf: ArrayBuffer,
): Promise<MsdfFont | null> {
  // Infer face name so the node modules can resolve BitmapText by family.
  const faceMatch = /face="([^"]+)"/.exec(fntXml);
  const family = faceMatch ? faceMatch[1] : "Inter-Variable";

  // Attempt static-path load first (works when build-msdf.mjs has already
  // populated public/prism-assets/).
  try {
    await PIXI.Assets.load({
      alias: `prism-msdf-${family}`,
      src: STATIC_FNT_URL,
    });
    return { family, installed: true };
  } catch (e) {
    console.warn(
      "[prism/msdf-loader] MSDF font static-path load failed (expected if prism-assets not served as static):",
      (e as Error).message,
    );
  }
  return { family, installed: false };
}
