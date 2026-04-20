---
name: prism-atlas
description: Atlas baking pipeline — Sharp+SVG text compositing, MaxRects packing, AVIF encoding. Load when writing the build-atlas script, debugging atlas packing, or implementing text compositing.
---

# Atlas Baking Pipeline

## Input Sources

After provisioning completes, `source-images/` contains:

```
source-images/
  _style-reference.png      <- not packed, reference only
  base/                     <- one image per node
  overlays/                 <- reusable overlay layers
  states/                   <- per-node state variants
  frames/<nodeId>/          <- animation frame sequences
```

## Sharp+SVG Text Compositing

For each base image, look up the corresponding node in `hubs/home-hub.json`. For each `textContent` entry with `renderMethod: 'sharp-svg'`, render an SVG of that text at the specified typography and position, composite onto the base image BEFORE packing.

```js
import sharp from 'sharp';
import path from 'node:path';

function escapeXml(s) {
  return s.replace(/[<>&'"]/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
  }[c]));
}

async function renderTextOverlay(text, typography, position, canvasWidth, canvasHeight) {
  const { fontFamily, fontSize, fontWeight, color } = typography;
  const textAnchor = position.anchor === 'center' ? 'middle'
                   : position.anchor === 'right' ? 'end' : 'start';
  const fontPath = path.resolve(`public/fonts/${fontFamily}-Variable.ttf`);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}">
  <style>
    @font-face {
      font-family: '${fontFamily}';
      src: url('file://${fontPath}');
    }
  </style>
  <text x="${position.x}" y="${position.y}"
        font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}"
        fill="${color}" text-anchor="${textAnchor}"
        dominant-baseline="middle">${escapeXml(text)}</text>
</svg>`;

  return Buffer.from(svg);
}

async function compositeTextOntoBase(basePath, node) {
  const img = sharp(basePath);
  const meta = await img.metadata();

  const sharpSvgEntries = node.intent?.visualSpec?.textContent
    ?.filter(t => t.renderMethod === 'sharp-svg') ?? [];

  if (sharpSvgEntries.length === 0) return img;

  const overlays = await Promise.all(sharpSvgEntries.map(async t => ({
    input: await renderTextOverlay(t.text, t.typography, t.position, meta.width, meta.height),
    top: 0,
    left: 0,
  })));

  return img.composite(overlays);
}
```

## Packing with MaxRects

```js
import { MaxRectsPacker } from 'maxrects-packer';

const packer = new MaxRectsPacker(2048, 2048, 2);

const images = [];
for (const sourcePath of allSourceImages) {
  const img = await compositeTextOntoBase(sourcePath, nodesByAsset.get(path.basename(sourcePath, '.png')));
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  images.push({
    assetKey: path.basename(sourcePath, '.png'),
    width: info.width,
    height: info.height,
    channels: info.channels,
    data,
  });
}

packer.addArray(images.map(i => ({ width: i.width, height: i.height, data: i })));
```

## AVIF Encoding

```js
const atlasBase = sharp({
  create: { width: 2048, height: 2048, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
});

const composites = packer.bins[0].rects.map(r => ({
  input: r.data.data,
  raw: { width: r.width, height: r.height, channels: r.data.channels },
  top: r.y,
  left: r.x,
}));

const avif = await atlasBase.composite(composites).avif({ quality: 75, effort: 6 }).toBuffer();
writeFileSync('public/prism-assets/atlas-0.avif', avif);
```

## Regions JSON

```js
const regions = {};
packer.bins[0].rects.forEach(r => {
  regions[r.data.assetKey] = {
    atlasId: 'atlas-0',
    x: r.x, y: r.y, w: r.width, h: r.height,
  };
});
writeFileSync('public/prism-assets/atlas-regions.json', JSON.stringify(regions, null, 2));
```

## MSDF Font Atlas

Generated with `msdf-atlas-gen`:

```bash
npx msdf-atlas-gen \
  -font public/fonts/Inter-Variable.ttf \
  -size 48 \
  -type mtsdf \
  -imageout public/prism-assets/font-inter.msdf.png \
  -json public/prism-assets/font-inter.msdf.json \
  -charset "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ .,!?@#$%&*()-_+=/\\\"':;<>[]{}|~`^"
```

MTSDF is multi-channel true signed distance field — crispest quality.

## Verification

After packing, visually verify:
- `public/prism-assets/atlas-0.avif` opens and shows all elements packed with text composited
- `public/prism-assets/atlas-regions.json` has one entry per source image
- No element is clipped or overlapping

Add a sanity-check script that outputs `dist/atlas-preview.html` for visual inspection.
