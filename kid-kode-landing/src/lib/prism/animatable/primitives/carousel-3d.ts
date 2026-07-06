// carousel-3d — an N-cells-on-an-arc advance/retreat carousel (W-PHOTO D3).
// The state-machine primitive the gap report flagged missing for
// filmstrip-3d-carousel / coverflow-3d-carousel / bento-grid-slider: cells fan
// out from a front-and-centre active cell, receding in z with coverflow tilt +
// scale/opacity falloff. The active index NEVER RESTS (continuous drift) but
// EASES/COGS toward each cell (a dwell near integers) — "alive, not busy".
//
// Driven by scroll (userData.scroll) with a time drift fallback so the catalog
// tile always advances. scroll/card/hard; duration Infinity. Cells are deep
// echoes of the subject (shared geometry, cloned materials) — no invented look.

import { Box3, Vector3 } from "three";
import type { PrimitiveDefinition } from "../contract";
import { defineAnimatable } from "../base";
import { num } from "../contract";
import { makeEcho, type Echo } from "../echo";

const SCHEMA = [
  {
    id: "cells",
    label: "Cells",
    type: "fader",
    min: 3,
    max: 9,
    step: 1,
    default: 5,
  },
  {
    id: "spacing",
    label: "Spacing",
    type: "fader",
    min: 0.4,
    max: 2.5,
    step: 0.05,
    default: 1.15,
    unit: "x",
  },
  {
    id: "depth",
    label: "Recede",
    type: "fader",
    min: 0,
    max: 3,
    step: 0.05,
    default: 1,
  },
  {
    id: "tilt",
    label: "Coverflow tilt",
    type: "fader",
    min: 0,
    max: 1.2,
    step: 0.02,
    default: 0.6,
    unit: "rad",
  },
  {
    id: "drift",
    label: "Drift speed",
    type: "fader",
    min: 0,
    max: 1,
    step: 0.02,
    default: 0.22,
    unit: "x",
  },
  {
    id: "snap",
    label: "Snap",
    type: "fader",
    min: 0,
    max: 1,
    step: 0.02,
    default: 0.5,
  },
] as const;

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

export const carousel3dPrimitive: PrimitiveDefinition = {
  name: "carousel-3d",
  label: "Carousel 3D",
  category: "scroll",
  difficulty: "hard",
  subject: "card",
  defaultDriver: "scroll",
  schema: SCHEMA,
  description:
    "A coverflow carousel: cells fan from a front-centre active cell, receding " +
    "with tilt + scale/opacity falloff; the index drifts + eased-snaps (alive, not busy).",
  create: defineAnimatable(
    { name: "carousel-3d", category: "scroll", schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      // Subject-relative cell width so spacing is never hardcoded world units.
      const box = new Box3().setFromObject(subject);
      const sz = new Vector3();
      box.getSize(sz);
      const cellW = Math.max(0.001, sz.x || 1);

      const echoes: Echo[] = [];
      let count = 0;
      const build = () => {
        for (const e of echoes) {
          target.object.remove(e.root);
          e.dispose();
        }
        echoes.length = 0;
        count = Math.round(num(params.cells, 5));
        // subject is cell 0; add (count-1) echoes.
        for (let i = 1; i < count; i++) {
          const e = makeEcho(subject);
          target.object.add(e.root);
          echoes.push(e);
        }
      };
      build();

      // Base pose of the subject so we can restore it.
      const baseX = subject.position.x;
      const baseZ = subject.position.z;
      const baseSx = subject.scale.x;
      const baseSy = subject.scale.y;

      function placeCell(
        obj: {
          position: { set: (x: number, y: number, z: number) => void };
          rotation: { y: number };
          scale: { set: (x: number, y: number, z: number) => void };
        },
        slot: number,
        setOpacity?: (o: number) => void,
      ): void {
        const S = cellW * num(params.spacing, 1.15);
        const a = clamp(Math.abs(slot), 0, 3);
        // coverflow compression: near-centre cells spread, far ones bunch.
        const x = Math.tanh(slot * 0.7) * S * 1.9;
        const z = -a * num(params.depth, 1) * 0.9;
        const scale = baseSx * (1 - clamp(a, 0, 2) * 0.16);
        obj.position.set(baseX + x, subject.position.y, baseZ + z);
        obj.rotation.y =
          -Math.sign(slot) * clamp(a, 0, 1) * num(params.tilt, 0.6);
        obj.scale.set(scale, baseSy * (1 - clamp(a, 0, 2) * 0.16), 1);
        setOpacity?.(clamp(1 - a * 0.28, 0.12, 1));
      }

      return {
        duration: () => Infinity,
        seek: (t: number) => {
          // Active position: continuous drift (scroll or time) with an eased
          // "cog" that dwells near each cell (never fully resting).
          const s = target.userData.scroll;
          const base =
            typeof s === "number" && Number.isFinite(s)
              ? s * (count - 1)
              : t * num(params.drift, 0.22);
          const snap = num(params.snap, 0.5);
          const active =
            base - (snap * Math.sin(2 * Math.PI * base)) / (2 * Math.PI);

          // Cell 0 = subject; cells 1..N-1 = echoes. Their index in the ring is i.
          placeCell(subject, 0 - active);
          for (let i = 0; i < echoes.length; i++) {
            placeCell(echoes[i].root, i + 1 - active, echoes[i].setOpacity);
          }
        },
        onParamChange: (id: string) => {
          if (id === "cells") build();
        },
        dispose: () => {
          for (const e of echoes) {
            target.object.remove(e.root);
            e.dispose();
          }
          echoes.length = 0;
          subject.position.set(baseX, subject.position.y, baseZ);
          subject.rotation.y = 0;
          subject.scale.set(baseSx, baseSy, 1);
        },
      };
    },
  ),
};
