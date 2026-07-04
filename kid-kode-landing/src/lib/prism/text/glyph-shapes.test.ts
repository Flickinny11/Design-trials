// masterpiece-m2 — regression test for the hole-glyph front-cap fix.
// `ShapePath.toShapes(isCCW)` classified solids vs holes by winding, so glyphs
// whose counters arrive with inconsistent winding (Playfair 'a'/'O'/'o')
// produced broken caps: 'a' lost most of its face, 'O' filled its counter.
// `contoursToShapes` assembles by CONTAINMENT (winding-agnostic) and
// normalizes output winding, so cap triangulation is stable regardless of the
// font converter's contour direction.
import { describe, expect, it } from 'vitest';
import { ShapeUtils, Vector2 } from 'three';
import { contoursToShapes } from './text-object-3d';

const square = (cx: number, cy: number, half: number, clockwise = false): Vector2[] => {
  const pts = [
    new Vector2(cx - half, cy - half),
    new Vector2(cx + half, cy - half),
    new Vector2(cx + half, cy + half),
    new Vector2(cx - half, cy + half),
  ];
  return clockwise ? pts.reverse() : pts;
};

const shapeInkArea = (shape: ReturnType<typeof contoursToShapes>[number]): number => {
  const outer = Math.abs(ShapeUtils.area(shape.getPoints()));
  const holes = shape.holes.reduce((s, h) => s + Math.abs(ShapeUtils.area(h.getPoints())), 0);
  return outer - holes;
};

describe('contoursToShapes (winding-agnostic glyph assembly)', () => {
  it('detects a hole even when it winds the SAME direction as the outer (the broken-glyph case)', () => {
    const shapes = contoursToShapes([square(0, 0, 10), square(0, 0, 4)]); // both CCW
    expect(shapes).toHaveLength(1);
    expect(shapes[0].holes).toHaveLength(1);
    // ink area = outer − counter, i.e. the ring — NOT the filled disk ('O' bug)
    expect(shapeInkArea(shapes[0])).toBeCloseTo(20 * 20 - 8 * 8, 5);
  });

  it('handles fully inverted winding (outer CW, hole CCW)', () => {
    const shapes = contoursToShapes([square(0, 0, 10, true), square(0, 0, 4)]);
    expect(shapes).toHaveLength(1);
    expect(shapes[0].holes).toHaveLength(1);
    // normalized: solid CCW, hole CW
    expect(ShapeUtils.isClockWise(shapes[0].getPoints())).toBe(false);
    expect(ShapeUtils.isClockWise(shapes[0].holes[0].getPoints())).toBe(true);
  });

  it('keeps disjoint contours as separate solids (i / % / multi-part glyphs)', () => {
    const shapes = contoursToShapes([square(-20, 0, 5), square(20, 0, 5, true)]);
    expect(shapes).toHaveLength(2);
    expect(shapes[0].holes).toHaveLength(0);
    expect(shapes[1].holes).toHaveLength(0);
  });

  it('supports solid-within-hole nesting at depth 2 (©-style glyphs)', () => {
    const shapes = contoursToShapes([square(0, 0, 10), square(0, 0, 6, true), square(0, 0, 2)]);
    expect(shapes).toHaveLength(2); // outer ring + inner solid
    const areas = shapes.map(shapeInkArea).sort((a, b) => a - b);
    expect(areas[0]).toBeCloseTo(4 * 4, 5); // inner solid
    expect(areas[1]).toBeCloseTo(20 * 20 - 12 * 12, 5); // outer ring
  });

  it('cap triangulation covers exactly the ink area (the a/O regression in miniature)', () => {
    const shapes = contoursToShapes([square(0, 0, 10), square(0, 0, 4)]);
    const s = shapes[0];
    const contour = s.getPoints();
    const holes = s.holes.map((h) => h.getPoints());
    const faces = ShapeUtils.triangulateShape(contour, holes);
    const all = [...contour, ...holes.flat()];
    let area = 0;
    for (const [a, b, c] of faces) {
      const A = all[a];
      const B = all[b];
      const C = all[c];
      area += Math.abs((B.x - A.x) * (C.y - A.y) - (C.x - A.x) * (B.y - A.y)) / 2;
    }
    expect(area).toBeCloseTo(20 * 20 - 8 * 8, 4);
  });
});
