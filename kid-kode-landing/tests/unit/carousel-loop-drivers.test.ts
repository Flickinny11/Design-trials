// W-PHOTO D3 — carousel-3d + loop-column driver primitives (headless smoke).
//
// Proves the two multi-cell drivers build the right echo count, seek without
// throwing across scroll + time, rebuild on `cells` change, keep the loop-column
// within its wrap band (seamless), and restore the subject on dispose. Motion is
// verified visually as frame-sequences (notes/verification/shell-wphoto/drivers).

import { describe, it, expect } from "vitest";
import {
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Scene,
} from "three";
import { carousel3dPrimitive } from "@/lib/prism/animatable/primitives/carousel-3d";
import { loopColumnPrimitive } from "@/lib/prism/animatable/primitives/loop-column";
import type { AnimatableTarget } from "@/lib/prism/animatable/contract";

function cardTarget(): AnimatableTarget {
  const object = new Group();
  const subject = new Mesh(
    new PlaneGeometry(1.7, 1.05),
    new MeshBasicMaterial(),
  );
  object.add(subject);
  return { object, subject, scene: object as unknown as Scene, userData: {} };
}

describe("carousel-3d driver", () => {
  it("builds N cells (subject + echoes), seeks, rebuilds, disposes", () => {
    const t = cardTarget();
    const inst = carousel3dPrimitive.create(t);
    // default cells = 5 → subject + 4 echoes = 5 children
    expect(t.object.children.length).toBe(5);
    expect(() => {
      inst.seek(0);
      t.userData.scroll = 0.5;
      inst.seek(1.2);
      t.userData.scroll = 0.9;
      inst.seek(2.4);
    }).not.toThrow();
    // change cell count → rebuild
    inst.setControl("cells", 7);
    inst.seek(0.1);
    expect(t.object.children.length).toBe(7);
    inst.dispose();
    expect(t.object.children.length).toBe(1); // only the subject remains
  });
});

describe("loop-column driver", () => {
  it("builds N cells and keeps every cell within the wrap band (seamless)", () => {
    const t = cardTarget();
    const inst = loopColumnPrimitive.create(t);
    expect(t.object.children.length).toBe(5);

    // span = cellH*(1+gap) = 1.05*1.25 = 1.3125; L = 5*span. Every cell y must
    // stay within ±L/2 of baseY across the whole crawl (no cell escapes → seam-
    // less wrap).
    const span = 1.05 * 1.25;
    const L = 5 * span;
    for (let k = 0; k < 40; k++) {
      inst.seek(k * 0.37);
      for (const c of t.object.children) {
        expect(Math.abs(c.position.y)).toBeLessThanOrEqual(L / 2 + 1e-3);
      }
    }
    inst.dispose();
    expect(t.object.children.length).toBe(1);
  });

  it("scroll steers the crawl without throwing", () => {
    const t = cardTarget();
    const inst = loopColumnPrimitive.create(t);
    expect(() => {
      for (const s of [0, 0.25, 0.5, 0.75, 1]) {
        t.userData.scroll = s;
        inst.seek(s * 3);
      }
    }).not.toThrow();
    inst.dispose();
  });
});
