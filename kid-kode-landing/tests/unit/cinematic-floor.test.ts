// W-PHOTO D4 — cinematic-floor library + catalog primitives (headless smoke).
//
// Proves the NODE-LOCAL floor pieces construct, are deterministic, and that the
// `contact-shadow` + `imperfection-veil` catalog primitives build → seek →
// param-change → dispose without throwing (no GPU needed to construct THREE
// objects + DataTextures). The full-frame post chain is verified visually on the
// real WebGPU canvas (photo-lab), not here.

import { describe, it, expect } from "vitest";
import {
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  type Scene,
} from "three";
import {
  makeImperfectionMap,
  makeImperfectionOverlay,
  applyImperfection,
} from "@/lib/prism/cinematic-floor/imperfection";
import { makeContactShadow } from "@/lib/prism/cinematic-floor/contact-shadow";
import { contactShadowPrimitive } from "@/lib/prism/animatable/primitives/contact-shadow";
import { imperfectionVeilPrimitive } from "@/lib/prism/animatable/primitives/imperfection-veil";
import type { AnimatableTarget } from "@/lib/prism/animatable/contract";

function fakeTarget(): AnimatableTarget {
  const object = new Group();
  const subject = new Mesh(
    new PlaneGeometry(2, 1.4),
    new MeshStandardMaterial(),
  );
  object.add(subject);
  return { object, subject, scene: object as unknown as Scene, userData: {} };
}

describe("cinematic-floor library", () => {
  it("makeImperfectionMap is deterministic for a fixed seed", () => {
    const a = makeImperfectionMap({ size: 64, seed: 42 });
    const b = makeImperfectionMap({ size: 64, seed: 42 });
    expect(a.image.width).toBe(64);
    expect(Buffer.from(a.image.data).equals(Buffer.from(b.image.data))).toBe(
      true,
    );
    a.dispose();
    b.dispose();
  });

  it("different seeds produce different maps", () => {
    const a = makeImperfectionMap({ size: 64, seed: 1 });
    const b = makeImperfectionMap({ size: 64, seed: 2 });
    expect(Buffer.from(a.image.data).equals(Buffer.from(b.image.data))).toBe(
      false,
    );
  });

  it("overlay has transparent (neutral) and opaque (imperfection) pixels", () => {
    const t = makeImperfectionOverlay({ size: 128, seed: 7 });
    const data = t.image.data as Uint8Array;
    let transparent = 0;
    let opaque = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 8) transparent++;
      else if (data[i] > 120) opaque++;
    }
    expect(transparent).toBeGreaterThan(0); // neutral areas = no-op
    expect(opaque).toBeGreaterThan(0); // dust/scratches present
  });

  it("applyImperfection sets a roughnessMap without throwing", () => {
    const mat = new MeshStandardMaterial({ roughness: 0.5 });
    const map = makeImperfectionMap({ size: 32 });
    applyImperfection(mat, map, 0.6);
    expect(mat.roughnessMap).toBe(map);
  });

  it("makeContactShadow builds a disposable mesh laid flat", () => {
    const cs = makeContactShadow({ size: 2, opacity: 0.5 });
    expect(cs.mesh.name).toBe("contact-shadow");
    expect(cs.mesh.rotation.x).toBeCloseTo(-Math.PI / 2);
    cs.dispose();
  });
});

describe("cinematic-floor catalog primitives", () => {
  for (const prim of [contactShadowPrimitive, imperfectionVeilPrimitive]) {
    it(`${prim.name}: build → seek → param-change → dispose`, () => {
      const target = fakeTarget();
      const before = target.object.children.length;
      const inst = prim.create(target);
      expect(target.object.children.length).toBeGreaterThan(before); // added its piece
      expect(inst.duration()).toBe(Infinity);
      expect(() => {
        inst.seek(0);
        inst.seek(1.3);
        for (const c of inst.controls()) {
          if (c.type === "fader")
            inst.setControl(c.id, (c as { max: number }).max);
        }
        inst.seek(2.1);
      }).not.toThrow();
      inst.dispose();
      expect(target.object.children.length).toBe(before); // cleaned up
    });
  }
});
