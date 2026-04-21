// Load the MSDF BMFont atlas shipped inside the .prism bundle into PixiJS v8's
// BitmapFont cache. Rewrites the .fnt's `file=` reference to point at a blob
// URL for the atlas PNG so Assets.load can resolve the page texture.

import * as PIXI from 'pixi.js';

export interface MsdfFont {
  family: string;
  installed: boolean;
}

export async function loadMsdfFont(fntXml: string, pngBuf: ArrayBuffer): Promise<MsdfFont | null> {
  const pngBlob = new Blob([pngBuf], { type: 'image/png' });
  const pngUrl = URL.createObjectURL(pngBlob);
  const patchedFnt = fntXml.replace(/file="[^"]+"/g, `file="${pngUrl}"`);
  const fntBlob = new Blob([patchedFnt], { type: 'text/xml' });
  const fntUrl = URL.createObjectURL(fntBlob);

  // Infer face name from the XML so node modules can resolve BitmapText by family.
  const faceMatch = patchedFnt.match(/face="([^"]+)"/);
  const family = faceMatch ? faceMatch[1] : 'Inter-Variable';

  try {
    await PIXI.Assets.load({ alias: `prism-msdf-${family}`, src: fntUrl });
    return { family, installed: true };
  } catch (e) {
    console.warn('[prism/msdf-loader] MSDF font load failed:', e);
    return { family, installed: false };
  } finally {
    // Keep the URLs alive — revoking would break BitmapText at runtime.
    // (They'll be released when the page unloads.)
  }
}
