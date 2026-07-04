'use client';

// PRISM SHELL — IMAGE BRAND SEED (SHELL W2, E3)
//
// Client-side palette extraction from an uploaded screenshot or logo. Real and
// bounded: the image is drawn to a tiny offscreen canvas and sampled — nothing
// leaves the browser, no bytes are persisted (I5). The URL seed path uses the
// server-side metadata read instead (W2-D3). Returns a small brand palette the
// intake folds into the working Brand Profile; the Brief records that the seed
// was used (E3 transparency).

export interface ImageSeed {
  primary: string; // dominant dark structural tone
  secondary: string; // dominant light tone
  accent: string; // most saturated tone
}

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

/** Extract a 3-colour seed from an image file. Resolves null on decode error. */
export async function extractPaletteFromImage(file: File): Promise<ImageSeed | null> {
  if (!file.type.startsWith('image/')) return null;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const size = 40;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    let darkest = { r: 255, g: 255, b: 255, lum: 999 };
    let lightest = { r: 0, g: 0, b: 0, lum: -1 };
    let mostSat = { r: 128, g: 128, b: 128, s: -1 };

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 200) continue; // skip transparent (logo backgrounds)
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (lum < darkest.lum) darkest = { r, g, b, lum };
      if (lum > lightest.lum) lightest = { r, g, b, lum };
      const s = saturation(r, g, b);
      // Bias accent toward saturated, mid-luminance colours.
      if (s > mostSat.s && lum > 40 && lum < 230) mostSat = { r, g, b, s };
    }

    return {
      primary: toHex(darkest.r, darkest.g, darkest.b),
      secondary: toHex(lightest.r, lightest.g, lightest.b),
      accent: mostSat.s > 0.15 ? toHex(mostSat.r, mostSat.g, mostSat.b) : '#ff2a38',
    };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
