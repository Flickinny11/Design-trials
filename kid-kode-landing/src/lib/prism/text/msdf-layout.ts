// msdf-layout.ts — pure BMFont layout engine (LayoutTextFn from contract.ts).
//
// DOM-free + deterministic by construction: a pure function of (spec, data)
// with no randomness and no clock reads, so it runs identically in vitest
// (node) and in the browser runtime. Pen-based layout over msdf-bmfont-xml
// metrics, kerning-aware. Output quads are grouped into animation units
// (glyph | word | line) and re-expressed UNIT-LOCAL so primitives scale/rotate
// each unit around its own center (contract §TextLayoutUnit).

import { TEXT_SPEC_DEFAULT, type TextSpec } from '../../prism-graph/types';
import type {
  LayoutTextFn,
  MsdfChar,
  MsdfFontData,
  TextLayoutQuad,
  TextLayoutUnit,
} from './contract';

/** One placed glyph in absolute block space (pre-centering). */
interface GlyphPlacement {
  char: string;
  /** [minX, minY, maxX, maxY] in scene units, y up. */
  rect: [number, number, number, number];
  /** Atlas UVs [minU, minV, maxU, maxV] — three.js flipY-true convention. */
  uv: [number, number, number, number];
  lineIndex: number;
  wordIndex: number;
}

