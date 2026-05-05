import { MSDFText } from 'three-msdf-text-webgpu';

export async function createFontAtlas({ fntUrl, pngUrl }) {
  const [fntText, png] = await Promise.all([
    fetch(fntUrl).then((r) => r.text()),
    fetch(pngUrl).then((r) => r.blob()).then((b) => createImageBitmap(b)),
  ]);
  return {
    fnt: fntText,
    bitmap: png,
    text(opts) { return new MSDFText({ font: fntText, atlas: png, ...opts }); },
  };
}