export const layoutText: LayoutTextFn = (spec: TextSpec, data: MsdfFontData) => {
  const content = spec.content ?? TEXT_SPEC_DEFAULT.content ?? '';
  const fontSize = spec.fontSize ?? TEXT_SPEC_DEFAULT.fontSize ?? 0.4;
  const letterSpacing = spec.letterSpacing ?? TEXT_SPEC_DEFAULT.letterSpacing ?? 0;
  const lineHeightMul = spec.lineHeight ?? TEXT_SPEC_DEFAULT.lineHeight ?? 1;
  const align = spec.align ?? TEXT_SPEC_DEFAULT.align ?? 'center';
  const decompose = spec.decompose ?? TEXT_SPEC_DEFAULT.decompose ?? 'glyph';

  const scale = fontSize / (data.info?.size ?? 48);
  const { scaleW, scaleH, lineHeight } = data.common;

  // Char lookup by literal string AND by numeric id — BMFont ids ARE unicode
  // code points, so the id path covers chars whose `char` field is absent.
  const byChar = new Map<string, MsdfChar>();
  const byId = new Map<number, MsdfChar>();
  for (const c of data.chars) {
    byId.set(c.id, c);
    if (c.char !== undefined) byChar.set(c.char, c);
  }
  const kernByPair = new Map<string, number>();
  for (const k of data.kernings ?? []) kernByPair.set(`${k.first}:${k.second}`, k.amount);

  const lines = content.split('\n');
  const placements: GlyphPlacement[] = [];
  const lineWidths: number[] = [];
  let wordIndex = -1;
  let inWord = false;

  for (let k = 0; k < lines.length; k++) {
    // Line k's glyph-box top hangs from the stacked line height.
    const lineTop = -k * (lineHeight * scale * lineHeightMul);
    let penX = 0;
    let advanced = 0;
    let prevId: number | null = null;

    for (const ch of Array.from(lines[k])) {
      const g = byChar.get(ch) ?? byId.get(ch.codePointAt(0) ?? -1);
      if (!g) {
        // Glyph missing from the atlas: skipped entirely (no quad, no
        // advance) so layout stays deterministic for any input string.
        prevId = null;
        continue;
      }
      if (prevId !== null) {
        const kern = kernByPair.get(`${prevId}:${g.id}`);
        if (kern) penX += kern * scale;
      }
      if (/\s/.test(ch)) {
        // Whitespace advances the pen but emits no quad.
        inWord = false;
      } else {
        if (!inWord) {
          wordIndex += 1;
          inWord = true;
        }
        const left = penX + g.xoffset * scale;
        const right = left + g.width * scale;
        const top = lineTop - g.yoffset * scale;
        const bottom = top - g.height * scale;
        placements.push({
          char: ch,
          rect: [left, bottom, right, top],
          // flipY-true TextureLoader convention: v=0 at texture bottom.
          uv: [
            g.x / scaleW,
            1 - (g.y + g.height) / scaleH,
            (g.x + g.width) / scaleW,
            1 - g.y / scaleH,
          ],
          lineIndex: k,
          wordIndex,
        });
      }
      penX += g.xadvance * scale + letterSpacing * fontSize;
      advanced += 1;
      prevId = g.id;
    }
    inWord = false; // a newline always terminates the word run
    // Advance width minus the trailing letter-spacing gap (no glyph follows).
    lineWidths.push(advanced > 0 ? penX - letterSpacing * fontSize : 0);
  }

  if (placements.length === 0) return { units: [], width: 0, height: 0 };

  // Align each line within the block's advance width.
  const blockAdvance = Math.max(...lineWidths);
  for (const p of placements) {
    const slack = blockAdvance - lineWidths[p.lineIndex];
    const dx = align === 'center' ? slack / 2 : align === 'right' ? slack : 0;
    p.rect[0] += dx;
    p.rect[2] += dx;
  }

  // Center the whole block on the origin (geometric quad bbox).
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of placements) {
    minX = Math.min(minX, p.rect[0]);
    minY = Math.min(minY, p.rect[1]);
    maxX = Math.max(maxX, p.rect[2]);
    maxY = Math.max(maxY, p.rect[3]);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const width = maxX - minX;
  const height = maxY - minY;
  for (const p of placements) {
    p.rect[0] -= cx;
    p.rect[1] -= cy;
    p.rect[2] -= cx;
    p.rect[3] -= cy;
  }

  // Block UVs: quad rect normalized 0..1 over the whole (centered) block —
  // sampled by gradient/texture fills via the aBlockUv attribute. Clamped:
  // edge quads can overshoot 1 by float epsilon after the centering shift.
  const bw = width || 1;
  const bh = height || 1;
  const norm01 = (v: number) => Math.min(1, Math.max(0, v));
  const blockUvOf = (rect: [number, number, number, number]): [number, number, number, number] => [
    norm01((rect[0] + bw / 2) / bw),
    norm01((rect[1] + bh / 2) / bh),
    norm01((rect[2] + bw / 2) / bw),
    norm01((rect[3] + bh / 2) / bh),
  ];

  // Group placements into animation units, preserving reading order.
  const groups: GlyphPlacement[][] = [];
  if (decompose === 'glyph') {
    for (const p of placements) groups.push([p]);
  } else {
    const byKey = new Map<number, GlyphPlacement[]>();
    for (const p of placements) {
      const key = decompose === 'word' ? p.wordIndex : p.lineIndex;
      let group = byKey.get(key);
      if (!group) {
        group = [];
        byKey.set(key, group);
        groups.push(group);
      }
      group.push(p);
    }
  }

  const units: TextLayoutUnit[] = groups.map((group) => {
    let uMinX = Infinity, uMinY = Infinity, uMaxX = -Infinity, uMaxY = -Infinity;
    for (const p of group) {
      uMinX = Math.min(uMinX, p.rect[0]);
      uMinY = Math.min(uMinY, p.rect[1]);
      uMaxX = Math.max(uMaxX, p.rect[2]);
      uMaxY = Math.max(uMaxY, p.rect[3]);
    }
    const center = { x: (uMinX + uMaxX) / 2, y: (uMinY + uMaxY) / 2 };
    const quads: TextLayoutQuad[] = group.map((p) => ({
      // UNIT-LOCAL rect: the unit's own center sits at the origin.
      rect: [
        p.rect[0] - center.x,
        p.rect[1] - center.y,
        p.rect[2] - center.x,
        p.rect[3] - center.y,
      ],
      uv: p.uv,
      blockUv: blockUvOf(p.rect),
    }));
    const text =
      decompose === 'line'
        ? lines[group[0].lineIndex]
        : group.map((p) => p.char).join('');
    return {
      center,
      quads,
      text,
      lineIndex: group[0].lineIndex,
      wordIndex: group[0].wordIndex,
    };
  });

  return { units, width, height };
};
